import { defaultGrowthAutomationDashboard } from "@/app/dashboard/benefits/_shared-lib";
import { computeDayOccupancySnapshot } from "@/lib/ai/operationalScores";
import { isOpenRouterEnabled } from "@/lib/ai/openrouter";
import {
  getRecoveryCampaignSnapshot,
  type RecoveryCampaignSnapshot,
} from "@/lib/ai/recoveryCampaign";
import { requireOwnerSalon } from "@/lib/auth";
import { getUtcRangeForLocalDate, getLocalDateKey } from "@/lib/management";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";
import { createClient } from "@/lib/supabase/server";

type JsonRecord = Record<string, unknown>;

type StaffScheduleContextRow = {
  closes_at_utc: string;
  is_open: boolean;
  opens_at_utc: string;
};

type SalonScheduleContextRow = {
  closes_at: string;
  closes_at_utc: string;
  is_open: boolean;
  opens_at: string;
  opens_at_utc: string;
  slot_step_minutes: number;
  timezone: string;
};

type StaffMemberRow = {
  id: string;
  name: string;
};

type StaffBlockRow = {
  ends_at: string;
  id: string;
  reason: string | null;
  staff_members:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
  starts_at: string;
};

type AppointmentStatusRow = {
  customer_confirmation_requested_at: string | null;
  customer_presence_confirmed_at: string | null;
  id: string;
  status: string;
};

type VacancyAlertRow = {
  ends_at: string;
  headline: string;
  id: string;
  services:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
  staff_members:
    | {
        name: string | null;
      }
    | Array<{
        name: string | null;
      }>
    | null;
  starts_at: string;
};

type AgendaSyncSourceTone = "accent" | "soft" | "success" | "warn";

export type AgendaIntelligenceSyncSource = {
  id: string;
  label: string;
  note: string;
  status: string;
  tone: AgendaSyncSourceTone;
};

export type AgendaIntelligenceSignal = {
  id: string;
  label: string;
  note: string;
  value: string;
};

export type AgendaIntelligenceOpportunity = {
  agendaHref: string;
  compatibleServiceCount: number;
  compatibleServices: string[];
  detail: string;
  gapLabel: string;
  headline: string;
  id: string;
  staffName: string;
  suggestedServiceLabel: string;
  windowLabel: string;
};

export type AgendaIntelligenceWorkflowStep = {
  description: string;
  id: string;
  title: string;
};

export type AgendaIntelligencePageData = {
  aiEnabled: boolean;
  agendaHref: string;
  campaignQuestion: string;
  dayKey: string;
  dayLabel: string;
  fillSignals: AgendaIntelligenceSignal[];
  fillSummary: string;
  nextDayHref: string;
  opportunities: AgendaIntelligenceOpportunity[];
  previousDayHref: string;
  recoverySnapshot: RecoveryCampaignSnapshot;
  syncSources: AgendaIntelligenceSyncSource[];
  syncSummary: string;
  workflow: AgendaIntelligenceWorkflowStep[];
};

function readJsonRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function readJsonArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function cleanText(value: string | null | undefined, fallback: string) {
  const normalized = (value ?? "").replace(/\s+/g, " ").trim();
  return normalized || fallback;
}

function capitalizeLabel(value: string) {
  if (!value) {
    return value;
  }

  return value[0].toUpperCase() + value.slice(1);
}

function parseDayKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function shiftDay(dayKey: string, offset: number) {
  const next = parseDayKey(dayKey);
  next.setUTCDate(next.getUTCDate() + offset);
  return next.toISOString().slice(0, 10);
}

function formatDayLabel(dayKey: string, timeZone: string) {
  return capitalizeLabel(
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone,
    }).format(parseDayKey(dayKey)),
  );
}

