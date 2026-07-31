import { describe, expect, it } from "vitest";

import {
  AI_FEATURE_REGISTRY,
  getPanelAssistantAiMetadata,
} from "@/lib/ai/registry";
import {
  COPILOT_SYSTEM_PROMPT,
  PANEL_ASSISTANT_PROMPT_PROFILE,
  PANEL_ASSISTANT_PROMPT_VERSION,
  buildPanelAssistantSystemPrompt,
  buildPanelAssistantUserPrompt,
} from "@/lib/ai/prompts/copilotPrompt";
import {
  answerPanelAssistantPrompt,
  detectPanelAssistantIntent,
  listPanelAssistantHistory,
  savePanelAssistantHistory,
} from "@/lib/ai/panelAssistant";
import { getPanelAssistantSkill } from "@/lib/ai/skills/registry";

const PANEL_ASSISTANT_POLICY_VERSION =
  AI_FEATURE_REGISTRY.panelAssistant.policyVersion;
const PANEL_ASSISTANT_AI_METADATA = getPanelAssistantAiMetadata();

function createSupabaseMock(args?: {
  rpcResults?: Record<string, { data: unknown; error: Error | null }>;
  tables?: Record<
    string,
    {
      count?: number | null;
      data: unknown;
      error: Error | null;
    }
  >;
}) {
  const tables = args?.tables ?? {};
  const rpcResults = args?.rpcResults ?? {};

  return {
    from: (table: string) => {
      const result = tables[table] ?? {
        count: 0,
        data: [],
        error: null,
      };

      const query = {
        contains: () => query,
        eq: () => query,
        gte: () => query,
        ilike: () => query,
        in: () => query,
        limit: () => query,
        lt: () => query,
        maybeSingle: async () => ({ data: result.data }),
        order: () => query,
        select: () => query,
        single: async () => ({ data: result.data, error: result.error }),
        then: (resolve: (value: typeof result) => unknown) =>
          Promise.resolve(result).then(resolve),
      };

      return query;
    },
    rpc: async (name: string) =>
      rpcResults[name] ?? {
        data: [],
        error: null,
      },
  };
}

