import { requireOwnerSalon } from "@/lib/auth";
import {
  buildFillChanceLabel,
  buildOperationalRiskLabel,
  computeDayOccupancySnapshot,
} from "@/lib/ai/operationalScores";
import {
  listPanelAssistantHistory,
} from "@/lib/ai/panelAssistant";
import {
  getRecoveryCampaignSnapshot,
  type RecoveryCampaignSnapshot,
} from "@/lib/ai/recoveryCampaign";
import { resolveBookedAppointmentAmount } from "@/lib/financialMetrics";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";
import { getUtcRangeForLocalDate } from "@/lib/management";
import { parseMembershipRequestPreferredScheduleNotes } from "@/lib/membershipRequestPreferredSchedule";
import { createClient } from "@/lib/supabase/server";

type AppointmentListItem = {
  id: string;
  date: string;
  service_price_snapshot?: number | string | null;
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
  completed_at?: string | null;
  customer_id?: string | null;
  date: string;
  service_price_snapshot?: number | string | null;
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

type MembershipRequestListItem = {
  approved_starts_on?: string | null;
  decided_at?: string | null;
  id: string;
  membership_id?: string | null;
  offer_id?: string | null;
  offer_title_snapshot: string;
  notes: string | null;
  price_snapshot: number | string | null;
  requested_at: string;
  status?: string | null;
  customers?: { name: string } | { name: string }[] | null;
};

type MembershipOfferConfigItem = {
  id: string;
  membership_validity_days: number | null;
};

type BirthdayCustomerItem = {
  id: string;
  name: string;
  phone: string | null;
  birth_date: string | null;
};

type BirthdayCampaignRow = {
  id: string;
  image_path: string | null;
  is_active: boolean;
  media_kind: "image" | "video" | null;
  message: string;
  title: string;
  video_path: string | null;
};

type StoreOrderListItem = {
  id: string;
  order_number: number;
  status: "pending" | "confirmed" | "ready" | "completed" | "cancelled";
  total_items: number | string;
  subtotal_amount: number | string;
  notes: string | null;
  created_at: string;
  customers?:
    | { name: string; phone: string | null }
    | { name: string; phone: string | null }[]
    | null;
};

type VacancyAlertRow = {
  body: string;
  ends_at: string;
  headline: string;
  id: string;
  service_id: string;
  services?:
    | { category?: string | null; name: string | null }
    | { category?: string | null; name: string | null }[]
    | null;
  staff_member_id: string | null;
  staff_members?:
    | { name: string | null }
    | { name: string | null }[]
    | null;
  starts_at: string;
};

type InsightAppointmentRow = {
  completed_at: string | null;
  customer_id?: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  services:
    | {
        category?: string | null;
        name: string | null;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        name: string | null;
        price?: number | string | null;
      }[]
    | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type CustomerInsightRow = {
  created_at: string;
  id: string;
  name: string;
  phone: string | null;
};

type DashboardSignalTone = "accent" | "soft" | "success" | "warm";

const DASHBOARD_BATCH_SIZE = 1000;
const DASHBOARD_REVENUE_ROWS_LIMIT = 2500;
const DASHBOARD_OPEN_TABS_ROWS_LIMIT = 1500;
const DASHBOARD_INSIGHTS_ROWS_LIMIT = 2500;
const DASHBOARD_UPCOMING_APPOINTMENTS_LIMIT = 1200;
const DASHBOARD_BIRTHDAY_CUSTOMERS_LIMIT = 2000;
const DASHBOARD_SOFT_TIMEOUT_MS = 650;

export type DashboardHomeData = {
  salonName: string;
  birthdays: {
    campaign: {
      isActive: boolean;
      mediaKind: "image" | "video" | null;
      mediaUrl: string | null;
      message: string | null;
      title: string | null;
    };
    items: Array<{
      birthDateLabel: string;
      id: string;
      name: string;
      phone: string | null;
      turningAge: number | null;
    }>;
    todayCount: number;
    todayLabel: string;
  };
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
    newCustomersToday: number;
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
    monthRevenueLabel: string;
    openTabsCount: number;
    openTabsPendingLabel: string;
    todayAppointmentsCount: number;
    todayRevenueLabel: string;
  };
  clientAppRequests: {
    pendingCount: number;
    appointments: Array<{
      customerName: string;
      dateLabel: string;
      id: string;
      serviceName: string;
      timeLabel: string;
    }>;
    memberships: Array<{
      approvedAtLabel: string | null;
      approvedStartsOnLabel: string | null;
      customerName: string;
      defaultStartsOn: string;
      id: string;
      note: string;
      priceLabel: string | null;
      requestedAtLabel: string;
      stage: "awaiting_payment" | "pending_approval";
      title: string;
      validityLabel: string | null;
    }>;
    storeOrders: Array<{
      customerName: string;
      id: string;
      itemsLabel: string;
      note: string;
      orderNumberLabel: string;
      priceLabel: string;
      requestedAtLabel: string;
    }>;
  };
  vacancyRadar: {
    openCount: number;
    items: Array<{
      agendaHref: string;
      id: string;
      scheduleLabel: string;
      serviceName: string;
      staffName: string;
      suggestions: Array<{
        daysSinceLastVisitLabel: string;
        id: string;
        name: string;
        reasonLabel: string;
      }>;
      summary: string;
    }>;
  };
  movementForecast: {
    focusServiceLabel: string | null;
    hasBaseline: boolean;
    lowWindowLabel: string | null;
    strongestDayLabel: string | null;
    strongestDayVolumeLabel: string | null;
    suggestions: string[];
    summary: string;
    weakestDayLabel: string | null;
    weakestDayVolumeLabel: string | null;
  };
  smartFillCampaign: RecoveryCampaignSnapshot;
  copilot: {
    fillChanceLabel: string;
    insights: Array<{
      actionHref: string | null;
      actionLabel: string | null;
      id: string;
      prompt: string | null;
      summary: string;
      title: string;
      tone: "alert" | "drop" | "opportunity";
    }>;
    lastAnalysisLabel: string | null;
    latestAnalysisQuestion: string | null;
    monitoringLabel: string;
    occupancyTomorrowLabel: string;
    operationalRiskLabel: string;
    opportunityPrompt: string | null;
    statusLabel: string;
    statusSummary: string;
  };
  attentionItems: Array<{
    description: string;
    href: string;
    label: string;
  }>;
};

export type DashboardBirthdaysData = DashboardHomeData["birthdays"];

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

function getMonthDayKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
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
  appointment: Pick<
    AppointmentListItem | AppointmentRevenueItem,
    "service_price_snapshot" | "services"
  >,
) {
  const service = firstRelation(appointment.services);
  return resolveBookedAppointmentAmount({
    servicePrice: service?.price,
    servicePriceSnapshot: appointment.service_price_snapshot,
  });
}

