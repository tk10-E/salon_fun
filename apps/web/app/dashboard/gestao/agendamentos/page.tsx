import Image from "next/image";
import { redirect } from "next/navigation";

import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import {
  createManagementAppointmentAction,
  reprocessManagementMembershipPlanAction,
  updateManagementAppointmentAction,
  updateManagementAppointmentStatusAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import {
  APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS,
  APPOINTMENT_STATUS_OPTIONS,
  buildFilterHref,
  formatAppointmentPaymentPreferenceLabel,
  formatAppointmentStatusLabel,
  formatPaymentMethodLabel,
  formatTimeInput,
  getAppointmentStatusBadgeClass,
  getLocalDateKey,
  loadManagementAppointments,
  loadManagementAppointmentsMonth,
  loadManagementAppointmentsWeek,
  loadManagementStaleAppointments,
  loadManagementSelectOptions,
  resolveManagementAgendaDisplayDay,
  type ManagementAppointmentItem,
} from "@/lib/management";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

import styles from "./page.module.css";

type AgendamentosPageProps = {
  searchParams?: Promise<{
    day?: string;
    composer?: string;
    professionalId?: string;
    status?: string;
    view?: string;
    message?: string;
    tone?: string;
  }>;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type AgendaViewMode = "day" | "week" | "month";

function customerInitials(value: string) {
  const initials = value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  return initials || "CL";
}

function compactCalendarName(value: string, mode: "customer" | "professional") {
  const parts = value.trim().split(/\s+/).filter(Boolean);

  if (!parts.length) {
    return mode === "customer" ? "App do cliente" : "Profissional";
  }

  if (mode === "customer") {
    const [first = "", second = ""] = parts;

    if (!second) {
      return first;
    }

    const firstPlusSecond = `${first} ${second}`;
    if (firstPlusSecond.length <= 18) {
      return firstPlusSecond;
    }

    return `${first} ${second[0]?.toUpperCase() ?? ""}.`;
  }

  return parts[0] ?? "Profissional";
}

function toSafeNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function capitalizeLabel(value: string) {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function normalizeAgendaView(value?: string): AgendaViewMode {
  switch (value) {
    case "week":
      return "week";
    case "month":
      return "month";
    case "day":
      return "day";
    default:
      return "day";
  }
}

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toDayKey(value: Date) {
  return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(
    2,
    "0",
  )}-${String(value.getUTCDate()).padStart(2, "0")}`;
}

function shiftMonth(dayKey: string, offset: number) {
  const [year, month] = dayKey.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1 + offset, 1, 12));
  return toDayKey(next);
}

function getMondayWeekdayIndex(value: Date) {
  return (value.getUTCDay() + 6) % 7;
}

function buildMonthGrid(monthKey: string) {
  const firstDay = parseDayKey(`${monthKey}-01`);
  const monthIndex = firstDay.getUTCMonth();
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - getMondayWeekdayIndex(firstDay));

  const lastDay = new Date(
    Date.UTC(firstDay.getUTCFullYear(), monthIndex + 1, 0, 12),
  );
  const gridEnd = new Date(lastDay);
  gridEnd.setUTCDate(lastDay.getUTCDate() + (6 - getMondayWeekdayIndex(lastDay)));

  const days: Array<{ dayKey: string; dayNumber: number; inMonth: boolean }> =
    [];

  for (
    let cursor = new Date(gridStart);
    cursor <= gridEnd;
    cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const current = new Date(cursor);
    days.push({
      dayKey: toDayKey(current),
      dayNumber: current.getUTCDate(),
      inMonth: current.getUTCMonth() === monthIndex,
    });
  }

  return days;
}

function formatMonthLabel(monthKey: string, timeZone: string) {
  return capitalizeLabel(
    new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone,
    }).format(parseDayKey(`${monthKey}-01`)),
  );
}

function formatCompactDateTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone,
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(",", " as");
}

function formatCustomerContactLine(appointment: {
  customerEmail?: string | null;
  customerPhone?: string | null;
}) {
  return (
    [appointment.customerPhone, appointment.customerEmail]
      .filter(Boolean)
      .join(" - ") || "Sem contato principal informado"
  );
}

function formatAgendaDaySummary(dayKey: string, timeZone: string) {
  return capitalizeLabel(
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "2-digit",
      timeZone,
    }).format(parseDayKey(dayKey)),
  );
}

function formatOverdueWindow(endsAt: string) {
  const diffMs = Date.now() - new Date(endsAt).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays >= 1) {
    return `Encerrado há ${diffDays} dia${diffDays > 1 ? "s" : ""}`;
  }

  return `Encerrado há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
}

function isFinalAppointmentStatus(status: ManagementAppointmentItem["status"]) {
  return (
    status === "completed" || status === "cancelled" || status === "no_show"
  );
}

function hasAppointmentEnded(appointment: { ends_at: string }) {
  return new Date(appointment.ends_at).getTime() <= Date.now();
}

function formatCustomerRegistrationOrigin(appointment: {
  customerEmail?: string | null;
  customerPhone?: string | null;
}) {
  return appointment.customerPhone || appointment.customerEmail
    ? "Veio do app do cliente"
    : "Cadastro sem contato principal";
}

function formatAppointmentWindowLine(
  appointment: {
    date: string;
    ends_at: string;
    professionalName: string;
  },
  timeZone: string,
) {
  return `${formatTimeInput(appointment.date, timeZone)} - ${formatTimeInput(
    appointment.ends_at,
    timeZone,
  )} - ${appointment.professionalName}`;
}

function getPresenceSummary(appointment: {
  customer_confirmation_requested_at?: string | null;
  customer_presence_confirmed_at?: string | null;
  protection_confirmation_required?: boolean | null;
}) {
  if (appointment.customer_presence_confirmed_at) {
    return {
      badgeClass: "badge--confirmed",
      label: "Presença confirmada",
    };
  }

  if (appointment.customer_confirmation_requested_at) {
    return {
      badgeClass: "badge--pending",
      label: "Aguardando cliente",
    };
  }

  if (appointment.protection_confirmation_required) {
    return {
      badgeClass: "badge--soft",
      label: "Confirmação pendente",
    };
  }

  return {
    badgeClass: "badge--soft",
    label: "Confirmação não necessária",
  };
}

function getDepositSummary(appointment: {
  deposit_amount?: number | string | null;
  deposit_status?: string | null;
}) {
  const depositAmount = toSafeNumber(appointment.deposit_amount);

  switch (appointment.deposit_status) {
    case "pending":
      return {
        badgeClass: "badge--pending",
        label: depositAmount
          ? `Sinal pendente - ${formatCurrency(depositAmount)}`
          : "Sinal pendente",
      };
    case "received":
      return {
        badgeClass: "badge--confirmed",
        label: depositAmount
          ? `Sinal pago - ${formatCurrency(depositAmount)}`
          : "Sinal pago",
      };
    case "waived":
      return {
        badgeClass: "badge--soft",
        label: "Sinal dispensado",
      };
    case "refunded":
      return {
        badgeClass: "badge--soft",
        label: "Sinal devolvido",
      };
    case "not_required":
      return {
        badgeClass: "badge--soft",
        label: "Sem sinal exigido",
      };
    default:
      return {
        badgeClass: "badge--soft",
        label: "Sem sinal exigido",
      };
  }
}

function formatDepositReportedLine(
  appointment: {
    deposit_customer_reported_paid_at?: string | null;
    deposit_customer_reported_paid_via?: string | null;
    deposit_customer_reported_reference?: string | null;
  },
  timeZone: string,
) {
  if (!appointment.deposit_customer_reported_paid_at) {
    return null;
  }

  const paymentViaMap: Record<string, string> = {
    manual: "manual",
    pix: "Pix",
    external_checkout: "checkout",
  };
  const paymentVia =
    paymentViaMap[appointment.deposit_customer_reported_paid_via ?? ""] ??
    "pagamento";
  const referenceLabel = appointment.deposit_customer_reported_reference
    ? ` - ref. ${appointment.deposit_customer_reported_reference}`
    : "";

  return `Cliente informou sinal via ${paymentVia} em ${formatCompactDateTime(
    appointment.deposit_customer_reported_paid_at,
    timeZone,
  )}${referenceLabel}`;
}

function hasClientAppPaymentSignal(appointment: ManagementAppointmentItem) {
  return Boolean(
    appointment.payment_preference ||
      appointment.deposit_customer_reported_paid_at,
  );
}

function getCustomerAppSignalTags(appointment: ManagementAppointmentItem) {
  const tags: string[] = [];

  if (appointment.customer_presence_confirmed_at) {
    tags.push("Cliente confirmou");
  } else if (appointment.customer_confirmation_requested_at) {
    tags.push("Confirmação enviada");
  }

  if (appointment.payment_preference) {
    tags.push(
      `Prefere ${formatAppointmentPaymentPreferenceLabel(
        appointment.payment_preference,
      )}`,
    );
  }

  if (appointment.deposit_customer_reported_paid_at) {
    tags.push("Cliente informou sinal");
  }

  if (appointment.protection_confirmation_required) {
    tags.push("Reserva protegida");
  }

  return tags.length ? tags : ["Sem retorno novo no app"];
}

function getCustomerControlNote(
  appointment: ManagementAppointmentItem,
  timeZone: string,
) {
  const depositReportedLine = formatDepositReportedLine(appointment, timeZone);

  if (appointment.customer_presence_confirmed_at) {
    return `Cliente confirmou em ${formatCompactDateTime(
      appointment.customer_presence_confirmed_at,
      timeZone,
    )}.`;
  }

  if (depositReportedLine) {
    return depositReportedLine;
  }

  if (appointment.customer_confirmation_requested_at) {
    return `Confirmação enviada em ${formatCompactDateTime(
      appointment.customer_confirmation_requested_at,
      timeZone,
    )}.`;
  }

  if (appointment.payment_preference) {
    return `Cliente prefere ${formatAppointmentPaymentPreferenceLabel(
      appointment.payment_preference,
    )}.`;
  }

  return "Sem resposta nova da cliente no app até agora.";
}

function getCalendarChipTone(status: ManagementAppointmentItem["status"]) {
  switch (status) {
    case "confirmed":
      return styles.calendarChipConfirmed;
    case "pending":
      return styles.calendarChipPending;
    case "completed":
      return styles.calendarChipCompleted;
    case "cancelled":
    case "no_show":
      return styles.calendarChipCancelled;
    default:
      return styles.calendarChipSoft;
  }
}

const CALENDAR_TONE_CLASSES = [
  styles.calendarToneBlue,
  styles.calendarToneGold,
  styles.calendarToneViolet,
  styles.calendarToneCoral,
  styles.calendarToneCyan,
];

function getCalendarPaletteClass(
  appointment: ManagementAppointmentItem,
  index: number,
) {
  const seed = `${appointment.id}-${appointment.customerName}-${appointment.serviceName}`;
  let hash = 0;

  for (let cursor = 0; cursor < seed.length; cursor += 1) {
    hash = (hash * 31 + seed.charCodeAt(cursor)) % 997;
  }

  const paletteIndex = Math.abs(hash + index) % CALENDAR_TONE_CLASSES.length;
  return CALENDAR_TONE_CLASSES[paletteIndex] ?? styles.calendarToneBlue;
}

function formatCalendarRangeLabel(
  startDayKey: string,
  endDayKey: string,
  timeZone: string,
) {
  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone,
  });

  const startLabel = formatter.format(parseDayKey(startDayKey)).replace(".", "");
  const endLabel = formatter.format(parseDayKey(endDayKey)).replace(".", "");
  return `${startLabel} → ${endLabel}`;
}

