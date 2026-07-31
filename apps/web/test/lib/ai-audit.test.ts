import { beforeEach, describe, expect, it, vi } from "vitest";

const { recordSecurityAuditEventMock } = vi.hoisted(() => ({
  recordSecurityAuditEventMock: vi.fn(),
}));

vi.mock("@/lib/security", () => ({
  recordSecurityAuditEvent: recordSecurityAuditEventMock,
}));

import { recordAiGenerationAudit } from "@/lib/ai/audit";
import {
  AI_FEATURE_REGISTRY,
  buildAiGenerationEventType,
} from "@/lib/ai/registry";

describe("ai generation audit helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    recordSecurityAuditEventMock.mockResolvedValue(undefined);
  });

  it("records generated events with default info severity and prompt metadata", async () => {
    await recordAiGenerationAudit({
      actorUserId: "user-1",
      feature: AI_FEATURE_REGISTRY.promotionDraft.feature,
      metadata: {
        offerKind: "promotion",
        usedFallback: false,
      },
      outcome: "generated",
      promptProfile: AI_FEATURE_REGISTRY.promotionDraft.promptProfile,
      promptVersion: AI_FEATURE_REGISTRY.promotionDraft.promptVersion,
      requestPath: "/api/internal/ai/promotion-draft",
      salonId: "salon-1",
      targetId: "service-1",
      targetType: "service",
    });

    expect(recordSecurityAuditEventMock).toHaveBeenCalledWith({
      actorUserId: "user-1",
      eventType: buildAiGenerationEventType(
        AI_FEATURE_REGISTRY.promotionDraft.feature,
        "generated",
      ),
      metadata: {
        offerKind: "promotion",
        promptProfile: AI_FEATURE_REGISTRY.promotionDraft.promptProfile,
        promptVersion: AI_FEATURE_REGISTRY.promotionDraft.promptVersion,
        usedFallback: false,
      },
      requestPath: "/api/internal/ai/promotion-draft",
      salonId: "salon-1",
      severity: "info",
      targetId: "service-1",
      targetType: "service",
    });
  });

  it("records failed events with default warn severity", async () => {
    await recordAiGenerationAudit({
      feature: AI_FEATURE_REGISTRY.marketingCampaignMessage.feature,
      metadata: {
        campaignType: "manual_reactivation",
      },
      outcome: "failed",
      promptProfile: AI_FEATURE_REGISTRY.marketingCampaignMessage.promptProfile,
      promptVersion: AI_FEATURE_REGISTRY.marketingCampaignMessage.promptVersion,
      salonId: "salon-1",
      targetId: "customer-1",
      targetType: "customer",
    });

    expect(recordSecurityAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: buildAiGenerationEventType(
          AI_FEATURE_REGISTRY.marketingCampaignMessage.feature,
          "failed",
        ),
        severity: "warn",
      }),
    );
  });
});
