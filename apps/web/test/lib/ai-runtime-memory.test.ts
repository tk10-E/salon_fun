import { describe, expect, it } from "vitest";

import { persistPanelAssistantRuntimeTurn } from "@/lib/ai/runtime/memory";

function createRuntimeAdminRecorder() {
  const calls = {
    actionRows: null as unknown[] | null,
    conversationPayload: null as Record<string, unknown> | null,
    memoryRows: null as unknown[] | null,
    messagePayloads: [] as Record<string, unknown>[],
  };
  let insertedMessages = 0;

  return {
    admin: {
      from(table: string) {
        if (table === "ai_conversations") {
          return {
            upsert(payload: Record<string, unknown>) {
              calls.conversationPayload = payload;

              return {
                select() {
                  return {
                    single: async () => ({
                      data: { id: "conv-1" },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "ai_messages") {
          return {
            insert(payload: Record<string, unknown>) {
              calls.messagePayloads.push(payload);
              insertedMessages += 1;

              return {
                select() {
                  return {
                    single: async () => ({
                      data: { id: insertedMessages === 1 ? "msg-user" : "msg-assistant" },
                      error: null,
                    }),
                  };
                },
              };
            },
          };
        }

        if (table === "ai_actions") {
          return {
            insert: async (payload: unknown[]) => {
              calls.actionRows = payload;
              return { error: null };
            },
          };
        }

        if (table === "ai_memory") {
          return {
            upsert: async (payload: unknown[]) => {
              calls.memoryRows = payload;
              return { error: null };
            },
          };
        }

        throw new Error(`unexpected_table:${table}`);
      },
    },
    calls,
  };
}

describe("ai runtime persistence", () => {
  it("persists conversation, messages and suggested actions", async () => {
    const recorder = createRuntimeAdminRecorder();

    await persistPanelAssistantRuntimeTurn({
      admin: recorder.admin,
      answer: {
        actions: [
          {
            href: "/dashboard/gestao/agendamentos",
            kind: "primary",
            label: "Ver agenda",
          },
        ],
        bullets: ["Camila segura melhor os encaixes do fim da tarde."],
        ctaHref: "/dashboard/gestao/agendamentos",
        ctaLabel: "Abrir agenda",
        followUp: "Se quiser, eu monto a proxima abordagem.",
        impact: "A vaga tem boa chance de recuperacao.",
        intent: "vacancy_strategy",
        missingData: [],
        model: "google/gemma-4-31b-it:free",
        operationalContext: {
          cancellationsLast7d: 2,
          diagnoses: [],
          fitChanceLabel: "Alta",
          managerialScore: {
            cancellations: 74,
            occupancy: 58,
            overall: 67,
            productivity: 70,
            recurringCustomers: 62,
            revenue: 60,
            statusLabel: "Atencao operacional",
            vacancies: 78,
          },
          monthRevenueLabel: "R$ 1.240,00",
          operationalRiskLabel: "Medio",
          opportunities: [],
          pendingAppointmentsCount: 1,
          proactiveAlerts: [
            {
              actions: [
                {
                  href: "/dashboard/gestao/agendamentos/inteligente",
                  kind: "secondary",
                  label: "Sugerir encaixes",
                },
              ],
              code: "vacancies_today",
              headline: "Existem muitos horarios vagos no radar",
              prompt: "Quais horarios vazios devo atacar primeiro?",
              severity: "medium",
              summary: "4 horario(s) livre(s) com chance real de acao comercial.",
            },
          ],
          summary:
            "Hoje voce esta com 4 atendimento(s), 1 confirmacao(oes) pendente(s), ocupacao de 58% amanha e R$ 1.240,00 concluidos no mes.",
          todayAppointmentsCount: 4,
          tomorrowOccupancyLabel: "58%",
          tomorrowOccupancyPercent: 58,
          tomorrowOpenSlotsCount: 4,
        },
        priority: "medium",
        problem: "Existe uma janela aberta na agenda de hoje.",
        recommendedAction: "Acione primeiro as clientes com melhor fit.",
        runtime: {
          decisionMode: "guided_generation",
          memoryUsed: true,
          policyVersion: "panel-ai-policy-2026-05-13",
          provider: "openrouter",
          skillId: "vacancy_strategy",
          skillLabel: "Reencaixe",
        },
        suggestion: "Cruze historico recente com servico e profissional.",
        summary: "A vaga aberta de hoje pede contato certeiro, nao disparo generico.",
        title: "Vaga boa para reencaixe",
      },
      auditLogId: "audit-1",
      conversationId: "panel-ai-session-1",
      createdAt: "2026-05-14T18:00:00.000Z",
      question: "Quem posso chamar para uma vaga aberta hoje?",
      requestOrigin: "https://painel.salon.fun",
      salonId: "salon-1",
      userId: "user-1",
    });

    expect(recorder.calls.conversationPayload).toMatchObject({
      channel: "panel_assistant",
      conversation_key: "panel-ai-session-1",
      salon_id: "salon-1",
      status: "active",
      title: "Vaga boa para reencaixe",
    });
    expect(recorder.calls.messagePayloads).toHaveLength(2);
    expect(recorder.calls.messagePayloads[0]).toMatchObject({
      content: "Quem posso chamar para uma vaga aberta hoje?",
      role: "user",
    });
    expect(recorder.calls.messagePayloads[1]).toMatchObject({
      conversation_id: "conv-1",
      intent: "vacancy_strategy",
      role: "assistant",
    });
    expect(recorder.calls.actionRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: "Acione primeiro as clientes com melhor fit.",
          status: "suggested",
          type: "recommended_action",
        }),
        expect.objectContaining({
          label: "Score gerencial 67/100",
          status: "suggested",
          type: "managerial_score",
        }),
        expect.objectContaining({
          label: "Existem muitos horarios vagos no radar",
          status: "suggested",
          type: "proactive_alert",
        }),
        expect.objectContaining({
          label: "Ver agenda",
          status: "suggested",
          type: "quick_action",
        }),
      ]),
    );
    expect(recorder.calls.memoryRows).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          memory_key: "last_intent",
          scope: "long",
        }),
        expect.objectContaining({
          memory_key: "last_manager_briefing",
          scope: "long",
        }),
        expect.objectContaining({
          memory_key: "conversation:panel-ai-session-1",
          scope: "short",
        }),
      ]),
    );
  });

  it("does not break when the dedicated AI tables are not migrated yet", async () => {
    const admin = {
      from() {
        return {
          upsert() {
            return {
              select() {
                return {
                  single: async () => ({
                    data: null,
                    error: {
                      code: "42P01",
                      message: 'relation "ai_conversations" does not exist',
                    },
                  }),
                };
              },
            };
          },
        };
      },
    };

    await expect(
      persistPanelAssistantRuntimeTurn({
        admin,
        answer: {
          actions: [],
          bullets: [],
          ctaHref: null,
          ctaLabel: null,
          followUp: null,
          impact: null,
          intent: "schedule_availability",
          missingData: [],
          model: "google/gemma-4-31b-it:free",
          operationalContext: null,
          priority: "low",
          problem: null,
          recommendedAction: null,
          runtime: {
            decisionMode: "safe_fallback",
            memoryUsed: false,
            policyVersion: "panel-ai-policy-2026-05-13",
            provider: "deterministic",
            skillId: "schedule_availability",
            skillLabel: "Agenda",
          },
          suggestion: null,
          summary: "Sem dados suficientes.",
          title: "Resposta da Central IA",
        },
        createdAt: "2026-05-14T18:00:00.000Z",
        question: "Como esta minha agenda hoje?",
        salonId: "salon-1",
      }),
    ).resolves.toBeUndefined();
  });
});
