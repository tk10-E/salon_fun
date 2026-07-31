import { normalizeSalonClientAppConfig } from "@/lib/clientAppConfig";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
} from "@/lib/formatters";
import {
  AUTOPILOT_COMPLETION_GRACE_MINUTES,
  AUTOPILOT_CONFIRMED_NO_SHOW_GRACE_MINUTES,
  AUTOPILOT_PENDING_NO_SHOW_GRACE_MINUTES,
  buildAppointmentAutopilotSignalBadges,
  hasOperationsAutopilotSchedulerConfig,
  inspectOperationsAutopilotAppointment,
} from "@/lib/operationsAutopilot";
import { getConfiguredAppOrigin } from "@/lib/requestOrigin";
import { getCronSecret } from "@/lib/serverEnv";
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

type OperationsAutopilotAppointmentRow = {
  customer_confirmation_requested_at: string | null;
  customer_presence_confirmed_at: string | null;
  customers:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  date: string;
  deposit_customer_reported_paid_at: string | null;
  deposit_paid_at: string | null;
  deposit_status: string | null;
  ends_at: string;
  id: string;
  protection_confirmation_required: boolean | null;
  services:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  staff_members:
    | { id: string; name: string }
    | { id: string; name: string }[]
    | null;
  status: "pending" | "confirmed";
};

type CompletedAppointmentVisitRow = {
  customer_id?: string | null;
  date: string;
};

