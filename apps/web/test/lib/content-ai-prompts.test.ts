import { describe, expect, it } from "vitest";

import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  buildFeedDraftSystemPrompt,
  buildFeedDraftUserPrompt,
  FEED_DRAFT_PROMPT_PROFILE,
  FEED_DRAFT_PROMPT_VERSION,
} from "@/lib/ai/prompts/feedDraftPrompt";
import {
  buildMarketingCampaignSystemPrompt,
  buildMarketingCampaignUserPrompt,
  MARKETING_CAMPAIGN_PROMPT_PROFILE,
  MARKETING_CAMPAIGN_PROMPT_VERSION,
} from "@/lib/ai/prompts/marketingCampaignPrompt";
import {
  buildPromotionDraftSystemPrompt,
  buildPromotionDraftUserPrompt,
  PROMOTION_DRAFT_PROMPT_PROFILE,
  PROMOTION_DRAFT_PROMPT_VERSION,
} from "@/lib/ai/prompts/promotionDraftPrompt";
import {
  buildRecoveryCampaignSystemPrompt,
  buildRecoveryCampaignUserPrompt,
  RECOVERY_CAMPAIGN_PROMPT_PROFILE,
  RECOVERY_CAMPAIGN_PROMPT_VERSION,
} from "@/lib/ai/prompts/recoveryCampaignPrompt";

