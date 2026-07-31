export const AI_DEFAULT_REQUEST_FEATURE = "ai_request" as const;

export const AI_FEATURE_REGISTRY = {
  panelAssistant: {
    feature: "panel_assistant",
    policyVersion: "panel-ai-policy-2026-05-13",
    promptProfile: "panel-assistant-operational-premium",
    promptVersion: "2026-05-13",
  },
  promotionDraft: {
    feature: "promotion_draft",
    promptProfile: "promotion-draft-premium",
    promptVersion: "2026-05-13",
  },
  feedDraft: {
    feature: "feed_draft",
    promptProfile: "feed-draft-premium",
    promptVersion: "2026-05-13",
  },
  recoveryCampaign: {
    feature: "recovery_campaign",
    promptProfile: "recovery-campaign-premium",
    promptVersion: "2026-05-13",
  },
  marketingCampaignMessage: {
    feature: "marketing_campaign_message",
    promptProfile: "marketing-campaign-premium",
    promptVersion: "2026-05-13",
  },
} as const;

type AiFeatureRegistryValue =
  (typeof AI_FEATURE_REGISTRY)[keyof typeof AI_FEATURE_REGISTRY];

export type AiFeature = AiFeatureRegistryValue["feature"];
export type AiPromptedFeature = Extract<
  AiFeatureRegistryValue,
  {
    promptProfile: string;
    promptVersion: string;
  }
>["feature"];
export type AiGenerationAuditOutcome = "failed" | "generated";
export type OpenRouterFeature = AiFeature | typeof AI_DEFAULT_REQUEST_FEATURE;

export function buildAiGenerationEventType(
  feature: AiFeature,
  outcome: AiGenerationAuditOutcome,
) {
  return `ai.${feature}_${outcome}`;
}

export function getAiFeatureConfig<
  TKey extends keyof typeof AI_FEATURE_REGISTRY,
>(key: TKey) {
  return AI_FEATURE_REGISTRY[key];
}

export function getPanelAssistantAiMetadata() {
  const config = AI_FEATURE_REGISTRY.panelAssistant;

  return {
    feature: config.feature,
    policyVersion: config.policyVersion,
    promptProfile: config.promptProfile,
    promptVersion: config.promptVersion,
  } as const;
}
