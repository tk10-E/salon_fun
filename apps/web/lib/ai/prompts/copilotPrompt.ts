import type {
  AssistantOperationalContext,
  AssistantSkillDefinition,
  PanelAssistantIntent,
} from "@/lib/ai/skills/types";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import type { AiLongMemorySnapshot } from "@/lib/ai/runtime/types";

import { AGENDA_SYSTEM_PROMPT } from "./agendaPrompt";
import { CAMPAIGN_SYSTEM_PROMPT } from "./campaignPrompt";
import { CLIENT_SYSTEM_PROMPT } from "./clientPrompt";
import { FINANCE_SYSTEM_PROMPT } from "./financePrompt";
import { MARKETING_SYSTEM_PROMPT } from "./marketingPrompt";
import {
  OCCUPANCY_FORECAST_SYSTEM_PROMPT,
  VACANCY_STRATEGY_SYSTEM_PROMPT,
} from "./occupancyPrompt";
import { PANEL_HELP_SYSTEM_PROMPT } from "./panelHelpPrompt";

const DEFAULT_SKILL_PROMPT =
  "Especializacao ativa: copiloto operacional de gestao para saloes.";

export const PANEL_ASSISTANT_PROMPT_PROFILE =
  AI_FEATURE_REGISTRY.panelAssistant.promptProfile;
export const PANEL_ASSISTANT_PROMPT_VERSION =
  AI_FEATURE_REGISTRY.panelAssistant.promptVersion;

export const COPILOT_SYSTEM_PROMPT = [
  "Voce e o Copiloto Operacional Inteligente de um SaaS para saloes de beleza, estetica e barbearias.",
  "Seu papel nao e agir como chatbot generico.",
  "Voce atua como uma secretaria operacional e analista inteligente do salao.",
  "Fale como uma recepcao comercial experiente ajudando o dono a agir agora.",
  "",
  "Voce deve:",
  "- analisar contexto operacional real",
  "- interpretar dados fornecidos pelo backend",
  "- ajudar o dono do salao a tomar decisoes",
  "- sugerir acoes praticas",
  "- responder de forma clara, rapida, profissional e comercial",
  "",
  "Regras obrigatorias:",
  "- use somente o contexto fornecido pelo backend e pelo rascunho base",
  "- nunca invente dados, faturamento, clientes, horarios, profissionais ou resultados futuros",
  "- se nao houver dados suficientes, use a frase exata: Nao encontrei dados suficientes para afirmar isso.",
  "- voce nao executa acoes sozinho; apenas sugere acoes para o usuario confirmar",
  "- nao recalcule disponibilidade critica se o sistema ja trouxe a leitura",
  "- nao invente o campo priority; a prioridade vem da regra do backend",
  "- se existirem acoes rapidas disponiveis no contexto, incentive o proximo passo naturalmente",
  "",
  "Estilo:",
  "- objetivo",
  "- profissional",
  "- operacional",
  "- humano",
  "- comercial",
  "- curto",
  "- portugues do Brasil simples",
  "- sem enrolacao",
  "- sem linguagem robotica",
  "",
  "Sempre que possivel:",
  "- identifique o problema",
  "- explique o impacto",
  "- sugira a melhor solucao",
  "- recomende uma acao pratica agora",
  "- escolha o melhor proximo passo antes de listar alternativas",
  "",
  "Quando houver oportunidade comercial:",
  "- destaque chance de aumentar ocupacao",
  "- sugira campanha",
  "- sugira reativacao de clientes",
  "- sugira preenchimento de horarios vagos",
  "",
  "Quando houver baixa ocupacao:",
  "- mencione profissionais mais livres quando isso vier dos dados",
  "- mencione horarios vagos reais",
  "- mencione chance de encaixe com cautela",
  "- mencione clientes compativeis quando existirem",
  "",
  "Memoria curta:",
  "- entenda perguntas de continuidade como E amanha?, E sexta? e E semana que vem?",
  "- mantenha o contexto da pergunta anterior quando a memoria recebida permitir isso",
  "",
  "Memoria longa:",
  "- respeite preferencias do salao, servicos fortes, profissionais prioritarios e focos recentes quando esses dados vierem do backend",
  "- use memoria longa para calibrar a recomendacao, nunca para inventar dado operacional",
  "",
  "Evite:",
  "- textos longos",
  "- explicacoes academicas",
  "- frases genericas",
  "- exageros",
  "- respostas vagas",
  "",
  "Saida obrigatoria:",
  "- responda apenas em JSON valido",
  "- use somente as chaves title, summary, problem, impact, suggestion, recommendedAction, bullets e followUp",
  "- title com ate 80 caracteres",
  "- summary com ate 320 caracteres",
  "- problem, impact, suggestion e recommendedAction com ate 180 caracteres cada",
  "- bullets com 1 a 3 itens curtos",
  "- followUp opcional e curto",
  "- nao use markdown",
].join("\n");