describe("content ai prompt builders", () => {
  it("reuses prompt metadata from the shared AI registry", () => {
    expect(PROMOTION_DRAFT_PROMPT_PROFILE).toBe(
      AI_FEATURE_REGISTRY.promotionDraft.promptProfile,
    );
    expect(PROMOTION_DRAFT_PROMPT_VERSION).toBe(
      AI_FEATURE_REGISTRY.promotionDraft.promptVersion,
    );
    expect(FEED_DRAFT_PROMPT_PROFILE).toBe(
      AI_FEATURE_REGISTRY.feedDraft.promptProfile,
    );
    expect(FEED_DRAFT_PROMPT_VERSION).toBe(
      AI_FEATURE_REGISTRY.feedDraft.promptVersion,
    );
    expect(RECOVERY_CAMPAIGN_PROMPT_PROFILE).toBe(
      AI_FEATURE_REGISTRY.recoveryCampaign.promptProfile,
    );
    expect(RECOVERY_CAMPAIGN_PROMPT_VERSION).toBe(
      AI_FEATURE_REGISTRY.recoveryCampaign.promptVersion,
    );
    expect(MARKETING_CAMPAIGN_PROMPT_PROFILE).toBe(
      AI_FEATURE_REGISTRY.marketingCampaignMessage.promptProfile,
    );
    expect(MARKETING_CAMPAIGN_PROMPT_VERSION).toBe(
      AI_FEATURE_REGISTRY.marketingCampaignMessage.promptVersion,
    );
  });

  it("builds a promotion prompt with premium offer and anti-hallucination rules", () => {
    const systemPrompt = buildPromotionDraftSystemPrompt({
      kind: "promotion",
    });
    const userPrompt = buildPromotionDraftUserPrompt({
      goal: "sexta com baixo movimento",
      kind: "promotion",
      notes: "Quero vender agendamento rapido.",
      priceHint: 89.9,
      salonName: "Studio Barber",
      serviceName: "Escova premium",
      serviceOptions: ["service-1 = Escova premium"],
      todayLabel: "2026-05-13",
      titleHint: "Escova da semana",
    });

    expect(systemPrompt).toContain(
      "Voce e um copiloto comercial premium para saloes e barbearias do Brasil.",
    );
    expect(systemPrompt).toContain(
      "Nunca invente servicos, beneficios, datas, sesses, validade ou vinculo de serviceId sem base no contexto.",
    );
    expect(systemPrompt).toContain(
      "Responda apenas em JSON valido com as chaves title, highlightText, description, priceSuggestion, sessionsIncluded, validityDays, startsOn, endsOn e serviceId.",
    );
    expect(userPrompt).toContain(
      `Prompt profile: ${PROMOTION_DRAFT_PROMPT_PROFILE}`,
    );
    expect(userPrompt).toContain(
      `Prompt version: ${PROMOTION_DRAFT_PROMPT_VERSION}`,
    );
    expect(userPrompt).toContain("Servico principal: Escova premium");
  });

  it("builds a feed prompt with format-specific guidance", () => {
    const systemPrompt = buildFeedDraftSystemPrompt({
      postType: "story",
    });
    const userPrompt = buildFeedDraftUserPrompt({
      captionHint: "Quero um tom premium.",
      notes: "Fale de brilho e convide para agendar.",
      postType: "story",
      postTypeGuidance: "Seja curto, direto e com chamada imediata para a cliente.",
      salonName: "Studio Barber",
      serviceName: "Gloss express",
      staffLabel: "Talita - Colorista",
      titleHint: "Gloss da semana",
    });

    expect(systemPrompt).toContain(
      "Voce e um redator premium de conteudo para saloes e barbearias do Brasil.",
    );
    expect(systemPrompt).toContain(
      "Para story, seja curto, direto e com chamada imediata.",
    );
    expect(userPrompt).toContain(`Prompt profile: ${FEED_DRAFT_PROMPT_PROFILE}`);
    expect(userPrompt).toContain(`Prompt version: ${FEED_DRAFT_PROMPT_VERSION}`);
    expect(userPrompt).toContain("Profissional: Talita - Colorista");
  });

  it("builds a recovery prompt with human-review and candidate focus", () => {
    const systemPrompt = buildRecoveryCampaignSystemPrompt({
      candidateCount: 3,
    });
    const userPrompt = buildRecoveryCampaignUserPrompt({
      campaignDescription: "Escova premium com vagas limitadas. Oferta pronta para lotar a tarde.",
      campaignTitle: "Escova de quinta",
      candidateLines: [
        "Ana Souza (Alta, costuma atender com Carla)",
        "Maria Lima (Boa, curte escova)",
      ],
      dayLabel: "quinta-feira, 15/05",
      priceLabel: "R$ 120,00",
      priceSuggestionLabel: "R$ 99,90",
      salonName: "Studio Barber",
      serviceName: "Escova",
      staffName: "Carla",
      windowLabel: "15:00 ate 17:00",
    });

    expect(systemPrompt).toContain(
      "Voce e um copiloto comercial premium de reativacao e preenchimento de agenda para saloes do Brasil.",
    );
    expect(systemPrompt).toContain(
      "Voce nao dispara mensagens nem publica campanha sozinho. Voce apenas sugere o rascunho.",
    );
    expect(userPrompt).toContain(
      `Prompt profile: ${RECOVERY_CAMPAIGN_PROMPT_PROFILE}`,
    );
    expect(userPrompt).toContain(
      `Prompt version: ${RECOVERY_CAMPAIGN_PROMPT_VERSION}`,
    );
    expect(userPrompt).toContain("Clientes sugeridos: Ana Souza");
  });

  it("builds a marketing campaign prompt with CRM tone and anti-hallucination rules", () => {
    const systemPrompt = buildMarketingCampaignSystemPrompt({
      campaignType: "manual_reactivation",
    });
    const userPrompt = buildMarketingCampaignUserPrompt({
      activeOfferTitle: "Coloracao glow",
      campaignGoal:
        "Criar uma mensagem curta de reativacao para cliente parada, com tom elegante e comercial.",
      campaignType: "manual_reactivation",
      customerName: "Lucas",
      discountPercent: 15,
      inactiveDays: 43,
      salonName: "Studio Barber",
      serviceName: "Coloracao",
    });

    expect(systemPrompt).toContain(
      "Voce e um copiloto comercial premium para campanhas de CRM em saloes e barbearias do Brasil.",
    );
    expect(systemPrompt).toContain(
      "Nunca invente oferta, desconto, servico, historico ou beneficio fora do contexto.",
    );
    expect(userPrompt).toContain(
      `Prompt profile: ${MARKETING_CAMPAIGN_PROMPT_PROFILE}`,
    );
    expect(userPrompt).toContain(
      `Prompt version: ${MARKETING_CAMPAIGN_PROMPT_VERSION}`,
    );
    expect(userPrompt).toContain("Desconto atual: 15%");
  });
});
