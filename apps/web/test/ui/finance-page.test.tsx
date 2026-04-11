// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  createSalonFinancialTransactionActionPath,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSalonFinancialTransactionActionPath: "/__test/create-finance-entry",
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("@/app/actions", () => ({
  createSalonFinancialTransactionAction:
    createSalonFinancialTransactionActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import FinancePage from "@/app/dashboard/finance/page";

describe("finance page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-04T12:00:00.000Z"));
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders finance with inline launch flow", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                not: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "appointment-1",
                          date: "2026-04-02T14:00:00.000Z",
                          completed_at: "2026-04-02T15:00:00.000Z",
                          customers: { name: "Maria" },
                          services: { name: "Coloração", price: 250 },
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

        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "order-1",
                          order_number: 24,
                          subtotal_amount: 90,
                          completed_at: "2026-04-03T11:00:00.000Z",
                          created_at: "2026-04-03T09:00:00.000Z",
                          customers: { name: "Camila" },
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

        if (table === "salon_financial_transactions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "entry-1",
                          title: "Aluguel",
                          category: "Estrutura",
                          notes: null,
                          entry_type: "expense",
                          amount: 1200,
                          occurred_on: "2026-04-01",
                          payment_method: "transferência",
                          source: "manual",
                          created_at: "2026-04-01T08:00:00.000Z",
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

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const ui = await FinancePage({
      searchParams: { message: "Financeiro atualizado.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Financeiro atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Caixa do salão com leitura simples",
      }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Receitas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Despesas").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lucro").length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Transações recentes" })).toBeInTheDocument();
    expect(screen.getByText("Venda da loja virtual")).toBeInTheDocument();
    expect(screen.getByText("Aluguel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo lançamento" })).toHaveAttribute(
      "href",
      "#finance-new",
    );
    expect(screen.getByRole("heading", { name: "Novo lançamento" })).toBeInTheDocument();
    expect(screen.getByLabelText("Categoria")).toBeInTheDocument();
  });
});