function buildCalendarChipPrimaryLabel(
  appointment: ManagementAppointmentItem,
  timeZone: string,
) {
  const shortCustomerName = compactCalendarName(
    appointment.customerName,
    "customer",
  );
  if (appointment.isMembershipPlanAppointment) {
    const professionalShort = compactCalendarName(
      appointment.professionalName,
      "professional",
    );
    return `PL ${formatTimeInput(appointment.date, timeZone)} ${shortCustomerName} - ${professionalShort}`;
  }

  return `${formatTimeInput(appointment.date, timeZone)} ${shortCustomerName}`;
}

function buildCalendarChipHeadline(
  appointment: ManagementAppointmentItem,
  _timeZone: string,
) {
  const shortCustomerName = compactCalendarName(appointment.customerName, "customer");
  return appointment.serviceName?.trim()
    ? `${shortCustomerName} • ${appointment.serviceName}`
    : shortCustomerName;
}

function buildCalendarChipMetaLabel(
  appointment: ManagementAppointmentItem,
  timeZone: string,
) {
  const professionalShort = compactCalendarName(
    appointment.professionalName,
    "professional",
  );
  const timeLabel = formatTimeInput(appointment.date, timeZone);

  if (
    appointment.isMembershipPlanAppointment &&
    appointment.membershipSessionIndex &&
    appointment.membershipSessionsIncluded
  ) {
    return `${timeLabel} • ${professionalShort} • Plano ${appointment.membershipSessionIndex}/${appointment.membershipSessionsIncluded}`;
  }

  if (appointment.isMembershipPlanAppointment) {
    return `${timeLabel} • ${professionalShort} • Plano`;
  }

  return `${timeLabel} • ${professionalShort}`;
}

function formatAppointmentKindLabel(appointment: ManagementAppointmentItem) {
  if (
    appointment.isMembershipPlanAppointment &&
    appointment.membershipSessionIndex &&
    appointment.membershipSessionsIncluded
  ) {
    return `Plano ${appointment.membershipSessionIndex}/${appointment.membershipSessionsIncluded}`;
  }

  if (appointment.isMembershipPlanAppointment) {
    return "Plano";
  }

  return "Agenda normal";
}

function buildWeekDays(dayKey: string) {
  const reference = parseDayKey(dayKey);
  const weekStart = new Date(reference);
  weekStart.setUTCDate(reference.getUTCDate() - getMondayWeekdayIndex(reference));

  return Array.from({ length: 7 }, (_, index) => {
    const current = new Date(weekStart);
    current.setUTCDate(weekStart.getUTCDate() + index);

    return {
      dayKey: toDayKey(current),
      dayNumber: current.getUTCDate(),
    };
  });
}

function formatWeekRangeLabel(dayKeys: string[], timeZone: string) {
  const firstDay = dayKeys[0];
  const lastDay = dayKeys[dayKeys.length - 1];

  if (!firstDay || !lastDay) {
    return "";
  }

  const formatter = new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
  });

  return `${formatter.format(parseDayKey(firstDay))} até ${formatter.format(
    parseDayKey(lastDay),
  )}`;
}

function buildCalendarChipTitle(
  appointment: ManagementAppointmentItem,
  timeZone: string,
) {
  const sessionLabel =
    appointment.isMembershipPlanAppointment &&
    appointment.membershipSessionIndex &&
    appointment.membershipSessionsIncluded
      ? ` - Sessão ${appointment.membershipSessionIndex}/${appointment.membershipSessionsIncluded}`
      : "";
  const planLabel =
    appointment.isMembershipPlanAppointment && appointment.membershipPlanTitle
      ? `Plano - ${appointment.membershipPlanTitle} - `
      : appointment.isMembershipPlanAppointment
        ? "Plano - "
        : "";
  const contactLabel = appointment.customerPhone
    ? ` - tel. ${appointment.customerPhone}`
    : appointment.customerEmail
      ? ` - ${appointment.customerEmail}`
      : "";

  return `${planLabel}${formatTimeInput(appointment.date, timeZone)} - ${appointment.customerName} com ${appointment.professionalName}${contactLabel}${sessionLabel}`;
}

