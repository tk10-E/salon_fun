import { describe, expect, it } from "vitest";

import { getAiObservabilitySnapshot } from "@/lib/ai/observability";

function createObservabilityAdmin(args: {
  logs: unknown[];
  rollups?: unknown[] | null;
}) {
  const logQuery = {
    gte: () => logQuery,
    limit: async () => ({
      data: args.logs,
      error: null,
    }),
    lt: () => logQuery,
    order: () => logQuery,
  };
  const viewQuery = {
    gte: async () =>
      args.rollups
        ? {
            data: args.rollups,
            error: null,
          }
        : {
            data: null,
            error: new Error("missing_view"),
          },
  };

  return {
    from: (table: string) => ({
      select: () => ({
        eq: () =>
          table === "ai_observability_daily_rollup" ? viewQuery : logQuery,
      }),
    }),
  };
}

describe("ai observability snapshot", () => {
  it("aggregates trend, breakdowns and options from relevant AI events", async () => {
    const currentDayKey = new Date().toISOString().slice(0, 10);
    const previousDate = new Date(`${currentDayKey}T12:00:00.000Z`);
    previousDate.setUTCDate(previousDate.getUTCDate() - 1);
    const previousDayKey = previousDate.toISOString().slice(0, 10);
    const now = new Date(`${currentDayKey}T18:00:00.000Z`);
    const yesterday = new Date(`${previousDayKey}T15:00:00.000Z`);
    const snapshot = await getAiObservabilitySnapshot({
      admin: createObservabilityAdmin({
        logs: [
          {
            created_at: now.toISOString(),
            event_type: "panel.ai_query",
            id: "panel-1",
            metadata: {
              answerSummary: "Camila lidera os horarios livres.",
              feature: "panel_assistant",
              model: "google/gemma-4-31b-it:free (fallback)",
              policyVersion: "panel-ai-policy-2026-05-13",
              promptProfile: "panel-assistant-operational-premium",
              promptVersion: "2026-05-13",
              skillId: "schedule_availability",
              skillLabel: "Agenda",
            },
            request_path: "/api/internal/ai/panel-assistant",
            severity: "info",
          },
          {
            created_at: yesterday.toISOString(),
            event_type: "ai.promotion_draft_generated",
            id: "promotion-1",
            metadata: {
              aiModel: "google/gemma-4-31b-it:free",
              offerKind: "promotion",
              promptProfile: "promotion-draft-premium",
              promptVersion: "2026-05-13",
              usedFallback: false,
            },
            request_path: "/api/internal/ai/promotion-draft",
            severity: "info",
          },
          {
            created_at: yesterday.toISOString(),
            event_type: "ai.recovery_campaign_failed",
            id: "recovery-1",
            metadata: {
              promptProfile: "recovery-campaign-premium",
              promptVersion: "2026-05-13",
            },
            request_path: "/api/internal/ai/recovery-campaign",
            severity: "warn",
          },
          {
            created_at: yesterday.toISOString(),
            event_type: "auth.login_succeeded",
            id: "auth-1",
            metadata: {},
            request_path: "/login",
            severity: "info",
          },
        ],
        rollups: [
          {
            day: previousDayKey,
            event_count: 1,
            fallback_count: 0,
            feature: "promotion_draft",
            model: "google/gemma-4-31b-it:free",
            outcome: "generated",
            prompt_profile: "promotion-draft-premium",
            skill_id: null,
            skill_label: null,
          },
          {
            day: previousDayKey,
            event_count: 1,
            fallback_count: 0,
            feature: "recovery_campaign",
            model: null,
            outcome: "failed",
            prompt_profile: "recovery-campaign-premium",
            skill_id: null,
            skill_label: null,
          },
          {
            day: currentDayKey,
            event_count: 1,
            fallback_count: 1,
            feature: "panel_assistant",
            model: "google/gemma-4-31b-it:free (fallback)",
            outcome: "answered",
            prompt_profile: "panel-assistant-operational-premium",
            skill_id: "schedule_availability",
            skill_label: "Agenda",
          },
        ],
      }),
      filters: {
        periodDays: 30,
      },
      salonId: "salon-1",
    });

    expect(snapshot.totals.totalEvents).toBe(3);
    expect(snapshot.totals.filteredCount).toBe(3);
    expect(snapshot.totals.successCount).toBe(2);
    expect(snapshot.totals.failureCount).toBe(1);
    expect(snapshot.totals.fallbackCount).toBe(1);
    expect(snapshot.totals.topFeatureLabel).toBe("Assistente do painel");
    expect(snapshot.totals.topPromptLabel).toBe(
      "panel-assistant-operational-premium",
    );
    expect(snapshot.options.features.map((item) => item.value)).toEqual([
      "panel_assistant",
      "recovery_campaign",
      "promotion_draft",
    ]);
    expect(snapshot.options.outcomes.map((item) => item.value)).toEqual([
      "failed",
      "generated",
      "answered",
    ]);
    expect(snapshot.breakdowns.skills[0]).toMatchObject({
      count: 1,
      key: "schedule_availability",
      label: "Agenda",
    });
    expect(
      snapshot.trend.find((item) => item.dayKey === currentDayKey),
    ).toMatchObject({
      fallbackCount: 1,
      successCount: 1,
      totalCount: 1,
    });
    expect(snapshot.entries[0]).toMatchObject({
      feature: "panel_assistant",
      outcome: "answered",
      promptProfile: "panel-assistant-operational-premium",
      usedFallback: true,
    });
  });

  it("applies day, feature, model, prompt, outcome and skill filters to the visible observability data", async () => {
    const snapshot = await getAiObservabilitySnapshot({
      admin: createObservabilityAdmin({
        logs: [
          {
            created_at: "2026-05-13T18:00:00.000Z",
            event_type: "panel.ai_query",
            id: "panel-1",
            metadata: {
              answerSummary: "Camila lidera os horarios livres.",
              feature: "panel_assistant",
              model: "google/gemma-4-31b-it:free",
              promptProfile: "panel-assistant-operational-premium",
              promptVersion: "2026-05-13",
              skillId: "schedule_availability",
              skillLabel: "Agenda",
            },
            request_path: "/api/internal/ai/panel-assistant",
            severity: "info",
          },
          {
            created_at: "2026-05-12T16:00:00.000Z",
            event_type: "ai.feed_draft_generated",
            id: "feed-1",
            metadata: {
              aiModel: "openai/gpt-5.4-mini",
              postType: "story",
              promptProfile: "feed-draft-premium",
              promptVersion: "2026-05-13",
              usedFallback: false,
            },
            request_path: "/api/internal/ai/feed-draft",
            severity: "info",
          },
        ],
        rollups: [
          {
            day: "2026-05-13",
            event_count: 1,
            fallback_count: 0,
            feature: "panel_assistant",
            model: "google/gemma-4-31b-it:free",
            outcome: "answered",
            prompt_profile: "panel-assistant-operational-premium",
            skill_id: "schedule_availability",
            skill_label: "Agenda",
          },
          {
            day: "2026-05-12",
            event_count: 1,
            fallback_count: 0,
            feature: "feed_draft",
            model: "openai/gpt-5.4-mini",
            outcome: "generated",
            prompt_profile: "feed-draft-premium",
            skill_id: null,
            skill_label: null,
          },
        ],
      }),
      filters: {
        day: "2026-05-13",
        feature: "panel_assistant",
        model: "google/gemma-4-31b-it:free",
        outcome: "answered",
        periodDays: 30,
        promptProfile: "panel-assistant-operational-premium",
        skillId: "schedule_availability",
      },
      salonId: "salon-1",
    });

    expect(snapshot.entries).toHaveLength(1);
    expect(snapshot.entries[0]).toMatchObject({
      feature: "panel_assistant",
      model: "google/gemma-4-31b-it:free",
      promptProfile: "panel-assistant-operational-premium",
      skillId: "schedule_availability",
    });
    expect(snapshot.totals.filteredCount).toBe(1);
    expect(snapshot.totals.topModelLabel).toBe("google/gemma-4-31b-it:free");
    expect(snapshot.totals.topPromptLabel).toBe(
      "panel-assistant-operational-premium",
    );
    expect(snapshot.totals.topSkillLabel).toBe("Agenda");
    expect(snapshot.trend).toHaveLength(1);
    expect(snapshot.trend[0]).toMatchObject({
      dayKey: "2026-05-13",
      totalCount: 1,
    });
    expect(snapshot.options.promptProfiles.map((item) => item.value)).toEqual([
      "feed-draft-premium",
      "panel-assistant-operational-premium",
    ]);
  });
});
