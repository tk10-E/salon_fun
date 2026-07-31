import {
  buildFillChanceLabel,
  buildOperationalRiskLabel,
  computeDayOccupancySnapshot,
} from "@/lib/ai/operationalScores";
import {
  createOpenRouterChatCompletion,
  getOpenRouterModel,
  isOpenRouterEnabled,
} from "@/lib/ai/openrouter";
import {
  AI_FEATURE_REGISTRY,
  getPanelAssistantAiMetadata,
} from "@/lib/ai/registry";
import { executePanelAssistantTool } from "@/lib/ai/runtime/executor";
import { persistPanelAssistantRuntimeTurn } from "@/lib/ai/runtime/memory";
import { buildOperationalManagerialReadout } from "@/lib/ai/runtime/operationalIntelligence";
import { buildAiLongMemorySnapshot } from "@/lib/ai/runtime/preferences";
import {
  buildPanelAssistantSystemPrompt,
  buildPanelAssistantUserPrompt,
} from "@/lib/ai/prompts/copilotPrompt";
import { buildAgendaDecisionFrame } from "@/lib/ai/skills/agendaSkill";
import { buildCampaignDecisionFrame } from "@/lib/ai/skills/campaignSkill";
import { buildClientDecisionFrame } from "@/lib/ai/skills/clientSkill";
import { buildFinanceDecisionFrame } from "@/lib/ai/skills/financeSkill";
import { buildMarketingDecisionFrame } from "@/lib/ai/skills/marketingSkill";
import { buildOccupancyDecisionFrame } from "@/lib/ai/skills/occupancySkill";
import {
  getPanelAssistantSkill,
  getPanelAssistantSkillOrder,
  isPanelAssistantFollowUp,
} from "@/lib/ai/skills/registry";
import type {
  AssistantDecisionFrame,
  AssistantDecisionMode,
  AssistantOperationalContext,
  AssistantPriority,
  AssistantProvider,
  AssistantQuickAction,
  AssistantRuntimeMetadata,
  PanelAssistantIntent,
} from "@/lib/ai/skills/types";
import { generatePromotionDraftWithAi } from "@/lib/ai/promotionDraft";
import {
  getRecoveryCampaignSnapshot,
} from "@/lib/ai/recoveryCampaign";
import { resolveBookedAppointmentAmount } from "@/lib/financialMetrics";
import {
  getLocalDateKey,
  getUtcRangeForLocalDate,
  getUtcRangeForLocalMonth,
} from "@/lib/management";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import type { AiLongMemorySnapshot } from "./runtime/types";

type SalonContext = {
  id: string;
  name: string;
  slot_step_minutes?: number | null;
  timezone?: string | null;
};

type PanelAssistantArgs = {
  conversationId?: string | null;
  permissions?: string[];
  question: string;
  requestOrigin?: string | null;
  salon: SalonContext;
  supabase: any;
  userId?: string | null;
};

export type PanelAssistantAnswer = {
  actions: AssistantQuickAction[];
  bullets: string[];
  ctaHref: string | null;
  ctaLabel: string | null;
  followUp: string | null;
  impact: string | null;
  intent: PanelAssistantIntent;
  missingData: string[];
  model: string;
  operationalContext: AssistantOperationalContext | null;
  priority: AssistantPriority;
  problem: string | null;
  recommendedAction: string | null;
  runtime: AssistantRuntimeMetadata;
  suggestion: string | null;
  summary: string;
  title: string;
};

export type PanelAssistantHistoryItem = {
  actions: AssistantQuickAction[];
  answerBullets: string[];
  answerCtaHref: string | null;
  answerCtaLabel: string | null;
  answerFollowUp: string | null;
  answerImpact: string | null;
  answerMissingData: string[];
  answerOperationalContext: AssistantOperationalContext | null;
  answerPriority: AssistantPriority;
  answerProblem: string | null;
  answerRecommendedAction: string | null;
  answerSummary: string;
  answerSuggestion: string | null;
  answerTitle: string;
  createdAt: string;
  id: string;
  intent: PanelAssistantIntent;
  model: string;
  promptProfile: string | null;
  promptVersion: string | null;
  question: string;
  runtime: AssistantRuntimeMetadata | null;
};

type AssistantDraft = {
  actions?: AssistantQuickAction[];
  bullets: string[];
  ctaHref: string | null;
  ctaLabel: string | null;
  missingData?: string[];
  followUp: string | null;
  impact?: string | null;
  operationalContext?: AssistantOperationalContext | null;
  priority?: AssistantPriority;
  problem?: string | null;
  recommendedAction?: string | null;
  resolvedCustomerId?: string | null;
  suggestion?: string | null;
  summary: string;
  title: string;
};

type PanelAssistantHistoryRow = {
  created_at: string;
  event_type: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  target_type: string | null;
};

type ServiceMatch = {
  category: string | null;
  duration: number | null;
  id: string;
  name: string;
  price: number | null;
};

type FeedComposerPrefillLinkArgs = {
  aiNotes?: string | null;
  caption?: string | null;
  postType?: "before_after" | "reel" | "standard" | "story";
  serviceId?: string | null;
  staffMemberId?: string | null;
  title?: string | null;
};

type PromotionComposerPrefillLinkArgs = {
  aiGoal?: string | null;
  aiNotes?: string | null;
  description?: string | null;
  endsOn?: string | null;
  highlight?: string | null;
  kind?: "membership" | "promotion";
  price?: number | null;
  serviceId?: string | null;
  sessionsIncluded?: number | null;
  startsOn?: string | null;
  title?: string | null;
  validityDays?: number | null;
};

type StaffMemberRow = {
  id: string;
  is_active: boolean | null;
  name: string;
};

type StaffScheduleContextRow = {
  closes_at: string;
  closes_at_utc: string;
  is_open: boolean;
  opens_at: string;
  opens_at_utc: string;
  salon_id: string;
  staff_member_id: string;
  timezone: string;
};

type GeneralAppointmentRow = {
  date: string;
  ends_at: string;
  staff_member_id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type AvailableStaffSlot = {
  ends_at: string;
  staff_member_id: string;
  staff_member_name: string;
  start_at: string;
};

type CustomerAppointmentRow = {
  completed_at: string | null;
  customer_id?: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  services:
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }[]
    | null;
  staff_members:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type FinanceAppointmentRow = {
  completed_at: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  status?: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
  services:
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }[]
    | null;
};

type AppointmentPaymentRow = {
  amount: number | string;
  paid_at: string;
};

type AssistantDataStatus = "empty" | "limited" | "ready";

const MAX_SUMMARY_CHARS = 320;
const MAX_TITLE_CHARS = 80;
const INSUFFICIENT_DATA_MESSAGE =
  "Nao encontrei dados suficientes para afirmar isso.";
const PANEL_ASSISTANT_HISTORY_EVENT_TYPE = "panel.ai_query";
const PANEL_ASSISTANT_HISTORY_TARGET_TYPE = "panel_ai_assistant";

function buildToolExecutionArgs(args: PanelAssistantArgs) {
  return {
    actorUserId: args.userId ?? null,
    conversationId: args.conversationId,
    permissions: args.permissions,
    requestOrigin: args.requestOrigin,
    salon: {
      ...args.salon,
      slot_step_minutes: args.salon.slot_step_minutes ?? 30,
      timezone: args.salon.timezone ?? "America/Sao_Paulo",
    },
    supabase: args.supabase,
  };
}

function buildAssistantRuntimeMetadata(args: {
  decisionMode: AssistantDecisionMode;
  intent: PanelAssistantIntent;
  memoryUsed?: boolean;
  provider: AssistantProvider;
}): AssistantRuntimeMetadata {
  const skill = getPanelAssistantSkill(args.intent);
  const panelAssistantAiMetadata = getPanelAssistantAiMetadata();

  return {
    decisionMode: args.decisionMode,
    memoryUsed: args.memoryUsed ?? false,
    policyVersion: panelAssistantAiMetadata.policyVersion,
    provider: args.provider,
    skillId: args.intent,
    skillLabel: skill.label,
  };
}

const WEEKDAY_LABELS = [
  "domingo",
  "segunda-feira",
  "terca-feira",
  "quarta-feira",
  "quinta-feira",
  "sexta-feira",
  "sabado",
] as const;

const HELP_TOPICS = [
  {
    ctaHref: MANAGEMENT_ROUTES.professionals,
    ctaLabel: "Abrir equipe",
    keywords: ["comissao", "comissoes", "percentual", "fixo"],
    title: "Como cadastrar comissao",
    summary:
      "Abra Equipe, escolha o profissional, ajuste a comissao percentual e o fixo, depois salve. A leitura do resultado aparece em Comissoes quando houver atendimento concluido.",
    bullets: [
      "Equipe > Profissionais para editar percentual e fixo.",
      "A comissao variavel precisa ficar entre 0% e 100%.",
      "O painel calcula a leitura quando o atendimento vira concluido.",
    ],
    followUp:
      "Se quiser acompanhar o valor gerado por profissional, abra a tela de Comissoes.",
  },
  {
    ctaHref: MANAGEMENT_ROUTES.services,
    ctaLabel: "Abrir servicos",
    keywords: ["servico", "servicos", "preco", "precos", "duracao", "catalogo"],
    title: "Como cadastrar servico",
    summary:
      "Abra Servicos, edite nome, preco, duracao e categoria. O app cliente e a agenda usam esse cadastro para mostrar valores e encaixes reais.",
    bullets: [
      "Nome e duracao definem a agenda.",
      "Preco alimenta oferta, ticket e leitura financeira.",
      "Categoria ajuda o painel a montar analises e promocoes.",
    ],
    followUp:
      "Se o servico nao deve aparecer para agendar, deixe inativo ou ajuste os profissionais habilitados.",
  },
  {
    ctaHref: MANAGEMENT_ROUTES.appointments,
    ctaLabel: "Abrir agenda",
    keywords: ["agenda", "agendamento", "plano", "horario", "reagendar"],
    title: "Como operar a agenda",
    summary:
      "A agenda mostra horarios do app cliente e do painel no mesmo fluxo. Use Dia, Semana e Mes para ler ocupacao, profissional e status de cada atendimento.",
    bullets: [
      "Planos aparecem marcados como plano e podem gerar serie automatica.",
      "Agendamento comum entra no profissional certo quando o cliente agenda no app.",
      "Cancelamento, remarcacao e conclusao refletem no mesmo calendario.",
    ],
    followUp:
      "Se a duvida for sobre um horario especifico, me pergunte pelo cliente, servico ou profissional.",
  },
  {
    ctaHref: "/dashboard/feed",
    ctaLabel: "Abrir feed",
    keywords: ["feed", "story", "stories", "instagram", "postagem", "publicacao"],
    title: "Como publicar no feed do app",
    summary:
      "Abra Feed, escolha o formato, suba a midia e publique. Stories vao para a faixa de 24h do app e o feed permanente fica na vitrine do cliente.",
    bullets: [
      "Story usa foto vertical e some sozinho depois do prazo.",
      "Feed pode usar IA para titulo e legenda.",
      "Promocoes e transformacoes ajudam a puxar clique para agenda.",
    ],
    followUp:
      "Se quiser, posso montar uma legenda ou uma promocao com base no servico da semana.",
  },
] as const;

function cleanText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function appendUrlParam(
  params: URLSearchParams,
  key: string,
  value: number | string | null | undefined,
) {
  if (value == null) {
    return;
  }

  const normalized =
    typeof value === "number" ? String(value) : cleanText(value, 600);

  if (!normalized) {
    return;
  }

  params.set(key, normalized);
}

function buildPrefilledFeedComposerHref(args: FeedComposerPrefillLinkArgs) {
  const params = new URLSearchParams();

  appendUrlParam(params, "prefillTitle", args.title ? cleanText(args.title, 120) : null);
  appendUrlParam(
    params,
    "prefillCaption",
    args.caption ? cleanText(args.caption, 420) : null,
  );
  appendUrlParam(params, "prefillPostType", args.postType ?? "standard");
  appendUrlParam(params, "prefillServiceId", args.serviceId ?? null);
  appendUrlParam(params, "prefillStaffMemberId", args.staffMemberId ?? null);
  appendUrlParam(
    params,
    "aiNotes",
    args.aiNotes ? cleanText(args.aiNotes, 420) : null,
  );

  const query = params.toString();
  return `/dashboard/feed${query ? `?${query}` : ""}#feed-new`;
}

