import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const {
  createClientMock,
  getAiObservabilitySnapshotMock,
  hasInternalAiObservabilityAccessMock,
  getOwnerSalonMock,
  guardApiRequestMock,
  recordSecurityAuditEventMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getAiObservabilitySnapshotMock: vi.fn(),
  hasInternalAiObservabilityAccessMock: vi.fn(),
  getOwnerSalonMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  recordSecurityAuditEventMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getOwnerSalon: getOwnerSalonMock,
  hasInternalAiObservabilityAccess: hasInternalAiObservabilityAccessMock,
}));

vi.mock("@/lib/ai/observability", async () => {
  const actual = await vi.importActual<typeof import("@/lib/ai/observability")>(
    "@/lib/ai/observability",
  );

  return {
    ...actual,
    getAiObservabilitySnapshot: getAiObservabilitySnapshotMock,
  };
});

vi.mock("@/lib/security", () => ({
  getClientIp: vi.fn(() => "127.0.0.1"),
  getUserAgent: vi.fn(() => "vitest"),
  guardApiRequest: guardApiRequestMock,
  hashSecurityIdentifier: vi.fn(() => "hashed"),
  recordSecurityAuditEvent: recordSecurityAuditEventMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { GET } from "@/app/dashboard/ai/export/route";

describe("dashboard ai export route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hasInternalAiObservabilityAccessMock.mockReturnValue(true);
    guardApiRequestMock.mockResolvedValue(null);
    recordSecurityAuditEventMock.mockResolvedValue(undefined);
  });

  it("returns 404 when the internal debug mode is missing", async () => {
    const response = await GET(
      new NextRequest(
        "https://painel.jc7desenvovimento.online/dashboard/ai/export",
      ),
    );

    expect(response.status).toBe(404);
    expect(getAiObservabilitySnapshotMock).not.toHaveBeenCalled();
  });

  it("returns 404 when the user is not allowed to inspect internal observability", async () => {
    hasInternalAiObservabilityAccessMock.mockReturnValue(false);
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
    });

    const response = await GET(
      new NextRequest(
        "https://painel.jc7desenvovimento.online/dashboard/ai/export?debug=ai",
      ),
    );

    expect(response.status).toBe(404);
    expect(getAiObservabilitySnapshotMock).not.toHaveBeenCalled();
  });

  it("redirects to login when there is no authenticated user", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    });

    const response = await GET(
      new NextRequest(
        "https://painel.jc7desenvovimento.online/dashboard/ai/export?debug=ai",
      ),
    );

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("exports the filtered ai observability csv for the current salon", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: {
            user: {
              id: "user-1",
              app_metadata: {
                permissions: ["ai_observability.read"],
              },
            },
          },
        }),
      },
    });
    getOwnerSalonMock.mockResolvedValue({
      id: "salon-1",
      name: "Studio Barber",
    });
    getAiObservabilitySnapshotMock.mockResolvedValue({
      appliedFilters: {
        day: "2026-05-13",
        feature: "panel_assistant",
        model: "google/gemma-4-31b-it:free",
        outcome: "answered",
        periodDays: 30,
        promptProfile: "panel-assistant-operational-premium",
        skillId: "schedule_availability",
      },
      breakdowns: {
        features: [],
        models: [],
        skills: [],
      },
      entries: [
        {
          createdAt: "2026-05-13T18:00:00.000Z",
          dayKey: "2026-05-13",
          eventType: "panel.ai_query",
          feature: "panel_assistant",
          featureLabel: "Assistente do painel",
          id: "entry-1",
          model: "google/gemma-4-31b-it:free",
          outcome: "answered",
          outcomeLabel: "Respondido",
          policyVersion: "panel-ai-policy-2026-05-13",
          promptProfile: "panel-assistant-operational-premium",
          promptVersion: "2026-05-13",
          requestPath: "/api/internal/ai/panel-assistant",
          severity: "info",
          skillId: "schedule_availability",
          skillLabel: "Agenda",
          summary: "Camila lidera os horarios livres.",
          usedFallback: false,
        },
      ],
      options: {
        features: [],
        models: [],
        outcomes: [],
        promptProfiles: [],
        skills: [],
      },
      totals: {
        fallbackCount: 0,
        failureCount: 0,
        filteredCount: 1,
        lastEventAt: "2026-05-13T18:00:00.000Z",
        successCount: 1,
        topFeatureLabel: "Assistente do painel",
        topModelLabel: "google/gemma-4-31b-it:free",
        topPromptLabel: "panel-assistant-operational-premium",
        topSkillLabel: "Agenda",
        totalEvents: 1,
        truncated: false,
      },
      trend: [],
    });

    const response = await GET(
      new NextRequest(
        "https://painel.jc7desenvovimento.online/dashboard/ai/export?debug=ai&period=30&day=2026-05-13&feature=panel_assistant&model=google%2Fgemma-4-31b-it%3Afree&outcome=answered&promptProfile=panel-assistant-operational-premium&skill=schedule_availability",
      ),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/csv");
    expect(response.headers.get("content-disposition")).toContain(
      "ia-observabilidade-salon-1-dia-2026-05-13.csv",
    );
    await expect(response.text()).resolves.toContain("Assistente do painel");
    expect(getAiObservabilitySnapshotMock).toHaveBeenCalledWith({
      entryLimit: 5000,
      filters: {
        day: "2026-05-13",
        feature: "panel_assistant",
        model: "google/gemma-4-31b-it:free",
        outcome: "answered",
        periodDays: 30,
        promptProfile: "panel-assistant-operational-premium",
        skillId: "schedule_availability",
      },
      limit: 5000,
      salonId: "salon-1",
    });
    expect(recordSecurityAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        eventType: "ai_observability_export.generated",
        metadata: expect.objectContaining({
          day: "2026-05-13",
          exportedRows: 1,
          filteredCount: 1,
        }),
        salonId: "salon-1",
      }),
    );
  });
});
