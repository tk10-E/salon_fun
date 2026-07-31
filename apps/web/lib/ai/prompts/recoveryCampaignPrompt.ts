import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

export const RECOVERY_CAMPAIGN_PROMPT_PROFILE =
  AI_FEATURE_REGISTRY.recoveryCampaign.promptProfile;
export const RECOVERY_CAMPAIGN_PROMPT_VERSION =
  AI_FEATURE_REGISTRY.recoveryCampaign.promptVersion;

type BuildRecoveryCampaignSystemPromptArgs = {
  candidateCount: number;
};

type BuildRecoveryCampaignUserPromptArgs = {
  campaignDescription: string;
  campaignTitle: string;
  candidateLines: string[];
  dayLabel: string;
  priceLabel: string;
  priceSuggestionLabel: string;
  salonName: string;
  serviceName: string;
  staffName: string;
  windowLabel: string;
};

export function buildRecoveryCampaignSystemPrompt(
  args: BuildRecoveryCampaignSystemPromptArgs,
) {
  return [
    "Voce e um copiloto comercial premium de reativacao e preenchimento de agenda para saloes do Brasil.",
    "Seu trabalho e transformar uma janela ociosa real em campanha util, profissional e pronta para revisao humana.",
    "Nunca invente clientes, encaixes, desconto, disponibilidade ou chance de retorno.",
    "Use somente os dados reais recebidos.",
    "Voce nao dispara mensagens nem publica campanha sozinho. Voce apenas sugere o rascunho.",
    args.candidateCount > 0
      ? "Priorize contato cirurgico, elegante e comercial, sem parecer spam."
      : "Mesmo sem muitos clientes listados, mantenha o tom premium e operacional.",
    "Responda apenas em JSON valido com as chaves campaignName, whatsappText, instagramCaption, discountLabel e strategyBullets.",
    "strategyBullets deve ter de 1 a 4 itens curtos.",
    "Nada de markdown, nada de comentarios extras e nada de texto fora do JSON.",
  ].join("\n");
}

export function buildRecoveryCampaignUserPrompt(
  args: BuildRecoveryCampaignUserPromptArgs,
) {
  return [
    `Prompt profile: ${RECOVERY_CAMPAIGN_PROMPT_PROFILE}`,
    `Prompt version: ${RECOVERY_CAMPAIGN_PROMPT_VERSION}`,
    `Salao: ${args.salonName}`,
    `Janela vazia: ${args.dayLabel}, ${args.windowLabel}`,
    `Profissional: ${args.staffName}`,
    `Servico foco: ${args.serviceName}`,
    `Preco atual: ${args.priceLabel}`,
    `Preco sugerido: ${args.priceSuggestionLabel}`,
    `Titulo base: ${args.campaignTitle}`,
    `Descricao base: ${args.campaignDescription}`,
    args.candidateLines.length
      ? `Clientes sugeridos: ${args.candidateLines.join("; ")}`
      : "Clientes sugeridos: sem lista priorizada",
    "Objetivo: encher a agenda sem parecer spam.",
    "Instrucao critica: a IA so sugere. Mantenha um tom humano, premium, comercial e operacional.",
  ].join("\n");
}
