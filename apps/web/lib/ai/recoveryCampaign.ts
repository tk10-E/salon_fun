import {
  createOpenRouterChatCompletion,
  getOpenRouterModel,
  isOpenRouterEnabled,
} from "@/lib/ai/openrouter";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  buildRecoveryCampaignSystemPrompt,
  buildRecoveryCampaignUserPrompt,
} from "@/lib/ai/prompts/recoveryCampaignPrompt";
import { resolveBookedAppointmentAmount } from "@/lib/financialMetrics";
import { getLocalDateKey, getUtcRangeForLocalDate } from "@/lib/management";

import { generatePromotionDraftWithAi } from "./promotionDraft";

type SalonContext = {
  id: string;
  name: string;
  slot_step_minutes?: number | null;
  timezone?: string | null;
};

type RecoveryCampaignArgs = {
  question?: string | null;
  requestOrigin?: string | null;
  salon: SalonContext;
  supabase: any;
};

type StaffMemberRow = {
  id: string;
  is_active: boolean | null;
  name: string;
};

type StaffScheduleContextRow = {
  closes_at_utc: string;
  is_open: boolean;
  opens_at_utc: string;
};

type TargetDayAppointmentRow = {
  customer_id: string | null;
  date: string;
  ends_at: string;
  staff_member_id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type HistoryAppointmentRow = {
  completed_at: string | null;
  customer_id: string | null;
  date: string;
  service_id: string | null;
  service_price_snapshot: number | string | null;
  staff_member_id: string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  services:
    | {
        category?: string | null;
        duration?: number | null;
        name: string | null;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        duration?: number | null;
        name: string | null;
        price?: number | string | null;
      }[]
    | null;
  staff_members:
    | {
        name: string | null;
      }
    | {
        name: string | null;
      }[]
    | null;
};

type CustomerRow = {
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
};

type ServiceRow = {
  category: string | null;
  duration: number | null;
  id: string;
  name: string;
  price: number | string | null;
};

type VacancyAlertRow = {
  ends_at: string;
  headline: string;
  services:
    | { category?: string | null; name: string | null }
    | { category?: string | null; name: string | null }[]
    | null;
  staff_members:
    | { name: string | null }
    | { name: string | null }[]
    | null;
  starts_at: string;
};

type FreeWindow = {
  durationMinutes: number;
  endAt: string;
  slotCount: number;
  startAt: string;
  staffMemberId: string;
  staffMemberName: string;
};

type OpportunityCandidate = {
  avgTicket: number;
  cancellationCount: number;
  completedVisits: number;
  customerId: string;
  customerName: string;
  daysSinceLastVisit: number | null;
  favoriteCategoryName: string | null;
  favoriteServiceId: string | null;
  favoriteServiceName: string | null;
  favoriteStaffId: string | null;
  favoriteStaffName: string | null;
  lastVisitAt: string | null;
  sameWeekdayVisits: number;
  score: number;
  scoreLabel: string;
  suggestionReason: string;
};

type RecoveryOpportunity = {
  dayKey: string;
  dayLabel: string;
  openSlotsCount: number;
  serviceCategoryName: string | null;
  serviceName: string;
  servicePrice: number | null;
  staffName: string;
  topChanceLabel: string;
  windowEndAt: string;
  windowLabel: string;
  windowStartAt: string;
  suggestions: OpportunityCandidate[];
};

export type RecoveryCampaignSnapshot = {
  available: boolean;
  candidateCount: number;
  dayLabel: string | null;
  headline: string;
  highChanceCount: number;
  openSlotsCount: number;
  serviceName: string | null;
  staffName: string | null;
  summary: string;
  topChanceLabel: string | null;
  windowLabel: string | null;
};

export type RecoveryCampaignDraft = {
  campaignName: string;
  discountLabel: string;
  instagramCaption: string;
  model: string;
  priceSuggestion: number | null;
  strategyBullets: string[];
  whatsappText: string;
};

export type RecoveryCampaignResult = {
  available: boolean;
  candidates: Array<{
    avgTicketLabel: string;
    chanceLabel: string;
    customerId: string;
    daysSinceLastVisitLabel: string;
    name: string;
    reasonLabel: string;
    score: number;
  }>;
  ctaHref: string | null;
  ctaLabel: string | null;
  draft: RecoveryCampaignDraft | null;
  followUp: string | null;
  snapshot: RecoveryCampaignSnapshot;
};

function cleanText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function normalizeSearchText(value: string | null | undefined) {
  return cleanText(value, 400)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

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

function formatDateLabel(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(toSafeDate(value));
}

function formatTimeLabel(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(toSafeDate(value));
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
}

function addDaysToDayKey(dayKey: string, days: number) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function getWeekdayFromDayKey(dayKey: string) {
  return new Date(`${dayKey}T12:00:00Z`).getUTCDay();
}

function resolveQuestionTargetDay(question: string | null | undefined, timeZone: string) {
  const normalized = normalizeSearchText(question);
  const todayKey = getLocalDateKey(new Date(), timeZone);

  if (normalized.includes("hoje")) {
    return { dayKey: todayKey, label: formatDateLabel(todayKey, timeZone) };
  }

  if (normalized.includes("amanha")) {
    const dayKey = addDaysToDayKey(todayKey, 1);
    return { dayKey, label: formatDateLabel(dayKey, timeZone) };
  }

  const weekdayMatchers = [
    { weekday: 0, values: ["domingo"] },
    { weekday: 1, values: ["segunda", "segunda feira"] },
    { weekday: 2, values: ["terca", "terca feira"] },
    { weekday: 3, values: ["quarta", "quarta feira"] },
    { weekday: 4, values: ["quinta", "quinta feira"] },
    { weekday: 5, values: ["sexta", "sexta feira"] },
    { weekday: 6, values: ["sabado"] },
  ] as const;

  for (const matcher of weekdayMatchers) {
    if (!matcher.values.some((value) => normalized.includes(value))) {
      continue;
    }

    for (let offset = 0; offset < 7; offset += 1) {
      const probeDay = addDaysToDayKey(todayKey, offset);
      if (getWeekdayFromDayKey(probeDay) === matcher.weekday) {
        return { dayKey: probeDay, label: formatDateLabel(probeDay, timeZone) };
      }
    }
  }

  const dayKey = addDaysToDayKey(todayKey, 1);
  return { dayKey, label: formatDateLabel(dayKey, timeZone) };
}

function buildFreeWindows(args: {
  appointments: TargetDayAppointmentRow[];
  closesAtUtc: string;
  opensAtUtc: string;
  slotStepMinutes: number;
  staffMemberId: string;
  staffMemberName: string;
}) {
  const windows: FreeWindow[] = [];
  let cursor = new Date(args.opensAtUtc);
  const endOfDay = new Date(args.closesAtUtc);
  const sortedAppointments = [...args.appointments].sort(
    (left, right) => new Date(left.date).getTime() - new Date(right.date).getTime(),
  );

  for (const appointment of sortedAppointments) {
    const appointmentStart = new Date(appointment.date);
    const appointmentEnd = new Date(appointment.ends_at);

    if (appointmentStart > cursor) {
      const durationMinutes = Math.round(
        (appointmentStart.getTime() - cursor.getTime()) / 60000,
      );

      if (durationMinutes >= args.slotStepMinutes) {
        windows.push({
          durationMinutes,
          endAt: appointmentStart.toISOString(),
          slotCount: Math.floor(durationMinutes / args.slotStepMinutes),
          staffMemberId: args.staffMemberId,
          staffMemberName: args.staffMemberName,
          startAt: cursor.toISOString(),
        });
      }
    }

    if (appointmentEnd > cursor) {
      cursor = appointmentEnd;
    }
  }

  if (endOfDay > cursor) {
    const durationMinutes = Math.round(
      (endOfDay.getTime() - cursor.getTime()) / 60000,
    );

    if (durationMinutes >= args.slotStepMinutes) {
      windows.push({
        durationMinutes,
        endAt: endOfDay.toISOString(),
        slotCount: Math.floor(durationMinutes / args.slotStepMinutes),
        staffMemberId: args.staffMemberId,
        staffMemberName: args.staffMemberName,
        startAt: cursor.toISOString(),
      });
    }
  }

  return windows;
}

function scoreToChanceLabel(score: number) {
  if (score >= 85) {
    return "Alta";
  }

  if (score >= 70) {
    return "Boa";
  }

  if (score >= 55) {
    return "Media";
  }

  return "Baixa";
}

function formatDaysSinceLabel(days: number | null) {
  if (days == null) {
    return "Sem historico concluido";
  }

  if (days <= 0) {
    return "Atendeu hoje";
  }

  return `${days} dia(s) sem voltar`;
}

function buildCandidateReason(args: {
  candidate: {
    daysSinceLastVisit: number | null;
    favoriteServiceName: string | null;
    favoriteStaffName: string | null;
    sameWeekdayVisits: number;
  };
  targetServiceName: string;
  targetStaffName: string;
  weekdayLabel: string;
}) {
  const parts: string[] = [];

  if (args.candidate.favoriteServiceName) {
    parts.push(`curte ${args.candidate.favoriteServiceName.toLowerCase()}`);
  }

  if (
    args.candidate.favoriteStaffName &&
    normalizeSearchText(args.candidate.favoriteStaffName) ===
      normalizeSearchText(args.targetStaffName)
  ) {
    parts.push(`costuma atender com ${args.targetStaffName}`);
  }

  if (args.candidate.sameWeekdayVisits > 0) {
    parts.push(`ja agenda ${args.weekdayLabel.toLowerCase()}`);
  }

  if (args.candidate.daysSinceLastVisit != null) {
    parts.push(`esta ha ${args.candidate.daysSinceLastVisit} dia(s) sem retorno`);
  }

  if (!parts.length) {
    parts.push(`tem historico com ${args.targetServiceName.toLowerCase()}`);
  }

  return cleanText(parts.join(", "), 180);
}

function findServiceMatchByQuestion(question: string | null | undefined, services: ServiceRow[]) {
  const normalizedQuestion = normalizeSearchText(question);
  if (!normalizedQuestion) {
    return null;
  }

  return [...services]
    .sort((left, right) => right.name.length - left.name.length)
    .find((service) =>
      normalizedQuestion.includes(normalizeSearchText(service.name)),
    ) ?? null;
}

async function buildRecoveryOpportunity(
  args: RecoveryCampaignArgs,
): Promise<RecoveryOpportunity | null> {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const targetDay = resolveQuestionTargetDay(args.question, timeZone);
  const targetDayRange = getUtcRangeForLocalDate(targetDay.dayKey, timeZone);
  const slotStepMinutes = Math.max(args.salon.slot_step_minutes ?? 30, 15);
  const now = new Date();
  const lookbackStart = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000);

  const [
    staffResult,
    targetAppointmentsResult,
    historyResult,
    futureAppointmentsResult,
    customersResult,
    servicesResult,
    alertsResult,
  ] = await Promise.all([
    args.supabase
      .from("staff_members")
      .select("id,name,is_active")
      .eq("salon_id", args.salon.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    args.supabase
      .from("appointments")
      .select("customer_id,date,ends_at,staff_member_id,status")
      .eq("salon_id", args.salon.id)
      .in("status", ["pending", "confirmed"])
      .gte("date", targetDayRange.start.toISOString())
      .lt("date", targetDayRange.end.toISOString())
      .order("date", { ascending: true }),
    args.supabase
      .from("appointments")
      .select(
        "customer_id,date,completed_at,status,service_id,staff_member_id,service_price_snapshot,services(name,category,price,duration),staff_members(name)",
      )
      .eq("salon_id", args.salon.id)
      .in("status", ["completed", "cancelled", "no_show"])
      .gte("date", lookbackStart.toISOString())
      .order("date", { ascending: false })
      .limit(2500),
    args.supabase
      .from("appointments")
      .select("customer_id,date")
      .eq("salon_id", args.salon.id)
      .in("status", ["pending", "confirmed"])
      .gte("date", now.toISOString())
      .lt("date", new Date(now.getTime() + 21 * 24 * 60 * 60 * 1000).toISOString())
      .limit(2500),
    args.supabase
      .from("customers")
      .select("id,name,phone,email")
      .eq("salon_id", args.salon.id)
      .order("name", { ascending: true }),
    args.supabase
      .from("services")
      .select("id,name,category,price,duration")
      .eq("salon_id", args.salon.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    args.supabase
      .from("salon_vacancy_alerts")
      .select("headline,starts_at,ends_at,services(name,category),staff_members(name)")
      .eq("salon_id", args.salon.id)
      .gte("starts_at", targetDayRange.start.toISOString())
      .lt("starts_at", targetDayRange.end.toISOString())
      .order("starts_at", { ascending: true })
      .limit(5),
  ]);

  if (staffResult.error) throw staffResult.error;
  if (targetAppointmentsResult.error) throw targetAppointmentsResult.error;
  if (historyResult.error) throw historyResult.error;
  if (futureAppointmentsResult.error) throw futureAppointmentsResult.error;
  if (customersResult.error) throw customersResult.error;
  if (servicesResult.error) throw servicesResult.error;
  if (alertsResult.error) throw alertsResult.error;

  const staffMembers = (staffResult.data ?? []) as StaffMemberRow[];
  if (!staffMembers.length) {
    return null;
  }

  const targetAppointments = (targetAppointmentsResult.data ?? []) as TargetDayAppointmentRow[];
  const historyAppointments = (historyResult.data ?? []) as HistoryAppointmentRow[];
  const futureAppointments = (futureAppointmentsResult.data ?? []) as Array<{
    customer_id: string | null;
    date: string;
  }>;
  const customerRows = (customersResult.data ?? []) as CustomerRow[];
  const services = (servicesResult.data ?? []) as ServiceRow[];
  const alerts = (alertsResult.data ?? []) as VacancyAlertRow[];
  const explicitService = findServiceMatchByQuestion(args.question, services);

  const scheduleContexts = await Promise.all(
    staffMembers.map(async (staffMember) => {
      const result = await args.supabase.rpc("get_staff_schedule_context", {
        target_day: targetDay.dayKey,
        target_staff_member_id: staffMember.id,
      });

      if (result.error) {
        throw result.error;
      }

      return {
        context: ((result.data ?? [])[0] ?? null) as StaffScheduleContextRow | null,
        staffMember,
      };
    }),
  );

  const windows = scheduleContexts.flatMap(({ context, staffMember }) => {
    if (!context?.is_open) {
      return [];
    }

    const professionalAppointments = targetAppointments.filter(
      (appointment) => appointment.staff_member_id === staffMember.id,
    );

    return buildFreeWindows({
      appointments: professionalAppointments,
      closesAtUtc: context.closes_at_utc,
      opensAtUtc: context.opens_at_utc,
      slotStepMinutes,
      staffMemberId: staffMember.id,
      staffMemberName: staffMember.name,
    });
  });

  const staffServiceCounters = new Map<
    string,
    Map<string, { category: string | null; count: number; name: string; price: number | null }>
  >();
  const globalServiceCounters = new Map<
    string,
    { category: string | null; count: number; name: string; price: number | null }
  >();
  const customerById = new Map(customerRows.map((customer) => [customer.id, customer]));
  const futureBookedCustomerIds = new Set(
    futureAppointments
      .map((appointment) => appointment.customer_id)
      .filter((value): value is string => Boolean(value)),
  );
  const customerHistory = new Map<
    string,
    {
      avgTicketTotal: number;
      cancellationCount: number;
      completedVisits: number;
      favoriteCategoryName: string | null;
      favoriteServiceId: string | null;
      favoriteServiceName: string | null;
      favoriteStaffId: string | null;
      favoriteStaffName: string | null;
      lastVisitAt: string | null;
      serviceCounters: Map<string, { count: number; name: string; serviceId: string | null }>;
      staffCounters: Map<string, { count: number; name: string }>;
      weekdayCounters: Map<string, number>;
    }
  >();

  for (const appointment of historyAppointments) {
    const service = firstRelation(appointment.services);
    const staffMember = firstRelation(appointment.staff_members);

    if (appointment.status === "completed") {
      if (appointment.staff_member_id && service?.name) {
        const staffServices =
          staffServiceCounters.get(appointment.staff_member_id) ?? new Map();
        const current = staffServices.get(service.name) ?? {
          category: cleanText(service.category, 80) || null,
          count: 0,
          name: service.name,
          price:
            typeof service.price === "number"
              ? service.price
              : Number(service.price ?? 0) || null,
        };
        current.count += 1;
        staffServices.set(service.name, current);
        staffServiceCounters.set(appointment.staff_member_id, staffServices);
      }

      if (service?.name) {
        const current = globalServiceCounters.get(service.name) ?? {
          category: cleanText(service.category, 80) || null,
          count: 0,
          name: service.name,
          price:
            typeof service.price === "number"
              ? service.price
              : Number(service.price ?? 0) || null,
        };
        current.count += 1;
        globalServiceCounters.set(service.name, current);
      }
    }

    if (!appointment.customer_id) {
      continue;
    }

    const current = customerHistory.get(appointment.customer_id) ?? {
      avgTicketTotal: 0,
      cancellationCount: 0,
      completedVisits: 0,
      favoriteCategoryName: null,
      favoriteServiceId: null,
      favoriteServiceName: null,
      favoriteStaffId: null,
      favoriteStaffName: null,
      lastVisitAt: null,
      serviceCounters: new Map(),
      staffCounters: new Map(),
      weekdayCounters: new Map(),
    };

    if (appointment.status === "completed") {
      current.completedVisits += 1;
      const amount = resolveBookedAppointmentAmount({
        servicePrice: service?.price,
        servicePriceSnapshot: appointment.service_price_snapshot,
      });
      current.avgTicketTotal += amount;

      const visitReference = appointment.completed_at ?? appointment.date;
      if (!current.lastVisitAt || current.lastVisitAt < visitReference) {
        current.lastVisitAt = visitReference;
      }

      if (service?.name) {
        const serviceKey = service.name;
        const serviceCounter = current.serviceCounters.get(serviceKey) ?? {
          count: 0,
          name: service.name,
          serviceId: appointment.service_id,
        };
        serviceCounter.count += 1;
        current.serviceCounters.set(serviceKey, serviceCounter);
        current.favoriteCategoryName = cleanText(service.category, 80) || current.favoriteCategoryName;
      }

      if (staffMember?.name && appointment.staff_member_id) {
        const staffCounter = current.staffCounters.get(appointment.staff_member_id) ?? {
          count: 0,
          name: staffMember.name,
        };
        staffCounter.count += 1;
        current.staffCounters.set(appointment.staff_member_id, staffCounter);
      }

      const weekdayKey = normalizeSearchText(
        new Intl.DateTimeFormat("pt-BR", {
          weekday: "long",
          timeZone,
        }).format(new Date(appointment.date)),
      );
      current.weekdayCounters.set(
        weekdayKey,
        (current.weekdayCounters.get(weekdayKey) ?? 0) + 1,
      );
    } else if (
      appointment.status === "cancelled" ||
      appointment.status === "no_show"
    ) {
      current.cancellationCount += 1;
    }

    customerHistory.set(appointment.customer_id, current);
  }

  for (const history of customerHistory.values()) {
    const favoriteService =
      [...history.serviceCounters.values()].sort((left, right) => right.count - left.count)[0] ??
      null;
    const favoriteStaff =
      [...history.staffCounters.entries()].sort((left, right) => right[1].count - left[1].count)[0] ??
      null;
    history.favoriteServiceId = favoriteService?.serviceId ?? null;
    history.favoriteServiceName = favoriteService?.name ?? null;
    history.favoriteStaffId = favoriteStaff?.[0] ?? null;
    history.favoriteStaffName = favoriteStaff?.[1].name ?? null;
  }

  const topWindow =
    [...windows].sort((left, right) => {
      if (right.slotCount !== left.slotCount) {
        return right.slotCount - left.slotCount;
      }

      return right.durationMinutes - left.durationMinutes;
    })[0] ?? null;

  const firstAlert = alerts[0] ?? null;
  const targetStaffName = firstAlert
    ? cleanText(firstRelation(firstAlert.staff_members)?.name, 80) || topWindow?.staffMemberName || "Equipe"
    : topWindow?.staffMemberName ?? "Equipe";
  const targetStaffId = topWindow?.staffMemberId ?? null;

  let targetService = explicitService;
  if (!targetService && targetStaffId) {
    const bestStaffService =
      [...(staffServiceCounters.get(targetStaffId)?.values() ?? [])].sort(
        (left, right) => right.count - left.count,
      )[0] ?? null;

    if (bestStaffService) {
      targetService =
        services.find(
          (service) =>
            normalizeSearchText(service.name) ===
            normalizeSearchText(bestStaffService.name),
        ) ?? null;
    }
  }

  if (!targetService) {
    const bestGlobalService =
      [...globalServiceCounters.values()].sort((left, right) => right.count - left.count)[0] ??
      null;

    if (bestGlobalService) {
      targetService =
        services.find(
          (service) =>
            normalizeSearchText(service.name) ===
            normalizeSearchText(bestGlobalService.name),
        ) ?? null;
    }
  }

  const alertService = cleanText(firstRelation(firstAlert?.services)?.name, 80);
  const targetServiceName =
    targetService?.name ??
    alertService ??
    cleanText(firstAlert?.headline, 80) ??
    "servico especial";
  const targetCategoryName =
    cleanText(firstRelation(firstAlert?.services)?.category, 80) ||
    targetService?.category ||
    null;
  const targetPrice =
    typeof targetService?.price === "number"
      ? targetService.price
      : Number(targetService?.price ?? 0) || null;
  const targetDuration = Math.max(targetService?.duration ?? slotStepMinutes, slotStepMinutes);

  const chosenStartAt = firstAlert?.starts_at ?? topWindow?.startAt ?? null;
  const chosenEndAt =
    firstAlert?.ends_at ??
    (topWindow
      ? new Date(new Date(topWindow.startAt).getTime() + targetDuration * 60000).toISOString()
      : null);

  if (!chosenStartAt || !chosenEndAt) {
    return null;
  }

  const windowLabel = `${formatTimeLabel(chosenStartAt, timeZone)} ate ${formatTimeLabel(chosenEndAt, timeZone)}`;
  const weekdayKey = normalizeSearchText(
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone,
    }).format(new Date(chosenStartAt)),
  );
  const weekdayLabel = cleanText(
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone,
    }).format(new Date(chosenStartAt)),
    60,
  );
  const openSlotsCount = firstAlert
    ? Math.max(1, Math.floor((new Date(chosenEndAt).getTime() - new Date(chosenStartAt).getTime()) / (targetDuration * 60000)))
    : Math.max(1, Math.floor((new Date(chosenEndAt).getTime() - new Date(chosenStartAt).getTime()) / (targetDuration * 60000)));

  const suggestions = [...customerHistory.entries()]
    .filter(([customerId, history]) => {
      if (futureBookedCustomerIds.has(customerId)) {
        return false;
      }

      return history.completedVisits > 0;
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
      const avgTicket =
        history.completedVisits > 0
          ? history.avgTicketTotal / history.completedVisits
          : 0;
      let score = 15;

      if (
        targetService?.id &&
        history.favoriteServiceId &&
        history.favoriteServiceId === targetService.id
      ) {
        score += 35;
      } else if (
        targetCategoryName &&
        history.favoriteCategoryName &&
        normalizeSearchText(history.favoriteCategoryName) ===
          normalizeSearchText(targetCategoryName)
      ) {
        score += 18;
      }

      if (
        targetStaffId &&
        history.favoriteStaffId &&
        history.favoriteStaffId === targetStaffId
      ) {
        score += 15;
      }

      if (daysSinceLastVisit != null) {
        if (daysSinceLastVisit >= 30 && daysSinceLastVisit <= 75) {
          score += 24;
        } else if (daysSinceLastVisit > 75 && daysSinceLastVisit <= 120) {
          score += 16;
        } else if (daysSinceLastVisit >= 15) {
          score += 8;
        }
      }

      const weekdayVisits = history.weekdayCounters.get(weekdayKey) ?? 0;
      if (weekdayVisits >= 2) {
        score += 10;
      } else if (weekdayVisits === 1) {
        score += 5;
      }

      if (targetPrice != null && avgTicket >= targetPrice * 0.85) {
        score += 10;
      }

      if (history.cancellationCount >= 2) {
        score -= 12;
      } else if (history.cancellationCount === 1) {
        score -= 5;
      }

      score = Math.max(1, Math.min(99, score));

      return {
        avgTicket,
        cancellationCount: history.cancellationCount,
        completedVisits: history.completedVisits,
        customerId,
        customerName: customer?.name ?? "Cliente sem nome",
        daysSinceLastVisit,
        favoriteCategoryName: history.favoriteCategoryName,
        favoriteServiceId: history.favoriteServiceId,
        favoriteServiceName: history.favoriteServiceName,
        favoriteStaffId: history.favoriteStaffId,
        favoriteStaffName: history.favoriteStaffName,
        lastVisitAt: history.lastVisitAt,
        sameWeekdayVisits: weekdayVisits,
        score,
        scoreLabel: scoreToChanceLabel(score),
        suggestionReason: buildCandidateReason({
          candidate: {
            daysSinceLastVisit,
            favoriteServiceName: history.favoriteServiceName,
            favoriteStaffName: history.favoriteStaffName,
            sameWeekdayVisits: weekdayVisits,
          },
          targetServiceName,
          targetStaffName,
          weekdayLabel,
        }),
      } satisfies OpportunityCandidate;
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }

      const leftDays = left.daysSinceLastVisit ?? -1;
      const rightDays = right.daysSinceLastVisit ?? -1;
      return rightDays - leftDays;
    })
    .slice(0, 12);

  const topChanceLabel = suggestions[0]?.scoreLabel ?? "Media";

  return {
    dayKey: targetDay.dayKey,
    dayLabel: targetDay.label,
    openSlotsCount,
    serviceCategoryName: targetCategoryName,
    serviceName: targetServiceName,
    servicePrice: targetPrice,
    staffName: targetStaffName,
    suggestions,
    topChanceLabel,
    windowEndAt: chosenEndAt,
    windowLabel,
    windowStartAt: chosenStartAt,
  };
}

