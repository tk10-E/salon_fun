// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  registerInventoryMovementActionPath,
  requireOwnerSalonMock,
  saveInventoryProductActionPath,
  updateCustomerProductOrderStatusActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  registerInventoryMovementActionPath: "/__test/register-inventory-movement",
  requireOwnerSalonMock: vi.fn(),
  saveInventoryProductActionPath: "/__test/save-inventory-product",
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
  updateCustomerProductOrderStatusAction:
    updateCustomerProductOrderStatusActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import InventoryPage from "@/app/dashboard/inventory/page";

describe("inventory page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders the dedicated stock workspace with inline creation form", async () => {
    const storageFrom = vi.fn(() => ({
      getPublicUrl: vi.fn((path: string) => ({
        data: { publicUrl: `https://cdn.example.com/${path}` },
      })),
    }));

    createClientMock.mockReturnValue({
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
                        description: "Linha principal da vitrine.",
                        image_paths: ["salon-1/product-1.webp"],
                        sku: "WEL-01",
                        unit: "un",
                        current_stock: 1,
                        minimum_stock: 2,
                        cost_price: 24.9,
                        retail_price: 44.9,
                        max_purchase_quantity: 4,
                        is_active: true,
                        updated_at: "2026-04-03T12:00:00.000Z",
                      },
                      {
                        id: "product-2",
                        name: "Óleo finalizador",
                        brand: "Salon",
                        description: "Ainda sem saldo para o app.",
                        image_paths: [],
                        sku: "SAL-02",
                        unit: "un",
                        current_stock: 0,
                        minimum_stock: 1,
                        cost_price: 19.9,
                        retail_price: 39.9,
                        max_purchase_quantity: 3,
                        is_active: true,
                        updated_at: "2026-04-02T12:00:00.000Z",
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
                        order_number: 18,
                        status: "pending",
                        total_items: 1,
                        subtotal_amount: 44.9,
                        notes: "Separar na recepção.",
                        cancellation_reason: null,
                        created_at: "2026-04-04T10:00:00.000Z",
                        confirmed_at: null,
                        ready_at: null,
                        completed_at: null,
                        cancelled_at: null,
                        customers: { name: "Maria", phone: "11988887777" },
                        customer_product_order_items: [
                          {
                            id: "item-1",
                            product_name_snapshot: "Shampoo reconstrutor",
                            product_brand_snapshot: "Wella",
                            product_image_path: "salon-1/product-1.webp",
                            unit_snapshot: "un",
                            quantity: 1,
                            unit_price_snapshot: 44.9,
                            line_total_amount: 44.9,
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
                        reason: "Uso em atendimento",
                        created_at: "2026-04-04T12:00:00.000Z",
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
                  data: [{ id: "staff-1", name: "Ana", is_active: true }],
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

    const ui = await InventoryPage({
      searchParams: { message: "Estoque atualizado.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Estoque atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Produtos, pedidos e estoque em leitura de negócio.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Pedidos e retirada" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Catálogo de produtos" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Movimentos e ajustes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Reposição em atenção")).toBeInTheDocument();
    expect(screen.getAllByText("1 pedido em andamento").length).toBeGreaterThan(0);
    expect(
      screen.getByText(/1 na vitrine, 2 em alerta e receita recente/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "1 produto ativo ainda não entra na vitrine por saldo ou preço.",
      ),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Shampoo reconstrutor").length).toBeGreaterThan(0);
    expect(screen.getByText(/Separar na recepção/i)).toBeInTheDocument();
    expect(screen.getByText(/Uso em atendimento/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo produto" })).toHaveAttribute(
      "href",
      "#product-create",
    );
    expect(screen.getByRole("heading", { name: "Novo produto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fotos")).toBeInTheDocument();
  });
});