export default async function AgendamentosPage({
  searchParams: searchParamsPromise,
}: AgendamentosPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const hasExplicitDay =
    Boolean(searchParams?.day) &&
    /^\d{4}-\d{2}-\d{2}$/.test(searchParams?.day ?? "");
  const requestedDay = hasExplicitDay
    ? (searchParams?.day as string)
    : getLocalDateKey(new Date(), timeZone);
  const selectedProfessionalId = searchParams?.professionalId ?? "";
  const selectedStatus = searchParams?.status ?? "";
  const selectedView = normalizeAgendaView(searchParams?.view);
  const appointmentComposerOpen = searchParams?.composer === "new";
  const selectedMonthKey = requestedDay.slice(0, 7);

  const returnPath = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      message: undefined,
      tone: undefined,
    },
  );

  const [monthlyAppointmentsData, staleAppointmentsData, options] =
    await Promise.all([
      loadManagementAppointmentsMonth({
        salonId: salon.id,
        timeZone,
        monthKey: selectedMonthKey,
        professionalId: selectedProfessionalId || undefined,
        status: selectedStatus || undefined,
      }),
      loadManagementStaleAppointments({
        salonId: salon.id,
        professionalId: selectedProfessionalId || undefined,
      }),
      loadManagementSelectOptions(salon.id, {
        categories: false,
        serviceFormCategories: false,
        services: true,
        professionals: true,
        clients: true,
      }),
    ]);
  const selectedDay = resolveManagementAgendaDisplayDay({
    requestedDay,
    appointments: monthlyAppointmentsData.items,
    timeZone,
  });
  const smartAgendaHref = `${MANAGEMENT_ROUTES.smartAgenda}?day=${selectedDay}`;

  if (!hasExplicitDay && selectedDay !== requestedDay) {
    redirect(
      buildFilterHref("/dashboard/gestao/agendamentos", searchParams, {
        day: selectedDay,
        message: undefined,
        tone: undefined,
      }),
    );
  }

  const [appointmentsData, weekAppointmentsData] = await Promise.all([
    loadManagementAppointments({
      salonId: salon.id,
      timeZone,
      dayKey: selectedDay,
      professionalId: selectedProfessionalId || undefined,
      status: selectedStatus || undefined,
    }),
    loadManagementAppointmentsWeek({
      salonId: salon.id,
      timeZone,
      dayKey: selectedDay,
      professionalId: selectedProfessionalId || undefined,
      status: selectedStatus || undefined,
    }),
  ]);

  const selectedProfessionalLabel =
    options.professionals.find((item) => item.id === selectedProfessionalId)
      ?.label ?? "Toda a equipe";
  const selectedStatusLabel =
    APPOINTMENT_STATUS_OPTIONS.find((item) => item.value === selectedStatus)
      ?.label ?? "Todos os status";
  const selectedDayLabel = capitalizeLabel(
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone,
    }).format(parseDayKey(selectedDay)),
  );
  const monthLabel = formatMonthLabel(selectedMonthKey, timeZone);
  const currentMonthAppointments = monthlyAppointmentsData.items;
  const projectedRevenueDay = appointmentsData.items.reduce(
    (total, appointment) =>
      appointment.status === "cancelled" ||
      appointment.status === "no_show" ||
      appointment.isMembershipPlanAppointment
        ? total
        : total + appointment.servicePrice,
    0,
  );
  const projectedRevenueMonth = currentMonthAppointments.reduce(
    (total, appointment) =>
      appointment.status === "cancelled" ||
      appointment.status === "no_show" ||
      appointment.isMembershipPlanAppointment
        ? total
        : total + appointment.servicePrice,
    0,
  );
  const paidRevenueDay = appointmentsData.items.reduce(
    (total, appointment) => total + (appointment.payment?.amount ?? 0),
    0,
  );
  const completedAppointmentsDay = appointmentsData.items.filter(
    (appointment) => appointment.status === "completed",
  );
  const latestCompletedAppointment =
    completedAppointmentsDay[completedAppointmentsDay.length - 1] ?? null;
  const completedUnpaidAppointmentsDay = appointmentsData.items.filter(
    (appointment) =>
      appointment.status === "completed" &&
      !appointment.isMembershipPlanAppointment &&
      !appointment.payment,
  );
  const completedUnpaidAppointmentsMonth = currentMonthAppointments.filter(
    (appointment) =>
      appointment.status === "completed" &&
      !appointment.isMembershipPlanAppointment &&
      !appointment.payment,
  );
  const occupiedDaysCount = new Set(
    currentMonthAppointments.map((appointment) =>
      getLocalDateKey(appointment.date, timeZone),
    ),
  ).size;
  const occupiedWeekDaysCount = new Set(
    weekAppointmentsData.items.map((appointment) =>
      getLocalDateKey(appointment.date, timeZone),
    ),
  ).size;
  const nextOpenAppointment =
    appointmentsData.items.find(
      (appointment) =>
        appointment.status === "pending" || appointment.status === "confirmed",
    ) ?? null;
  const selectedMonthStart = parseDayKey(`${selectedMonthKey}-01`);
  const selectedMonthEnd = new Date(
    Date.UTC(
      selectedMonthStart.getUTCFullYear(),
      selectedMonthStart.getUTCMonth() + 1,
      0,
      12,
    ),
  );
  const selectedMonthEndKey = toDayKey(selectedMonthEnd);
  const dayFocusSummary = nextOpenAppointment
    ? `Próximo horário: ${formatTimeInput(
        nextOpenAppointment.date,
        timeZone,
      )} com ${nextOpenAppointment.customerName}.`
    : latestCompletedAppointment
      ? `Último atendimento: ${formatTimeInput(
          latestCompletedAppointment.date,
          timeZone,
        )} com ${latestCompletedAppointment.customerName}.`
      : "Nenhum atendimento neste dia.";
  const dayAppointmentsPreview = appointmentsData.items.slice(0, 3);
  const staleAppointments = staleAppointmentsData.items;
  const selectedDayPendingClosureCount = appointmentsData.items.filter(
    (appointment) =>
      !isFinalAppointmentStatus(appointment.status) &&
      hasAppointmentEnded(appointment),
  ).length;
  const staleDisplayedPresenceCount = staleAppointments.filter(
    (appointment) => Boolean(appointment.customer_presence_confirmed_at),
  ).length;
  const staleDisplayedPaymentAlignedCount = staleAppointments.filter(
    (appointment) => hasClientAppPaymentSignal(appointment),
  ).length;
  const staleDisplayedDepositReportedCount = staleAppointments.filter(
    (appointment) => Boolean(appointment.deposit_customer_reported_paid_at),
  ).length;
  const stalePanelTitle = staleAppointmentsData.total
    ? `${staleAppointmentsData.total} horário${
        staleAppointmentsData.total > 1 ? "s" : ""
      } para fechar`
    : "Tudo fechado";
  const stalePanelDescription = staleAppointmentsData.total
    ? staleAppointmentsData.total > staleAppointments.length
      ? `Mostrando os ${staleAppointments.length} mais antigos em aberto para o salão agir agora.`
      : "Feche ou marque falta com base no retorno real da cliente no app."
    : "Nenhum atendimento antigo ficou sem status final.";
  const resolvedDayFocusSummary = selectedDayPendingClosureCount
    ? `Existem ${selectedDayPendingClosureCount} horário${
        selectedDayPendingClosureCount > 1 ? "s" : ""
      } deste dia para fechar no painel.`
    : dayFocusSummary;
  const financeAttentionDayCount = completedUnpaidAppointmentsDay.length;
  const financeAttentionMonthCount = completedUnpaidAppointmentsMonth.length;
  const financeAttentionItems =
    completedUnpaidAppointmentsDay.length > 0
      ? completedUnpaidAppointmentsDay.slice(0, 3)
      : completedUnpaidAppointmentsMonth.slice(0, 3);
  const financeAttentionHref = buildFilterHref(
    "/dashboard/gestao/pagamentos",
    undefined,
    financeAttentionDayCount > 0
      ? {
          dateFrom: selectedDay,
          dateTo: selectedDay,
        }
      : {
          dateFrom: `${selectedMonthKey}-01`,
          dateTo: selectedMonthEndKey,
        },
  );
  const financeAttentionTitle =
    financeAttentionDayCount > 0
      ? `${financeAttentionDayCount} pagamento${
          financeAttentionDayCount > 1 ? "s" : ""
        } pendente${financeAttentionDayCount > 1 ? "s" : ""} hoje`
      : financeAttentionMonthCount > 0
        ? `${financeAttentionMonthCount} pagamento${
            financeAttentionMonthCount > 1 ? "s" : ""
          } pendente${financeAttentionMonthCount > 1 ? "s" : ""} no mês`
        : "Caixa em dia";
  const financeAttentionDescription =
    financeAttentionDayCount > 0
      ? "Há atendimento concluído sem pagamento registrado. Revise antes de fechar o caixa."
      : financeAttentionMonthCount > 0
        ? "Há atendimento concluído no mês sem pagamento registrado."
        : "Agenda e caixa estao alinhados neste periodo.";
  const monthAppointmentsByDay = new Map<string, ManagementAppointmentItem[]>();
  const weekAppointmentsByDay = new Map<string, ManagementAppointmentItem[]>();

  for (const appointment of currentMonthAppointments) {
    const dayKey = getLocalDateKey(appointment.date, timeZone);
    const bucket = monthAppointmentsByDay.get(dayKey) ?? [];
    bucket.push(appointment);
    monthAppointmentsByDay.set(dayKey, bucket);
  }

  for (const appointment of weekAppointmentsData.items) {
    const dayKey = getLocalDateKey(appointment.date, timeZone);
    const bucket = weekAppointmentsByDay.get(dayKey) ?? [];
    bucket.push(appointment);
    weekAppointmentsByDay.set(dayKey, bucket);
  }

  const calendarDays = buildMonthGrid(selectedMonthKey);
  const weekDays = buildWeekDays(selectedDay);
  const weekRangeLabel = formatWeekRangeLabel(
    weekDays.map((day) => day.dayKey),
    timeZone,
  );
  const weekSummaryText = weekAppointmentsData.items.length
    ? `${formatCountLabel(
        weekAppointmentsData.items.length,
        "atendimento",
        "atendimentos",
      )} em ${formatCountLabel(occupiedWeekDaysCount, "dia", "dias")} nesta semana.`
    : "Nenhum atendimento nesta semana.";
  const dayAgendaSummaryText = appointmentsData.items.length
    ? `${formatCountLabel(
        appointmentsData.items.length,
        "atendimento",
        "atendimentos",
      )} em ${selectedDayLabel}.`
    : "Nenhum atendimento no dia selecionado.";
  const activeViewLabel =
    selectedView === "day"
      ? "Dia"
      : selectedView === "week"
        ? "Semana"
        : "Mês";
  const activeViewSummary =
    selectedView === "day"
      ? dayAgendaSummaryText
      : selectedView === "week"
        ? weekSummaryText
        : `${formatCountLabel(
            currentMonthAppointments.length,
            "agendamento",
            "agendamentos",
          )} no mês e ${formatCountLabel(
            occupiedDaysCount,
            "dia com movimento",
            "dias com movimento",
          )}.`;
  const activeViewSupport =
    selectedView === "day"
      ? "Use esta visão para operar a agenda, confirmar presença e agir no caixa do dia."
      : selectedView === "week"
        ? "Use a semana para distribuir a equipe, enxergar dias fracos e abrir encaixes melhores."
        : "Use o mês para enxergar ritmo, concentração de movimento e escolher o melhor dia para agir.";
  const summaryCards =
    selectedView === "day"
      ? [
          {
            description: selectedDayPendingClosureCount
              ? "Horários deste dia que já terminaram e ainda pedem status final."
              : "Atendimentos visíveis neste dia.",
            label: selectedDayPendingClosureCount
              ? "Para fechar"
              : "Atendimentos do dia",
            value: String(
              selectedDayPendingClosureCount || appointmentsData.items.length,
            ),
          },
          {
            description:
              financeAttentionDayCount > 0
                ? `${formatCountLabel(
                    financeAttentionDayCount,
                    "atendimento",
                    "atendimentos",
                  )} ainda sem pagamento registrado.`
                : "Pagamentos registrados no recorte do dia.",
            label: "Recebido no dia",
            value: formatCurrency(paidRevenueDay),
          },
        ]
      : selectedView === "week"
        ? [
            {
              description: "Atendimentos exibidos na semana do recorte.",
              label: "Atendimentos na semana",
              value: String(weekAppointmentsData.items.length),
            },
            {
              description: "Dias com pelo menos um atendimento nesta semana.",
              label: "Dias com movimento",
              value: String(occupiedWeekDaysCount),
            },
          ]
        : [
            {
              description: "Agendamentos exibidos neste mês.",
              label: "Agendamentos no mês",
              value: String(currentMonthAppointments.length),
            },
            {
              description:
                financeAttentionMonthCount > 0
                  ? `${formatCountLabel(
                      financeAttentionMonthCount,
                      "atendimento",
                      "atendimentos",
                    )} ainda sem pagamento registrado no mês.`
                  : "Caixa do mês sem pendências visíveis nesta leitura.",
              label: "Pendências no caixa",
              value: String(financeAttentionMonthCount),
            },
          ];
  const previousMonthHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: shiftMonth(`${selectedMonthKey}-01`, -1),
      message: undefined,
      tone: undefined,
      view: "month",
    },
  );
  const nextMonthHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: shiftMonth(`${selectedMonthKey}-01`, 1),
      message: undefined,
      tone: undefined,
      view: "month",
    },
  );
  const clearFiltersHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: selectedDay,
      professionalId: undefined,
      status: undefined,
      message: undefined,
      tone: undefined,
    },
  );
  const dayViewHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: selectedDay,
      message: undefined,
      tone: undefined,
      view: "day",
    },
  );
  const weekViewHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: selectedDay,
      message: undefined,
      tone: undefined,
      view: "week",
    },
  );
  const monthViewHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: selectedDay,
      message: undefined,
      tone: undefined,
      view: "month",
    },
  );
  const monthTodayHref = buildFilterHref(
    "/dashboard/gestao/agendamentos",
    searchParams,
    {
      day: getLocalDateKey(new Date(), timeZone),
      message: undefined,
      professionalId: selectedProfessionalId || undefined,
      status: selectedStatus || undefined,
      tone: undefined,
      view: "month",
    },
  );
  const monthRangeLabel = formatCalendarRangeLabel(
    `${selectedMonthKey}-01`,
    selectedMonthEndKey,
    timeZone,
  );
  const monthRequestsHref = dayViewHref;
  const monthBlockedDaysHref = smartAgendaHref;
  const shellClassName = [
    styles.shell,
    selectedView === "month" ? styles.shellMonthFocus : "",
  ]
    .filter(Boolean)
    .join(" ");
  const appointmentComposerParams = new URLSearchParams();
  appointmentComposerParams.set("day", selectedDay);
  appointmentComposerParams.set("view", selectedView);
  if (selectedProfessionalId) {
    appointmentComposerParams.set("professionalId", selectedProfessionalId);
  }
  if (selectedStatus) {
    appointmentComposerParams.set("status", selectedStatus);
  }
  appointmentComposerParams.set("composer", "new");
  const openAppointmentComposerHref = `/dashboard/gestao/agendamentos?${appointmentComposerParams.toString()}#novo-agendamento`;

  const closeAppointmentComposerParams = new URLSearchParams();
  closeAppointmentComposerParams.set("day", selectedDay);
  closeAppointmentComposerParams.set("view", selectedView);
  if (selectedProfessionalId) {
    closeAppointmentComposerParams.set("professionalId", selectedProfessionalId);
  }
  if (selectedStatus) {
    closeAppointmentComposerParams.set("status", selectedStatus);
  }
  const closeAppointmentComposerHref = `/dashboard/gestao/agendamentos?${closeAppointmentComposerParams.toString()}`;

  return (
    <AsyncActionNoticeRegion
      initialMessage={searchParams?.message}
      initialTone={searchParams?.tone}
    >
      <div
        className={`page-grid workspace-page management-page ${styles.page}`}
      >
        <section className={shellClassName}>
          <aside className={styles.sidebar}>
            <article className={styles.sidebarPanel}>
              <span className={styles.panelEyebrow}>Hoje</span>
              <strong>{selectedDayLabel}</strong>
              <p>{resolvedDayFocusSummary}</p>
              <div className={styles.miniMetrics}>
                <article>
                  <span>
                    {selectedDayPendingClosureCount ? "Para fechar" : "Valor do dia"}
                  </span>
                  <strong>
                    {selectedDayPendingClosureCount
                      ? String(selectedDayPendingClosureCount)
                      : formatCurrency(projectedRevenueDay)}
                  </strong>
                </article>
                <article>
                  <span>Recebido</span>
                  <strong>{formatCurrency(paidRevenueDay)}</strong>
                </article>
              </div>

              {dayAppointmentsPreview.length ? (
                <div className={styles.dayFocusPreview}>
                  <div className={styles.dayFocusPreviewHeader}>
                    <strong>Atendimentos do dia</strong>
                    <a href={dayViewHref} className="secondary-button">
                      Abrir agenda
                    </a>
                  </div>

                  <div className={styles.dayFocusPreviewList}>
                    {dayAppointmentsPreview.map((appointment) => (
                      <a
                        key={`preview-${appointment.id}`}
                        href={`${dayViewHref}#appointment-${appointment.id}`}
                        className={styles.dayFocusPreviewItem}
                      >
                        <span className={styles.dayFocusPreviewTime}>
                          {formatTimeInput(appointment.date, timeZone)}
                        </span>
                        <strong>{appointment.customerName}</strong>
                        <p>
                          {appointment.professionalName} -{" "}
                          {appointment.serviceName}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>

            {appointmentComposerOpen ? (
              <article id="novo-agendamento" className={styles.sidebarPanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <h2>Novo agendamento</h2>
                    <p>Cadastro rápido com cliente, profissional e serviço.</p>
                  </div>
                  <a
                    href={closeAppointmentComposerHref}
                    className={`secondary-button ${styles.panelHeaderAction}`}
                  >
                    Fechar
                  </a>
                </div>

                <AsyncActionForm
                  action={createManagementAppointmentAction}
                  className="simple-form"
                  resetOnSuccess
                >
                <input type="hidden" name="returnPath" value={returnPath} />

                <div className="field">
                  <label htmlFor="appointment-client">Cliente</label>
                  <select id="appointment-client" name="clientId" required>
                    <option value="">Selecione</option>
                    {options.clients.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                        {item.secondary ? ` - ${item.secondary}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="split-grid">
                  <div className="field">
                    <label htmlFor="appointment-professional">
                      Profissional
                    </label>
                    <select
                      id="appointment-professional"
                      name="professionalId"
                      required
                    >
                      <option value="">Selecione</option>
                      {options.professionals.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="field">
                    <label htmlFor="appointment-service">Serviço</label>
                    <select id="appointment-service" name="serviceId" required>
                      <option value="">Selecione</option>
                      {options.services.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="split-grid">
                  <div className="field">
                    <label htmlFor="appointment-date">Data</label>
                    <input
                      id="appointment-date"
                      name="date"
                      type="date"
                      defaultValue={selectedDay}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="appointment-time">Horário</label>
                    <input
                      id="appointment-time"
                      name="time"
                      type="time"
                      required
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="appointment-payment-preference">
                    Forma preferida de pagamento
                  </label>
                  <select
                    id="appointment-payment-preference"
                    name="paymentPreference"
                    defaultValue=""
                  >
                    <option value="">Não informar</option>
                    {APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <label htmlFor="appointment-notes">Observações</label>
                  <textarea
                    id="appointment-notes"
                    name="notes"
                    rows={3}
                    placeholder="Informações rápidas sobre o atendimento."
                  />
                </div>

                <button type="submit" className="primary-button">
                  Salvar agendamento
                </button>
              </AsyncActionForm>
            </article>
            ) : null}

          </aside>

          <section className={styles.mainStage}>
            <header className={styles.mainHeader}>
              <div className={styles.mainHeaderCopy}>
                <span className={styles.stageEyebrow}>Agenda</span>
                <h1>Agenda</h1>
                <p>Veja o dia, filtre rapido e ajuste o que precisar.</p>
              </div>

              <div className={styles.mainHeaderTools}>
                <div className={styles.mainActionRow}>
                  <a
                    href={openAppointmentComposerHref}
                    className={`primary-button ${styles.mainPrimaryLink}`}
                  >
                    + Novo agendamento
                  </a>
                </div>

                <div
                  className={styles.viewSwitch}
                  aria-label="Modos de leitura"
                >
                  <a
                    href={dayViewHref}
                    className={`${styles.viewSwitchLink} ${
                      selectedView === "day" ? styles.viewSwitchActive : ""
                    }`}
                  >
                    Dia
                  </a>
                  <a
                    href={weekViewHref}
                    className={`${styles.viewSwitchLink} ${
                      selectedView === "week" ? styles.viewSwitchActive : ""
                    }`}
                  >
                    Semana
                  </a>
                  <a
                    href={monthViewHref}
                    className={`${styles.viewSwitchLink} ${
                      selectedView === "month" ? styles.viewSwitchActive : ""
                    }`}
                  >
                    Mês
                  </a>
                </div>
              </div>
            </header>

            {selectedView === "month" ? (
              <nav className={styles.calendarModeTabs} aria-label="Leituras da agenda">
                <a href={monthRequestsHref} className={styles.calendarModeTab}>
                  Solicitações
                </a>
                <a
                  href={monthViewHref}
                  className={`${styles.calendarModeTab} ${styles.calendarModeTabActive}`}
                >
                  Calendário
                </a>
                <a href={monthBlockedDaysHref} className={styles.calendarModeTab}>
                  Dias bloqueados
                </a>
              </nav>
            ) : null}

            <section
              className={[
                styles.filterBar,
                selectedView === "month" ? styles.filterBarCalendarFocus : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <form method="get" className={styles.filterForm}>
                <input type="hidden" name="view" value={selectedView} />

                <div className={styles.filterField}>
                  <label htmlFor="filter-day">Dia</label>
                  <input
                    id="filter-day"
                    name="day"
                    type="date"
                    defaultValue={selectedDay}
                    required
                  />
                </div>

                <div className={styles.filterField}>
                  <label htmlFor="filter-professional">Profissional</label>
                  <select
                    id="filter-professional"
                    name="professionalId"
                    defaultValue={selectedProfessionalId}
                  >
                    <option value="">Toda a equipe</option>
                    {options.professionals.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterField}>
                  <label htmlFor="filter-status">Status</label>
                  <select
                    id="filter-status"
                    name="status"
                    defaultValue={selectedStatus}
                  >
                    <option value="">Todos os status</option>
                    {APPOINTMENT_STATUS_OPTIONS.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.filterActions}>
                  <button type="submit" className="secondary-button">
                    Ver agenda
                  </button>
                  <a href={clearFiltersHref} className="secondary-button">
                    Limpar
                  </a>
                </div>
              </form>

              {selectedView === "month" ? (
                <div className={styles.filterSummaryInline}>
                  <span className={styles.signalPill}>
                    <strong>Dia em foco</strong>
                    <span>{selectedDayLabel}</span>
                  </span>
                  <span className={styles.signalPill}>
                    <strong>Profissional</strong>
                    <span>{selectedProfessionalLabel}</span>
                  </span>
                  <span className={styles.signalPill}>
                    <strong>Status</strong>
                    <span>{selectedStatusLabel}</span>
                  </span>
                </div>
              ) : null}

              {selectedView !== "month" ? (
                <div className={styles.filterSummary}>
                  <span className={styles.panelEyebrow}>{activeViewLabel}</span>
                  <strong>{activeViewSummary}</strong>
                  <p>{activeViewSupport}</p>
                  <div className={styles.filterSignals}>
                    <span className={styles.signalPill}>
                      <strong>Dia em foco</strong>
                      <span>{selectedDayLabel}</span>
                    </span>
                    <span className={styles.signalPill}>
                      <strong>Profissional</strong>
                      <span>{selectedProfessionalLabel}</span>
                    </span>
                    <span className={styles.signalPill}>
                      <strong>Status</strong>
                      <span>{selectedStatusLabel}</span>
                    </span>
                  </div>
                </div>
              ) : null}
              <section id="agenda-mes" className={styles.monthCard}>
                <div className={styles.monthControlRow}>
                  <div className={styles.monthRangeControl}>
                    <a
                      href={previousMonthHref}
                      className={styles.monthControlNav}
                      aria-label="Mes anterior"
                    >
                      {"<"}
                    </a>
                    <span>{monthRangeLabel}</span>
                    <a
                      href={nextMonthHref}
                      className={styles.monthControlNav}
                      aria-label="Próximo mês"
                    >
                      {">"}
                    </a>
                  </div>
                  <a href={monthTodayHref} className={styles.monthTodayLink}>
                    Hoje
                  </a>
                </div>

                <div className={styles.monthHeader}>
                  <div className={styles.monthHeaderCopy}>
                    <h2>
                      {selectedView === "month"
                        ? monthLabel
                        : `Calendário de ${monthLabel}`}
                    </h2>
                    <span className={styles.monthKicker}>calendário principal</span>
                    <p>
                      {formatCountLabel(
                        currentMonthAppointments.length,
                        "agendamento",
                        "agendamentos",
                      )}{" "}
                      no mês •{" "}
                      {formatCountLabel(
                        occupiedDaysCount,
                        "dia com movimento",
                        "dias com movimento",
                      )}
                    </p>
                  </div>
                </div>

                <div className={styles.weekdayRow}>
                  {WEEKDAY_LABELS.map((label) => (
                    <span key={label}>{label}</span>
                  ))}
                </div>

                <div className={styles.monthGrid}>
                  {calendarDays.map((cell) => {
                    const dayItems = monthAppointmentsByDay.get(cell.dayKey) ?? [];
                    const cellHref = buildFilterHref(
                      "/dashboard/gestao/agendamentos",
                      searchParams,
                      {
                        day: cell.dayKey,
                        message: undefined,
                        tone: undefined,
                        view: "day",
                      },
                    );

                    return (
                      <a
                        key={cell.dayKey}
                        href={cellHref}
                        className={[
                          styles.dayCell,
                          cell.inMonth ? "" : styles.dayCellMuted,
                          cell.dayKey === selectedDay ? styles.dayCellSelected : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <div className={styles.dayCellTop}>
                          <span>{cell.dayNumber}</span>
                          {dayItems.length ? <small>{dayItems.length} ag.</small> : null}
                        </div>

                        <div className={styles.dayCellBody}>
                          {dayItems.map((appointment, index) => (
                            <span
                              key={appointment.id}
                              className={[
                                styles.calendarChip,
                                getCalendarChipTone(appointment.status),
                                getCalendarPaletteClass(appointment, index),
                              ]
                                .filter(Boolean)
                                .join(" ")}
                              title={buildCalendarChipTitle(appointment, timeZone)}
                            >
                              <span className={styles.calendarChipAvatars}>
                                {appointment.customerProfileImageUrl ? (
                                  <Image
                                    src={appointment.customerProfileImageUrl}
                                    alt={`Avatar de ${appointment.customerName}`}
                                    width={32}
                                    height={32}
                                    unoptimized
                                    className={styles.calendarChipAvatarImage}
                                  />
                                ) : (
                                  <span className={styles.calendarChipAvatar}>
                                    {customerInitials(appointment.customerName)}
                                  </span>
                                )}
                                {appointment.professionalProfileImageUrl ? (
                                  <Image
                                    src={appointment.professionalProfileImageUrl}
                                    alt={`Avatar de ${appointment.professionalName}`}
                                    width={32}
                                    height={32}
                                    unoptimized
                                    className={`${styles.calendarChipAvatarImage} ${styles.calendarChipAvatarImageSecondary}`}
                                  />
                                ) : (
                                  <span className={styles.calendarChipAvatarMuted}>
                                    {customerInitials(appointment.professionalName)}
                                  </span>
                                )}
                              </span>
                              <strong className={styles.calendarChipPrimary}>
                                {buildCalendarChipHeadline(appointment, timeZone)}
                              </strong>
                              <small className={styles.calendarChipMeta}>
                                {buildCalendarChipMetaLabel(appointment, timeZone)}
                              </small>
                            </span>
                          ))}
                        </div>
                      </a>
                    );
                  })}
                </div>
              </section>
            </section>

            {selectedView !== "month" ? (
              <section id="resumo-agenda" className={styles.statsGrid}>
                {summaryCards.map((card) => (
                  <article key={card.label} className={styles.statCard}>
                    <span>{card.label}</span>
                    <strong>{card.value}</strong>
                    <p>{card.description}</p>
                  </article>
                ))}
              </section>
            ) : null}

            {selectedView === "week" ? (
            <section id="agenda-semana" className={styles.weekBoard}>
              <div className={styles.dayBoardHeader}>
                <div>
                  <span className={styles.panelEyebrow}>
                    Semana
                  </span>
                  <h2>Semana</h2>
                  <p>{weekSummaryText}</p>
                </div>
                <div className={styles.dayBoardBadge}>{weekRangeLabel}</div>
              </div>

              <div className={styles.weekList}>
                {weekDays.map((weekDay) => {
                  const dayItems =
                    weekAppointmentsByDay.get(weekDay.dayKey) ?? [];
                  const isSelectedDay = weekDay.dayKey === selectedDay;

                  return (
                    <article
                      key={weekDay.dayKey}
                      className={[
                        styles.weekDayCard,
                        isSelectedDay ? styles.weekDayCardSelected : "",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    >
                      <div className={styles.weekDayHeader}>
                        <div>
                          <span className={styles.panelEyebrow}>
                            {
                              WEEKDAY_LABELS[
                                getMondayWeekdayIndex(parseDayKey(weekDay.dayKey))
                              ]
                            }
                          </span>
                          <strong>
                            {formatAgendaDaySummary(weekDay.dayKey, timeZone)}
                          </strong>
                        </div>
                        <span className={styles.weekDayBadge}>
                          {dayItems.length} ag.
                        </span>
                      </div>

                      {dayItems.length ? (
                        <div className={styles.weekAppointmentList}>
                          {dayItems.map((appointment) => (
                            <a
                              key={appointment.id}
                              href={`${buildFilterHref(
                                "/dashboard/gestao/agendamentos",
                                searchParams,
                                {
                                  day: weekDay.dayKey,
                                  message: undefined,
                                  tone: undefined,
                                  view: "day",
                                },
                              )}#appointment-${appointment.id}`}
                              className={styles.weekAppointmentItem}
                              title={buildCalendarChipTitle(
                                appointment,
                                timeZone,
                              )}
                            >
                              <strong>
                                {buildCalendarChipHeadline(
                                  appointment,
                                  timeZone,
                                )}
                              </strong>
                              <span>
                                {appointment.professionalName} -{" "}
                                {formatAppointmentKindLabel(appointment)}
                              </span>
                              <small>{appointment.serviceName}</small>
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className={styles.weekEmpty}>
                          Sem atendimento neste dia.
                        </p>
                      )}
                    </article>
                  );
                })}
              </div>
            </section>
            ) : null}

            {selectedView === "day" ? (
            <section id="agenda-dia" className={styles.dayBoard}>
              <div className={styles.dayBoardHeader}>
                <div>
                  <span className={styles.panelEyebrow}>Dia</span>
                  <h2>Dia</h2>
                  <p>{dayAgendaSummaryText}</p>
                </div>
                <div className={styles.dayBoardBadge}>{selectedDayLabel}</div>
              </div>

              {!appointmentsData.items.length ? (
                <EmptyStateCard
                  eyebrow="Agenda vazia"
                  title="Nenhum agendamento neste dia"
                  description="Ajuste o filtro ou crie um novo horário."
                />
              ) : (
                <div className={styles.dayList}>
                  {appointmentsData.items.map((appointment) => {
                    const presenceSummary = getPresenceSummary(appointment);
                    const depositSummary = getDepositSummary(appointment);
                    const depositReportedLine = formatDepositReportedLine(
                      appointment,
                      timeZone,
                    );
                    const appointmentHasEnded = hasAppointmentEnded(appointment);
                    const appointmentIsFinal = isFinalAppointmentStatus(
                      appointment.status,
                    );
                    const paymentSummary =
                      appointment.isMembershipPlanAppointment
                        ? "Pago pelo plano"
                        : appointment.payment
                          ? `Pago ${formatCurrency(
                              appointment.payment.amount,
                            )} via ${formatPaymentMethodLabel(
                              appointment.payment.paymentMethod,
                            )}`
                          : appointment.payment_preference
                            ? `Cliente prefere ${formatAppointmentPaymentPreferenceLabel(
                                appointment.payment_preference,
                              )}`
                            : "Pagamento não registrado";

                    return (
                      <article
                        key={appointment.id}
                        id={`appointment-${appointment.id}`}
                        className={styles.dayCard}
                      >
                        <div className={styles.dayCardTop}>
                          <div className={styles.dayIdentity}>
                            {appointment.customerProfileImageUrl ? (
                              <Image
                                src={appointment.customerProfileImageUrl}
                                alt={`Foto de ${appointment.customerName}`}
                                width={88}
                                height={88}
                                unoptimized
                                className={styles.dayAvatar}
                              />
                            ) : (
                              <div
                                className={`${styles.dayAvatar} ${styles.dayAvatarFallback}`}
                              >
                                {customerInitials(appointment.customerName)}
                              </div>
                            )}

                            <div className={styles.dayIdentityCopy}>
                              <span className={styles.dayIdentityEyebrow}>
                                Cliente
                              </span>
                              <strong>{appointment.customerName}</strong>
                              <p>
                                {formatAppointmentWindowLine(
                                  appointment,
                                  timeZone,
                                )}
                              </p>
                              <p>
                                {appointment.serviceName}
                                {appointment.isMembershipPlanAppointment
                                  ? appointment.membershipPlanTitle?.trim()
                                      .length
                                    ? ` - Plano ${appointment.membershipPlanTitle}`
                                    : " - Plano mensal"
                                  : ""}
                              </p>
                              <p>{formatCustomerContactLine(appointment)}</p>
                              <div className={styles.dayIdentityHighlights}>
                                <span className={styles.dayIdentityHighlight}>
                                  {formatCustomerRegistrationOrigin(
                                    appointment,
                                  )}
                                </span>
                                <span className={styles.dayIdentityHighlight}>
                                  {appointment.professionalProfileImageUrl ? (
                                    <Image
                                      src={appointment.professionalProfileImageUrl}
                                      alt={`Foto de ${appointment.professionalName}`}
                                      width={24}
                                      height={24}
                                      unoptimized
                                      className={styles.dayIdentityAvatar}
                                    />
                                  ) : (
                                    <span
                                      className={`${styles.dayIdentityAvatar} ${styles.dayIdentityAvatarFallback}`}
                                    >
                                      {customerInitials(appointment.professionalName)}
                                    </span>
                                  )}
                                  Profissional: {appointment.professionalName}
                                </span>
                                <span className={styles.dayIdentityHighlight}>
                                  {formatAppointmentKindLabel(appointment)}
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className={styles.dayStatusStack}>
                            <span
                              className={`badge ${getAppointmentStatusBadgeClass(
                                appointment.status,
                              )}`}
                            >
                              {formatAppointmentStatusLabel(appointment.status)}
                            </span>
                            <span
                              className={`badge ${presenceSummary.badgeClass}`}
                            >
                              {presenceSummary.label}
                            </span>
                            <span
                              className={`badge ${depositSummary.badgeClass}`}
                            >
                              {depositSummary.label}
                            </span>
                            {appointment.isMembershipPlanAppointment ? (
                              <span className="badge badge--accent">
                                {appointment.membershipPlanTitle?.trim().length
                                  ? `Plano - ${appointment.membershipPlanTitle}`
                                  : "Plano mensal"}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className={styles.dayMeta}>
                          <span>
                            Termina as{" "}
                            {formatTimeInput(appointment.ends_at, timeZone)}
                          </span>
                          <span>
                            {appointment.serviceDurationMinutes
                              ? `${appointment.serviceDurationMinutes} min`
                              : "Duração não informada"}
                          </span>
                          <span>
                            Valor{" "}
                            {formatCurrency(appointment.servicePrice)}
                          </span>
                          {appointment.isMembershipPlanAppointment &&
                          appointment.membershipSessionIndex &&
                          appointment.membershipSessionsIncluded ? (
                            <span>
                              Sessão {appointment.membershipSessionIndex}/
                              {appointment.membershipSessionsIncluded}
                            </span>
                          ) : null}
                          <span>{paymentSummary}</span>
                        </div>

                        <div className={styles.dayInfoGrid}>
                          <article className={styles.dayInfoPanel}>
                            <span className={styles.detailEyebrow}>
                              Cliente
                            </span>
                            <strong>{appointment.customerName}</strong>
                            <p>{formatCustomerContactLine(appointment)}</p>
                            <p>
                              {appointment.customerProfileImageUrl
                                ? "Foto do cadastro carregada."
                                : "Cliente sem foto no cadastro."}
                            </p>
                          </article>

                          <article className={styles.dayInfoPanel}>
                            <span className={styles.detailEyebrow}>
                              Serviço
                            </span>
                            <strong>{appointment.serviceName}</strong>
                            <p>
                              {appointment.professionalName} -{" "}
                              {formatTimeInput(appointment.date, timeZone)} as{" "}
                              {formatTimeInput(appointment.ends_at, timeZone)}
                            </p>
                            <p>
                              {appointment.isMembershipPlanAppointment
                                ? `Pago pelo plano${appointment.membershipPlanTitle ? ` - ${appointment.membershipPlanTitle}` : ""}`
                                : `Valor previsto ${formatCurrency(appointment.servicePrice)}`}
                              {!appointment.isMembershipPlanAppointment &&
                              appointment.payment_preference
                                ? ` - ${formatAppointmentPaymentPreferenceLabel(
                                    appointment.payment_preference,
                                  )}`
                                : ""}
                            </p>
                          </article>

                          <article className={styles.dayInfoPanel}>
                            <span className={styles.detailEyebrow}>
                              Pagamento
                            </span>
                            <strong>
                              {appointment.isMembershipPlanAppointment
                                ? "Pago pelo plano"
                                : depositSummary.label}
                            </strong>
                            <p>{paymentSummary}</p>
                            <p>
                              {appointment.isMembershipPlanAppointment
                                ? appointment.membershipPlanExpiresAt
                                  ? `Plano ativo até ${new Intl.DateTimeFormat(
                                      "pt-BR",
                                      {
                                        day: "2-digit",
                                        month: "long",
                                        timeZone,
                                      },
                                    ).format(
                                      new Date(
                                        appointment.membershipPlanExpiresAt,
                                      ),
                                    )}.`
                                  : "Horário reservado automaticamente pelo plano."
                                : appointment.payment?.notes
                                  ? `Observação: ${appointment.payment.notes}`
                                  : depositReportedLine
                                    ? depositReportedLine
                                    : appointment.deposit_paid_at
                                      ? `Sinal compensado em ${formatCompactDateTime(
                                          appointment.deposit_paid_at,
                                          timeZone,
                                        )}`
                                        : "Pagamento ainda não registrado."}
                            </p>
                          </article>

                          <article className={styles.dayInfoPanel}>
                            <span className={styles.detailEyebrow}>
                              Confirmação
                            </span>
                            <strong>{presenceSummary.label}</strong>
                            <p>
                              {appointment.customer_presence_confirmed_at
                                  ? `Cliente confirmou em ${formatCompactDateTime(
                                      appointment.customer_presence_confirmed_at,
                                      timeZone,
                                    )}.`
                                  : appointment.customer_confirmation_requested_at
                                    ? `Confirmação enviada em ${formatCompactDateTime(
                                        appointment.customer_confirmation_requested_at,
                                        timeZone,
                                      )}.`
                                    : appointment.protection_confirmation_required
                                      ? "Vamos pedir confirmação perto do horário."
                                      : "Esse horário não precisa de confirmação."}
                            </p>
                            <p>
                              {appointment.booking_policy_snapshot
                                ? "Reserva protegida ativa neste horário."
                                : "Sem regra extra neste horário."}
                            </p>
                          </article>
                        </div>

                        {appointment.notes ? (
                          <p className={styles.inlineNote}>
                            {appointment.notes}
                          </p>
                        ) : null}

                        <div className={`inline-actions ${styles.actionRow}`}>
                          {appointment.status === "pending" &&
                          !appointmentHasEnded ? (
                            <AsyncActionForm
                              action={updateManagementAppointmentStatusAction}
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="confirmed"
                              />
                              <button
                                type="submit"
                                className="secondary-button"
                              >
                                Confirmar
                              </button>
                            </AsyncActionForm>
                          ) : null}

                          {!appointmentIsFinal && appointmentHasEnded ? (
                            <AsyncActionForm
                              action={updateManagementAppointmentStatusAction}
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="completed"
                              />
                              <button
                                type="submit"
                                className="primary-button"
                              >
                                Concluir atendimento
                              </button>
                            </AsyncActionForm>
                          ) : null}

                          {!appointmentIsFinal && appointmentHasEnded ? (
                            <AsyncActionForm
                              action={updateManagementAppointmentStatusAction}
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="no_show"
                              />
                              <button
                                type="submit"
                                className="secondary-button"
                              >
                                Marcar falta
                              </button>
                            </AsyncActionForm>
                          ) : null}

                          {appointment.isMembershipPlanAppointment ? (
                            <AsyncActionForm
                              action={reprocessManagementMembershipPlanAction}
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />
                              <button
                                type="submit"
                                className="secondary-button"
                              >
                                Recalcular sessões do plano
                              </button>
                            </AsyncActionForm>
                          ) : null}
                        </div>

                        {!appointmentIsFinal && !appointmentHasEnded ? (
                          <AsyncActionForm
                            action={updateManagementAppointmentStatusAction}
                            className="management-inline-form"
                          >
                            <input
                              type="hidden"
                              name="returnPath"
                              value={returnPath}
                            />
                            <input
                              type="hidden"
                              name="appointmentId"
                              value={appointment.id}
                            />
                            <input
                              type="hidden"
                              name="status"
                              value="cancelled"
                            />
                            <input
                              name="cancellationReason"
                              placeholder="Motivo do cancelamento"
                            />
                            <button type="submit" className="danger-button">
                              Cancelar
                            </button>
                          </AsyncActionForm>
                        ) : null}

                        {appointment.booking_policy_snapshot ? (
                          <details className={styles.inlineDetails}>
                            <summary>
                              Ver política aplicada ao agendamento
                            </summary>
                            <p className={styles.inlineNote}>
                              {appointment.booking_policy_snapshot}
                            </p>
                          </details>
                        ) : null}

                        {!appointmentHasEnded &&
                        (appointment.status === "pending" ||
                          appointment.status === "confirmed") && (
                          <details className={styles.inlineDetails}>
                            <summary>Editar horário</summary>

                            <AsyncActionForm
                              action={updateManagementAppointmentAction}
                              className="simple-form"
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />

                              <div className="field">
                                <label>Cliente</label>
                                {appointment.isMembershipPlanAppointment ? (
                                  <input
                                    type="hidden"
                                    name="clientId"
                                    value={appointment.customer_id}
                                  />
                                ) : null}
                                <select
                                  name="clientId"
                                  defaultValue={appointment.customer_id}
                                  disabled={
                                    appointment.isMembershipPlanAppointment
                                  }
                                  required
                                >
                                  {options.clients.map((item) => (
                                    <option key={item.id} value={item.id}>
                                      {item.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="split-grid">
                                <div className="field">
                                  <label>Profissional</label>
                                  {appointment.isMembershipPlanAppointment ? (
                                    <input
                                      type="hidden"
                                      name="professionalId"
                                      value={appointment.staff_member_id}
                                    />
                                  ) : null}
                                  <select
                                    name="professionalId"
                                    defaultValue={appointment.staff_member_id}
                                    disabled={
                                      appointment.isMembershipPlanAppointment
                                    }
                                    required
                                  >
                                    {options.professionals.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="field">
                                  <label>Serviço</label>
                                  {appointment.isMembershipPlanAppointment ? (
                                    <input
                                      type="hidden"
                                      name="serviceId"
                                      value={appointment.service_id}
                                    />
                                  ) : null}
                                  <select
                                    name="serviceId"
                                    defaultValue={appointment.service_id}
                                    disabled={
                                      appointment.isMembershipPlanAppointment
                                    }
                                    required
                                  >
                                    {options.services.map((item) => (
                                      <option key={item.id} value={item.id}>
                                        {item.label}
                                      </option>
                                    ))}
                                  </select>
                                </div>
                              </div>

                              <div className="split-grid">
                                <div className="field">
                                  <label>Data</label>
                                  <input
                                    name="date"
                                    type="date"
                                    defaultValue={getLocalDateKey(
                                      appointment.date,
                                      timeZone,
                                    )}
                                    required
                                  />
                                </div>

                                <div className="field">
                                  <label>Horário</label>
                                  <input
                                    name="time"
                                    type="time"
                                    defaultValue={formatTimeInput(
                                      appointment.date,
                                      timeZone,
                                    )}
                                    required
                                  />
                                </div>
                              </div>

                              {appointment.isMembershipPlanAppointment ? (
                                <p className={styles.inlineNote}>
                                  Atendimento coberto por plano. Cliente,
                                  serviço e pagamento avulso ficam bloqueados
                                  para preservar a conciliação com o app.
                                </p>
                              ) : (
                                <div className="field">
                                  <label>Forma preferida de pagamento</label>
                                  <select
                                    name="paymentPreference"
                                    defaultValue={
                                      appointment.payment_preference ?? ""
                                    }
                                  >
                                    <option value="">Não informar</option>
                                    {APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS.map(
                                      (item) => (
                                        <option
                                          key={item.value}
                                          value={item.value}
                                        >
                                          {item.label}
                                        </option>
                                      ),
                                    )}
                                  </select>
                                </div>
                              )}

                              <div className="field">
                                <label>Observações</label>
                                <textarea
                                  name="notes"
                                  rows={3}
                                  defaultValue={appointment.notes ?? ""}
                                />
                              </div>

                              <button type="submit" className="primary-button">
                                Atualizar agendamento
                              </button>
                            </AsyncActionForm>
                          </details>
                        )}
                      </article>
                    );
                  })}
                </div>
                )}
            </section>
            ) : null}

            {selectedView !== "month" ? (
            <section className={styles.supportGrid}>
              <article className={styles.sidebarPanel}>
                <span className={styles.panelEyebrow}>Pagamentos</span>
                <strong>{financeAttentionTitle}</strong>
                <p>{financeAttentionDescription}</p>

                {financeAttentionItems.length ? (
                  <div className={styles.staleQueue}>
                    {financeAttentionItems.map((appointment) => (
                      <article
                        key={`finance-${appointment.id}`}
                        className={styles.staleCard}
                      >
                        <div className={styles.staleCardHeader}>
                          <strong>{appointment.customerName}</strong>
                          <span>
                            {formatAgendaDaySummary(
                              getLocalDateKey(appointment.date, timeZone),
                              timeZone,
                            )}
                          </span>
                        </div>

                        <p>
                          {formatTimeInput(appointment.date, timeZone)} -{" "}
                          {appointment.professionalName}
                        </p>
                        <p>
                          {appointment.serviceName} -{" "}
                          {formatCurrency(appointment.servicePrice)}
                        </p>
                      </article>
                    ))}
                  </div>
                ) : null}

                <a href={financeAttentionHref} className="secondary-button">
                  Abrir pagamentos
                </a>
              </article>

              <article className={styles.sidebarPanel}>
                <span className={styles.panelEyebrow}>Controle do salão</span>
                <strong>{stalePanelTitle}</strong>
                <p>{stalePanelDescription}</p>

                {staleAppointments.length ? (
                  <div className={styles.staleMetrics}>
                    <article className={styles.staleMetric}>
                      <span>Na fila</span>
                      <strong>{staleAppointments.length}</strong>
                    </article>
                    <article className={styles.staleMetric}>
                      <span>Confirmou no app</span>
                      <strong>{staleDisplayedPresenceCount}</strong>
                    </article>
                    <article className={styles.staleMetric}>
                      <span>Pagamento alinhado</span>
                      <strong>{staleDisplayedPaymentAlignedCount}</strong>
                    </article>
                    <article className={styles.staleMetric}>
                      <span>Sinal informado</span>
                      <strong>{staleDisplayedDepositReportedCount}</strong>
                    </article>
                  </div>
                ) : null}

                {staleAppointments.length ? (
                  <div className={styles.staleQueue}>
                    {staleAppointments.map((appointment) => {
                      const appointmentDay = getLocalDateKey(
                        appointment.date,
                        timeZone,
                      );
                      const customerSignals =
                        getCustomerAppSignalTags(appointment);
                      const customerControlNote = getCustomerControlNote(
                        appointment,
                        timeZone,
                      );
                      const openDayHref = `${buildFilterHref(
                        "/dashboard/gestao/agendamentos",
                        searchParams,
                        {
                          day: appointmentDay,
                          status: undefined,
                          message: undefined,
                          tone: undefined,
                          view: "day",
                        },
                      )}#appointment-${appointment.id}`;

                      return (
                        <article
                          key={`stale-${appointment.id}`}
                          className={styles.staleCard}
                        >
                          <div className={styles.staleCardHeader}>
                            <strong>{appointment.customerName}</strong>
                            <span>
                              {formatOverdueWindow(appointment.ends_at)}
                            </span>
                          </div>

                          <p>
                            {formatAgendaDaySummary(appointmentDay, timeZone)} -{" "}
                            {formatTimeInput(appointment.date, timeZone)} -{" "}
                            {appointment.professionalName}
                          </p>
                          <p>
                            {appointment.serviceName}
                            {appointment.isMembershipPlanAppointment &&
                            appointment.membershipSessionIndex &&
                            appointment.membershipSessionsIncluded
                              ? ` - Plano ${appointment.membershipSessionIndex}/${appointment.membershipSessionsIncluded}`
                              : ""}
                          </p>
                          <div className={styles.staleSignalRow}>
                            {customerSignals.map((signal) => (
                              <span
                                key={`${appointment.id}-${signal}`}
                                className={styles.staleSignal}
                              >
                                {signal}
                              </span>
                            ))}
                          </div>
                          <p>{customerControlNote}</p>

                          <div
                            className={`inline-actions ${styles.staleActions}`}
                          >
                            <AsyncActionForm
                              action={updateManagementAppointmentStatusAction}
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="completed"
                              />
                              <button type="submit" className="primary-button">
                                Concluir atendimento
                              </button>
                            </AsyncActionForm>

                            <AsyncActionForm
                              action={updateManagementAppointmentStatusAction}
                            >
                              <input
                                type="hidden"
                                name="returnPath"
                                value={returnPath}
                              />
                              <input
                                type="hidden"
                                name="appointmentId"
                                value={appointment.id}
                              />
                              <input
                                type="hidden"
                                name="status"
                                value="no_show"
                              />
                              <button type="submit" className="secondary-button">
                                Marcar falta
                              </button>
                            </AsyncActionForm>

                            <a href={openDayHref} className="secondary-button">
                              Abrir dia
                            </a>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                ) : null}
              </article>
            </section>
            ) : null}
          </section>
        </section>
      </div>
    </AsyncActionNoticeRegion>
  );
}




