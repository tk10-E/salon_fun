// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

import CustomersPage from "@/app/dashboard/customers/page";

describe("customers page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders CRM filters, customer metrics and pagination", async () => {
    createClientMock.mockReturnValue({
      rpc: vi.fn((name: string) => {
        if (name !== "get_owner_customer_directory") {
          throw new Error(`Unexpected rpc ${name}`);
        }

        return Promise.resolve({
          data: {
            overview: {
              cashback_customers: 4,
              customers_with_upcoming_appointment: 7,
              returning_customers: 9,
              total_customers: 17,
              vip_customers: 3,
            },
            total_count: 17,
            total_pages: 3,
            page: 2,
            page_size: 15,
            items: [
              {
                allergies: "Sensibilidade a amônia.",
                beauty_products: "Máscara reconstrutora e finalizador leve.",
                id: "customer-1",
                cashback_balance: 32.5,
                completed_visits: 8,
                created_at: "2026-02-10T12:00:00.000Z",
                current_tier: {
                  discount_percent: 15,
                  is_vip: true,
                  label: "Rubi",
                  min_visits: 6,
                },
                last_reward_at: "2026-03-01T14:00:00.000Z",
                last_visit_at: "2026-03-12T15:30:00.000Z",
                name: "Maria",
                next_appointment_at: "2026-03-28T16:00:00.000Z",
                pending_appointments: 1,
                points_balance: 120,
                preferences: "Prefere acabamento natural e horário no fim da tarde.",
                referral_code: "MARIA10",
                last_completed_at: "2026-03-12T15:30:00.000Z",
                last_completed_service_name: "Corte premium",
                last_completed_staff_member_name: "Ana",
                total_spent: 860,
                upcoming_appointments: 2,
              },
            ],
          },
          error: null,
        });
      }),
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              in: vi.fn(() =>
                Promise.resolve({
                  data: [
                    {
                      id: "customer-1",
                      preferences: "Prefere acabamento natural e horário no fim da tarde.",
                      allergies: "Sensibilidade a amônia.",
                      beauty_products: "Máscara reconstrutora e finalizador leve.",
                    },
                  ],
                  error: null,
                }),
              ),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    order: vi.fn(() => ({
                      order: vi.fn(() =>
                        Promise.resolve({
                          data: [
                            {
                              customer_id: "customer-1",
                              date: "2026-03-12T15:30:00.000Z",
                              completed_at: "2026-03-12T15:30:00.000Z",
                              services: { name: "Corte premium" },
                              staff_members: { name: "Ana" },
                            },
                          ],
                          error: null,
                        }),
                      ),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await CustomersPage({
      searchParams: {
        q: "Maria",
        segment: "vip",
        sort: "spent",
        page: "2",
      },
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Clientes" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar cliente")).toHaveValue("Maria");
    expect(screen.getByRole("button", { name: "Filtrar clientes" })).toBeInTheDocument();
    expect(screen.getByText("17 clientes encontrados")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText("Rubi")).toBeInTheDocument();
    expect(screen.getAllByText("VIP").length).toBeGreaterThan(0);
    expect(screen.getByText("Código MARIA10")).toBeInTheDocument();
    expect(screen.getByText("120")).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*32,50/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*860,00/)).toBeInTheDocument();
    expect(screen.getByText("Preferências")).toBeInTheDocument();
    expect(screen.getByText("Prefere acabamento natural e horário no fim da tarde.")).toBeInTheDocument();
    expect(screen.getByText("Produtos usados ou preferidos")).toBeInTheDocument();
    expect(screen.getByText("Máscara reconstrutora e finalizador leve.")).toBeInTheDocument();
    expect(screen.getByText("Alergias e cuidados")).toBeInTheDocument();
    expect(screen.getByText("Sensibilidade a amônia.")).toBeInTheDocument();
    expect(screen.getByText(/Corte premium/)).toBeInTheDocument();
    expect(screen.getByText("Exibindo de 16 até 17 de 17. Página 2 de 3.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Anterior" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Próxima" })).toBeInTheDocument();
  });
});