function getCompletedAppointmentReferenceDate(
  appointment: AppointmentRevenueItem,
) {
  return appointment.completed_at ?? appointment.date;
}

type DashboardQueryResult<T> = {
  data: T[] | null;
  error?: unknown | null;
};

async function fetchAllRows<T>(
  builderFactory: () => {
    limit?: (count: number) => PromiseLike<DashboardQueryResult<T>>;
    range?: (from: number, to: number) => PromiseLike<DashboardQueryResult<T>>;
    then?: PromiseLike<DashboardQueryResult<T>>["then"];
  },
  options: {
    maxRows?: number;
  } = {},
) {
  const rows: T[] = [];
  let from = 0;
  const maxRows = Math.max(0, options.maxRows ?? Number.POSITIVE_INFINITY);

  while (true) {
    const builder = builderFactory();
    let result: DashboardQueryResult<T>;

    if (typeof builder.range === "function") {
      result = await builder.range(from, from + DASHBOARD_BATCH_SIZE - 1);
    } else if (typeof builder.limit === "function") {
      result = await builder.limit(DASHBOARD_BATCH_SIZE);
    } else {
      result = await (builder as PromiseLike<DashboardQueryResult<T>>);
    }

    if (result.error) {
      throw result.error;
    }

    const chunk = result.data ?? [];
    rows.push(...chunk);

    if (rows.length >= maxRows) {
      return rows.slice(0, maxRows);
    }

    if (
      chunk.length < DASHBOARD_BATCH_SIZE ||
      typeof builder.range !== "function"
    ) {
      break;
    }

    from += DASHBOARD_BATCH_SIZE;
  }

  return rows;
}

async function withSoftTimeout<T>(
  load: Promise<T>,
  fallback: T,
  timeoutMs = DASHBOARD_SOFT_TIMEOUT_MS,
) {
  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race<T>([
      load,
      new Promise<T>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(fallback), timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle !== null) {
      clearTimeout(timeoutHandle);
    }
  }
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

function formatBirthdayDate(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "long",
  }).format(toSafeDate(value));
}

function formatMembershipValidityLabel(
  validityDays: number | null | undefined,
) {
  if (validityDays == null || validityDays <= 0) {
    return null;
  }

  return validityDays === 1
    ? "Validade real de 1 dia a partir da ativação."
    : `Validade real de ${validityDays} dias a partir da ativação.`;
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatAverageCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  const formattedCount = count.toFixed(1).replace(".", ",");
  return `${formattedCount} ${
    Math.abs(count - 1) < 0.001 ? singular : plural
  }`;
}

function formatDaysWithoutVisitLabel(days: number | null) {
  if (days == null) {
    return "Sem histórico de atendimento";
  }

  if (days <= 0) {
    return "Atendeu hoje";
  }

  return `${formatCountLabel(days, "dia")} sem voltar`;
}

function normalizeDashboardSearchText(value: string | null | undefined) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function cleanDashboardText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function formatRelativeHistoryMoment(value: string, now: Date) {
  const diffMs = Math.max(0, now.getTime() - new Date(value).getTime());
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) {
    return "agora";
  }

  if (diffMinutes < 60) {
    return `há ${diffMinutes} min`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `há ${diffHours} h`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `há ${formatCountLabel(diffDays, "dia")}`;
}

function buildVacancySuggestionReason(args: {
  completedVisits: number;
  favoriteCategoryName: string | null;
  favoriteServiceName: string | null;
  targetCategoryName: string | null;
  targetServiceName: string;
}) {
  if (
    args.favoriteServiceName &&
    normalizeDashboardSearchText(args.favoriteServiceName) ===
      normalizeDashboardSearchText(args.targetServiceName)
  ) {
    return `${formatCountLabel(args.completedVisits, "visita")} nesse serviço`;
  }

  if (
    args.favoriteCategoryName &&
    args.targetCategoryName &&
    normalizeDashboardSearchText(args.favoriteCategoryName) ===
      normalizeDashboardSearchText(args.targetCategoryName)
  ) {
    return `${formatCountLabel(args.completedVisits, "visita")} nessa categoria`;
  }

  return `${formatCountLabel(args.completedVisits, "visita")} no histórico recente`;
}

