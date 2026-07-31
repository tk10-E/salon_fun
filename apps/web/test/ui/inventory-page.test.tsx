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

function buildInventoryProductsResponse() {
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
                name: "Oleo finalizador",
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

function buildRecentStoreOrdersResponse(rows: unknown[]) {
  return {
    order: vi.fn(() => ({
      limit: vi.fn().mockResolvedValue({
        data: rows,
        error: null,
      }),
    })),
  };
}

function buildAnalyticsStoreOrdersResponse(rows: unknown[]) {
  return {
    gte: vi.fn(() => ({
      lt: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data: rows,
            error: null,
          }),
        })),
      })),
    })),
  };
}

function buildCustomerProductOrdersResponse(args: {
  analyticsRows: unknown[];
  recentRows: unknown[];
}) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn((column: string) => {
        if (column !== "salon_id") {
          throw new Error(
            `Unexpected customer_product_orders filter ${column}`,
          );
        }

        return {
          ...buildRecentStoreOrdersResponse(args.recentRows),
          eq: vi.fn((statusColumn: string, statusValue: string) => {
            if (statusColumn !== "status" || statusValue !== "completed") {
              throw new Error(
                `Unexpected customer_product_orders status filter ${statusColumn}:${statusValue}`,
              );
            }

            return buildAnalyticsStoreOrdersResponse(args.analyticsRows);
          }),
        };
      }),
    })),
  };
}

function buildInventoryMovementsResponse(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue({
            data: rows,
            error: null,
          }),
        })),
      })),
    })),
  };
}

function buildStaffMembersResponse(rows: unknown[]) {
  return {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        order: vi.fn().mockResolvedValue({
          data: rows,
          error: null,
        }),
      })),
    })),
  };
}

function buildClientMock(args: {
  analyticsRows?: unknown[];
  inventoryMovementsRows?: unknown[];
  recentOrderRows?: unknown[];
}) {
  const storageFrom = vi.fn(() => ({
    getPublicUrl: vi.fn((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    })),
  }));

  createClientMock.mockReturnValue({
    from: vi.fn((table: string) => {
      if (table === "inventory_products") {
        return buildInventoryProductsResponse();
      }

      if (table === "customer_product_orders") {
        return buildCustomerProductOrdersResponse({
          analyticsRows: args.analyticsRows ?? [],
          recentRows: args.recentOrderRows ?? [],
        });
      }

      if (table === "inventory_movements") {
        return buildInventoryMovementsResponse(
          args.inventoryMovementsRows ?? [],
        );
      }

      if (table === "staff_members") {
        return buildStaffMembersResponse([
          { id: "staff-1", name: "Ana", is_active: true },
        ]);
      }

      throw new Error(`Unexpected table ${table}`);
    }),
    storage: {
      from: storageFrom,
    },
  });
}

describe("inventory page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", timezone: "America/Sao_Paulo" },
    });
  });

  it("renders the redesigned inventory workspace with real analytics panels", async () => {
    buildClientMock({
      analyticsRows: [
        {
          id: "order-2",
          order_number: 17,
          status: "completed",
          total_items: 1,
          subtotal_amount: 44.9,
          notes: null,
          cancellation_reason: null,
          created_at: "2026-05-03T10:00:00.000Z",
          confirmed_at: "2026-05-03T10:05:00.000Z",
          ready_at: "2026-05-03T10:15:00.000Z",
          completed_at: "2026-05-03T10:20:00.000Z",
          cancelled_at: null,
          customers: { name: "Maria", phone: "11988887777" },
          customer_product_order_items: [
            {
              id: "item-2",
              product_name_snapshot: "Shampoo reconstrutor",
              product_brand_snapshot: "Wella",
              product_image_path: "salon-1/product-1.webp",
              product_id: "product-1",
              unit_snapshot: "un",
              quantity: 1,
              unit_price_snapshot: 44.9,
              line_total_amount: 44.9,
            },
          ],
        },
      ],
      inventoryMovementsRows: [
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
      recentOrderRows: [
        {
          id: "order-1",
          order_number: 18,
          status: "pending",
          total_items: 1,
          subtotal_amount: 44.9,
          notes: "Separar na recepcao.",
          cancellation_reason: null,
          created_at: "2026-05-04T10:00:00.000Z",
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
    });

    const ui = await InventoryPage({
      searchParams: Promise.resolve({
        message: "Estoque atualizado.",
        tone: "success",
      }),
    });

    const { container } = render(ui);

    expect(screen.getByText("Estoque atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Loja do salao",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Receita da loja")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produtos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Alertas de estoque" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Venda por categoria" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Produtos que mais saem" })).toBeInTheDocument();
    expect(screen.getAllByText("Shampoo reconstrutor").length).toBeGreaterThan(0);
    expect(screen.getByText(/Uso em atendimento/i)).toBeInTheDocument();
    expect(screen.getAllByText("1 un").length).toBeGreaterThan(0);
    expect(screen.getAllByText("1 pedido(s) concluídos no mês").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Novo produto" })).toHaveAttribute(
      "href",
      "/dashboard/inventory?compose=1#product-create",
    );
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute(
      "href",
      "/dashboard/inventory?status=low#inventory-products",
    );
    expect(screen.getByRole("link", { name: /Ajustar estoque/i })).toHaveAttribute(
      "href",
      "/dashboard/inventory?status=low#inventory-products",
    );
    expect(screen.getByRole("link", { name: /Pedidos/i })).toHaveAttribute(
      "href",
      "/dashboard/inventory#inventory-orders",
    );
    expect(screen.getByRole("link", { name: /Vitrine app/i })).toHaveAttribute(
      "href",
      "/dashboard/client-app",
    );
    expect(screen.getByDisplayValue("WEL-01")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("un").length).toBeGreaterThan(0);
    expect(
      container.querySelector(
        'input[name="returnPath"][value="/dashboard/inventory#inventory-products"]',
      ),
    ).not.toBeNull();
    expect(
      container.querySelector(
        'input[name="returnPath"][value="/dashboard/inventory#inventory-movements"]',
      ),
    ).not.toBeNull();
    expect(
      screen.queryByRole("heading", { name: "Novo produto" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Fotos")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar CSV" })).toHaveAttribute(
      "href",
      expect.stringContaining("data:text/csv"),
    );
  });

  it("opens the product form when compose is enabled", async () => {
    buildClientMock({
      analyticsRows: [],
      inventoryMovementsRows: [],
      recentOrderRows: [],
    });

    const ui = await InventoryPage({
      searchParams: Promise.resolve({ compose: "1" }),
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Novo produto" })).toBeInTheDocument();
    expect(screen.getByLabelText("Fotos")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fechar" })).toBeInTheDocument();
  });
});
