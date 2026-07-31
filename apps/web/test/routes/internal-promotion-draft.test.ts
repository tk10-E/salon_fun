import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

const {
  createClientMock,
  generatePromotionDraftWithAiMock,
  guardApiRequestMock,
  isPromotionDraftAiEnabledMock,
  recordAiGenerationAuditMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  generatePromotionDraftWithAiMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  isPromotionDraftAiEnabledMock: vi.fn(),
  recordAiGenerationAuditMock: vi.fn(),
}));

vi.mock("@/lib/ai/audit", () => ({
  recordAiGenerationAudit: recordAiGenerationAuditMock,
}));

vi.mock("@/lib/ai/promotionDraft", () => ({
  generatePromotionDraftWithAi: generatePromotionDraftWithAiMock,
  isPromotionDraftAiEnabled: isPromotionDraftAiEnabledMock,
}));

vi.mock("@/lib/security", () => ({
  guardApiRequest: guardApiRequestMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/internal/ai/promotion-draft/route";

function createTableQuery(result: unknown) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: result })),
    select: vi.fn(() => query),
  };

  return query;
}

describe("internal promotion draft route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApiRequestMock.mockResolvedValue(null);
    isPromotionDraftAiEnabledMock.mockReturnValue(true);
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
        "https://painel.jc7desenvovimento.online/api/internal/ai/promotion-draft",
        {
          body: JSON.stringify({ kind: "promotion" }),
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
    isPromotionDraftAiEnabledMock.mockReturnValue(false);
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
        "https://painel.jc7desenvovimento.online/api/internal/ai/promotion-draft",
        {
          body: JSON.stringify({ kind: "promotion" }),
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

  it("generates a promotion draft with real salon and service context", async () => {
    generatePromotionDraftWithAiMock.mockResolvedValue({
      description: "Oferta pronta para lotar a sexta-feira.",
      highlightText: "Escova premium com vagas limitadas.",
      model: "google/gemma-4-31b-it:free",
      priceSuggestion: 89.9,
      sessionsIncluded: null,
      title: "Escova de sexta",
      validityDays: null,
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
          return createTableQuery({ name: "Escova premium" });
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/promotion-draft",
        {
          body: JSON.stringify({
            descriptionHint: "Use um tom premium e direto.",
            goal: "sexta com baixo movimento",
            kind: "promotion",
            notes: "Quero vender agendamento rapido.",
            serviceId: "11111111-1111-4111-8111-111111111111",
            titleHint: "Escova da semana",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      draft: {
        description: "Oferta pronta para lotar a sexta-feira.",
        highlightText: "Escova premium com vagas limitadas.",
        model: "google/gemma-4-31b-it:free",
        priceSuggestion: 89.9,
        sessionsIncluded: null,
        title: "Escova de sexta",
        validityDays: null,
      },
      ok: true,
    });
    expect(generatePromotionDraftWithAiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        goal: "sexta com baixo movimento",
        kind: "promotion",
        requestOrigin: "https://painel.jc7desenvovimento.online",
        salonName: "Studio Barber",
        serviceName: "Escova premium",
      }),
    );
    expect(recordAiGenerationAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        feature: AI_FEATURE_REGISTRY.promotionDraft.feature,
        outcome: "generated",
        salonId: "salon-1",
      }),
    );
  });
});
