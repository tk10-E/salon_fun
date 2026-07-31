import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import {
  calculateProjectedCommissionAmount,
  resolveBookedAppointmentAmount,
} from "@/lib/financialMetrics";
import { createClient } from "@/lib/supabase/server";

import type {
  NotificationsPageData,
  NotificationsPageSearchParams,
} from "./_lib";
import {
  firstParam,
  getCategory,
  getTypesForCategory,
  KNOWN_NOTIFICATION_TYPES,
  parseDateEnd,
  parseDateStart,
  parsePage,
  type NotificationCategory,
  type NotificationDispatchSnapshot,
  type NotificationRow,
} from "./shared";

type NotificationsFilterState = {
  audienceFilter: string;
  categoryFilter: NotificationCategory | "";
  dateFrom: string;
  dateFromIso: string | null;
  dateTo: string;
  dateToIso: string | null;
  q: string;
};

type NotificationAppointmentAlertRow = {
  customers: { name?: string | null } | { name?: string | null }[] | null;
  date: string;
  services: { name?: string | null } | { name?: string | null }[] | null;
};

type NotificationReadyOrderRow = {
  customers: { name?: string | null } | { name?: string | null }[] | null;
  order_number: number | null;
  ready_at: string | null;
};

type NotificationOpenTabRow = {
  customers: { name?: string | null } | { name?: string | null }[] | null;
  opened_at: string;
  total_items: number | string;
  total_paid: number | string;
};

type NotificationPayoutAppointmentRow = {
  completed_at: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  services:
    | { price?: number | string | null }
    | { price?: number | string | null }[]
    | null;
  staff_members:
    | {
        commission_flat_fee?: number | string | null;
        commission_rate_percent?: number | string | null;
      }
    | {
        commission_flat_fee?: number | string | null;
        commission_rate_percent?: number | string | null;
      }[]
    | null;
};

type NotificationTeamPayoutRow = {
  amount: number | string;
  occurred_on: string;
};

const PAGE_SIZE = 20;
const CUSTOMER_CANCELLATION_ALERT_WINDOW_DAYS = 7;
const READY_ORDER_ALERT_HOURS = 24;
const OPEN_TAB_ALERT_HOURS = 24;
const TEAM_PAYOUT_LOOKBACK_DAYS = 45;

function currentDateKeyInBrazil() {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";
  return `${year}-${month}-${day}`;
}

