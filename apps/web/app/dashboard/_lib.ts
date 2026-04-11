import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";
import { createClient } from "@/lib/supabase/server";

type AppointmentListItem = {
  id: string;
  date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customer_id?: string | null;
  customers: { name: string } | { name: string }[] | null;
  services:
    | { name: string; price?: number | string | null }
    | { name: string; price?: number | string | null }[]
    | null;
  staff_members?: { name: string } | { name: string }[] | null;
};

type AppointmentRevenueItem = {
  customer_id?: string | null;
  date: string;
  services:
    | { price: number | string | null }
    | { price: number | string | null }[]
    | null;
};

type CustomerGrowthItem = {
  created_at: string;
};

type CustomerTabListItem = {
  id: string;
  total_items: number | string;
  total_paid: number | string;
};

type DashboardSignalTone = "accent" | "soft" | "success" | "warm";

export type DashboardHomeData = {
  salonName: string;
  signals: Array<{
    label: string;
    note: string;
    tone: DashboardSignalTone;
    value: string;
  }>;
  customerGrowth: {
    activeCustomersLast30d: number;
    hasPreviousBaseline: boolean;
    monthlyDeltaLabel: string;
    newCustomersThisMonth: number;
    series: Array<{
      count: number;
      height: number;
      key: string;
      label: string;
    }>;
    totalCustomers: number;
  };
  agenda: {
    dateLabel: string;
    items: Array<{
      customerLine: string;
      id: string;
      isPending: boolean;
      serviceName: string;
      timeLabel: string;
    }>;
  };
  finance: {
    averageTicketLabel: string;
    monthCompletedAppointmentsCount: number;
    openTabsCount: number;
    openTabsPendingLabel: string;
    todayAppointmentsCount: number;
    todayRevenueLabel: string;
  };
  attentionItems: Array<{
    description: string;
    href: string;
    label: string;
  }>;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function toSafeDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  return value.length <= 10
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
}

function getLocalDateKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toSafeDate(value));
}

function formatAgendaDate(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone,
  }).format(toSafeDate(value));
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function getServicePrice(
  value: AppointmentListItem["services"] | AppointmentRevenueItem["services"],
) {
  const service = firstRelation(value);
  return Number(service?.price ?? 0);
}

function getMonthKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(toSafeDate(value));
}

function formatShortMonth(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    month: "short",
  })
    .format(toSafeDate(value))
    .replace(".", "")
    .trim()
    .slice(0, 3);
}

function formatShortDate(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "short",
  })
    .format(toSafeDate(value))
    .replace(".", "")
    .trim();
}

