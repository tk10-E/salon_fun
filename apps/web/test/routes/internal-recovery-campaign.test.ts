import { beforeEach, describe, expect, it, vi } from "vitest";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

const {
  createClientMock,
  generateRecoveryCampaignMock,
  guardApiRequestMock,
  recordAiGenerationAuditMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  generateRecoveryCampaignMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  recordAiGenerationAuditMock: vi.fn(),
}));

vi.mock("@/lib/ai/audit", () => ({
  recordAiGenerationAudit: recordAiGenerationAuditMock,
}));

vi.mock("@/lib/ai/recoveryCampaign", () => ({
  generateRecoveryCampaign: generateRecoveryCampaignMock,
}));

vi.mock("@/lib/security", () => ({
  guardApiRequest: guardApiRequestMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/internal/ai/recovery-campaign/route";

function createTableQuery(result: unknown) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: result })),
    select: vi.fn(() => query),
  };

  return query;
}

describe("internal recovery campaign route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApiRequestMock.mockResolvedValue(null);
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
        "https://painel.jc7desenvovimento.online/api/internal/ai/recovery-campaign",
        {
          body: JSON.stringify({ question: "Preencher agenda de amanha" }),
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

  it("returns 200 with authenticated salon context", async () => {
    generateRecoveryCampaignMock.mockResolvedValue({
      available: true,
      candidates: [
        {
          avgTicketLabel: "R$ 120,00",
          chanceLabel: "Alta",
          customerId: "customer-1",
          daysSinceLastVisitLabel: "45 dia(s) sem voltar",
          name: "Ana Souza",
          reasonLabel: "costuma agendar quinta e curte escova",
          score: 92,
        },
      ],
      ctaHref: "/dashboard/benefits/promotions?compose=1",
      ctaLabel: "Abrir promocoes",
      draft: {
        campaignName: "Escova de quinta",
        discountLabel: "10% de ajuste",
        instagramCaption: "Legenda pronta",
        model: "google/gemma-4-31b-it:free",
        priceSuggestion: 99.9,
        strategyBullets: ["Foque na tarde de quinta."],
        whatsappText: "Mensagem pronta",
      },
      followUp: "Revise antes de publicar.",
      snapshot: {
        available: true,
        candidateCount: 12,
        dayLabel: "quinta-feira, 15/05",
        headline: "3 horario(s) ocioso(s) detectado(s) em quinta-feira, 15/05",
        highChanceCount: 4,
        openSlotsCount: 3,
        serviceName: "escova",
        staffName: "Carla",
        summary: "Carla tem 15:00 ate 17:00 com foco em escova.",
        topChanceLabel: "Alta",
        windowLabel: "15:00 ate 17:00",
      },
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
      from: vi.fn(() =>
        createTableQuery({
          id: "salon-1",
          name: "Studio Barber",
          slot_step_minutes: 30,
          timezone: "America/Sao_Paulo",
        }),
      ),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/recovery-campaign",
        {
          body: JSON.stringify({
            question: "Preencher agenda de amanha com IA",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      ok: true,
      recovery: expect.objectContaining({
        available: true,
        ctaHref: "/dashboard/benefits/promotions?compose=1",
      }),
    });
    expect(generateRecoveryCampaignMock).toHaveBeenCalledWith(
      expect.objectContaining({
        question: "Preencher agenda de amanha com IA",
        requestOrigin: "https://painel.jc7desenvovimento.online",
        salon: expect.objectContaining({
          id: "salon-1",
          name: "Studio Barber",
        }),
      }),
    );
    expect(recordAiGenerationAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        feature: AI_FEATURE_REGISTRY.recoveryCampaign.feature,
        outcome: "generated",
        salonId: "salon-1",
      }),
    );
  });
});