export async function getRecoveryCampaignSnapshot(
  args: RecoveryCampaignArgs,
): Promise<RecoveryCampaignSnapshot> {
  const opportunity = await buildRecoveryOpportunity(args);

  if (!opportunity) {
    return {
      available: false,
      candidateCount: 0,
      dayLabel: null,
      headline: "Sem campanha inteligente agora",
      highChanceCount: 0,
      openSlotsCount: 0,
      serviceName: null,
      staffName: null,
      summary:
        "Quando houver janela ociosa real, a IA cruza clientes e monta a melhor acao para preencher a agenda.",
      topChanceLabel: null,
      windowLabel: null,
    };
  }

  return {
    available: true,
    candidateCount: opportunity.suggestions.length,
    dayLabel: opportunity.dayLabel,
    headline: `${opportunity.openSlotsCount} horario(s) ocioso(s) detectado(s) em ${opportunity.dayLabel}`,
    highChanceCount: opportunity.suggestions.filter(
      (candidate) => candidate.score >= 80,
    ).length,
    openSlotsCount: opportunity.openSlotsCount,
    serviceName: opportunity.serviceName,
    staffName: opportunity.staffName,
    summary:
      `${opportunity.staffName} tem ${opportunity.windowLabel} com foco em ${opportunity.serviceName}. ` +
      `${opportunity.suggestions.length} cliente(s) entram na lista sugerida e a chance dominante esta em ${opportunity.topChanceLabel.toLowerCase()}.`,
    topChanceLabel: opportunity.topChanceLabel,
    windowLabel: opportunity.windowLabel,
  };
}