export async function loadDashboardHomeData(): Promise<DashboardHomeData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const upcomingWindowStart = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const upcomingWindowEnd = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recentWindowStart = new Date(
    now.getTime() - 45 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const activeCustomersWindowStart = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const customerGrowthWindowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  ).toISOString();

  const [
    { count: customersCount },
    { count: pendingCount },
    upcomingAppointmentsResult,
    completedAppointmentsResult,
    customerGrowthResult,
    openTabsResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "pending"),
    supabase
      .from("appointments")
      .select(
        "id, date, status, customer_id, customers(name), services(name, price), staff_members(name)",
      )
      .eq("salon_id", salon.id)
      .gte("date", upcomingWindowStart)
      .lt("date", upcomingWindowEnd)
      .order("date", { ascending: true })
      .limit(12),
    supabase
      .from("appointments")
      .select("customer_id, date, services(price)")
      .eq("salon_id", salon.id)
      .eq("status", "completed")
      .gte("date", recentWindowStart)
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("customers")
      .select("created_at")
      .eq("salon_id", salon.id)
      .gte("created_at", customerGrowthWindowStart)
      .order("created_at", { ascending: true }),
    supabase
      .from("customer_tabs")
      .select("id, total_items, total_paid")
      .eq("salon_id", salon.id)
      .eq("status", "open")
      .limit(40),
  ]);

  const upcomingAppointments = (upcomingAppointmentsResult.data ??
    []) as AppointmentListItem[];
  const completedAppointments = (completedAppointmentsResult.data ??
    []) as AppointmentRevenueItem[];
  const customerGrowthRows = (customerGrowthResult.data ?? []) as
    | CustomerGrowthItem[]
    | [];
  const openTabs = (openTabsResult.data ?? []) as CustomerTabListItem[];

  const todayKey = getLocalDateKey(now, timeZone);
  const currentMonthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(now);

  const todayAppointments = upcomingAppointments.filter(
    (appointment) =>
      getLocalDateKey(appointment.date, timeZone) === todayKey &&
      appointment.status !== "cancelled",
  );
  const nextAppointment =
    upcomingAppointments.find(
      (appointment) => appointment.status !== "cancelled",
    ) ?? null;
  const nextAppointmentCustomer = firstRelation(nextAppointment?.customers);
  const nextAppointmentService = firstRelation(nextAppointment?.services);

  const todayPendingCount = todayAppointments.filter(
    (appointment) => appointment.status === "pending",
  ).length;
  const todayRevenue = todayAppointments.reduce(
    (accumulator, appointment) =>
      accumulator + getServicePrice(appointment.services),
    0,
  );
  const openTabsPendingAmount = openTabs.reduce(
    (accumulator, tab) =>
      accumulator +
      Math.max(0, Number(tab.total_items ?? 0) - Number(tab.total_paid ?? 0)),
    0,
  );

  const monthCompletedAppointments = completedAppointments.filter(
    (appointment) =>
      new Intl.DateTimeFormat("en-CA", {
        timeZone,
        year: "numeric",
        month: "2-digit",
      }).format(toSafeDate(appointment.date)) === currentMonthKey,
  );
  const monthRevenue = monthCompletedAppointments.reduce(
    (accumulator, appointment) =>
      accumulator + getServicePrice(appointment.services),
    0,
  );
  const averageTicket =
    monthCompletedAppointments.length > 0
      ? monthRevenue / monthCompletedAppointments.length
      : 0;
  const activeCustomersLast30d = new Set(
    completedAppointments
      .filter((appointment) => appointment.date >= activeCustomersWindowStart)
      .map((appointment) => appointment.customer_id)
      .filter((value): value is string => Boolean(value)),
  ).size;
  const customerGrowthBuckets = Array.from({ length: 6 }, (_, index) => {
    const monthDate = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - (5 - index), 1, 12),
    );

    return {
      count: 0,
      key: getMonthKey(monthDate, timeZone),
      label: formatShortMonth(monthDate, timeZone),
    };
  });
  const customerGrowthCounts = new Map<string, number>();

  for (const customer of customerGrowthRows) {
    const monthKey = getMonthKey(customer.created_at, timeZone);
    customerGrowthCounts.set(
      monthKey,
      (customerGrowthCounts.get(monthKey) ?? 0) + 1,
    );
  }

  const customerGrowthSeries = customerGrowthBuckets.map((bucket) => ({
    ...bucket,
    count: customerGrowthCounts.get(bucket.key) ?? 0,
  }));
  const customerGrowthPeak =
    Math.max(...customerGrowthSeries.map((item) => item.count), 1) || 1;
  const currentCustomerGrowth =
    customerGrowthSeries[customerGrowthSeries.length - 1]?.count ?? 0;
  const previousCustomerGrowth =
    customerGrowthSeries[customerGrowthSeries.length - 2]?.count ?? 0;
  const customerGrowthDelta =
    previousCustomerGrowth === 0
      ? currentCustomerGrowth > 0
        ? 100
        : 0
      : Math.round(
          ((currentCustomerGrowth - previousCustomerGrowth) /
            previousCustomerGrowth) *
            100,
        );
  const customerGrowthDeltaLabel =
    customerGrowthDelta > 0
      ? `+${customerGrowthDelta}%`
      : `${customerGrowthDelta}%`;

  const attentionItems = [
    (pendingCount ?? 0) > 0
      ? {
          description: `${pendingCount ?? 0} horario(s) ainda aguardam confirmacao.`,
          href: MANAGEMENT_ROUTES.appointments,
          label: "Confirmacoes pendentes",
        }
      : null,
    !todayAppointments.length
      ? {
          description: nextAppointment
            ? `O proximo horario esta em ${formatAgendaDate(nextAppointment.date, timeZone)}.`
            : "Nenhum horario no momento. Vale abrir a agenda e organizar a semana.",
          href: MANAGEMENT_ROUTES.appointments,
          label: "Agenda vazia hoje",
        }
      : null,
    (customersCount ?? 0) === 0
      ? {
          description:
            "Cadastre as primeiras clientes para destravar agenda e relacionamento.",
          href: MANAGEMENT_ROUTES.clients,
          label: "Comecar base de clientes",
        }
      : null,
  ].filter(Boolean) as DashboardHomeData["attentionItems"];

  return {
    salonName: salon.name,
    signals: [
      {
        label: "Horarios hoje",
        note: todayAppointments.length
          ? `${todayPendingCount} pendente(s)`
          : "Nada marcado.",
        tone: todayAppointments.length ? "accent" : "soft",
        value: `${todayAppointments.length}`,
      },
      {
        label: "Pendencias",
        note: "Confirmacoes aguardando acao",
        tone: (pendingCount ?? 0) > 0 ? "warm" : "soft",
        value: `${pendingCount ?? 0}`,
      },
      {
        label: "Receita do mes",
        note: "Atendimentos concluidos",
        tone: monthRevenue > 0 ? "success" : "soft",
        value: formatCurrency(monthRevenue),
      },
      {
        label: "Proximo horario",
        note: nextAppointment
          ? `${nextAppointmentService?.name ?? "Servico"} • ${nextAppointmentCustomer?.name ?? "Cliente"}`
          : "Sem horario futuro",
        tone: nextAppointment ? "accent" : "soft",
        value: nextAppointment
          ? getLocalDateKey(nextAppointment.date, timeZone) === todayKey
            ? formatTime(nextAppointment.date, timeZone)
            : formatShortDate(nextAppointment.date, timeZone)
          : "-",
      },
    ],
    customerGrowth: {
      activeCustomersLast30d,
      hasPreviousBaseline: previousCustomerGrowth > 0,
      monthlyDeltaLabel: customerGrowthDeltaLabel,
      newCustomersThisMonth: currentCustomerGrowth,
      series: customerGrowthSeries.map((item) => ({
        count: item.count,
        height: Math.max(
          28,
          Math.round((item.count / customerGrowthPeak) * 170),
        ),
        key: item.key,
        label: item.label,
      })),
      totalCustomers: customersCount ?? 0,
    },
    agenda: {
      dateLabel: formatAgendaDate(todayAppointments[0]?.date ?? now, timeZone),
      items: todayAppointments.slice(0, 5).map((appointment) => {
        const customer = firstRelation(appointment.customers);
        const service = firstRelation(appointment.services);
        const staffMember = firstRelation(appointment.staff_members);

        return {
          customerLine: `${customer?.name ?? "Cliente"}${staffMember?.name ? ` • ${staffMember.name}` : ""}`,
          id: appointment.id,
          isPending: appointment.status === "pending",
          serviceName: service?.name ?? "Servico",
          timeLabel: formatTime(appointment.date, timeZone),
        };
      }),
    },
    finance: {
      averageTicketLabel: formatCurrency(averageTicket),
      monthCompletedAppointmentsCount: monthCompletedAppointments.length,
      openTabsCount: openTabs.length,
      openTabsPendingLabel: formatCurrency(openTabsPendingAmount),
      todayAppointmentsCount: todayAppointments.length,
      todayRevenueLabel: formatCurrency(todayRevenue),
    },
    attentionItems,
  };
}