function buildPrefilledPromotionsComposerHref(
  args: PromotionComposerPrefillLinkArgs,
) {
  const params = new URLSearchParams();

  params.set("compose", "1");
  appendUrlParam(params, "prefillKind", args.kind ?? "promotion");
  appendUrlParam(
    params,
    "prefillTitle",
    args.title ? cleanText(args.title, 120) : null,
  );
  appendUrlParam(
    params,
    "prefillHighlight",
    args.highlight ? cleanText(args.highlight, 180) : null,
  );
  appendUrlParam(
    params,
    "prefillDescription",
    args.description ? cleanText(args.description, 420) : null,
  );
  appendUrlParam(
    params,
    "prefillPrice",
    args.price != null && Number.isFinite(args.price)
      ? args.price.toFixed(2)
      : null,
  );
  appendUrlParam(params, "prefillStartsOn", args.startsOn ?? null);
  appendUrlParam(params, "prefillEndsOn", args.endsOn ?? null);
  appendUrlParam(params, "prefillServiceId", args.serviceId ?? null);
  appendUrlParam(
    params,
    "prefillSessionsIncluded",
    args.sessionsIncluded ?? null,
  );
  appendUrlParam(
    params,
    "prefillValidityDays",
    args.validityDays ?? null,
  );
  appendUrlParam(
    params,
    "aiGoal",
    args.aiGoal ? cleanText(args.aiGoal, 120) : null,
  );
  appendUrlParam(
    params,
    "aiNotes",
    args.aiNotes ? cleanText(args.aiNotes, 420) : null,
  );

  return `/dashboard/benefits/promotions?${params.toString()}`;
}

function buildClientFocusHref(args: {
  clientId?: string | null;
  query?: string | null;
}) {
  const params = new URLSearchParams();

  appendUrlParam(params, "clientId", args.clientId ?? null);
  appendUrlParam(params, "q", args.query ? cleanText(args.query, 120) : null);

  const query = params.toString();
  return `${MANAGEMENT_ROUTES.clients}${query ? `?${query}` : ""}`;
}

function normalizeConversationId(value: string | null | undefined) {
  const normalized = cleanText(value, 80);

  if (!normalized || !/^[a-zA-Z0-9:_-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
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

function toNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeHistoryBullets(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) =>
      cleanText(typeof item === "string" ? item : String(item ?? ""), 220),
    )
    .filter(Boolean);
}

function normalizeMissingData(value: unknown) {
  if (!Array.isArray(value)) {
    return [] as string[];
  }

  return value
    .map((item) =>
      cleanText(typeof item === "string" ? item : String(item ?? ""), 120),
    )
    .filter(Boolean)
    .slice(0, 6);
}

function normalizePriority(value: unknown): AssistantPriority {
  switch (value) {
    case "high":
    case "medium":
    case "low":
      return value;
    default:
      return "low";
  }
}

function normalizeQuickActions(value: unknown): AssistantQuickAction[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const href = cleanText((item as { href?: unknown }).href as string, 220);
      const label = cleanText((item as { label?: unknown }).label as string, 80);
      const kind = (item as { kind?: unknown }).kind;

      if (!href || !label) {
        return null;
      }

      return {
        href,
        kind: kind === "primary" ? "primary" : "secondary",
        label,
      } satisfies AssistantQuickAction;
    })
    .filter((item): item is AssistantQuickAction => item !== null)
    .slice(0, 4);
}

function resolveHistoryIntent(value: unknown): PanelAssistantIntent {
  switch (value) {
    case "movement_forecast":
    case "recovery_campaign":
    case "customer_summary":
    case "finance_analysis":
    case "promotion_strategy":
    case "panel_help":
    case "schedule_availability":
    case "vacancy_strategy":
      return value;
    default:
      return "schedule_availability";
  }
}

function normalizeRuntimeMetadata(
  value: unknown,
  fallbackIntent: PanelAssistantIntent,
): AssistantRuntimeMetadata | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const raw = value as Record<string, unknown>;
  const provider = raw.provider;
  const decisionMode = raw.decisionMode;
  const skillId = resolveHistoryIntent(raw.skillId ?? fallbackIntent);
  const policyVersion = readHistoryString(raw.policyVersion, 120);
  const skillLabel = readHistoryString(raw.skillLabel, 80);
  const memoryUsed = raw.memoryUsed === true;

  if (
    (provider !== "deterministic" && provider !== "openrouter") ||
    (decisionMode !== "guided_generation" && decisionMode !== "safe_fallback") ||
    !policyVersion ||
    !skillLabel
  ) {
    return null;
  }

  return {
    decisionMode,
    memoryUsed,
    policyVersion,
    provider,
    skillId,
    skillLabel,
  };
}

function readHistoryString(value: unknown, maxLength: number) {
  return cleanText(typeof value === "string" ? value : "", maxLength) || null;
}

function mapHistoryRow(
  row: PanelAssistantHistoryRow,
): PanelAssistantHistoryItem | null {
  if (
    row.event_type !== PANEL_ASSISTANT_HISTORY_EVENT_TYPE ||
    row.target_type !== PANEL_ASSISTANT_HISTORY_TARGET_TYPE
  ) {
    return null;
  }

  const metadata = row.metadata ?? {};
  const question = readHistoryString(metadata.question, 400);
  const intent = resolveHistoryIntent(metadata.intent);

  if (!question) {
    return null;
  }

  const runtime =
    normalizeRuntimeMetadata(metadata.answerRuntime, intent) ??
    normalizeRuntimeMetadata(
      {
        decisionMode: metadata.decisionMode,
        policyVersion: metadata.policyVersion,
        provider: metadata.provider,
        skillId: metadata.skillId,
        skillLabel: metadata.skillLabel,
      },
      intent,
    );

  return {
    actions: normalizeQuickActions(metadata.actions),
    answerBullets: normalizeHistoryBullets(metadata.answerBullets),
    answerCtaHref: readHistoryString(metadata.answerCtaHref, 220),
    answerCtaLabel: readHistoryString(metadata.answerCtaLabel, 80),
    answerFollowUp: readHistoryString(metadata.answerFollowUp, 180),
    answerImpact: readHistoryString(metadata.answerImpact, 220),
    answerMissingData: normalizeMissingData(metadata.answerMissingData),
    answerOperationalContext:
      (metadata.answerOperationalContext as AssistantOperationalContext | null) ??
      null,
    answerPriority: normalizePriority(metadata.answerPriority),
    answerProblem: readHistoryString(metadata.answerProblem, 220),
    answerRecommendedAction: readHistoryString(
      metadata.answerRecommendedAction,
      220,
    ),
    answerSummary:
      readHistoryString(metadata.answerSummary, MAX_SUMMARY_CHARS) ??
      "Resposta registrada pela Central IA do painel.",
    answerSuggestion: readHistoryString(metadata.answerSuggestion, 220),
    answerTitle:
      readHistoryString(metadata.answerTitle, MAX_TITLE_CHARS) ??
      "Resposta da Central IA",
    createdAt: row.created_at,
    id: row.id,
    intent,
    model:
      readHistoryString(metadata.model, 120) ??
      `${getOpenRouterModel()} (historico)`,
    promptProfile: readHistoryString(metadata.promptProfile, 120),
    promptVersion: readHistoryString(metadata.promptVersion, 40),
    question,
    runtime,
  };
}

function resolvePanelAssistantHistoryAdminClient(input?: any | null) {
  if (input) {
    return input;
  }

  try {
    return createAdminClient() as any;
  } catch {
    return null;
  }
}

function toSafeDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  return value.length <= 10
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(value);
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
  }).format(value instanceof Date ? value : new Date(value));
}