function buildMovementForecast(args: {
  appointments: InsightAppointmentRow[];
  lookbackStart: Date;
  now: Date;
  timeZone: string;
}): DashboardHomeData["movementForecast"] {
  const weekdayBuckets = new Map<
    string,
    { count: number; label: string; observedDays: number }
  >();
  const hourBuckets = new Map<number, number>();
  const currentMonthKey = getMonthKey(args.now, args.timeZone);
  const previousMonthKey = getMonthKey(
    new Date(Date.UTC(args.now.getUTCFullYear(), args.now.getUTCMonth() - 1, 1, 12)),
    args.timeZone,
  );
  const serviceBuckets = new Map<
    string,
    { currentCount: number; currentRevenue: number; previousCount: number; previousRevenue: number }
  >();

  for (
    let cursor = new Date(args.lookbackStart);
    cursor <= args.now;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const label = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone: args.timeZone,
    }).format(cursor);
    const normalized = normalizeDashboardSearchText(label);
    const current = weekdayBuckets.get(normalized) ?? {
      count: 0,
      label,
      observedDays: 0,
    };
    current.observedDays += 1;
    weekdayBuckets.set(normalized, current);
  }

  for (const appointment of args.appointments) {
    if (
      appointment.status !== "pending" &&
      appointment.status !== "confirmed" &&
      appointment.status !== "completed"
    ) {
      continue;
    }

    const service = firstRelation(appointment.services);
    const date = new Date(appointment.date);
    const weekdayLabel = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone: args.timeZone,
    }).format(date);
    const weekdayKey = normalizeDashboardSearchText(weekdayLabel);
    const weekdayStats = weekdayBuckets.get(weekdayKey) ?? {
      count: 0,
      label: weekdayLabel,
      observedDays: 0,
    };
    weekdayStats.count += 1;
    weekdayBuckets.set(weekdayKey, weekdayStats);

    const hour = Number(
      new Intl.DateTimeFormat("en-CA", {
        hour: "2-digit",
        hour12: false,
        timeZone: args.timeZone,
      }).format(date),
    );
    hourBuckets.set(hour, (hourBuckets.get(hour) ?? 0) + 1);

    if (appointment.status !== "completed") {
      continue;
    }

    const referenceMonthKey = getMonthKey(
      appointment.completed_at ?? appointment.date,
      args.timeZone,
    );
    const serviceLabel =
      cleanDashboardText(service?.category || service?.name || "Sem categoria", 80) ||
      "Sem categoria";
    const current = serviceBuckets.get(serviceLabel) ?? {
      currentCount: 0,
      currentRevenue: 0,
      previousCount: 0,
      previousRevenue: 0,
    };
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });

    if (referenceMonthKey === currentMonthKey) {
      current.currentCount += 1;
      current.currentRevenue += amount;
    } else if (referenceMonthKey === previousMonthKey) {
      current.previousCount += 1;
      current.previousRevenue += amount;
    }

    serviceBuckets.set(serviceLabel, current);
  }

  const weekdayAverages = [...weekdayBuckets.values()]
    .filter((bucket) => bucket.observedDays > 0)
    .map((bucket) => ({
      averageCount: bucket.count / bucket.observedDays,
      label: bucket.label,
    }))
    .sort((left, right) => left.averageCount - right.averageCount);

  const weakestDay = weekdayAverages[0] ?? null;
  const strongestDay = weekdayAverages[weekdayAverages.length - 1] ?? null;

  const hourWindowStats = Array.from({ length: 12 }, (_, index) => 8 + index).map(
    (hour) => ({
      count: hourBuckets.get(hour) ?? 0,
      hour,
    }),
  );
  const weakestHourWindow =
    [...hourWindowStats].sort((left, right) => left.count - right.count)[0] ?? null;

  const weakestService =
    [...serviceBuckets.entries()]
      .map(([label, stats]) => ({
        delta: stats.currentCount - stats.previousCount,
        label,
        stats,
      }))
      .sort((left, right) => {
        if (left.delta !== right.delta) {
          return left.delta - right.delta;
        }

        return left.stats.currentRevenue - right.stats.currentRevenue;
      })[0] ?? null;

  if (!weakestDay || !strongestDay) {
    return {
      focusServiceLabel: null,
      hasBaseline: false,
      lowWindowLabel: null,
      strongestDayLabel: null,
      strongestDayVolumeLabel: null,
      suggestions: [
        "Ainda não há histórico suficiente para mostrar os dias mais fortes e os mais fracos.",
      ],
      summary:
        "Assim que houver mais atendimentos concluídos, o painel passa a mostrar os dias mais cheios e os horários com mais sobra.",
      weakestDayLabel: null,
      weakestDayVolumeLabel: null,
    };
  }

  const weakDayLabel = cleanDashboardText(weakestDay.label, 40) || "Dia mais fraco";
  const strongDayLabel = cleanDashboardText(strongestDay.label, 40) || "Dia mais forte";
  const weakDayVolumeLabel = `${formatAverageCountLabel(
    weakestDay.averageCount,
    "atendimento",
    "atendimentos",
  )} por dia`;
  const strongDayVolumeLabel = `${formatAverageCountLabel(
    strongestDay.averageCount,
    "atendimento",
    "atendimentos",
  )} por dia`;
  const lowWindowLabel = weakestHourWindow
    ? `${String(weakestHourWindow.hour).padStart(2, "0")}:00`
    : null;
  const focusServiceLabel =
    weakestService && weakestService.delta < 0 ? weakestService.label : null;

  return {
    focusServiceLabel,
    hasBaseline: true,
    lowWindowLabel,
    strongestDayLabel: strongDayLabel,
    strongestDayVolumeLabel: strongDayVolumeLabel,
    suggestions: [
      `${weakDayLabel} pede ação rápida com campanha curta, encaixe ou reativação da base.`,
      lowWindowLabel
        ? `A faixa das ${lowWindowLabel} costuma ficar mais vazia e pode receber uma oferta relâmpago.`
        : "Monitore a faixa da tarde para ocupar horários vagos com uma oferta rápida.",
      focusServiceLabel
        ? `${focusServiceLabel} perdeu ritmo e merece uma campanha própria nesta semana.`
        : "Use o serviço mais rentável do salão como destaque nas próximas campanhas.",
    ],
    summary:
      focusServiceLabel
        ? `${weakDayLabel} está abaixo do ritmo normal do salão e ${focusServiceLabel} perdeu força nas últimas semanas.`
        : `${weakDayLabel} está abaixo do ritmo normal, enquanto ${strongDayLabel} segue puxando a ocupação.`,
    weakestDayLabel: weakDayLabel,
    weakestDayVolumeLabel: weakDayVolumeLabel,
  };
}

