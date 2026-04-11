// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  registerInventoryMovementActionPath,
  requireOwnerSalonMock,
  runSalonAutoPilotActionPath,
  saveSalonMonthlyTargetsActionPath,
  saveInventoryProductActionPath,
  saveStaffCommissionSettingsActionPath,
  sendCustomerReactivationActionPath,
  updateCustomerProductOrderStatusActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  registerInventoryMovementActionPath: "/__test/register-inventory-movement",
  requireOwnerSalonMock: vi.fn(),
  runSalonAutoPilotActionPath: "/__test/run-salon-auto-pilot",
  saveSalonMonthlyTargetsActionPath: "/__test/save-salon-monthly-targets",
  saveInventoryProductActionPath: "/__test/save-inventory-product",
  saveStaffCommissionSettingsActionPath: "/__test/save-staff-commission",
  sendCustomerReactivationActionPath: "/__test/send-customer-reactivation",
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
  runSalonAutoPilotAction: runSalonAutoPilotActionPath,
  saveSalonMonthlyTargetsAction: saveSalonMonthlyTargetsActionPath,
  saveInventoryProductAction: saveInventoryProductActionPath,
  saveStaffCommissionSettingsAction: saveStaffCommissionSettingsActionPath,
  sendCustomerReactivationAction: sendCustomerReactivationActionPath,
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
      salon: {
        id: "salon-1",
        client_app_config: {
          autoPilotEnabled: true,
        },
      },
    });
  });

  it("separates salon operations from the virtual store with compact store management", async () => {
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
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "product-1",
                      name: "Shampoo reconstrutor",
                      image_paths: ["salon-1/product-1.webp"],
                      unit: "un",
                      current_stock: 1,
                      minimum_stock: 2,
                      retail_price: 44.9,
                    },
                  ],
                  error: null,
                }),
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

        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "appointment-1",
                          date: "2026-04-04T10:00:00.000Z",
                          status: "completed",
                          customers: { id: "customer-1", name: "Ana" },
                          services: {
                            id: "service-1",
                            name: "Escova",
                            price: 95,
                          },
                        },
                        {
                          id: "appointment-2",
                          date: "2026-04-01T10:00:00.000Z",
                          status: "confirmed",
                          customers: { id: "customer-2", name: "Bianca" },
                          services: {
                            id: "service-2",
                            name: "Coloracao",
                            price: 180,
                          },
                        },
                        {
                          id: "appointment-3",
                          date: "2026-02-01T10:00:00.000Z",
                          status: "cancelled",
                          customers: { id: "customer-1", name: "Ana" },
                          services: {
                            id: "service-1",
                            name: "Escova",
                            price: 95,
                          },
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

        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "customer-1",
                        name: "Ana",
                        created_at: "2026-01-02T10:00:00.000Z",
                        phone: "11988887777",
                        whatsapp_phone: "5511988887777",
                      },
                      {
                        id: "customer-2",
                        name: "Bianca",
                        created_at: "2026-03-20T10:00:00.000Z",
                        phone: "11977776666",
                        whatsapp_phone: "5511977776666",
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

        if (table === "salon_monthly_targets") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: null,
                    error: null,
                  }),
                })),
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
      screen.getByRole("heading", {
        name: "Visão executiva das operações do salão",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Metas do mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Leitura rápida do mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Clientes que pedem atenção" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Equipe em foco" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pedidos da loja" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Produtos em alerta" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Movimentos recentes" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar prioridades agora" })).toBeInTheDocument();
    expect(screen.getByText("Sugestões automáticas ativas")).toBeInTheDocument();
    expect(screen.getAllByText(/Ticket médio/).length).toBeGreaterThan(0);
    expect(screen.getByText("Serviço e cliente destaque")).toBeInTheDocument();
    expect(screen.getByText("Clientes para reativar agora")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar pelo painel" })).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Ana" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s*780,00/).length).toBeGreaterThan(0);
    expect(screen.getByText(/R\$\s*234,00/)).toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Salvar comissão" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByText("Shampoo reconstrutor").length,
    ).toBeGreaterThan(0);
    expect(screen.getByText("#204")).toBeInTheDocument();
    expect(
      screen.getByText(/Separar para retirada na recepcao/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Uso no atendimento")).toBeInTheDocument();
  });
});
