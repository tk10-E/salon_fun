import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock, createClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import { fetchPublicSalonLandingData } from "@/lib/publicSalonShare";

describe("public salon share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("only exposes membership offers that are operational and currently valid", async () => {
    createAdminClientMock.mockImplementation(() => {
      throw new Error("admin not configured");
    });

    createClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        id: "salon-1",
        name: "Studio Glow",
        brand_color: "#123456",
        client_app_config: {},
      }),
      from: vi.fn((table: string) => {
        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "offer-valid",
                          kind: "membership",
                          title: "Clube operacional",
                          description: "Plano pronto para o app.",
                          highlight_text: "2 sessões no mês",
                          image_path: "offers/operational.jpg",
                          membership_service_id: "service-1",
                          membership_sessions_included: 2,
                          membership_validity_days: 30,
                          price: 149.9,
                          is_active: true,
                          starts_on: "2026-04-01",
                          ends_on: null,
                          sort_order: 0,
                        },
                        {
                          id: "offer-broken",
                          kind: "membership",
                          title: "Clube incompleto",
                          description: "Ainda sem configuração final.",
                          highlight_text: null,
                          image_path: null,
                          membership_service_id: "service-1",
                          membership_sessions_included: 2,
                          membership_validity_days: null,
                          price: 129.9,
                          is_active: true,
                          starts_on: "2026-04-01",
                          ends_on: null,
                          sort_order: 1,
                        },
                        {
                          id: "offer-future",
                          kind: "membership",
                          title: "Clube futuro",
                          description: "Só começa mais tarde.",
                          highlight_text: null,
                          image_path: null,
                          membership_service_id: "service-1",
                          membership_sessions_included: 2,
                          membership_validity_days: 30,
                          price: 159.9,
                          is_active: true,
                          starts_on: "2026-05-01",
                          ends_on: null,
                          sort_order: 2,
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

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "service-1",
                    image_path: "services/hydration.jpg",
                    name: "Hidratação premium",
                  },
                ],
                error: null,
              }),
            })),
          };
        }

        if (table === "salon_posts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  limit: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const landing = await fetchPublicSalonLandingData("salao7");

    expect(landing?.activeOffers).toHaveLength(1);
    expect(landing?.activeOffers[0]).toEqual(
      expect.objectContaining({
        id: "offer-valid",
        actionKind: "request_membership",
      }),
    );
    expect(landing?.stats.activeOffersCount).toBe(1);
  });
});
