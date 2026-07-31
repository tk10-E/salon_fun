import type {
  AssistantManagementScore,
  AssistantOperationalContext,
  AssistantOperationalDiagnosis,
  AssistantOperationalOpportunity,
  AssistantPriority,
  AssistantProactiveAlert,
  AssistantQuickAction,
} from "@/lib/ai/skills/types";
import { resolveBookedAppointmentAmount } from "@/lib/financialMetrics";
import { getLocalDateKey } from "@/lib/management";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

import {
  executePanelAssistantTool,
  type PanelAssistantToolResultMap,
} from "./executor";
import { cleanAiText } from "./guardrails";
import { getPanelAssistantToolDefinition } from "./tools";

type OperationalSalonContext = {
  id: string;
  name: string;
  slot_step_minutes?: number | null;
  timezone?: string | null;
};

type FinanceAppointment =
  PanelAssistantToolResultMap["getFaturamento"]["appointments"][number];
type InactiveCustomer =
  PanelAssistantToolResultMap["getClientesInativos"]["customers"][number];
type RecoveryResult = PanelAssistantToolResultMap["sugerirEncaixes"];
type ServiceReference = PanelAssistantToolResultMap["getAgenda"]["services"][number];
type StaffReference = PanelAssistantToolResultMap["getAgenda"]["staffMembers"][number];

type ScoreMetricKey =
  | "cancellations"
  | "occupancy"
  | "productivity"
  | "recurringCustomers"
  | "revenue"
  | "vacancies";

type OperationalIntelligenceSnapshot = {
  activeServices: ServiceReference[];
  cancellationsLast7d: number;
  financeAppointments: FinanceAppointment[];
  inactiveCustomers: InactiveCustomer[];
  operationalContext: AssistantOperationalContext | null;
  recoveryOpportunity: RecoveryResult;
  staffMembers: StaffReference[];
};

export type OperationalIntelligenceReport = {
  diagnoses: AssistantOperationalDiagnosis[];
  missingData: string[];
  opportunities: AssistantOperationalOpportunity[];
  primaryDiagnosis: AssistantOperationalDiagnosis | null;
  primaryOpportunity: AssistantOperationalOpportunity | null;
  priority: AssistantPriority;
  proactiveAlerts: AssistantProactiveAlert[];
  score: AssistantManagementScore | null;
};

export type OperationalManagerialReadout = {
  actions: AssistantQuickAction[];
  bullets: string[];
  ctaHref: string | null;
  ctaLabel: string | null;
  followUp: string | null;
  impact: string | null;
  missingData: string[];
  operationalContext: AssistantOperationalContext | null;
  priority: AssistantPriority;
  problem: string | null;
  recommendedAction: string | null;
  report: OperationalIntelligenceReport;
  suggestion: string | null;
  summary: string;
  title: string;
};

type OperationalManagerialArgs = {
  actorUserId?: string | null;
  conversationId?: string | null;
  operationalContext?: AssistantOperationalContext | null;
  permissions?: string[];
  question: string;
  requestOrigin?: string | null;
  salon: OperationalSalonContext;
  supabase: any;
  now?: Date;
};

type RankedService = {
  category: string | null;
  currentCount: number;
  currentRevenue: number;
  name: string;
  previousCount: number;
  previousRevenue: number;
};

type RankedStaff = {
  appointmentCount: number;
  id: string;
  name: string;
  revenue: number;
};

const INSUFFICIENT_DATA_MESSAGE =
  "Nao encontrei dados suficientes para afirmar isso.";
const DAY_IN_MS = 24 * 60 * 60 * 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizeSearchText(value: string | null | undefined) {
  return cleanAiText(value, 300)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    currency: "BRL",
    minimumFractionDigits: 2,
    style: "currency",
  }).format(value);
}

function formatPercent(value: number) {
  return `${Math.abs(Math.round(value))}%`;
}

function calculateDeltaPercent(current: number, previous: number) {
  if (previous <= 0) {
    if (current <= 0) {
      return 0;
    }

    return 100;
  }

  return Math.round(((current - previous) / previous) * 100);
}

function buildToolAction(
  toolId: Parameters<typeof getPanelAssistantToolDefinition>[0],
  kind?: AssistantQuickAction["kind"],
) {
  const definition = getPanelAssistantToolDefinition(toolId);

  return {
    ...definition.quickAction,
    kind: kind ?? definition.quickAction.kind,
  } satisfies AssistantQuickAction;
}

