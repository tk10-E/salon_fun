// @vitest-environment jsdom

import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  registerInventoryMovementActionPath,
  requireOwnerSalonMock,
  saveInventoryProductActionPath,
  saveStaffCommissionSettingsActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  registerInventoryMovementActionPath: "/__test/register-inventory-movement",
  requireOwnerSalonMock: vi.fn(),
  saveInventoryProductActionPath: "/__test/save-inventory-product",
  saveStaffCommissionSettingsActionPath: "/__test/save-staff-commission",
}));

vi.mock("next/link", () => ({
  default: (props: { children?: unknown; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/app/actions", () => ({
  registerInventoryMovementAction: registerInventoryMovementActionPath,
  saveInventoryProductAction: saveInventoryProductActionPath,
  saveStaffCommissionSettingsAction: saveStaffCommissionSettingsActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import OperationsPage from "@/app/dashboard/operations/page";

describe("operations page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders revenue, staff performance, commissions and inventory controls", async () => {
    createClientMock.mockReturnValue({
      rpc: vi.fn((name: string) => {
        if (name !== "get_owner_operations_dashboard") {
          throw new Error(`Unexpected rpc ${name}`);
        }

        return Promise.resolve({
          data: {
            overview: {
              active_inventory_products: 3,
              active_staff_members: 2,
              average_ticket: 95,
              estimated_commissions: 180,
              low_stock_products: 1,
              top_staff_name: "Ana",
              top_staff_revenue: 780,
              total_revenue: 1520,
            },
            daily_revenue: [
              {
                day: "2026-03-21",
                completed_appointments: 4,
                total_revenue: 420,
              },
            ],
            top_staff: [
              {
                id: "staff-1",
                name: "Ana",
                role: "Cabelo",
                is_active: true,
                completed_appointments: 8,
                total_revenue: 780,
                estimated_commission: 234,
                commission_rate_percent: 30,
                commission_flat_fee: 0,
                upcoming_appointments: 3,
                pending_appointments: 1,
                next_appointment_at: "2026-03-23T14:00:00.000Z",
                assigned_services: 5,
              },
            ],
            staff_agenda: [
              {
                id: "staff-1",
                name: "Ana",
                role: "Cabelo",
                is_active: true,
                assigned_services: 5,
                upcoming_appointments: 3,
                pending_appointments: 1,
                next_appointment_at: "2026-03-23T14:00:00.000Z",
                commission_rate_percent: 30,
                commission_flat_fee: 0,
              },
            ],
          },
          error: null,
        });
      }),
      from: vi.fn((table: string) => {
        if (table === "inventory_products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "product-1",
                        name: "Shampoo reconstrutor",
                        brand: "Wella",
                        sku: "WEL-01",
                        unit: "un",
                        current_stock: 1,
                        minimum_stock: 2,
                        cost_price: 24.9,
                        retail_price: 44.9,
                        is_active: true,
                        updated_at: "2026-03-22T12:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "inventory_movements") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "movement-1",
                        movement_type: "out",
                        quantity: 1,
                        previous_stock: 2,
                        resulting_stock: 1,
                        reason: "Uso no atendimento",
                        created_at: "2026-03-22T13:00:00.000Z",
                        inventory_products: { name: "Shampoo reconstrutor" },
                        staff_members: { name: "Ana" },
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "staff-1",
                      name: "Ana",
                      is_active: true,
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await OperationsPage({
      searchParams: { message: "Operação atualizada.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Operação atualizada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Relatórios automáticos do dono" })).toBeInTheDocument();
    expect(screen.getByText(/Faturamento 7 dias/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Profissionais que mais rendem" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Ana" }).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*780,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s*234,00/)).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Salvar comissão automática" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Controle de estoque" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Adicionar produto ao estoque" })).toBeInTheDocument();
    expect(screen.getAllByText("Shampoo reconstrutor").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Estoque em alerta").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Registrar movimento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Movimentos recentes" })).toBeInTheDocument();
    expect(screen.getByText("Uso no atendimento")).toBeInTheDocument();
  });
});
