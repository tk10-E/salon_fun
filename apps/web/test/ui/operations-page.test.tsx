// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  registerInventoryMovementActionPath,
  requireOwnerSalonMock,
  saveInventoryProductActionPath,
  saveStaffCommissionSettingsActionPath,
  updateCustomerProductOrderStatusActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  registerInventoryMovementActionPath: "/__test/register-inventory-movement",
  requireOwnerSalonMock: vi.fn(),
  saveInventoryProductActionPath: "/__test/save-inventory-product",
  saveStaffCommissionSettingsActionPath: "/__test/save-staff-commission",
  updateCustomerProductOrderStatusActionPath:
    "/__test/update-store-order-status",
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

vi.mock("@/app/actions", () => ({
  registerInventoryMovementAction: registerInventoryMovementActionPath,
  saveInventoryProductAction: saveInventoryProductActionPath,
  saveStaffCommissionSettingsAction: saveStaffCommissionSettingsActionPath,
  updateCustomerProductOrderStatusAction:
    updateCustomerProductOrderStatusActionPath,
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
    const storageFrom = vi.fn(() => ({
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.example.com/${path}` },
      })),
    }));

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
                        description:
                          "Shampoo de reconstrução com vitrine visual para a cliente.",
                        image_paths: ["salon-1/product-1.webp"],
                        sku: "WEL-01",
                        unit: "un",
                        current_stock: 1,
                        minimum_stock: 2,
                        cost_price: 24.9,
                        retail_price: 44.9,
                        max_purchase_quantity: 4,
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

        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "order-1",
                        order_number: 204,
                        status: "pending",
                        total_items: 3,
                        subtotal_amount: 134.7,
                        notes: "Separar para retirada na recepcao.",
                        cancellation_reason: null,
                        created_at: "2026-04-04T10:00:00.000Z",
                        confirmed_at: null,
                        ready_at: null,
                        completed_at: null,
                        cancelled_at: null,
                        customers: { name: "Ana", phone: "11988887777" },
                        customer_product_order_items: [
                          {
                            id: "order-item-1",
                            product_name_snapshot: "Shampoo reconstrutor",
                            product_brand_snapshot: "Wella",
                            product_image_path: "salon-1/product-1.webp",
                            unit_snapshot: "un",
                            quantity: 2,
                            unit_price_snapshot: 44.9,
                            line_total_amount: 89.8,
                          },
                        ],
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
      storage: {
        from: storageFrom,
      },
    });

    const ui = await OperationsPage({
      searchParams: { message: "Operação atualizada.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Operação atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Resumo financeiro" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Faturamento 7 dias/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Desempenho da equipe" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Ana" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*780,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s*234,00/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Salvar comissão" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Novo produto" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Salvar produto" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("Fotos da vitrine")).toBeInTheDocument();
    expect(screen.getAllByText("Limite por pedido").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Produtos" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Shampoo reconstrutor").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getAllByText(
        "Shampoo de reconstrução com vitrine visual para a cliente.",
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText("Estoque em alerta").length).toBeGreaterThan(0);
    expect(screen.getByText("Até 4")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pedidos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pedido #204")).toBeInTheDocument();
    expect(
      screen.getByText(/Separar para retirada na recepcao/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar pedido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Registrar movimento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Movimentos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Uso no atendimento")).toBeInTheDocument();
  });
});
