import { normalizeSalonClientAppConfig } from "@/lib/clientAppConfig";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/formatters";
import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { OperationsPageData } from "./_lib";

type OperationsDashboardResponse = {
  overview: {
    active_inventory_products: number;
    active_staff_members: number;
    average_ticket: number | string;
    estimated_commissions: number | string;
    low_stock_products: number;
    top_staff_name: string | null;
    top_staff_revenue: number | string;
    total_revenue: number | string;
  };
  daily_revenue: Array<{
    completed_appointments: number;
    day: string;
    total_revenue: number | string;
  }>;
  top_staff: Array<{
    commission_flat_fee: number | string;
    commission_rate_percent: number | string;
    assigned_services?: number | string;
    completed_appointments: number;
    estimated_commission: number | string;
    id: string;
    is_active: boolean;
    name: string;
    next_appointment_at: string | null;
    pending_appointments: number;
    role: string | null;
    total_revenue: number | string;
    upcoming_appointments: number;
  }>;
};

type InventoryProductRow = {
  id: string;
  name: string;
  unit: string;
  current_stock: number | string;
  minimum_stock: number | string;
  image_paths: string[] | null;
};

type InventoryMovementRow = {
  id: string;
  movement_type: "in" | "out" | "adjustment";
  quantity: number | string;
  resulting_stock: number | string;
  reason: string | null;
  created_at: string;
  inventory_products: { name: string } | { name: string }[] | null;
};

type StoreOrderItemRow = {
  id: string;
  product_name_snapshot: string;
};

type StoreOrderRow = {
  id: string;
  order_number: number;
  status: "pending" | "confirmed" | "ready" | "completed" | "cancelled";
  total_items: number;
  subtotal_amount: number | string;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  customers:
    | { name: string; phone: string | null }
    | { name: string; phone: string | null }[]
    | null;
  customer_product_order_items: StoreOrderItemRow[] | null;
};

type AppointmentRow = {
  id: string;
  date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed" | "no_show";
  customers:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  services:
    | { id: string; name: string; price?: number | string | null }
    | { id: string; name: string; price?: number | string | null }[]
    | null;
};

type CustomerRow = {
  id: string;
  name: string;
  created_at: string;
  phone?: string | null;
  whatsapp_phone?: string | null;
};

type MonthlyTargetRow = {
  id: string;
  reference_month: string;
  revenue_goal: number | string;
  completed_appointments_goal: number;
  served_customers_goal: number;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatStock(value: number | string, unit: string) {
  const numericValue = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
  return `${formatted} ${unit}`;
}

function formatMovementLabel(value: InventoryMovementRow["movement_type"]) {
  switch (value) {
    case "in":
      return "Entrada";
    case "out":
      return "Saída";
    default:
      return "Ajuste";
  }
}

function formatStoreOrderStatusLabel(value: StoreOrderRow["status"]) {
  switch (value) {
    case "confirmed":
      return "Confirmado";
    case "ready":
      return "Pronto";
    case "completed":
      return "Concluído";
    case "cancelled":
      return "Cancelado";
    default:
      return "Novo";
  }
}

function resolveStoreOrderBadgeClass(value: StoreOrderRow["status"]) {
  switch (value) {
    case "confirmed":
      return "badge badge--confirmed";
    case "ready":
      return "badge badge--soft";
    case "completed":
      return "badge badge--confirmed";
    case "cancelled":
      return "badge badge--cancelled";
    default:
      return "badge badge--pending";
  }
}

function getMonthKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(value instanceof Date ? value : new Date(value));
}

function formatMonthLabel(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    month: "long",
    year: "numeric",
  }).format(value instanceof Date ? value : new Date(value));
}

function buildCurrencyGoalSuggestion(previousValue: number, currentValue: number) {
  const baseline =
    previousValue > 0
      ? previousValue * 1.1
      : Math.max(currentValue * 1.15, 1000);
  return Math.ceil(baseline / 50) * 50;
}

