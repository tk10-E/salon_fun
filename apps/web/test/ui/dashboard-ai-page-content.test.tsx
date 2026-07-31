// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DashboardAiPageContent } from "@/app/dashboard/ai/_components";

describe("DashboardAiPageContent", () => {
  const observabilityFixture = {
    appliedFilters: {
      day: null,
      feature: null,
      model: "google/gemma-4-31b-it:free",
      outcome: null,
      periodDays: 30 as const,
      promptProfile: "panel-assistant-operational-premium",
      skillId: "schedule_availability",
    },
    breakdowns: {
      features: [
        {
          count: 3,
          failureCount: 0,
          fallbackCount: 0,
          key: "panel_assistant",
          label: "Assistente do painel",
          successCount: 3,
        },
      ],
      models: [
        {
          count: 3,
          failureCount: 0,
          fallbackCount: 0,
          key: "google/gemma-4-31b-it:free",
          label: "google/gemma-4-31b-it:free",
          successCount: 3,
        },
      ],
      skills: [
        {
          count: 3,
          failureCount: 0,
          fallbackCount: 0,
          key: "schedule_availability",
          label: "Agenda",
          successCount: 3,
        },
      ],
    },
    entries: [
      {
        createdAt: "2026-05-12T20:00:00.000Z",
        createdAtLabel: "12/05/2026 17:00",
        dayKey: "2026-05-12",
        eventType: "panel.ai_query",
        feature: "panel_assistant",
        featureLabel: "Assistente do painel",
        id: "obs-1",
        model: "google/gemma-4-31b-it:free",
        outcome: "answered" as const,
        outcomeLabel: "Respondido",
        policyVersion: "panel-ai-policy-2026-05-13",
        promptProfile: "panel-assistant-operational-premium",
        promptVersion: "2026-05-13",
        requestPath: "/api/internal/ai/panel-assistant",
        severity: "info" as const,
        skillId: "schedule_availability",
        skillLabel: "Agenda",
        summary: "Equipe principal lidera os horarios livres.",
        usedFallback: false,
      },
    ],
    options: {
      features: [
        {
          count: 3,
          label: "Assistente do painel",
          value: "panel_assistant",
        },
      ],
      models: [
        {
          count: 3,
          label: "google/gemma-4-31b-it:free",
          value: "google/gemma-4-31b-it:free",
        },
      ],
      outcomes: [
        {
          count: 3,
          label: "Respondido",
          value: "answered",
        },
      ],
      promptProfiles: [
        {
          count: 3,
          label: "panel-assistant-operational-premium",
          value: "panel-assistant-operational-premium",
        },
      ],
      skills: [
        {
          count: 3,
          label: "Agenda",
          value: "schedule_availability",
        },
      ],
    },
    totals: {
      fallbackCount: 0,
      failureCount: 0,
      filteredCount: 3,
      lastEventAt: "2026-05-12T20:00:00.000Z",
      successCount: 3,
      topFeatureLabel: "Assistente do painel",
      topModelLabel: "google/gemma-4-31b-it:free",
      topPromptLabel: "panel-assistant-operational-premium",
      topSkillLabel: "Agenda",
      totalEvents: 3,
      truncated: false,
    },
    trend: [
      {
        dayKey: "2026-05-11",
        dayLabel: "11/05",
        failureCount: 0,
        fallbackCount: 0,
        successCount: 1,
        totalCount: 1,
      },
      {
        dayKey: "2026-05-12",
        dayLabel: "12/05",
        failureCount: 0,
        fallbackCount: 0,
        successCount: 2,
        totalCount: 2,
      },
    ],
  };

  const historyFixture = [
    {
      actions: [
        {
          href: "/dashboard/gestao/agendamentos",
          kind: "primary" as const,
          label: "Ver agenda",
        },
      ],
      answerBullets: ["Equipe principal ainda tem 5 encaixes hoje."],
      answerCtaHref: "/dashboard/gestao/agendamentos",
      answerCtaLabel: "Abrir agenda",
      answerFollowUp: "Pergunte por um servico para filtrar melhor.",
      answerImpact: "A leitura agiliza encaixe e venda.",
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
      answerPriority: "medium" as const,
      answerProblem: "A agenda precisa de leitura rapida.",
      answerRecommendedAction: "Abra a agenda do dia.",
      answerSummary: "Equipe principal lidera os horarios livres.",
      answerSuggestion: "Use a equipe principal para encaixe rapido.",
      answerTitle: "Agenda livre hoje",
      createdAt: "2026-05-12T20:00:00.000Z",
      createdAtLabel: "12/05/2026 17:00",
      id: "history-1",
      intent: "schedule_availability",
      intentLabel: "Agenda",
      model: "google/gemma-4-31b-it:free",
      promptProfile: "panel-assistant-operational-premium",
      promptVersion: "2026-05-13",
      question: "Qual profissional tem mais horarios livres hoje?",
    },
  ];

  it("hides observability and technical traces in the default end-user view", () => {
    render(
      <DashboardAiPageContent
        aiEnabled
        metrics={{
          lastUsageLabel: "Ultima consulta: 12/05/2026 17:30",
          lastWeekCount: 4,
          topIntentLabel: "Agenda",
          totalCount: 7,
        }}
        history={historyFixture}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /ia para vender e responder rapido/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/7 leituras salvas/i)).toBeInTheDocument();
    expect(screen.getByText(/assunto mais pedido: agenda/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: /qual profissional tem mais horarios livres hoje/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /uso agregado da ia/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/ver trilha tecnica/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/leitura tecnica da ia/i),
    ).not.toBeInTheDocument();
  });

  it("renders observability and technical traces only in internal mode", () => {
    render(
      <DashboardAiPageContent
        aiEnabled
        metrics={{
          lastUsageLabel: "Ultima consulta: 12/05/2026 17:30",
          lastWeekCount: 4,
          topIntentLabel: "Agenda",
          totalCount: 7,
        }}
        observability={observabilityFixture}
        showInternalTools
        history={historyFixture}
      />,
    );

    expect(
      screen.getByRole("heading", { name: /uso agregado da ia/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/periodo: 30 dias/i)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /volume por dia/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /skills mais acionadas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /drill-down operacional/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /exportar csv/i }),
    ).toHaveAttribute(
      "href",
      expect.stringContaining("/dashboard/ai/export?period=30&debug=ai"),
    );
    expect(
      screen.getAllByText(/equipe principal lidera os horarios livres/i),
    ).not.toHaveLength(0);
    expect(screen.getByText(/ver trilha tecnica/i)).toBeInTheDocument();
    expect(screen.getByText(/leitura tecnica da ia/i)).toBeInTheDocument();
  });
});
