// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock, requireOwnerSalonMock, redirectMock } = vi.hoisted(
  () => ({
    createClientMock: vi.fn(),
    requireOwnerSalonMock: vi.fn(),
    redirectMock: vi.fn(),
  }),
);

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/app/actions", () => ({
  addTabItemAction: "/actions/tabs/add-item",
  addTabPaymentAction: "/actions/tabs/add-payment",
  closeTabAction: "/actions/tabs/close",
  openTabAction: "/actions/tabs/open",
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import ComandasPage from "@/app/dashboard/operations/comandas/page";

describe("comandas page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redirectMock.mockImplementation((href: string) => {
      throw new Error(`REDIRECT:${href}`);
    });

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
      },
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customer_tabs") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "tab-1",
                        status: "open",
                        opened_at: "2026-04-08T12:00:00.000Z",
                        closed_at: null,
                        notes: "Cliente da cadeira 2",
                        total_items: 210,
                        total_paid: 120,
                        customers: {
                          id: "customer-1",
                          name: "Ana Paula",
                          phone: "11999999999",
                        },
                        customer_tab_items: [
                          {
                            id: "item-1",
                            description: "Corte feminino",
                            quantity: 1,
                            unit_price: 120,
                            total: 120,
                            created_at: "2026-04-08T12:10:00.000Z",
                            service_id: "service-1",
                            inventory_product_id: null,
                          },
                        ],
                        customer_tab_payments: [
                          {
                            id: "pay-1",
                            amount: 120,
                            method: "pix",
                            note: "Entrada",
                            created_at: "2026-04-08T12:20:00.000Z",
                          },
                        ],
                      },
                      {
                        id: "tab-2",
                        status: "closed",
                        opened_at: "2026-04-08T09:00:00.000Z",
                        closed_at: "2026-04-08T10:00:00.000Z",
                        notes: "",
                        total_items: 90,
                        total_paid: 90,
                        customers: {
                          id: "customer-2",
                          name: "Carla Mendes",
                          phone: "11888888888",
                        },
                        customer_tab_items: [],
                        customer_tab_payments: [],
                      },
                    ],
                    error: null,
                  }),
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
                      { id: "customer-1", name: "Ana Paula", phone: "11999999999" },
                      { id: "customer-2", name: "Carla Mendes", phone: "11888888888" },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    { id: "service-1", name: "Corte feminino", price: 120 },
                    { id: "service-2", name: "Escova premium", price: 90 },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "inventory_products") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      { id: "product-1", name: "Shampoo", retail_price: 65 },
                      { id: "product-2", name: "Máscara", retail_price: 85 },
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
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          service_id: "service-1",
                          services: {
                            id: "service-1",
                            name: "Corte feminino",
                            price: 120,
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

        if (table === "customer_product_order_items") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [
                      {
                        product_id: "product-1",
                        product_name_snapshot: "Shampoo",
                        unit_price_snapshot: 65,
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });
  });

  it("renders a more operational comanda workspace without changing core actions", async () => {
    const ui = await ComandasPage({
      searchParams: {
        message: "Comanda atualizada.",
        tone: "success",
      },
    });

    render(ui);

    expect(screen.getByText("Comanda atualizada.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comandas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Em aberto").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Abertas agora").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Abrir comanda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comandas em andamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Encerradas recentemente" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getByText("Cliente da cadeira 2")).toBeInTheDocument();
    expect(screen.getAllByText(/R\$\s?90,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s?120,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/R\$\s?210,00/).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Prontas para fechar").length).toBeGreaterThan(0);
    expect(screen.getByText("Liquidacao da conta")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fechar comanda" })).toBeInTheDocument();
  });
});