function buildVacancyRadar(args: {
  alerts: VacancyAlertRow[];
  customerRows: CustomerInsightRow[];
  historyAppointments: InsightAppointmentRow[];
  futureBookedCustomerIds: Set<string>;
  timeZone: string;
}): DashboardHomeData["vacancyRadar"] {
  if (!args.alerts.length) {
    return {
      items: [],
      openCount: 0,
    };
  }

  const customerById = new Map(args.customerRows.map((customer) => [customer.id, customer]));
  const historyByCustomerId = new Map<
    string,
    {
      completedVisits: number;
      favoriteCategoryName: string | null;
      favoriteServiceName: string | null;
      lastVisitAt: string | null;
      serviceCounters: Map<string, number>;
      categoryCounters: Map<string, number>;
    }
  >();

  for (const appointment of args.historyAppointments) {
    if (appointment.status !== "completed" || !appointment.customer_id) {
      continue;
    }

    const service = firstRelation(appointment.services);
    const current = historyByCustomerId.get(appointment.customer_id) ?? {
      categoryCounters: new Map<string, number>(),
      completedVisits: 0,
      favoriteCategoryName: null,
      favoriteServiceName: null,
      lastVisitAt: null,
      serviceCounters: new Map<string, number>(),
    };

    current.completedVisits += 1;
    const visitReference = appointment.completed_at ?? appointment.date;
    if (!current.lastVisitAt || current.lastVisitAt < visitReference) {
      current.lastVisitAt = visitReference;
    }

    const serviceName = cleanDashboardText(service?.name, 80) || null;
    const categoryName = cleanDashboardText(service?.category, 80) || null;

    if (serviceName) {
      current.serviceCounters.set(
        serviceName,
        (current.serviceCounters.get(serviceName) ?? 0) + 1,
      );
    }

    if (categoryName) {
      current.categoryCounters.set(
        categoryName,
        (current.categoryCounters.get(categoryName) ?? 0) + 1,
      );
    }

    historyByCustomerId.set(appointment.customer_id, current);
  }

  for (const history of historyByCustomerId.values()) {
    history.favoriteServiceName =
      [...history.serviceCounters.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
      null;
    history.favoriteCategoryName =
      [...history.categoryCounters.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ??
      null;
  }

  return {
    openCount: args.alerts.length,
    items: args.alerts.map((alert) => {
      const service = firstRelation(alert.services);
      const staffMember = firstRelation(alert.staff_members);
      const targetServiceName =
        cleanDashboardText(service?.name, 80) || cleanDashboardText(alert.headline, 80) || "Serviço";
      const targetCategoryName = cleanDashboardText(service?.category, 80) || null;
      const suggestions = [...historyByCustomerId.entries()]
        .filter(([customerId, history]) => {
          if (args.futureBookedCustomerIds.has(customerId)) {
            return false;
          }

          if (history.completedVisits <= 0) {
            return false;
          }

          const exactServiceMatch =
            history.favoriteServiceName &&
            normalizeDashboardSearchText(history.favoriteServiceName) ===
              normalizeDashboardSearchText(targetServiceName);
          const categoryMatch =
            history.favoriteCategoryName &&
            targetCategoryName &&
            normalizeDashboardSearchText(history.favoriteCategoryName) ===
              normalizeDashboardSearchText(targetCategoryName);

          return Boolean(exactServiceMatch || categoryMatch);
        })
        .map(([customerId, history]) => {
          const customer = customerById.get(customerId);
          const daysSinceLastVisit = history.lastVisitAt
            ? Math.max(
                0,
                Math.round(
                  (Date.now() - new Date(history.lastVisitAt).getTime()) /
                    (1000 * 60 * 60 * 24),
                ),
              )
            : null;

          return {
            customerId,
            daysSinceLastVisit,
            history,
            name: customer?.name ?? "Cliente sem nome",
            reasonLabel: buildVacancySuggestionReason({
              completedVisits: history.completedVisits,
              favoriteCategoryName: history.favoriteCategoryName,
              favoriteServiceName: history.favoriteServiceName,
              targetCategoryName,
              targetServiceName,
            }),
          };
        })
        .sort((left, right) => {
          const leftDays = left.daysSinceLastVisit ?? -1;
          const rightDays = right.daysSinceLastVisit ?? -1;

          if (rightDays !== leftDays) {
            return rightDays - leftDays;
          }

          return right.history.completedVisits - left.history.completedVisits;
        })
        .slice(0, 3)
        .map((candidate) => ({
          daysSinceLastVisitLabel: formatDaysWithoutVisitLabel(
            candidate.daysSinceLastVisit,
          ),
          id: candidate.customerId,
          name: candidate.name,
          reasonLabel: candidate.reasonLabel,
        }));

      const dayKey = getLocalDateKey(alert.starts_at, args.timeZone);
      const timeLabel = `${formatTime(alert.starts_at, args.timeZone)} ate ${formatTime(alert.ends_at, args.timeZone)}`;

      return {
        agendaHref: `${MANAGEMENT_ROUTES.appointments}?day=${dayKey}`,
        id: alert.id,
        scheduleLabel: `${formatAgendaDate(alert.starts_at, args.timeZone)} • ${timeLabel}`,
        serviceName: targetServiceName,
        staffName: cleanDashboardText(staffMember?.name, 80) || "Equipe",
        suggestions,
        summary: suggestions.length
          ? `${formatCountLabel(suggestions.length, "cliente", "clientes")} combinam com esta vaga agora.`
          : "Ainda não apareceu uma cliente forte para esta vaga. Vale avisar a base.",
      };
    }),
  };
}

function resolveTurningAge(
  birthDate: string | null,
  now: Date,
  timeZone: string,
) {
  if (!birthDate) {
    return null;
  }

  const birthYear = Number.parseInt(String(birthDate).slice(0, 4), 10);
  if (!Number.isFinite(birthYear) || birthYear < 1900) {
    return null;
  }

  const currentYear = Number.parseInt(
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
    }).format(now),
    10,
  );

  if (!Number.isFinite(currentYear) || currentYear < birthYear) {
    return null;
  }

  return currentYear - birthYear;
}

