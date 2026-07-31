// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/app/actions", () => ({
  deleteSalonNotificationAction: "/__test/delete-salon-notification",
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import NotificationsPage from "@/app/dashboard/notifications/page";

function createListQuery(data: unknown) {
  const query = {
    eq: vi.fn(() => query),
    order: vi.fn(() => query),
    range: vi.fn().mockResolvedValue({ data, count: 32, error: null }),
    or: vi.fn(() => query),
    gte: vi.fn(() => query),
    lte: vi.fn(() => query),
    in: vi.fn(() => query),
    not: vi.fn(() => query),
  };

  return query;
}

describe("notifications page UI", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-20T12:00:00.000Z"));
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        join_code: "ABCD1234",
        timezone: "America/Sao_Paulo",
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders delivery readiness, push reach and the notification history", async () => {
    const listQuery = createListQuery([
      {
        id: "notification-1",
        audience: "salon_customers",
        notification_type: "promotion_published",
        title: "Novidade VIP",
        body: "Cashback dobrado até sexta.",
        created_at: "2026-03-30T12:00:00.000Z",
        customer_id: null,
        customers: null,
      },
    ]);
    const pushTokensQuery = {
      count: 12,
      error: null,
      gte: vi.fn().mockResolvedValue({ count: 9, error: null }),
    };

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn((columns: string, options?: { head?: boolean }) => {
              if (columns.includes("customers(name)")) {
                return {
                  eq: vi.fn(() => listQuery),
                };
              }

              throw new Error(`Unexpected select on ${table}: ${columns}`);
            }),
          };
        }

        if (table === "customer_push_tokens") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => pushTokensQuery),
              })),
            })),
          };
        }

        if (table === "inventory_products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "product-1",
                      name: "Pomada forte",
                      current_stock: 1,
                      minimum_stock: 3,
                      unit: "un",
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "salon_payables") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: "payable-1",
                            title: "Aluguel",
                            amount: 900,
                            due_on: "2026-04-19",
                            status: "pending",
                          },
                        ],
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "salon_recurring_expenses") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [],
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string, options?: { count?: string }) => {
              if (columns === "date, customers(name), services(name)") {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  date: "2026-04-20T14:00:00.000Z",
                                  customers: { name: "Ana" },
                                  services: { name: "TranÃ§a" },
                                },
                              ],
                              count: options?.count === "exact" ? 1 : null,
                              error: null,
                            }),
                          })),
                        })),
                      })),
                    })),
                  })),
                };
              }

              if (columns.includes("cancelled_at")) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        gte: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  id: "appointment-1",
                                  date: "2026-04-20T14:00:00.000Z",
                                  cancelled_at: "2026-04-19T10:00:00.000Z",
                                  cancellation_reason: "Imprevisto",
                                  customers: { name: "Ana" },
                                  services: { name: "Trança" },
                                },
                              ],
                              count: options?.count === "exact" ? 1 : null,
                              error: null,
                            }),
                          })),
                        })),
                      })),
                    })),
                  })),
                };
              }

              if (columns.includes("commission_rate_percent")) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      not: vi.fn(() => ({
                        gte: vi.fn().mockResolvedValue({
                          data: [
                            {
                              date: "2026-04-18T14:00:00.000Z",
                              completed_at: "2026-04-18T15:00:00.000Z",
                              service_price_snapshot: 120,
                              services: { price: 100 },
                              staff_members: {
                                commission_rate_percent: 40,
                                commission_flat_fee: 0,
                              },
                            },
                          ],
                          error: null,
                        }),
                      })),
                    })),
                  })),
                };
              }

              throw new Error(`Unexpected select on ${table}: ${columns}`);
            }),
          };
        }

        if (table === "customer_product_orders") {
          return {
            select: vi.fn((columns: string, options?: { count?: string }) => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  not: vi.fn(() => ({
                    lte: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: vi.fn().mockResolvedValue({
                          data: [
                            {
                              id: "order-1",
                              order_number: 204,
                              ready_at: "2026-04-18T09:00:00.000Z",
                              customers: { name: "Bruna" },
                              customer_product_order_items: [
                                { product_name_snapshot: "Pomada forte" },
                              ],
                            },
                          ],
                          count: options?.count === "exact" ? 1 : null,
                          error: null,
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "customer_tabs") {
          return {
            select: vi.fn((columns: string, options?: { count?: string }) => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  lte: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn().mockResolvedValue({
                        data: [
                          {
                            id: "tab-1",
                            opened_at: "2026-04-18T08:00:00.000Z",
                            total_items: 180,
                            total_paid: 50,
                            customers: { name: "Carlos" },
                          },
                        ],
                        count: options?.count === "exact" ? 1 : null,
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "salon_financial_transactions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn().mockResolvedValue({
                    data: [
                      {
                        amount: 10,
                        occurred_on: "2026-04-18",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_growth_automation_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    is_active: true,
                    smart_rebook_is_active: true,
                    updated_at: "2026-03-25T15:00:00.000Z",
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn((name: string) => {
        if (name !== "get_salon_notification_dispatch_snapshot") {
          throw new Error(`Unexpected rpc ${name}`);
        }

        return Promise.resolve({
          data: [
            {
              notification_id: "notification-1",
              status: "delivered",
              sent_count: 12,
              failed_count: 0,
              deactivated_count: 0,
              response_status: 200,
              error_detail: null,
              updated_at: "2026-03-30T12:01:00.000Z",
            },
          ],
          error: null,
        });
      }),
    });

    const ui = await NotificationsPage({});

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Lembretes e avisos do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Filtro rápido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Histórico" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Alertas internos do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Exportar CSV" }),
    ).toHaveAttribute("href", "/dashboard/notifications/export");
    expect(screen.getByText(/12 clientes com app ativo/i)).toBeInTheDocument();
    expect(screen.getByText(/9 ativos recentemente/i)).toBeInTheDocument();
    expect(screen.getByText("Novidade VIP")).toBeInTheDocument();
    expect(screen.getByText("Cashback dobrado até sexta.")).toBeInTheDocument();
    expect(screen.getByText(/Pomada forte está com 1 un/i)).toBeInTheDocument();
    expect(screen.getByText("Vencidos agora: 1")).toBeInTheDocument();
    expect(
      screen.getByText(/1 despesa\(s\) seguem vencidas e ainda n.o foram baixadas no caixa/i),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 horário\(s\) foram cancelados pela cliente/i)).toBeInTheDocument();
    expect(screen.getByText(/pedido #204 de Bruna desde/i)).toBeInTheDocument();
    expect(screen.getByText(/1 comanda\(s\) seguem abertas há mais de 24h/i)).toBeInTheDocument();
    expect(screen.getByText(/38,00 seguem pendentes para repasse/i)).toBeInTheDocument();
    expect(screen.getByText(/4 operação pedindo ação/i)).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Retenção" }),
    ).toHaveAttribute("href", "/dashboard/benefits/automations");
    expect(
      screen.getByRole("link", { name: "Ajustes do app" }),
    ).toHaveAttribute("href", "/dashboard/settings");
  });
});
