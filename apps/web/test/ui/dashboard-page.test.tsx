// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, requireOwnerSalonMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
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
  });

  it("renders the redesigned dashboard with agenda, finance, team, stock and strategy panels", async () => {
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
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 4, error: null }),
            })),
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
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 52, error: null }),
            })),
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

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string, options?: { count?: string; head?: boolean }) => {
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
                                services: { category: "Cabelo", name: "Corte feminino", price: 120 },
                                staff_members: { name: "Camila" },
                              },
                              {
                                id: "appointment-2",
                                date: "2026-03-30T14:30:00.000Z",
                                status: "pending",
                                customer_id: "customer-2",
                                customers: { name: "Carla Mendes" },
                                services: { category: "Cabelo", name: "Escova premium", price: 90 },
                                staff_members: { name: "Ricardo" },
                              },
                              {
                                id: "appointment-3",
                                date: "2026-03-31T13:00:00.000Z",
                                status: "confirmed",
                                customer_id: "customer-3",
                                customers: { name: "Mariana" },
                                services: { category: "Unhas", name: "Manicure", price: 70 },
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
            }),
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
    expect(screen.getByRole("heading", { name: "Tudo o que o sistema ja opera em producao" })).toBeInTheDocument();
    expect(screen.getByText("Instagram e mencoes")).toBeInTheDocument();
    expect(screen.getByText("Agendamentos Hoje")).toBeInTheDocument();
    expect(screen.getByText("Clientes Atendidos")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Agenda do Dia" })).toBeInTheDocument();
    expect(screen.getByText("Corte feminino")).toBeInTheDocument();
    expect(screen.getByText("Escova premium")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Resumo Financeiro" })).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?650,00/).length).toBeGreaterThan(0);
    expect(screen.getByText("Pendências")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Top Profissionais" })).toBeInTheDocument();
    expect(screen.getByText("Camila")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produtos em Falta" })).toBeInTheDocument();
    expect(screen.getByText("Shampoo reconstrutor")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Funções avançadas que o sistema já tem" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Encaixes Inteligentes" })).toBeInTheDocument();
    expect(screen.getByText("Luzes premium")).toBeInTheDocument();
    expect(screen.getByText("Marina")).toBeInTheDocument();
    expect(screen.getByText("Automacao ligada")).toBeInTheDocument();
  });
});
