import { requireOwnerSalon } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

import type { FinancePageData } from "./_lib";

type FinanceManualEntryRow = {
  amount: number | string;
  category: string;
  created_at: string;
  entry_type: "income" | "expense";
  id: string;
  notes: string | null;
  occurred_on: string;
  payment_method: string | null;
  source: "manual" | "appointment" | "store_order";
  title: string;
};

type FinanceAppointmentRow = {
  completed_at: string | null;
  customers: { name: string } | { name: string }[] | null;
  date: string;
  id: string;
  services:
    | { name: string; price?: number | string | null }
    | { name: string; price?: number | string | null }[]
    | null;
};

type FinanceStoreOrderRow = {
  completed_at: string | null;
  created_at: string;
  customers: { name: string } | { name: string }[] | null;
  id: string;
  order_number: number;
  subtotal_amount: number | string;
};

function firstRelation<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function monthKeyFromDate(value: string | Date) {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
  }).format(date);
}

function buildMonthRange(months: number) {
  const values: FinancePageData["monthBuckets"] = [];
  const now = new Date();

  for (let offset = months - 1; offset >= 0; offset -= 1) {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1),
    );
    values.push({
      key: new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
      }).format(date),
      label: new Intl.DateTimeFormat("pt-BR", {
        month: "short",
        timeZone: "UTC",
      })
        .format(date)
        .replace(".", ""),
      income: 0,
      expense: 0,
    });
  }

  return values;
}

export async function loadFinancePageData(): Promise<FinancePageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const monthStart = new Date();

  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);

  const sixMonthsAgo = new Date(
    Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 5, 1),
  );
  const sixMonthsAgoIso = sixMonthsAgo.toISOString();
  const sixMonthsAgoDate = sixMonthsAgo.toISOString().slice(0, 10);
  const financeTable = (supabase as any).from("salon_financial_transactions");

  const [appointmentsResult, storeOrdersResult, manualEntriesResult] =
    await Promise.all([
      supabase
        .from("appointments")
        .select("id, date, completed_at, customers(name), services(name, price)")
        .eq("salon_id", salon.id)
        .not("completed_at", "is", null)
        .gte("completed_at", sixMonthsAgoIso)
        .order("completed_at", { ascending: false }),
      supabase
        .from("customer_product_orders")
        .select(
          "id, order_number, subtotal_amount, completed_at, created_at, customers(name)",
        )
        .eq("salon_id", salon.id)
        .eq("status", "completed")
        .gte("completed_at", sixMonthsAgoIso)
        .order("completed_at", { ascending: false }),
      financeTable
        .select(
          "id, title, category, notes, entry_type, amount, occurred_on, payment_method, source, created_at",
        )
        .eq("salon_id", salon.id)
        .gte("occurred_on", sixMonthsAgoDate)
        .order("occurred_on", { ascending: false })
        .order("created_at", { ascending: false }),
    ]);

  const appointments = (appointmentsResult.data ?? []) as FinanceAppointmentRow[];
  const storeOrders = (storeOrdersResult.data ?? []) as FinanceStoreOrderRow[];
  const manualEntries = (manualEntriesResult.data ?? []) as FinanceManualEntryRow[];

  const monthBuckets = buildMonthRange(6);
  const bucketMap = new Map(monthBuckets.map((bucket) => [bucket.key, bucket]));
  const currentMonthKey = monthKeyFromDate(new Date());

  let currentMonthIncome = 0;
  let currentMonthExpense = 0;

  const timelineEntries: FinancePageData["timelineEntries"] = [];

  for (const appointment of appointments) {
    const customer = firstRelation(appointment.customers);
    const service = firstRelation(appointment.services);
    const amount = Number(service?.price ?? 0);
    const occurredAt = appointment.completed_at ?? appointment.date;
    const key = monthKeyFromDate(occurredAt);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.income += amount;
    }

    if (key === currentMonthKey) {
      currentMonthIncome += amount;
    }

    timelineEntries.push({
      id: `appointment-${appointment.id}`,
      amount,
      kind: "income",
      occurredAt,
      sourceLabel: "Atendimento",
      subtitle: `${customer?.name ?? "Cliente"} • ${formatDate(appointment.date)}`,
      title: service?.name ?? "Atendimento concluído",
    });
  }

  for (const order of storeOrders) {
    const customer = firstRelation(order.customers);
    const amount = Number(order.subtotal_amount ?? 0);
    const occurredAt = order.completed_at ?? order.created_at;
    const key = monthKeyFromDate(occurredAt);
    const bucket = bucketMap.get(key);

    if (bucket) {
      bucket.income += amount;
    }

    if (key === currentMonthKey) {
      currentMonthIncome += amount;
    }

    timelineEntries.push({
      id: `store-order-${order.id}`,
      amount,
      kind: "income",
      occurredAt,
      sourceLabel: "Loja",
      subtitle: `${customer?.name ?? "Cliente"} • pedido #${order.order_number}`,
      title: "Venda da loja virtual",
    });
  }

  for (const entry of manualEntries) {
    const amount = Number(entry.amount ?? 0);
    const key = monthKeyFromDate(`${entry.occurred_on}T12:00:00Z`);
    const bucket = bucketMap.get(key);

    if (bucket) {
      if (entry.entry_type === "expense") {
        bucket.expense += amount;
      } else {
        bucket.income += amount;
      }
    }

    if (key === currentMonthKey) {
      if (entry.entry_type === "expense") {
        currentMonthExpense += amount;
      } else {
        currentMonthIncome += amount;
      }
    }

    timelineEntries.push({
      id: `manual-${entry.id}`,
      amount,
      kind: entry.entry_type,
      occurredAt: `${entry.occurred_on}T12:00:00Z`,
      sourceLabel: entry.entry_type === "expense" ? "Despesa" : "Receita",
      subtitle: `${entry.category}${entry.payment_method ? ` • ${entry.payment_method}` : ""}`,
      title: entry.title,
    });
  }

  timelineEntries.sort(
    (left, right) =>
      new Date(right.occurredAt).getTime() - new Date(left.occurredAt).getTime(),
  );

  return {
    currentMonth: {
      income: currentMonthIncome,
      expense: currentMonthExpense,
      profit: currentMonthIncome - currentMonthExpense,
    },
    monthBuckets,
    timelineEntries,
  };
}
