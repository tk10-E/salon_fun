// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, requireOwnerSalonMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: unknown; href: string; className?: string }) =>
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
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        slot_step_minutes: 30,
        timezone: "America/Sao_Paulo",
      },
    });
  });

  it("renders operational intelligence for empty slots, lapsed customers, top customers and top services", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 12, error: null }),
            })),
          };
        }

        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 46, error: null }),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string, options?: { count?: string; head?: boolean }) => {
              if (options?.head) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
                  })),
                };
              }

              return {
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "appointment-1",
                          date: "2026-03-22T13:00:00.000Z",
                          status: "confirmed",
                          customers: { name: "Patricia" },
                          services: { category: "Cabelo", name: "Escova modelada" },
                          staff_members: { name: "Ana" },
                        },
                      ],
                      error: null,
                    }),
                  })),
                })),
              };
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
                winback_inactive_days: 30,
                winback_discount_percent: 10,
                winback_title: "Sentimos sua falta",
                winback_body_template: "Volte esta semana.",
                smart_rebook_is_active: true,
                smart_rebook_window_days: 4,
                smart_rebook_title: "Hora do retorno",
                smart_rebook_body_template: "Seu horário ideal chegou.",
                updated_at: "2026-03-20T12:00:00.000Z",
              },
              overview: {
                at_risk_customers: 7,
                due_now_customers: 4,
                smart_rebook_due_customers: 5,
                winbacks_sent_last_30d: 8,
                smart_rebooks_sent_last_30d: 6,
                recovered_customers_last_30d: 3,
              },
              recent_runs: [],
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
                  id: "customer-1",
                  name: "Marina",
                  inactive_days: 41,
                  last_visit_at: "2026-02-09T15:00:00.000Z",
                  last_service_name: "Coloração",
                  last_service_category: "Cabelo",
                  total_spent: 820,
                  completed_visits: 5,
                  status: "due_now",
                },
              ],
              top_customers: [
                {
                  id: "customer-2",
                  name: "Fernanda",
                  total_spent: 1430,
                  completed_visits: 8,
                  last_visit_at: "2026-03-10T17:00:00.000Z",
                  next_appointment_at: "2026-03-29T14:00:00.000Z",
                  upcoming_appointments: 1,
                },
              ],
              top_services: [
                {
                  id: "service-1",
                  name: "Escova modelada",
                  category: "Cabelo",
                  completed_appointments: 17,
                  unique_customers: 11,
                  total_revenue: 2040,
                  last_booked_at: "2026-03-18T16:00:00.000Z",
                },
              ],
            },
            error: null,
          });
        }

        if (name === "get_smart_schedule_opportunities") {
          return Promise.resolve({
            data: {
              target_day: "2026-03-22",
              timezone: "America/Sao_Paulo",
              slot_step_minutes: 30,
              suggestions: [
                {
                  staff_member_id: "staff-1",
                  staff_member_name: "Ana",
                  gap_kind: "between_appointments",
                  gap_start: "2026-03-22T14:00:00.000Z",
                  gap_end: "2026-03-22T15:30:00.000Z",
                  gap_minutes: 90,
                  suggested_start: "2026-03-22T14:00:00.000Z",
                  suggested_end: "2026-03-22T15:00:00.000Z",
                  headline: "Encaixe premium",
                  detail: "Janela boa para vender um serviço de maior ticket.",
                  compatible_service_count: 2,
                  compatible_services: [],
                  suggested_service: {
                    id: "service-1",
                    name: "Escova modelada",
                    category: "Cabelo",
                    duration: 60,
                    price: 120,
                  },
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
    expect(screen.getByRole("heading", { name: "Plano de ação do dia" })).toBeInTheDocument();
    expect(screen.getByText("Feche os pedidos que ainda travam a agenda")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(screen.getByText("Abrir retenção")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Inteligência do salão" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Janelas com chance real de venda" })).toBeInTheDocument();
    expect(screen.getAllByText("Encaixe premium").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Base esfriando sem agenda futura" })).toBeInTheDocument();
    expect(screen.getByText("Marina")).toBeInTheDocument();
    expect(screen.getByText("Winback agora")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Quem mais sustenta o salão" })).toBeInTheDocument();
    expect(screen.getByText("Fernanda")).toBeInTheDocument();
    expect(screen.getByText("Retorno marcado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "O que mais gira no caixa" })).toBeInTheDocument();
    expect(screen.getAllByText("Escova modelada").length).toBeGreaterThan(0);
    expect(screen.getByText("R$ 2.040,00")).toBeInTheDocument();
  });
});