function buildCountGoalSuggestion(
  previousValue: number,
  currentValue: number,
  minimum = 1,
) {
  const baseline =
    previousValue > 0
      ? previousValue * 1.1
      : Math.max(currentValue * 1.15, minimum);
  return Math.max(minimum, Math.ceil(baseline));
}

function buildGoalProgress(current: number, target: number) {
  if (target <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((current / target) * 100)));
}

function formatProgressNote(
  current: number,
  target: number,
  formatter: (value: number) => string,
) {
  if (target <= 0) {
    return "Meta ainda não configurada.";
  }

  if (current >= target) {
    return "Meta atingida neste mês.";
  }

  return `Faltam ${formatter(target - current)} para fechar a meta.`;
}

function buildWhatsAppUrl(
  customer: CustomerRow & {
    daysSince: number;
  },
) {
  const phoneRaw = customer.whatsapp_phone ?? customer.phone ?? "";
  const digits = phoneRaw.replace(/\D+/g, "");

  if (!digits) {
    return null;
  }

  const message = encodeURIComponent(
    `Oi ${customer.name.split(" ")[0]}, aqui é do salão. Você esteve com a gente há ${Math.round(customer.daysSince)} dias. Quer agendar seu próximo horário?`,
  );

  return `https://wa.me/${digits}?text=${message}`;
}

