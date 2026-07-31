import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import type { FeedComposerPostType } from "@/lib/feedComposerConfig";

export const FEED_DRAFT_PROMPT_PROFILE =
  AI_FEATURE_REGISTRY.feedDraft.promptProfile;
export const FEED_DRAFT_PROMPT_VERSION =
  AI_FEATURE_REGISTRY.feedDraft.promptVersion;

type BuildFeedDraftSystemPromptArgs = {
  postType: FeedComposerPostType;
};

type BuildFeedDraftUserPromptArgs = {
  captionHint?: string | null;
  notes?: string | null;
  postType: FeedComposerPostType;
  postTypeGuidance: string;
  salonName: string;
  serviceName: string;
  staffLabel: string;
  titleHint?: string | null;
};

export function buildFeedDraftSystemPrompt(
  args: BuildFeedDraftSystemPromptArgs,
) {
  return [
    "Voce e um redator premium de conteudo para saloes e barbearias do Brasil.",
    "Seu texto deve parecer comercial, humano, elegante e pronto para publicacao depois de revisao humana.",
    "Nunca responda como chatbot generico.",
    "Use somente o contexto fornecido.",
    "Nunca invente resultado, servico, profissional, beneficio ou promessa fora do contexto.",
    args.postType === "story"
      ? "Para story, seja curto, direto e com chamada imediata."
      : "Para feed, preserve clareza, desejo e valor comercial sem exagero.",
    "Responda apenas em JSON valido com as chaves title e caption.",
    "Title deve ter ate 60 caracteres. Caption deve ter ate 240 caracteres.",
    "Nada de markdown, hashtags desnecessarias, comentarios extras ou texto fora do JSON.",
  ].join("\n");
}

export function buildFeedDraftUserPrompt(args: BuildFeedDraftUserPromptArgs) {
  return [
    `Prompt profile: ${FEED_DRAFT_PROMPT_PROFILE}`,
    `Prompt version: ${FEED_DRAFT_PROMPT_VERSION}`,
    `Salao: ${args.salonName}`,
    `Formato: ${args.postType}`,
    `Servico: ${args.serviceName}`,
    `Profissional: ${args.staffLabel}`,
    `Objetivo: ${args.postTypeGuidance}`,
    args.titleHint ? `Titulo atual ou ideia: ${args.titleHint}` : null,
    args.captionHint ? `Legenda atual ou rascunho: ${args.captionHint}` : null,
    args.notes ? `Pedido extra do dono do salao: ${args.notes}` : null,
    "Escreva em pt-BR com tom premium, simples, comercial e natural.",
  ]
    .filter(Boolean)
    .join("\n");
}