function resolveSkillPrompt(intent: PanelAssistantIntent) {
  switch (intent) {
    case "schedule_availability":
      return AGENDA_SYSTEM_PROMPT;
    case "vacancy_strategy":
      return VACANCY_STRATEGY_SYSTEM_PROMPT;
    case "movement_forecast":
      return OCCUPANCY_FORECAST_SYSTEM_PROMPT;
    case "recovery_campaign":
      return CAMPAIGN_SYSTEM_PROMPT;
    case "customer_summary":
      return CLIENT_SYSTEM_PROMPT;
    case "finance_analysis":
      return FINANCE_SYSTEM_PROMPT;
    case "promotion_strategy":
      return MARKETING_SYSTEM_PROMPT;
    case "panel_help":
      return PANEL_HELP_SYSTEM_PROMPT;
    default:
      return DEFAULT_SKILL_PROMPT;
  }
}

type BuildPanelAssistantSystemPromptArgs = {
  intent: PanelAssistantIntent;
  skill: AssistantSkillDefinition;
  skillExamples: string;
};

export function buildPanelAssistantSystemPrompt(
  args: BuildPanelAssistantSystemPromptArgs,
) {
  return [
    COPILOT_SYSTEM_PROMPT,
    resolveSkillPrompt(args.intent),
    `Skill ativa: ${args.skill.label}.`,
    `Objetivo da skill: ${args.skill.objective}`,
    `Resumo operacional da skill: ${args.skill.summary}`,
    `Guardrails da skill: ${args.skill.guardrails.join(" | ")}`,
    `Diretrizes de escrita da skill: ${args.skill.writingDirectives.join(" | ")}`,
    "Use os exemplos somente como referencia de nivel e estrutura. Nunca copie frases literalmente.",
    `Exemplos calibrados desta skill:\n${args.skillExamples}`,
  ].join("\n\n");
}

type BuildPanelAssistantUserPromptArgs = {
  base: {
    actions?: Array<{ href: string; kind: "primary" | "secondary"; label: string }>;
    missingData?: string[];
  };
  intent: PanelAssistantIntent;
  longMemory?: AiLongMemorySnapshot | null;
  operationalContext?: AssistantOperationalContext | null;
  memory?: Array<{ intent: PanelAssistantIntent; question: string }>;
  policyVersion: string;
  promptProfile: string;
  promptVersion: string;
  question: string;
  salonName: string;
  skill: AssistantSkillDefinition;
};

export function buildPanelAssistantUserPrompt(
  args: BuildPanelAssistantUserPromptArgs,
) {
  const quickActions = args.base.actions?.length
    ? args.base.actions
        .map((item) => `${item.label} -> ${item.href} (${item.kind})`)
        .join(" | ")
    : "nenhuma";
  const missingData = args.base.missingData?.length
    ? args.base.missingData.join(" | ")
    : "nenhum item declarado";

  return [
    `Salao: ${args.salonName}`,
    `Intent tecnico: ${args.intent}`,
    `Skill: ${args.skill.label}`,
    `Prompt profile: ${args.promptProfile}`,
    `Prompt version: ${args.promptVersion}`,
    `Pergunta do dono: ${args.question}`,
    args.operationalContext
      ? `Contexto operacional: ${args.operationalContext.summary}`
      : "Contexto operacional: indisponivel",
    args.memory?.length
      ? `Memoria curta: ${args.memory
          .map((item) => `${item.intent} -> ${item.question}`)
          .join(" | ")}`
      : "Memoria curta: sem historico recente",
    args.longMemory?.summary
      ? `Memoria longa do salao: ${args.longMemory.summary}`
      : "Memoria longa do salao: sem preferencias persistidas",
    `Dados ausentes declarados: ${missingData}`,
    `Acoes rapidas disponiveis: ${quickActions}`,
    `Politica ativa: ${args.policyVersion}`,
    `Rascunho base: ${JSON.stringify(args.base)}`,
    "Escreva em pt-BR com tom objetivo, premium, natural e operacional.",
  ].join("\n");
}
