import { requireOwnerSalon } from "@/lib/auth";
import {
  formatAppointmentPaymentPreferenceLabel,
  type AppointmentPaymentPreference,
} from "@/lib/appointmentPaymentPreference";
import { listResolvedAppointmentPlanReservations } from "@/lib/appointmentPlanReservations";
import {
  calculateProjectedCommissionAmount,
  resolveBookedAppointmentAmount,
} from "@/lib/financialMetrics";
import { isNativeFinanceSource } from "@/lib/financeSources";
import {
  getLocalDateKey,
  getUtcRangeForLocalDate,
  getUtcRangeForLocalMonth,
} from "@/lib/management";
import { listIgnoredPendingSettlementAppointmentIds } from "@/lib/pendingSettlementReconciliation";
import { createClient } from "@/lib/supabase/server";

import type { FinancePageData } from "./_lib";

type FinanceCustomerRelation = {
  name: string;
  profile_image_path?: string | null;
};

type FinanceServiceRelation = {
  name?: string | null;
  price?: number | string | null;
};

type FinanceManualEntryRow = {
  amount: number | string;
  category: string;
  entry_type: "income" | "expense";
  id: string;
  notes: string | null;
  occurred_on: string;
  payment_method: string | null;
  source:
    | "manual"
    | "appointment"
    | "store_order"
    | "customer_tab"
    | "team_payout"
    | "recurring_expense"
    | "payable";
  staff_member_id?: string | null;
  title: string;
};

type FinanceAppointmentPaymentRow = {
  amount: number | string;
  appointments:
    | {
        customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
        services: FinanceServiceRelation | FinanceServiceRelation[] | null;
      }
    | {
        customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
        services: FinanceServiceRelation | FinanceServiceRelation[] | null;
      }[]
    | null;
  id: string;
  paid_at: string;
  payment_method: string;
};

type FinanceAppointmentPaymentAggregateRow = {
  amount: number | string;
  appointment_id: string;
  paid_at: string;
  payment_method: string;
};

type FinanceAppointmentForecastRow = {
  date: string;
  id: string;
  payment_preference?: AppointmentPaymentPreference | null;
  service_price_snapshot: number | string | null;
  services: FinanceServiceRelation | FinanceServiceRelation[] | null;
  status: "pending" | "confirmed" | "completed";
};

type FinanceStoreOrderRow = {
  completed_at: string | null;
  created_at: string;
  customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
  id: string;
  order_number: number;
  subtotal_amount: number | string;
};

type FinanceOpenStoreOrderRow = {
  confirmed_at: string | null;
  created_at: string;
  customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
  id: string;
  order_number: number;
  ready_at: string | null;
  status: "pending" | "confirmed" | "ready";
  subtotal_amount: number | string;
  total_items: number;
};

type FinanceAppointmentAggregateRow = {
  completed_at: string | null;
  date: string;
  id: string;
  service_price_snapshot: number | string | null;
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
  services: FinanceServiceRelation | FinanceServiceRelation[] | null;
};

type FinanceStoreOrderAggregateRow = {
  completed_at: string | null;
  created_at: string;
  subtotal_amount: number | string;
};

type FinanceTabRelation = {
  customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
};

type FinanceTabPaymentRow = {
  amount: number | string;
  created_at: string;
  customer_tabs: FinanceTabRelation | FinanceTabRelation[] | null;
  id: string;
  method: string;
  note: string | null;
};

type FinanceTabPaymentAggregateRow = {
  amount: number | string;
  created_at: string;
  method: string | null;
};

type FinanceManualEntryAggregateRow = {
  amount: number | string;
  entry_type: "income" | "expense";
  occurred_on: string;
  payment_method: string | null;
  source:
    | "manual"
    | "appointment"
    | "store_order"
    | "customer_tab"
    | "team_payout"
    | "recurring_expense"
    | "payable";
};

type FinanceRecurringExpenseRow = {
  amount: number | string;
  cadence: "weekly" | "monthly" | "yearly";
  category: string;
  id: string;
  is_active: boolean;
  last_posted_on: string | null;
  next_due_on: string;
  notes: string | null;
  payment_method: string | null;
  title: string;
};

type FinanceUpcomingAppointmentRow = {
  customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
  date: string;
  id: string;
  payment_preference?: AppointmentPaymentPreference | null;
  service_price_snapshot: number | string | null;
  services: FinanceServiceRelation | FinanceServiceRelation[] | null;
  status: "pending" | "confirmed" | "completed";
};

type FinancePendingSettlementRow = {
  completed_at: string | null;
  customers: FinanceCustomerRelation | FinanceCustomerRelation[] | null;
  id: string;
  payment_preference?: AppointmentPaymentPreference | null;
  service_price_snapshot: number | string | null;
  services: FinanceServiceRelation | FinanceServiceRelation[] | null;
  staff_members:
    | {
        name?: string | null;
      }
    | {
        name?: string | null;
      }[]
    | null;
};

type FinanceStaffRow = {
  id: string;
  is_active?: boolean | null;
  name: string;
};

type FinancePayableRow = {
  amount: number | string;
  category: string;
  due_on: string;
  id: string;
  notes: string | null;
  paid_on: string | null;
  payment_method: string | null;
  status: "pending" | "paid" | "cancelled";
  title: string;
};

type FinanceCashSessionRow = {
  closing_difference_amount: number | string | null;
  closing_expected_amount: number | string | null;
  closing_reported_amount: number | string | null;
  id: string;
  opened_at: string;
  opening_amount: number | string;
  session_date: string;
  status: "open" | "closed";
};

type FinanceTeamPayoutTransactionRow = {
  amount: number | string;
  id: string;
  notes: string | null;
  occurred_on: string;
  payment_method: string | null;
  staff_member_id?: string | null;
  title: string;
};

const TIMELINE_LIMIT = 12;
const APPOINTMENT_METHOD_COMPARISON_ORDER = [
  "pix",
  "cash",
  "debit_card",
  "credit_card",
  "to_be_defined",
  "__unspecified",
] as const;

function firstRelation<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function monthKeyFromDate(value: string | Date, timeZone: string) {
  return getLocalDateKey(value, timeZone).slice(0, 7);
}

function buildMonthRange(args: {
  endMonthKey: string;
  months: number;
  timeZone: string;
}) {
  const values: FinancePageData["monthBuckets"] = [];
  const [endYear, endMonth] = args.endMonthKey.split("-").map(Number);

  for (let offset = args.months - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(endYear, endMonth - 1 - offset, 1, 12),
    );
    values.push({
      key: monthKeyFromDate(date, args.timeZone),
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        timeZone: args.timeZone,
      })
        .format(date)
        .replace(".", ""),
      expense: 0,
      operationalIncome: 0,
      realizedIncome: 0,
    });
  }

  return values;
}

function dateKeyInTimeZone(value: string | Date, timeZone: string) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysToDateKey(value: string, days: number) {
  const [year, month, day] = value.split("-").map((part) => Number(part));
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatLongDateLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone,
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatShortDayLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatUpcomingDayLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone,
  })
    .format(new Date(`${value}T12:00:00Z`))
    .replace(".", "")
    .toUpperCase();
}

function formatOccurrenceLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone,
  }).format(new Date(value));
}

function calculateDeltaPercent(current: number, previous: number) {
  if (previous === 0) {
    if (current === 0) {
      return null;
    }

    return 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function normalizeFinanceMethodKey(
  value: string | null | undefined,
): "pix" | "cards" | "cash" | "other" {
  if (value === "pix") {
    return "pix";
  }

  if (
    value === "credit_card" ||
    value === "debit_card" ||
    value === "card" ||
    value === "voucher"
  ) {
    return "cards";
  }

  if (value === "cash") {
    return "cash";
  }

  return "other";
}

function financeMethodLabel(key: "pix" | "cards" | "cash" | "other") {
  switch (key) {
    case "pix":
      return "Pix";
    case "cards":
      return "Cartões";
    case "cash":
      return "Dinheiro";
    default:
      return "Outros";
  }
}

function isAbsoluteImageUrl(value: string) {
  return /^https?:\/\//i.test(value);
}

function createFinanceAssetImageUrlResolver(supabase: any) {
  const cache = new Map<string, Promise<string | null>>();

  return (path?: string | null) => {
    const normalizedPath = path?.trim();

    if (!normalizedPath) {
      return Promise.resolve(null);
    }

    if (isAbsoluteImageUrl(normalizedPath)) {
      return Promise.resolve(normalizedPath);
    }

    const cached = cache.get(normalizedPath);

    if (cached) {
      return cached;
    }

    const pending = supabase.storage
      .from("customer-profiles")
      .createSignedUrl(normalizedPath, 60 * 60 * 12)
      .then(
        (signedUrlResult: {
          data?: { signedUrl?: string | null } | null;
        }) => signedUrlResult.data?.signedUrl ?? null,
      )
      .catch(() => null);

    cache.set(normalizedPath, pending);
    return pending;
  };
}

type FinanceMethodMetrics = Record<
  "pix" | "cards" | "cash" | "other",
  { amount: number; count: number }
>;

function createFinanceMethodMetrics(): FinanceMethodMetrics {
  return {
    pix: { amount: 0, count: 0 },
    cards: { amount: 0, count: 0 },
    cash: { amount: 0, count: 0 },
    other: { amount: 0, count: 0 },
  };
}

function registerFinanceMethodMetric(
  metrics: FinanceMethodMetrics,
  method: string | null | undefined,
  amount: number,
  count = 1,
) {
  const key = normalizeFinanceMethodKey(method);
  metrics[key].amount += amount;
  metrics[key].count += count;
}

function formatFinancePaymentMethodLabel(method: string | null | undefined) {
  switch (method) {
    case "cash":
      return "Dinheiro";
    case "card":
      return "Cartão";
    case "credit_card":
      return "Cartão de crédito";
    case "debit_card":
      return "Cartão de débito";
    case "voucher":
      return "Voucher";
    case "transfer":
      return "Transferência";
    case "other":
      return "Outro";
    case "pix":
      return "Pix";
    default:
      return method ?? "Sem método";
  }
}

function formatFinanceSourceLabel(entry: Pick<FinanceManualEntryRow, "entry_type" | "source">) {
  switch (entry.source) {
    case "appointment":
      return "Atendimento";
    case "store_order":
      return "Loja";
    case "customer_tab":
      return "Comanda";
    case "team_payout":
      return "Equipe";
    case "recurring_expense":
      return "Conta fixa";
    case "payable":
      return "Conta a pagar";
    default:
      return entry.entry_type === "expense" ? "Despesa" : "Receita";
  }
}

function formatOpenStoreOrderStatus(status: FinanceOpenStoreOrderRow["status"]) {
  switch (status) {
    case "ready":
      return {
        statusLabel: "Pronto",
        statusTone: "success" as const,
      };
    case "confirmed":
      return {
        statusLabel: "Separando",
        statusTone: "accent" as const,
      };
    default:
      return {
        statusLabel: "Novo",
        statusTone: "soft" as const,
      };
  }
}

function isMissingPaymentPreferenceColumnError(error: {
  code?: string | null;
  details?: string | null;
  hint?: string | null;
  message?: string | null;
} | null | undefined) {
  const normalizedText = [error?.message, error?.details, error?.hint]
    .filter((value): value is string => typeof value === "string")
    .join(" ")
    .trim()
    .toLowerCase();

  return (
    error?.code === "42703" &&
    normalizedText.includes("payment_preference") &&
    normalizedText.includes("appointments")
  );
}

function normalizeAppointmentComparisonKey(
  value: string | null | undefined,
) {
  if (!value) {
    return "__unspecified";
  }

  return value;
}

function formatAppointmentComparisonLabel(value: string) {
  if (value === "__unspecified") {
    return "Não informada";
  }

  if (value === "to_be_defined") {
    return "Decidir no salão";
  }

  return formatAppointmentPaymentPreferenceLabel(
    value as AppointmentPaymentPreference,
  );
}

function appointmentComparisonOrderIndex(value: string) {
  const index = APPOINTMENT_METHOD_COMPARISON_ORDER.indexOf(
    value as (typeof APPOINTMENT_METHOD_COMPARISON_ORDER)[number],
  );

  return index === -1 ? APPOINTMENT_METHOD_COMPARISON_ORDER.length : index;
}

function formatRecurringCadenceLabel(value: FinanceRecurringExpenseRow["cadence"]) {
  switch (value) {
    case "weekly":
      return "Semanal";
    case "yearly":
      return "Anual";
    default:
      return "Mensal";
  }
}

function resolveRecurringExpenseStatus(args: {
  isActive: boolean;
  nextDueOn: string;
  todayKey: string;
}) {
  if (!args.isActive) {
    return {
      statusLabel: "Pausada",
      statusTone: "soft" as const,
    };
  }

  if (args.nextDueOn < args.todayKey) {
    return {
      statusLabel: "Atrasada",
      statusTone: "warm" as const,
    };
  }

  if (args.nextDueOn === args.todayKey) {
    return {
      statusLabel: "Vence hoje",
      statusTone: "accent" as const,
    };
  }

  if (args.nextDueOn <= addDaysToDateKey(args.todayKey, 7)) {
    return {
      statusLabel: "Chegando",
      statusTone: "success" as const,
    };
  }

  return {
    statusLabel: "Em dia",
    statusTone: "soft" as const,
  };
}

function resolvePayableStatus(args: {
  dueOn: string;
  status: FinancePayableRow["status"];
  todayKey: string;
}) {
  if (args.status === "paid") {
    return {
      statusLabel: "Pago",
      statusTone: "success" as const,
    };
  }

  if (args.status === "cancelled") {
    return {
      statusLabel: "Cancelado",
      statusTone: "soft" as const,
    };
  }

  if (args.dueOn < args.todayKey) {
    return {
      statusLabel: "Vencido",
      statusTone: "warm" as const,
    };
  }

  if (args.dueOn === args.todayKey) {
    return {
      statusLabel: "Vence hoje",
      statusTone: "accent" as const,
    };
  }

  if (args.dueOn <= addDaysToDateKey(args.todayKey, 7)) {
    return {
      statusLabel: "Chegando",
      statusTone: "accent" as const,
    };
  }

  return {
    statusLabel: "Em aberto",
    statusTone: "soft" as const,
  };
}

async function loadCurrentMonthAppointmentForecast(args: {
  endIso: string;
  salonId: string;
  startIso: string;
  supabase: ReturnType<typeof createClient>;
}): Promise<FinanceAppointmentForecastRow[]> {
  const withPreferenceResult = await args.supabase
    .from("appointments")
    .select(
      "id, date, status, payment_preference, service_price_snapshot, services(price)",
    )
    .eq("salon_id", args.salonId)
    .gte("date", args.startIso)
    .lt("date", args.endIso)
    .in("status", ["pending", "confirmed", "completed"]);

  if (!withPreferenceResult.error) {
    return (withPreferenceResult.data ?? []) as FinanceAppointmentForecastRow[];
  }

  if (!isMissingPaymentPreferenceColumnError(withPreferenceResult.error)) {
    throw withPreferenceResult.error;
  }

  const legacyResult = await args.supabase
    .from("appointments")
    .select("id, date, status, service_price_snapshot, services(price)")
    .eq("salon_id", args.salonId)
    .gte("date", args.startIso)
    .lt("date", args.endIso)
    .in("status", ["pending", "confirmed", "completed"]);

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return ((legacyResult.data ?? []) as Array<
    Omit<FinanceAppointmentForecastRow, "payment_preference"> & {
      payment_preference?: never;
    }
  >).map((row) => ({
    ...row,
    payment_preference: null,
  }));
}

async function loadUpcomingReceivables(args: {
  endIso: string;
  salonId: string;
  startIso: string;
  supabase: ReturnType<typeof createClient>;
}): Promise<FinanceUpcomingAppointmentRow[]> {
  const withPreferenceResult = await args.supabase
    .from("appointments")
    .select(
      "id, date, status, payment_preference, service_price_snapshot, services(name, price), customers(name, profile_image_path)",
    )
    .eq("salon_id", args.salonId)
    .gte("date", args.startIso)
    .lt("date", args.endIso)
    .in("status", ["pending", "confirmed"])
    .order("date", { ascending: true });

  if (!withPreferenceResult.error) {
    return (withPreferenceResult.data ?? []) as FinanceUpcomingAppointmentRow[];
  }

  if (!isMissingPaymentPreferenceColumnError(withPreferenceResult.error)) {
    throw withPreferenceResult.error;
  }

  const legacyResult = await args.supabase
    .from("appointments")
    .select(
      "id, date, status, service_price_snapshot, services(name, price), customers(name, profile_image_path)",
    )
    .eq("salon_id", args.salonId)
    .gte("date", args.startIso)
    .lt("date", args.endIso)
    .in("status", ["pending", "confirmed"])
    .order("date", { ascending: true });

  if (legacyResult.error) {
    throw legacyResult.error;
  }

  return ((legacyResult.data ?? []) as Array<
    Omit<FinanceUpcomingAppointmentRow, "payment_preference"> & {
      payment_preference?: never;
    }
  >).map((row) => ({
    ...row,
    payment_preference: null,
  }));
}

async function loadMembershipPlanAppointmentIdSet(args: {
  appointmentIds: string[];
  salonId: string;
}) {
  if (!args.appointmentIds.length) {
    return new Set<string>();
  }

  const reservations = await listResolvedAppointmentPlanReservations({
    appointmentIds: args.appointmentIds,
    salonId: args.salonId,
  });

  return new Set(reservations.map((reservation) => reservation.appointmentId));
}

export async function loadFinancePageData(args?: {
  focusDateKey?: string;
  rangeDays?: number;
}): Promise<FinancePageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const resolveFinanceAssetImageUrl = createFinanceAssetImageUrlResolver(
    supabase,
  );
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const focusDateKey =
    typeof args?.focusDateKey === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(args.focusDateKey)
      ? args.focusDateKey
      : todayKey;
  const rangeDays =
    args?.rangeDays === 7 || args?.rangeDays === 30 ? args.rangeDays : 14;
  const previousDayKey = addDaysToDateKey(focusDateKey, -1);
  const chartStartKey = addDaysToDateKey(focusDateKey, -(rangeDays - 1));
  const currentMonthKey = focusDateKey.slice(0, 7);
  const currentMonthRange = getUtcRangeForLocalMonth(currentMonthKey, timeZone);
  const monthBuckets = buildMonthRange({
    endMonthKey: currentMonthKey,
    months: 6,
    timeZone,
  });
  const sixMonthsAgoDate = `${monthBuckets[0]?.key ?? currentMonthKey}-01`;
  const sixMonthsAgoRange = getUtcRangeForLocalMonth(
    monthBuckets[0]?.key ?? currentMonthKey,
    timeZone,
  );
  const sixMonthsAgoIso = sixMonthsAgoRange.start.toISOString();
  const selectedDayRange = getUtcRangeForLocalDate(focusDateKey, timeZone);
  const nextUpcomingEndKey = addDaysToDateKey(focusDateKey, 8);
  const upcomingRangeEnd = getUtcRangeForLocalDate(
    nextUpcomingEndKey,
    timeZone,
  ).start.toISOString();
  const financeTable = (supabase as any).from("salon_financial_transactions");

  const [
    appointmentForecastRows,
    upcomingReceivablesRows,
    appointmentTotalsResult,
    appointmentPaymentsTotalsResult,
    recentAppointmentPaymentsResult,
    storeOrderTotalsResult,
    recentStoreOrdersResult,
    openStoreOrdersResult,
    tabPaymentTotalsResult,
    recentTabPaymentsResult,
    manualEntryTotalsResult,
    recentManualEntriesResult,
    staffResult,
    recurringExpensesResult,
    recentTeamPayoutsResult,
    payablesResult,
    cashSessionsResult,
  ] =
    await Promise.all([
      loadCurrentMonthAppointmentForecast({
        endIso: currentMonthRange.end.toISOString(),
        salonId: salon.id,
        startIso: currentMonthRange.start.toISOString(),
        supabase,
      }),
      loadUpcomingReceivables({
        endIso: upcomingRangeEnd,
        salonId: salon.id,
        startIso: selectedDayRange.end.toISOString(),
        supabase,
      }),
      supabase
        .from("appointments")
        .select(
          "id, date, completed_at, service_price_snapshot, services(price), staff_members(commission_rate_percent, commission_flat_fee)",
        )
        .eq("salon_id", salon.id)
        .not("completed_at", "is", null)
        .gte("completed_at", sixMonthsAgoIso),
      supabase
        .from("appointment_payments")
        .select("appointment_id, amount, paid_at, payment_method")
        .eq("salon_id", salon.id)
        .gte("paid_at", sixMonthsAgoIso),
      supabase
        .from("appointment_payments")
        .select(
          "id, amount, payment_method, paid_at, appointments(customers(name, profile_image_path), services(name))",
        )
        .eq("salon_id", salon.id)
        .gte("paid_at", sixMonthsAgoIso)
        .order("paid_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      supabase
        .from("customer_product_orders")
        .select("subtotal_amount, completed_at, created_at")
        .eq("salon_id", salon.id)
        .eq("status", "completed")
        .gte("completed_at", sixMonthsAgoIso),
      supabase
        .from("customer_product_orders")
        .select(
          "id, order_number, subtotal_amount, completed_at, created_at, customers(name, profile_image_path)",
        )
        .eq("salon_id", salon.id)
        .eq("status", "completed")
        .gte("completed_at", sixMonthsAgoIso)
        .order("completed_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      supabase
        .from("customer_product_orders")
        .select(
          "id, order_number, status, total_items, subtotal_amount, created_at, confirmed_at, ready_at, customers(name)",
        )
        .eq("salon_id", salon.id)
        .in("status", ["pending", "confirmed", "ready"])
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("customer_tab_payments")
        .select("amount, created_at, method")
        .eq("salon_id", salon.id)
        .gte("created_at", sixMonthsAgoIso),
      supabase
        .from("customer_tab_payments")
        .select(
          "id, amount, method, note, created_at, customer_tabs(customers(name, profile_image_path))",
        )
        .eq("salon_id", salon.id)
        .gte("created_at", sixMonthsAgoIso)
        .order("created_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      financeTable
        .select("entry_type, amount, occurred_on, source, payment_method")
        .eq("salon_id", salon.id)
        .gte("occurred_on", sixMonthsAgoDate),
      financeTable
        .select(
          "id, title, category, entry_type, amount, occurred_on, payment_method, source, notes, staff_member_id",
        )
        .eq("salon_id", salon.id)
        .gte("occurred_on", sixMonthsAgoDate)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(TIMELINE_LIMIT),
      supabase
        .from("staff_members")
        .select("id, name, is_active")
        .eq("salon_id", salon.id)
        .order("name", { ascending: true }),
      supabase
        .from("salon_recurring_expenses")
        .select(
          "id, title, category, amount, cadence, next_due_on, last_posted_on, payment_method, notes, is_active",
        )
        .eq("salon_id", salon.id)
        .order("next_due_on", { ascending: true })
        .order("created_at", { ascending: false }),
      financeTable
        .select(
          "id, title, amount, occurred_on, payment_method, notes, staff_member_id",
        )
        .eq("salon_id", salon.id)
        .eq("source", "team_payout")
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(6),
      supabase
        .from("salon_payables")
        .select(
          "id, title, category, amount, due_on, status, paid_on, payment_method, notes",
        )
        .eq("salon_id", salon.id)
        .order("due_on", { ascending: true })
        .order("created_at", { ascending: false }),
      (supabase as any)
        .from("salon_cash_sessions")
        .select(
          "id, session_date, status, opened_at, opening_amount, closing_reported_amount, closing_expected_amount, closing_difference_amount",
        )
        .eq("salon_id", salon.id)
        .order("session_date", { ascending: false })
        .limit(6),
    ]);

  const appointmentForecast = appointmentForecastRows;
  const appointmentTotals = (appointmentTotalsResult.data ?? []) as
    FinanceAppointmentAggregateRow[];
  const appointmentPaymentsTotals = (appointmentPaymentsTotalsResult.data ?? []) as
    FinanceAppointmentPaymentAggregateRow[];
  const recentAppointmentPayments = (recentAppointmentPaymentsResult.data ?? []) as
    FinanceAppointmentPaymentRow[];
  const storeOrderTotals = (storeOrderTotalsResult.data ?? []) as
    FinanceStoreOrderAggregateRow[];
  const recentStoreOrders = (recentStoreOrdersResult.data ?? []) as
    FinanceStoreOrderRow[];
  const openStoreOrders = (openStoreOrdersResult.data ?? []) as
    FinanceOpenStoreOrderRow[];
  const tabPaymentTotals = (tabPaymentTotalsResult.data ?? []) as
    FinanceTabPaymentAggregateRow[];
  const recentTabPayments = (recentTabPaymentsResult.data ?? []) as
    FinanceTabPaymentRow[];
  const manualEntryTotals = ((manualEntryTotalsResult.data ?? []) as
    FinanceManualEntryAggregateRow[]).filter(
    (entry) => !isNativeFinanceSource(entry.source),
  );
  const recentManualEntries = ((recentManualEntriesResult.data ?? []) as
    FinanceManualEntryRow[]).filter((entry) => !isNativeFinanceSource(entry.source));
  const staffRows = (staffResult.data ?? []) as FinanceStaffRow[];
  const recurringExpenseRows = (recurringExpensesResult.data ?? []) as
    FinanceRecurringExpenseRow[];
  const recentTeamPayoutRows = (recentTeamPayoutsResult.data ?? []) as
    FinanceTeamPayoutTransactionRow[];
  const payableRows = (payablesResult.data ?? []) as FinancePayableRow[];
  const cashSessionRows = (cashSessionsResult.data ?? []) as FinanceCashSessionRow[];
  const staffMap = new Map(staffRows.map((staff) => [staff.id, staff.name]));
  const bucketMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  const upcomingReceivables = upcomingReceivablesRows;

  let currentMonthOperationalIncome = 0;
  let currentMonthProjectedCommissions = 0;
  let currentMonthTeamPayoutsPaid = 0;
  let currentMonthRealizedIncome = 0;
  let currentMonthExpense = 0;
  let currentMonthPendingCompletedServicesAmount = 0;
  let currentMonthPendingCompletedServicesCount = 0;
  let currentMonthAppointmentForecastTotal = 0;
  let currentMonthAppointmentActualTotal = 0;
  let todayRealizedIncome = 0;
  let todayExpense = 0;
  let recurringDueCount = 0;
  let recurringDueAmount = 0;
  let payableDueCount = 0;
  let payableDueAmount = 0;
  let selectedDayReceiptAmount = 0;
  let selectedDayReceiptCount = 0;
  let previousDayReceiptAmount = 0;
  let previousDayReceiptCount = 0;

  const timelineEntries: FinancePageData["timelineEntries"] = [];
  const selectedDayMethodMetrics = createFinanceMethodMetrics();
  const previousDayMethodMetrics = createFinanceMethodMetrics();
  const currentMonthMethodMetrics = createFinanceMethodMetrics();
  const dailyActualReceivedMap = new Map<string, number>();
  const dailyProjectedReceivableMap = new Map<string, number>();
  const appointmentMethodComparisonMap = new Map<
    string,
    {
      actualAmount: number;
      actualCount: number;
      forecastAmount: number;
      forecastCount: number;
      key: string;
      label: string;
    }
  >();
  const paidAppointmentIds = new Set(
    appointmentPaymentsTotals.map((payment) => payment.appointment_id),
  );
  const financeAppointmentIds = Array.from(
    new Set([
      ...appointmentForecast.map((appointment) => appointment.id),
      ...upcomingReceivables.map((appointment) => appointment.id),
      ...appointmentTotals.map((appointment) => appointment.id),
    ]),
  );
  const membershipPlanAppointmentIds = await loadMembershipPlanAppointmentIdSet({
    appointmentIds: financeAppointmentIds,
    salonId: salon.id,
  });
  const ignoredPendingSettlementAppointmentIds =
    await listIgnoredPendingSettlementAppointmentIds({
      appointmentIds: financeAppointmentIds,
      salonId: salon.id,
    });
  const pendingCompletedAppointmentIds: string[] = [];

  for (const appointment of appointmentForecast) {
    if (membershipPlanAppointmentIds.has(appointment.id)) {
      continue;
    }

    const service = firstRelation(appointment.services);
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price ?? null,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const key = normalizeAppointmentComparisonKey(
      appointment.payment_preference ?? null,
    );
    const current = appointmentMethodComparisonMap.get(key) ?? {
      actualAmount: 0,
      actualCount: 0,
      forecastAmount: 0,
      forecastCount: 0,
      key,
      label: formatAppointmentComparisonLabel(key),
    };

    current.forecastAmount += amount;
    current.forecastCount += 1;
    currentMonthAppointmentForecastTotal += amount;
    appointmentMethodComparisonMap.set(key, current);
  }

  for (const appointment of appointmentTotals) {
    const service = firstRelation(appointment.services);
    const staffMember = firstRelation(appointment.staff_members);
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price ?? null,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const occurredAt = appointment.completed_at ?? appointment.date;
    const key = monthKeyFromDate(occurredAt, timeZone);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.operationalIncome += amount;
    }

    if (key === currentMonthKey) {
      currentMonthOperationalIncome += amount;
      currentMonthProjectedCommissions += calculateProjectedCommissionAmount({
        amount,
        commissionFlatFee: staffMember?.commission_flat_fee ?? 0,
        commissionRatePercent: staffMember?.commission_rate_percent ?? 0,
      });

      if (
        !paidAppointmentIds.has(appointment.id) &&
        !membershipPlanAppointmentIds.has(appointment.id) &&
        !ignoredPendingSettlementAppointmentIds.has(appointment.id)
      ) {
        currentMonthPendingCompletedServicesAmount += amount;
        currentMonthPendingCompletedServicesCount += 1;
        pendingCompletedAppointmentIds.push(appointment.id);
      }
    }
  }

  for (const payment of appointmentPaymentsTotals) {
    const amount = Number(payment.amount ?? 0);
    const key = monthKeyFromDate(payment.paid_at, timeZone);
    const dayKey = dateKeyInTimeZone(payment.paid_at, timeZone);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.realizedIncome += amount;
    }

    if (key === currentMonthKey) {
      currentMonthRealizedIncome += amount;
      currentMonthAppointmentActualTotal += amount;
      registerFinanceMethodMetric(
        currentMonthMethodMetrics,
        payment.payment_method,
        amount,
      );

      const comparisonKey = normalizeAppointmentComparisonKey(
        payment.payment_method,
      );
      const current = appointmentMethodComparisonMap.get(comparisonKey) ?? {
        actualAmount: 0,
        actualCount: 0,
        forecastAmount: 0,
        forecastCount: 0,
        key: comparisonKey,
        label: formatAppointmentComparisonLabel(comparisonKey),
      };

      current.actualAmount += amount;
      current.actualCount += 1;
      appointmentMethodComparisonMap.set(comparisonKey, current);
    }

    if (dayKey === todayKey) {
      todayRealizedIncome += amount;
    }

    dailyActualReceivedMap.set(
      dayKey,
      (dailyActualReceivedMap.get(dayKey) ?? 0) + amount,
    );

    if (dayKey === focusDateKey) {
      selectedDayReceiptAmount += amount;
      selectedDayReceiptCount += 1;
      registerFinanceMethodMetric(
        selectedDayMethodMetrics,
        payment.payment_method,
        amount,
      );
    }

    if (dayKey === previousDayKey) {
      previousDayReceiptAmount += amount;
      previousDayReceiptCount += 1;
      registerFinanceMethodMetric(
        previousDayMethodMetrics,
        payment.payment_method,
        amount,
      );
    }
  }

  timelineEntries.push(
    ...await Promise.all(
      recentAppointmentPayments.map(async (payment) => {
        const appointment = firstRelation(payment.appointments);
        const customer = firstRelation(appointment?.customers ?? null);
        const service = firstRelation(appointment?.services ?? null);

        return {
          id: `appointment-payment-${payment.id}`,
          amount: Number(payment.amount ?? 0),
          avatarUrl: await resolveFinanceAssetImageUrl(
            customer?.profile_image_path ?? null,
          ),
          kind: "income" as const,
          occurredAt: payment.paid_at,
          paymentMethodLabel: formatFinancePaymentMethodLabel(
            payment.payment_method,
          ),
          sourceLabel: "Atendimento",
          subtitle: `${customer?.name ?? "Cliente"} - ${formatFinancePaymentMethodLabel(payment.payment_method)}`,
          title: service?.name ?? "Recebimento de atendimento",
        };
      }),
    ),
  );

  for (const order of storeOrderTotals) {
    const amount = Number(order.subtotal_amount ?? 0);
    const occurredAt = order.completed_at ?? order.created_at;
    const key = monthKeyFromDate(occurredAt, timeZone);
    const dayKey = dateKeyInTimeZone(occurredAt, timeZone);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.realizedIncome += amount;
    }

    if (key === currentMonthKey) {
      currentMonthRealizedIncome += amount;
      registerFinanceMethodMetric(currentMonthMethodMetrics, "other", amount);
    }

    if (dayKey === todayKey) {
      todayRealizedIncome += amount;
    }

    dailyActualReceivedMap.set(
      dayKey,
      (dailyActualReceivedMap.get(dayKey) ?? 0) + amount,
    );

    if (dayKey === focusDateKey) {
      selectedDayReceiptAmount += amount;
      selectedDayReceiptCount += 1;
      registerFinanceMethodMetric(selectedDayMethodMetrics, "other", amount);
    }

    if (dayKey === previousDayKey) {
      previousDayReceiptAmount += amount;
      previousDayReceiptCount += 1;
      registerFinanceMethodMetric(previousDayMethodMetrics, "other", amount);
    }
  }

  timelineEntries.push(
    ...await Promise.all(
      recentStoreOrders.map(async (order) => {
        const customer = firstRelation(order.customers);
        const amount = Number(order.subtotal_amount ?? 0);
        const occurredAt = order.completed_at ?? order.created_at;

        return {
          id: `store-order-${order.id}`,
          amount,
          avatarUrl: await resolveFinanceAssetImageUrl(
            customer?.profile_image_path ?? null,
          ),
          kind: "income" as const,
          occurredAt,
          paymentMethodLabel: "Venda do app",
          sourceLabel: "Loja",
          subtitle: `${customer?.name ?? "Cliente"} - pedido #${order.order_number}`,
          title: "Venda da loja virtual",
        };
      }),
    ),
  );

  for (const payment of tabPaymentTotals) {
    const amount = Number(payment.amount ?? 0);
    const key = monthKeyFromDate(payment.created_at, timeZone);
    const dayKey = dateKeyInTimeZone(payment.created_at, timeZone);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.realizedIncome += amount;
    }

    if (key === currentMonthKey) {
      currentMonthRealizedIncome += amount;
      registerFinanceMethodMetric(currentMonthMethodMetrics, payment.method, amount);
    }

    if (dayKey === todayKey) {
      todayRealizedIncome += amount;
    }

    dailyActualReceivedMap.set(
      dayKey,
      (dailyActualReceivedMap.get(dayKey) ?? 0) + amount,
    );

    if (dayKey === focusDateKey) {
      selectedDayReceiptAmount += amount;
      selectedDayReceiptCount += 1;
      registerFinanceMethodMetric(selectedDayMethodMetrics, payment.method, amount);
    }

    if (dayKey === previousDayKey) {
      previousDayReceiptAmount += amount;
      previousDayReceiptCount += 1;
      registerFinanceMethodMetric(previousDayMethodMetrics, payment.method, amount);
    }
  }

  timelineEntries.push(
    ...await Promise.all(
      recentTabPayments.map(async (payment) => {
        const tab = firstRelation(payment.customer_tabs);
        const customer = firstRelation(tab?.customers ?? null);
        const amount = Number(payment.amount ?? 0);
        const subtitleParts = [
          customer?.name ?? "Cliente",
          formatFinancePaymentMethodLabel(payment.method),
          payment.note?.trim() || null,
        ].filter(Boolean);

        return {
          id: `tab-payment-${payment.id}`,
          amount,
          avatarUrl: await resolveFinanceAssetImageUrl(
            customer?.profile_image_path ?? null,
          ),
          kind: "income" as const,
          occurredAt: payment.created_at,
          paymentMethodLabel: formatFinancePaymentMethodLabel(payment.method),
          sourceLabel: "Comanda",
          subtitle: subtitleParts.join(" - "),
          title: "Pagamento de comanda",
        };
      }),
    ),
  );

  for (const entry of manualEntryTotals) {
    const amount = Number(entry.amount ?? 0);
    const key = monthKeyFromDate(`${entry.occurred_on}T12:00:00Z`, timeZone);
    const bucket = bucketMap.get(key);

    if (bucket) {
      if (entry.entry_type === "expense") {
        bucket.expense += amount;
      } else {
        bucket.realizedIncome += amount;
      }
    }

    if (key === currentMonthKey) {
      if (entry.entry_type === "expense") {
        currentMonthExpense += amount;
        if (entry.source === "team_payout") {
          currentMonthTeamPayoutsPaid += amount;
        }
      } else {
        currentMonthRealizedIncome += amount;
        registerFinanceMethodMetric(
          currentMonthMethodMetrics,
          entry.payment_method,
          amount,
        );
      }
    }

    if (entry.occurred_on === todayKey) {
      if (entry.entry_type === "expense") {
        todayExpense += amount;
      } else {
        todayRealizedIncome += amount;
      }
    }

    if (entry.entry_type !== "expense") {
      dailyActualReceivedMap.set(
        entry.occurred_on,
        (dailyActualReceivedMap.get(entry.occurred_on) ?? 0) + amount,
      );

      if (entry.occurred_on === focusDateKey) {
        selectedDayReceiptAmount += amount;
        selectedDayReceiptCount += 1;
        registerFinanceMethodMetric(
          selectedDayMethodMetrics,
          entry.payment_method,
          amount,
        );
      }

      if (entry.occurred_on === previousDayKey) {
        previousDayReceiptAmount += amount;
        previousDayReceiptCount += 1;
        registerFinanceMethodMetric(
          previousDayMethodMetrics,
          entry.payment_method,
          amount,
        );
      }
    }
  }

  for (const entry of recentManualEntries) {
    const amount = Number(entry.amount ?? 0);
    const staffName =
      entry.staff_member_id != null
        ? staffMap.get(entry.staff_member_id) ?? null
        : null;
    const subtitleParts = [
      entry.category,
      staffName,
      entry.payment_method ? formatFinancePaymentMethodLabel(entry.payment_method) : null,
    ].filter(Boolean);

    timelineEntries.push({
      id: `manual-${entry.id}`,
      amount,
      avatarUrl: null,
      kind: entry.entry_type,
      occurredAt: `${entry.occurred_on}T12:00:00Z`,
      paymentMethodLabel: entry.payment_method
        ? formatFinancePaymentMethodLabel(entry.payment_method)
        : null,
      sourceLabel: formatFinanceSourceLabel(entry),
      subtitle: subtitleParts.join(" - "),
      title: entry.title,
    });
  }

  timelineEntries.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  const appointmentMethodComparisonItems = Array.from(
    appointmentMethodComparisonMap.values(),
  )
    .filter((item) => item.forecastAmount > 0 || item.actualAmount > 0)
    .sort((left, right) => {
      const orderDiff =
        appointmentComparisonOrderIndex(left.key) -
        appointmentComparisonOrderIndex(right.key);

      if (orderDiff !== 0) {
        return orderDiff;
      }

      return (
        right.forecastAmount +
        right.actualAmount -
        (left.forecastAmount + left.actualAmount)
      );
    });

  const recurringExpenseItems = recurringExpenseRows.map((item) => {
    const status = resolveRecurringExpenseStatus({
      isActive: item.is_active,
      nextDueOn: item.next_due_on,
      todayKey,
    });

    if (item.is_active && item.next_due_on <= todayKey) {
      recurringDueCount += 1;
      recurringDueAmount += Number(item.amount ?? 0);
    }

    return {
      amount: Number(item.amount ?? 0),
      cadence: item.cadence,
      category: item.category,
      id: item.id,
      isActive: item.is_active,
      lastPostedOn: item.last_posted_on,
      nextDueOn: item.next_due_on,
      notes: item.notes,
      paymentMethod: item.payment_method,
      statusLabel: `${status.statusLabel} - ${formatRecurringCadenceLabel(item.cadence)}`,
      statusTone: status.statusTone,
      title: item.title,
    };
  });

  const payableItems = payableRows.map((item) => {
    const status = resolvePayableStatus({
      dueOn: item.due_on,
      status: item.status,
      todayKey,
    });

    if (item.status === "pending" && item.due_on <= todayKey) {
      payableDueCount += 1;
      payableDueAmount += Number(item.amount ?? 0);
    }

    return {
      amount: Number(item.amount ?? 0),
      category: item.category,
      dueOn: item.due_on,
      id: item.id,
      notes: item.notes,
      paidOn: item.paid_on,
      paymentMethod: item.payment_method,
      status: item.status,
      statusLabel: status.statusLabel,
      statusTone: status.statusTone,
      title: item.title,
    };
  });

  const teamPayoutItems = recentTeamPayoutRows.map((item) => ({
    amount: Number(item.amount ?? 0),
    id: item.id,
    notes: item.notes ?? null,
    occurredOn: item.occurred_on,
    paymentMethod: item.payment_method ?? null,
    professionalName:
      (item.staff_member_id != null
        ? staffMap.get(item.staff_member_id) ?? null
        : null) ?? "Profissional",
    title: item.title,
  }));
  const upcomingReceivableItems = await Promise.all(
    upcomingReceivables
      .filter((item) => !membershipPlanAppointmentIds.has(item.id))
      .map(async (item) => {
    const customer = firstRelation(item.customers);
    const service = firstRelation(item.services);
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price ?? null,
      servicePriceSnapshot: item.service_price_snapshot,
    });
    const dateKey = dateKeyInTimeZone(item.date, timeZone);

    dailyProjectedReceivableMap.set(
      dateKey,
      (dailyProjectedReceivableMap.get(dateKey) ?? 0) + amount,
    );

    return {
      amount,
      customerAvatarUrl: await resolveFinanceAssetImageUrl(
        customer?.profile_image_path ?? null,
      ),
      customerName: customer?.name ?? "Cliente",
      dateKey,
      dayLabel: formatUpcomingDayLabel(dateKey, timeZone),
      id: item.id,
      paymentPreferenceLabel: item.payment_preference
        ? formatAppointmentPaymentPreferenceLabel(item.payment_preference)
        : "Forma a confirmar",
      serviceName: service?.name ?? "Serviço do salão",
      status: item.status,
    };
  }));
  const upcomingReceivablesTotal = upcomingReceivableItems.reduce(
    (total, item) => total + item.amount,
    0,
  );
  let pendingSettlementsResult = pendingCompletedAppointmentIds.length
    ? await supabase
        .from("appointments")
        .select(
          "id, completed_at, payment_preference, service_price_snapshot, customers(name, profile_image_path), services(name, price), staff_members(name)",
        )
        .in("id", pendingCompletedAppointmentIds)
        .order("completed_at", { ascending: false })
    : { data: [] as FinancePendingSettlementRow[], error: null };

  if (
    isMissingPaymentPreferenceColumnError(pendingSettlementsResult.error)
  ) {
    pendingSettlementsResult = pendingCompletedAppointmentIds.length
      ? await supabase
          .from("appointments")
          .select(
            "id, completed_at, service_price_snapshot, customers(name, profile_image_path), services(name, price), staff_members(name)",
          )
          .in("id", pendingCompletedAppointmentIds)
          .order("completed_at", { ascending: false })
      : { data: [] as FinancePendingSettlementRow[], error: null };
  }

  if (pendingSettlementsResult.error) {
    throw pendingSettlementsResult.error;
  }

  const pendingSettlementItems = await Promise.all(
    ((pendingSettlementsResult.data ?? []) as FinancePendingSettlementRow[]).map(
      async (item) => {
        const customer = firstRelation(item.customers);
        const service = firstRelation(item.services);
        const professional = firstRelation(item.staff_members);
        const amount = resolveBookedAppointmentAmount({
          servicePrice: service?.price ?? null,
          servicePriceSnapshot: item.service_price_snapshot,
        });

        return {
          amount,
          completedAt: item.completed_at ?? "",
          customerName: customer?.name ?? "Cliente",
          id: item.id,
          paymentPreferenceLabel: item.payment_preference
            ? formatAppointmentPaymentPreferenceLabel(item.payment_preference)
            : "Forma a confirmar",
          professionalName: professional?.name ?? "Profissional",
          serviceName: service?.name ?? "Serviço do salão",
        };
      },
    ),
  );
  const actualPoints: FinancePageData["receivablesDashboard"]["trend"]["actualPoints"] =
    [];
  const projectedPoints: FinancePageData["receivablesDashboard"]["trend"]["projectedPoints"] =
    [];
  let cumulativeActual = 0;

  for (let offset = 0; offset < rangeDays; offset += 1) {
    const dayKey = addDaysToDateKey(chartStartKey, offset);
    const daily = dailyActualReceivedMap.get(dayKey) ?? 0;
    cumulativeActual += daily;
    actualPoints.push({
      cumulative: cumulativeActual,
      daily,
      key: dayKey,
      label: formatShortDayLabel(dayKey, timeZone),
    });
  }

  let cumulativeProjected = cumulativeActual;

  for (let offset = 1; offset <= 7; offset += 1) {
    const dayKey = addDaysToDateKey(focusDateKey, offset);
    const daily = dailyProjectedReceivableMap.get(dayKey) ?? 0;
    cumulativeProjected += daily;
    projectedPoints.push({
      cumulative: cumulativeProjected,
      daily,
      key: dayKey,
      label: formatShortDayLabel(dayKey, timeZone),
    });
  }

  const selectedDayAverageTicket =
    selectedDayReceiptCount > 0
      ? selectedDayReceiptAmount / selectedDayReceiptCount
      : 0;
  const previousDayAverageTicket =
    previousDayReceiptCount > 0
      ? previousDayReceiptAmount / previousDayReceiptCount
      : 0;
  const receivablesAlerts: FinancePageData["receivablesDashboard"]["alerts"] = [];

  if (payableDueCount > 0) {
    receivablesAlerts.push({
      description: `Total de R$ ${Number(payableDueAmount).toFixed(2).replace(".", ",")}`,
      id: "payables-due",
      title: `${payableDueCount} conta(s) vencendo ou atrasada(s)`,
      tone: "warm",
    });
  }

  if (recurringDueCount > 0) {
    receivablesAlerts.push({
      description: `R$ ${Number(recurringDueAmount).toFixed(2).replace(".", ",")} aguardando baixa recorrente`,
      id: "recurring-due",
      title: `${recurringDueCount} conta(s) fixa(s) pedem conferência`,
      tone: "accent",
    });
  }

  if (currentMonthPendingCompletedServicesCount > 0) {
    receivablesAlerts.push({
      description: `${currentMonthPendingCompletedServicesCount} serviço(s) concluído(s) ainda sem baixa`,
      id: "completed-without-payment",
      title: `R$ ${Number(currentMonthPendingCompletedServicesAmount).toFixed(2).replace(".", ",")} ainda não entrou no caixa`,
      tone: "warm",
    });
  }

  if (openStoreOrders.length > 0) {
    const openStoreOrdersAlertAmount = openStoreOrders.reduce(
      (total, order) => total + Number(order.subtotal_amount ?? 0),
      0,
    );

    receivablesAlerts.push({
      description: `${openStoreOrders.length} pedido(s) do app aguardando conclusÃ£o`,
      id: "store-orders-open",
      title: `R$ ${Number(openStoreOrdersAlertAmount).toFixed(2).replace(".", ",")} da loja ainda fora do caixa`,
      tone: "accent",
    });
  }

  if (!receivablesAlerts.length) {
    receivablesAlerts.push({
      description: "Caixa, agenda e recorrência estão sem alerta crítico no momento.",
      id: "healthy",
      title: "Leitura financeira está estável",
      tone: "success",
    });
  }

  const todayCashSession =
    cashSessionRows.find((item) => item.session_date === todayKey) ?? null;
  const todayOpeningAmount = Number(todayCashSession?.opening_amount ?? 0);
  const todayExpectedBalance = Number(
    (todayOpeningAmount + todayRealizedIncome - todayExpense).toFixed(2),
  );
  const recentCashSessions = cashSessionRows.map((item) => ({
    differenceAmount:
      item.closing_difference_amount == null
        ? null
        : Number(item.closing_difference_amount ?? 0),
    expectedAmount:
      item.closing_expected_amount == null
        ? null
        : Number(item.closing_expected_amount ?? 0),
    id: item.id,
    openedAt: item.opened_at,
    openingAmount: Number(item.opening_amount ?? 0),
    reportedAmount:
      item.closing_reported_amount == null
        ? null
        : Number(item.closing_reported_amount ?? 0),
    sessionDate: item.session_date,
    status: item.status,
  }));
  const currentMonthCashProfit = currentMonthRealizedIncome - currentMonthExpense;
  const methodBreakdownItems = ([
    "pix",
    "cards",
    "cash",
    "other",
  ] as const)
    .map((key) => ({
      amount: currentMonthMethodMetrics[key].amount,
      key,
      label: financeMethodLabel(key),
      share:
        currentMonthRealizedIncome > 0
          ? Number(
              (
                (currentMonthMethodMetrics[key].amount / currentMonthRealizedIncome) *
                100
              ).toFixed(1),
            )
          : 0,
    }))
    .filter((item) => item.amount > 0);
  const recentReceivablesItems = timelineEntries
    .filter((entry) => entry.kind === "income")
    .slice(0, 5)
    .map((entry) => ({
      amount: entry.amount,
      avatarUrl: entry.avatarUrl ?? null,
      id: entry.id,
      occurredAt: entry.occurredAt,
      occurredLabel: formatOccurrenceLabel(entry.occurredAt, timeZone),
      paymentMethodLabel: entry.paymentMethodLabel ?? null,
      sourceLabel: entry.sourceLabel,
      subtitle: entry.subtitle,
      title: entry.title,
    }));
  const openStoreOrderItems = openStoreOrders.map((order) => {
    const customer = firstRelation(order.customers);
    const status = formatOpenStoreOrderStatus(order.status);

    return {
      customerName: customer?.name ?? "Cliente",
      id: order.id,
      orderMoment: order.ready_at ?? order.confirmed_at ?? order.created_at,
      orderNumber: order.order_number,
      status: order.status,
      statusLabel: status.statusLabel,
      statusTone: status.statusTone,
      subtotalAmount: Number(order.subtotal_amount ?? 0),
      totalItems: Number(order.total_items ?? 0),
    };
  });
  const openStoreOrdersAmount = openStoreOrderItems.reduce(
    (total, order) => total + order.subtotalAmount,
    0,
  );

  return {
    cashRegister: {
      recentSessions: recentCashSessions,
      today: {
        differenceAmount:
          todayCashSession?.closing_difference_amount == null
            ? null
            : Number(todayCashSession.closing_difference_amount ?? 0),
        expectedBalance: todayExpectedBalance,
        expenseAmount: todayExpense,
        incomeAmount: todayRealizedIncome,
        isOpen: todayCashSession?.status === "open",
        openingAmount: todayOpeningAmount,
        reportedAmount:
          todayCashSession?.closing_reported_amount == null
            ? null
            : Number(todayCashSession.closing_reported_amount ?? 0),
        sessionId: todayCashSession?.id ?? null,
        sessionDate: todayKey,
        statusLabel: todayCashSession
          ? todayCashSession.status === "open"
            ? "Caixa aberto"
            : "Caixa fechado"
          : "Caixa ainda não aberto",
      },
    },
    storeOrders: {
      openAmount: openStoreOrdersAmount,
      openCount: openStoreOrderItems.length,
      items: openStoreOrderItems,
    },
    receivablesDashboard: {
      alerts: receivablesAlerts,
      cashHealth: {
        availableBalance: currentMonthCashProfit,
        forecastToday: selectedDayReceiptAmount,
        upcomingAmount: upcomingReceivablesTotal,
      },
      focusDateKey,
      focusDateLabel: formatLongDateLabel(focusDateKey, timeZone),
      methodBreakdown: {
        items: methodBreakdownItems,
        totalAmount: currentMonthRealizedIncome,
      },
      rangeDays,
      recent: {
        items: recentReceivablesItems,
      },
      pendingSettlements: {
        items: pendingSettlementItems,
        totalAmount: currentMonthPendingCompletedServicesAmount,
        totalCount: currentMonthPendingCompletedServicesCount,
      },
      todaySummary: {
        averageTicket: selectedDayAverageTicket,
        averageTicketDeltaPercent: calculateDeltaPercent(
          selectedDayAverageTicket,
          previousDayAverageTicket,
        ),
        methods: (["pix", "cards", "cash"] as const).map((key) => ({
          amount: selectedDayMethodMetrics[key].amount,
          count: selectedDayMethodMetrics[key].count,
          deltaPercent: calculateDeltaPercent(
            selectedDayMethodMetrics[key].amount,
            previousDayMethodMetrics[key].amount,
          ),
          key,
          label: financeMethodLabel(key),
        })),
        totalCount: selectedDayReceiptCount,
        totalDeltaPercent: calculateDeltaPercent(
          selectedDayReceiptAmount,
          previousDayReceiptAmount,
        ),
        totalReceived: selectedDayReceiptAmount,
      },
      trend: {
        actualPoints,
        actualTotal: cumulativeActual,
        conversionRate:
          cumulativeActual + upcomingReceivablesTotal > 0
            ? Number(
                (
                  (cumulativeActual /
                    (cumulativeActual + upcomingReceivablesTotal)) *
                  100
                ).toFixed(1),
              )
            : 0,
        potentialTotal: cumulativeActual + upcomingReceivablesTotal,
        projectedPoints,
        upcomingTotal: upcomingReceivablesTotal,
      },
      upcoming: {
        items: upcomingReceivableItems,
        totalAmount: upcomingReceivablesTotal,
      },
    },
    currentMonth: {
      appointmentMethodComparison: {
        actualTotal: currentMonthAppointmentActualTotal,
        forecastTotal: currentMonthAppointmentForecastTotal,
        items: appointmentMethodComparisonItems,
      },
      cashProfit: currentMonthCashProfit,
      expense: currentMonthExpense,
      operationalIncome: currentMonthOperationalIncome,
      pendingCompletedServicesAmount: currentMonthPendingCompletedServicesAmount,
      pendingCompletedServicesCount: currentMonthPendingCompletedServicesCount,
      projectedCommissions: currentMonthProjectedCommissions,
      commissionPendingPayout:
        currentMonthProjectedCommissions - currentMonthTeamPayoutsPaid,
      projectedNet:
        currentMonthRealizedIncome -
        currentMonthExpense -
        currentMonthProjectedCommissions,
      realizedIncome: currentMonthRealizedIncome,
      teamPayoutsPaid: currentMonthTeamPayoutsPaid,
    },
    monthBuckets,
    payables: {
      dueAmount: payableDueAmount,
      dueCount: payableDueCount,
      items: payableItems,
    },
    recurringExpenses: {
      activeCount: recurringExpenseItems.filter((item) => item.isActive).length,
      dueAmount: recurringDueAmount,
      dueCount: recurringDueCount,
      items: recurringExpenseItems,
    },
    staffOptions: staffRows
      .filter((staff) => staff.is_active !== false)
      .map((staff) => ({
        id: staff.id,
        label: staff.name,
      })),
    teamPayouts: {
      items: teamPayoutItems,
    },
    timelineEntries: timelineEntries.slice(0, TIMELINE_LIMIT),
  };
}
