import {
  createOpenRouterChatCompletion,
  getOpenRouterModel,
  isOpenRouterEnabled,
} from "@/lib/ai/openrouter";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  buildFeedDraftSystemPrompt,
  buildFeedDraftUserPrompt,
} from "@/lib/ai/prompts/feedDraftPrompt";
import type { FeedComposerPostType } from "@/lib/feedComposerConfig";

type GenerateFeedDraftArgs = {
  captionHint?: string | null;
  notes?: string | null;
  postType: FeedComposerPostType;
  requestOrigin?: string | null;
  salonName: string;
  serviceName?: string | null;
  staffMemberName?: string | null;
  staffMemberRole?: string | null;
  titleHint?: string | null;
};

type FeedDraftResult = {
  caption: string;
  model: string;
  title: string;
};

const MAX_TITLE_CHARS = 60;
const MAX_CAPTION_CHARS = 240;

function cleanText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function getPostTypeGuidance(postType: FeedComposerPostType) {
  switch (postType) {
    case "before_after":
      return "Mostre transformacao clara, resultado e convite para agendar.";
    case "reel":
      return "Foque em movimento, acabamento e impacto visual rapido.";
    case "story":
      return "Seja curto, direto e com chamada imediata para a cliente.";
    case "standard":
    default:
      return "Escreva um post de feed claro, bonito e facil de vender.";
  }
}

function buildFallbackDraft(args: GenerateFeedDraftArgs): FeedDraftResult {
  const serviceLabel = cleanText(args.serviceName, 60) || "Novo resultado";
  const staffLabel = cleanText(args.staffMemberName, 60);
  const title = cleanText(
    args.titleHint ||
      `${serviceLabel}${args.postType === "story" ? " com vaga aberta" : " do dia"}`,
    MAX_TITLE_CHARS,
  ) || "Resultado do dia";

  const captionBase = [
    serviceLabel !== "Novo resultado"
      ? `Resultado de ${serviceLabel.toLowerCase()}`
      : "Resultado novo saindo por aqui",
    staffLabel ? `com ${staffLabel}` : null,
    "Se quiser um horario, fale com o salao e agende pelo app.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    caption:
      cleanText(args.captionHint, MAX_CAPTION_CHARS) ||
      cleanText(captionBase, MAX_CAPTION_CHARS) ||
      "Agende pelo app para garantir seu horario.",
    model: `${getOpenRouterModel()} (fallback)`,
    title,
  };
}

function parseDraftJson(raw: string) {
  const candidates = [
    raw.trim(),
    raw.match(/```json\s*([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/```([\s\S]*?)```/i)?.[1] ?? "",
    raw.match(/\{[\s\S]*\}/)?.[0] ?? "",
  ].filter(Boolean);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as {
        caption?: unknown;
        title?: unknown;
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

export function isFeedDraftAiEnabled() {
  return isOpenRouterEnabled();
}

export async function generateFeedDraftWithAi(
  args: GenerateFeedDraftArgs,
): Promise<FeedDraftResult> {
  const notes = cleanText(args.notes, 220);
  const titleHint = cleanText(args.titleHint, 80);
  const captionHint = cleanText(args.captionHint, 320);
  const serviceName = cleanText(args.serviceName, 80) || "Sem servico vinculado";
  const staffMemberName =
    cleanText(args.staffMemberName, 80) || "Sem profissional destacado";
  const staffMemberRole = cleanText(args.staffMemberRole, 60);
  const staffLabel = staffMemberRole
    ? `${staffMemberName} - ${staffMemberRole}`
    : staffMemberName;
  const postTypeGuidance = getPostTypeGuidance(args.postType);
  const systemPrompt = buildFeedDraftSystemPrompt({
    postType: args.postType,
  });
  const userPrompt = buildFeedDraftUserPrompt({
    captionHint,
    notes,
    postType: args.postType,
    postTypeGuidance,
    salonName: cleanText(args.salonName, 80) || "Salao parceiro",
    serviceName,
    staffLabel,
    titleHint,
  });

  let model: string;
  let text: string;

  try {
    const result = await createOpenRouterChatCompletion({
      feature: AI_FEATURE_REGISTRY.feedDraft.feature,
      maxTokens: 220,
      requestOrigin: args.requestOrigin,
      temperature: 0.7,
      timeoutMs: 8_000,
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

    model = result.model;
    text = result.text;
  } catch {
    return buildFallbackDraft(args);
  }

  const parsed = parseDraftJson(text);

  if (!parsed) {
    return buildFallbackDraft(args);
  }

  const title = cleanText(
    typeof parsed.title === "string" ? parsed.title : titleHint,
    MAX_TITLE_CHARS,
  );
  const caption = cleanText(
    typeof parsed.caption === "string" ? parsed.caption : captionHint,
    MAX_CAPTION_CHARS,
  );

  if (!title || !caption) {
    return buildFallbackDraft(args);
  }

  return {
    caption,
    model,
    title,
  };
}