export async function loadOperationsPageData(): Promise<OperationsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const clientAppConfig = normalizeSalonClientAppConfig(salon.client_app_config);
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12),
  );
  const currentMonthReference = currentMonthStart.toISOString().slice(0, 10);

  const [
    operationsResult,
    inventoryProductsResult,
    storeOrdersResult,
    inventoryMovementsResult,
    appointmentsResult,
    customersResult,
    monthlyTargetResult,
  ] = await Promise.all([
    supabase.rpc("get_owner_operations_dashboard", {
      days_input: 7,
      top_staff_limit_input: 5,
    }),
    supabase
      .from("inventory_products")
      .select("id, name, unit, current_stock, minimum_stock, image_paths")
      .eq("salon_id", salon.id)
      .order("name"),
    supabase
      .from("customer_product_orders")
      .select(
        "id, order_number, status, total_items, subtotal_amount, notes, cancellation_reason, created_at, confirmed_at, ready_at, completed_at, cancelled_at, customers(name, phone), customer_product_order_items(id, product_name_snapshot)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(8),
    supabase
      .from("inventory_movements")
      .select(
        "id, movement_type, quantity, resulting_stock, reason, created_at, inventory_products(name)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("appointments")
      .select("id, date, status, customers(id,name), services(id,name,price)")
      .eq("salon_id", salon.id)
      .gte(
        "date",
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("date", { ascending: false })
      .limit(1500),
    supabase
      .from("customers")
      .select("id, name, created_at, phone, whatsapp_phone")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(800),
    supabase
      .from("salon_monthly_targets")
      .select(
        "id, reference_month, revenue_goal, completed_appointments_goal, served_customers_goal",
      )
      .eq("salon_id", salon.id)
      .eq("reference_month", currentMonthReference)
      .maybeSingle(),
  ]);

  const operations = (operationsResult.data ??
    ({
      overview: {
        active_inventory_products: 0,
        active_staff_members: 0,
        average_ticket: 0,
        estimated_commissions: 0,
        low_stock_products: 0,
        top_staff_name: null,
        top_staff_revenue: 0,
        total_revenue: 0,
      },
      daily_revenue: [],
      top_staff: [],
    } as OperationsDashboardResponse)) as OperationsDashboardResponse;

  const inventoryProducts = (inventoryProductsResult.data ??
    []) as InventoryProductRow[];
  const inventoryProductImages = inventoryProducts.map((product) => ({
    current_stock: product.current_stock,
    id: product.id,
    imageUrl:
      (product.image_paths ?? [])
        .filter((path) => path?.trim())
        .map(
          (path) =>
            supabase.storage.from("inventory-products").getPublicUrl(path).data
              .publicUrl,
        )[0] ?? null,
    minimum_stock: product.minimum_stock,
    name: product.name,
    unit: product.unit,
  }));
  const lowStockProducts = inventoryProductImages.filter(
    (product) =>
      Number(product.current_stock ?? 0) <= Number(product.minimum_stock ?? 0),
  );

  const storeOrders = (storeOrdersResult.data ?? []) as StoreOrderRow[];
  const inventoryMovements = (inventoryMovementsResult.data ??
    []) as InventoryMovementRow[];
  const appointments = (appointmentsResult.data ?? []) as AppointmentRow[];
  const customers = (customersResult.data ?? []) as CustomerRow[];
  const monthlyTarget = (monthlyTargetResult.data ?? null) as
    | MonthlyTargetRow
    | null;

  const revenue = (set: AppointmentRow[]) =>
    set
      .filter((appointment) => appointment.status === "completed")
      .reduce((sum, appointment) => {
        const service = firstRelation(appointment.services);
        return sum + Number(service?.price ?? 0);
      }, 0);

  const currentMonthKey = getMonthKey(currentMonthStart, timeZone);
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12),
  );
  const previousMonthKey = getMonthKey(previousMonthStart, timeZone);
  const currentMonthAppointments = appointments.filter(
    (appointment) => getMonthKey(appointment.date, timeZone) === currentMonthKey,
  );
  const previousMonthAppointments = appointments.filter(
    (appointment) => getMonthKey(appointment.date, timeZone) === previousMonthKey,
  );
  const currentMonthCompletedAppointments = currentMonthAppointments.filter(
    (appointment) => appointment.status === "completed",
  );
  const previousMonthCompletedAppointments = previousMonthAppointments.filter(
    (appointment) => appointment.status === "completed",
  );
  const currentMonthRevenue = revenue(currentMonthCompletedAppointments);
  const previousMonthRevenue = revenue(previousMonthCompletedAppointments);
  const revenueDelta =
    previousMonthRevenue > 0
      ? ((currentMonthRevenue - previousMonthRevenue) / previousMonthRevenue) *
        100
      : null;
  const currentMonthCompletedCount = currentMonthCompletedAppointments.length;
  const previousMonthCompletedCount = previousMonthCompletedAppointments.length;
  const currentMonthServedCustomers = new Set(
    currentMonthCompletedAppointments
      .map((appointment) => firstRelation(appointment.customers)?.id ?? null)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const previousMonthServedCustomers = new Set(
    previousMonthCompletedAppointments
      .map((appointment) => firstRelation(appointment.customers)?.id ?? null)
      .filter((value): value is string => Boolean(value)),
  ).size;

  const serviceCounts = new Map<
    string,
    { count: number; name: string; total: number }
  >();
  const customerSpend = new Map<
    string,
    { name: string; total: number; visits: number }
  >();
  const hourBuckets = new Map<string, { count: number; total: number }>();
  let cancellations = 0;
  let totalScheduled = 0;

  for (const appointment of currentMonthAppointments) {
    const service = firstRelation(appointment.services);
    const customer = firstRelation(appointment.customers);
    const price = Number(service?.price ?? 0);

    if (appointment.status === "cancelled" || appointment.status === "no_show") {
      cancellations += 1;
    } else {
      totalScheduled += 1;
    }

    if (service && appointment.status === "completed") {
      const current = serviceCounts.get(service.id) ?? {
        count: 0,
        name: service.name,
        total: 0,
      };
      current.count += 1;
      current.total += price;
      serviceCounts.set(service.id, current);
    }

    if (customer && appointment.status === "completed") {
      const current = customerSpend.get(customer.id) ?? {
        name: customer.name,
        total: 0,
        visits: 0,
      };
      current.total += price;
      current.visits += 1;
      customerSpend.set(customer.id, current);
    }

    if (appointment.status === "completed") {
      const hour = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit",
        timeZone,
      }).format(new Date(appointment.date));
      const bucket = hourBuckets.get(hour) ?? { count: 0, total: 0 };
      bucket.total += price;
      bucket.count += 1;
      hourBuckets.set(hour, bucket);
    }
  }

  const topService =
    [...serviceCounts.values()].sort((a, b) => b.count - a.count)[0] ?? null;
  const topCustomer =
    [...customerSpend.values()].sort((a, b) => b.total - a.total)[0] ?? null;
  const bestHour =
    [...hourBuckets.entries()]
      .map(([hour, stats]) => ({
        avg: stats.count ? stats.total / stats.count : 0,
        hour,
      }))
      .sort((a, b) => b.avg - a.avg)[0] ?? null;
  const avgTicket =
    currentMonthCompletedCount > 0
      ? currentMonthRevenue / currentMonthCompletedCount
      : 0;
  const cancelRate =
    totalScheduled + cancellations > 0
      ? (cancellations / (totalScheduled + cancellations)) * 100
      : 0;
  const insightHighlights = [
    revenueDelta != null
      ? revenueDelta < 0
        ? `Faturamento ${Math.abs(Math.round(revenueDelta))}% abaixo do mês anterior.`
        : `Faturamento ${Math.round(revenueDelta)}% acima do mês anterior.`
      : "Primeiro mês com comparação disponível.",
    topService
      ? `${topService.name} lidera as vendas neste mês.`
      : "Sem serviço destaque ainda.",
    topCustomer
      ? `${topCustomer.name} é o maior ticket acumulado do mês.`
      : "Nenhum cliente destaque até agora.",
    bestHour
      ? `${bestHour.hour} concentra o melhor ticket médio do período.`
      : "O melhor horário aparece com mais atendimentos concluídos.",
  ].filter(Boolean);

  const stageCounters = {
    fidelizado: 0,
    novo: 0,
    perdido: 0,
    retorno: 0,
  };

  const lastVisitMap = new Map<string, { count: number; last: Date }>();

  for (const appointment of appointments.filter((item) => item.status === "completed")) {
    const customer = firstRelation(appointment.customers);

    if (!customer) {
      continue;
    }

    const last = lastVisitMap.get(customer.id);
    const dateObject = new Date(appointment.date);

    if (!last || dateObject > last.last) {
      lastVisitMap.set(customer.id, {
        count: (last?.count ?? 0) + 1,
        last: dateObject,
      });
    } else {
      lastVisitMap.set(customer.id, {
        count: last.count + 1,
        last: last.last,
      });
    }
  }

  for (const customer of customers) {
    const visit = lastVisitMap.get(customer.id);
    const daysSince = visit
      ? (now.getTime() - visit.last.getTime()) / (1000 * 60 * 60 * 24)
      : Infinity;
    const count = visit?.count ?? 0;
    const isNew =
      (now.getTime() - new Date(customer.created_at).getTime()) /
        (1000 * 60 * 60 * 24) <=
      30;

    if (count >= 3 && daysSince <= 60) {
      stageCounters.fidelizado += 1;
    } else if (daysSince <= 30) {
      stageCounters.retorno += 1;
    } else if (daysSince <= 60) {
      stageCounters.retorno += 1;
    } else if (!isNew) {
      stageCounters.perdido += 1;
    } else {
      stageCounters.novo += 1;
    }
  }

  const lostCustomers = customers
    .map((customer) => {
      const visit = lastVisitMap.get(customer.id);
      const daysSince = visit
        ? (now.getTime() - visit.last.getTime()) / (1000 * 60 * 60 * 24)
        : Infinity;

      return {
        ...customer,
        daysSince,
        lastVisit: visit?.last ?? null,
        visits: visit?.count ?? 0,
      };
    })
    .filter((customer) => customer.daysSince > 60)
    .sort((a, b) => b.daysSince - a.daysSince)
    .slice(0, 5);

  const suggestedRevenueGoal = buildCurrencyGoalSuggestion(
    previousMonthRevenue,
    currentMonthRevenue,
  );
  const suggestedCompletedGoal = buildCountGoalSuggestion(
    previousMonthCompletedCount,
    currentMonthCompletedCount,
    6,
  );
  const suggestedServedCustomersGoal = buildCountGoalSuggestion(
    previousMonthServedCustomers,
    currentMonthServedCustomers,
    4,
  );

  const revenueGoal = Number(monthlyTarget?.revenue_goal ?? suggestedRevenueGoal);
  const completedAppointmentsGoal = Number(
    monthlyTarget?.completed_appointments_goal ?? suggestedCompletedGoal,
  );
  const servedCustomersGoal = Number(
    monthlyTarget?.served_customers_goal ?? suggestedServedCustomersGoal,
  );
  const monthLabel = formatMonthLabel(currentMonthStart, timeZone);
  const goalCards = [
    {
      currentLabel: formatCurrency(currentMonthRevenue),
      id: "revenue",
      label: "Faturamento",
      note: formatProgressNote(currentMonthRevenue, revenueGoal, formatCurrency),
      progress: buildGoalProgress(currentMonthRevenue, revenueGoal),
      targetLabel: formatCurrency(revenueGoal),
      targetValue: revenueGoal,
    },
    {
      currentLabel: `${currentMonthCompletedCount}`,
      id: "completed",
      label: "Atendimentos concluídos",
      note: formatProgressNote(
        currentMonthCompletedCount,
        completedAppointmentsGoal,
        (value) => `${value}`,
      ),
      progress: buildGoalProgress(
        currentMonthCompletedCount,
        completedAppointmentsGoal,
      ),
      targetLabel: `${completedAppointmentsGoal}`,
      targetValue: completedAppointmentsGoal,
    },
    {
      currentLabel: `${currentMonthServedCustomers}`,
      id: "customers",
      label: "Clientes atendidos",
      note: formatProgressNote(
        currentMonthServedCustomers,
        servedCustomersGoal,
        (value) => `${value}`,
      ),
      progress: buildGoalProgress(
        currentMonthServedCustomers,
        servedCustomersGoal,
      ),
      targetLabel: `${servedCustomersGoal}`,
      targetValue: servedCustomersGoal,
    },
  ];

  return {
    customersAttention: {
      lostCustomers: lostCustomers.map((customer) => {
        const phoneValue = customer.whatsapp_phone ?? customer.phone ?? "";
        const hasContact = Boolean(phoneValue);

        return {
          contactSummary: hasContact
            ? "Enviar mensagem automática ou abrir no WhatsApp."
            : "Sem telefone cadastrado.",
          hasContact,
          id: customer.id,
          lastVisitLabel: customer.lastVisit
            ? `Última ${formatDate(customer.lastVisit.toISOString())}`
            : null,
          name: customer.name,
          phoneValue,
          stageBadges: [
            `${Math.round(customer.daysSince)} dias sem voltar`,
            `${customer.visits} visitas`,
          ],
          whatsappUrl: buildWhatsAppUrl(customer),
        };
      }),
      stageCounters,
    },
    goals: {
      cards: goalCards,
      currentMonthReference,
      helperText: monthlyTarget
        ? "Você pode revisar as metas a qualquer momento."
        : "Os valores iniciais foram sugeridos com base no mês anterior.",
      monthLabel,
      monthlyTargetSaved: Boolean(monthlyTarget),
    },
    header: {
      autoPilotEnabled: clientAppConfig.autoPilotEnabled,
      currentMonthRevenueLabel: formatCurrency(currentMonthRevenue),
      currentMonthServedCustomersLabel: `${currentMonthServedCustomers}`,
      estimatedCommissionsLabel: formatCurrency(
        Number(operations.overview.estimated_commissions ?? 0),
      ),
      lowStockProductsLabel: `${lowStockProducts.length} produtos em alerta`,
      monthLabel,
      storeOrdersLabel: `${storeOrders.length} pedidos recentes`,
      ticketLabel: formatCurrency(avgTicket),
    },
    insights: {
      bestHourSummary: bestHour
        ? `${bestHour.hour} concentra o melhor ticket médio do mês.`
        : "O sistema mostra o melhor horário assim que houver volume suficiente.",
      cancelRateSummary:
        totalScheduled + cancellations > 0
          ? `${cancelRate.toFixed(1)}% da agenda ficou em cancelamento ou falta.`
          : "Sem agenda suficiente para medir cancelamento.",
      highlights: insightHighlights,
      revenueSummary:
        revenueDelta == null
          ? "Ainda não existe base suficiente para comparar com o mês anterior."
          : revenueDelta < 0
            ? `Receita ${Math.abs(Math.round(revenueDelta))}% abaixo do mês anterior.`
            : `Receita ${Math.round(revenueDelta)}% acima do mês anterior.`,
      serviceSummary: topService
        ? `${topService.name} lidera o mês com ${topService.count} vendas.`
        : "Sem serviço destaque por enquanto.",
      ticketSummary: `Ticket médio atual: ${formatCurrency(avgTicket)}`,
      topCustomerSummary: topCustomer
        ? `${topCustomer.name} soma ${formatCurrency(topCustomer.total)} no período.`
        : "Nenhum cliente com destaque de faturamento até agora.",
    },
    inventory: {
      lowStockProducts: lowStockProducts.map((product) => ({
        id: product.id,
        imageUrl: product.imageUrl,
        minimumStockLabel: formatStock(product.minimum_stock, product.unit),
        name: product.name,
        stockLabel: formatStock(product.current_stock, product.unit),
      })),
      movements: inventoryMovements.map((movement) => ({
        createdAtLabel: formatDateTime(movement.created_at),
        id: movement.id,
        movementLabel: formatMovementLabel(movement.movement_type),
        productName:
          firstRelation(movement.inventory_products)?.name ?? "Produto",
        quantityLabel: formatStock(movement.quantity, ""),
        reason: movement.reason,
        resultingStockLabel: formatStock(movement.resulting_stock, ""),
      })),
    },
    store: {
      orders: storeOrders.map((order) => {
        const customer = firstRelation(order.customers);
        const items = order.customer_product_order_items ?? [];
        const orderMoment =
          order.cancelled_at ??
          order.completed_at ??
          order.ready_at ??
          order.confirmed_at ??
          order.created_at;

        return {
          canCancel: order.status !== "completed" && order.status !== "cancelled",
          canComplete: order.status === "ready",
          canConfirm: order.status === "pending",
          canReady: order.status === "pending" || order.status === "confirmed",
          contactLabel:
            customer?.phone?.trim() || customer?.name || "Sem contato",
          customerName: customer?.name ?? "Cliente",
          id: order.id,
          itemsSummary: items.length
            ? items.map((item) => item.product_name_snapshot).join(" • ")
            : "Pedido sem itens visíveis.",
          notes: order.notes?.trim() ? order.notes : null,
          orderMomentLabel: formatDateTime(orderMoment),
          orderNumberLabel: `#${order.order_number}`,
          status: order.status,
          statusBadgeClass: resolveStoreOrderBadgeClass(order.status),
          statusLabel: formatStoreOrderStatusLabel(order.status),
          totalItemsLabel: `${order.total_items} item${order.total_items === 1 ? "" : "s"}`,
          totalLabel: formatCurrency(Number(order.subtotal_amount ?? 0)),
        };
      }),
    },
    team: {
      members: operations.top_staff.map((staffMember) => {
        const assignedServices = Number(staffMember.assigned_services ?? 0);

        return {
          assignedServicesSummary: `${assignedServices} serviço${assignedServices === 1 ? "" : "s"} • ${staffMember.upcoming_appointments} futuros`,
          commissionFlatFee: Number(staffMember.commission_flat_fee ?? 0),
          commissionRatePercent: Number(
            staffMember.commission_rate_percent ?? 0,
          ),
          estimatedCommissionLabel: formatCurrency(
            Number(staffMember.estimated_commission ?? 0),
          ),
          id: staffMember.id,
          name: staffMember.name,
          performanceSummary: `Receita ${formatCurrency(Number(staffMember.total_revenue ?? 0))} • Comissão estimada ${formatCurrency(Number(staffMember.estimated_commission ?? 0))}`,
          roleSummary: `${staffMember.role?.trim() || "Profissional do salão"} •${staffMember.next_appointment_at ? ` próxima ${formatDateTime(staffMember.next_appointment_at)}` : " sem próxima reserva"}`,
          statusBadgeClass: staffMember.is_active
            ? "badge badge--confirmed"
            : "badge badge--cancelled",
          statusLabel: staffMember.is_active ? "Ativo" : "Pausado",
        };
      }),
    },
  };
}
