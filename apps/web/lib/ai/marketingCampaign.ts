import {
  createOpenRouterChatCompletion,
  getOpenRouterModel,
  isOpenRouterEnabled,
} from "@/lib/ai/openrouter";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  buildMarketingCampaignSystemPrompt,
  buildMarketingCampaignUserPrompt,
} from "@/lib/ai/prompts/marketingCampaignPrompt";

type MarketingCampaignType = "birthday_campaign" | "manual_reactivation";

type GenerateMarketingCampaignMessageArgs = {
  activeOfferTitle?: string | null;
  campaignType: MarketingCampaignType;
  customerName: string;
  discountPercent?: number | null;
  inactiveDays?: number | null;
  requestOrigin?: string | null;
  salonName: string;
  serviceName?: string | null;
};

type MarketingCampaignMessageResult = {
  body: string;
  model: string;
  title: string;
};

const MAX_TITLE_CHARS = 90;
const MAX_BODY_CHARS = 220;

function cleanText(value: string | null | undefined, maxLength: number) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

function getFirstName(name: string) {
  return cleanText(name, 80).split(/\s+/)[0] || "Cliente";
}

function buildFallbackMessage(
  args: GenerateMarketingCampaignMessageArgs,
): MarketingCampaignMessageResult {
  const customerName = getFirstName(args.customerName);
  const serviceName = cleanText(args.serviceName, 80) || "atendimento";
  const offerTitle = cleanText(args.activeOfferTitle, 80);

  if (args.campaignType === "birthday_campaign") {
    const title =
      offerTitle || cleanText(`Presente do mes para ${customerName}`, MAX_TITLE_CHARS);
    const body = cleanText(
      offerTitle
        ? `${customerName}, seu presente deste mes ja esta no app: ${offerTitle}. Abra e veja a condicao especial para sua proxima visita.`
        : `${customerName}, seu mes chegou e o salao separou uma condicao especial para a sua proxima visita. Abra o app e confira.`,
      MAX_BODY_CHARS,
    );

    return {
      body,
      model: `${getOpenRouterModel()} (fallback)`,
      title,
    };
  }

  const inactiveDays = args.inactiveDays ?? 30;
  const discountPercent = args.discountPercent ?? 10;
  const title = cleanText(
    `Volte para cuidar do seu ${serviceName.toLowerCase()}`,
    MAX_TITLE_CHARS,
  );
  const body = cleanText(
    `${customerName}, ja faz ${inactiveDays} dias desde seu ultimo ${serviceName.toLowerCase()}. Volte nesta semana e confira ${discountPercent}% OFF${offerTitle ? ` em ${offerTitle}` : ""}.`,
    MAX_BODY_CHARS,
  );

  return {
    body,
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
        body?: unknown;
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

export function isMarketingCampaignAiEnabled() {
  return isOpenRouterEnabled();
}

export async function generateMarketingCampaignMessageWithAi(
  args: GenerateMarketingCampaignMessageArgs,
): Promise<MarketingCampaignMessageResult> {
  const customerName = getFirstName(args.customerName);
  const serviceName = cleanText(args.serviceName, 80) || "atendimento";
  const activeOfferTitle = cleanText(args.activeOfferTitle, 80);
  const inactiveDays = args.inactiveDays ?? 30;
  const discountPercent = args.discountPercent ?? 10;

  const campaignGoal =
    args.campaignType === "birthday_campaign"
      ? "Criar uma mensagem curta de aniversario que gere retorno e agendamento."
      : "Criar uma mensagem curta de reativacao para cliente parada, com tom elegante e comercial.";
  const systemPrompt = buildMarketingCampaignSystemPrompt({
    campaignType: args.campaignType,
  });
  const userPrompt = buildMarketingCampaignUserPrompt({
    activeOfferTitle,
    campaignGoal,
    campaignType: args.campaignType,
    customerName,
    discountPercent:
      args.campaignType === "manual_reactivation" ? discountPercent : null,
    inactiveDays:
      args.campaignType === "manual_reactivation" ? inactiveDays : null,
    salonName: cleanText(args.salonName, 80) || "Salao parceiro",
    serviceName,
  });

  let model: string;
  let text: string;

  try {
    const result = await createOpenRouterChatCompletion({
      feature: AI_FEATURE_REGISTRY.marketingCampaignMessage.feature,
      maxTokens: 220,
      requestOrigin: args.requestOrigin,
      temperature: 0.8,
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
    return buildFallbackMessage(args);
  }

  const parsed = parseDraftJson(text);

  if (!parsed) {
    return buildFallbackMessage(args);
  }

  const title = cleanText(
    typeof parsed.title === "string" ? parsed.title : "",
    MAX_TITLE_CHARS,
  );
  const body = cleanText(
    typeof parsed.body === "string" ? parsed.body : "",
    MAX_BODY_CHARS,
  );

  if (!title || !body) {
    return buildFallbackMessage(args);
  }

  return {
    body,
    model,
    title,
  };
}
