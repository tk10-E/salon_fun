// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  createSalonOfferActionPath,
  deleteSalonOfferActionPath,
  requireOwnerSalonMock,
  updateSalonOfferActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  createSalonOfferActionPath: "/__test/create-offer",
  deleteSalonOfferActionPath: "/__test/delete-offer",
  requireOwnerSalonMock: vi.fn(),
  updateSalonOfferActionPath: "/__test/update-offer",
}));

vi.mock("@/app/actions", () => ({
  createSalonOfferAction: createSalonOfferActionPath,
  deleteSalonOfferAction: deleteSalonOfferActionPath,
  updateSalonOfferAction: updateSalonOfferActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import SubscriptionsPage from "@/app/dashboard/subscriptions/page";

describe("subscriptions page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("renders recurring plans in a dedicated workspace", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "offer-1",
                          title: "Clube Glow",
                          description: "Plano para hidratação e corte.",
                          highlight_text: "2 sessões por mês com valor fixo",
                          membership_service_id: "service-1",
                          membership_sessions_included: 2,
                          membership_validity_days: 30,
                          price: 149.9,
                          starts_on: "2026-04-01",
                          ends_on: null,
                          is_active: true,
                          sort_order: 0,
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

        if (table === "customer_memberships") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "membership-1",
                      customer_id: "customer-1",
                      offer_id: "offer-1",
                      title: "Clube Glow",
                      service_name_snapshot: "Hidratação premium",
                      status: "active",
                      started_at: "2026-04-01",
                      expires_at: "2026-04-30",
                      sessions_included: 2,
                      sessions_used: 1,
                      price_snapshot: 149.9,
                      customers: { name: "Maria" },
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "service-1",
                        name: "Hidratação premium",
                        category: "Tratamento",
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

    const ui = await SubscriptionsPage({
      searchParams: { message: "Planos atualizados.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Planos atualizados.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Assinaturas e planos para vender mais vezes.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Receita recorrente projetada")).toBeInTheDocument();
    expect(screen.getByText("Catálogo pronto")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planos do salão" })).toBeInTheDocument();
    expect(screen.getAllByText("Clube Glow").length).toBeGreaterThan(0);
    expect(screen.getByText(/2 sessões por mês com valor fixo/i)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Carteira ativa" })).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo plano" })).toHaveAttribute(
      "href",
      "#subscription-create",
    );
    expect(screen.getByRole("heading", { name: "Novo plano" })).toBeInTheDocument();
    expect(screen.getByLabelText("Sessões incluídas")).toBeInTheDocument();
  });
});
