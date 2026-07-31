import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

export const PROMOTION_DRAFT_PROMPT_PROFILE =
  AI_FEATURE_REGISTRY.promotionDraft.promptProfile;
export const PROMOTION_DRAFT_PROMPT_VERSION =
  AI_FEATURE_REGISTRY.promotionDraft.promptVersion;

type BuildPromotionDraftSystemPromptArgs = {
  kind: "membership" | "promotion";
};

type BuildPromotionDraftUserPromptArgs = {
  descriptionHint?: string | null;
  goal?: string | null;
  highlightHint?: string | null;
  kind: "membership" | "promotion";
  notes?: string | null;
  priceHint?: number | null;
  preferredServiceId?: string | null;
  salonName: string;
  serviceName: string;
  serviceOptions?: string[];
  todayLabel: string;
  titleHint?: string | null;
};

export function buildPromotionDraftSystemPrompt(
  args: BuildPromotionDraftSystemPromptArgs,
) {
  return [
    "Voce e um copiloto comercial premium para saloes e barbearias do Brasil.",
    "Seu papel e criar ofertas que parecam valiosas, simples de vender e seguras para publicar depois de revisao humana.",
    "Nunca responda como chatbot generico.",
    "Use somente o contexto fornecido.",
    "Nunca invente servicos, beneficios, datas, sesses, validade ou vinculo de serviceId sem base no contexto.",
    "Voce nao publica nem ativa nada sozinho. Voce apenas sugere um rascunho premium para confirmacao humana.",
    args.kind === "membership"
      ? "Para plano ou pacote, sugira uma estrutura organizada, previsivel e facil de vender."
      : "Para promocao comum, priorize urgencia elegante, percepcao de valor e incentivo a agendamento rapido.",
    "Responda apenas em JSON valido com as chaves title, highlightText, description, priceSuggestion, sessionsIncluded, validityDays, startsOn, endsOn e serviceId.",
    "title ate 60 caracteres. highlightText ate 90. description ate 260.",
    "startsOn e endsOn em yyyy-MM-dd.",
    "Nada de markdown, nada de comentarios extras e nada de texto fora do JSON.",
  ].join("\n");
}

export function buildPromotionDraftUserPrompt(
  args: BuildPromotionDraftUserPromptArgs,
) {
  return [
    `Prompt profile: ${PROMOTION_DRAFT_PROMPT_PROFILE}`,
    `Prompt version: ${PROMOTION_DRAFT_PROMPT_VERSION}`,
    `Salao: ${args.salonName}`,
    `Tipo de oferta: ${args.kind}`,
    `Data de referencia do salao: ${args.todayLabel}`,
    `Servico principal: ${args.serviceName}`,
    args.serviceOptions?.length
      ? `Servicos disponiveis para vinculo: ${args.serviceOptions.join(" | ")}`
      : null,
    args.preferredServiceId
      ? `Se fizer sentido manter o servico ja escolhido, use o id ${args.preferredServiceId}.`
      : null,
    args.goal ? `Objetivo comercial: ${args.goal}` : null,
    args.priceHint != null ? `Preco de referencia: ${args.priceHint}` : null,
    args.titleHint ? `Titulo atual: ${args.titleHint}` : null,
    args.highlightHint ? `Chamada atual: ${args.highlightHint}` : null,
    args.descriptionHint ? `Descricao atual: ${args.descriptionHint}` : null,
    args.notes ? `Pedido extra do salao: ${args.notes}` : null,
    args.kind === "membership"
      ? "A oferta precisa soar organizada, valiosa e simples de vender no painel e no app."
      : "A oferta precisa soar objetiva, convidativa e pronta para agendamento rapido.",
  ]
    .filter(Boolean)
    .join("\n");
}
