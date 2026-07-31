import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

const {
  createClientMock,
  generateFeedDraftWithAiMock,
  guardApiRequestMock,
  isFeedDraftAiEnabledMock,
  recordAiGenerationAuditMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  generateFeedDraftWithAiMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  isFeedDraftAiEnabledMock: vi.fn(),
  recordAiGenerationAuditMock: vi.fn(),
}));

vi.mock("@/lib/ai/audit", () => ({
  recordAiGenerationAudit: recordAiGenerationAuditMock,
}));

vi.mock("@/lib/ai/feedDraft", () => ({
  generateFeedDraftWithAi: generateFeedDraftWithAiMock,
  isFeedDraftAiEnabled: isFeedDraftAiEnabledMock,
}));

vi.mock("@/lib/security", () => ({
  guardApiRequest: guardApiRequestMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/internal/ai/feed-draft/route";

function createTableQuery(result: unknown) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: result })),
    select: vi.fn(() => query),
  };

  return query;
}

describe("internal feed draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApiRequestMock.mockResolvedValue(null);
    isFeedDraftAiEnabledMock.mockReturnValue(true);
    recordAiGenerationAuditMock.mockResolvedValue(undefined);
  });

  it("returns 401 when the panel user is not authenticated", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/feed-draft",
        {
          body: JSON.stringify({ postType: "standard" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
      ok: false,
    });
  });

  it("returns 503 when the AI provider is not configured", async () => {
    isFeedDraftAiEnabledMock.mockReturnValue(false);
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn(() =>
        createTableQuery({ id: "salon-1", name: "Studio Barber" })),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/feed-draft",
        {
          body: JSON.stringify({ postType: "standard" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      error: "ai_not_configured",
      ok: false,
    });
  });

  it("generates a draft with real salon, service and professional context", async () => {
    generateFeedDraftWithAiMock.mockResolvedValue({
      caption: "Legenda premium pronta para publicar.",
      model: "google/gemma-4-31b-it:free",
      title: "Gloss do dia",
    });

    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
        }),
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1" } },
        }),
      },
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return createTableQuery({ id: "salon-1", name: "Studio Barber" });
        }

        if (table === "services") {
          return createTableQuery({ name: "Gloss express" });
        }

        if (table === "staff_members") {
          return createTableQuery({ name: "Talita", role: "Colorista" });
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/feed-draft",
        {
          body: JSON.stringify({
            captionHint: "Quero um tom premium.",
            notes: "Fale de brilho e convide para agendar.",
            postType: "standard",
            serviceId: "11111111-1111-4111-8111-111111111111",
            staffMemberId: "22222222-2222-4222-8222-222222222222",
            titleHint: "Gloss da semana",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      draft: {
        caption: "Legenda premium pronta para publicar.",
        model: "google/gemma-4-31b-it:free",
        title: "Gloss do dia",
      },
      ok: true,
    });
    expect(generateFeedDraftWithAiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        notes: "Fale de brilho e convide para agendar.",
        postType: "standard",
        requestOrigin: "https://painel.jc7desenvovimento.online",
        salonName: "Studio Barber",
        serviceName: "Gloss express",
        staffMemberName: "Talita",
        staffMemberRole: "Colorista",
      }),
    );
    expect(recordAiGenerationAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        feature: AI_FEATURE_REGISTRY.feedDraft.feature,
        outcome: "generated",
        salonId: "salon-1",
      }),
    );
  });
});