function formatTimeLabel(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function buildWindowLabel(
  startAt: string | null,
  endAt: string | null,
  timeZone: string,
) {
  if (!startAt || !endAt) {
    return "Sem janela configurada";
  }

  return `${formatTimeLabel(startAt, timeZone)} às ${formatTimeLabel(
    endAt,
    timeZone,
  )}`;
}

function formatCountLabel(
  count: number,
  singular: string,
  plural: string,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function formatGapKindLabel(value: string) {
  switch (value) {
    case "between_appointments":
      return "Entre atendimentos";
    case "before_first":
      return "Antes do primeiro horário";
    case "after_last":
      return "Depois do último horário";
    case "open_day":
      return "Agenda aberta no dia";
    default:
      return "Janela detectada";
  }
}

function buildDayQuestion(dayKey: string, timeZone: string, todayKey: string) {
  if (dayKey === todayKey) {
    return "Preencher agenda de hoje com IA";
  }

  const tomorrowKey = shiftDay(todayKey, 1);
  if (dayKey === tomorrowKey) {
    return "Preencher agenda de amanhã com IA";
  }

  const weekdayLabel = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    timeZone,
  }).format(parseDayKey(dayKey));

  return `Preencher agenda de ${weekdayLabel} com IA`;
}

function buildOpportunityItems(args: {
  dayKey: string;
  payload: JsonRecord | null;
  timeZone: string;
}): AgendaIntelligenceOpportunity[] {
  const suggestions = readJsonArray(args.payload?.suggestions);

  return suggestions
    .map((rawItem, index) => {
      const item = readJsonRecord(rawItem);
      if (!item) {
        return null;
      }

      const compatibleServices = readJsonArray(item.compatible_services)
        .map((rawService) => {
          const service = readJsonRecord(rawService);
          if (!service) {
            return null;
          }

          const serviceName = cleanText(
            typeof service.name === "string" ? service.name : null,
            "Serviço disponível",
          );
          const duration =
            typeof service.duration === "number" ? `${service.duration} min` : null;
          const category =
            typeof service.category === "string" && service.category.trim()
              ? service.category.trim()
              : null;

          return [serviceName, duration, category].filter(Boolean).join(" • ");
        })
        .filter((value): value is string => Boolean(value))
        .slice(0, 3);

      const suggestedService = readJsonRecord(item.suggested_service);
      const suggestedServiceName = cleanText(
        typeof suggestedService?.name === "string"
          ? suggestedService.name
          : null,
        "Serviço sugerido pelo encaixe",
      );
      const suggestedServiceCategory =
        typeof suggestedService?.category === "string"
          ? suggestedService.category.trim()
          : "";
      const suggestedServiceLabel = suggestedServiceCategory
        ? `${suggestedServiceName} • ${suggestedServiceCategory}`
        : suggestedServiceName;
      const suggestedStart =
        typeof item.suggested_start === "string" ? item.suggested_start : null;
      const suggestedEnd =
        typeof item.suggested_end === "string" ? item.suggested_end : null;

      return {
        agendaHref: `${MANAGEMENT_ROUTES.appointments}?day=${args.dayKey}`,
        compatibleServiceCount:
          typeof item.compatible_service_count === "number"
            ? item.compatible_service_count
            : compatibleServices.length,
        compatibleServices:
          compatibleServices.length > 0
            ? compatibleServices
            : ["Sem serviços compatíveis detalhados"],
        detail: cleanText(
          typeof item.detail === "string" ? item.detail : null,
          "Janela identificada para trabalhar encaixe sem conflito.",
        ),
        gapLabel: formatGapKindLabel(
          typeof item.gap_kind === "string" ? item.gap_kind : "",
        ),
        headline: cleanText(
          typeof item.headline === "string" ? item.headline : null,
          "Janela de encaixe detectada",
        ),
        id:
          typeof item.staff_member_id === "string"
            ? `${item.staff_member_id}-${index}`
            : `opportunity-${index}`,
        staffName: cleanText(
          typeof item.staff_member_name === "string"
            ? item.staff_member_name
            : null,
          "Equipe do salão",
        ),
        suggestedServiceLabel,
        windowLabel: buildWindowLabel(suggestedStart, suggestedEnd, args.timeZone),
      } satisfies AgendaIntelligenceOpportunity;
    })
    .filter((item): item is AgendaIntelligenceOpportunity => Boolean(item));
}

