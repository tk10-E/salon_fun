import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { executePanelAssistantTool } from "@/lib/ai/runtime/executor";

function createLogAdmin() {
  const inserts: Record<string, unknown>[] = [];

  return {
    admin: {
      from(table: string) {
        if (table !== "ai_tool_logs") {
          throw new Error(`unexpected_admin_table:${table}`);
        }

        return {
          insert: async (payload: Record<string, unknown>) => {
            inserts.push(payload);
            return { error: null };
          },
        };
      },
    },
    inserts,
  };
}

function createToolLogFallbackClient(inserts: Record<string, unknown>[]) {
  return {
    from(table: string) {
      if (table !== "ai_tool_logs") {
        throw new Error(`unexpected_fallback_table:${table}`);
      }

      return {
        insert: async (payload: Record<string, unknown>) => {
          inserts.push(payload);
          return { error: null };
        },
      };
    },
  };
}

function withToolLogCapture<T extends { from(table: string): unknown }>(base: T) {
  const inserts: Record<string, unknown>[] = [];
  const fallbackClient = createToolLogFallbackClient(inserts);

  return {
    inserts,
    supabase: {
      from(table: string) {
        if (table === "ai_tool_logs") {
          return fallbackClient.from(table);
        }

        return base.from(table);
      },
    },
  };
}

function createFinanceSupabaseMock() {
  return {
    from(table: string) {
      const result =
        table === "appointments"
          ? {
              data: [
                {
                  completed_at: "2026-05-14T12:00:00.000Z",
                  date: "2026-05-14T10:00:00.000Z",
                  service_price_snapshot: 120,
                  services: {
                    category: "Corte",
                    name: "Corte masculino",
                    price: 120,
                  },
                },
              ],
              error: null,
            }
          : table === "appointment_payments"
            ? {
                data: [
                  {
                    amount: 120,
                    paid_at: "2026-05-14T12:10:00.000Z",
                  },
                ],
                error: null,
              }
            : { data: [], error: null };

      const query = {
        eq: () => query,
        gte: () => query,
        limit: async () => result,
        lt: () => query,
        order: () => query,
        select: () => query,
      };

      return query;
    },
  };
}

function createCustomerSummarySupabaseMock() {
  return {
    from(table: string) {
      const result =
        table === "customers"
          ? {
              data: [
                {
                  created_at: "2026-04-01T12:00:00.000Z",
                  email: "ana@example.com",
                  id: "customer-1",
                  name: "Ana Silva",
                  phone: "11999999999",
                },
              ],
              error: null,
            }
          : table === "appointments"
            ? {
                data: [
                  {
                    completed_at: "2026-05-10T12:00:00.000Z",
                    date: "2026-05-10T10:00:00.000Z",
                    service_price_snapshot: 150,
                    services: {
                      category: "Coloracao",
                      name: "Luzes",
                      price: 150,
                    },
                    staff_members: {
                      name: "Camila",
                    },
                    status: "completed",
                  },
                ],
                error: null,
              }
            : { data: [], error: null };

      const query = {
        eq: () => query,
        ilike: () => query,
        limit: async () => result,
        order: () => query,
        select: () => query,
      };

      return query;
    },
  };
}

describe("ai runtime executor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("executes getFaturamento and writes a succeeded tool log", async () => {
    const logger = withToolLogCapture(createFinanceSupabaseMock());

    const result = await executePanelAssistantTool({
      actorUserId: "user-1",
      conversationId: "panel-ai-session-1",
      input: {
        periodEnd: "2026-06-01T00:00:00.000Z",
        periodStart: "2026-05-01T00:00:00.000Z",
        previousPeriodEnd: "2026-05-01T00:00:00.000Z",
        previousPeriodStart: "2026-04-01T00:00:00.000Z",
      },
      permissions: ["panel_owner"],
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        timezone: "America/Sao_Paulo",
      },
      supabase: logger.supabase,
      toolId: "getFaturamento",
    });

    expect(result.appointments).toHaveLength(1);
    expect(result.payments).toHaveLength(1);
    expect(logger.inserts).toEqual([
      expect.objectContaining({
        actor_user_id: "user-1",
        salon_id: "salon-1",
        status: "succeeded",
        tool_id: "getFaturamento",
        tool_label: "Faturamento",
      }),
    ]);
  });

  it("blocks a tool when the current permissions do not allow it", async () => {
    const logger = withToolLogCapture(createFinanceSupabaseMock());

    await expect(
      executePanelAssistantTool({
        actorUserId: "user-1",
        conversationId: "panel-ai-session-1",
        input: {
          periodEnd: "2026-06-01T00:00:00.000Z",
          periodStart: "2026-05-01T00:00:00.000Z",
        },
        permissions: ["customers.read"],
        salon: {
          id: "salon-1",
          name: "Studio Barber",
          timezone: "America/Sao_Paulo",
        },
        supabase: logger.supabase,
        toolId: "getFaturamento",
      }),
    ).rejects.toThrow("ai_tool_forbidden");

    expect(logger.inserts).toEqual([
      expect.objectContaining({
        status: "blocked",
        tool_id: "getFaturamento",
      }),
    ]);
  });

  it("loads customer summary context and writes the tool log", async () => {
    const logger = withToolLogCapture(createCustomerSummarySupabaseMock());

    const result = await executePanelAssistantTool({
      actorUserId: "user-1",
      conversationId: "panel-ai-session-1",
      input: {
        searchTerm: "Ana",
      },
      permissions: ["customers.read"],
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        timezone: "America/Sao_Paulo",
      },
      supabase: logger.supabase,
      toolId: "getCustomerSummary",
    });

    expect(result.customer).toMatchObject({
      id: "customer-1",
      name: "Ana Silva",
    });
    expect(result.appointments).toHaveLength(1);
    expect(logger.inserts).toEqual([
      expect.objectContaining({
        salon_id: "salon-1",
        status: "succeeded",
        tool_id: "getCustomerSummary",
        tool_label: "Resumo da cliente",
      }),
    ]);
  });

  it("falls back to the caller supabase client when the admin logger is unavailable", async () => {
    const inserts: Record<string, unknown>[] = [];
    createAdminClientMock.mockImplementation(() => {
      throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY.");
    });

    const querySupabase = createFinanceSupabaseMock();
    const fallbackClient = createToolLogFallbackClient(inserts);
    const supabase = {
      from(table: string) {
        if (table === "ai_tool_logs") {
          return fallbackClient.from(table);
        }

        return querySupabase.from(table);
      },
    };

    const result = await executePanelAssistantTool({
      actorUserId: "user-1",
      conversationId: "panel-ai-session-1",
      input: {
        periodEnd: "2026-06-01T00:00:00.000Z",
        periodStart: "2026-05-01T00:00:00.000Z",
        previousPeriodEnd: "2026-05-01T00:00:00.000Z",
        previousPeriodStart: "2026-04-01T00:00:00.000Z",
      },
      permissions: ["panel_owner"],
      salon: {
        id: "salon-1",
        name: "Studio Barber",
        timezone: "America/Sao_Paulo",
      },
      supabase,
      toolId: "getFaturamento",
    });

    expect(result.appointments).toHaveLength(1);
    expect(inserts).toEqual([
      expect.objectContaining({
        actor_user_id: "user-1",
        salon_id: "salon-1",
        status: "succeeded",
        tool_id: "getFaturamento",
      }),
    ]);
  });
});