function buildFallbackDraft(args: {
  opportunity: RecoveryOpportunity;
  promotionDraft: Awaited<ReturnType<typeof generatePromotionDraftWithAi>>;
}) {
  const priceLabel =
    args.promotionDraft.priceSuggestion != null
      ? formatCurrency(args.promotionDraft.priceSuggestion)
      : "condicao especial";
  const discountLabel =
    args.opportunity.servicePrice != null &&
    args.promotionDraft.priceSuggestion != null &&
    args.promotionDraft.priceSuggestion < args.opportunity.servicePrice
      ? `${Math.max(
          5,
          Math.round(
            ((args.opportunity.servicePrice - args.promotionDraft.priceSuggestion) /
              args.opportunity.servicePrice) *
              100,
          ),
        )}% de ajuste`
      : "condicao relampago";

  return {
    campaignName: args.promotionDraft.title,
    discountLabel,
    instagramCaption:
      `${args.promotionDraft.highlightText} ${args.promotionDraft.description} ` +
      `Chamada para ${args.opportunity.dayLabel}, ${args.opportunity.windowLabel}, com ${args.opportunity.staffName}.`,
    model: `${getOpenRouterModel()} (fallback)`,
    priceSuggestion: args.promotionDraft.priceSuggestion,
    strategyBullets: [
      `Ative a campanha para ${args.opportunity.dayLabel} entre ${args.opportunity.windowLabel}.`,
      `Priorize ${args.opportunity.suggestions.filter((candidate) => candidate.score >= 80).length} cliente(s) com chance alta de retorno.`,
      `Use ${args.opportunity.serviceName} como ancora e confirme tudo antes de publicar ou disparar.`,
    ],
    whatsappText:
      `Oi! Abrimos alguns horarios especiais ${args.opportunity.dayLabel} ` +
      `entre ${args.opportunity.windowLabel} com ${args.opportunity.staffName} para ${args.opportunity.serviceName} ` +
      `por ${priceLabel}. Quer aproveitar e reservar seu horario?`,
  } satisfies RecoveryCampaignDraft;
}