function buildDashboardBirthdaysData(args: {
  birthdayCampaignRow: BirthdayCampaignRow | null;
  birthdayCustomers: BirthdayCustomerItem[];
  now: Date;
  supabase: ReturnType<typeof createClient>;
  timeZone: string;
}): DashboardBirthdaysData {
  const { birthdayCampaignRow, birthdayCustomers, now, supabase, timeZone } =
    args;
  const todayMonthDayKey = getMonthDayKey(now, timeZone);
  const todayBirthdayCustomers = birthdayCustomers
    .filter(
      (customer) =>
        customer.birth_date &&
        getMonthDayKey(customer.birth_date, timeZone) === todayMonthDayKey,
    )
    .map((customer) => ({
      birthDateLabel: formatBirthdayDate(customer.birth_date!, timeZone),
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      turningAge: resolveTurningAge(customer.birth_date, now, timeZone),
    }));
  const birthdayCampaignMediaUrl =
    birthdayCampaignRow?.media_kind === "image" &&
    birthdayCampaignRow.image_path
      ? supabase.storage
          .from("salon-posts")
          .getPublicUrl(birthdayCampaignRow.image_path).data.publicUrl
      : birthdayCampaignRow?.media_kind === "video" &&
          birthdayCampaignRow.video_path
        ? supabase.storage
            .from("salon-posts")
            .getPublicUrl(birthdayCampaignRow.video_path).data.publicUrl
        : null;

  return {
    campaign: {
      isActive: birthdayCampaignRow?.is_active === true,
      mediaKind: birthdayCampaignRow?.media_kind ?? null,
      mediaUrl: birthdayCampaignMediaUrl,
      message: birthdayCampaignRow?.message?.trim() || null,
      title: birthdayCampaignRow?.title?.trim() || null,
    },
    items: todayBirthdayCustomers,
    todayCount: todayBirthdayCustomers.length,
    todayLabel: todayBirthdayCustomers.length
      ? `${todayBirthdayCustomers.length} aniversariante${todayBirthdayCustomers.length === 1 ? "" : "s"} hoje`
      : "Nenhuma aniversariante hoje",
  };
}

export async function loadDashboardBirthdaysData(): Promise<DashboardBirthdaysData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();

  const [birthdayCustomersResult, birthdayCampaignResult] = await Promise.all([
    supabase
      .from("customers")
      .select("id, name, phone, birth_date")
      .eq("salon_id", salon.id)
      .not("birth_date", "is", null)
      .order("name"),
    (supabase as any)
      .from("salon_birthday_campaigns")
      .select(
        "id, is_active, title, message, media_kind, image_path, video_path",
      )
      .eq("salon_id", salon.id)
      .maybeSingle(),
  ]);

  const birthdayCustomers = (birthdayCustomersResult.data ?? []) as
    | BirthdayCustomerItem[]
    | [];
  const birthdayCampaignRow = (birthdayCampaignResult.data ??
    null) as BirthdayCampaignRow | null;

  return buildDashboardBirthdaysData({
    birthdayCampaignRow,
    birthdayCustomers,
    now,
    supabase,
    timeZone,
  });
}

