import { beforeEach, describe, expect, it, vi } from "vitest";

const { executePanelAssistantToolMock } = vi.hoisted(() => ({
  executePanelAssistantToolMock: vi.fn(),
}));

vi.mock("@/lib/ai/runtime/executor", () => ({
  executePanelAssistantTool: executePanelAssistantToolMock,
}));

import {
  buildOperationalManagerialReadout,
  evaluateOperationalIntelligenceSnapshot,
} from "@/lib/ai/runtime/operationalIntelligence";

const NOW = new Date("2026-05-14T15:00:00.000Z");

describe("operational intelligence snapshot", () => {
  it("detects diagnoses, opportunities, score and proactive alerts from real signals", () => {
    const report = evaluateOperationalIntelligenceSnapshot(
      {
        activeServices: [
          {
            category: "Corte",
            duration: 45,
            id: "service-1",
            name: "Corte premium",
            price: 120,
          },
          {
            category: "Coloracao",
            duration: 90,
            id: "service-2",
            name: "Luzes",
            price: 260,
          },
          {
            category: "Barba",
            duration: 30,
            id: "service-3",
            name: "Barba",
            price: 60,
          },
        ],
        cancellationsLast7d: 5,
        financeAppointments: [
          {
            completed_at: "2026-05-13T12:00:00.000Z",
            customer_id: "customer-1",
            date: "2026-05-13T10:00:00.000Z",
            service_id: "service-1",
            service_price_snapshot: 120,
            services: {
              category: "Corte",
              name: "Corte premium",
              price: 120,
            },
            staff_member_id: "staff-1",
          },
          {
            completed_at: "2026-05-12T15:00:00.000Z",
            customer_id: "customer-1",
            date: "2026-05-12T13:00:00.000Z",
            service_id: "service-1",
            service_price_snapshot: 120,
            services: {
              category: "Corte",
              name: "Corte premium",
              price: 120,
            },
            staff_member_id: "staff-1",
          },
          {
            completed_at: "2026-05-09T12:00:00.000Z",
            customer_id: "customer-2",
            date: "2026-05-09T11:00:00.000Z",
            service_id: "service-3",
            service_price_snapshot: 60,
            services: {
              category: "Barba",
              name: "Barba",
              price: 60,
            },
            staff_member_id: "staff-2",
          },
          {
            completed_at: "2026-05-05T12:00:00.000Z",
            customer_id: "customer-3",
            date: "2026-05-05T10:00:00.000Z",
            service_id: "service-2",
            service_price_snapshot: 260,
            services: {
              category: "Coloracao",
              name: "Luzes",
              price: 260,
            },
            staff_member_id: "staff-2",
          },
          {
            completed_at: "2026-05-03T12:00:00.000Z",
            customer_id: "customer-4",
            date: "2026-05-03T10:00:00.000Z",
            service_id: "service-2",
            service_price_snapshot: 260,
            services: {
              category: "Coloracao",
              name: "Luzes",
              price: 260,
            },
            staff_member_id: "staff-2",
          },
        ],
        inactiveCustomers: [
          {
            completedVisits: 3,
            created_at: "2026-01-01T12:00:00.000Z",
            daysSinceLastVisit: 80,
            email: "ana@example.com",
            id: "customer-10",
            lastVisitAt: "2026-02-24T12:00:00.000Z",
            name: "Ana",
            phone: "11999999999",
            totalSpent: 420,
          },
          {
            completedVisits: 2,
            created_at: "2026-01-02T12:00:00.000Z",
            daysSinceLastVisit: 92,
            email: "bia@example.com",
            id: "customer-11",
            lastVisitAt: "2026-02-12T12:00:00.000Z",
            name: "Bia",
            phone: "11888888888",
            totalSpent: 260,
          },
          {
            completedVisits: 4,
            created_at: "2026-01-03T12:00:00.000Z",
            daysSinceLastVisit: 67,
            email: "carla@example.com",
            id: "customer-12",
            lastVisitAt: "2026-03-08T12:00:00.000Z",
            name: "Carla",
            phone: "11777777777",
            totalSpent: 580,
          },
          {
            completedVisits: 2,
            created_at: "2026-01-04T12:00:00.000Z",
            daysSinceLastVisit: 70,
            email: "dani@example.com",
            id: "customer-13",
            lastVisitAt: "2026-03-05T12:00:00.000Z",
            name: "Dani",
            phone: "11666666666",
            totalSpent: 310,
          },
          {
            completedVisits: 5,
            created_at: "2026-01-05T12:00:00.000Z",
            daysSinceLastVisit: 95,
            email: "eva@example.com",
            id: "customer-14",
            lastVisitAt: "2026-02-09T12:00:00.000Z",
            name: "Eva",
            phone: "11555555555",
            totalSpent: 690,
          },
        ],
        operationalContext: {
          cancellationsLast7d: 5,
          fitChanceLabel: "Alta",
          monthRevenueLabel: "R$ 2.180,00",
          operationalRiskLabel: "Alto",
          pendingAppointmentsCount: 3,
          summary:
            "Hoje voce esta com 5 atendimento(s), 3 confirmacao(oes) pendente(s), ocupacao de 28% amanha e R$ 2.180,00 concluidos no mes.",
          todayAppointmentsCount: 5,
          tomorrowOccupancyLabel: "28%",
          tomorrowOccupancyPercent: 28,
          tomorrowOpenSlotsCount: 6,
        },
        recoveryOpportunity: {
          available: true,
          candidates: [
            {
              avgTicketLabel: "R$ 140,00",
              chanceLabel: "Alta",
              customerId: "customer-10",
              daysSinceLastVisitLabel: "80 dias",
              name: "Ana",
              reasonLabel: "voltava a cada 30 dias",
              score: 92,
            },
            {
              avgTicketLabel: "R$ 130,00",
              chanceLabel: "Alta",
              customerId: "customer-11",
              daysSinceLastVisitLabel: "92 dias",
              name: "Bia",
              reasonLabel: "respondia a campanha de quinta",
              score: 88,
            },
          ],
          ctaHref: "/dashboard/gestao/agendamentos/inteligente?focus=fit",
          ctaLabel: "Sugerir encaixes",
          draft: null,
          followUp: "Se quiser, eu monto a campanha na sequencia.",
          snapshot: {
            available: true,
            candidateCount: 2,
            dayLabel: "sexta-feira, 15/05",
            headline: "Amanha existe janela com boa chance de preenchimento",
            highChanceCount: 2,
            openSlotsCount: 6,
            serviceName: "Corte premium",
            staffName: "Camila",
            summary: "Existe janela de agenda relevante para agir.",
            topChanceLabel: "Alta",
            windowLabel: "14:00 as 17:00",
          },
        },
        staffMembers: [
          { id: "staff-1", is_active: true, name: "Camila" },
          { id: "staff-2", is_active: true, name: "Julia" },
          { id: "staff-3", is_active: true, name: "Marina" },
        ],
      },
      NOW,
    );

    expect(report.score?.overall).toBeGreaterThanOrEqual(0);
    expect(report.score?.overall).toBeLessThanOrEqual(100);
    expect(report.diagnoses.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "low_occupancy",
        "revenue_drop",
        "high_cancellations",
        "high_vacancy_load",
        "inactive_customers",
        "idle_professionals",
        "low_demand_services",
      ]),
    );
    expect(report.opportunities.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "campaign_for_vacancies",
        "reactivation",
        "combo_offer",
        "smart_fit",
        "fill_focus",
        "professional_recovery",
      ]),
    );
    expect(report.proactiveAlerts.map((item) => item.code)).toEqual(
      expect.arrayContaining([
        "low_occupancy_tomorrow",
        "campaign_candidates",
        "revenue_drop_recent",
        "vacancies_today",
      ]),
    );
  });

  it("stays transparent when there is not enough data for a reliable read", () => {
    const report = evaluateOperationalIntelligenceSnapshot(
      {
        activeServices: [],
        cancellationsLast7d: 0,
        financeAppointments: [],
        inactiveCustomers: [],
        operationalContext: null,
        recoveryOpportunity: {
          available: false,
          candidates: [],
          ctaHref: null,
          ctaLabel: null,
          draft: null,
          followUp: null,
          snapshot: {
            available: false,
            candidateCount: 0,
            dayLabel: null,
            headline: "Sem leitura suficiente",
            highChanceCount: 0,
            openSlotsCount: 0,
            serviceName: null,
            staffName: null,
            summary: "Sem leitura suficiente",
            topChanceLabel: null,
            windowLabel: null,
          },
        },
        staffMembers: [],
      },
      NOW,
    );

    expect(report.score).toBeNull();
    expect(report.diagnoses).toEqual([]);
    expect(report.opportunities).toEqual([]);
    expect(report.proactiveAlerts).toEqual([]);
    expect(report.missingData).toEqual(
      expect.arrayContaining([
        "Historico financeiro recente",
        "Servicos ativos",
        "Equipe ativa",
      ]),
    );
  });

  it("does not invent vacancy, staff or service diagnoses without observed base", () => {
    const report = evaluateOperationalIntelligenceSnapshot(
      {
        activeServices: [
          {
            category: "Corte",
            duration: 45,
            id: "service-1",
            name: "Corte premium",
            price: 120,
          },
        ],
        cancellationsLast7d: 0,
        financeAppointments: [],
        inactiveCustomers: [],
        operationalContext: {
          cancellationsLast7d: 0,
          fitChanceLabel: "Baixa",
          monthRevenueLabel: "R$ 0,00",
          operationalRiskLabel: "Moderado",
          pendingAppointmentsCount: 0,
          summary: "Leitura parcial da operacao.",
          todayAppointmentsCount: 0,
          tomorrowOccupancyLabel: "Sem leitura",
          tomorrowOccupancyPercent: null,
          tomorrowOpenSlotsCount: 6,
        },
        recoveryOpportunity: {
          available: false,
          candidates: [],
          ctaHref: null,
          ctaLabel: null,
          draft: null,
          followUp: null,
          snapshot: {
            available: false,
            candidateCount: 0,
            dayLabel: "sexta-feira, 15/05",
            headline: "Sem leitura suficiente",
            highChanceCount: 0,
            openSlotsCount: 0,
            serviceName: null,
            staffName: null,
            summary: "Sem leitura suficiente",
            topChanceLabel: null,
            windowLabel: null,
          },
        },
        staffMembers: [
          { id: "staff-1", is_active: true, name: "Camila" },
          { id: "staff-2", is_active: true, name: "Julia" },
        ],
      },
      NOW,
    );

    expect(report.score).toBeNull();
    expect(report.diagnoses.map((item) => item.code)).not.toEqual(
      expect.arrayContaining([
        "high_vacancy_load",
        "idle_professionals",
        "low_demand_services",
      ]),
    );
    expect(report.opportunities.map((item) => item.code)).not.toEqual(
      expect.arrayContaining(["campaign_for_vacancies", "professional_recovery"]),
    );
    expect(report.proactiveAlerts.map((item) => item.code)).not.toEqual(
      expect.arrayContaining(["vacancies_today", "idle_professional"]),
    );
    expect(report.missingData).toContain("Historico financeiro recente");
  });

  it("requires at least two grounded metrics before generating the managerial score", () => {
    const report = evaluateOperationalIntelligenceSnapshot(
      {
        activeServices: [],
        cancellationsLast7d: 0,
        financeAppointments: [],
        inactiveCustomers: [],
        operationalContext: {
          cancellationsLast7d: 0,
          fitChanceLabel: "Media",
          monthRevenueLabel: "R$ 0,00",
          operationalRiskLabel: "Baixo",
          pendingAppointmentsCount: 0,
          summary: "Amanha com agenda aberta.",
          todayAppointmentsCount: 0,
          tomorrowOccupancyLabel: "62%",
          tomorrowOccupancyPercent: 62,
          tomorrowOpenSlotsCount: 0,
        },
        recoveryOpportunity: {
          available: false,
          candidates: [],
          ctaHref: null,
          ctaLabel: null,
          draft: null,
          followUp: null,
          snapshot: {
            available: false,
            candidateCount: 0,
            dayLabel: "sexta-feira, 15/05",
            headline: "Sem leitura suficiente",
            highChanceCount: 0,
            openSlotsCount: 0,
            serviceName: null,
            staffName: null,
            summary: "Sem leitura suficiente",
            topChanceLabel: null,
            windowLabel: null,
          },
        },
        staffMembers: [],
      },
      NOW,
    );

    expect(report.score).not.toBeNull();
    expect(report.score?.occupancy).toBe(68);
    expect(report.score?.vacancies).toBe(100);
    expect(report.score?.overall).toBe(82);
    expect(report.score?.statusLabel).toBe("Saudavel com ajustes");
  });
});