describe("panel assistant intent detection", () => {
  it("builds a premium copilot system prompt with skill specialization", () => {
    const prompt = buildPanelAssistantSystemPrompt({
      intent: "schedule_availability",
      skill: getPanelAssistantSkill("schedule_availability"),
      skillExamples: "Exemplo 1 - pergunta: Como esta sexta?",
    });

    expect(COPILOT_SYSTEM_PROMPT).toContain(
      "Voce e o Copiloto Operacional Inteligente de um SaaS para saloes",
    );
    expect(prompt).toContain("Especializacao ativa: agenda operacional de salao.");
    expect(prompt).toContain(
      "Nunca confirme encaixe, horario ou disponibilidade sem leitura real do backend.",
    );
    expect(prompt.toLowerCase()).toContain(
      "se nao houver dados suficientes, use a frase exata: nao encontrei dados suficientes para afirmar isso.",
    );
  });

  it("builds a contextual user prompt with memory, missing data and quick actions", () => {
    const prompt = buildPanelAssistantUserPrompt({
      base: {
        actions: [
          {
            href: "/dashboard/gestao/agendamentos",
            kind: "primary",
            label: "Ver agenda",
          },
        ],
        missingData: ["Atendimentos concluidos"],
      },
      intent: "finance_analysis",
      longMemory: {
        businessGoals: ["proteger faturamento", "preencher horarios vagos"],
        idealCustomerProfile: "cliente recorrente com manutencao mensal",
        preferredTone: "direto e consultivo",
        priorityProfessionals: ["Camila"],
        recentCampaigns: ["Resgate de sexta"],
        recentFocuses: ["proteger faturamento"],
        summary:
          "Tom preferido do salao: direto e consultivo. Metas declaradas: proteger faturamento, preencher horarios vagos. Servicos mais fortes: Corte premium.",
        topServices: ["Corte premium"],
      },
      memory: [
        {
          intent: "finance_analysis",
          question: "Meu faturamento caiu este mes?",
        },
      ],
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
      policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
      promptProfile: PANEL_ASSISTANT_PROMPT_PROFILE,
      promptVersion: PANEL_ASSISTANT_PROMPT_VERSION,
      question: "E amanha?",
      salonName: "Studio Barber",
      skill: getPanelAssistantSkill("finance_analysis"),
    });

    expect(prompt).toContain("Salao: Studio Barber");
    expect(prompt).toContain("Memoria curta: finance_analysis -> Meu faturamento caiu este mes?");
    expect(prompt).toContain("Memoria longa do salao: Tom preferido do salao: direto e consultivo.");
    expect(prompt).toContain("Dados ausentes declarados: Atendimentos concluidos");
    expect(prompt).toContain(
      `Prompt profile: ${PANEL_ASSISTANT_PROMPT_PROFILE}`,
    );
    expect(prompt).toContain(
      `Prompt version: ${PANEL_ASSISTANT_PROMPT_VERSION}`,
    );
    expect(prompt).toContain(
      "Acoes rapidas disponiveis: Ver agenda -> /dashboard/gestao/agendamentos (primary)",
    );
  });

  it("routes agenda prompts to availability", () => {
    expect(
      detectPanelAssistantIntent(
        "Qual profissional tem mais horarios livres hoje?",
      ),
    ).toBe("schedule_availability");
  });

  it("routes customer prompts to customer summary", () => {
    expect(detectPanelAssistantIntent("Cliente Ana")).toBe("customer_summary");
  });

  it("routes finance prompts to finance analysis", () => {
    expect(detectPanelAssistantIntent("Meu faturamento caiu este mes?")).toBe(
      "finance_analysis",
    );
  });

  it("routes promotion prompts to promotion strategy", () => {
    expect(
      detectPanelAssistantIntent(
        "Crie promocao para sexta-feira com baixo movimento.",
      ),
    ).toBe("promotion_strategy");
  });

  it("routes vacancy prompts to vacancy strategy", () => {
    expect(
      detectPanelAssistantIntent("Quem posso chamar para uma vaga aberta?"),
    ).toBe("vacancy_strategy");
  });

  it("routes recovery prompts to recovery campaign", () => {
    expect(
      detectPanelAssistantIntent("Preencher agenda com IA amanha"),
    ).toBe("recovery_campaign");
  });

  it("keeps short operational memory for follow-up questions", () => {
    expect(
      detectPanelAssistantIntent("E amanha?", [
        {
          intent: "schedule_availability",
          question: "Qual profissional tem mais horarios livres hoje?",
        },
      ]),
    ).toBe("schedule_availability");
  });

  it("routes movement prompts to movement forecast", () => {
    expect(
      detectPanelAssistantIntent("Qual dia da semana esta mais fraco?"),
    ).toBe("movement_forecast");
  });

  it("routes managerial score prompts to movement forecast", () => {
    expect(detectPanelAssistantIntent("Qual meu score gerencial hoje?")).toBe(
      "movement_forecast",
    );
  });

  it("routes broad operational prompts to movement forecast", () => {
    const questions = [
      "Como esta a operacao?",
      "Como esta meu salao hoje?",
      "Me da um resumo da operacao",
      "Faz uma leitura geral do salao",
      "Como esta o desempenho hoje?",
      "Me mostra o diagnostico do salao",
    ];

    for (const question of questions) {
      expect(detectPanelAssistantIntent(question)).toBe("movement_forecast");
    }
  });

  it("routes help prompts to panel help", () => {
    expect(detectPanelAssistantIntent("Como cadastrar comissao?")).toBe(
      "panel_help",
    );
  });

  it("keeps day reading prompts in the agenda skill", () => {
    expect(detectPanelAssistantIntent("Como está sexta?")).toBe(
      "schedule_availability",
    );
  });

  it("routes retention prompts to recovery campaign", () => {
    expect(
      detectPanelAssistantIntent("Quero melhorar retencao de clientes"),
    ).toBe("recovery_campaign");
  });

  it("keeps direct availability prompts in the agenda skill", () => {
    expect(detectPanelAssistantIntent("Qual horario disponivel hoje?")).toBe(
      "schedule_availability",
    );
  });

  it("routes service drop prompts to finance analysis", () => {
    expect(detectPanelAssistantIntent("Quais servicos estao em queda?")).toBe(
      "finance_analysis",
    );
  });

  it("keeps next week follow-ups in the previous intent", () => {
    expect(
      detectPanelAssistantIntent("E semana que vem?", [
        {
          intent: "schedule_availability",
          question: "Qual profissional tem mais horarios livres hoje?",
        },
      ]),
    ).toBe("schedule_availability");
  });

  it("returns transparent finance guidance when the tenant has no data", async () => {
    const supabase = createSupabaseMock({
      tables: {
        appointment_payments: { data: [], error: null },
        appointments: { count: 0, data: [], error: null },
        customers: { data: [], error: null },
        security_audit_logs: { data: [], error: null },
        services: { data: [], error: null },
        staff_members: { data: [], error: null },
      },
    });

    const answer = await answerPanelAssistantPrompt({
      question: "Meu faturamento caiu este mes?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answer.intent).toBe("finance_analysis");
    expect(answer.problem).toBe("Nao encontrei dados suficientes para afirmar isso.");
    expect(answer.summary).toBe("Nao encontrei dados suficientes para afirmar isso.");
    expect(answer.priority).toBe("low");
    expect(answer.actions.map((item) => item.label)).toContain("Ver faturamento");
    expect(answer.missingData).toContain("Atendimentos concluidos");
  });

  it("routes broad operational prompts through the managerial readout", async () => {
    const supabase = createSupabaseMock({
      tables: {
        appointment_payments: { data: [], error: null },
        appointments: { count: 0, data: [], error: null },
        customers: { data: [], error: null },
        security_audit_logs: { data: [], error: null },
        services: { data: [], error: null },
        staff_members: { data: [], error: null },
      },
    });

    const answer = await answerPanelAssistantPrompt({
      question: "Como esta a operacao?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answer.intent).toBe("movement_forecast");
    expect(answer.title).toBe("Diagnostico sem base suficiente");
    expect(answer.problem).toBe("Nao encontrei dados suficientes para afirmar isso.");
    expect(answer.impact).toContain("base minima");
    expect(answer.suggestion).toContain("cadastros");
    expect(answer.recommendedAction).toContain("Consolide agenda");
    expect(answer.actions.map((item) => item.label)).toEqual(
      expect.arrayContaining(["Ver agenda", "Ver faturamento"]),
    );
  });

  it("marks the answer as memory-backed when tenant long memory exists", async () => {
    const supabase = createSupabaseMock({
      tables: {
        ai_memory: {
          data: [
            {
              memory_key: "preferred_tone",
              memory_value: { value: "direto e consultivo" },
            },
          ],
          error: null,
        },
        ai_settings: {
          data: [
            {
              setting_key: "business_goals",
              setting_value: { values: ["proteger faturamento"] },
            },
          ],
          error: null,
        },
        appointment_payments: { data: [], error: null },
        appointments: { count: 0, data: [], error: null },
        customers: { data: [], error: null },
        salon_posts: { data: [], error: null },
        security_audit_logs: {
          data: [
            {
              created_at: "2026-05-14T12:00:00.000Z",
              event_type: "panel.ai_query",
              id: "history-1",
              metadata: {
                intent: "finance_analysis",
                question: "Meu faturamento caiu?",
              },
              target_type: "panel_ai_assistant",
            },
          ],
          error: null,
        },
        services: { data: [], error: null },
        staff_members: { data: [], error: null },
      },
    });

    const answer = await answerPanelAssistantPrompt({
      question: "Meu faturamento caiu este mes?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answer.runtime.memoryUsed).toBe(true);
    expect(answer.followUp).toContain("meta principal do salao");
  });

  it("adds direct client and campaign actions for customer summaries", async () => {
    const supabase = createSupabaseMock({
      tables: {
        ai_memory: { data: [], error: null },
        ai_settings: { data: [], error: null },
        appointments: {
          count: 1,
          data: [
            {
              completed_at: "2026-05-10T15:00:00.000Z",
              date: "2026-05-10T15:00:00.000Z",
              service_price_snapshot: 120,
              services: {
                category: "Cabelo",
                name: "Escova modelada",
                price: 120,
              },
              staff_members: {
                name: "Talita",
              },
              status: "completed",
            },
          ],
          error: null,
        },
        customers: {
          data: [
            {
              created_at: "2026-01-01T10:00:00.000Z",
              email: "ana@example.com",
              id: "customer-1",
              name: "Ana",
              phone: "11999999999",
            },
          ],
          error: null,
        },
        security_audit_logs: { data: [], error: null },
        services: { data: [], error: null },
        staff_members: { data: [], error: null },
      },
    });

    const answer = await answerPanelAssistantPrompt({
      question: "Cliente Ana",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answer.intent).toBe("customer_summary");
    expect(answer.actions.map((item) => item.label)).toEqual(
      expect.arrayContaining([
        "Abrir cliente",
        "Montar campanha de retorno",
      ]),
    );

    const openClientAction = answer.actions.find(
      (item) => item.label === "Abrir cliente",
    );
    const campaignAction = answer.actions.find(
      (item) => item.label === "Montar campanha de retorno",
    );

    expect(openClientAction?.href).toContain("/dashboard/gestao/clientes");
    expect(openClientAction?.href).toContain("clientId=customer-1");
    expect(campaignAction?.href).toContain("/dashboard/benefits/promotions?");
    expect(campaignAction?.href).toContain("compose=1");
    expect(campaignAction?.href).toContain("aiGoal=");
    expect(campaignAction?.href).toContain("Ana");
  });

  it("keeps agenda responses transparent when there are no open slots", async () => {
    const supabase = createSupabaseMock({
      rpcResults: {
        get_staff_schedule_context: {
          data: [
            {
              closes_at: "18:00",
              closes_at_utc: "2026-05-13T18:00:00.000Z",
              is_open: true,
              opens_at: "09:00",
              opens_at_utc: "2026-05-13T09:00:00.000Z",
              salon_id: "salon-1",
              staff_member_id: "staff-1",
              timezone: "America/Sao_Paulo",
            },
          ],
          error: null,
        },
      },
      tables: {
        appointment_payments: { data: [], error: null },
        appointments: {
          count: 1,
          data: [
            {
              completed_at: null,
              customer_id: "customer-1",
              date: "2026-05-13T09:00:00.000Z",
              ends_at: "2026-05-13T18:00:00.000Z",
              service_price_snapshot: 120,
              staff_member_id: "staff-1",
              status: "confirmed",
            },
          ],
          error: null,
        },
        customers: { data: [], error: null },
        security_audit_logs: { data: [], error: null },
        services: { data: [], error: null },
        staff_members: {
          data: [{ id: "staff-1", is_active: true, name: "Camila" }],
          error: null,
        },
      },
    });

    const answer = await answerPanelAssistantPrompt({
      question: "Qual profissional tem mais horarios livres hoje?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answer.intent).toBe("schedule_availability");
    expect(answer.title).toBe("Agenda bem ocupada");
    expect(answer.actions.map((item) => item.label)).toContain("Ver horarios vagos");
    expect(answer.summary.toLowerCase()).toContain("sem espaco livre");
  });

  it("uses short memory for follow-up answers", async () => {
    const supabase = createSupabaseMock({
      tables: {
        appointment_payments: { data: [], error: null },
        appointments: { count: 0, data: [], error: null },
        customers: { data: [], error: null },
        security_audit_logs: {
          data: [
            {
              created_at: "2026-05-12T20:00:00.000Z",
              event_type: "panel.ai_query",
              id: "history-1",
              metadata: {
                answerBullets: [],
                answerMissingData: [],
                answerSummary: "Camila lidera os horarios livres.",
                answerTitle: "Mais horarios livres hoje",
                intent: "schedule_availability",
                question: "Qual profissional tem mais horarios livres hoje?",
              },
              target_type: "panel_ai_assistant",
            },
          ],
          error: null,
        },
        services: { data: [], error: null },
        staff_members: { data: [], error: null },
      },
    });

    const answer = await answerPanelAssistantPrompt({
      question: "E amanha?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answer.intent).toBe("schedule_availability");
    expect(answer.runtime.memoryUsed).toBe(true);
  });

  it("keeps short memory isolated by conversation id", async () => {
    const supabase = createSupabaseMock({
      tables: {
        appointment_payments: { data: [], error: null },
        appointments: { count: 0, data: [], error: null },
        customers: { data: [], error: null },
        security_audit_logs: {
          data: [
            {
              created_at: "2026-05-12T20:05:00.000Z",
              event_type: "panel.ai_query",
              id: "history-2",
              metadata: {
                answerBullets: [],
                answerMissingData: [],
                answerSummary: "Camila lidera os horarios livres.",
                answerTitle: "Mais horarios livres hoje",
                conversationId: "panel-ai-b",
                intent: "schedule_availability",
                question: "Qual profissional tem mais horarios livres hoje?",
              },
              target_type: "panel_ai_assistant",
            },
            {
              created_at: "2026-05-12T20:00:00.000Z",
              event_type: "panel.ai_query",
              id: "history-1",
              metadata: {
                answerBullets: [],
                answerMissingData: [],
                answerSummary: "Selecione clientes para reencaixe.",
                answerTitle: "Reencaixe da vaga aberta",
                conversationId: "panel-ai-a",
                intent: "vacancy_strategy",
                question: "Quem posso chamar para uma vaga aberta?",
              },
              target_type: "panel_ai_assistant",
            },
          ],
          error: null,
        },
        services: { data: [], error: null },
        staff_members: { data: [], error: null },
      },
    });

    const answerA = await answerPanelAssistantPrompt({
      conversationId: "panel-ai-a",
      question: "E amanha?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    const answerB = await answerPanelAssistantPrompt({
      conversationId: "panel-ai-b",
      question: "E amanha?",
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
      supabase,
    });

    expect(answerA.intent).toBe("vacancy_strategy");
    expect(answerA.runtime.memoryUsed).toBe(true);
    expect(answerB.intent).toBe("schedule_availability");
    expect(answerB.runtime.memoryUsed).toBe(true);
  });

  it("reads assistant history from security audit logs", async () => {
    const limit = async () => ({
      data: [
        {
          created_at: "2026-05-12T20:00:00.000Z",
          event_type: "panel.ai_query",
          id: "history-1",
          metadata: {
            actions: [
              {
                href: "/dashboard/gestao/agendamentos",
                kind: "primary",
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
            answerPriority: "medium",
            answerProblem: "A agenda precisa de leitura rapida.",
            answerRecommendedAction: "Abra a agenda do dia.",
            answerRuntime: {
              decisionMode: "guided_generation",
              policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
              provider: "openrouter",
              skillId: "schedule_availability",
              skillLabel: "Agenda",
            },
            answerSummary: "Equipe principal lidera os horarios livres.",
            answerSuggestion: "Use a equipe principal para encaixe rapido.",
            answerTitle: "Agenda livre hoje",
            decisionMode: "guided_generation",
            intent: "schedule_availability",
            model: "google/gemma-4-31b-it:free",
            policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
            promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
            promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
            provider: "openrouter",
            question: "Qual profissional tem mais horarios livres hoje?",
            skillId: "schedule_availability",
            skillLabel: "Agenda",
          },
          target_type: "panel_ai_assistant",
        },
      ],
      error: null,
    });
    const order = () => ({ limit });
    const eqTargetType = () => ({ eq: () => ({ order }) });
    const eqEventType = () => ({ eq: eqTargetType });
    const admin = {
      from: () => ({
        select: () => ({
          eq: eqEventType,
        }),
      }),
    };

    const history = await listPanelAssistantHistory({
      admin,
      salonId: "salon-1",
    });

    expect(history).toEqual([
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            href: "/dashboard/gestao/agendamentos",
            label: "Ver agenda",
          }),
        ],
        answerSummary: "Equipe principal lidera os horarios livres.",
        answerTitle: "Agenda livre hoje",
        id: "history-1",
        intent: "schedule_availability",
        promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
        promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
        question: "Qual profissional tem mais horarios livres hoje?",
        runtime: expect.objectContaining({
          decisionMode: "guided_generation",
          policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
          provider: "openrouter",
          skillId: "schedule_availability",
          skillLabel: "Agenda",
        }),
      }),
    ]);
  });

  it("saves assistant history into security audit logs", async () => {
    const single = async () => ({
      data: {
        created_at: "2026-05-12T20:00:00.000Z",
        event_type: "panel.ai_query",
        id: "history-1",
          metadata: {
            actions: [
              {
                href: "/dashboard/gestao/agendamentos",
                kind: "primary",
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
            answerPriority: "medium",
            answerProblem: "A agenda precisa de leitura rapida.",
            answerRecommendedAction: "Abra a agenda do dia.",
            answerRuntime: {
              decisionMode: "guided_generation",
              policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
              provider: "openrouter",
              skillId: "schedule_availability",
              skillLabel: "Agenda",
            },
            answerSummary: "Equipe principal lidera os horarios livres.",
            answerSuggestion: "Use a equipe principal para encaixe rapido.",
            answerTitle: "Agenda livre hoje",
            decisionMode: "guided_generation",
            intent: "schedule_availability",
            model: "google/gemma-4-31b-it:free",
            policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
            promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
            promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
            provider: "openrouter",
          question: "Qual profissional tem mais horarios livres hoje?",
            skillId: "schedule_availability",
            skillLabel: "Agenda",
        },
        target_type: "panel_ai_assistant",
      },
      error: null,
    });
    const select = () => ({ single });
    const insert = (payload: unknown) => ({
      select: () => {
        expect(payload).toEqual(
          expect.objectContaining({
            actor_user_id: "user-1",
            event_type: "panel.ai_query",
            metadata: expect.objectContaining({
              conversationId: "panel-ai-session-1",
              feature: PANEL_ASSISTANT_AI_METADATA.feature,
              promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
              promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
            }),
            salon_id: "salon-1",
            severity: "info",
            target_type: "panel_ai_assistant",
          }),
        );
        return select();
      },
    });
    const admin = {
      from: () => ({
        insert,
      }),
    };

    const historyItem = await savePanelAssistantHistory({
      admin,
      answer: {
        actions: [
          {
            href: "/dashboard/gestao/agendamentos",
            kind: "primary",
            label: "Ver agenda",
          },
        ],
        bullets: ["Equipe principal ainda tem 5 encaixes hoje."],
        ctaHref: "/dashboard/gestao/agendamentos",
        ctaLabel: "Abrir agenda",
        followUp: "Pergunte por um servico para filtrar melhor.",
        impact: "A leitura agiliza encaixe e venda.",
        intent: "schedule_availability",
        missingData: [],
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
        runtime: {
          decisionMode: "guided_generation",
          policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
          provider: "openrouter",
          skillId: "schedule_availability",
          skillLabel: "Agenda",
        },
        suggestion: "Use a equipe principal para encaixe rapido.",
        summary: "Equipe principal lidera os horarios livres.",
        title: "Agenda livre hoje",
      },
      conversationId: "panel-ai-session-1",
      question: "Qual profissional tem mais horarios livres hoje?",
      requestPath: "/dashboard/ai",
      requestOrigin: "https://painel.jc7desenvovimento.online",
      salonId: "salon-1",
      userId: "user-1",
      userAgent: "Vitest",
    });

    expect(historyItem).toEqual(
      expect.objectContaining({
        actions: [
          expect.objectContaining({
            href: "/dashboard/gestao/agendamentos",
            label: "Ver agenda",
          }),
        ],
        answerCtaHref: "/dashboard/gestao/agendamentos",
        answerSummary: "Equipe principal lidera os horarios livres.",
        answerTitle: "Agenda livre hoje",
        id: "history-1",
        promptProfile: PANEL_ASSISTANT_AI_METADATA.promptProfile,
        promptVersion: PANEL_ASSISTANT_AI_METADATA.promptVersion,
        runtime: expect.objectContaining({
          decisionMode: "guided_generation",
          policyVersion: PANEL_ASSISTANT_POLICY_VERSION,
          provider: "openrouter",
          skillId: "schedule_availability",
          skillLabel: "Agenda",
        }),
      }),
    );
  });
});
