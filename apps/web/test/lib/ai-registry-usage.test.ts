import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const AI_FEATURE_CALL_SITES = [
  "lib/ai/panelAssistant.ts",
  "lib/ai/promotionDraft.ts",
  "lib/ai/feedDraft.ts",
  "lib/ai/recoveryCampaign.ts",
  "lib/ai/marketingCampaign.ts",
  "app/_actions/marketing.ts",
  "app/api/internal/ai/promotion-draft/route.ts",
  "app/api/internal/ai/feed-draft/route.ts",
  "app/api/internal/ai/recovery-campaign/route.ts",
] as const;

describe("ai registry usage", () => {
  it("keeps critical AI call sites on the shared feature registry", () => {
    for (const relativePath of AI_FEATURE_CALL_SITES) {
      const source = readFileSync(resolve(process.cwd(), relativePath), "utf8");

      expect(source, `${relativePath} should use AI_FEATURE_REGISTRY`).toContain(
        "AI_FEATURE_REGISTRY",
      );
      expect(
        source,
        `${relativePath} should not hardcode feature literals`,
      ).not.toMatch(/feature:\s*"[^"]+"/);
    }
  });
});