type CustomerRow = {
  id: string;
  name: string;
  created_at: string;
  phone?: string | null;
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
      return "Saida";
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
      return "Concluido";
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

function formatAutopilotHours(valueInMinutes: number) {
  const hours = valueInMinutes / 60;
  return Number.isInteger(hours)
    ? `${hours}h`
    : `${hours.toFixed(1).replace(".", ",")}h`;
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

export async function loadOperationsPageData(): Promise<OperationsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const clientAppConfig = normalizeSalonClientAppConfig(salon.client_app_config);
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const currentMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12),
  );
  const previousMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12),
  );
  const nextMonthStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12),
  );
  const currentMonthReference = currentMonthStart.toISOString().slice(0, 10);
  const autopilotWindowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const autopilotWindowEnd = new Date(now.getTime() + 36 * 60 * 60 * 1000);

  const [
    operationsResult,
    inventoryProductsResult,
    storeOrdersResult,
    inventoryMovementsResult,
    recentAppointmentsResult,
    autopilotAppointmentsResult,
    completedAppointmentsHistoryResult,
    customersResult,
    monthlyTargetResult,
    autopilotSchedulerReady,
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
      .gte("date", previousMonthStart.toISOString())
      .lt("date", nextMonthStart.toISOString())
      .order("date", { ascending: false })
      .limit(1500),
    supabase
      .from("appointments")
      .select(
        "id, date, ends_at, status, customer_confirmation_requested_at, customer_presence_confirmed_at, deposit_paid_at, deposit_customer_reported_paid_at, deposit_status, protection_confirmation_required, customers(id,name), services(id,name), staff_members(id,name)",
      )
      .eq("salon_id", salon.id)
      .in("status", ["pending", "confirmed"])
      .gte("date", autopilotWindowStart.toISOString())
      .lt("date", autopilotWindowEnd.toISOString())
      .order("date", { ascending: true })
      .limit(120),
    supabase
      .from("appointments")
      .select("customer_id, date")
      .eq("salon_id", salon.id)
      .eq("status", "completed")
      .gte(
        "date",
        new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString(),
      )
      .order("date", { ascending: false })
      .limit(1500),
    supabase
      .from("customers")
      .select("id, name, created_at, phone")
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
    hasOperationsAutopilotSchedulerConfig(),
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
  const lowStockProducts = inventoryProducts
    .filter(
      (product) =>
        Number(product.current_stock ?? 0) <= Number(product.minimum_stock ?? 0),
    )
    .map((product) => ({
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

  const storeOrders = (storeOrdersResult.data ?? []) as StoreOrderRow[];
  const inventoryMovements = (inventoryMovementsResult.data ??
    []) as InventoryMovementRow[];
  const recentAppointments = (recentAppointmentsResult.data ?? []) as
    AppointmentRow[];
  const autopilotAppointments = (autopilotAppointmentsResult.data ?? []) as
    OperationsAutopilotAppointmentRow[];
  const completedAppointmentsHistory =
    (completedAppointmentsHistoryResult.data ?? []) as CompletedAppointmentVisitRow[];
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
  const previousMonthKey = getMonthKey(previousMonthStart, timeZone);
  const currentMonthAppointments = recentAppointments.filter(
    (appointment) => getMonthKey(appointment.date, timeZone) === currentMonthKey,
  );
  const previousMonthAppointments = recentAppointments.filter(
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
      : "Sem serviço em destaque ainda.",
    topCustomer
      ? `${topCustomer.name} é o maior ticket acumulado do mês.`
      : "Nenhuma cliente em destaque até agora.",
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

  for (const appointment of completedAppointmentsHistory) {
    if (!appointment.customer_id) {
      continue;
    }

    const last = lastVisitMap.get(appointment.customer_id);
    const dateObject = new Date(appointment.date);

    if (!last || dateObject > last.last) {
      lastVisitMap.set(appointment.customer_id, {
        count: (last?.count ?? 0) + 1,
        last: dateObject,
      });
    } else {
      lastVisitMap.set(appointment.customer_id, {
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

  const autopilotQueue = autopilotAppointments
    .map((appointment) => {
      const inspection = inspectOperationsAutopilotAppointment(appointment, now);
      const customerName =
        firstRelation(appointment.customers)?.name ?? "Cliente";
      const serviceName = firstRelation(appointment.services)?.name ?? "Serviço";
      const staffName = firstRelation(appointment.staff_members)?.name ?? "Equipe";
      const signalBadges =
        inspection.signalBadges.length > 0
          ? inspection.signalBadges
          : buildAppointmentAutopilotSignalBadges(appointment);

      return {
        action: inspection.action,
        badgeClassName:
          inspection.action === "complete"
            ? "badge badge--confirmed"
            : inspection.action === "no_show"
              ? "badge badge--cancelled"
              : "badge badge--pending",
        badgeLabel:
          inspection.action === "complete"
            ? "Concluir sozinho"
            : inspection.action === "no_show"
              ? "Virar falta"
              : "Acompanhando",
        date: appointment.date,
        depositStatus: appointment.deposit_status,
        hasProtection:
          Boolean(appointment.customer_confirmation_requested_at) ||
          appointment.protection_confirmation_required === true,
        id: appointment.id,
        meta: `${serviceName} • ${staffName} • ${formatDateTime(appointment.date)}`,
        note: inspection.reason,
        signalBadges,
        title: customerName,
      };
    })
    .filter((item) => {
      if (item.action !== "watch") {
        return true;
      }

      return item.hasProtection || item.depositStatus === "pending";
    })
    .sort((left, right) => {
      const priority =
        (left.action === "complete" ? 0 : left.action === "no_show" ? 1 : 2) -
        (right.action === "complete" ? 0 : right.action === "no_show" ? 1 : 2);

      if (priority !== 0) {
        return priority;
      }

      return new Date(left.date).getTime() - new Date(right.date).getTime();
    })
    .slice(0, 6);

  const autopilotReadyToCompleteCount = autopilotQueue.filter(
    (item) => item.action === "complete",
  ).length;
  const autopilotReadyToNoShowCount = autopilotQueue.filter(
    (item) => item.action === "no_show",
  ).length;
  const autopilotCustomerSignalsCount = autopilotAppointments.filter((item) =>
    Boolean(item.customer_presence_confirmed_at),
  ).length;
  const autopilotDepositSignalsCount = autopilotAppointments.filter((item) =>
    Boolean(item.deposit_paid_at || item.deposit_customer_reported_paid_at),
  ).length;
  const schedulerCanSelfConfigure = Boolean(
    getConfiguredAppOrigin() && getCronSecret(),
  );
  const autopilotStatusNote = !clientAppConfig.autoPilotEnabled
    ? "Sem esse modo, o salão ainda precisa fechar atendimento na mão."
    : autopilotSchedulerReady
      ? "O sistema acompanha agenda, confirmação e fechamento sem clique manual."
      : schedulerCanSelfConfigure
        ? "O agendador ainda não ficou pronto. Salve Ajustes uma vez para finalizar a ligação."
        : "O agendador ainda não ficou pronto no servidor.";
  const autopilotRules = [
    "Horários do app entram aceitos automaticamente.",
    salon.booking_policy_auto_confirm_new_appointments
      ? "Horários lançados no painel entram aceitos sem clique."
      : null,
    salon.booking_policy_enabled &&
    salon.booking_policy_confirmation_required &&
    salon.booking_policy_auto_cancel_unconfirmed
      ? `Sem confirmação da cliente, o sistema cancela ${salon.booking_policy_auto_cancel_lead_minutes} min antes.`
      : null,
    salon.booking_policy_enabled &&
    salon.booking_policy_requires_deposit &&
    salon.booking_policy_auto_cancel_pending_deposit
      ? `Sem sinal, o sistema cancela ${salon.booking_policy_auto_cancel_lead_minutes} min antes.`
      : null,
    `Depois do horário, o sistema conclui em ${AUTOPILOT_COMPLETION_GRACE_MINUTES} min quando encontra sinal real da cliente ou do pagamento.`,
    `Sem sinal suficiente, o sistema marca falta entre ${formatAutopilotHours(AUTOPILOT_PENDING_NO_SHOW_GRACE_MINUTES)} e ${formatAutopilotHours(AUTOPILOT_CONFIRMED_NO_SHOW_GRACE_MINUTES)} depois do fim.`,
  ].filter((value): value is string => Boolean(value));

  return {
    autopilot: {
      active: clientAppConfig.autoPilotEnabled,
      cards: [
        {
          id: "customer-signals",
          label: "Cliente confirmou",
          note: "Leitura do app e da presença",
          value: `${autopilotCustomerSignalsCount}`,
        },
        {
          id: "deposit-signals",
          label: "Sinal pronto",
          note: "Pago ou informado pela cliente",
          value: `${autopilotDepositSignalsCount}`,
        },
        {
          id: "ready-to-complete",
          label: "Concluir sozinho",
          note: "Horários já com prova suficiente",
          value: `${autopilotReadyToCompleteCount}`,
        },
        {
          id: "ready-to-no-show",
          label: "Virar falta",
          note: "Horários sem sinal forte",
          value: `${autopilotReadyToNoShowCount}`,
        },
      ],
      queue: autopilotQueue.map((item) => ({
        badgeClassName: item.badgeClassName,
        badgeLabel: item.badgeLabel,
        id: item.id,
        meta: item.meta,
        note: item.note,
        signalBadges: item.signalBadges,
        title: item.title,
      })),
      rules: autopilotRules,
      schedulerReady: autopilotSchedulerReady,
      statusNote: autopilotStatusNote,
    },
    customersAttention: {
      lostCustomers: lostCustomers.map((customer) => {
        const phoneValue = customer.phone ?? "";
        const hasContact = Boolean(phoneValue);

        return {
          contactSummary: hasContact
          ? "Contato pronto para ação direta no cadastro."
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
          ],        };
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
        : "Sem serviço em destaque por enquanto.",
      ticketSummary: `Ticket médio atual: ${formatCurrency(avgTicket)}`,
      topCustomerSummary: topCustomer
        ? `${topCustomer.name} soma ${formatCurrency(topCustomer.total)} no periodo.`
        : "Nenhum cliente com destaque de faturamento ate agora.",
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
            ? items.map((item) => item.product_name_snapshot).join(" - ")
            : "Pedido sem itens visiveis.",
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
          assignedServicesSummary: `${assignedServices} serviço${assignedServices === 1 ? "" : "s"} - ${staffMember.upcoming_appointments} futuros`,
          commissionFlatFee: Number(staffMember.commission_flat_fee ?? 0),
          commissionRatePercent: Number(
            staffMember.commission_rate_percent ?? 0,
          ),
          estimatedCommissionLabel: formatCurrency(
            Number(staffMember.estimated_commission ?? 0),
          ),
          id: staffMember.id,
          name: staffMember.name,
          performanceSummary: `Receita ${formatCurrency(Number(staffMember.total_revenue ?? 0))} - Comissão estimada ${formatCurrency(Number(staffMember.estimated_commission ?? 0))}`,
          roleSummary: `${staffMember.role?.trim() || "Profissional do salão"} -${staffMember.next_appointment_at ? ` próxima ${formatDateTime(staffMember.next_appointment_at)}` : " sem próxima reserva"}`,
          statusBadgeClass: staffMember.is_active
            ? "badge badge--confirmed"
            : "badge badge--cancelled",
          statusLabel: staffMember.is_active ? "Ativo" : "Pausado",
        };
      }),
    },
  };
}