export async function loadAgendaIntelligencePageData(args?: {
  day?: string;
}): Promise<AgendaIntelligencePageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const dayKey =
    args?.day && /^\d{4}-\d{2}-\d{2}$/.test(args.day) ? args.day : todayKey;
  const dayRange = getUtcRangeForLocalDate(dayKey, timeZone);
  const aiEnabled = isOpenRouterEnabled();

  const [
    salonScheduleResult,
    staffMembersResult,
    appointmentsResult,
    blocksResult,
    vacancyAlertsResult,
    growthDashboardResult,
    occupancySnapshot,
    smartScheduleResult,
    recoverySnapshot,
  ] = await Promise.all([
    supabase.rpc("get_salon_schedule_context", {
      target_day: dayKey,
      target_salon_id: salon.id,
    }),
    supabase
      .from("staff_members")
      .select("id,name")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("is_default", false)
      .order("name", { ascending: true }),
    supabase
      .from("appointments")
      .select(
        "id,status,customer_confirmation_requested_at,customer_presence_confirmed_at",
      )
      .eq("salon_id", salon.id)
      .gte("date", dayRange.start.toISOString())
      .lt("date", dayRange.end.toISOString()),
    supabase
      .from("staff_blocks")
      .select("id,starts_at,ends_at,reason,staff_members(name)")
      .eq("salon_id", salon.id)
      .lt("starts_at", dayRange.end.toISOString())
      .gt("ends_at", dayRange.start.toISOString())
      .order("starts_at", { ascending: true }),
    (supabase as any)
      .from("salon_vacancy_alerts")
      .select("id,headline,starts_at,ends_at,services(name),staff_members(name)")
      .eq("salon_id", salon.id)
      .gte("starts_at", dayRange.start.toISOString())
      .lt("starts_at", dayRange.end.toISOString())
      .order("starts_at", { ascending: true })
      .limit(6),
    supabase.rpc("get_salon_growth_automation_dashboard"),
    computeDayOccupancySnapshot({
      dayKey,
      now: new Date(),
      salon: {
        id: salon.id,
        slot_step_minutes: salon.slot_step_minutes,
        timezone: timeZone,
      },
      supabase,
    }),
    supabase.rpc("get_smart_schedule_opportunities", {
      target_day: dayKey,
    }),
    getRecoveryCampaignSnapshot({
      question: buildDayQuestion(dayKey, timeZone, todayKey),
      salon: {
        id: salon.id,
        name: salon.name,
        slot_step_minutes: salon.slot_step_minutes,
        timezone: timeZone,
      },
      supabase,
    }),
  ]);

  if (salonScheduleResult.error) {
    throw salonScheduleResult.error;
  }

  if (staffMembersResult.error) {
    throw staffMembersResult.error;
  }

  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  if (blocksResult.error) {
    throw blocksResult.error;
  }

  if (vacancyAlertsResult.error) {
    throw vacancyAlertsResult.error;
  }

  const salonSchedule = ((salonScheduleResult.data ?? [])[0] ??
    null) as SalonScheduleContextRow | null;
  const staffMembers = (staffMembersResult.data ?? []) as StaffMemberRow[];
  const staffMemberIds = staffMembers.map((item) => item.id);
  const assignmentsResult = staffMemberIds.length
    ? await supabase
        .from("staff_service_assignments")
        .select("staff_member_id,service_id")
        .in("staff_member_id", staffMemberIds)
    : { data: [], error: null };

  if (assignmentsResult.error) {
    throw assignmentsResult.error;
  }

  const assignments = (assignmentsResult.data ?? []) as Array<{
    service_id: string;
    staff_member_id: string;
  }>;
  const appointments = (appointmentsResult.data ?? []) as AppointmentStatusRow[];
  const blocks = (blocksResult.data ?? []) as StaffBlockRow[];
  const vacancyAlerts = (vacancyAlertsResult.data ?? []) as VacancyAlertRow[];
  const growthDashboard = (growthDashboardResult.data ??
    defaultGrowthAutomationDashboard()) as ReturnType<
    typeof defaultGrowthAutomationDashboard
  >;
  const smartSchedulePayload = readJsonRecord(smartScheduleResult.data);
  const opportunities = buildOpportunityItems({
    dayKey,
    payload: smartSchedulePayload,
    timeZone,
  });

  const staffContexts = await Promise.all(
    staffMembers.map(async (staffMember) => {
      const result = await supabase.rpc("get_staff_schedule_context", {
        target_day: dayKey,
        target_staff_member_id: staffMember.id,
      });

      const context = ((result.data ?? [])[0] ?? null) as
        | StaffScheduleContextRow
        | null;

      return {
        context,
        staffMember,
      };
    }),
  );

  const onDutyStaff = staffContexts.filter(
    (item) =>
      item.context?.is_open &&
      item.context.opens_at_utc &&
      item.context.closes_at_utc,
  );
  const assignedServiceIds = new Set(assignments.map((item) => item.service_id));
  const pendingOrConfirmedCount = appointments.filter(
    (appointment) =>
      appointment.status === "pending" || appointment.status === "confirmed",
  ).length;
  const confirmationPendingCount = appointments.filter(
    (appointment) =>
      Boolean(appointment.customer_confirmation_requested_at) &&
      !appointment.customer_presence_confirmed_at &&
      (appointment.status === "pending" || appointment.status === "confirmed"),
  ).length;
  const nextBlock = blocks[0] ?? null;
  const nextBlockStaff = firstRelation(nextBlock?.staff_members);
  const nextBlockLabel = nextBlock
    ? `${cleanText(nextBlockStaff?.name, "Equipe")} • ${buildWindowLabel(
        nextBlock.starts_at,
        nextBlock.ends_at,
        timeZone,
      )}`
    : "Sem bloqueio ou folga registrada";
  const dayLabel = formatDayLabel(dayKey, timeZone);
  const occupancyLabel =
    occupancySnapshot.occupancyPercent == null
      ? "Sem leitura"
      : `${occupancySnapshot.occupancyPercent}%`;
  const dueNowCustomers =
    (growthDashboard.overview?.due_now_customers ?? 0) +
    (growthDashboard.overview?.at_risk_customers ?? 0);
  const smartRebookDueCustomers =
    growthDashboard.overview?.smart_rebook_due_customers ?? 0;

  const syncSources: AgendaIntelligenceSyncSource[] = [
    {
      id: "salon-schedule",
      label: "Agenda do salão",
      note: salonSchedule?.is_open
        ? `${buildWindowLabel(
            salonSchedule.opens_at_utc,
            salonSchedule.closes_at_utc,
            timeZone,
          )} • passo de ${salonSchedule.slot_step_minutes} min`
        : "Revise a abertura do salão antes de liberar horários neste dia.",
      status: salonSchedule?.is_open ? "Sincronizada para o dia" : "Fechada neste dia",
      tone: salonSchedule?.is_open ? "success" : "warn",
    },
    {
      id: "staff-on-duty",
      label: "Profissionais em operação",
      note:
        onDutyStaff.length > 0
          ? onDutyStaff
              .slice(0, 4)
              .map((item) => item.staffMember.name)
              .join(", ")
          : "Nenhum profissional com expediente aberto neste dia.",
      status: `${onDutyStaff.length} de ${staffMembers.length} profissionais com expediente aberto`,
      tone: onDutyStaff.length > 0 ? "accent" : "warn",
    },
    {
      id: "service-scope",
      label: "Serviços aptos para encaixe",
      note: `${formatCountLabel(
        assignments.length,
        "combinação profissional + serviço",
        "combinações profissional + serviço",
      )} ativas nesta base.`,
      status: `${formatCountLabel(
        assignedServiceIds.size,
        "serviço ligado",
        "serviços ligados",
      )}`,
      tone: assignedServiceIds.size > 0 ? "success" : "warn",
    },
    {
      id: "exceptions",
      label: "Folgas, bloqueios e ajustes",
      note: nextBlockLabel,
      status:
        blocks.length > 0
          ? `${formatCountLabel(blocks.length, "ajuste no dia", "ajustes no dia")}`
          : "Sem ajuste bloqueando a agenda",
      tone: blocks.length > 0 ? "soft" : "success",
    },
    {
      id: "confirmations",
      label: "Confirmações e agenda viva",
      note: `${formatCountLabel(
        pendingOrConfirmedCount,
        "horário em andamento",
        "horários em andamento",
      )} entre pendentes e confirmados neste dia.`,
      status:
        confirmationPendingCount > 0
          ? `${formatCountLabel(
              confirmationPendingCount,
              "resposta pendente",
              "respostas pendentes",
            )}`
          : "Sem resposta pendente agora",
      tone: confirmationPendingCount > 0 ? "soft" : "success",
    },
  ];

  const fillSignals: AgendaIntelligenceSignal[] = [
    {
      id: "occupancy",
      label: "Ocupação do dia",
      note: `${occupancySnapshot.openSlotsCount} horário(s) ainda livres pela leitura atual.`,
      value: occupancyLabel,
    },
    {
      id: "vacancies",
      label: "Vagas abertas",
      note:
        vacancyAlerts.length > 0
          ? cleanText(vacancyAlerts[0]?.headline, "Janela detectada para agir.")
          : "Sem cancelamento aberto pedindo reencaixe neste dia.",
      value: String(vacancyAlerts.length),
    },
    {
      id: "return-base",
      label: "Clientes prontos para retorno",
      note: "Soma clientes em atenção e base que já vale reacender.",
      value: String(dueNowCustomers),
    },
    {
      id: "smart-rebook",
      label: "Lembretes de retorno",
      note: "Clientes que já estão na janela certa para convite de retorno.",
      value: String(smartRebookDueCustomers),
    },
  ];

  const syncSummary =
    salonSchedule?.is_open && onDutyStaff.length > 0
      ? `A agenda de ${dayLabel.toLowerCase()} já cruza horário do salão, equipe disponível, serviços ligados e ajustes do dia antes de liberar encaixe.`
      : `Antes de vender horários em ${dayLabel.toLowerCase()}, vale revisar abertura do salão, equipe do dia e ajustes que podem travar a agenda.`;

  const fillSummary =
    opportunities.length > 0
      ? `Encontrei ${formatCountLabel(
          opportunities.length,
          "janela com potencial de encaixe",
          "janelas com potencial de encaixe",
        )} e ${formatCountLabel(
          dueNowCustomers,
          "cliente em momento de retorno",
          "clientes em momento de retorno",
        )} para trabalhar sem espalhar ação para a base inteira.`
      : recoverySnapshot.available
        ? recoverySnapshot.summary
        : "Ainda não apareceu uma janela forte para ação neste dia, mas o módulo continua cruzando ocupação, bloqueios, retorno e vagas abertas.";

  const workflow: AgendaIntelligenceWorkflowStep[] = [
    {
      id: "sync",
      title: "1. Agenda sincronizada",
      description:
        "O painel cruza horário do salão, profissionais, serviços habilitados e bloqueios antes de mostrar disponibilidade real.",
    },
    {
      id: "detect",
      title: "2. IA detecta oportunidade",
      description:
        "Quando a agenda abre espaço, a leitura aponta a melhor janela, o profissional certo e a base com maior chance de voltar.",
    },
    {
      id: "confirm",
      title: "3. Você confirma e executa",
      description:
        "Nada dispara sozinho. A IA sugere, você revisa a campanha e só então publica ou chama a cliente.",
    },
  ];

  return {
    aiEnabled,
    agendaHref: `${MANAGEMENT_ROUTES.appointments}?day=${dayKey}`,
    campaignQuestion: buildDayQuestion(dayKey, timeZone, todayKey),
    dayKey,
    dayLabel,
    fillSignals,
    fillSummary,
    nextDayHref: `${MANAGEMENT_ROUTES.smartAgenda}?day=${shiftDay(dayKey, 1)}`,
    opportunities,
    previousDayHref: `${MANAGEMENT_ROUTES.smartAgenda}?day=${shiftDay(dayKey, -1)}`,
    recoverySnapshot,
    syncSources,
    syncSummary,
    workflow,
  };
}