function firstRelation<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function monthKeyFromDate(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function formatAlertDateTime(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function buildHoursAgoIso(hours: number) {
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
}

function buildDaysAgoIso(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
}

function buildDaysAgoDateKey(days: number) {
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
}

function ageHours(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  return Math.max(
    0,
    Math.floor((Date.now() - new Date(value).getTime()) / (60 * 60 * 1000)),
  );
}

function buildNotificationsHref(
  currentSearchParams: NotificationsPageSearchParams | undefined,
  overrides: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  const entries = [
    ["q", firstParam(currentSearchParams?.q)],
    ["audience", firstParam(currentSearchParams?.audience)],
    ["category", firstParam(currentSearchParams?.category)],
    ["dateFrom", firstParam(currentSearchParams?.dateFrom)],
    ["dateTo", firstParam(currentSearchParams?.dateTo)],
    ["page", String(parsePage(currentSearchParams?.page))],
  ] as const;

  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();
  return `/dashboard/notifications${search ? `?${search}` : ""}`;
}

function normalizeCategory(value: string): NotificationCategory | "" {
  if (
    value === "promotion" ||
    value === "growth" ||
    value === "appointment" ||
    value === "referral" ||
    value === "service" ||
    value === "feed" ||
    value === "other"
  ) {
    return value;
  }

  return "";
}

function applyNotificationFilters(
  query: any,
  filters: NotificationsFilterState,
) {
  let nextQuery = query;

  if (
    filters.audienceFilter === "salon_customers" ||
    filters.audienceFilter === "single_customer"
  ) {
    nextQuery = nextQuery.eq("audience", filters.audienceFilter);
  }

  if (filters.q) {
    nextQuery = nextQuery.or(
      `title.ilike.%${filters.q}%,body.ilike.%${filters.q}%`,
    );
  }

  if (filters.dateFromIso) {
    nextQuery = nextQuery.gte("created_at", filters.dateFromIso);
  }

  if (filters.dateToIso) {
    nextQuery = nextQuery.lte("created_at", filters.dateToIso);
  }

  if (filters.categoryFilter) {
    if (filters.categoryFilter === "other") {
      nextQuery = nextQuery.not(
        "notification_type",
        "in",
        `(${KNOWN_NOTIFICATION_TYPES.map((type) => `"${type}"`).join(",")})`,
      );
    } else {
      nextQuery = nextQuery.in(
        "notification_type",
        getTypesForCategory(filters.categoryFilter),
      );
    }
  }

  return nextQuery;
}

function buildNotificationsFilterSummary(filters: {
  audienceFilter: string;
  categoryFilter: NotificationCategory | "";
  dateFrom: string;
  dateTo: string;
  q: string;
}) {
  const parts: string[] = [];

  if (filters.q) {
    parts.push(`busca por "${filters.q}"`);
  }

  if (filters.audienceFilter === "salon_customers") {
    parts.push("público geral");
  } else if (filters.audienceFilter === "single_customer") {
    parts.push("cliente específico");
  }

  if (filters.categoryFilter) {
    parts.push(`categoria ${filters.categoryFilter}`);
  }

  if (filters.dateFrom) {
    parts.push(`de ${filters.dateFrom}`);
  }

  if (filters.dateTo) {
    parts.push(`até ${filters.dateTo}`);
  }

  return parts.length ? parts.join(" • ") : "sem filtro ativo";
}

function buildExportHref(filters: {
  audienceFilter: string;
  categoryFilter: NotificationCategory | "";
  dateFrom: string;
  dateTo: string;
  q: string;
}) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.audienceFilter) {
    params.set("audience", filters.audienceFilter);
  }

  if (filters.categoryFilter) {
    params.set("category", filters.categoryFilter);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  const search = params.toString();
  return `/dashboard/notifications/export${search ? `?${search}` : ""}`;
}

export async function loadNotificationsPageData(
  searchParams?: NotificationsPageSearchParams,
): Promise<NotificationsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const financeTable = (supabase as any).from("salon_financial_transactions");
  const recentWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const customerCancellationWindowStart = buildDaysAgoIso(
    CUSTOMER_CANCELLATION_ALERT_WINDOW_DAYS,
  );
  const overdueReadyThresholdIso = buildHoursAgoIso(READY_ORDER_ALERT_HOURS);
  const staleOpenTabThresholdIso = buildHoursAgoIso(OPEN_TAB_ALERT_HOURS);
  const teamPayoutLookbackStartIso = buildDaysAgoIso(TEAM_PAYOUT_LOOKBACK_DAYS);
  const teamPayoutLookbackStartDate =
    buildDaysAgoDateKey(TEAM_PAYOUT_LOOKBACK_DAYS);
  const q = firstParam(searchParams?.q).trim();
  const audienceFilter = firstParam(searchParams?.audience).trim();
  const categoryFilter = normalizeCategory(
    firstParam(searchParams?.category).trim(),
  );
  const dateFrom = firstParam(searchParams?.dateFrom).trim();
  const dateTo = firstParam(searchParams?.dateTo).trim();
  const page = parsePage(searchParams?.page);
  const todayKey = currentDateKeyInBrazil();
  const salonTimeZone = salon.timezone ?? "America/Sao_Paulo";
  const currentMonthKey = todayKey.slice(0, 7);
  const dateFromIso = parseDateStart(dateFrom);
  const dateToIso = parseDateEnd(dateTo);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const filters: NotificationsFilterState = {
    audienceFilter,
    categoryFilter,
    dateFrom,
    dateFromIso,
    dateTo,
    dateToIso,
    q,
  };

  const baseSelect =
    "id, audience, notification_type, title, body, created_at, customers(name)";

  const [
    listResult,
    activePushTokensResult,
    recentPushTokensResult,
    inventoryAlertsResult,
    payablesAlertsResult,
    recurringAlertsResult,
    recentCustomerCancelledAppointmentsResult,
    readyOrdersWithoutPickupResult,
    staleOpenTabsResult,
    commissionAppointmentsResult,
    teamPayoutTransactionsResult,
  ] = await Promise.all([
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select(baseSelect, { count: "exact" })
        .eq("salon_id", salon.id),
      filters,
    )
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .gte("last_seen_at", recentWindowStart),
    supabase
      .from("inventory_products")
      .select("id, name, current_stock, minimum_stock, unit")
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_payables")
      .select("id, title, amount, due_on, status")
      .eq("salon_id", salon.id)
      .eq("status", "pending")
      .lte("due_on", todayKey)
      .order("due_on", { ascending: true })
      .limit(6),
    supabase
      .from("salon_recurring_expenses")
      .select("id, title, amount, next_due_on, is_active")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .lte("next_due_on", todayKey)
      .order("next_due_on", { ascending: true })
      .limit(6),
    supabase
      .from("appointments")
      .select("date, customers(name), services(name)", { count: "exact" })
      .eq("salon_id", salon.id)
      .eq("status", "cancelled")
      .eq("cancelled_by", "customer")
      .gte("cancelled_at", customerCancellationWindowStart)
      .order("cancelled_at", { ascending: false })
      .limit(5),
    supabase
      .from("customer_product_orders")
      .select("order_number, ready_at, customers(name)", {
        count: "exact",
      })
      .eq("salon_id", salon.id)
      .eq("status", "ready")
      .not("ready_at", "is", null)
      .lte("ready_at", overdueReadyThresholdIso)
      .order("ready_at", { ascending: true })
      .limit(5),
    supabase
      .from("customer_tabs")
      .select("opened_at, total_items, total_paid, customers(name)", {
        count: "exact",
      })
      .eq("salon_id", salon.id)
      .eq("status", "open")
      .lte("opened_at", staleOpenTabThresholdIso)
      .order("opened_at", { ascending: true })
      .limit(5),
    supabase
      .from("appointments")
      .select(
        "date, completed_at, service_price_snapshot, services(price), staff_members(commission_rate_percent, commission_flat_fee)",
      )
      .eq("salon_id", salon.id)
      .eq("status", "completed")
      .not("completed_at", "is", null)
      .gte("completed_at", teamPayoutLookbackStartIso),
    financeTable
      .select("amount, occurred_on")
      .eq("salon_id", salon.id)
      .eq("source", "team_payout")
      .gte("occurred_on", teamPayoutLookbackStartDate),
  ]);

  const notifications = (listResult.data ?? []) as NotificationRow[];
  const dispatchSnapshotsResult = notifications.length
    ? await supabase.rpc("get_salon_notification_dispatch_snapshot", {
        notification_ids_input: notifications.map(
          (notification) => notification.id,
        ),
      })
    : { data: [] as NotificationDispatchSnapshot[] };
  const dispatchSnapshots = (dispatchSnapshotsResult.data ??
    []) as NotificationDispatchSnapshot[];
  const dispatchMap = new Map(
    dispatchSnapshots.map((snapshot) => [snapshot.notification_id, snapshot]),
  );

  const totalCount = listResult.count ?? 0;
  const activePushTokensCount = activePushTokensResult.count ?? 0;
  const deliveredOnPageCount = dispatchSnapshots.filter(
    (snapshot) => snapshot.status === "delivered",
  ).length;
  const issueOnPageCount = dispatchSnapshots.filter(
    (snapshot) =>
      snapshot.status === "delivery_failed" ||
      snapshot.status === "enqueue_failed",
  ).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem =
    totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );
  const inventoryAlerts = (
    (inventoryAlertsResult.data ?? []) as Array<{
      current_stock: number | string;
      id: string;
      minimum_stock: number | string;
      name: string;
      unit: string | null;
    }>
  ).filter((product) => {
    const stock = Number(product.current_stock ?? 0);
    const minimum = Number(product.minimum_stock ?? 0);
    return stock <= minimum;
  });
  const payableAlerts = (payablesAlertsResult.data ?? []) as Array<{
    amount: number | string;
    due_on: string;
    id: string;
    title: string;
  }>;
  const recurringAlerts = (recurringAlertsResult.data ?? []) as Array<{
    amount: number | string;
    id: string;
    next_due_on: string;
    title: string;
  }>;
  const recentCustomerCancelledAppointments = (recentCustomerCancelledAppointmentsResult.data ??
    []) as NotificationAppointmentAlertRow[];
  const recentCustomerCancelledAppointmentsCount =
    recentCustomerCancelledAppointmentsResult.count ??
    recentCustomerCancelledAppointments.length;
  const readyOrdersWithoutPickup = (readyOrdersWithoutPickupResult.data ??
    []) as NotificationReadyOrderRow[];
  const readyOrdersWithoutPickupCount =
    readyOrdersWithoutPickupResult.count ?? readyOrdersWithoutPickup.length;
  const staleOpenTabs = (staleOpenTabsResult.data ?? []) as NotificationOpenTabRow[];
  const staleOpenTabsCount = staleOpenTabsResult.count ?? staleOpenTabs.length;
  const commissionAppointments = (commissionAppointmentsResult.data ?? []) as
    NotificationPayoutAppointmentRow[];
  const teamPayoutTransactions = (teamPayoutTransactionsResult.data ?? []) as
    NotificationTeamPayoutRow[];
  const overduePayables = payableAlerts.filter((item) => item.due_on < todayKey);
  const todayPayables = payableAlerts.filter((item) => item.due_on === todayKey);
  const overdueRecurring = recurringAlerts.filter(
    (item) => item.next_due_on < todayKey,
  );
  const todayRecurring = recurringAlerts.filter(
    (item) => item.next_due_on === todayKey,
  );
  const latestCustomerCancellation =
    recentCustomerCancelledAppointments[0] ?? null;
  const oldestReadyOrder = readyOrdersWithoutPickup[0] ?? null;
  const oldestOpenTab = staleOpenTabs[0] ?? null;
  const currentMonthProjectedCommission = commissionAppointments
    .filter((appointment) => {
      const referenceDate = appointment.completed_at ?? appointment.date;
      return monthKeyFromDate(referenceDate, salonTimeZone) === currentMonthKey;
    })
    .reduce((sum, appointment) => {
      const service = firstRelation(appointment.services);
      const staffMember = firstRelation(appointment.staff_members);
      return (
        sum +
        calculateProjectedCommissionAmount({
          amount: resolveBookedAppointmentAmount({
            servicePrice: service?.price,
            servicePriceSnapshot: appointment.service_price_snapshot,
          }),
          commissionFlatFee: staffMember?.commission_flat_fee,
          commissionRatePercent: staffMember?.commission_rate_percent,
        })
      );
    }, 0);
  const currentMonthTeamPayoutsPaid = teamPayoutTransactions
    .filter((item) => monthKeyFromDate(item.occurred_on, salonTimeZone) === currentMonthKey)
    .reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const commissionPendingPayout = Number(
    (
      currentMonthProjectedCommission - currentMonthTeamPayoutsPaid
    ).toFixed(2),
  );
  const operationalAlertCount =
    recentCustomerCancelledAppointmentsCount +
    readyOrdersWithoutPickupCount +
    staleOpenTabsCount +
    (commissionPendingPayout > 0 ? 1 : 0);
  const internalAlerts = [
    ...(overduePayables.length || overdueRecurring.length
      ? [
          {
            body: `${overduePayables.length + overdueRecurring.length} despesa(s) seguem vencidas e ainda não foram baixadas no caixa.`,
            href: "/dashboard/finance",
            id: "finance-overdue",
            label: "Financeiro",
            title: `Vencidos agora: ${overduePayables.length + overdueRecurring.length}`,
            tone: "danger" as const,
          },
        ]
      : []),
    ...(recentCustomerCancelledAppointmentsCount
      ? [
          {
            body: latestCustomerCancellation
              ? `${recentCustomerCancelledAppointmentsCount} horário(s) foram cancelados pela cliente nos últimos ${CUSTOMER_CANCELLATION_ALERT_WINDOW_DAYS} dias. Último movimento: ${(firstRelation(latestCustomerCancellation.customers)?.name ?? "Cliente")} cancelou ${(firstRelation(latestCustomerCancellation.services)?.name ?? "o serviço")} de ${formatAlertDateTime(latestCustomerCancellation.date)}.`
              : `${recentCustomerCancelledAppointmentsCount} horário(s) foram cancelados pela cliente nos últimos ${CUSTOMER_CANCELLATION_ALERT_WINDOW_DAYS} dias.`,
            href: "/dashboard/gestao/agendamentos",
            id: "appointments-cancelled-by-customer",
            label: "Agenda",
            title:
              recentCustomerCancelledAppointmentsCount === 1
                ? "Cancelamento pela cliente"
                : `Cancelamentos pela cliente: ${recentCustomerCancelledAppointmentsCount}`,
            tone:
              recentCustomerCancelledAppointmentsCount >= 3
                ? ("danger" as const)
                : ("warning" as const),
          },
        ]
      : []),
    ...(readyOrdersWithoutPickupCount
      ? [
          {
            body: oldestReadyOrder
              ? `${readyOrdersWithoutPickupCount} pedido(s) já estão prontos e seguem sem retirada. O mais antigo é o pedido #${oldestReadyOrder.order_number ?? "?"} de ${(firstRelation(oldestReadyOrder.customers)?.name ?? "cliente")} desde ${formatAlertDateTime(oldestReadyOrder.ready_at ?? todayKey)}.`
              : `${readyOrdersWithoutPickupCount} pedido(s) já estão prontos e seguem sem retirada.`,
            href: "/dashboard/operations",
            id: "store-orders-ready-without-pickup",
            label: "Loja",
            title:
              readyOrdersWithoutPickupCount === 1
                ? "Pedido pronto sem retirada"
                : `Retiradas pendentes: ${readyOrdersWithoutPickupCount}`,
            tone:
              (oldestReadyOrder?.ready_at && ageHours(oldestReadyOrder.ready_at) >= 48) ||
              readyOrdersWithoutPickupCount >= 3
                ? ("danger" as const)
                : ("warning" as const),
          },
        ]
      : []),
    ...(staleOpenTabsCount
      ? [
          {
            body: oldestOpenTab
              ? `${staleOpenTabsCount} comanda(s) seguem abertas há mais de ${OPEN_TAB_ALERT_HOURS}h. A mais antiga está em nome de ${(firstRelation(oldestOpenTab.customers)?.name ?? "cliente avulso")} com ${formatCurrency(Math.max(0, Number(oldestOpenTab.total_items ?? 0) - Number(oldestOpenTab.total_paid ?? 0)))} em aberto.`
              : `${staleOpenTabsCount} comanda(s) seguem abertas há mais de ${OPEN_TAB_ALERT_HOURS}h.`,
            href: "/dashboard/operations/comandas",
            id: "stale-open-tabs",
            label: "Comandas",
            title:
              staleOpenTabsCount === 1
                ? "Comanda aberta há tempo demais"
                : `Comandas abertas há muito tempo: ${staleOpenTabsCount}`,
            tone:
              (oldestOpenTab?.opened_at && ageHours(oldestOpenTab.opened_at) >= 48) ||
              staleOpenTabsCount >= 3
                ? ("danger" as const)
                : ("warning" as const),
          },
        ]
      : []),
    ...(commissionPendingPayout > 0
      ? [
          {
            body: `${formatCurrency(currentMonthProjectedCommission)} já estão projetados em comissão neste mês, ${formatCurrency(currentMonthTeamPayoutsPaid)} foram baixados e ${formatCurrency(commissionPendingPayout)} seguem pendentes para repasse.`,
            href: "/dashboard/finance",
            id: "team-payout-pending",
            label: "Equipe",
            title: "Repasse da equipe pendente",
            tone: "warning" as const,
          },
        ]
      : []),
    ...(todayPayables.length || todayRecurring.length
      ? [
          {
            body: `${todayPayables.length + todayRecurring.length} despesa(s) vencem hoje e pedem conferência no financeiro.`,
            href: "/dashboard/finance",
            id: "finance-due-today",
            label: "Financeiro",
            title: `Vence hoje: ${todayPayables.length + todayRecurring.length}`,
            tone: "warning" as const,
          },
        ]
      : []),
    ...inventoryAlerts.slice(0, 3).map((product) => {
      const stock = Number(product.current_stock ?? 0);
      const minimum = Number(product.minimum_stock ?? 0);
      const unit = product.unit?.trim() || "un";
      return {
        body: `${product.name} está com ${stock} ${unit} em estoque para um mínimo de ${minimum} ${unit}.`,
        href: "/dashboard/inventory",
        id: `inventory-${product.id}`,
        label: "Estoque",
        title: stock <= 0 ? "Produto sem estoque" : "Produto com estoque baixo",
        tone: stock <= 0 ? ("danger" as const) : ("warning" as const),
      };
    }),
  ];

  return {
    filters: {
      audienceFilter,
      categoryFilter,
      clearHref: "/dashboard/notifications",
      dateFrom,
      dateTo,
      endItem,
      filterSummary: buildNotificationsFilterSummary({
        audienceFilter,
        categoryFilter,
        dateFrom,
        dateTo,
        q,
      }),
      q,
      safePage,
      showClear: Boolean(
        q || audienceFilter || categoryFilter || dateFrom || dateTo,
      ),
      startItem,
      totalPages,
    },
    header: {
      activePushTokensCount,
      recentPushTokensCount: recentPushTokensResult.count ?? 0,
      deliveredOnPageCount,
      exportHref: buildExportHref({
        audienceFilter,
        categoryFilter,
        dateFrom,
        dateTo,
        q,
      }),
      issueOnPageCount,
      totalCount,
    },
    internalAlerts: {
      dueFinancialCount:
        overduePayables.length +
        todayPayables.length +
        overdueRecurring.length +
        todayRecurring.length,
      items: internalAlerts,
      lowStockCount: inventoryAlerts.length,
      operationalCount: operationalAlertCount,
    },
    history: {
      currentPagePath: buildNotificationsHref(searchParams, { page: safePage }),
      items: notifications.map((notification) => {
        const customer = Array.isArray(notification.customers)
          ? (notification.customers[0] ?? null)
          : notification.customers;
        const dispatch = dispatchMap.get(notification.id) ?? null;

        return {
          audience: notification.audience,
          body: notification.body,
          category: getCategory(notification.notification_type),
          createdAtLabel: formatDateTime(notification.created_at),
          destinationLabel:
            notification.audience === "single_customer"
              ? customer?.name ?? "Cliente específico"
              : "Todos os clientes",
          dispatchStatus: dispatch?.status ?? null,
          failedCount: dispatch?.failed_count ?? null,
          id: notification.id,
          sentCount: dispatch?.sent_count ?? null,
          title: notification.title,
        };
      }),
      nextPageHref:
        safePage < totalPages
          ? buildNotificationsHref(searchParams, { page: safePage + 1 })
          : null,
      pageLinks: pageNumbers.map((pageNumber) => ({
        href: buildNotificationsHref(searchParams, { page: pageNumber }),
        isActive: pageNumber === safePage,
        label: `${pageNumber}`,
      })),
      previousPageHref:
        safePage > 1
          ? buildNotificationsHref(searchParams, { page: safePage - 1 })
          : null,
      previousPagePath:
        safePage > 1
          ? buildNotificationsHref(searchParams, { page: safePage - 1 })
          : "",
      summary: `Página ${safePage} de ${totalPages}`,
    },
  };
}