export async function loadDashboardHomeData(): Promise<DashboardHomeData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const todayKey = getLocalDateKey(now, timeZone);
  const todayRange = getUtcRangeForLocalDate(todayKey, timeZone);
  const activeCustomersWindowStart = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  );
  const insightLookbackStart = new Date(
    now.getTime() - 56 * 24 * 60 * 60 * 1000,
  );
  const currentMonthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const currentMonthStart = getUtcRangeForLocalDate(
    `${currentMonthKey}-01`,
    timeZone,
  ).start;
  const completedAppointmentsWindowStart = new Date(
    Math.min(currentMonthStart.getTime(), activeCustomersWindowStart.getTime()),
  ).toISOString();
  const customerGrowthWindowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 5, 1),
  ).toISOString();

  const [
    { count: customersCount },
    todayAppointmentsResult,
    nextAppointmentResult,
    completedAppointmentsResult,
    customerGrowthResult,
    openTabsResult,
    pendingAppointmentsResult,
    pendingStoreOrdersResult,
    membershipRequestsResult,
    membershipOffersResult,
    birthdayCustomersResult,
    birthdayCampaignResult,
    vacancyAlertsResult,
    insightAppointmentsResult,
    futureAppointmentsResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    fetchAllRows<AppointmentListItem>(() =>
      supabase
        .from("appointments")
        .select(
          "id, date, status, service_price_snapshot, customers(name), services(name, price), staff_members(name)",
        )
        .eq("salon_id", salon.id)
        .neq("status", "cancelled")
        .gte("date", todayRange.start.toISOString())
        .lt("date", todayRange.end.toISOString())
        .order("date", { ascending: true }),
    ),
    supabase
      .from("appointments")
      .select(
        "id, date, status, customers(name), services(name), staff_members(name)",
      )
      .eq("salon_id", salon.id)
      .neq("status", "cancelled")
      .gte("date", now.toISOString())
      .order("date", { ascending: true })
      .limit(1)
      .maybeSingle(),
    fetchAllRows<AppointmentRevenueItem>(
      () =>
        supabase
          .from("appointments")
          .select(
            "customer_id, date, completed_at, service_price_snapshot, services(price)",
          )
          .eq("salon_id", salon.id)
          .eq("status", "completed")
          .gte("date", completedAppointmentsWindowStart),
      {
        maxRows: DASHBOARD_REVENUE_ROWS_LIMIT,
      },
    ),
    supabase
      .from("customers")
      .select("created_at")
      .eq("salon_id", salon.id)
      .gte("created_at", customerGrowthWindowStart),
    fetchAllRows<CustomerTabListItem>(
      () =>
        supabase
          .from("customer_tabs")
          .select("id, total_items, total_paid")
          .eq("salon_id", salon.id)
          .eq("status", "open"),
      {
        maxRows: DASHBOARD_OPEN_TABS_ROWS_LIMIT,
      },
    ),
    supabase
      .from("appointments")
      .select("id, date, status, customers(name), services(name)", {
        count: "exact",
      })
      .eq("salon_id", salon.id)
      .eq("status", "pending")
      .order("date", { ascending: true })
      .limit(12),
    supabase
      .from("customer_product_orders")
      .select(
        "id, order_number, status, total_items, subtotal_amount, notes, created_at, customers(name, phone)",
        { count: "exact" },
      )
      .eq("salon_id", salon.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(12),
    (supabase as any)
      .from("customer_membership_requests")
      .select(
        "id, offer_id, offer_title_snapshot, requested_at, notes, price_snapshot, status, approved_starts_on, decided_at, membership_id, customers(name)",
        { count: "exact" },
      )
      .eq("salon_id", salon.id)
      .or("status.eq.pending,and(status.eq.approved,membership_id.is.null)")
      .order("requested_at", { ascending: false })
      .limit(12),
    supabase
      .from("salon_offers")
      .select("id, membership_validity_days")
      .eq("salon_id", salon.id)
      .eq("kind", "membership"),
    fetchAllRows<BirthdayCustomerItem>(
      () =>
        supabase
          .from("customers")
          .select("id, name, phone, birth_date")
          .eq("salon_id", salon.id)
          .not("birth_date", "is", null)
          .order("name"),
      {
        maxRows: DASHBOARD_BIRTHDAY_CUSTOMERS_LIMIT,
      },
    ),
    (supabase as any)
      .from("salon_birthday_campaigns")
      .select(
        "id, is_active, title, message, media_kind, image_path, video_path",
      )
      .eq("salon_id", salon.id)
      .maybeSingle(),
    (supabase as any)
      .from("salon_vacancy_alerts")
      .select(
        "id, headline, body, starts_at, ends_at, service_id, staff_member_id, services(name, category), staff_members(name)",
      )
      .eq("salon_id", salon.id)
      .gte("starts_at", now.toISOString())
      .order("starts_at", { ascending: true })
      .limit(6),
    fetchAllRows<InsightAppointmentRow>(
      () =>
        supabase
          .from("appointments")
          .select(
            "customer_id, date, completed_at, status, service_price_snapshot, services(name, category, price)",
          )
          .eq("salon_id", salon.id)
          .in("status", ["pending", "confirmed", "completed"])
          .gte("date", insightLookbackStart.toISOString())
          .order("date", { ascending: false }),
      {
        maxRows: DASHBOARD_INSIGHTS_ROWS_LIMIT,
      },
    ),
    fetchAllRows<{ customer_id?: string | null }>(
      () =>
        supabase
          .from("appointments")
          .select("customer_id")
          .eq("salon_id", salon.id)
          .in("status", ["pending", "confirmed"])
          .gte("date", now.toISOString())
          .order("date", { ascending: true }),
      {
        maxRows: DASHBOARD_UPCOMING_APPOINTMENTS_LIMIT,
      },
    ),
  ]);

  const todayAppointments = todayAppointmentsResult;
  const nextAppointment = (nextAppointmentResult.data ??
    null) as AppointmentListItem | null;
  const completedAppointments = completedAppointmentsResult;
  const customerGrowthRows = (customerGrowthResult.data ?? []) as
    | CustomerGrowthItem[]
    | [];
  const openTabs = openTabsResult;
  const pendingAppointments = (pendingAppointmentsResult.data ?? []) as
    | AppointmentListItem[]
    | [];
  const pendingStoreOrders = (pendingStoreOrdersResult.data ?? []) as
    | StoreOrderListItem[]
    | [];
  const membershipRequests = (membershipRequestsResult.data ?? []) as
    | MembershipRequestListItem[]
    | [];
  const membershipOfferConfigs = (membershipOffersResult.data ?? []) as
    | MembershipOfferConfigItem[]
    | [];
  const birthdayCustomers = birthdayCustomersResult;
  const birthdayCampaignRow = (birthdayCampaignResult.data ??
    null) as BirthdayCampaignRow | null;
  const vacancyAlerts = (vacancyAlertsResult.data ?? []) as VacancyAlertRow[];
  const insightAppointments = insightAppointmentsResult;
  const futureAppointments = futureAppointmentsResult;
  const futureBookedCustomerIds = new Set(
    futureAppointments
      .map((appointment) => appointment.customer_id)
      .filter((value): value is string => Boolean(value)),
  );
  const membershipValidityDaysByOfferId = new Map(
    membershipOfferConfigs.map((offer) => [
      offer.id,
      offer.membership_validity_days,
    ]),
  );
  const nextAppointmentCustomer = firstRelation(nextAppointment?.customers);
  const nextAppointmentService = firstRelation(nextAppointment?.services);

  const todayPendingCount = todayAppointments.filter(
    (appointment) => appointment.status === "pending",
  ).length;
  const todayRevenue = todayAppointments.reduce(
    (accumulator, appointment) => accumulator + getServicePrice(appointment),
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
      }).format(
        toSafeDate(getCompletedAppointmentReferenceDate(appointment)),
      ) === currentMonthKey,
  );
  const monthRevenue = monthCompletedAppointments.reduce(
    (accumulator, appointment) => accumulator + getServicePrice(appointment),
    0,
  );
  const averageTicket =
    monthCompletedAppointments.length > 0
      ? monthRevenue / monthCompletedAppointments.length
      : 0;
  const activeCustomersLast30d = new Set(
    completedAppointments
      .filter(
        (appointment) =>
          getCompletedAppointmentReferenceDate(appointment) >=
          activeCustomersWindowStart.toISOString(),
      )
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
  const newCustomersToday = customerGrowthRows.filter(
    (customer) => getLocalDateKey(customer.created_at, timeZone) === todayKey,
  ).length;

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
  const pendingAppointmentsCount = pendingAppointmentsResult.count ?? 0;
  const pendingStoreOrdersCount = pendingStoreOrdersResult.count ?? 0;
  const pendingMembershipRequestsCount = membershipRequestsResult.count ?? 0;
  const pendingClientAppRequestsCount =
    pendingAppointmentsCount +
    pendingStoreOrdersCount +
    pendingMembershipRequestsCount;
  const candidateCustomerIds = Array.from(
    new Set(
      insightAppointments
        .map((appointment) => appointment.customer_id)
        .filter((value): value is string => Boolean(value)),
    ),
  );
  let customerInsightRows: CustomerInsightRow[] = [];

  if (candidateCustomerIds.length > 0) {
    const customerInsightResult = await supabase
      .from("customers")
      .select("id, name, phone, created_at")
      .eq("salon_id", salon.id)
      .in("id", candidateCustomerIds);

    if (customerInsightResult.error) {
      throw customerInsightResult.error;
    }

    customerInsightRows = (customerInsightResult.data ?? []) as CustomerInsightRow[];
  }
  const vacancyRadar = buildVacancyRadar({
    alerts: vacancyAlerts,
    customerRows: customerInsightRows,
    futureBookedCustomerIds,
    historyAppointments: insightAppointments,
    timeZone,
  });
  const movementForecast = buildMovementForecast({
    appointments: insightAppointments,
    lookbackStart: insightLookbackStart,
    now,
    timeZone,
  });
  const tomorrowDate = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const tomorrowKey = getLocalDateKey(tomorrowDate, timeZone);
  const [smartFillCampaign, tomorrowOccupancy, assistantHistory] = await Promise.all([
    withSoftTimeout(
      getRecoveryCampaignSnapshot({
        question: "Preencher agenda de amanhã com IA",
        salon: {
          id: salon.id,
          name: salon.name,
          slot_step_minutes: salon.slot_step_minutes,
          timezone: timeZone,
        },
        supabase,
      }),
      {
        available: false,
        candidateCount: 0,
        dayLabel: null,
        highChanceCount: 0,
        openSlotsCount: 0,
        serviceName: null,
        staffName: null,
        topChanceLabel: null,
        windowLabel: null,
        headline: "Sem dados da campanha no momento.",
        summary: "A IA ainda não encontrou clientes para o preenchimento automático.",
      },
    ),
    withSoftTimeout(
      computeDayOccupancySnapshot({
        dayKey: tomorrowKey,
        now,
        salon: {
          id: salon.id,
          slot_step_minutes: salon.slot_step_minutes,
          timezone: timeZone,
        },
        supabase,
      }),
      {
        bookedAppointmentsCount: 0,
        bookedMinutes: 0,
        occupancyPercent: null,
        openSlotsCount: 0,
        totalOpenMinutes: 0,
        totalSlots: 0,
      },
    ),
    withSoftTimeout(
      listPanelAssistantHistory({
        limit: 1,
        salonId: salon.id,
        supabase,
      }).catch(() => []),
      [] as Awaited<ReturnType<typeof listPanelAssistantHistory>>,
    ),
  ]);
  const latestAssistantHistory = assistantHistory[0] ?? null;
  const operationalRiskLabel = buildOperationalRiskLabel({
    cancellationsLast7d: 0,
    pendingAppointmentsCount,
    tomorrowOccupancyPercent: tomorrowOccupancy.occupancyPercent,
  });
  const fillChanceLabel = buildFillChanceLabel({
    candidateCount: smartFillCampaign.candidateCount,
    highChanceCount: smartFillCampaign.highChanceCount,
    topChanceLabel: smartFillCampaign.topChanceLabel,
  });
  const occupancyTomorrowLabel =
    tomorrowOccupancy.occupancyPercent == null
      ? "Sem leitura"
      : `${tomorrowOccupancy.occupancyPercent}%`;
  const opportunityPrompt =
    movementForecast.weakestDayLabel && movementForecast.lowWindowLabel
      ? `Crie uma campanha para ${movementForecast.weakestDayLabel} com foco na faixa das ${movementForecast.lowWindowLabel}.`
      : smartFillCampaign.available
        ? "Crie uma promoção para preencher os horários vagos de amanhã."
        : null;
  const copilotInsights = [
    smartFillCampaign.available
      ? {
          actionHref: "/dashboard/benefits/promotions?compose=1",
          actionLabel: "Criar campanha",
          id: "smart-fill",
          prompt:
            opportunityPrompt ??
            "Crie uma promoção para preencher os horários vagos de amanhã.",
          summary: smartFillCampaign.summary,
          title: smartFillCampaign.headline,
          tone: "opportunity" as const,
        }
      : null,
    vacancyRadar.openCount > 0
      ? {
          actionHref: MANAGEMENT_ROUTES.appointments,
          actionLabel: "Abrir horários vagos",
          id: "vacancy-radar",
          prompt: "Quem posso chamar para uma vaga aberta?",
          summary:
            vacancyRadar.items[0]?.summary ??
            `${formatCountLabel(vacancyRadar.openCount, "vaga aberta", "vagas abertas")} pedem encaixe rápido.`,
          title: `${formatCountLabel(vacancyRadar.openCount, "horário vago", "horários vagos")} detectados`,
          tone: "alert" as const,
        }
      : null,
    movementForecast.hasBaseline &&
    movementForecast.weakestDayLabel &&
    movementForecast.lowWindowLabel
      ? {
          actionHref: MANAGEMENT_ROUTES.appointments,
          actionLabel: "Ver agenda",
          id: "movement-forecast",
          prompt: `Como está ${movementForecast.weakestDayLabel}?`,
          summary: movementForecast.summary,
          title: `${movementForecast.weakestDayLabel} está com baixa ocupação perto das ${movementForecast.lowWindowLabel}.`,
          tone: "drop" as const,
        }
      : null,
  ].filter(Boolean) as DashboardHomeData["copilot"]["insights"];
  const statusSummary =
    operationalRiskLabel === "Alto"
      ? `Amanhã pede atenção: ocupação em ${occupancyTomorrowLabel} e ${formatCountLabel(pendingAppointmentsCount, "confirmação pendente", "confirmações pendentes")}.`
      : operationalRiskLabel === "Medio"
        ? "O salão está estável, mas ainda dá para melhorar a agenda de amanhã."
        : `Agenda sob controle para amanhã, com ocupação de ${occupancyTomorrowLabel} e boa chance de encaixe.`;
  const attentionItems = [
    pendingClientAppRequestsCount > 0
      ? {
          description: `${formatCountLabel(pendingClientAppRequestsCount, "pedido do aplicativo", "pedidos do aplicativo")} aguardam resposta.`,
          href: "/dashboard",
          label: "Pedidos do app",
        }
      : null,
    pendingAppointmentsCount > 0
      ? {
          description: `${formatCountLabel(pendingAppointmentsCount, "horário", "horários")} ainda aguardam confirmação.`,
          href: MANAGEMENT_ROUTES.appointments,
          label: "Confirmações pendentes",
        }
      : null,
    vacancyRadar.openCount > 0
      ? {
          description: `${formatCountLabel(vacancyRadar.openCount, "vaga aberta", "vagas abertas")} já têm sugestão de encaixe.`,
          href: MANAGEMENT_ROUTES.appointments,
          label: "Vagas para preencher",
        }
      : null,
    movementForecast.hasBaseline &&
    movementForecast.weakestDayLabel &&
    movementForecast.lowWindowLabel
      ? {
          description: `${movementForecast.weakestDayLabel} e a faixa das ${movementForecast.lowWindowLabel} pedem uma campanha para ganhar ocupação.`,
          href: "/dashboard/benefits/promotions?compose=1",
          label: "Janela fraca prevista",
        }
      : null,
    smartFillCampaign.available
      ? {
          description: smartFillCampaign.summary,
          href: "/dashboard",
          label: "Campanha sugerida",
        }
      : null,
    !todayAppointments.length
      ? {
          description: nextAppointment
            ? `O próximo horário está marcado para ${formatAgendaDate(nextAppointment.date, timeZone)}.`
            : "Nenhum horário no momento. Vale organizar a semana.",
          href: MANAGEMENT_ROUTES.appointments,
          label: "Agenda vazia hoje",
        }
      : null,
    (customersCount ?? 0) === 0
      ? {
          description:
            "Cadastre as primeiras clientes para começar a agenda e o relacionamento.",
          href: MANAGEMENT_ROUTES.clients,
          label: "Começar base de clientes",
        }
      : null,
  ].filter(Boolean) as DashboardHomeData["attentionItems"];

  return {
    salonName: salon.name,
    birthdays: buildDashboardBirthdaysData({
      birthdayCampaignRow,
      birthdayCustomers,
      now,
      supabase,
      timeZone,
    }),
    signals: [
      {
        label: "Horários hoje",
        note: todayAppointments.length
          ? formatCountLabel(todayPendingCount, "pendente", "pendentes")
          : "Nada marcado.",
        tone: todayAppointments.length ? "accent" : "soft",
        value: `${todayAppointments.length}`,
      },
      {
        label: "Pendências",
        note: pendingClientAppRequestsCount
          ? `${formatCountLabel(pendingClientAppRequestsCount, "pedido do app", "pedidos do app")} aguardando resposta`
          : "Confirmações aguardando ação",
        tone:
          pendingAppointmentsCount > 0 || pendingClientAppRequestsCount > 0
            ? "warm"
            : "soft",
        value: `${pendingClientAppRequestsCount}`,
      },
      {
        label: "Pedidos do app",
        note: pendingClientAppRequestsCount
          ? "Resolva direto nesta tela"
          : "Nenhum pedido do app agora",
        tone: pendingClientAppRequestsCount ? "accent" : "soft",
        value: `${pendingClientAppRequestsCount}`,
      },
      {
        label: "Receita do mês",
        note: "Atendimentos concluídos",
        tone: monthRevenue > 0 ? "success" : "soft",
        value: formatCurrency(monthRevenue),
      },
      {
        label: "Próximo horário",
        note: nextAppointment
          ? `${nextAppointmentService?.name ?? "Serviço"} • ${nextAppointmentCustomer?.name ?? "Cliente"}`
          : "Sem horário futuro",
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
      newCustomersToday,
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
          serviceName: service?.name ?? "Serviço",
          timeLabel: formatTime(appointment.date, timeZone),
        };
      }),
    },
    finance: {
      averageTicketLabel: formatCurrency(averageTicket),
      monthCompletedAppointmentsCount: monthCompletedAppointments.length,
      monthRevenueLabel: formatCurrency(monthRevenue),
      openTabsCount: openTabs.length,
      openTabsPendingLabel: formatCurrency(openTabsPendingAmount),
      todayAppointmentsCount: todayAppointments.length,
      todayRevenueLabel: formatCurrency(todayRevenue),
    },
    clientAppRequests: {
      pendingCount: pendingClientAppRequestsCount,
      appointments: pendingAppointments.map((appointment) => {
        const customer = firstRelation(appointment.customers);
        const service = firstRelation(appointment.services);

        return {
          customerName: customer?.name?.trim() || "Cliente sem nome",
          dateLabel: formatShortDate(appointment.date, timeZone),
          id: appointment.id,
          serviceName: service?.name?.trim() || "Serviço",
          timeLabel: formatTime(appointment.date, timeZone),
        };
      }),
      memberships: membershipRequests.map((request) => {
        const customer = firstRelation(request.customers);
        const validityDays = request.offer_id
          ? membershipValidityDaysByOfferId.get(request.offer_id)
          : null;
        const parsedNotes = parseMembershipRequestPreferredScheduleNotes(
          request.notes,
        );
        const stage =
          request.status === "approved"
            ? "awaiting_payment"
            : "pending_approval";

        return {
          approvedAtLabel: request.decided_at
            ? `${formatShortDate(request.decided_at, timeZone)} • ${formatTime(request.decided_at, timeZone)}`
            : null,
          approvedStartsOnLabel: request.approved_starts_on
            ? formatDate(request.approved_starts_on)
            : null,
          customerName: customer?.name?.trim() || "Cliente sem nome",
          defaultStartsOn: todayKey,
          id: request.id,
          note: parsedNotes.notes?.trim() || "Sem observação enviada no app.",
          priceLabel:
            request.price_snapshot == null
              ? null
              : formatCurrency(Number(request.price_snapshot)),
          requestedAtLabel: `${formatShortDate(request.requested_at, timeZone)} • ${formatTime(request.requested_at, timeZone)}`,
          stage,
          title: request.offer_title_snapshot,
          validityLabel: formatMembershipValidityLabel(validityDays),
        };
      }),
      storeOrders: pendingStoreOrders.map((order) => {
        const customer = firstRelation(order.customers);
        const totalItems = Number(order.total_items ?? 0);

        return {
          customerName: customer?.name?.trim() || "Cliente sem nome",
          id: order.id,
          itemsLabel: `${totalItems} ${totalItems === 1 ? "item" : "itens"}`,
          note: order.notes?.trim() || "Sem observações nesse pedido.",
          orderNumberLabel: `Pedido #${order.order_number}`,
          priceLabel: formatCurrency(Number(order.subtotal_amount ?? 0)),
          requestedAtLabel: `${formatShortDate(order.created_at, timeZone)} • ${customer?.phone?.trim() || "Contato não informado"}`,
        };
      }),
    },
    vacancyRadar,
    movementForecast,
    smartFillCampaign,
    copilot: {
      fillChanceLabel,
      insights: copilotInsights,
      lastAnalysisLabel: latestAssistantHistory
        ? `Última análise ${formatRelativeHistoryMoment(latestAssistantHistory.createdAt, now)}`
        : null,
      latestAnalysisQuestion: latestAssistantHistory?.question ?? null,
      monitoringLabel: "Acompanhando agenda e ocupação",
      occupancyTomorrowLabel,
      operationalRiskLabel,
      opportunityPrompt,
      statusLabel: "Resumo automático ativo",
      statusSummary,
    },
    attentionItems,
  };
}