function formatWeekdayDisplay(key: string) {
  switch (key) {
    case "domingo":
      return "domingo";
    case "segunda feira":
      return "segunda-feira";
    case "terca feira":
      return "terca-feira";
    case "quarta feira":
      return "quarta-feira";
    case "quinta feira":
      return "quinta-feira";
    case "sexta feira":
      return "sexta-feira";
    case "sabado":
      return "sabado";
    default:
      return key;
  }
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

function resolveQuestionTargetDay(question: string, timeZone: string) {
  const normalized = normalizeSearchText(question);
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const asksNextWeek =
    normalized.includes("semana que vem") ||
    normalized.includes("proxima semana");

  if (normalized.includes("amanha")) {
    const dayKey = addDaysToDayKey(todayKey, 1);
    return { dayKey, label: formatDateLabel(dayKey, timeZone) };
  }

  if (normalized.includes("hoje")) {
    return { dayKey: todayKey, label: formatDateLabel(todayKey, timeZone) };
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

    const startOffset = asksNextWeek ? 7 : 0;
    const endOffset = asksNextWeek ? 14 : 7;

    for (let offset = startOffset; offset < endOffset; offset += 1) {
      const probeDay = addDaysToDayKey(todayKey, offset);
      if (getWeekdayFromDayKey(probeDay) === matcher.weekday) {
        return { dayKey: probeDay, label: formatDateLabel(probeDay, timeZone) };
      }
    }
  }

  if (asksNextWeek) {
    const dayKey = addDaysToDayKey(todayKey, 7);
    return { dayKey, label: formatDateLabel(dayKey, timeZone) };
  }

  return { dayKey: todayKey, label: formatDateLabel(todayKey, timeZone) };
}

function calculateDeltaPercent(current: number, previous: number) {
  if (previous === 0) {
    return current === 0 ? 0 : 100;
  }

  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function buildMonthKeyParts(baseDate: Date, timeZone: string) {
  const key = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(baseDate);
  return {
    key,
    label: new Intl.DateTimeFormat("pt-BR", {
      month: "long",
      year: "numeric",
      timeZone,
    }).format(baseDate),
  };
}

function getMonthKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(toSafeDate(value));
}

function extractCustomerSearchTerm(question: string) {
  const normalizedOriginal = cleanText(question, 220);
  const explicitMatch =
    normalizedOriginal.match(/cliente\s+(.+?)(?:[?.!,]|$)/i)?.[1]?.trim() ??
    "";

  if (explicitMatch) {
    return explicitMatch
      .replace(/\b(resumo|ultima visita|última visita|ticket|medio|m[eé]dio)\b/gi, "")
      .trim();
  }

  return "";
}

function findBestServiceMatch(question: string, services: ServiceMatch[]) {
  const normalizedQuestion = normalizeSearchText(question);

  return [...services]
    .sort((left, right) => right.name.length - left.name.length)
    .find((service) =>
      normalizedQuestion.includes(normalizeSearchText(service.name)),
    ) ?? null;
}

function matchesSkillRoutingTerms(
  normalizedQuestion: string,
  intent: PanelAssistantIntent,
) {
  return getPanelAssistantSkill(intent).routingTerms.some((term) =>
    normalizedQuestion.includes(normalizeSearchText(term)),
  );
}

function countIntentRoutingTerms(
  normalizedQuestion: string,
  intent: PanelAssistantIntent,
) {
  return getPanelAssistantSkill(intent).routingTerms.reduce(
    (count, term) =>
      normalizedQuestion.includes(normalizeSearchText(term)) ? count + 1 : count,
    0,
  );
}

function isTemporalFollowUpQuestion(normalizedQuestion: string) {
  return (
    isPanelAssistantFollowUp(normalizedQuestion) ||
    normalizedQuestion.includes("semana que vem") ||
    normalizedQuestion.includes("proxima semana")
  );
}

function includesAnyTerm(value: string, terms: readonly string[]) {
  return terms.some((term) => value.includes(term));
}

function isBroadOperationalQuestion(normalizedQuestion: string) {
  if (!normalizedQuestion) {
    return false;
  }

  if (
    includesAnyTerm(normalizedQuestion, [
      "como esta a operacao",
      "como esta operacao",
      "como esta meu salao",
      "como esta o salao",
      "me da um resumo da operacao",
      "me de um resumo da operacao",
      "resumo da operacao",
      "resumo do salao",
      "faz uma leitura geral do salao",
      "faz uma leitura geral da operacao",
      "leitura geral do salao",
      "leitura geral da operacao",
      "como esta o desempenho",
      "como esta meu desempenho",
      "desempenho hoje",
      "me mostra o diagnostico do salao",
      "diagnostico do salao",
      "diagnostico da operacao",
    ])
  ) {
    return true;
  }

  if (
    normalizedQuestion.startsWith("como esta ") &&
    includesAnyTerm(normalizedQuestion, [" operacao", " salao", " desempenho"])
  ) {
    return true;
  }

  if (
    includesAnyTerm(normalizedQuestion, ["resumo", "leitura geral"]) &&
    includesAnyTerm(normalizedQuestion, ["operacao", "salao"])
  ) {
    return true;
  }

  if (
    normalizedQuestion.includes("diagnostico") &&
    includesAnyTerm(normalizedQuestion, ["operacao", "salao"])
  ) {
    return true;
  }

  return false;
}

function resolveQuestionWithMemory(
  question: string,
  memory: Array<Pick<PanelAssistantHistoryItem, "intent" | "question">>,
) {
  const cleanQuestion = cleanText(question, 400);
  const normalized = normalizeSearchText(cleanQuestion);

  if (!memory.length || !isTemporalFollowUpQuestion(normalized)) {
    return {
      previousQuestion: null,
      question: cleanQuestion,
      usesMemory: false,
    };
  }

  const previousQuestion = cleanText(memory[0]?.question, 260);

  if (!previousQuestion) {
    return {
      previousQuestion: null,
      question: cleanQuestion,
      usesMemory: false,
    };
  }

  return {
    previousQuestion,
    question: cleanText(`${previousQuestion} ${cleanQuestion}`, 400),
    usesMemory: true,
  };
}

export function detectPanelAssistantIntent(
  question: string,
  memory: Array<Pick<PanelAssistantHistoryItem, "intent" | "question">> = [],
): PanelAssistantIntent {
  const normalized = normalizeSearchText(question);
  const isBroadOperational = isBroadOperationalQuestion(normalized);
  const scores = new Map<PanelAssistantIntent, number>(
    getPanelAssistantSkillOrder().map((intent) => [intent, 0]),
  );

  for (const intent of getPanelAssistantSkillOrder()) {
    const termMatches = countIntentRoutingTerms(normalized, intent);

    if (termMatches > 0) {
      scores.set(intent, (scores.get(intent) ?? 0) + termMatches * 3);
    }
  }

  if (
    normalized.includes("qual profissional") ||
    normalized.includes("mais livre") ||
    normalized.includes("mais horarios livres") ||
    normalized.includes("horarios vagos")
  ) {
    scores.set(
      "schedule_availability",
      (scores.get("schedule_availability") ?? 0) + 5,
    );
  }

  if (
    normalized.includes("clientes para chamar") ||
    normalized.includes("quem chamar") ||
    normalized.includes("cancelamento") ||
    normalized.includes("cancelamentos")
  ) {
    scores.set("vacancy_strategy", (scores.get("vacancy_strategy") ?? 0) + 4);
  }

  if (
    normalized.includes("retencao") ||
    normalized.includes("reativacao") ||
    normalized.includes("clientes sumidos")
  ) {
    scores.set("recovery_campaign", (scores.get("recovery_campaign") ?? 0) + 4);
  }

  if (
    normalized.includes("servicos em queda") ||
    normalized.includes("servico em queda") ||
    normalized.includes("queda de servicos")
  ) {
    scores.set("finance_analysis", (scores.get("finance_analysis") ?? 0) + 4);
  }

  if (normalized.includes("queda") && normalized.includes("servic")) {
    scores.set("finance_analysis", (scores.get("finance_analysis") ?? 0) + 4);
  }

  if (
    normalized.includes("score gerencial") ||
    normalized.includes("diagnostico") ||
    normalized.includes("diagnostico operacional") ||
    normalized.includes("alertas") ||
    normalized.includes("oportunidades") ||
    normalized.includes("copiloto") ||
    normalized.includes("operacao do salao") ||
    normalized.includes("operacao geral") ||
    normalized.includes("o que precisa de atencao")
  ) {
    scores.set("movement_forecast", (scores.get("movement_forecast") ?? 0) + 5);
  }

  if (isBroadOperational) {
    scores.set("movement_forecast", (scores.get("movement_forecast") ?? 0) + 8);
  }

  if (
    !isBroadOperational &&
    normalized.startsWith("como esta ") &&
    (normalized.includes(" hoje") ||
      normalized.includes(" amanha") ||
      normalized.includes(" sexta") ||
      normalized.includes(" quinta") ||
      normalized.includes(" quarta") ||
      normalized.includes(" terca") ||
      normalized.includes(" segunda") ||
      normalized.includes("semana que vem"))
  ) {
    scores.set(
      "schedule_availability",
      (scores.get("schedule_availability") ?? 0) + 4,
    );
  }

  if (memory.length > 0 && isTemporalFollowUpQuestion(normalized)) {
    scores.set(memory[0]?.intent ?? "schedule_availability", 10);
  }

  const ranked = [...scores.entries()].sort((left, right) => {
    if (right[1] !== left[1]) {
      return right[1] - left[1];
    }

    return (
      getPanelAssistantSkillOrder().indexOf(left[0]) -
      getPanelAssistantSkillOrder().indexOf(right[0])
    );
  });
  const best = ranked[0];

  if (best && best[1] > 0) {
    return best[0];
  }

  for (const intent of getPanelAssistantSkillOrder()) {
    if (intent === "schedule_availability") {
      continue;
    }

    if (matchesSkillRoutingTerms(normalized, intent)) {
      return intent;
    }
  }

  if (memory.length > 0 && isPanelAssistantFollowUp(normalized)) {
    return memory[0]?.intent ?? "schedule_availability";
  }

  if (
    !isBroadOperational &&
    normalized.startsWith("como esta ") &&
    (normalized.includes(" hoje") ||
      normalized.includes(" amanha") ||
      normalized.includes(" sexta") ||
      normalized.includes(" quinta") ||
      normalized.includes(" quarta") ||
      normalized.includes(" terca") ||
      normalized.includes(" segunda"))
  ) {
    return "schedule_availability";
  }

  if (isBroadOperational) {
    return "movement_forecast";
  }

  if (
    normalized.includes("preencher agenda") ||
    normalized.includes("campanha inteligente") ||
    normalized.includes("horario vazio") ||
    normalized.includes("horarios vazios") ||
    normalized.includes("profissional ocioso")
  ) {
    return "recovery_campaign";
  }

  if (
    normalized.includes("promoc") ||
    normalized.includes("oferta") ||
    normalized.includes("campanha")
  ) {
    return "promotion_strategy";
  }

  if (
    normalized.includes("vaga aberta") ||
    normalized.includes("lista de espera") ||
    normalized.includes("encaixe") ||
    normalized.includes("cancelou")
  ) {
    return "vacancy_strategy";
  }

  if (
    normalized.includes("baixo movimento") ||
    normalized.includes("movimento fraco") ||
    normalized.includes("fraco") ||
    normalized.includes("sazonal") ||
    normalized.includes("previs") ||
    normalized.includes("dia fraco") ||
    normalized.includes("score gerencial") ||
    normalized.includes("diagnostico operacional") ||
    normalized.includes("alertas do salao")
  ) {
    return "movement_forecast";
  }

  if (
    normalized.includes("faturamento") ||
    normalized.includes("financeir") ||
    normalized.includes("receita") ||
    normalized.includes("ticket") ||
    normalized.includes("caiu") ||
    normalized.includes("cresceu")
  ) {
    return "finance_analysis";
  }

  if (normalized.includes("cliente")) {
    return "customer_summary";
  }

  if (
    normalized.includes("como cadastrar") ||
    normalized.includes("como configurar") ||
    normalized.includes("onde fica") ||
    normalized.includes("onde encontro") ||
    normalized.includes("passo a passo") ||
    normalized.includes("comissao")
  ) {
    return "panel_help";
  }

  if (
    memory.length > 0 &&
    (normalized === "e amanha" ||
      normalized === "e amanhã" ||
      normalized === "e hoje" ||
      normalized.startsWith("e ") ||
      normalized.startsWith("amanha") ||
      normalized.startsWith("amanhã") ||
      normalized.startsWith("e na sexta") ||
      normalized.startsWith("e sexta") ||
      normalized.startsWith("e quinta") ||
      normalized.startsWith("e quarta") ||
      normalized.startsWith("e terca") ||
      normalized.startsWith("e segunda"))
  ) {
    return memory[0]?.intent ?? "schedule_availability";
  }

  return "schedule_availability";
}

function parseAssistantJson(raw: string) {
  const candidates = [
    raw.trim(),
    raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/```([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        bullets?: unknown;
        followUp?: unknown;
        impact?: unknown;
        problem?: unknown;
        recommendedAction?: unknown;
        summary?: unknown;
        suggestion?: unknown;
        title?: unknown;
      };

      if (parsed && typeof parsed === "object") {
        return parsed;
      }
    } catch {
      // try next candidate
    }
  }

  return null;
}

function formatSkillExamples(skill: ReturnType<typeof getPanelAssistantSkill>) {
  if (!skill.responseExamples.length) {
    return "Sem exemplos calibrados para esta skill.";
  }

  return skill.responseExamples
    .map((example, index) =>
      [
        `Exemplo ${index + 1} - pergunta: ${example.question}`,
        `Exemplo ${index + 1} - resposta JSON: ${JSON.stringify(example.answer)}`,
      ].join("\n"),
    )
    .join("\n\n");
}

async function polishAnswerWithAi(args: {
  base: AssistantDraft;
  intent: PanelAssistantIntent;
  longMemory?: AiLongMemorySnapshot | null;
  memory?: Array<Pick<PanelAssistantHistoryItem, "intent" | "question">>;
  operationalContext?: AssistantOperationalContext | null;
  question: string;
  requestOrigin?: string | null;
  salonName: string;
}) {
  const panelAssistantAiMetadata = getPanelAssistantAiMetadata();
  const skill = getPanelAssistantSkill(args.intent);
  const skillExamples = formatSkillExamples(skill);
  const systemPrompt = buildPanelAssistantSystemPrompt({
    intent: args.intent,
    skill,
    skillExamples,
  });
  const userPrompt = buildPanelAssistantUserPrompt({
    base: args.base,
    intent: args.intent,
    longMemory: args.longMemory,
    memory: args.memory,
    operationalContext: args.operationalContext,
    policyVersion: panelAssistantAiMetadata.policyVersion,
    promptProfile: panelAssistantAiMetadata.promptProfile,
    promptVersion: panelAssistantAiMetadata.promptVersion,
    question: cleanText(args.question, 260),
    salonName: cleanText(args.salonName, 80),
    skill,
  });
  const { model, text } = await createOpenRouterChatCompletion({
    feature: AI_FEATURE_REGISTRY.panelAssistant.feature,
    maxTokens: 320,
    requestOrigin: args.requestOrigin,
    temperature: 0.45,
    timeoutMs: 9_000,
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

  const parsed = parseAssistantJson(text);

  if (!parsed) {
    return {
      ...args.base,
      model: `${model} (fallback)`,
    };
  }

  const title = cleanText(
    typeof parsed.title === "string" ? parsed.title : args.base.title,
    MAX_TITLE_CHARS,
  );
  const summary = cleanText(
    typeof parsed.summary === "string" ? parsed.summary : args.base.summary,
    MAX_SUMMARY_CHARS,
  );
  const bullets = Array.isArray(parsed.bullets)
    ? parsed.bullets
        .filter((item): item is string => typeof item === "string")
        .map((item) => cleanText(item, 120))
        .filter(Boolean)
        .slice(0, 4)
    : args.base.bullets;
  const followUp = cleanText(
    typeof parsed.followUp === "string" ? parsed.followUp : args.base.followUp,
    180,
  ) || null;
  const problem = cleanText(
    typeof parsed.problem === "string" ? parsed.problem : args.base.problem,
    180,
  ) || null;
  const impact = cleanText(
    typeof parsed.impact === "string" ? parsed.impact : args.base.impact,
    180,
  ) || null;
  const suggestion = cleanText(
    typeof parsed.suggestion === "string"
      ? parsed.suggestion
      : args.base.suggestion,
    180,
  ) || null;
  const recommendedAction = cleanText(
    typeof parsed.recommendedAction === "string"
      ? parsed.recommendedAction
      : args.base.recommendedAction,
    180,
  ) || null;

  if (!title || !summary || !bullets.length) {
    return {
      ...args.base,
      model: `${model} (fallback)`,
    };
  }

  return {
    ...args.base,
    bullets,
    followUp,
    impact,
    model,
    problem,
    recommendedAction,
    summary,
    suggestion,
    title,
  };
}

function buildTenantMemoryHint(args: {
  intent: PanelAssistantIntent;
  longMemory: AiLongMemorySnapshot | null | undefined;
}) {
  const longMemory = args.longMemory;

  if (!longMemory?.summary) {
    return null;
  }

  switch (args.intent) {
    case "promotion_strategy":
    case "recovery_campaign":
      if (longMemory.recentCampaigns[0]) {
        return `Se fizer sentido, eu sigo a mesma linha da campanha ${longMemory.recentCampaigns[0]}.`;
      }
      break;
    case "customer_summary":
      if (longMemory.idealCustomerProfile) {
        return `Se quiser, eu comparo essa cliente com o perfil ideal do salao: ${longMemory.idealCustomerProfile}.`;
      }
      break;
    case "schedule_availability":
    case "vacancy_strategy":
      if (longMemory.priorityProfessionals[0]) {
        return `Se quiser, eu priorizo ${longMemory.priorityProfessionals[0]} como referencia operacional nas proximas leituras.`;
      }
      break;
    case "finance_analysis":
    case "movement_forecast":
      if (longMemory.businessGoals[0]) {
        return `Eu tambem posso alinhar a leitura com a meta principal do salao: ${longMemory.businessGoals[0]}.`;
      }
      break;
    default:
      break;
  }

  if (longMemory.topServices[0]) {
    return `Se quiser, eu aprofundo essa recomendacao cruzando com a forca de ${longMemory.topServices[0]} no salao.`;
  }

  if (longMemory.recentFocuses[0]) {
    return `Posso continuar pela frente mais sensivel do salao hoje: ${longMemory.recentFocuses[0]}.`;
  }

  return null;
}

function applyTenantLongMemoryToDraft(args: {
  draft: AssistantDraft;
  intent: PanelAssistantIntent;
  longMemory: AiLongMemorySnapshot | null;
}) {
  const hint = buildTenantMemoryHint({
    intent: args.intent,
    longMemory: args.longMemory,
  });

  if (!hint) {
    return {
      draft: args.draft,
      used: false,
    };
  }

  return {
    draft: {
      ...args.draft,
      followUp:
        cleanText(
          args.draft.followUp ? `${args.draft.followUp} ${hint}` : hint,
          180,
        ) || args.draft.followUp,
    },
    used: true,
  };
}

async function getAgendaContext(args: PanelAssistantArgs, question: string) {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const targetDay = resolveQuestionTargetDay(question, timeZone);
  const agenda = await executePanelAssistantTool({
    ...buildToolExecutionArgs(args),
    input: {
      dayKey: targetDay.dayKey,
      includeAppointments: true,
      includeServices: true,
    },
    toolId: "getAgenda",
  });

  const staffMembers = (agenda.staffMembers as StaffMemberRow[]).filter(
    (staff) => staff.is_active !== false,
  );
  const services = agenda.services as ServiceMatch[];

  return {
    appointments: agenda.appointments as GeneralAppointmentRow[],
    matchedService: findBestServiceMatch(question, services),
    services,
    staffMembers,
    targetDay,
    timeZone,
  };
}

async function getOccupancyContext(args: PanelAssistantArgs) {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const lookbackStart = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
  const currentMonthKey = buildMonthKeyParts(now, timeZone).key;
  const previousMonthKey = buildMonthKeyParts(
    new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12)),
    timeZone,
  ).key;
  const appointmentsResult = await args.supabase
    .from("appointments")
    .select(
      "date,status,completed_at,service_price_snapshot,services(name,category,price)",
    )
    .eq("salon_id", args.salon.id)
    .in("status", ["pending", "confirmed", "completed"])
    .gte("date", lookbackStart.toISOString())
    .order("date", { ascending: false })
    .limit(2000);

  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  return {
    appointments: (appointmentsResult.data ?? []) as FinanceAppointmentRow[],
    currentMonthKey,
    lookbackStart,
    now,
    previousMonthKey,
    timeZone,
  };
}


async function getFinancialContext(args: PanelAssistantArgs) {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const currentMonth = buildMonthKeyParts(now, timeZone);
  const previousMonthDate = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1, 12),
  );
  const previousMonth = buildMonthKeyParts(previousMonthDate, timeZone);
  const currentMonthRange = getUtcRangeForLocalMonth(currentMonth.key, timeZone);
  const previousMonthRange = getUtcRangeForLocalMonth(previousMonth.key, timeZone);
  const finance = await executePanelAssistantTool({
    ...buildToolExecutionArgs(args),
    input: {
      periodEnd: currentMonthRange.end.toISOString(),
      periodStart: currentMonthRange.start.toISOString(),
      previousPeriodEnd: previousMonthRange.end.toISOString(),
      previousPeriodStart: previousMonthRange.start.toISOString(),
    },
    toolId: "getFaturamento",
  });

  return {
    appointments: finance.appointments as FinanceAppointmentRow[],
    currentMonth,
    payments: finance.payments as AppointmentPaymentRow[],
    previousMonth,
    timeZone,
  };
}

async function getCampaignContext(args: PanelAssistantArgs, question: string) {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const targetWeekday = resolvePromotionTargetWeekday(question);
  const now = new Date();
  const lookbackStart = new Date(now.getTime() - 56 * 24 * 60 * 60 * 1000);
  const [appointmentsResult, servicesResult] = await Promise.all([
    args.supabase
      .from("appointments")
      .select("date,status,service_price_snapshot,services(name,category,price)")
      .eq("salon_id", args.salon.id)
      .in("status", ["pending", "confirmed", "completed"])
      .gte("date", lookbackStart.toISOString())
      .order("date", { ascending: false })
      .limit(2000),
    args.supabase
      .from("services")
      .select("id,name,price,duration,category")
      .eq("salon_id", args.salon.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
  ]);

  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  if (servicesResult.error) {
    throw servicesResult.error;
  }

  return {
    appointments: (appointmentsResult.data ?? []) as FinanceAppointmentRow[],
    services: (servicesResult.data ?? []) as ServiceMatch[],
    targetWeekday,
    timeZone,
  };
}

function getMostAvailableProfessional<
  T extends { freeMinutes?: number; freeSlots?: number; slots?: number },
>(ranking: T[]) {
  return ranking[0] ?? null;
}

function getWeakDays(
  weekdayAverages: Array<{ average: number; label: string }>,
) {
  return {
    strongestDay: weekdayAverages[weekdayAverages.length - 1] ?? null,
    weakestDay: weekdayAverages[0] ?? null,
  };
}

async function buildScheduleAvailabilityDraft(
  args: PanelAssistantArgs,
): Promise<AssistantDraft> {
  const { appointments, matchedService, staffMembers, targetDay, timeZone } =
    await getAgendaContext(args, args.question);

  if (!staffMembers.length) {
    return {
      bullets: [INSUFFICIENT_DATA_MESSAGE, "Nao encontrei equipe ativa para ler a agenda deste salao."],
      ctaHref: MANAGEMENT_ROUTES.appointments,
      ctaLabel: "Abrir agenda",
      followUp:
        "Assim que houver equipe ativa e grade publicada, eu consigo ler horarios e profissional mais livre.",
      missingData: ["Equipe ativa"],
      priority: "low",
      problem: INSUFFICIENT_DATA_MESSAGE,
      recommendedAction:
        "Confirme a equipe e a grade de atendimento antes de prometer um horario.",
      suggestion:
        "Abra a agenda ou a gestao da equipe para validar os cadastros primeiro.",
      summary: INSUFFICIENT_DATA_MESSAGE,
      title: "Agenda sem base suficiente",
    };
  }

  if (matchedService) {
    const slotLookup = await executePanelAssistantTool({
      ...buildToolExecutionArgs(args),
      input: {
        dayKey: targetDay.dayKey,
        serviceId: matchedService.id,
      },
      toolId: "getHorariosVagos",
    });
    const slots = slotLookup.slots as AvailableStaffSlot[];
    const counters = new Map<
      string,
      { firstStartAt: string | null; name: string; slots: number }
    >();

    for (const slot of slots) {
      const current = counters.get(slot.staff_member_id) ?? {
        firstStartAt: null,
        name: slot.staff_member_name,
        slots: 0,
      };
      current.slots += 1;
      current.firstStartAt =
        current.firstStartAt && current.firstStartAt < slot.start_at
          ? current.firstStartAt
          : slot.start_at;
      counters.set(slot.staff_member_id, current);
    }

    const ranking = [...counters.entries()]
      .map(([staffMemberId, stats]) => ({
        firstStartAt: stats.firstStartAt,
        name: stats.name,
        slots: stats.slots,
        staffMemberId,
      }))
      .sort((left, right) => {
        if (right.slots !== left.slots) {
          return right.slots - left.slots;
        }

        return left.name.localeCompare(right.name, "pt-BR");
      });

    const best = getMostAvailableProfessional(ranking);

    if (!best) {
      return {
        bullets: [
          `${matchedService.name} nao tem encaixe livre em ${targetDay.label}.`,
          "Vale abrir uma promocao para outro dia ou revisar a grade da equipe.",
        ],
        ctaHref: MANAGEMENT_ROUTES.appointments,
        ctaLabel: "Abrir agenda",
        followUp:
          "Se quiser, eu posso sugerir uma promocao para ocupar outro dia da semana.",
        priority: "medium",
        summary: `Hoje nao encontrei horario livre para ${matchedService.name} em ${targetDay.label}.`,
        title: `Sem encaixe para ${matchedService.name}`,
      };
    }

    return {
      bullets: ranking.slice(0, 3).map((item) => {
        const nextTime = item.firstStartAt
          ? formatTimeLabel(item.firstStartAt, timeZone)
          : "sem horario visivel";
        return `${item.name}: ${item.slots} encaixe(s), primeiro as ${nextTime}.`;
      }),
      ctaHref: `${MANAGEMENT_ROUTES.appointments}?day=${targetDay.dayKey}`,
      ctaLabel: "Ver agenda do dia",
      followUp:
        "Se quiser, eu tambem posso sugerir a melhor promocao para ocupar os encaixes mais fracos.",
      priority: best.slots >= 4 ? "low" : "medium",
      summary: `${best.name} lidera os encaixes de ${matchedService.name} em ${targetDay.label}, com ${best.slots} horario(s) livre(s).`,
      title: `Mais horario livre para ${matchedService.name}`,
    };
  }

  const scheduleContexts = (
    await Promise.all(
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
    )
  ).filter(
    ({ context }) => !context || context.salon_id === args.salon.id,
  );

  const now = new Date();
  const isToday = targetDay.dayKey === getLocalDateKey(now, timeZone);

  const ranking = scheduleContexts
    .map(({ context, staffMember }) => {
      if (!context?.is_open) {
        return {
          freeSlots: 0,
          freeMinutes: 0,
          name: staffMember.name,
          nextOpening: null as string | null,
        };
      }

      const slotStep = Math.max(args.salon.slot_step_minutes ?? 30, 15);
      const openAt = new Date(context.opens_at_utc);
      const closeAt = new Date(context.closes_at_utc);
      const windowStart = isToday && now > openAt ? now : openAt;

      if (windowStart >= closeAt) {
        return {
          freeSlots: 0,
          freeMinutes: 0,
          name: staffMember.name,
          nextOpening: null as string | null,
        };
      }

      const professionalAppointments = appointments.filter(
        (appointment) => appointment.staff_member_id === staffMember.id,
      );

      const occupiedMinutes = professionalAppointments.reduce((total, appointment) => {
        const startAt = new Date(appointment.date);
        const endAt = new Date(appointment.ends_at);
        const overlapStart = startAt > windowStart ? startAt : windowStart;
        const overlapEnd = endAt < closeAt ? endAt : closeAt;

        if (overlapEnd <= overlapStart) {
          return total;
        }

        return total + (overlapEnd.getTime() - overlapStart.getTime()) / 60000;
      }, 0);

      const totalWindowMinutes =
        (closeAt.getTime() - windowStart.getTime()) / 60000;
      const freeMinutes = Math.max(0, totalWindowMinutes - occupiedMinutes);
      const firstBusyStart = professionalAppointments
        .filter((appointment) => new Date(appointment.date) >= windowStart)
        .sort(
          (left, right) =>
            new Date(left.date).getTime() - new Date(right.date).getTime(),
        )[0]?.date;

      return {
        freeSlots: Math.floor(freeMinutes / slotStep),
        freeMinutes: Math.round(freeMinutes),
        name: staffMember.name,
        nextOpening: firstBusyStart ?? null,
      };
    })
    .sort((left, right) => {
      if (right.freeSlots !== left.freeSlots) {
        return right.freeSlots - left.freeSlots;
      }

      if (right.freeMinutes !== left.freeMinutes) {
        return right.freeMinutes - left.freeMinutes;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });

  const best = getMostAvailableProfessional(ranking);

  if (!best || best.freeSlots <= 0) {
    return {
      bullets: [
        `Nao encontrei janela livre para hoje em ${targetDay.label}.`,
        "Vale rever confirmacoes, cancelamentos ou abrir um encaixe manual na agenda.",
      ],
      ctaHref: `${MANAGEMENT_ROUTES.appointments}?day=${targetDay.dayKey}`,
      ctaLabel: "Abrir agenda",
      followUp:
        "Se quiser, eu posso olhar um servico especifico para ver qual profissional encaixa melhor.",
      priority: "medium",
      summary: `Hoje a equipe esta sem espaco livre relevante em ${targetDay.label}.`,
      title: "Agenda bem ocupada",
    };
  }

  return {
    bullets: ranking.slice(0, 3).map((item) => {
      const hours = Math.floor(item.freeMinutes / 60);
      const minutes = item.freeMinutes % 60;
      const windowLabel =
        hours > 0
          ? `${hours}h${minutes ? ` ${minutes}min` : ""}`
          : `${minutes}min`;
      return `${item.name}: ${item.freeSlots} slot(s) livres, cerca de ${windowLabel} no restante do dia.`;
    }),
    ctaHref: `${MANAGEMENT_ROUTES.appointments}?day=${targetDay.dayKey}`,
    ctaLabel: "Ver agenda do dia",
    followUp:
      "Se quiser, me diga o servico e eu respondo qual profissional tem mais encaixe real para ele.",
    priority: best.freeSlots >= 4 ? "low" : "medium",
    summary: `${best.name} tem a agenda mais livre em ${targetDay.label}, com ${best.freeSlots} slot(s) ainda disponiveis.`,
    title: "Profissional com mais horarios livres",
  };
}

async function buildVacancyStrategyDraft(
  args: PanelAssistantArgs,
): Promise<AssistantDraft> {
  const runtimeSuggestions = await executePanelAssistantTool({
    ...buildToolExecutionArgs(args),
    input: {
      question: args.question,
    },
    toolId: "sugerirEncaixes",
  });

  if (!runtimeSuggestions.available) {
    return {
      bullets: [
        runtimeSuggestions.snapshot.headline,
        "Se surgir uma janela ociosa real, eu cruzo historico e indico quem faz mais sentido chamar primeiro.",
      ],
      ctaHref: MANAGEMENT_ROUTES.appointments,
      ctaLabel: "Abrir agenda",
      followUp:
        "Se quiser, eu tambem posso apontar qual dia ou faixa esta mais fraco antes de abrir um buraco na agenda.",
      summary: runtimeSuggestions.snapshot.summary,
      title: "Sem vaga aberta agora",
    };
  }

  const runtimeSuggestionLines = runtimeSuggestions.candidates
    .slice(0, 3)
    .map(
      (candidate) =>
        `${candidate.name} (${candidate.daysSinceLastVisitLabel}, ${candidate.reasonLabel})`,
    );

  return {
    bullets: [
      `Abriu uma janela para ${runtimeSuggestions.snapshot.serviceName ?? "servico especial"} em ${runtimeSuggestions.snapshot.dayLabel ?? "um dia alvo"}, ${runtimeSuggestions.snapshot.windowLabel ?? "janela em aberto"}, com ${runtimeSuggestions.snapshot.staffName ?? "Equipe"}.`,
      runtimeSuggestionLines.length
        ? `Melhores nomes para tentar agora: ${runtimeSuggestionLines.join("; ")}.`
        : "Ainda nao encontrei uma cliente com historico forte o bastante para essa janela.",
      `${runtimeSuggestions.snapshot.openSlotsCount} horario(s) entram na oportunidade, com chance dominante ${runtimeSuggestions.snapshot.topChanceLabel?.toLowerCase() ?? "media"}.`,
    ],
    ctaHref: runtimeSuggestions.ctaHref ?? MANAGEMENT_ROUTES.appointments,
    ctaLabel: runtimeSuggestions.ctaLabel ?? "Abrir agenda",
    followUp:
      runtimeSuggestionLines.length > 0
        ? "Se quiser, eu ja deixo uma campanha curta ou abordagem direta pronta para os nomes mais quentes."
        : "Se quiser, eu monto uma oferta rapida para tentar ocupar essa janela com mais criterio.",
    summary: runtimeSuggestionLines.length > 0
      ? `A melhor chance de reencaixe agora esta em ${runtimeSuggestions.snapshot.serviceName ?? "uma janela aberta"}. Cruzei a base e encontrei ${runtimeSuggestions.candidates.length} cliente(s) com boa chance de retorno.`
      : runtimeSuggestions.snapshot.summary,
    title: "Melhor chance de reencaixe",
  };
}

async function buildMovementForecastDraft(
  args: PanelAssistantArgs & { operationalContext?: AssistantOperationalContext | null },
): Promise<AssistantDraft> {
  const readout = await buildOperationalManagerialReadout({
    actorUserId: args.userId ?? null,
    conversationId: args.conversationId ?? null,
    operationalContext: args.operationalContext ?? null,
    permissions: args.permissions,
    question: args.question,
    requestOrigin: args.requestOrigin,
    salon: args.salon,
    supabase: args.supabase,
  });

  return {
    actions: readout.actions,
    bullets: readout.bullets,
    ctaHref: readout.ctaHref,
    ctaLabel: readout.ctaLabel,
    followUp: readout.followUp,
    impact: readout.impact,
    missingData: readout.missingData,
    operationalContext: readout.operationalContext,
    priority: readout.priority,
    problem: readout.problem,
    recommendedAction: readout.recommendedAction,
    suggestion: readout.suggestion,
    summary: readout.summary,
    title: readout.title,
  };

  const {
    appointments: movementAppointments,
    currentMonthKey,
    lookbackStart,
    now,
    previousMonthKey,
    timeZone,
  } = await getOccupancyContext(args);

  if (movementAppointments.length < 6) {
    return {
      bullets: [
        INSUFFICIENT_DATA_MESSAGE,
        "Ainda nao existe historico suficiente para ler queda de movimento ou servicos em baixa com seguranca.",
      ],
      ctaHref: "/dashboard/operations",
      ctaLabel: "Abrir operacao",
      followUp:
        "Quando a agenda acumular mais base, eu consigo apontar dia fraco, faixa ociosa e servico em queda.",
      missingData: ["Historico de agenda"],
      priority: "low",
      problem: INSUFFICIENT_DATA_MESSAGE,
      recommendedAction:
        "Use agenda e financeiro como apoio e evite tratar isso como tendencia fechada por enquanto.",
      suggestion:
        "Aja com medidas leves e reversiveis ate a base ficar mais robusta.",
      summary: INSUFFICIENT_DATA_MESSAGE,
      title: "Movimento sem base suficiente",
    };
  }

  const weekdayCounts = new Map<string, { count: number; label: string; observed: number }>();
  const hourCounts = new Map<number, number>();
  const categoryDeltas = new Map<
    string,
    { currentCount: number; previousCount: number; currentRevenue: number; previousRevenue: number }
  >();

  for (
    let cursor = new Date(lookbackStart);
    cursor <= now;
    cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
  ) {
    const label = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone,
    }).format(cursor);
    const key = normalizeSearchText(label);
    const current = weekdayCounts.get(key) ?? { count: 0, label, observed: 0 };
    current.observed += 1;
    weekdayCounts.set(key, current);
  }

  for (const appointment of movementAppointments) {
    const service = firstRelation(appointment.services);
    const localDate = new Date(appointment.date);
    const weekdayLabel = new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      timeZone,
    }).format(localDate);
    const weekdayKey = normalizeSearchText(weekdayLabel);
    const weekdayBucket = weekdayCounts.get(weekdayKey) ?? {
      count: 0,
      label: weekdayLabel,
      observed: 0,
    };
    weekdayBucket.count += 1;
    weekdayCounts.set(weekdayKey, weekdayBucket);

    const hour = Number(
      new Intl.DateTimeFormat("en-CA", {
        hour: "2-digit",
        hour12: false,
        timeZone,
      }).format(localDate),
    );
    hourCounts.set(hour, (hourCounts.get(hour) ?? 0) + 1);

    const monthKey = getMonthKey(
      appointment.completed_at ?? appointment.date,
      timeZone,
    );
    const categoryLabel =
      cleanText(service?.category || service?.name || "Sem categoria", 80) ||
      "Sem categoria";
    const category = categoryDeltas.get(categoryLabel) ?? {
      currentCount: 0,
      previousCount: 0,
      currentRevenue: 0,
      previousRevenue: 0,
    };
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });

    if (monthKey === currentMonthKey) {
      category.currentCount += 1;
      category.currentRevenue += amount;
    } else if (monthKey === previousMonthKey) {
      category.previousCount += 1;
      category.previousRevenue += amount;
    }

    categoryDeltas.set(categoryLabel, category);
  }

  const weekdayAverages = [...weekdayCounts.values()]
    .filter((bucket) => bucket.observed > 0)
    .map((bucket) => ({
      average: bucket.count / bucket.observed,
      label: bucket.label,
    }))
    .sort((left, right) => left.average - right.average);
  const { strongestDay, weakestDay } = getWeakDays(weekdayAverages);
  const weakestHour =
    Array.from({ length: 12 }, (_, index) => 8 + index)
      .map((hour) => ({ count: hourCounts.get(hour) ?? 0, hour }))
      .sort((left, right) => left.count - right.count)[0] ?? null;
  const weakestCategory =
    [...categoryDeltas.entries()]
      .map(([label, stats]) => ({
        delta: stats.currentCount - stats.previousCount,
        label,
      }))
      .sort((left, right) => left.delta - right.delta)[0] ?? null;

  if (!weakestDay || !strongestDay) {
    return {
      bullets: [
        "Ainda não há histórico suficiente para uma leitura confiável de sazonalidade.",
        "Assim que a agenda acumular mais movimento, eu aponto o dia mais fraco e a faixa mais vazia.",
      ],
      ctaHref: "/dashboard/operations",
      ctaLabel: "Abrir operacao",
      followUp:
        "Enquanto isso, use agenda e financeiro para consolidar base. Depois eu consigo ler tendência com mais segurança.",
      summary:
        "O salão ainda precisa de mais histórico para uma previsão de movimento confiável.",
      title: "Base ainda curta para previsao",
    };
  }

  return {
    bullets: [
      `${cleanText(weakestDay.label, 60) || "Dia mais fraco"} vem rodando em média ${weakestDay.average.toFixed(1).replace(".", ",")} atendimento(s) por dia.`,
      `${cleanText(strongestDay.label, 60) || "Dia mais forte"} sustenta ${strongestDay.average.toFixed(1).replace(".", ",")} atendimento(s) por dia.`,
      weakestHour
        ? `A faixa das ${String(weakestHour.hour).padStart(2, "0")}:00 aparece como a mais ociosa no histórico recente.`
        : "Nenhuma faixa horária ficou fraca o bastante para virar alerta agora.",
      weakestCategory && weakestCategory.delta < 0
        ? `${weakestCategory.label} perdeu ritmo no comparativo do mês.`
        : "Nenhum serviço caiu forte o suficiente para virar alerta agora.",
    ],
    ctaHref: "/dashboard/operations",
    ctaLabel: "Abrir operacao",
    followUp:
      weakestCategory && weakestCategory.delta < 0
        ? `Vale agir primeiro em ${weakestCategory.label} na janela mais fraca da semana, com campanha curta ou reativação.`
        : "Se quiser, eu transformo essa leitura em uma ação prática para a agenda ou para promoções.",
    summary:
      weakestCategory && weakestCategory.delta < 0
        ? `${cleanText(weakestDay.label, 60) || "O dia mais fraco"} está abaixo do ritmo e ${weakestCategory.label} perdeu força neste mês.`
        : `${cleanText(weakestDay.label, 60) || "O dia mais fraco"} segue como o ponto mais sensível da semana, enquanto ${cleanText(strongestDay.label, 60) || "o dia mais forte"} continua puxando a agenda.`,
    title: "Previsao de movimento da semana",
  };
}

async function buildRecoveryCampaignDraft(
  args: PanelAssistantArgs,
): Promise<AssistantDraft> {
  const runtimeCampaign = await executePanelAssistantTool({
    ...buildToolExecutionArgs(args),
    input: {
      question: args.question,
    },
    toolId: "criarCampanha",
  });

  if (!runtimeCampaign.available || !runtimeCampaign.draft) {
    return {
      bullets: [
        runtimeCampaign.snapshot.summary,
        "Quando surgir uma janela ociosa de verdade, eu cruzo clientes e deixo a campanha pronta para revisao.",
      ],
      ctaHref: runtimeCampaign.ctaHref ?? "/dashboard/gestao/agendamentos",
      ctaLabel: runtimeCampaign.ctaLabel ?? "Abrir agenda",
      followUp: runtimeCampaign.followUp,
      summary: runtimeCampaign.snapshot.summary,
      title: runtimeCampaign.snapshot.headline,
    };
  }

  const topCandidate = runtimeCampaign.candidates[0] ?? null;
  const campaignHref = buildPrefilledPromotionsComposerHref({
    aiGoal: "reativar clientes parados",
    aiNotes: [
      `Janela alvo: ${runtimeCampaign.snapshot.dayLabel}, ${runtimeCampaign.snapshot.windowLabel}, com ${runtimeCampaign.snapshot.staffName}.`,
      `Chance mais alta no radar: ${runtimeCampaign.snapshot.topChanceLabel}.`,
      runtimeCampaign.draft.strategyBullets.join(" "),
    ].join(" "),
    description: runtimeCampaign.draft.whatsappText,
    highlight: runtimeCampaign.draft.discountLabel,
    kind: "promotion",
    price: runtimeCampaign.draft.priceSuggestion,
    title: runtimeCampaign.draft.campaignName,
  });
  const feedHref = buildPrefilledFeedComposerHref({
    aiNotes: runtimeCampaign.draft.strategyBullets.join(" "),
    caption: runtimeCampaign.draft.instagramCaption,
    postType: "story",
    title: runtimeCampaign.draft.campaignName,
  });

  return {
    actions: [
      {
        href: campaignHref,
        kind: "primary",
        label: "Abrir campanha pronta",
      },
      {
        href: feedHref,
        kind: "secondary",
        label: "Criar story da vaga",
      },
      ...(topCandidate
        ? [
            {
              href: buildClientFocusHref({
                clientId: topCandidate.customerId,
                query: topCandidate.name,
              }),
              kind: "secondary" as const,
              label: "Abrir cliente com chance alta",
            },
          ]
        : []),
    ],
    bullets: [
      `Janela com espaco: ${runtimeCampaign.snapshot.dayLabel}, ${runtimeCampaign.snapshot.windowLabel}, com ${runtimeCampaign.snapshot.staffName}.`,
      `${runtimeCampaign.candidates.length} cliente(s) sugeridos, sendo ${runtimeCampaign.snapshot.highChanceCount} com chance alta de retorno.`,
      `Rascunho pronto: ${runtimeCampaign.draft.campaignName}, com ${runtimeCampaign.draft.discountLabel}.`,
      "Mensagem, legenda e estrategia ja ficaram preparadas para revisao no painel.",
    ],
    ctaHref: campaignHref,
    ctaLabel: "Abrir campanha pronta",
    followUp: runtimeCampaign.followUp,
    summary: runtimeCampaign.snapshot.summary,
    title: "Campanha inteligente de preenchimento",
  };
}

function buildUpsellSuggestion(serviceName: string, categoryName: string | null) {
  const normalized = normalizeSearchText(`${categoryName ?? ""} ${serviceName}`);

  if (normalized.includes("progressiva") || normalized.includes("color")) {
    return "Ofereca hidratacao ou reconstrucao para aumentar o ticket do retorno.";
  }

  if (normalized.includes("corte")) {
    return "Teste um combo com barba, finalizacao ou tratamento rapido para elevar o ticket.";
  }

  if (normalized.includes("manicure") || normalized.includes("pedicure")) {
    return "Monte um combo manicure + pedicure ou spa das maos para vender mais no mesmo atendimento.";
  }

  if (normalized.includes("sobrancelha")) {
    return "Convide para um pacote com design, henna ou outro cuidado rapido de embelezamento.";
  }

  return "Pense em um combo simples com servico complementar para aumentar o ticket sem alongar demais a agenda.";
}

async function buildCustomerSummaryDraft(
  args: PanelAssistantArgs,
): Promise<AssistantDraft> {
  const requestedCustomerName = extractCustomerSearchTerm(args.question);

  if (!requestedCustomerName) {
    return {
      bullets: [
        "Me diga o nome da cliente junto do pedido.",
        "Exemplo: Cliente Ana ou Resumo da cliente Maria.",
      ],
      ctaHref: MANAGEMENT_ROUTES.clients,
      ctaLabel: "Abrir clientes",
      followUp:
        "Quando voce mandar o nome, eu cruzo ultima visita, servico favorito, ticket medio e a melhor forma de abordar.",
      summary:
        "Para montar um resumo real, eu preciso do nome da cliente.",
      title: "Falta o nome da cliente",
    };
  }

  const customerSummaryLookup = await executePanelAssistantTool({
    ...buildToolExecutionArgs(args),
    input: {
      searchTerm: requestedCustomerName,
    },
    toolId: "getCustomerSummary",
  });
  const resolvedCustomer = customerSummaryLookup.customer;

  if (!resolvedCustomer) {
    return {
      bullets: [
        `Nao encontrei uma cliente com o nome ${requestedCustomerName}.`,
        "Vale conferir o cadastro ou buscar pelo nome completo.",
      ],
      ctaHref: MANAGEMENT_ROUTES.clients,
      ctaLabel: "Abrir clientes",
      followUp:
        "Se quiser, me mande outro nome e eu monto o resumo com base no historico real.",
      summary: `Ainda nao encontrei uma cliente chamada ${requestedCustomerName} neste salao.`,
      title: "Cliente nao encontrada",
    };
  }

  const customerAppointments =
    customerSummaryLookup.appointments as CustomerAppointmentRow[];
  const runtimeCompletedAppointments = customerAppointments.filter(
    (appointment) => appointment.status === "completed",
  );
  const runtimeUpcomingAppointments = customerAppointments.filter(
    (appointment) =>
      appointment.status === "pending" || appointment.status === "confirmed",
  );
  const runtimeServiceCounters = new Map<
    string,
    { category: string | null; count: number; name: string; total: number }
  >();
  const runtimeProfessionalCounters = new Map<string, number>();
  let runtimeTotalSpent = 0;

  for (const appointment of runtimeCompletedAppointments) {
    const service = firstRelation(appointment.services);
    const professional = firstRelation(appointment.staff_members);
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    runtimeTotalSpent += amount;

    if (service?.name) {
      const current = runtimeServiceCounters.get(service.name) ?? {
        category: service.category ?? null,
        count: 0,
        name: service.name,
        total: 0,
      };
      current.count += 1;
      current.total += amount;
      runtimeServiceCounters.set(service.name, current);
    }

    if (professional?.name) {
      runtimeProfessionalCounters.set(
        professional.name,
        (runtimeProfessionalCounters.get(professional.name) ?? 0) + 1,
      );
    }
  }

  const runtimeFavoriteService =
    [...runtimeServiceCounters.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return right.total - left.total;
    })[0] ?? null;
  const runtimePreferredProfessional =
    [...runtimeProfessionalCounters.entries()].sort((left, right) => right[1] - left[1])[0] ??
    null;
  const runtimeLastVisitAt =
    runtimeCompletedAppointments[0]?.completed_at ??
    runtimeCompletedAppointments[0]?.date ??
    null;
  const runtimeDaysSinceLastVisit = runtimeLastVisitAt
    ? Math.max(
        0,
        Math.round(
          (Date.now() - new Date(runtimeLastVisitAt).getTime()) /
            (1000 * 60 * 60 * 24),
        ),
      )
    : null;
  const runtimeAverageTicket =
    runtimeCompletedAppointments.length > 0
      ? runtimeTotalSpent / runtimeCompletedAppointments.length
      : 0;
  const runtimeCampaignSuggestion =
    runtimeDaysSinceLastVisit != null && runtimeDaysSinceLastVisit >= 45
      ? "reativacao com mensagem curta e oferta simples"
      : runtimeUpcomingAppointments.length
        ? "aquecimento antes do atendimento e oferta complementar"
        : "lembrete de manutencao do servico favorito";
  const runtimeUpsellSuggestion = runtimeFavoriteService
    ? buildUpsellSuggestion(
        runtimeFavoriteService.name,
        runtimeFavoriteService.category,
      )
    : "Use um combo leve com servico complementar para aumentar o ticket.";
  const customerCampaignNotes = [
    `Cliente foco: ${resolvedCustomer.name}.`,
    runtimeLastVisitAt
      ? `Ultima visita ha ${runtimeDaysSinceLastVisit} dia(s).`
      : "Ainda sem atendimento concluido.",
    runtimeFavoriteService
      ? `Servico favorito: ${runtimeFavoriteService.name}.`
      : "Servico favorito ainda indefinido.",
    runtimePreferredProfessional
      ? `Profissional mais recorrente: ${runtimePreferredProfessional[0]}.`
      : "Sem profissional dominante ainda.",
    `Ticket medio: ${formatCurrency(runtimeAverageTicket)}.`,
    `Abordagem sugerida: ${runtimeCampaignSuggestion}.`,
  ].join(" ");
  const customerFocusHref = buildClientFocusHref({
    clientId: resolvedCustomer.id,
    query: resolvedCustomer.name,
  });
  const customerCampaignHref = buildPrefilledPromotionsComposerHref({
    aiGoal:
      runtimeDaysSinceLastVisit != null && runtimeDaysSinceLastVisit >= 45
        ? "reativar clientes parados"
        : "lotar a agenda desta semana",
    aiNotes: customerCampaignNotes,
    kind: "promotion",
    title:
      runtimeFavoriteService?.name
        ? `Retorno de ${runtimeFavoriteService.name}`
        : `Retorno de ${resolvedCustomer.name}`,
  });

  return {
    actions: [
      {
        href: customerFocusHref,
        kind: "primary",
        label: "Abrir cliente",
      },
      {
        href: customerCampaignHref,
        kind: "secondary",
        label: "Montar campanha de retorno",
      },
    ],
    bullets: [
      runtimeLastVisitAt
        ? `Ultima visita ha ${runtimeDaysSinceLastVisit} dia(s).`
        : "Ainda sem atendimento concluido.",
      runtimeFavoriteService
        ? `Servico com mais recorrencia: ${runtimeFavoriteService.name}.`
        : "Ainda sem servico favorito definido.",
      `Ticket medio: ${formatCurrency(runtimeAverageTicket)}.`,
      runtimePreferredProfessional
        ? `Profissional com mais historico: ${runtimePreferredProfessional[0]}.`
        : "Ainda sem profissional dominante.",
    ],
    ctaHref: customerFocusHref,
    ctaLabel: "Abrir cliente",
    followUp: `Se quiser, eu preparo uma abordagem de ${runtimeCampaignSuggestion} e ja deixo um upsell no caminho: ${runtimeUpsellSuggestion}`,
    resolvedCustomerId: resolvedCustomer.id,
    summary:
      runtimeCompletedAppointments.length > 0
        ? `${resolvedCustomer.name} ja concluiu ${runtimeCompletedAppointments.length} visita(s), tem ticket medio de ${formatCurrency(runtimeAverageTicket)} e ${runtimeUpcomingAppointments.length} agenda(s) futura(s) no radar.`
        : `${resolvedCustomer.name} ainda nao concluiu atendimento neste salao. Vale usar a primeira visita para construir retorno e upsell com cuidado.`,
    title: `Resumo da cliente ${resolvedCustomer.name}`,
  };
}

async function buildFinanceAnalysisDraft(
  args: PanelAssistantArgs,
): Promise<AssistantDraft> {
  const { appointments, currentMonth, payments, previousMonth, timeZone } =
    await getFinancialContext(args);

  if (!appointments.length && !payments.length) {
    return {
      bullets: [
        INSUFFICIENT_DATA_MESSAGE,
        "Nao encontrei atendimentos concluidos ou recebimentos suficientes no periodo analisado.",
      ],
      ctaHref: "/dashboard/finance",
      ctaLabel: "Ver faturamento",
      followUp:
        "Quando houver base minima no financeiro, eu consigo apontar queda, alta e servicos em baixa.",
      missingData: ["Atendimentos concluidos", "Recebimentos"],
      priority: "low",
      problem: INSUFFICIENT_DATA_MESSAGE,
      recommendedAction:
        "Abra o financeiro e confira se o periodo e os registros de pagamento estao completos.",
      suggestion:
        "Nao decida campanha ou desconto sem validar primeiro a base financeira.",
      summary: INSUFFICIENT_DATA_MESSAGE,
      title: "Financeiro sem base suficiente",
    };
  }

  const revenueByMonth = new Map<string, number>();
  const receivedByMonth = new Map<string, number>();
  const categories = new Map<
    string,
    { currentCount: number; currentRevenue: number; previousCount: number; previousRevenue: number }
  >();

  for (const appointment of appointments) {
    const service = firstRelation(appointment.services);
    const referenceDate = appointment.completed_at ?? appointment.date;
    const monthKey = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).format(new Date(referenceDate));
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    revenueByMonth.set(monthKey, (revenueByMonth.get(monthKey) ?? 0) + amount);

    const categoryName = cleanText(
      service?.category || service?.name || "Sem categoria",
      80,
    );
    const current = categories.get(categoryName) ?? {
      currentCount: 0,
      currentRevenue: 0,
      previousCount: 0,
      previousRevenue: 0,
    };

    if (monthKey === currentMonth.key) {
      current.currentCount += 1;
      current.currentRevenue += amount;
    } else if (monthKey === previousMonth.key) {
      current.previousCount += 1;
      current.previousRevenue += amount;
    }

    categories.set(categoryName, current);
  }

  for (const payment of payments) {
    const monthKey = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
    }).format(new Date(payment.paid_at));
    receivedByMonth.set(
      monthKey,
      (receivedByMonth.get(monthKey) ?? 0) + toNumber(payment.amount),
    );
  }

  const currentRevenue = revenueByMonth.get(currentMonth.key) ?? 0;
  const previousRevenue = revenueByMonth.get(previousMonth.key) ?? 0;
  const currentReceived = receivedByMonth.get(currentMonth.key) ?? 0;
  const previousReceived = receivedByMonth.get(previousMonth.key) ?? 0;
  const revenueDelta = calculateDeltaPercent(currentRevenue, previousRevenue);
  const receivedDelta = calculateDeltaPercent(currentReceived, previousReceived);
  const weakestCategory =
    [...categories.entries()]
      .map(([name, stats]) => ({
        countDelta: stats.currentCount - stats.previousCount,
        name,
        revenueDelta: stats.currentRevenue - stats.previousRevenue,
        stats,
      }))
      .sort((left, right) => {
        if (left.countDelta !== right.countDelta) {
          return left.countDelta - right.countDelta;
        }
        return left.revenueDelta - right.revenueDelta;
      })[0] ?? null;

  const revenueDirection =
    revenueDelta < 0
      ? `caiu ${Math.abs(revenueDelta)}%`
      : revenueDelta > 0
        ? `subiu ${revenueDelta}%`
        : "ficou estavel";
  const receivedDirection =
    receivedDelta < 0
      ? `O recebido ficou ${Math.abs(receivedDelta)}% abaixo`
      : receivedDelta > 0
        ? `O recebido ficou ${receivedDelta}% acima`
        : "O recebido ficou estável";

  return {
    bullets: [
      `Faturamento concluído em ${currentMonth.label}: ${formatCurrency(currentRevenue)}.`,
      `${receivedDirection} em relação ao mês anterior, com ${formatCurrency(currentReceived)} já entrando no caixa.`,
      weakestCategory
        ? `${weakestCategory.name} perdeu ritmo: saiu de ${weakestCategory.stats.previousCount} para ${weakestCategory.stats.currentCount} atendimento(s).`
        : "Ainda não apareceu uma categoria fraca o bastante para destaque.",
    ],
    ctaHref: "/dashboard/finance",
    ctaLabel: "Abrir financeiro",
    followUp:
      weakestCategory && weakestCategory.stats.currentCount < weakestCategory.stats.previousCount
        ? `Vale atacar primeiro ${weakestCategory.name}, que perdeu ritmo no comparativo recente.`
        : "Vale cruzar ticket, recebimento e agenda antes da próxima campanha.",
    summary: `Em ${currentMonth.label}, o faturamento ${revenueDirection}. Até agora, o salão soma ${formatCurrency(currentRevenue)} em atendimentos concluídos e ${formatCurrency(currentReceived)} já recebidos no mês.`,
    title: "Leitura financeira do mes",
  };
}

function resolvePromotionTargetWeekday(question: string) {
  const normalized = normalizeSearchText(question);

  for (const label of WEEKDAY_LABELS) {
    const normalizedLabel = normalizeSearchText(label);

    if (normalized.includes(normalizedLabel)) {
      return normalizedLabel;
    }
  }

  return "sexta feira";
}

async function buildPromotionStrategyDraft(
  args: PanelAssistantArgs,
): Promise<AssistantDraft> {
  const { appointments, services, targetWeekday, timeZone } =
    await getCampaignContext(args, args.question);

  if (!appointments.length || !services.length) {
    return {
      bullets: [
        INSUFFICIENT_DATA_MESSAGE,
        "Nao encontrei historico comercial suficiente para montar uma campanha segura.",
      ],
      ctaHref: "/dashboard/benefits/promotions?compose=1",
      ctaLabel: "Criar campanha",
      followUp:
        "Quando houver servicos ativos e historico minimo de agenda, eu consigo sugerir oferta e foco com mais seguranca.",
      missingData: [
        !appointments.length ? "Historico de agenda" : "",
        !services.length ? "Servicos ativos" : "",
      ].filter(Boolean),
      priority: "low",
      problem: INSUFFICIENT_DATA_MESSAGE,
      recommendedAction:
        "Valide servicos ativos e movimento recente antes de gerar a campanha.",
      suggestion:
        "Se precisar agir agora, use uma oferta simples e confirme manualmente margem e disponibilidade.",
      summary: INSUFFICIENT_DATA_MESSAGE,
      title: "Campanha sem base suficiente",
    };
  }

  const matchedService = findBestServiceMatch(args.question, services);
  const weekdayStats = new Map<string, { count: number; revenue: number }>();
  const serviceCounters = new Map<string, { count: number; name: string; total: number }>();

  for (const appointment of appointments) {
    const service = firstRelation(appointment.services);
    const date = new Date(appointment.date);
    const weekdayLabel = normalizeSearchText(
      new Intl.DateTimeFormat("pt-BR", {
        weekday: "long",
        timeZone,
      }).format(date),
    );
    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const weekdayCurrent = weekdayStats.get(weekdayLabel) ?? {
      count: 0,
      revenue: 0,
    };
    weekdayCurrent.count += 1;
    weekdayCurrent.revenue += amount;
    weekdayStats.set(weekdayLabel, weekdayCurrent);

    if (service?.name) {
      const current = serviceCounters.get(service.name) ?? {
        count: 0,
        name: service.name,
        total: 0,
      };
      current.count += 1;
      current.total += amount;
      serviceCounters.set(service.name, current);
    }
  }

  const topServiceByHistory =
    [...serviceCounters.values()].sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return right.total - left.total;
    })[0] ?? null;
  const bestService =
    matchedService ??
    services.find((service) => service.name === topServiceByHistory?.name) ??
    (topServiceByHistory
      ? ({
          category: null,
          duration: null,
          id: "",
          name: topServiceByHistory.name,
          price: null,
        } satisfies ServiceMatch)
      : null);

  const targetStats = weekdayStats.get(targetWeekday) ?? { count: 0, revenue: 0 };
  const weekdayAverageCount =
    weekdayStats.size > 0
      ? [...weekdayStats.values()].reduce((sum, item) => sum + item.count, 0) /
        weekdayStats.size
      : 0;
  const weekdayAverageRevenue =
    weekdayStats.size > 0
      ? [...weekdayStats.values()].reduce((sum, item) => sum + item.revenue, 0) /
        weekdayStats.size
      : 0;
  const priceHint =
    bestService?.price != null
      ? Math.max(0, Number(bestService.price) * 0.9)
      : targetStats.count < weekdayAverageCount
        ? 79
        : null;
  const goal =
    cleanText(args.question, 120) || `${targetWeekday} com baixo movimento`;
  const offerDraft = await generatePromotionDraftWithAi({
    goal,
    kind: "promotion",
    notes: [
      `Dia alvo: ${formatWeekdayDisplay(targetWeekday)}.`,
      `Media do dia: ${targetStats.count} atendimento(s) e ${formatCurrency(targetStats.revenue)} nas ultimas semanas.`,
      `Media geral por dia: ${weekdayAverageCount.toFixed(1)} atendimento(s) e ${formatCurrency(weekdayAverageRevenue)}.`,
      bestService
        ? `Servico foco: ${bestService.name}.`
        : "Sem servico foco definido.",
      "Pense em urgencia simples e chamada facil para agenda.",
    ].join(" "),
    priceHint,
    requestOrigin: args.requestOrigin,
    salonName: args.salon.name,
    serviceName: bestService?.name ?? "servico especial",
    titleHint: null,
  });
  const campaignHref = buildPrefilledPromotionsComposerHref({
    aiGoal: goal,
    aiNotes: [
      `Dia alvo: ${formatWeekdayDisplay(targetWeekday)}.`,
      bestService ? `Servico foco: ${bestService.name}.` : null,
      `Media recente do dia: ${targetStats.count} atendimento(s).`,
    ]
      .filter(Boolean)
      .join(" "),
    description: offerDraft.description,
    highlight: offerDraft.highlightText,
    kind: "promotion",
    price: offerDraft.priceSuggestion,
    serviceId: bestService?.id || null,
    title: offerDraft.title,
  });
  const feedHref = buildPrefilledFeedComposerHref({
    aiNotes: [
      `Oferta criada para ${formatWeekdayDisplay(targetWeekday)}.`,
      bestService ? `Servico foco: ${bestService.name}.` : null,
      "Convide para reservar no app com urgencia simples.",
    ]
      .filter(Boolean)
      .join(" "),
    caption: `${offerDraft.highlightText} ${offerDraft.description}`,
    postType: "standard",
    serviceId: bestService?.id || null,
    title: offerDraft.title,
  });

  return {
    actions: [
      {
        href: campaignHref,
        kind: "primary",
        label: "Abrir campanha pronta",
      },
      {
        href: feedHref,
        kind: "secondary",
        label: "Criar post da campanha",
      },
    ],
    bullets: [
      `Oferta sugerida: ${offerDraft.title}.`,
      `Preço sugerido: ${offerDraft.priceSuggestion != null ? formatCurrency(offerDraft.priceSuggestion) : "definir no painel"}.`,
      `${formatWeekdayDisplay(targetWeekday)} vem com média recente de ${targetStats.count} atendimento(s).`,
      bestService ? `Serviço foco: ${bestService.name}.` : "Serviço foco ainda em aberto.",
    ],
    ctaHref: campaignHref,
    ctaLabel: "Abrir campanha pronta",
    followUp:
      "Se quiser, eu deixo essa oferta pronta em Promoções para você só revisar preço, mensagem e período.",
    summary: `${offerDraft.highlightText} ${offerDraft.description}`,
    title: `Promocao sugerida: ${offerDraft.title}`,
  };
}

function buildPanelHelpDraft(question: string): AssistantDraft {
  const normalizedQuestion = normalizeSearchText(question);
  const topic =
    HELP_TOPICS.find((item) =>
      item.keywords.some((keyword) => normalizedQuestion.includes(keyword)),
    ) ?? HELP_TOPICS[0];

  return {
    bullets: [...topic.bullets],
    ctaHref: topic.ctaHref,
    ctaLabel: topic.ctaLabel,
    followUp: topic.followUp,
    summary: topic.summary,
    title: topic.title,
  };
}

async function buildOperationalContext(
  args: PanelAssistantArgs,
): Promise<AssistantOperationalContext | null> {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const todayKey = getLocalDateKey(now, timeZone);
  const tomorrowKey = getLocalDateKey(
    new Date(now.getTime() + 24 * 60 * 60 * 1000),
    timeZone,
  );
  const todayRange = getUtcRangeForLocalDate(todayKey, timeZone);
  const monthKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(now);
  const monthRange = getUtcRangeForLocalMonth(monthKey, timeZone);
  const cancellationLookback = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    todayAppointmentsResult,
    pendingAppointmentsResult,
    completedMonthResult,
    recentCancelledResult,
    recoverySnapshot,
    tomorrowOccupancy,
  ] = await Promise.all([
    args.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", args.salon.id)
      .gte("date", todayRange.start.toISOString())
      .lt("date", todayRange.end.toISOString())
      .in("status", ["pending", "confirmed", "completed"]),
    args.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", args.salon.id)
      .eq("status", "pending"),
    args.supabase
      .from("appointments")
      .select("service_price_snapshot,services(price)", {})
      .eq("salon_id", args.salon.id)
      .eq("status", "completed")
      .gte("completed_at", monthRange.start.toISOString())
      .lt("completed_at", monthRange.end.toISOString())
      .limit(2000),
    args.supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", args.salon.id)
      .eq("status", "cancelled")
      .gte("cancelled_at", cancellationLookback.toISOString()),
    getRecoveryCampaignSnapshot({
      question: "Preencher agenda de amanha com IA",
      salon: args.salon,
      supabase: args.supabase,
    }),
    computeDayOccupancySnapshot({
      dayKey: tomorrowKey,
      now,
      salon: args.salon,
      supabase: args.supabase,
    }),
  ]);

  if (todayAppointmentsResult.error) {
    throw todayAppointmentsResult.error;
  }
  if (pendingAppointmentsResult.error) {
    throw pendingAppointmentsResult.error;
  }
  if (completedMonthResult.error) {
    throw completedMonthResult.error;
  }
  if (recentCancelledResult.error) {
    throw recentCancelledResult.error;
  }

  const monthRevenue = ((completedMonthResult.data ?? []) as FinanceAppointmentRow[]).reduce(
    (sum, appointment) => {
      const service = firstRelation(appointment.services);
      return (
        sum +
        resolveBookedAppointmentAmount({
          servicePrice: service?.price,
          servicePriceSnapshot: appointment.service_price_snapshot,
        })
      );
    },
    0,
  );

  const tomorrowOccupancyLabel =
    tomorrowOccupancy.occupancyPercent == null
      ? "Sem grade aberta"
      : `${tomorrowOccupancy.occupancyPercent}%`;
  const operationalRiskLabel = buildOperationalRiskLabel({
    cancellationsLast7d: recentCancelledResult.count ?? 0,
    pendingAppointmentsCount: pendingAppointmentsResult.count ?? 0,
    tomorrowOccupancyPercent: tomorrowOccupancy.occupancyPercent,
  });
  const fitChanceLabel = buildFillChanceLabel({
    candidateCount: recoverySnapshot.candidateCount,
    highChanceCount: recoverySnapshot.highChanceCount,
    topChanceLabel: recoverySnapshot.topChanceLabel,
  });

  const context = {
    cancellationsLast7d: recentCancelledResult.count ?? 0,
    fitChanceLabel,
    monthRevenueLabel: formatCurrency(monthRevenue),
    operationalRiskLabel,
    pendingAppointmentsCount: pendingAppointmentsResult.count ?? 0,
    summary:
      `Hoje voce esta com ${todayAppointmentsResult.count ?? 0} atendimento(s), ` +
      `${pendingAppointmentsResult.count ?? 0} confirmacao(oes) pendente(s), ` +
      `ocupacao de ${tomorrowOccupancyLabel} amanha e ` +
      `${formatCurrency(monthRevenue)} concluidos no mes.`,
    todayAppointmentsCount: todayAppointmentsResult.count ?? 0,
    tomorrowOccupancyLabel,
    tomorrowOccupancyPercent: tomorrowOccupancy.occupancyPercent,
    tomorrowOpenSlotsCount: recoverySnapshot.openSlotsCount,
  } satisfies AssistantOperationalContext;

  return context;
}

function decorateAssistantDraft(args: {
  intent: PanelAssistantIntent;
  draft: AssistantDraft;
  operationalContext: AssistantOperationalContext | null;
}): AssistantDraft {
  const mergeFrame = (frame: AssistantDecisionFrame) => ({
    ...frame,
    ...args.draft,
    actions: args.draft.actions?.length ? args.draft.actions : frame.actions,
    impact: args.draft.impact ?? frame.impact,
    operationalContext:
      args.draft.operationalContext ?? frame.operationalContext,
    priority: args.draft.priority ?? frame.priority,
    problem: args.draft.problem ?? frame.problem,
    recommendedAction:
      args.draft.recommendedAction ?? frame.recommendedAction,
    suggestion: args.draft.suggestion ?? frame.suggestion,
  });

  switch (args.intent) {
    case "customer_summary":
      return mergeFrame(
        buildClientDecisionFrame({
          clientId: args.draft.resolvedCustomerId ?? null,
          missingData: args.draft.missingData,
          operationalContext: args.operationalContext,
          priority: args.draft.priority,
        }),
      );
    case "finance_analysis":
      return mergeFrame(
        buildFinanceDecisionFrame({
          missingData: args.draft.missingData,
          operationalContext: args.operationalContext,
          priority: args.draft.priority,
          summary: args.draft.summary,
        }),
      );
    case "movement_forecast":
    case "vacancy_strategy":
      return mergeFrame(
        buildOccupancyDecisionFrame({
          missingData: args.draft.missingData,
          operationalContext: args.operationalContext,
          priority: args.draft.priority,
          summary: args.draft.summary,
        }),
      );
    case "promotion_strategy":
      return mergeFrame(
        buildMarketingDecisionFrame({
          missingData: args.draft.missingData,
          operationalContext: args.operationalContext,
          priority: args.draft.priority,
        }),
      );
    case "recovery_campaign":
      return mergeFrame(
        buildCampaignDecisionFrame({
          missingData: args.draft.missingData,
          operationalContext: args.operationalContext,
          priority: args.draft.priority,
          summary: args.draft.summary,
        }),
      );
    case "panel_help":
      return {
        ...args.draft,
        actions: [
          {
            href: args.draft.ctaHref ?? "/dashboard",
            kind: "primary",
            label: args.draft.ctaLabel ?? "Abrir painel",
          },
          {
            href: "/dashboard/ai",
            kind: "secondary",
            label: "Abrir central IA",
          },
        ],
        impact:
          "Resposta rapida reduz erro operacional e diminui dependencia de suporte.",
        operationalContext: args.operationalContext,
        priority: "low",
        problem: "A equipe precisa executar a rotina certa sem travar a operacao.",
        recommendedAction:
          "Abra a tela indicada e conclua a configuracao com base nesse passo a passo.",
        suggestion:
          "Se a duvida continuar, faça a pergunta em cima do modulo especifico para eu responder mais direto.",
      };
    case "schedule_availability":
    default:
      return mergeFrame(
        buildAgendaDecisionFrame({
          ctaHref: args.draft.ctaHref,
          missingData: args.draft.missingData,
          operationalContext: args.operationalContext,
          priority: args.draft.priority,
          summary: args.draft.summary,
        }),
      );
  }
}

export function isPanelAssistantAiEnabled() {
  return isOpenRouterEnabled();
}

export async function listPanelAssistantHistory(args: {
  admin?: any | null;
  conversationId?: string | null;
  limit?: number;
  salonId: string;
  supabase?: any;
}): Promise<PanelAssistantHistoryItem[]> {
  const admin = resolvePanelAssistantHistoryAdminClient(
    args.admin ?? args.supabase ?? null,
  );

  if (!admin) {
    return [];
  }

  const conversationId = normalizeConversationId(args.conversationId);
  let query = admin
    .from("security_audit_logs")
    .select("id,created_at,event_type,metadata,target_type")
    .eq("event_type", PANEL_ASSISTANT_HISTORY_EVENT_TYPE)
    .eq("target_type", PANEL_ASSISTANT_HISTORY_TARGET_TYPE)
    .eq("salon_id", args.salonId);

  if (conversationId && typeof query.contains === "function") {
    query = query.contains("metadata", {
      conversationId,
    });
  }

  const result = await query
    .order("created_at", { ascending: false })
    .limit(args.limit ?? 12);

  if (result.error) {
    throw result.error;
  }

  const rows = ((result.data ?? []) as PanelAssistantHistoryRow[]).filter((row) => {
    if (!conversationId) {
      return true;
    }

    return normalizeConversationId(
      typeof row.metadata?.conversationId === "string"
        ? row.metadata.conversationId
        : null,
    ) === conversationId;
  });

  return rows
    .map(mapHistoryRow)
    .filter((item): item is PanelAssistantHistoryItem => item !== null);
}

export async function savePanelAssistantHistory(args: {
  admin?: any | null;
  answer: PanelAssistantAnswer;
  conversationId?: string | null;
  question: string;
  requestPath?: string | null;
  requestOrigin?: string | null;
  runtimeSupabase?: any;
  salonId: string;
  supabase?: any;
  userId?: string | null;
  userAgent?: string | null;
}): Promise<PanelAssistantHistoryItem | null> {
  const admin = resolvePanelAssistantHistoryAdminClient(args.admin ?? null);
  const runtimeSupabase = args.runtimeSupabase ?? args.supabase ?? null;

  const panelAssistantAiMetadata = getPanelAssistantAiMetadata();
  const createdAt = new Date().toISOString();
  const conversationId = normalizeConversationId(args.conversationId);
  let insertData: PanelAssistantHistoryRow | null = null;

  if (admin) {
    const insertResult = await admin
      .from("security_audit_logs")
      .insert({
        actor_user_id: args.userId ?? null,
        created_at: createdAt,
        event_type: PANEL_ASSISTANT_HISTORY_EVENT_TYPE,
        metadata: {
          actions: args.answer.actions,
          answerBullets: args.answer.bullets,
          answerCtaHref: args.answer.ctaHref,
          answerCtaLabel: args.answer.ctaLabel,
          answerFollowUp: args.answer.followUp,
          answerImpact: args.answer.impact,
          answerMissingData: args.answer.missingData,
          answerOperationalContext: args.answer.operationalContext,
          answerPriority: args.answer.priority,
          answerProblem: args.answer.problem,
          answerRecommendedAction: args.answer.recommendedAction,
          answerRuntime: args.answer.runtime,
          answerSummary: args.answer.summary,
          answerSuggestion: args.answer.suggestion,
          answerTitle: args.answer.title,
          createdAt,
          decisionMode: args.answer.runtime.decisionMode,
          feature: panelAssistantAiMetadata.feature,
          intent: args.answer.intent,
          model: args.answer.model,
          conversationId,
          memoryUsed: args.answer.runtime.memoryUsed ?? false,
          policyVersion: panelAssistantAiMetadata.policyVersion,
          promptProfile: panelAssistantAiMetadata.promptProfile,
          promptVersion: panelAssistantAiMetadata.promptVersion,
          provider: args.answer.runtime.provider,
          question: cleanText(args.question, 400),
          requestOrigin: cleanText(args.requestOrigin, 220) || null,
          skillId: args.answer.runtime.skillId,
          skillLabel: args.answer.runtime.skillLabel,
        },
        request_path: cleanText(args.requestPath, 220) || null,
        salon_id: args.salonId,
        severity: "info",
        target_id: args.answer.intent,
        target_type: PANEL_ASSISTANT_HISTORY_TARGET_TYPE,
        user_agent: cleanText(args.userAgent, 220) || null,
      })
      .select("id,created_at,event_type,metadata,target_type")
      .single();

    if (insertResult.error) {
      throw insertResult.error;
    }

    insertData = insertResult.data as PanelAssistantHistoryRow;
  }

  await persistPanelAssistantRuntimeTurn({
    admin,
    answer: args.answer,
    auditLogId:
      insertData &&
      typeof insertData === "object" &&
      "id" in insertData
        ? String(insertData.id)
        : null,
    conversationId,
    createdAt,
    question: args.question,
    requestOrigin: args.requestOrigin,
    salonId: args.salonId,
    supabase: runtimeSupabase,
    userId: args.userId,
  });

  return insertData ? mapHistoryRow(insertData) : null;
}

export async function answerPanelAssistantPrompt(
  args: PanelAssistantArgs,
): Promise<PanelAssistantAnswer> {
  const panelAssistantAiMetadata = getPanelAssistantAiMetadata();
  const conversationId = normalizeConversationId(args.conversationId);
  const question = cleanText(args.question, 400);
  const memory = await listPanelAssistantHistory({
    conversationId,
    limit: 4,
    salonId: args.salon.id,
    supabase: args.supabase,
  }).catch(() => []);
  const questionContext = resolveQuestionWithMemory(question, memory);
  const resolvedQuestion = questionContext.question;
  const intent = detectPanelAssistantIntent(resolvedQuestion, memory);
  const [operationalContext, longMemory] = await Promise.all([
    buildOperationalContext(args).catch(() => null),
    buildAiLongMemorySnapshot({
      salonId: args.salon.id,
      supabase: args.supabase,
    }).catch(() => null),
  ]);

  console.info("[ai/panel-assistant] routed", {
    conversation_id: conversationId,
    intent,
    memoryUsed: questionContext.usesMemory,
    policy_version: panelAssistantAiMetadata.policyVersion,
    prompt_profile: panelAssistantAiMetadata.promptProfile,
    prompt_version: panelAssistantAiMetadata.promptVersion,
    tenant_id: args.salon.id,
  });

  let draft: AssistantDraft;

  switch (intent) {
    case "movement_forecast":
      draft = await buildMovementForecastDraft({
        ...args,
        operationalContext,
        question: resolvedQuestion,
      });
      break;
    case "recovery_campaign":
      draft = await buildRecoveryCampaignDraft({ ...args, question: resolvedQuestion });
      break;
    case "customer_summary":
      draft = await buildCustomerSummaryDraft({ ...args, question: resolvedQuestion });
      break;
    case "finance_analysis":
      draft = await buildFinanceAnalysisDraft({ ...args, question: resolvedQuestion });
      break;
    case "promotion_strategy":
      draft = await buildPromotionStrategyDraft({ ...args, question: resolvedQuestion });
      break;
    case "panel_help":
      draft = buildPanelHelpDraft(resolvedQuestion);
      break;
    case "vacancy_strategy":
      draft = await buildVacancyStrategyDraft({ ...args, question: resolvedQuestion });
      break;
    case "schedule_availability":
    default:
      draft = await buildScheduleAvailabilityDraft({ ...args, question: resolvedQuestion });
      break;
  }

  draft = decorateAssistantDraft({
    draft,
    intent,
    operationalContext,
  });
  const tenantMemoryResult = applyTenantLongMemoryToDraft({
    draft,
    intent,
    longMemory,
  });
  draft = tenantMemoryResult.draft;
  const usedTenantMemory = tenantMemoryResult.used || Boolean(longMemory?.summary);
  const usedAnyMemory = questionContext.usesMemory || usedTenantMemory;

  if (!isOpenRouterEnabled()) {
    const answer = {
      ...draft,
      actions: draft.actions ?? [],
      impact: draft.impact ?? null,
      intent,
      missingData: draft.missingData ?? [],
      model: `${getOpenRouterModel()} (modo seguro)`,
      operationalContext: draft.operationalContext ?? operationalContext,
      priority: draft.priority ?? "low",
      problem: draft.problem ?? null,
      recommendedAction: draft.recommendedAction ?? null,
      runtime: buildAssistantRuntimeMetadata({
        decisionMode: "safe_fallback",
        intent,
        memoryUsed: usedAnyMemory,
        provider: "deterministic",
      }),
      suggestion: draft.suggestion ?? null,
    };

    console.info("[ai/panel-assistant] answered", {
      actions: answer.actions.map((item) => item.label),
      conversation_id: conversationId,
      intent,
      policy_version: panelAssistantAiMetadata.policyVersion,
      priority: answer.priority,
      prompt_profile: panelAssistantAiMetadata.promptProfile,
      prompt_version: panelAssistantAiMetadata.promptVersion,
      tenant_id: args.salon.id,
      skillId: answer.runtime.skillId,
    });

    return answer;
  }

  try {
    const polished = await polishAnswerWithAi({
      base: draft,
      intent,
      longMemory,
      memory,
      operationalContext,
      question: resolvedQuestion,
      requestOrigin: args.requestOrigin,
      salonName: args.salon.name,
    });

    const answer = {
      ...polished,
      actions: polished.actions ?? [],
      impact: polished.impact ?? null,
      intent,
      missingData: polished.missingData ?? [],
      operationalContext: polished.operationalContext ?? operationalContext,
      priority: polished.priority ?? "low",
      problem: polished.problem ?? null,
      recommendedAction: polished.recommendedAction ?? null,
      runtime: buildAssistantRuntimeMetadata({
        decisionMode: "guided_generation",
        intent,
        memoryUsed: usedAnyMemory,
        provider: "openrouter",
      }),
      suggestion: polished.suggestion ?? null,
    };

    console.info("[ai/panel-assistant] answered", {
      actions: answer.actions.map((item) => item.label),
      conversation_id: conversationId,
      intent,
      policy_version: panelAssistantAiMetadata.policyVersion,
      priority: answer.priority,
      prompt_profile: panelAssistantAiMetadata.promptProfile,
      prompt_version: panelAssistantAiMetadata.promptVersion,
      tenant_id: args.salon.id,
      skillId: answer.runtime.skillId,
    });

    return answer;
  } catch {
    const answer = {
      ...draft,
      actions: draft.actions ?? [],
      impact: draft.impact ?? null,
      intent,
      missingData: draft.missingData ?? [],
      model: `${getOpenRouterModel()} (fallback)`,
      operationalContext: draft.operationalContext ?? operationalContext,
      priority: draft.priority ?? "low",
      problem: draft.problem ?? null,
      recommendedAction: draft.recommendedAction ?? null,
      runtime: buildAssistantRuntimeMetadata({
        decisionMode: "safe_fallback",
        intent,
        memoryUsed: usedAnyMemory,
        provider: "openrouter",
      }),
      suggestion: draft.suggestion ?? null,
    };

    console.info("[ai/panel-assistant] answered", {
      actions: answer.actions.map((item) => item.label),
      conversation_id: conversationId,
      intent,
      policy_version: panelAssistantAiMetadata.policyVersion,
      priority: answer.priority,
      prompt_profile: panelAssistantAiMetadata.promptProfile,
      prompt_version: panelAssistantAiMetadata.promptVersion,
      tenant_id: args.salon.id,
      skillId: answer.runtime.skillId,
    });

    return answer;
  }
}
