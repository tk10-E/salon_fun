"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getPanelAssistantAiMetadata } from "@/lib/ai/registry";
import {
  getPanelAssistantIntentLabel,
  getPanelAssistantSkill,
  getPanelAssistantSuggestedQuestions,
} from "@/lib/ai/skills/registry";
import { postInternalAiJson } from "@/lib/ai/clientRequest";
import type { AssistantRuntimeMetadata } from "@/lib/ai/skills/types";

import styles from "./PanelAiAssistant.module.css";

type PanelAiAssistantProps = {
  aiEnabled: boolean;
  copilot?: PanelAiCopilotView | null;
  description?: string;
  heading?: string;
  initialHistory?: PanelAiAssistantHistoryView[];
  showHistory?: boolean;
  showTechnicalDetails?: boolean;
  workspaceHref?: string | null;
};

export type PanelAiCopilotView = {
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

export type PanelAiAssistantHistoryView = {
  actions: Array<{
    href: string;
    kind: "primary" | "secondary";
    label: string;
  }>;
  answerBullets: string[];
  answerCtaHref: string | null;
  answerCtaLabel: string | null;
  answerFollowUp: string | null;
  answerImpact: string | null;
  answerMissingData?: string[];
  answerOperationalContext: {
    cancellationsLast7d: number;
    fitChanceLabel: string;
    monthRevenueLabel: string;
    operationalRiskLabel: string;
    pendingAppointmentsCount: number;
    summary: string;
    todayAppointmentsCount: number;
    tomorrowOccupancyLabel: string;
    tomorrowOccupancyPercent: number | null;
    tomorrowOpenSlotsCount: number;
  } | null;
  answerPriority: "high" | "medium" | "low";
  answerProblem: string | null;
  answerRecommendedAction: string | null;
  answerSummary: string;
  answerSuggestion: string | null;
  answerTitle: string;
  createdAt: string;
  createdAtLabel: string;
  id: string;
  intent: string;
  intentLabel: string;
  model: string;
  promptProfile?: string | null;
  promptVersion?: string | null;
  question: string;
  runtime?: AssistantRuntimeMetadata | null;
};

type PanelAiAssistantHistoryPayload = Omit<
  PanelAiAssistantHistoryView,
  "createdAtLabel" | "intentLabel"
>;

type AssistantResponse = {
  answer?: {
    actions: Array<{
      href: string;
      kind: "primary" | "secondary";
      label: string;
    }>;
    bullets: string[];
    ctaHref: string | null;
    ctaLabel: string | null;
    followUp: string | null;
    impact: string | null;
    intent: string;
    missingData?: string[];
    model: string;
    operationalContext: PanelAiAssistantHistoryView["answerOperationalContext"];
    priority: PanelAiAssistantHistoryView["answerPriority"];
    problem: string | null;
    recommendedAction: string | null;
    runtime?: AssistantRuntimeMetadata;
    suggestion: string | null;
    summary: string;
    title: string;
  };
  error?: string;
  historyItem?: PanelAiAssistantHistoryPayload | null;
  ok: boolean;
};

type ActionLink = {
  href: string;
  kind: "primary" | "secondary";
  label: string;
};

type AssistantActionPreset = {
  actionLabel: string;
  description: string;
  eyebrow: string;
  id: string;
  prompt: string;
  title: string;
};

type RenderableAnswer = {
  actions: ActionLink[];
  bullets: string[];
  ctaHref: string | null;
  ctaLabel: string | null;
  followUp: string | null;
  impact: string | null;
  intent: string;
  intentLabel: string;
  memoryLabel?: string | null;
  missingData: string[];
  model: string;
  operationalContext: PanelAiAssistantHistoryView["answerOperationalContext"];
  priority: PanelAiAssistantHistoryView["answerPriority"];
  problem: string | null;
  promptProfile?: string | null;
  promptVersion?: string | null;
  question?: string | null;
  recommendedAction: string | null;
  runtime?: AssistantRuntimeMetadata | null;
  sourceLabel?: string | null;
  suggestion: string | null;
  summary: string;
  title: string;
};

const SUGGESTED_QUESTIONS = getPanelAssistantSuggestedQuestions();
const ACTION_PRESETS: AssistantActionPreset[] = [
  {
    actionLabel: "Ver quem chamar",
    description:
      "Descobre quem faz mais sentido para preencher uma vaga aberta sem disparo generico.",
    eyebrow: "Agenda",
    id: "fill-open-slot",
    prompt: "Quem posso chamar para uma vaga aberta hoje?",
    title: "Preencher horarios vagos",
  },
  {
    actionLabel: "Ler agenda",
    description:
      "Mostra qual profissional esta mais livre para encaixe agora.",
    eyebrow: "Equipe",
    id: "free-professional",
    prompt: "Qual profissional tem mais horarios livres hoje?",
    title: "Ver quem esta mais livre",
  },
  {
    actionLabel: "Montar campanha",
    description:
      "Indica uma campanha curta para reagir antes de perder agenda.",
    eyebrow: "Venda",
    id: "build-campaign",
    prompt: "Qual campanha ajuda a preencher os horarios vagos de amanha?",
    title: "Criar campanha certa",
  },
  {
    actionLabel: "Ler caixa",
    description:
      "Aponta se a queda esta na agenda, no recebimento ou no mix de servicos.",
    eyebrow: "Caixa",
    id: "read-finance",
    prompt: "Meu faturamento caiu este mes?",
    title: "Entender o caixa",
  },
];
const PANEL_AI_CONVERSATION_STORAGE_KEY = "dashboard.panel-ai.conversation-id";
const PANEL_ASSISTANT_AI_METADATA = getPanelAssistantAiMetadata();

function createPanelAiConversationId() {
  if (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.randomUUID === "function"
  ) {
    return globalThis.crypto.randomUUID();
  }

  return `panel-ai-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function getOrCreatePanelAiConversationId() {
  if (typeof window === "undefined") {
    return "";
  }

  const conversationId = createPanelAiConversationId();

  try {
    const existing = window.sessionStorage.getItem(
      PANEL_AI_CONVERSATION_STORAGE_KEY,
    );

    if (existing) {
      return existing;
    }

    window.sessionStorage.setItem(
      PANEL_AI_CONVERSATION_STORAGE_KEY,
      conversationId,
    );
    return conversationId;
  } catch {
    return conversationId;
  }
}

function formatCountLabel(
  count: number,
  singular: string,
  plural = `${singular}s`,
) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function getFriendlyErrorMessage(error: string | undefined) {
  switch (error) {
    case "availability_lookup_failed":
      return "Não consegui analisar os encaixes da agenda agora. Tente novamente em instantes.";
    case "too_many_requests":
      return "Recebi muitas perguntas em sequência. Aguarde um instante e tente novamente.";
    case "request_timeout":
      return "A IA demorou além do esperado para responder. Tente novamente em instantes.";
    case "unauthenticated":
      return "Sua sessão expirou. Entre novamente para usar o assistente.";
    case "invalid_request":
      return "Escreva uma pergunta um pouco mais completa para eu responder.";
    default:
      return "Não consegui responder agora. Tente novamente em instantes.";
  }
}

function formatHistoryMoment(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function resolvePanelAssistantIntentLabel(intent: string) {
  return getPanelAssistantIntentLabel(
    (intent || "schedule_availability") as Parameters<
      typeof getPanelAssistantIntentLabel
    >[0],
  );
}

function getResponseSourceLabel(runtime?: AssistantRuntimeMetadata | null) {
  if (!runtime) {
    return null;
  }

  return runtime.decisionMode === "safe_fallback"
    ? "Modo seguro"
    : `Leitura por ${runtime.skillLabel}`;
}

function getRuntimeDecisionLabel(runtime?: AssistantRuntimeMetadata | null) {
  if (!runtime) {
    return null;
  }

  return runtime.decisionMode === "safe_fallback"
    ? "Fallback seguro"
    : "IA guiada";
}

function getRuntimeProviderLabel(runtime?: AssistantRuntimeMetadata | null) {
  if (!runtime) {
    return null;
  }

  return runtime.provider === "openrouter" ? "OpenRouter" : "Deterministico";
}

function getTechnicalDetails(answer: RenderableAnswer) {
  return [
    { label: "Modelo", value: answer.model || null },
    { label: "Skill", value: answer.runtime?.skillLabel ?? answer.intentLabel },
    { label: "Leitura", value: getRuntimeDecisionLabel(answer.runtime) },
    { label: "Provider", value: getRuntimeProviderLabel(answer.runtime) },
    { label: "Prompt profile", value: answer.promptProfile ?? null },
    { label: "Prompt version", value: answer.promptVersion ?? null },
    { label: "Policy version", value: answer.runtime?.policyVersion ?? null },
  ].filter((item): item is { label: string; value: string } => Boolean(item.value));
}

function getDecisionSections(answer: RenderableAnswer) {
  const intent = (
    answer.runtime?.skillId ??
    answer.intent ??
    "schedule_availability"
  ) as Parameters<typeof getPanelAssistantSkill>[0];
  const skill = getPanelAssistantSkill(intent);

  return skill.decisionSections
    .map((section) => ({
      content:
        section.field === "problem"
          ? answer.problem
          : section.field === "impact"
            ? answer.impact
            : section.field === "suggestion"
              ? answer.suggestion
              : answer.recommendedAction,
      label: section.label,
      tone: section.tone,
    }))
    .filter((section) => section.content);
}

function normalizeHistoryView(
  item: PanelAiAssistantHistoryPayload,
): PanelAiAssistantHistoryView {
  return {
    ...item,
    answerMissingData: item.answerMissingData ?? [],
    createdAtLabel: formatHistoryMoment(item.createdAt),
    intentLabel: resolvePanelAssistantIntentLabel(item.intent),
  };
}

function getPriorityBadgeClass(priority: "high" | "medium" | "low") {
  return priority === "high"
    ? "badge badge--pending"
    : priority === "medium"
      ? "badge badge--soft"
      : "badge badge--confirmed";
}

function getPriorityLabel(priority: "high" | "medium" | "low") {
  return priority === "high"
    ? "Prioridade alta"
    : priority === "medium"
      ? "Prioridade média"
      : "Prioridade baixa";
}

function getInsightToneLabel(
  tone: PanelAiCopilotView["insights"][number]["tone"],
) {
  return tone === "alert"
    ? "Alerta"
    : tone === "drop"
      ? "Baixo movimento"
      : "Oportunidade";
}

function getInsightToneClass(
  tone: PanelAiCopilotView["insights"][number]["tone"],
) {
  return tone === "alert"
    ? styles.insightAlert
    : tone === "drop"
      ? styles.insightDrop
      : styles.insightOpportunity;
}

function isShortFollowUpQuestion(value: string) {
  const normalized = value.trim().toLowerCase();
  return (
    normalized === "e amanhã?" ||
    normalized === "e amanhã" ||
    normalized === "e hoje?" ||
    normalized === "e hoje" ||
    normalized.startsWith("e ")
  );
}

function ActionIcon({ label }: { label: string }) {
  const normalized = label.toLowerCase();

  if (normalized.includes("campanha") || normalized.includes("promoc")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M5 10h3l8-4v12l-8-4H5z"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinejoin="round"
        />
        <path
          d="M8 14v3a1.5 1.5 0 0 0 3 0v-2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (normalized.includes("cliente")) {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <circle
          cx="12"
          cy="8.2"
          r="3.2"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="M6.5 18.2a5.5 5.5 0 0 1 11 0"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <rect
        x="4"
        y="5"
        width="16"
        height="14"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M8 15l3-3 2.5 2.5L18 10"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ResponseDecisionCard({
  content,
  label,
  tone,
}: {
  content: string | null;
  label: string;
  tone: "action" | "impact" | "problem" | "suggestion";
}) {
  if (!content) {
    return null;
  }

  return (
    <article className={`${styles.decisionCard} ${styles[`decisionCard${tone[0]!.toUpperCase()}${tone.slice(1)}`]}`}>
      <span className={styles.decisionLabel}>{label}</span>
      <p>{content}</p>
    </article>
  );
}

function ResponseActions({
  actions,
  ctaHref,
  ctaLabel,
}: {
  actions: ActionLink[];
  ctaHref: string | null;
  ctaLabel: string | null;
}) {
  const links = actions.length
    ? actions
    : ctaHref && ctaLabel
      ? [{ href: ctaHref, kind: "secondary" as const, label: ctaLabel }]
      : [];

  if (!links.length) {
    return null;
  }

  return (
    <div className={styles.responseActions}>
      {links.map((action) => (
        <a
          key={`${action.kind}-${action.href}-${action.label}`}
          href={action.href}
          className={
            action.kind === "primary" ? "primary-button" : "secondary-button"
          }
        >
          <span className={styles.actionIcon}>
            <ActionIcon label={action.label} />
          </span>
          <span>{action.label}</span>
        </a>
      ))}
    </div>
  );
}

function ResponseBullets({ bullets }: { bullets: string[] }) {
  if (!bullets.length) {
    return null;
  }

  if (bullets.length === 1) {
    return <p className={styles.responseBulletLead}>{bullets[0]}</p>;
  }

  return (
    <ul className={styles.responseBullets}>
      {bullets.map((bullet) => (
        <li key={bullet}>{bullet}</li>
      ))}
    </ul>
  );
}

function MissingDataBlock({ items }: { items: string[] }) {
  if (!items.length) {
    return null;
  }

  return (
    <div className={styles.missingDataBlock}>
      <span className={styles.missingDataLabel}>Dados ausentes</span>
      <div className={styles.missingDataList}>
        {items.map((item) => (
          <span key={item} className="badge badge--soft">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function ResponseCard({
  answer,
  fallbackCopilot,
  showTechnicalDetails = false,
}: {
  answer: RenderableAnswer;
  fallbackCopilot?: PanelAiCopilotView | null;
  showTechnicalDetails?: boolean;
}) {
  const context = answer.operationalContext;
  const decisionSections = getDecisionSections(answer);
  const occupancyLabel =
    context?.tomorrowOccupancyLabel ??
    fallbackCopilot?.occupancyTomorrowLabel ??
    "-";
  const riskLabel =
    context?.operationalRiskLabel ??
    fallbackCopilot?.operationalRiskLabel ??
    "-";
  const fillLabel =
    context?.fitChanceLabel ?? fallbackCopilot?.fillChanceLabel ?? "-";
  const technicalDetails = getTechnicalDetails(answer);

  return (
    <article className={styles.responseCard}>
      <div className={styles.responseHeader}>
        <div className={styles.responseHeaderMain}>
          <span className="badge badge--accent">{answer.intentLabel}</span>
          <span className={getPriorityBadgeClass(answer.priority)}>
            {getPriorityLabel(answer.priority)}
          </span>
          {answer.sourceLabel ? (
            <span className="badge badge--soft">{answer.sourceLabel}</span>
          ) : null}
          {answer.memoryLabel ? (
            <span className="badge badge--completed">{answer.memoryLabel}</span>
          ) : null}
        </div>
        <span className={styles.responseModel}>Leitura guiada</span>
      </div>

      {answer.question ? (
        <p className={styles.responseQuestion}>{answer.question}</p>
      ) : null}

      <h3>{answer.title}</h3>
      <p className={styles.responseSummary}>{answer.summary}</p>

      <div className={styles.scoreGrid}>
        <article className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Ocupação amanhã</span>
          <strong>{occupancyLabel}</strong>
        </article>
        <article className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Risco operacional</span>
          <strong>{riskLabel}</strong>
        </article>
        <article className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Chance de encaixe</span>
          <strong>{fillLabel}</strong>
        </article>
      </div>

      {context ? (
        <div className={styles.contextSummary}>
          <p>{context.summary}</p>
          <div className={styles.contextMeta}>
            <span>
              {formatCountLabel(
                context.todayAppointmentsCount,
                "atendimento hoje",
                "atendimentos hoje",
              )}
            </span>
            <span>
              {formatCountLabel(
                context.pendingAppointmentsCount,
                "pendência",
                "pendências",
              )}
            </span>
            <span>
              {formatCountLabel(
                context.tomorrowOpenSlotsCount,
                "horário livre amanhã",
                "horários livres amanhã",
              )}
            </span>
            <span>
              {formatCountLabel(
                context.cancellationsLast7d,
                "cancelamento em 7 dias",
                "cancelamentos em 7 dias",
              )}
            </span>
          </div>
        </div>
      ) : null}

      <MissingDataBlock items={answer.missingData} />

      {decisionSections.length ? (
        <div className={styles.decisionGrid}>
          {decisionSections.map((section) => (
            <ResponseDecisionCard
              key={`${section.tone}-${section.label}`}
              label={section.label}
              content={section.content}
              tone={section.tone}
            />
          ))}
        </div>
      ) : null}

      <ResponseBullets bullets={answer.bullets} />

      {answer.followUp ? (
        <p className={styles.followUp}>{answer.followUp}</p>
      ) : null}

      {showTechnicalDetails && technicalDetails.length ? (
        <details className={styles.debugDetails}>
          <summary className={styles.debugSummary}>
            <span>Leitura tecnica da IA</span>
            <span className={styles.debugSummaryHint}>
              modelo, prompt e policy
            </span>
          </summary>
          <div className={styles.debugGrid}>
            {technicalDetails.map((item) => (
              <article
                key={`${item.label}-${item.value}`}
                className={styles.debugCard}
              >
                <span className={styles.debugLabel}>{item.label}</span>
                <strong className={styles.debugValue}>{item.value}</strong>
              </article>
            ))}
          </div>
        </details>
      ) : null}

      <ResponseActions
        actions={answer.actions}
        ctaHref={answer.ctaHref}
        ctaLabel={answer.ctaLabel}
      />
    </article>
  );
}

export function PanelAiAssistant({
  aiEnabled,
  copilot,
  description,
  heading,
  initialHistory = [],
  showHistory = false,
  showTechnicalDetails = false,
  workspaceHref = "/dashboard/ai",
}: PanelAiAssistantProps) {
  const [question, setQuestion] = useState<string>(SUGGESTED_QUESTIONS[0] ?? "");
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<AssistantResponse["answer"] | null>(
    null,
  );
  const [conversationId, setConversationId] = useState("");
  const [history, setHistory] = useState<PanelAiAssistantHistoryView[]>(
    initialHistory,
  );
  const [status, setStatus] = useState<{
    message: string;
    tone: "error" | "success";
  } | null>(null);

  const isFollowUp = useMemo(
    () => isShortFollowUpQuestion(question),
    [question],
  );

  useEffect(() => {
    setConversationId(getOrCreatePanelAiConversationId());
  }, []);

  async function askAssistant(nextQuestion?: string) {
    const prompt = (nextQuestion ?? question).trim();

    if (!prompt) {
      setStatus({
        message: "Escreva o problema para eu analisar os dados do salao.",
        tone: "error",
      });
      return;
    }

    setQuestion(prompt);
    setIsLoading(true);
    setStatus(null);

    try {
      const activeConversationId =
        conversationId || getOrCreatePanelAiConversationId();

      if (activeConversationId !== conversationId) {
        setConversationId(activeConversationId);
      }

      const { payload, response } =
        await postInternalAiJson<AssistantResponse>(
          "/api/internal/ai/panel-assistant",
          {
            conversationId: activeConversationId,
            question: prompt,
          },
          15_000,
        );

      if (!response.ok || !payload?.ok || !payload.answer) {
        setResponse(null);
        setStatus({
          message: getFriendlyErrorMessage(payload?.error),
          tone: "error",
        });
        return;
      }

      setResponse(payload.answer);
      if (payload.historyItem) {
        const historyItem = normalizeHistoryView(payload.historyItem);
        setHistory((currentValue) =>
          [historyItem, ...currentValue.filter((item) => item.id !== historyItem.id)].slice(
            0,
            20,
          ),
        );
      }
      setStatus({
        message: "Leitura pronta.",
        tone: "success",
      });
    } catch (error) {
      setResponse(null);
      setStatus({
        message: getFriendlyErrorMessage(
          error instanceof Error ? error.message : undefined,
        ),
        tone: "error",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const renderableResponse: RenderableAnswer | null = response
    ? {
        actions: response.actions,
        bullets: response.bullets,
        ctaHref: response.ctaHref,
        ctaLabel: response.ctaLabel,
        followUp: response.followUp,
        impact: response.impact,
        intent: response.intent,
        intentLabel: resolvePanelAssistantIntentLabel(response.intent),
        missingData: response.missingData ?? [],
        /* memoryLabel:
          isFollowUp && copilot?.lastAnalysisLabel
            ? "Com base na análise anterior"
            : null, */
        memoryLabel: response.runtime?.memoryUsed
          ? "Continuando a leitura anterior"
          : isFollowUp && copilot?.lastAnalysisLabel
            ? "Com base na analise anterior"
            : null,
        model: response.model,
        operationalContext: response.operationalContext,
        priority: response.priority,
        problem: response.problem,
        promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
        promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
        question,
        recommendedAction: response.recommendedAction,
        runtime: response.runtime,
        sourceLabel: getResponseSourceLabel(response.runtime),
        suggestion: response.suggestion,
        summary: response.summary,
        title: response.title,
      }
    : null;
  const feedbackMessage = isLoading
    ? "Lendo os dados reais do salao..."
    : status?.message ?? null;
  const feedbackTone = isLoading ? "loading" : status?.tone ?? null;

  return (
    <section
      className={`card content-card dashboard-panel ${styles.panel}`}
      aria-labelledby="dashboard-ai-assistant"
    >
      <div className={styles.hero}>
        <div className={styles.avatar}>IA</div>
        <div className={styles.heroCopy}>
          <div className={styles.heroTopline}>
            <h2 id="dashboard-ai-assistant">
              {heading ?? "IA para agir no salao"}
            </h2>
            <span className={aiEnabled ? "badge badge--confirmed" : "badge badge--soft"}>
              {aiEnabled ? "IA ativa com dados reais" : "Assistente indisponivel"}
            </span>
          </div>
          <p className="muted">
            {description ??
              "Descubra quem chamar, onde vender e o que corrigir agora com base nos dados reais desta conta."}
          </p>
          <div className={styles.statusRow}>
            <div className={styles.statusCard}>
              <strong>{copilot?.statusLabel ?? "IA olhando agenda e retorno"}</strong>
              <span>{copilot?.monitoringLabel ?? "Agenda, clientes e queda de movimento"}</span>
            </div>
            <div className={styles.statusCard}>
              <strong>{copilot?.lastAnalysisLabel ?? "Sem leitura salva ainda"}</strong>
              <span>
                {copilot?.latestAnalysisQuestion ??
                  "A ultima resposta fica salva para a equipe continuar sem comecar do zero."}
              </span>
            </div>
            {workspaceHref ? (
              <Link href={workspaceHref} className="secondary-button">
                Abrir tela completa
              </Link>
            ) : null}
          </div>
        </div>
      </div>

      <div className={styles.scoreGrid}>
        <article className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Ocupação amanhã</span>
          <strong>{copilot?.occupancyTomorrowLabel ?? "-"}</strong>
        </article>
        <article className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Risco operacional</span>
          <strong>{copilot?.operationalRiskLabel ?? "-"}</strong>
        </article>
        <article className={styles.scoreCard}>
          <span className={styles.scoreLabel}>Chance de encaixe</span>
          <strong>{copilot?.fillChanceLabel ?? "-"}</strong>
        </article>
      </div>

      {copilot?.statusSummary ? (
        <p className={styles.executiveSummary}>{copilot.statusSummary}</p>
      ) : null}

      {copilot?.insights.length ? (
        <section className={styles.insightsSection} aria-label="O que vale olhar agora">
          <div className={styles.sectionHeader}>
            <div>
              <h3>O que vale olhar agora</h3>
              <p className="muted">A IA olha agenda, ocupacao e retorno antes da sua pergunta.</p>
            </div>
            {copilot.opportunityPrompt ? (
              <button
                type="button"
                className="primary-button"
                onClick={() => void askAssistant(copilot.opportunityPrompt ?? undefined)}
                disabled={isLoading}
              >
                {isLoading ? "Lendo..." : "Ver melhor acao"}
              </button>
            ) : null}
          </div>
          <div className={styles.insightsGrid}>
            {copilot.insights.map((insight) => (
              <article
                key={insight.id}
                className={`${styles.insightCard} ${getInsightToneClass(insight.tone)}`}
              >
                <div className={styles.insightHeader}>
                  <span className="badge badge--soft">
                    {getInsightToneLabel(insight.tone)}
                  </span>
                  {insight.actionHref && insight.actionLabel ? (
                    <a href={insight.actionHref} className="secondary-button">
                      <span className={styles.actionIcon}>
                        <ActionIcon label={insight.actionLabel} />
                      </span>
                      <span>{insight.actionLabel}</span>
                    </a>
                  ) : null}
                </div>
                <h4>{insight.title}</h4>
                <p>{insight.summary}</p>
                {insight.prompt ? (
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => void askAssistant(insight.prompt ?? undefined)}
                    disabled={isLoading}
                  >
                    {isLoading ? "Lendo..." : "Usar agora"}
                  </button>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      ) : null}

      <section className={styles.actionPresetSection} aria-label="Acoes prontas">
        <div className={styles.sectionHeader}>
          <div>
            <h3>Acoes prontas</h3>
            <p className="muted">Clique e a IA ja faz a leitura certa para a rotina do salao.</p>
          </div>
        </div>
        <div className={styles.actionPresetGrid}>
          {ACTION_PRESETS.map((preset) => (
            <article key={preset.id} className={styles.actionPresetCard}>
              <span className={styles.actionPresetEyebrow}>{preset.eyebrow}</span>
              <h4>{preset.title}</h4>
              <p>{preset.description}</p>
              <button
                type="button"
                className="primary-button"
                onClick={() => void askAssistant(preset.prompt)}
                disabled={isLoading}
              >
                {isLoading ? "Lendo..." : preset.actionLabel}
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.quickPromptSection} aria-label="Perguntas prontas">
        <div className={styles.sectionHeader}>
          <div>
            <h3>Perguntas prontas</h3>
            <p className="muted">Atalhos para agenda, clientes, campanha e caixa.</p>
          </div>
        </div>
        <div className={styles.quickPrompts}>
          {SUGGESTED_QUESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="secondary-button"
              onClick={() => void askAssistant(suggestion)}
              disabled={isLoading}
            >
              {suggestion}
            </button>
          ))}
        </div>
      </section>

      <label className="field">
        <span>O que voce quer resolver agora?</span>
        <textarea
          rows={3}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ex.: Qual profissional tem mais horários livres hoje?"
        />
        <small className="muted">
          Fale direto. Ex.: quem posso chamar para vaga aberta?, meu faturamento caiu?, qual profissional esta mais livre hoje?
        </small>
      </label>

      <div className={styles.commandBar}>
        <button
          type="button"
          className="primary-button"
          onClick={() => void askAssistant()}
          disabled={isLoading}
        >
          {isLoading ? "Lendo..." : "Analisar agora"}
        </button>
        {isFollowUp && copilot?.latestAnalysisQuestion ? (
          <span className="badge badge--completed">
            Com base em: {copilot.latestAnalysisQuestion}
          </span>
        ) : null}
      </div>

      {feedbackMessage ? (
        <article
          role="status"
          className={`${styles.feedbackCard} ${
            feedbackTone === "error"
              ? styles.feedbackError
              : feedbackTone === "loading"
                ? styles.feedbackLoading
                : styles.feedbackSuccess
          }`}
        >
          <p>{feedbackMessage}</p>
        </article>
      ) : null}

      {!aiEnabled ? (
        <p className="muted" style={{ margin: 0 }}>
          As respostas automáticas não estão disponíveis nesta conta agora.
          Mesmo assim, o painel continua mostrando o resumo principal.
        </p>
      ) : null}

      {renderableResponse ? (
        <ResponseCard
          answer={renderableResponse}
          fallbackCopilot={copilot}
          showTechnicalDetails={showTechnicalDetails}
        />
      ) : null}

      {!renderableResponse && !isLoading && !status ? (
        <article className={styles.historyEmpty}>
          <p>
            A IA responde melhor quando voce fala o problema direto: agenda
            vazia, cliente para chamar, campanha da semana ou caixa.
          </p>
        </article>
      ) : null}

      {showHistory ? (
        <section className={styles.historySection} aria-label="Histórico recente do assistente">
          <div className={styles.sectionHeader}>
            <div>
              <h3>Histórico recente</h3>
              <p className="muted">Últimas perguntas respondidas para este salão.</p>
            </div>
          </div>

          {!history.length ? (
            <article className={styles.historyEmpty}>
              <p>
                Ainda sem historico. Quando voce perguntar, a resposta aparece
                aqui para consulta rapida da equipe.
              </p>
            </article>
          ) : (
            <div className={styles.historyList}>
              {history.map((item) => (
                <ResponseCard
                  key={item.id}
                  fallbackCopilot={copilot}
                  showTechnicalDetails={showTechnicalDetails}
                  answer={{
                    actions: item.actions,
                    bullets: item.answerBullets,
                    ctaHref: item.answerCtaHref,
                    ctaLabel: item.answerCtaLabel,
                    followUp: item.answerFollowUp,
                    impact: item.answerImpact,
                    intent: item.intent,
                    intentLabel: item.intentLabel,
                    memoryLabel: item.createdAtLabel,
                    missingData: item.answerMissingData ?? [],
                    model: item.model,
                    operationalContext: item.answerOperationalContext,
                    priority: item.answerPriority,
                    problem: item.answerProblem,
                    promptProfile: item.promptProfile ?? null,
                    promptVersion: item.promptVersion ?? null,
                    question: item.question,
                    recommendedAction: item.answerRecommendedAction,
                    runtime: item.runtime,
                    sourceLabel: "Histórico salvo",
                    suggestion: item.answerSuggestion,
                    summary: item.answerSummary,
                    title: item.answerTitle,
                  }}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </section>
  );
}