function parseRecoveryDraftJson(raw: string) {
  const candidates = [
    raw.trim(),
    raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/```([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        campaignName?: unknown;
        discountLabel?: unknown;
        instagramCaption?: unknown;
        strategyBullets?: unknown;
        whatsappText?: unknown;
      };

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // keep trying
    }
  }

  return null;
}

export async function generateRecoveryCampaign(
  args: RecoveryCampaignArgs,
): Promise<RecoveryCampaignResult> {
  const opportunity = await buildRecoveryOpportunity(args);

  if (!opportunity) {
    return {
      available: false,
      candidates: [],
      ctaHref: "/dashboard/gestao/agendamentos",
      ctaLabel: "Abrir agenda",
      draft: null,
      followUp:
        "Quando surgir janela ociosa real ou cancelamento com vaga aberta, eu monto a campanha para revisao humana.",
      snapshot: {
        available: false,
        candidateCount: 0,
        dayLabel: null,
        headline: "Sem campanha inteligente agora",
        highChanceCount: 0,
        openSlotsCount: 0,
        serviceName: null,
        staffName: null,
        summary:
          "Ainda nao existe combinacao forte de ociosidade e base para sugerir campanha de preenchimento.",
        topChanceLabel: null,
        windowLabel: null,
      },
    };
  }

  const promotionDraft = await generatePromotionDraftWithAi({
    goal: `preencher agenda em ${opportunity.dayLabel}`,
    kind: "promotion",
    notes: [
      `Janela vazia: ${opportunity.windowLabel}.`,
      `Profissional foco: ${opportunity.staffName}.`,
      `Servico foco: ${opportunity.serviceName}.`,
      `${opportunity.suggestions.length} clientes sugeridos.`,
      "Nao envie automaticamente. Entregue rascunho premium para revisao humana.",
    ].join(" "),
    priceHint:
      opportunity.servicePrice != null
        ? Number((opportunity.servicePrice * 0.9).toFixed(2))
        : null,
    requestOrigin: args.requestOrigin,
    salonName: args.salon.name,
    serviceName: opportunity.serviceName,
  });

  let draft = buildFallbackDraft({ opportunity, promotionDraft });

  if (isOpenRouterEnabled() && !promotionDraft.model.includes("(fallback)")) {
    try {
      const systemPrompt = buildRecoveryCampaignSystemPrompt({
        candidateCount: opportunity.suggestions.length,
      });
      const userPrompt = buildRecoveryCampaignUserPrompt({
        campaignDescription: `${promotionDraft.highlightText} ${promotionDraft.description}`,
        campaignTitle: promotionDraft.title,
        candidateLines: opportunity.suggestions
          .slice(0, 5)
          .map(
            (candidate) =>
              `${candidate.customerName} (${candidate.scoreLabel}, ${candidate.suggestionReason})`,
          ),
        dayLabel: opportunity.dayLabel,
        priceLabel:
          opportunity.servicePrice != null
            ? formatCurrency(opportunity.servicePrice)
            : "nao informado",
        priceSuggestionLabel:
          promotionDraft.priceSuggestion != null
            ? formatCurrency(promotionDraft.priceSuggestion)
            : "nao informar",
        salonName: cleanText(args.salon.name, 80),
        serviceName: opportunity.serviceName,
        staffName: opportunity.staffName,
        windowLabel: opportunity.windowLabel,
      });
      const { model, text } = await createOpenRouterChatCompletion({
        feature: AI_FEATURE_REGISTRY.recoveryCampaign.feature,
        maxTokens: 360,
        requestOrigin: args.requestOrigin,
        temperature: 0.55,
        timeoutMs: 6_000,
        messages: [
          {
            role: "system",
            content: systemPrompt,
          },
          {
            role: "user",
            content: userPrompt,
          },
        ],
      });

      const parsed = parseRecoveryDraftJson(text);
      if (parsed) {
        const strategyBullets = Array.isArray(parsed.strategyBullets)
          ? parsed.strategyBullets
              .filter((item): item is string => typeof item === "string")
              .map((item) => cleanText(item, 120))
              .filter(Boolean)
              .slice(0, 4)
          : draft.strategyBullets;

        draft = {
          campaignName:
            cleanText(
              typeof parsed.campaignName === "string"
                ? parsed.campaignName
                : draft.campaignName,
              80,
            ) || draft.campaignName,
          discountLabel:
            cleanText(
              typeof parsed.discountLabel === "string"
                ? parsed.discountLabel
                : draft.discountLabel,
              80,
            ) || draft.discountLabel,
          instagramCaption:
            cleanText(
              typeof parsed.instagramCaption === "string"
                ? parsed.instagramCaption
                : draft.instagramCaption,
              420,
            ) || draft.instagramCaption,
          model,
          priceSuggestion: promotionDraft.priceSuggestion,
          strategyBullets:
            strategyBullets.length > 0 ? strategyBullets : draft.strategyBullets,
          whatsappText:
            cleanText(
              typeof parsed.whatsappText === "string"
                ? parsed.whatsappText
                : draft.whatsappText,
              420,
            ) || draft.whatsappText,
        };
      }
    } catch {
      // keep fallback draft
    }
  }

  return {
    available: true,
    candidates: opportunity.suggestions.map((candidate) => ({
      avgTicketLabel: formatCurrency(candidate.avgTicket),
      chanceLabel: candidate.scoreLabel,
      customerId: candidate.customerId,
      daysSinceLastVisitLabel: formatDaysSinceLabel(candidate.daysSinceLastVisit),
      name: candidate.customerName,
      reasonLabel: candidate.suggestionReason,
      score: candidate.score,
    })),
    ctaHref: "/dashboard/benefits/promotions?compose=1",
    ctaLabel: "Abrir promocoes",
    draft,
    followUp:
      "Revise a campanha, ajuste o desconto e escolha se vai publicar no app, usar no WhatsApp ou transformar em story.",
    snapshot: {
      available: true,
      candidateCount: opportunity.suggestions.length,
      dayLabel: opportunity.dayLabel,
      headline: `${opportunity.openSlotsCount} horario(s) ocioso(s) detectado(s) em ${opportunity.dayLabel}`,
      highChanceCount: opportunity.suggestions.filter(
        (candidate) => candidate.score >= 80,
      ).length,
      openSlotsCount: opportunity.openSlotsCount,
      serviceName: opportunity.serviceName,
      staffName: opportunity.staffName,
      summary:
        `${opportunity.staffName} tem ${opportunity.windowLabel} com foco em ${opportunity.serviceName}. ` +
        `${opportunity.suggestions.length} cliente(s) entram na lista sugerida e a chance dominante esta em ${opportunity.topChanceLabel.toLowerCase()}.`,
      topChanceLabel: opportunity.topChanceLabel,
      windowLabel: opportunity.windowLabel,
    },
  };
}
