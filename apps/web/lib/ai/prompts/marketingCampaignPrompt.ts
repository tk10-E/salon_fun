import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

export const MARKETING_CAMPAIGN_PROMPT_PROFILE =
  AI_FEATURE_REGISTRY.marketingCampaignMessage.promptProfile;
export const MARKETING_CAMPAIGN_PROMPT_VERSION =
  AI_FEATURE_REGISTRY.marketingCampaignMessage.promptVersion;

type BuildMarketingCampaignSystemPromptArgs = {
  campaignType: "birthday_campaign" | "manual_reactivation";
};

type BuildMarketingCampaignUserPromptArgs = {
  activeOfferTitle?: string | null;
  campaignGoal: string;
  campaignType: "birthday_campaign" | "manual_reactivation";
  customerName: string;
  discountPercent?: number | null;
  inactiveDays?: number | null;
  salonName: string;
  serviceName: string;
};

export function buildMarketingCampaignSystemPrompt(
  args: BuildMarketingCampaignSystemPromptArgs,
) {
  return [
    "Voce e um copiloto comercial premium para campanhas de CRM em saloes e barbearias do Brasil.",
    "Seu papel e escrever mensagens curtas, humanas, elegantes e comerciais para aumentar retorno e agendamento.",
    "Nunca responda como chatbot generico.",
    "Use somente o contexto fornecido.",
    "Nunca invente oferta, desconto, servico, historico ou beneficio fora do contexto.",
    args.campaignType === "birthday_campaign"
      ? "Para aniversario, use tom caloroso, valioso e convidativo, sem exagero."
      : "Para reativacao, use tom humano, elegante e comercial, sem soar insistente ou spam.",
    "A IA apenas sugere a mensagem. O envio real depende de confirmacao humana e fluxo do sistema.",
    "Responda apenas em JSON valido com as chaves title e body.",
    "title deve ter ate 90 caracteres. body deve ter ate 220 caracteres.",
    "Nada de markdown, emoji excessivo, aspas extras ou texto fora do JSON.",
  ].join("\n");
}

export function buildMarketingCampaignUserPrompt(
  args: BuildMarketingCampaignUserPromptArgs,
) {
  return [
    `Prompt profile: ${MARKETING_CAMPAIGN_PROMPT_PROFILE}`,
    `Prompt version: ${MARKETING_CAMPAIGN_PROMPT_VERSION}`,
    `Salao: ${args.salonName}`,
    `Campanha: ${args.campaignType}`,
    `Cliente: ${args.customerName}`,
    `Objetivo: ${args.campaignGoal}`,
    args.campaignType === "manual_reactivation"
      ? `Ultimo servico: ${args.serviceName}`
      : null,
    args.campaignType === "manual_reactivation" && args.inactiveDays != null
      ? `Dias sem voltar: ${args.inactiveDays}`
      : null,
    args.campaignType === "manual_reactivation" && args.discountPercent != null
      ? `Desconto atual: ${args.discountPercent}%`
      : null,
    args.activeOfferTitle ? `Oferta ativa: ${args.activeOfferTitle}` : null,
    "Escreva em pt-BR, com tom premium, simples, humano e direto para vender agendamento.",
    "A mensagem pode servir tanto para aviso no app quanto para inspirar envio por WhatsApp.",
  ]
    .filter(Boolean)
    .join("\n");
}
