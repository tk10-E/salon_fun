// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

const { createClientMock, requireOwnerSalonMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
  }) =>
    createElement(
      "a",
      { href: props.href, className: props.className },
      props.children,
    ),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import DashboardPage from "@/app/dashboard/page";

describe("dashboard page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-30T15:00:00.000Z"));
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Beleza",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("renders a professional dashboard with customer growth, agenda and finance", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 12, error: null }),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(
              (
                _columns?: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
                  };
                }

                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      order: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn().mockResolvedValue({
                            data: [
                              {
                                id: "offer-1",
                                kind: "membership",
                                title: "Clube Glow Mensal",
                                highlight_text:
                                  "2 atendimentos por mes com valor fixo",
                                price: 149.9,
                                starts_on: "2026-03-25",
                                ends_on: null,
                                is_active: true,
                                sort_order: 0,
                              },
                              {
                                id: "offer-2",
                                kind: "promotion",
                                title: "Escova da Semana",
                                highlight_text:
                                  "Janela pensada para ocupar horarios ociosos",
                                price: 89.9,
                                starts_on: "2026-03-29",
                                ends_on: "2026-04-05",
                                is_active: true,
                                sort_order: 1,
                              },
                            ],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  })),
                };
              },
            ),
          };
        }

        if (table === "salon_posts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 9, error: null }),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn().mockResolvedValue({ count: 18, error: null }),
              })),
            })),
          };
        }

        if (table === "customer_push_tokens") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ count: 9, error: null }),
              })),
            })),
          };
        }

        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            })),
          };
        }

        if (table === "instagram_mentions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 6, error: null }),
            })),
          };
        }

        if (table === "customers") {
          return {
            select: vi.fn(
              (
                columns?: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn().mockResolvedValue({ count: 52, error: null }),
                  };
                }

                if (columns === "created_at") {
                  return {
                    eq: vi.fn(() => ({
                      gte: vi.fn(() => ({
                        order: vi.fn().mockResolvedValue({
                          data: [
                            { created_at: "2025-10-12T15:00:00.000Z" },
                            { created_at: "2025-11-02T15:00:00.000Z" },
                            { created_at: "2025-11-15T15:00:00.000Z" },
                            { created_at: "2025-12-10T15:00:00.000Z" },
                            { created_at: "2025-12-18T15:00:00.000Z" },
                            { created_at: "2026-01-03T15:00:00.000Z" },
                            { created_at: "2026-01-11T15:00:00.000Z" },
                            { created_at: "2026-01-19T15:00:00.000Z" },
                            { created_at: "2026-01-28T15:00:00.000Z" },
                            { created_at: "2026-02-06T15:00:00.000Z" },
                            { created_at: "2026-02-14T15:00:00.000Z" },
                            { created_at: "2026-02-22T15:00:00.000Z" },
                            { created_at: "2026-03-05T15:00:00.000Z" },
                            { created_at: "2026-03-12T15:00:00.000Z" },
                            { created_at: "2026-03-18T15:00:00.000Z" },
                            { created_at: "2026-03-24T15:00:00.000Z" },
                          ],
                          error: null,
                        }),
                      })),
                    })),
                  };
                }

                throw new Error(`Unexpected customers select: ${columns}`);
              },
            ),
          };
        }

        if (table === "inventory_products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "product-1",
                          name: "Shampoo reconstrutor",
                          brand: "Wella",
                          current_stock: 2,
                          minimum_stock: 5,
                          unit: "un",
                          is_active: true,
                        },
                        {
                          id: "product-2",
                          name: "Mascara nutritiva",
                          brand: "L'Oreal",
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
              })),
            })),
          };
        }

        if (table === "customer_tabs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "tab-1",
                        total_items: 210,
                        total_paid: 120,
                      },
                      {
                        id: "tab-2",
                        total_items: 80,
                        total_paid: 80,
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn(
              (
                columns: string,
                options?: { count?: string; head?: boolean },
              ) => {
                if (options?.head) {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
                    })),
                  };
                }

                if (columns.includes("customers(name)")) {
                  return {
                    eq: vi.fn(() => ({
                      gte: vi.fn(() => ({
                        lt: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  id: "appointment-1",
                                  date: "2026-03-30T12:00:00.000Z",
                                  status: "confirmed",
                                  customer_id: "customer-1",
                                  customers: { name: "Ana Paula" },
                                  services: {
                                    category: "Cabelo",
                                    name: "Corte feminino",
                                    price: 120,
                                  },
                                  staff_members: { name: "Camila" },
                                },
                                {
                                  id: "appointment-2",
                                  date: "2026-03-30T14:30:00.000Z",
                                  status: "pending",
                                  customer_id: "customer-2",
                                  customers: { name: "Carla Mendes" },
                                  services: {
                                    category: "Cabelo",
                                    name: "Escova premium",
                                    price: 90,
                                  },
                                  staff_members: { name: "Ricardo" },
                                },
                                {
                                  id: "appointment-3",
                                  date: "2026-03-31T13:00:00.000Z",
                                  status: "confirmed",
                                  customer_id: "customer-3",
                                  customers: { name: "Mariana" },
                                  services: {
                                    category: "Unhas",
                                    name: "Manicure",
                                    price: 70,
                                  },
                                  staff_members: { name: "Lorena" },
                                },
                              ],
                              error: null,
                            }),
                          })),
                        })),
                      })),
                    })),
                  };
                }

                if (columns === "customer_id, date, services(price)") {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn().mockResolvedValue({
                            data: [
                              {
                                customer_id: "customer-1",
                                date: "2026-03-29T15:00:00.000Z",
                                services: { price: 120 },
                              },
                              {
                                customer_id: "customer-2",
                                date: "2026-03-28T16:00:00.000Z",
                                services: { price: 200 },
                              },
                              {
                                customer_id: "customer-1",
                                date: "2026-03-20T18:00:00.000Z",
                                services: { price: 150 },
                              },
                            ],
                            error: null,
                          }),
                        })),
                        gte: vi.fn(() => ({
                          order: vi.fn(() => ({
                            limit: vi.fn().mockResolvedValue({
                              data: [
                                {
                                  customer_id: "customer-1",
                                  date: "2026-03-29T15:00:00.000Z",
                                  services: { price: 120 },
                                },
                                {
                                  customer_id: "customer-2",
                                  date: "2026-03-28T16:00:00.000Z",
                                  services: { price: 200 },
                                },
                                {
                                  customer_id: "customer-1",
                                  date: "2026-03-20T18:00:00.000Z",
                                  services: { price: 150 },
                                },
                              ],
                              error: null,
                            }),
                          })),
                        })),
                      })),
                    })),
                  };
                }

                if (columns === "date, services(price)") {
                  return {
                    eq: vi.fn(() => ({
                      eq: vi.fn(() => ({
                        order: vi.fn(() => ({
                          limit: vi.fn().mockResolvedValue({
                            data: [
                              {
                                date: "2026-03-30T14:30:00.000Z",
                                services: { price: 250 },
                              },
                              {
                                date: "2026-03-31T16:30:00.000Z",
                                services: { price: 400 },
                              },
                            ],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  };
                }

                throw new Error(`Unexpected appointments select: ${columns}`);
              },
            ),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn((name: string) => {
        if (name === "get_salon_growth_automation_dashboard") {
          return Promise.resolve({
            data: {
              settings: {
                is_active: true,
                smart_rebook_is_active: true,
                updated_at: "2026-03-20T12:00:00.000Z",
              },
              overview: {
                at_risk_customers: 7,
                due_now_customers: 4,
                smart_rebook_due_customers: 5,
                recovered_customers_last_30d: 3,
                smart_rebooks_sent_last_30d: 6,
                winbacks_sent_last_30d: 8,
              },
            },
            error: null,
          });
        }

        if (name === "get_owner_dashboard_intelligence") {
          return Promise.resolve({
            data: {
              overview: {
                tracked_due_now_customers: 2,
                tracked_lapsed_customers: 4,
                tracked_top_customers: 5,
                tracked_top_services: 5,
              },
              lapsed_customers: [
                {
                  id: "customer-lapsed-1",
                  name: "Marina",
                  inactive_days: 41,
                  last_visit_at: "2026-02-09T15:00:00.000Z",
                  last_service_name: "Coloracao",
                  last_service_category: "Cabelo",
                  total_spent: 820,
                  completed_visits: 5,
                  status: "due_now",
                },
              ],
              top_customers: [
                {
                  id: "customer-top-1",
                  name: "Fernanda",
                  total_spent: 1430,
                  completed_visits: 8,
                  last_visit_at: "2026-03-10T17:00:00.000Z",
                  next_appointment_at: null,
                  upcoming_appointments: 0,
                },
              ],
              top_services: [
                {
                  id: "service-1",
                  name: "Corte",
                  category: "Cabelo",
                  completed_appointments: 35,
                  unique_customers: 18,
                  total_revenue: 4200,
                  last_booked_at: "2026-03-28T16:00:00.000Z",
                },
                {
                  id: "service-2",
                  name: "Coloracao",
                  category: "Cabelo",
                  completed_appointments: 28,
                  unique_customers: 12,
                  total_revenue: 3360,
                  last_booked_at: "2026-03-27T17:00:00.000Z",
                },
              ],
            },
            error: null,
          });
        }

        if (name === "get_smart_schedule_opportunities") {
          return Promise.resolve({
            data: {
              suggestions: [
                {
                  staff_member_name: "Camila",
                  suggested_start: "2026-03-30T16:00:00.000Z",
                  headline: "Encaixe premium",
                  detail: "Janela boa para vender um servico de maior ticket.",
                  suggested_service: {
                    name: "Luzes premium",
                    category: "Cabelo",
                    price: 180,
                  },
                },
              ],
            },
            error: null,
          });
        }

        if (name === "get_owner_operations_dashboard") {
          return Promise.resolve({
            data: {
              overview: {
                active_inventory_products: 8,
                active_staff_members: 3,
                average_ticket: 156,
                estimated_commissions: 480,
                low_stock_products: 2,
                top_staff_name: "Camila",
                top_staff_revenue: 2200,
                total_revenue: 3120,
              },
              daily_revenue: [
                {
                  completed_appointments: 2,
                  day: "2026-03-29",
                  total_revenue: 220,
                },
                {
                  completed_appointments: 1,
                  day: "2026-03-30",
                  total_revenue: 180,
                },
              ],
              top_staff: [
                {
                  id: "staff-1",
                  name: "Camila",
                  role: "Cabelo",
                  completed_appointments: 15,
                  estimated_commission: 310,
                  pending_appointments: 1,
                  total_revenue: 2200,
                  upcoming_appointments: 3,
                },
                {
                  id: "staff-2",
                  name: "Ricardo",
                  role: "Barbearia",
                  completed_appointments: 12,
                  estimated_commission: 190,
                  pending_appointments: 1,
                  total_revenue: 1680,
                  upcoming_appointments: 2,
                },
              ],
            },
            error: null,
          });
        }

        throw new Error(`Unexpected rpc ${name}`);
      }),
    });

    const ui = await DashboardPage({
      searchParams: { message: "Resumo atualizado.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Resumo atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Studio Beleza",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Crescimento de clientes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda do dia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Financeiro rapido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Hoje precisa de atencao" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Horarios hoje")).toBeInTheDocument();
    expect(screen.getByText("Pendencias")).toBeInTheDocument();
    expect(screen.getByText("Receita do mes")).toBeInTheDocument();
    expect(screen.getByText("Proximo horario")).toBeInTheDocument();
    expect(screen.getAllByText("09:00").length).toBeGreaterThan(0);
    expect(screen.getByText("Corte feminino • Ana Paula")).toBeInTheDocument();
    expect(screen.getByText("Base total")).toBeInTheDocument();
    expect(screen.getByText("Novas no mes")).toBeInTheDocument();
    expect(screen.getByText("Ativas 30d")).toBeInTheDocument();
    expect(screen.getByText("Vs mes anterior")).toBeInTheDocument();
    expect(screen.getByText("+33%")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Entrada de clientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Corte feminino")).toBeInTheDocument();
    expect(screen.getByText("Escova premium")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?470,00/)).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?156,67/).length).toBeGreaterThan(0);
    expect(screen.getByText("Concluidos no mes")).toBeInTheDocument();
    expect(screen.getByText("Comandas abertas")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?90,00 em aberto/)).toBeInTheDocument();
    expect(screen.getByText("Confirmacoes pendentes")).toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Atalhos essenciais" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Abrir agenda" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Ver clientes" }),
    ).not.toBeInTheDocument();
  });
});