describe("operational managerial readout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses the logged tenant context in every tool call and avoids inventing conclusions", async () => {
    const calls: Array<{ salon: { id: string }; toolId: string }> = [];

    executePanelAssistantToolMock.mockImplementation(async (args: any) => {
      calls.push({
        salon: args.salon,
        toolId: args.toolId,
      });

      switch (args.toolId) {
        case "getAgenda":
          return {
            appointments: [],
            dayKey: "2026-05-14",
            services: [],
            staffMembers: [],
          };
        case "getClientesInativos":
          return { customers: [] };
        case "getFaturamento":
          return { appointments: [], payments: [] };
        case "getCancelamentos":
          return { cancellations: [] };
        case "sugerirEncaixes":
          return {
            available: false,
            candidates: [],
            ctaHref: null,
            ctaLabel: null,
            draft: null,
            followUp: null,
            snapshot: {
              available: false,
              candidateCount: 0,
              dayLabel: null,
              headline: "Sem leitura suficiente",
              highChanceCount: 0,
              openSlotsCount: 0,
              serviceName: null,
              staffName: null,
              summary: "Sem leitura suficiente",
              topChanceLabel: null,
              windowLabel: null,
            },
          };
        default:
          throw new Error(`unexpected_tool:${args.toolId}`);
      }
    });

    const readout = await buildOperationalManagerialReadout({
      conversationId: "panel-ai-session-1",
      now: NOW,
      permissions: ["panel_owner"],
      question: "Como esta a operacao?",
      requestOrigin: "https://painel.salon.fun",
      salon: {
        id: "salon-tenant-a",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase: {},
      userId: "user-1",
    } as any);

    expect(executePanelAssistantToolMock).toHaveBeenCalledTimes(5);
    expect(calls.every((item) => item.salon.id === "salon-tenant-a")).toBe(true);
    expect(readout.problem).toBe("Nao encontrei dados suficientes para afirmar isso.");
    expect(readout.summary).toBe("Nao encontrei dados suficientes para afirmar isso.");
    expect(readout.missingData).toEqual(
      expect.arrayContaining([
        "Historico financeiro recente",
        "Servicos ativos",
        "Equipe ativa",
      ]),
    );
    expect(readout.report.diagnoses).toEqual([]);
    expect(readout.report.proactiveAlerts).toEqual([]);
  });
});