function dedupeActions(actions: AssistantQuickAction[]) {
  const seen = new Set<string>();

  return actions.filter((action) => {
    const key = `${action.kind}:${action.href}:${action.label}`;

    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function sortDiagnoses(diagnoses: AssistantOperationalDiagnosis[]) {
  return [...diagnoses].sort((left, right) => {
    if (left.severity !== right.severity) {
      return left.severity === "critical" ? -1 : 1;
    }

    return left.title.localeCompare(right.title, "pt-BR");
  });
}

function scoreWeights() {
  return {
    cancellations: 15,
    occupancy: 20,
    productivity: 15,
    recurringCustomers: 15,
    revenue: 20,
    vacancies: 15,
  } satisfies Record<ScoreMetricKey, number>;
}

function buildScoreStatusLabel(value: number) {
  if (value >= 85) {
    return "Operacao forte";
  }

  if (value >= 70) {
    return "Saudavel com ajustes";
  }

  if (value >= 50) {
    return "Atencao operacional";
  }

  return "Risco alto";
}

function buildComboSuggestion(serviceName: string, categoryName: string | null) {
  const normalized = normalizeSearchText(`${categoryName ?? ""} ${serviceName}`);

  if (normalized.includes("corte")) {
    return "Monte um combo com barba, finalizacao ou tratamento rapido para elevar o ticket.";
  }

  if (normalized.includes("escova") || normalized.includes("color")) {
    return "Puxe um combo com tratamento, hidratacao ou finalizacao premium para aumentar o ticket.";
  }

  if (normalized.includes("manicure") || normalized.includes("pedicure")) {
    return "Teste um combo manicure + pedicure ou spa para aumentar recorrencia sem travar a agenda.";
  }

  if (normalized.includes("sobrancelha")) {
    return "Sugira um combo com henna ou design complementar para aproveitar melhor a mesma visita.";
  }

  return "Use um combo simples com servico complementar para elevar ticket e recorrencia.";
}

function countRecoveryPrompt(question: string) {
  const normalized = normalizeSearchText(question);

  if (normalized.includes("hoje")) {
    return "Preencher agenda com IA hoje";
  }

  if (normalized.includes("amanha")) {
    return "Preencher agenda com IA amanha";
  }

  return "Preencher agenda com IA amanha";
}

function resolveAppointmentTimestamp(appointment: FinanceAppointment) {
  return new Date(appointment.completed_at ?? appointment.date).getTime();
}

function buildServiceRankings(args: {
  activeServices: ServiceReference[];
  financeAppointments: FinanceAppointment[];
  now: Date;
}) {
  const currentWindowStart = args.now.getTime() - 30 * DAY_IN_MS;
  const previousWindowStart = args.now.getTime() - 60 * DAY_IN_MS;
  const serviceMap = new Map<string, RankedService>();

  for (const service of args.activeServices) {
    serviceMap.set(service.name, {
      category: service.category ?? null,
      currentCount: 0,
      currentRevenue: 0,
      name: service.name,
      previousCount: 0,
      previousRevenue: 0,
    });
  }

  for (const appointment of args.financeAppointments) {
    const service = firstRelation(appointment.services);
    const serviceName = cleanAiText(service?.name, 80);

    if (!serviceName) {
      continue;
    }

    const entry = serviceMap.get(serviceName) ?? {
      category: service?.category ?? null,
      currentCount: 0,
      currentRevenue: 0,
      name: serviceName,
      previousCount: 0,
      previousRevenue: 0,
    };
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const timestamp = resolveAppointmentTimestamp(appointment);

    if (timestamp >= currentWindowStart) {
      entry.currentCount += 1;
      entry.currentRevenue += amount;
    } else if (timestamp >= previousWindowStart) {
      entry.previousCount += 1;
      entry.previousRevenue += amount;
    }

    serviceMap.set(serviceName, entry);
  }

  const ranking = [...serviceMap.values()];
  const topService =
    [...ranking]
      .filter((item) => item.currentCount > 0)
      .sort((left, right) => {
        if (right.currentRevenue !== left.currentRevenue) {
          return right.currentRevenue - left.currentRevenue;
        }

        return right.currentCount - left.currentCount;
      })[0] ?? null;
  const lowDemandService =
    [...ranking]
      .filter(
        (item) =>
          (item.currentCount > 0 || item.previousCount > 0) &&
          (item.currentCount <= 1 ||
            item.currentCount < item.previousCount ||
            item.previousCount > 0),
      )
      .sort((left, right) => {
        const leftDelta = left.currentCount - left.previousCount;
        const rightDelta = right.currentCount - right.previousCount;

        if (left.currentCount !== right.currentCount) {
          return left.currentCount - right.currentCount;
        }
        if (leftDelta !== rightDelta) {
          return leftDelta - rightDelta;
        }

        return left.name.localeCompare(right.name, "pt-BR");
      })[0] ?? null;

  return { lowDemandService, topService };
}

function buildRevenueMetrics(args: {
  financeAppointments: FinanceAppointment[];
  now: Date;
}) {
  const currentWindowStart = args.now.getTime() - 7 * DAY_IN_MS;
  const previousWindowStart = args.now.getTime() - 14 * DAY_IN_MS;
  let currentRevenue = 0;
  let previousRevenue = 0;
  let currentCompletedCount = 0;

  for (const appointment of args.financeAppointments) {
    const service = firstRelation(appointment.services);
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const timestamp = resolveAppointmentTimestamp(appointment);

    if (timestamp >= currentWindowStart) {
      currentRevenue += amount;
      currentCompletedCount += 1;
    } else if (timestamp >= previousWindowStart) {
      previousRevenue += amount;
    }
  }

  return {
    currentCompletedCount,
    currentRevenue,
    deltaPercent: calculateDeltaPercent(currentRevenue, previousRevenue),
    previousRevenue,
  };
}

function buildRecurringMetrics(financeAppointments: FinanceAppointment[]) {
  const customers = new Map<string, number>();

  for (const appointment of financeAppointments) {
    if (!appointment.customer_id) {
      continue;
    }

    customers.set(
      appointment.customer_id,
      (customers.get(appointment.customer_id) ?? 0) + 1,
    );
  }

  const recurringCustomers = [...customers.values()].filter((count) => count >= 2).length;
  const ratio = customers.size > 0 ? recurringCustomers / customers.size : null;

  return {
    ratio,
    recurringCustomers,
    uniqueCustomers: customers.size,
  };
}

function buildStaffMetrics(args: {
  financeAppointments: FinanceAppointment[];
  staffMembers: StaffReference[];
}) {
  const counters = new Map<string, RankedStaff>(
    args.staffMembers.map((staffMember) => [
      staffMember.id,
      {
        appointmentCount: 0,
        id: staffMember.id,
        name: staffMember.name,
        revenue: 0,
      },
    ]),
  );
  let observedAppointments = 0;

  for (const appointment of args.financeAppointments) {
    if (!appointment.staff_member_id) {
      continue;
    }

    const current = counters.get(appointment.staff_member_id);

    if (!current) {
      continue;
    }

    observedAppointments += 1;
    const service = firstRelation(appointment.services);
    current.appointmentCount += 1;
    current.revenue += resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
  }

  const ranking = [...counters.values()].sort((left, right) => {
    if (left.appointmentCount !== right.appointmentCount) {
      return left.appointmentCount - right.appointmentCount;
    }

    return left.name.localeCompare(right.name, "pt-BR");
  });
  const activeWithVisits = ranking.filter((item) => item.appointmentCount > 0).length;
  const hasRecentActivityBase = observedAppointments > 0;
  const idleStaff = hasRecentActivityBase
    ? ranking.filter((item) => item.appointmentCount <= 1)
    : [];
  const ratio =
    hasRecentActivityBase && args.staffMembers.length > 0
      ? activeWithVisits / args.staffMembers.length
      : null;

  return {
    activeWithVisits,
    hasRecentActivityBase,
    idleStaff,
    ratio,
  };
}

function buildScore(args: {
  cancellationsLast7d: number;
  currentCompletedCount: number;
  deltaPercent: number;
  hasRecurringBase: boolean;
  hasRevenueBase: boolean;
  hasVacancyBase: boolean;
  idleRatio: number | null;
  openSlotsCount: number;
  occupancyPercent: number | null;
  recurringRatio: number | null;
}): AssistantManagementScore | null {
  const cancellationRate =
    args.currentCompletedCount + args.cancellationsLast7d > 0
      ? args.cancellationsLast7d /
        (args.currentCompletedCount + args.cancellationsLast7d)
      : null;
  const score: AssistantManagementScore = {
    cancellations:
      cancellationRate == null
        ? null
        : clamp(Math.round(100 - cancellationRate * 300), 0, 100),
    occupancy:
      args.occupancyPercent == null
        ? null
        : clamp(Math.round(args.occupancyPercent * 1.1), 0, 100),
    overall: 0,
    productivity:
      args.idleRatio == null
        ? null
        : clamp(Math.round(25 + args.idleRatio * 75), 0, 100),
    recurringCustomers:
      !args.hasRecurringBase || args.recurringRatio == null
        ? null
        : clamp(Math.round(30 + args.recurringRatio * 70), 0, 100),
    revenue: args.hasRevenueBase
      ? clamp(Math.round(75 + args.deltaPercent), 0, 100)
      : null,
    statusLabel: "",
    vacancies: args.hasVacancyBase
      ? clamp(Math.round(100 - args.openSlotsCount * 12), 0, 100)
      : null,
  };
  const weights = scoreWeights();
  const weightedEntries = (
    Object.entries(weights) as Array<[ScoreMetricKey, number]>
  ).filter(([key]) => score[key] != null);

  if (weightedEntries.length < 2) {
    return null;
  }

  const totalWeight = weightedEntries.reduce((sum, [, weight]) => sum + weight, 0);
  const weightedSum = weightedEntries.reduce(
    (sum, [key, weight]) => sum + (score[key] ?? 0) * weight,
    0,
  );

  score.overall =
    totalWeight > 0 ? clamp(Math.round(weightedSum / totalWeight), 0, 100) : 0;
  score.statusLabel = buildScoreStatusLabel(score.overall);

  return score;
}

function buildDiagnoses(args: {
  cancellationsLast7d: number;
  currentCompletedCount: number;
  deltaPercent: number;
  idleStaff: RankedStaff[];
  inactiveCustomers: InactiveCustomer[];
  lowDemandService: RankedService | null;
  occupancyPercent: number | null;
  openSlotsCount: number;
}) {
  const diagnoses: AssistantOperationalDiagnosis[] = [];
  const cancellationRate =
    args.currentCompletedCount + args.cancellationsLast7d > 0
      ? args.cancellationsLast7d /
        (args.currentCompletedCount + args.cancellationsLast7d)
      : 0;

  if (args.occupancyPercent != null && args.occupancyPercent < 55) {
    diagnoses.push({
      actions: [buildToolAction("getAgenda"), buildToolAction("sugerirEncaixes", "secondary")],
      code: "low_occupancy",
      impact:
        "A agenda de amanha pode pressionar o caixa e deixar equipe ociosa se nada mudar hoje.",
      metricLabel: `${Math.round(args.occupancyPercent)}% de ocupacao prevista`,
      problem:
        args.occupancyPercent < 35
          ? "Amanha esta com ocupacao baixa para o nivel da operacao."
          : "Amanha esta abaixo do ritmo ideal de ocupacao.",
      recommendedAction:
        "Abra a agenda inteligente e priorize reativacao ou campanha para preencher as janelas mais fracas.",
      severity: args.occupancyPercent < 35 ? "critical" : "warning",
      suggestion:
        "Ataque primeiro as janelas mais vazias com oferta leve, sem mexer na semana inteira.",
      title: "Baixa ocupacao",
    });
  }

  if (args.deltaPercent <= -12) {
    diagnoses.push({
      actions: [buildToolAction("getFaturamento"), buildToolAction("criarCampanha", "secondary")],
      code: "revenue_drop",
      impact:
        "Se a queda continuar, o salao perde margem e entra pressionado na agenda da proxima semana.",
      metricLabel: `${formatPercent(args.deltaPercent)} no comparativo de 7 dias`,
      problem: "O faturamento recente caiu em relacao aos 7 dias anteriores.",
      recommendedAction:
        "Abra o financeiro, valide a queda por servico e reaja primeiro nas janelas com mais chance de retorno.",
      severity: args.deltaPercent <= -25 ? "critical" : "warning",
      suggestion:
        "Concentre a reacao no servico que mais caiu, com campanha curta ou confirmacao mais ativa.",
      title: "Queda de faturamento",
    });
  }

  if (args.cancellationsLast7d >= 4 || cancellationRate >= 0.15) {
    diagnoses.push({
      actions: [buildToolAction("getCancelamentos"), buildToolAction("sugerirEncaixes", "secondary")],
      code: "high_cancellations",
      impact:
        "Cancelamentos altos criam buracos na agenda, derrubam previsibilidade e elevam risco operacional.",
      metricLabel: `${args.cancellationsLast7d} cancelamento(s) em 7 dias`,
      problem: "O volume de cancelamentos recente esta acima do nivel seguro.",
      recommendedAction:
        "Revise cancelamentos, reencaixe as janelas abertas e ajuste a confirmacao dos atendimentos mais sensiveis.",
      severity:
        args.cancellationsLast7d >= 7 || cancellationRate >= 0.25
          ? "critical"
          : "warning",
      suggestion:
        "Aja primeiro nos horarios cancelados mais proximos e nos clientes com melhor chance de retorno rapido.",
      title: "Cancelamentos em alta",
    });
  }

  if (args.openSlotsCount >= 3) {
    diagnoses.push({
      actions: [buildToolAction("sugerirEncaixes"), buildToolAction("criarCampanha", "secondary")],
      code: "high_vacancy_load",
      impact:
        "Muitos horarios vazios reduzem ocupacao, derrubam faturamento e expõem profissionais a ociosidade.",
      metricLabel: `${args.openSlotsCount} horario(s) livre(s) no radar`,
      problem: "Existem horarios vagos suficientes para exigir acao comercial agora.",
      recommendedAction:
        "Use a agenda inteligente para ocupar primeiro as janelas com cliente mais aderente e melhor chance de resposta.",
      severity: args.openSlotsCount >= 6 ? "critical" : "warning",
      suggestion:
        "Prefira campanha curta e encaixe inteligente antes de aplicar desconto amplo.",
      title: "Carga alta de horarios vagos",
    });
  }

  if (args.inactiveCustomers.length >= 5) {
    diagnoses.push({
      actions: [buildToolAction("getClientesInativos"), buildToolAction("criarCampanha", "secondary")],
      code: "inactive_customers",
      impact:
        "Clientes sem retorno representam receita perdida e pressionam o custo de aquisicao para repor movimento.",
      metricLabel: `${args.inactiveCustomers.length} cliente(s) inativo(s)`,
      problem: "A base ja mostra volume relevante de clientes sem retorno recente.",
      recommendedAction:
        "Abra o segmento de inativos e monte uma reativacao curta para quem tinha melhor historico de visitas.",
      severity: args.inactiveCustomers.length >= 12 ? "critical" : "warning",
      suggestion:
        "Comece pelos clientes com mais visitas concluidas e ticket historico mais forte.",
      title: "Clientes inativos acumulando",
    });
  }

  if (args.idleStaff.length > 0) {
    const names = args.idleStaff.slice(0, 2).map((item) => item.name).join(" e ");

    diagnoses.push({
      actions: [buildToolAction("getAgenda"), buildToolAction("getProfissionaisDisponiveis", "secondary")],
      code: "idle_professionals",
      impact:
        "Profissionais com agenda fraca reduzem produtividade da equipe e deixam oportunidade comercial na mesa.",
      metricLabel: `${args.idleStaff.length} profissional(is) com agenda baixa`,
      problem: `${names} esta(o) com baixa agenda recente em relacao ao restante da equipe.`,
      recommendedAction:
        "Revise distribuicao de horarios, servicos foco e acione oferta leve para puxar demanda para a equipe mais ociosa.",
      severity:
        args.idleStaff.length >= Math.max(2, Math.ceil(args.idleStaff.length / 2))
          ? "warning"
          : "warning",
      suggestion:
        "Evite campanha generica; empurre primeiro servicos simples com melhor margem para a equipe mais livre.",
      title: "Profissionais com baixa agenda",
    });
  }

  if (
    args.lowDemandService &&
    (args.lowDemandService.currentCount <= 1 ||
      args.lowDemandService.currentCount < args.lowDemandService.previousCount)
  ) {
    const delta = args.lowDemandService.currentCount - args.lowDemandService.previousCount;

    diagnoses.push({
      actions: [buildToolAction("getFaturamento"), buildToolAction("criarCampanha", "secondary")],
      code: "low_demand_services",
      impact:
        "Servico com baixa procura puxa o faturamento para baixo e ocupa espaco mental da operacao sem retorno proporcional.",
      metricLabel:
        delta < 0
          ? `${args.lowDemandService.previousCount} para ${args.lowDemandService.currentCount} atendimento(s)`
          : `${args.lowDemandService.currentCount} atendimento(s) no ciclo recente`,
      problem: `${args.lowDemandService.name} esta com procura abaixo do ideal no ciclo recente.`,
      recommendedAction:
        "Valide margem, oferta e horario de venda desse servico antes de ampliar desconto.",
      severity:
        args.lowDemandService.currentCount === 0 && args.lowDemandService.previousCount > 0
          ? "critical"
          : "warning",
      suggestion:
        "Se fizer sentido comercialmente, combine esse servico com um campeao de vendas para reaquecer a demanda.",
      title: "Servico com baixa procura",
    });
  }

  return sortDiagnoses(diagnoses);
}

function buildOpportunities(args: {
  idleStaff: RankedStaff[];
  inactiveCustomers: InactiveCustomer[];
  lowDemandService: RankedService | null;
  openSlotsCount: number;
  recoveryOpportunity: RecoveryResult;
  topService: RankedService | null;
}) {
  const opportunities: AssistantOperationalOpportunity[] = [];
  const topCandidateNames = args.recoveryOpportunity.candidates
    .slice(0, 3)
    .map((candidate) => candidate.name)
    .join(", ");

  if (
    args.openSlotsCount > 0 &&
    args.recoveryOpportunity.available &&
    args.recoveryOpportunity.candidates.length > 0
  ) {
    opportunities.push({
      actions: [buildToolAction("criarCampanha"), buildToolAction("sugerirEncaixes", "secondary")],
      code: "campaign_for_vacancies",
      headline: "Campanha para horarios vagos",
      prompt: "Monte uma campanha para preencher os horarios vagos mais fortes.",
      recommendedAction:
        "Abra a campanha inteligente e revise a oferta para os clientes com melhor chance de retorno.",
      summary: `${args.recoveryOpportunity.candidates.length} cliente(s) estao aderentes para ocupar ${args.openSlotsCount} horario(s) vagos.`,
    });
  }

  if (args.inactiveCustomers.length >= 3) {
    opportunities.push({
      actions: [buildToolAction("getClientesInativos"), buildToolAction("criarCampanha", "secondary")],
      code: "reactivation",
      headline: "Reativar clientes com historico forte",
      prompt: "Quais clientes inativos devo chamar primeiro?",
      recommendedAction:
        "Abra os clientes inativos e comece pelos nomes com mais visitas concluidas e maior ticket acumulado.",
      summary: `${args.inactiveCustomers.length} cliente(s) inativo(s) podem virar reativacao de curto prazo.`,
    });
  }

  if (args.topService) {
    opportunities.push({
      actions: [buildToolAction("getFaturamento"), buildToolAction("criarCampanha", "secondary")],
      code: "fill_focus",
      headline: "Foco no servico mais vendido",
      prompt: "Como usar meu servico mais vendido para puxar agenda?",
      recommendedAction:
        "Use o servico campeao como ancora comercial nas janelas mais fracas e ajuste o discurso de venda em cima dele.",
      summary: `${args.topService.name} lidera a tracao recente e pode puxar agenda e caixa com menor risco.`,
    });
  }

  if (args.topService && args.lowDemandService) {
    opportunities.push({
      actions: [buildToolAction("criarCampanha"), buildToolAction("getFaturamento", "secondary")],
      code: "combo_offer",
      headline: "Combo para destravar servico fraco",
      prompt: "Sugira um combo para aumentar a venda dos servicos fracos.",
      recommendedAction:
        "Monte uma oferta simples combinando o servico mais forte com o servico mais fraco para girar demanda sem alongar demais a agenda.",
      summary: `${args.lowDemandService.name} pode ganhar tracao com combo em cima de ${args.topService.name}. ${buildComboSuggestion(args.topService.name, args.topService.category)}`,
    });
  }

  if (args.recoveryOpportunity.available && args.recoveryOpportunity.candidates.length > 0) {
    opportunities.push({
      actions: [buildToolAction("sugerirEncaixes"), buildToolAction("getAgenda", "secondary")],
      code: "smart_fit",
      headline: "Encaixes inteligentes prontos",
      prompt: "Mostre os melhores encaixes inteligentes agora.",
      recommendedAction:
        "Use primeiro os nomes com chance alta e encaixe comprovado para reduzir o tempo ate o preenchimento da vaga.",
      summary: topCandidateNames
        ? `Os melhores encaixes agora sao ${topCandidateNames}.`
        : "Existem encaixes inteligentes prontos para acao.",
    });
  }

  if (args.idleStaff.length > 0) {
    opportunities.push({
      actions: [buildToolAction("getProfissionaisDisponiveis"), buildToolAction("criarCampanha", "secondary")],
      code: "professional_recovery",
      headline: "Puxar agenda da equipe mais livre",
      prompt: "Que acao posso fazer para os profissionais com baixa agenda?",
      recommendedAction:
        "Escolha a equipe com agenda mais fraca e concentre oferta leve, encaixe rapido e discurso ativo nesses profissionais.",
      summary: `${args.idleStaff.length} profissional(is) podem ganhar agenda com foco comercial e redistribuicao inteligente.`,
    });
  }

  return opportunities;
}

function buildProactiveAlerts(args: {
  deltaPercent: number;
  idleStaff: RankedStaff[];
  openSlotsCount: number;
  occupancyPercent: number | null;
  recoveryOpportunity: RecoveryResult;
}) {
  const alerts: AssistantProactiveAlert[] = [];

  if (args.occupancyPercent != null && args.occupancyPercent < 55) {
    alerts.push({
      actions: [buildToolAction("getAgenda"), buildToolAction("criarCampanha", "secondary")],
      code: "low_occupancy_tomorrow",
      headline: "Amanha esta com baixa ocupacao",
      prompt: "Como preencher a agenda de amanha?",
      severity: args.occupancyPercent < 35 ? "high" : "medium",
      summary: `${Math.round(args.occupancyPercent)}% de ocupacao prevista e ${args.openSlotsCount} horario(s) livre(s) no radar.`,
    });
  }

  if (args.recoveryOpportunity.candidates.length > 0) {
    alerts.push({
      actions: [buildToolAction("criarCampanha"), buildToolAction("getClientesInativos", "secondary")],
      code: "campaign_candidates",
      headline: "Existem clientes bons para campanha",
      prompt: "Monte uma campanha para os melhores clientes agora.",
      severity: args.recoveryOpportunity.candidates.length >= 10 ? "high" : "medium",
      summary: `${args.recoveryOpportunity.candidates.length} cliente(s) tem boa chance de responder a uma campanha curta.`,
    });
  }

  if (args.deltaPercent <= -12) {
    alerts.push({
      actions: [buildToolAction("getFaturamento"), buildToolAction("criarCampanha", "secondary")],
      code: "revenue_drop_recent",
      headline: "Faturamento caiu nos ultimos 7 dias",
      prompt: "Por que meu faturamento caiu nos ultimos 7 dias?",
      severity: args.deltaPercent <= -25 ? "high" : "medium",
      summary: `Queda de ${formatPercent(args.deltaPercent)} no comparativo semanal recente.`,
    });
  }

  if (args.openSlotsCount >= 3) {
    alerts.push({
      actions: [buildToolAction("sugerirEncaixes"), buildToolAction("getAgenda", "secondary")],
      code: "vacancies_today",
      headline: "Existem muitos horarios vagos no radar",
      prompt: "Quais horarios vazios devo atacar primeiro?",
      severity: args.openSlotsCount >= 6 ? "high" : "medium",
      summary: `${args.openSlotsCount} horario(s) livre(s) com chance real de acao comercial.`,
    });
  }

  if (args.idleStaff[0]) {
    alerts.push({
      actions: [buildToolAction("getProfissionaisDisponiveis"), buildToolAction("getAgenda", "secondary")],
      code: "idle_professional",
      headline: `Profissional ${args.idleStaff[0].name} esta com baixa agenda`,
      prompt: `Como puxar agenda para ${args.idleStaff[0].name}?`,
      severity: "medium",
      summary: `${args.idleStaff[0].name} tem agenda recente abaixo do restante da equipe.`,
    });
  }

  return alerts.slice(0, 4);
}

export function evaluateOperationalIntelligenceSnapshot(
  snapshot: OperationalIntelligenceSnapshot,
  now: Date = new Date(),
): OperationalIntelligenceReport {
  const missingData: string[] = [];

  if (!snapshot.financeAppointments.length) {
    missingData.push("Historico financeiro recente");
  }

  if (!snapshot.activeServices.length) {
    missingData.push("Servicos ativos");
  }

  if (!snapshot.staffMembers.length) {
    missingData.push("Equipe ativa");
  }

  const { currentCompletedCount, currentRevenue, deltaPercent, previousRevenue } =
    buildRevenueMetrics({
      financeAppointments: snapshot.financeAppointments,
      now,
    });
  const { topService, lowDemandService } = buildServiceRankings({
    activeServices: snapshot.activeServices,
    financeAppointments: snapshot.financeAppointments,
    now,
  });
  const recurringMetrics = buildRecurringMetrics(snapshot.financeAppointments);
  const staffMetrics = buildStaffMetrics({
    financeAppointments: snapshot.financeAppointments,
    staffMembers: snapshot.staffMembers,
  });
  const occupancyPercent = snapshot.operationalContext?.tomorrowOccupancyPercent ?? null;
  const recoveryOpenSlotsCount = snapshot.recoveryOpportunity.snapshot.openSlotsCount;
  const operationalOpenSlotsCount =
    snapshot.operationalContext?.tomorrowOpenSlotsCount ?? null;
  const hasVacancyBase =
    isFiniteNumber(recoveryOpenSlotsCount) || isFiniteNumber(operationalOpenSlotsCount);
  const openSlotsCount = isFiniteNumber(recoveryOpenSlotsCount)
    ? Math.max(0, recoveryOpenSlotsCount)
    : isFiniteNumber(operationalOpenSlotsCount)
      ? Math.max(0, operationalOpenSlotsCount)
      : 0;
  const hasRevenueBase = currentRevenue > 0 || previousRevenue > 0;
  const hasRecurringBase = recurringMetrics.uniqueCustomers > 0;

  const score =
    snapshot.financeAppointments.length ||
    snapshot.cancellationsLast7d > 0 ||
    snapshot.recoveryOpportunity.candidates.length ||
    occupancyPercent != null ||
    hasVacancyBase
      ? buildScore({
          cancellationsLast7d: snapshot.cancellationsLast7d,
          currentCompletedCount,
          deltaPercent,
          hasRecurringBase,
          hasRevenueBase,
          hasVacancyBase,
          idleRatio: staffMetrics.ratio,
          openSlotsCount,
          occupancyPercent,
          recurringRatio: recurringMetrics.ratio,
        })
      : null;
  const diagnoses = buildDiagnoses({
    cancellationsLast7d: snapshot.cancellationsLast7d,
    currentCompletedCount,
    deltaPercent,
    idleStaff: staffMetrics.idleStaff,
    inactiveCustomers: snapshot.inactiveCustomers,
    lowDemandService,
    occupancyPercent,
    openSlotsCount,
  });
  const opportunities = buildOpportunities({
    idleStaff: staffMetrics.idleStaff,
    inactiveCustomers: snapshot.inactiveCustomers,
    lowDemandService,
    openSlotsCount,
    recoveryOpportunity: snapshot.recoveryOpportunity,
    topService,
  });
  const proactiveAlerts = buildProactiveAlerts({
    deltaPercent,
    idleStaff: staffMetrics.idleStaff,
    openSlotsCount,
    occupancyPercent,
    recoveryOpportunity: snapshot.recoveryOpportunity,
  });
  const priority: AssistantPriority =
    diagnoses[0]?.severity === "critical"
      ? "high"
      : diagnoses.length > 0
        ? "medium"
        : opportunities.length > 0
          ? "medium"
          : "low";

  return {
    diagnoses,
    missingData,
    opportunities,
    primaryDiagnosis: diagnoses[0] ?? null,
    primaryOpportunity: opportunities[0] ?? null,
    priority,
    proactiveAlerts,
    score,
  };
}

function buildReadoutActions(report: OperationalIntelligenceReport) {
  const primaryActions = report.primaryDiagnosis?.actions ?? [];
  const opportunityActions = report.primaryOpportunity?.actions ?? [];
  const alertActions = report.proactiveAlerts.flatMap((item) => item.actions);

  return dedupeActions(
    [...primaryActions, ...opportunityActions, ...alertActions].slice(0, 6),
  ).slice(0, 4);
}

function buildReadoutBullets(report: OperationalIntelligenceReport) {
  const bullets: string[] = [];

  if (report.score) {
    bullets.push(
      `Score gerencial: ${report.score.overall}/100 (${report.score.statusLabel.toLowerCase()}).`,
    );
  }

  if (report.primaryDiagnosis) {
    bullets.push(
      `${report.primaryDiagnosis.title}: ${report.primaryDiagnosis.metricLabel}.`,
    );
  } else if (report.proactiveAlerts[0]) {
    bullets.push(
      `${report.proactiveAlerts[0].headline}: ${report.proactiveAlerts[0].summary}`,
    );
  }

  if (report.primaryOpportunity) {
    bullets.push(report.primaryOpportunity.summary);
  }

  return bullets.slice(0, 3);
}

function buildReadoutSummary(report: OperationalIntelligenceReport) {
  if (report.primaryDiagnosis && report.score) {
    return `${report.primaryDiagnosis.problem} Score gerencial atual: ${report.score.overall}/100.`;
  }

  if (report.primaryDiagnosis) {
    return report.primaryDiagnosis.problem;
  }

  if (report.score) {
    return `Score gerencial atual: ${report.score.overall}/100, com leitura ${report.score.statusLabel.toLowerCase()}.`;
  }

  return INSUFFICIENT_DATA_MESSAGE;
}

function buildReadoutTitle(report: OperationalIntelligenceReport) {
  if (report.primaryDiagnosis && report.score) {
    return cleanAiText(
      `${report.primaryDiagnosis.title} • score ${report.score.overall}/100`,
      80,
    );
  }

  if (report.primaryDiagnosis) {
    return report.primaryDiagnosis.title;
  }

  if (report.score) {
    return cleanAiText(`Score gerencial ${report.score.overall}/100`, 80);
  }

  return "Operacao sem base suficiente";
}

function buildReadoutFollowUp(report: OperationalIntelligenceReport) {
  if (report.primaryOpportunity?.prompt) {
    return `Se quiser, eu sigo por aqui: ${report.primaryOpportunity.prompt}`;
  }

  if (report.proactiveAlerts[1]?.prompt) {
    return `Tambem vale olhar isto agora: ${report.proactiveAlerts[1].prompt}`;
  }

  return null;
}

function buildReadoutSuggestion(report: OperationalIntelligenceReport) {
  if (report.primaryDiagnosis?.suggestion) {
    return report.primaryDiagnosis.suggestion;
  }

  if (report.primaryOpportunity) {
    return report.primaryOpportunity.summary;
  }

  return report.score
    ? "Use o score como prioridade de ordem: primeiro gargalo operacional, depois oportunidade comercial."
    : null;
}

function buildReadoutImpact(report: OperationalIntelligenceReport) {
  if (report.primaryDiagnosis?.impact) {
    return report.primaryDiagnosis.impact;
  }

  if (report.primaryOpportunity) {
    return "Existe oportunidade real de melhorar ocupacao e faturamento usando a base atual do salao.";
  }

  return null;
}

function buildReadoutRecommendedAction(report: OperationalIntelligenceReport) {
  return (
    report.primaryDiagnosis?.recommendedAction ??
    report.primaryOpportunity?.recommendedAction ??
    null
  );
}

function buildReadoutProblem(report: OperationalIntelligenceReport) {
  if (report.primaryDiagnosis?.problem) {
    return report.primaryDiagnosis.problem;
  }

  if (report.score) {
    return `O salao nao tem alerta critico agora, mas o score gerencial esta em ${report.score.overall}/100 e ainda existe espaco para ganho operacional.`;
  }

  return INSUFFICIENT_DATA_MESSAGE;
}

function buildContextWithIntelligence(args: {
  baseContext: AssistantOperationalContext | null;
  report: OperationalIntelligenceReport;
}) {
  if (!args.baseContext && !args.report.score && !args.report.proactiveAlerts.length) {
    return null;
  }

  return {
    ...(args.baseContext ?? {
      cancellationsLast7d: 0,
      fitChanceLabel: "Baixa",
      monthRevenueLabel: formatCurrency(0),
      operationalRiskLabel: "Baixo",
      pendingAppointmentsCount: 0,
      summary: buildReadoutSummary(args.report),
      todayAppointmentsCount: 0,
      tomorrowOccupancyLabel: "Sem leitura",
      tomorrowOccupancyPercent: null,
      tomorrowOpenSlotsCount: 0,
    }),
    diagnoses: args.report.diagnoses,
    managerialScore: args.report.score,
    opportunities: args.report.opportunities,
    proactiveAlerts: args.report.proactiveAlerts,
  } satisfies AssistantOperationalContext;
}

export async function buildOperationalManagerialReadout(
  args: OperationalManagerialArgs,
): Promise<OperationalManagerialReadout> {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const now = args.now ?? new Date();
  const runtimeSalon = {
    ...args.salon,
    slot_step_minutes: args.salon.slot_step_minutes ?? 30,
    timezone: timeZone,
  };
  const todayKey = getLocalDateKey(now, timeZone);
  const current7Start = new Date(now.getTime() - 7 * DAY_IN_MS).toISOString();
  const current30Start = new Date(now.getTime() - 30 * DAY_IN_MS).toISOString();
  const previous30Start = new Date(now.getTime() - 60 * DAY_IN_MS).toISOString();
  const periodEnd = now.toISOString();
  const [agenda, inactiveCustomers, finance, cancellations, recoveryOpportunity] =
    await Promise.all([
      executePanelAssistantTool({
        actorUserId: args.actorUserId,
        conversationId: args.conversationId,
        input: {
          dayKey: todayKey,
          includeAppointments: true,
          includeServices: true,
        },
        permissions: args.permissions,
        requestOrigin: args.requestOrigin,
        salon: runtimeSalon,
        supabase: args.supabase,
        toolId: "getAgenda",
      }),
      executePanelAssistantTool({
        actorUserId: args.actorUserId,
        conversationId: args.conversationId,
        input: {
          inactiveDays: 60,
          limit: 40,
        },
        permissions: args.permissions,
        requestOrigin: args.requestOrigin,
        salon: runtimeSalon,
        supabase: args.supabase,
        toolId: "getClientesInativos",
      }),
      executePanelAssistantTool({
        actorUserId: args.actorUserId,
        conversationId: args.conversationId,
        input: {
          periodEnd,
          periodStart: current30Start,
          previousPeriodEnd: current30Start,
          previousPeriodStart: previous30Start,
        },
        permissions: args.permissions,
        requestOrigin: args.requestOrigin,
        salon: runtimeSalon,
        supabase: args.supabase,
        toolId: "getFaturamento",
      }),
      executePanelAssistantTool({
        actorUserId: args.actorUserId,
        conversationId: args.conversationId,
        input: {
          limit: 100,
          periodEnd,
          periodStart: current7Start,
        },
        permissions: args.permissions,
        requestOrigin: args.requestOrigin,
        salon: runtimeSalon,
        supabase: args.supabase,
        toolId: "getCancelamentos",
      }),
      executePanelAssistantTool({
        actorUserId: args.actorUserId,
        conversationId: args.conversationId,
        input: {
          question: countRecoveryPrompt(args.question),
        },
        permissions: args.permissions,
        requestOrigin: args.requestOrigin,
        salon: runtimeSalon,
        supabase: args.supabase,
        toolId: "sugerirEncaixes",
      }),
    ]);

  const report = evaluateOperationalIntelligenceSnapshot(
    {
      activeServices: agenda.services,
      cancellationsLast7d: cancellations.cancellations.length,
      financeAppointments: finance.appointments,
      inactiveCustomers: inactiveCustomers.customers,
      operationalContext: args.operationalContext ?? null,
      recoveryOpportunity,
      staffMembers: agenda.staffMembers,
    },
    now,
  );
  const actions = buildReadoutActions(report);
  const title = buildReadoutTitle(report);
  const summary = buildReadoutSummary(report);
  const operationalContext = buildContextWithIntelligence({
    baseContext: args.operationalContext ?? null,
    report,
  });

  if (!report.score && report.missingData.length >= 2) {
    return {
      actions: [
        buildToolAction("getAgenda"),
        buildToolAction("getFaturamento", "secondary"),
      ],
      bullets: [
        INSUFFICIENT_DATA_MESSAGE,
        "Ainda nao existe base suficiente para diagnostico operacional confiavel.",
      ],
      ctaHref: MANAGEMENT_ROUTES.dashboard,
      ctaLabel: "Abrir gestao",
      followUp:
        "Quando houver mais base em agenda, financeiro e clientes, eu consigo montar diagnostico, score e alertas reais.",
      impact:
        "Sem base minima, qualquer conclusao mais forte agora aumenta risco de decisao errada.",
      missingData: report.missingData,
      operationalContext,
      priority: "low",
      problem: INSUFFICIENT_DATA_MESSAGE,
      recommendedAction:
        "Consolide agenda, pagamentos e clientes antes de usar essa leitura como decisao gerencial.",
      report,
      suggestion:
        "Comece validando cadastros, agenda concluida e recebimentos do periodo recente.",
      summary: INSUFFICIENT_DATA_MESSAGE,
      title: "Diagnostico sem base suficiente",
    };
  }

  return {
    actions,
    bullets: buildReadoutBullets(report),
    ctaHref: actions[0]?.href ?? MANAGEMENT_ROUTES.dashboard,
    ctaLabel: actions[0]?.label ?? "Abrir gestao",
    followUp: buildReadoutFollowUp(report),
    impact: buildReadoutImpact(report),
    missingData: report.missingData,
    operationalContext,
    priority: report.priority,
    problem: buildReadoutProblem(report),
    recommendedAction: buildReadoutRecommendedAction(report),
    report,
    suggestion: buildReadoutSuggestion(report),
    summary,
    title,
  };
}
