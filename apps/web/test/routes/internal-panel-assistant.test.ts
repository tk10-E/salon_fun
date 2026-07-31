import { beforeEach, describe, expect, it, vi } from "vitest";
import { getPanelAssistantAiMetadata } from "@/lib/ai/registry";

const {
  answerPanelAssistantPromptMock,
  createClientMock,
  guardApiRequestMock,
  savePanelAssistantHistoryMock,
} = vi.hoisted(() => ({
  answerPanelAssistantPromptMock: vi.fn(),
  createClientMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  savePanelAssistantHistoryMock: vi.fn(),
}));

vi.mock("@/lib/ai/panelAssistant", () => ({
  answerPanelAssistantPrompt: answerPanelAssistantPromptMock,
  savePanelAssistantHistory: savePanelAssistantHistoryMock,
}));

vi.mock("@/lib/security", () => ({
  guardApiRequest: guardApiRequestMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { POST } from "@/app/api/internal/ai/panel-assistant/route";

const PANEL_ASSISTANT_AI_METADATA = getPanelAssistantAiMetadata();

function createTableQuery(result: unknown) {
  const query = {
    eq: vi.fn(() => query),
    maybeSingle: vi.fn(async () => ({ data: result })),
    select: vi.fn(() => query),
  };

  return query;
}

describe("internal panel assistant route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    guardApiRequestMock.mockResolvedValue(null);
    savePanelAssistantHistoryMock.mockResolvedValue(null);
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
        "https://painel.jc7desenvovimento.online/api/internal/ai/panel-assistant",
        {
          body: JSON.stringify({ question: "Como cadastrar comissao?" }),
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

  it("returns 400 when the request is invalid", async () => {
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
        })),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/panel-assistant",
        {
          body: JSON.stringify({ question: "oi" }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      ok: false,
    });
  });

  it("answers with authenticated salon context", async () => {
    answerPanelAssistantPromptMock.mockResolvedValue({
      actions: [
        {
          href: "/dashboard/gestao/agendamentos",
          kind: "primary",
          label: "Ver agenda",
        },
      ],
      bullets: ["Camila tem 4 horarios livres hoje."],
      ctaHref: "/dashboard/gestao/agendamentos",
      ctaLabel: "Abrir agenda",
      followUp: "Pergunte por um servico especifico para refinar.",
      impact: "A leitura agiliza o encaixe sem conflito.",
      intent: "schedule_availability",
      model: "google/gemma-4-31b-it:free",
      operationalContext: {
        cancellationsLast7d: 1,
        fitChanceLabel: "Alta",
        monthRevenueLabel: "R$ 960,00",
        operationalRiskLabel: "Medio",
        pendingAppointmentsCount: 2,
        summary:
          "Hoje voce esta com 4 atendimento(s), 2 confirmacao(oes) pendente(s), ocupacao de 42% amanha e R$ 960,00 concluidos no mes.",
        todayAppointmentsCount: 4,
        tomorrowOccupancyLabel: "42%",
        tomorrowOccupancyPercent: 42,
        tomorrowOpenSlotsCount: 3,
      },
      priority: "medium",
      problem: "A agenda precisa de leitura rapida.",
      recommendedAction: "Abra a agenda do dia.",
      suggestion: "Use Camila para encaixe rapido.",
      summary: "Camila lidera os encaixes de hoje.",
      title: "Mais horarios livres hoje",
    });

    savePanelAssistantHistoryMock.mockResolvedValue({
      actions: [
        {
          href: "/dashboard/gestao/agendamentos",
          kind: "primary",
          label: "Ver agenda",
        },
      ],
      answerBullets: ["Camila tem 4 horarios livres hoje."],
      answerCtaHref: "/dashboard/gestao/agendamentos",
      answerCtaLabel: "Abrir agenda",
      answerFollowUp: "Pergunte por um servico especifico para refinar.",
      answerImpact: "A leitura agiliza o encaixe sem conflito.",
      answerOperationalContext: {
        cancellationsLast7d: 1,
        fitChanceLabel: "Alta",
        monthRevenueLabel: "R$ 960,00",
        operationalRiskLabel: "Medio",
        pendingAppointmentsCount: 2,
        summary:
          "Hoje voce esta com 4 atendimento(s), 2 confirmacao(oes) pendente(s), ocupacao de 42% amanha e R$ 960,00 concluidos no mes.",
        todayAppointmentsCount: 4,
        tomorrowOccupancyLabel: "42%",
        tomorrowOccupancyPercent: 42,
        tomorrowOpenSlotsCount: 3,
      },
      answerPriority: "medium",
      answerProblem: "A agenda precisa de leitura rapida.",
      answerRecommendedAction: "Abra a agenda do dia.",
      answerSummary: "Camila lidera os encaixes de hoje.",
      answerSuggestion: "Use Camila para encaixe rapido.",
      answerTitle: "Mais horarios livres hoje",
      createdAt: "2026-05-12T20:00:00.000Z",
      id: "history-1",
      intent: "schedule_availability",
      model: "google/gemma-4-31b-it:free",
      promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
      promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
      question: "Qual profissional tem mais horarios livres hoje?",
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
        })),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/panel-assistant",
        {
          body: JSON.stringify({
            conversationId: "panel-ai-session-1",
            question: "Qual profissional tem mais horarios livres hoje?",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      answer: {
        actions: [
          {
            href: "/dashboard/gestao/agendamentos",
            kind: "primary",
            label: "Ver agenda",
          },
        ],
        bullets: ["Camila tem 4 horarios livres hoje."],
        ctaHref: "/dashboard/gestao/agendamentos",
        ctaLabel: "Abrir agenda",
        followUp: "Pergunte por um servico especifico para refinar.",
        impact: "A leitura agiliza o encaixe sem conflito.",
        intent: "schedule_availability",
        model: "google/gemma-4-31b-it:free",
        operationalContext: {
          cancellationsLast7d: 1,
          fitChanceLabel: "Alta",
          monthRevenueLabel: "R$ 960,00",
          operationalRiskLabel: "Medio",
          pendingAppointmentsCount: 2,
          summary:
            "Hoje voce esta com 4 atendimento(s), 2 confirmacao(oes) pendente(s), ocupacao de 42% amanha e R$ 960,00 concluidos no mes.",
          todayAppointmentsCount: 4,
          tomorrowOccupancyLabel: "42%",
          tomorrowOccupancyPercent: 42,
          tomorrowOpenSlotsCount: 3,
        },
        priority: "medium",
        problem: "A agenda precisa de leitura rapida.",
        recommendedAction: "Abra a agenda do dia.",
        suggestion: "Use Camila para encaixe rapido.",
        summary: "Camila lidera os encaixes de hoje.",
        title: "Mais horarios livres hoje",
      },
      historyItem: {
        actions: [
          {
            href: "/dashboard/gestao/agendamentos",
            kind: "primary",
            label: "Ver agenda",
          },
        ],
        answerBullets: ["Camila tem 4 horarios livres hoje."],
        answerCtaHref: "/dashboard/gestao/agendamentos",
        answerCtaLabel: "Abrir agenda",
        answerFollowUp: "Pergunte por um servico especifico para refinar.",
        answerImpact: "A leitura agiliza o encaixe sem conflito.",
        answerOperationalContext: {
          cancellationsLast7d: 1,
          fitChanceLabel: "Alta",
          monthRevenueLabel: "R$ 960,00",
          operationalRiskLabel: "Medio",
          pendingAppointmentsCount: 2,
          summary:
            "Hoje voce esta com 4 atendimento(s), 2 confirmacao(oes) pendente(s), ocupacao de 42% amanha e R$ 960,00 concluidos no mes.",
          todayAppointmentsCount: 4,
          tomorrowOccupancyLabel: "42%",
          tomorrowOccupancyPercent: 42,
          tomorrowOpenSlotsCount: 3,
        },
        answerPriority: "medium",
        answerProblem: "A agenda precisa de leitura rapida.",
        answerRecommendedAction: "Abra a agenda do dia.",
        answerSummary: "Camila lidera os encaixes de hoje.",
        answerSuggestion: "Use Camila para encaixe rapido.",
        answerTitle: "Mais horarios livres hoje",
        createdAt: "2026-05-12T20:00:00.000Z",
        id: "history-1",
        intent: "schedule_availability",
        model: "google/gemma-4-31b-it:free",
        promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
        promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
        question: "Qual profissional tem mais horarios livres hoje?",
      },
      ok: true,
    });
    expect(answerPanelAssistantPromptMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "panel-ai-session-1",
        question: "Qual profissional tem mais horarios livres hoje?",
        requestOrigin: "https://painel.jc7desenvovimento.online",
        salon: expect.objectContaining({
          id: "salon-1",
          name: "Studio Barber",
        }),
      }),
    );
    expect(savePanelAssistantHistoryMock).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: "panel-ai-session-1",
        question: "Qual profissional tem mais horarios livres hoje?",
        runtimeSupabase: expect.any(Object),
        salonId: "salon-1",
        userId: "user-1",
      }),
    );
  });

  it("returns 400 when the conversation id is invalid", async () => {
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
        })),
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/internal/ai/panel-assistant",
        {
          body: JSON.stringify({
            conversationId: "invalid id with spaces",
            question: "Qual profissional tem mais horarios livres hoje?",
          }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "invalid_request",
      ok: false,
    });
  });
});
