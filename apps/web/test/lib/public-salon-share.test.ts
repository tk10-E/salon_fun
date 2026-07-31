import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  createClientMock,
  listResolvedAppointmentReviewsMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  listResolvedAppointmentReviewsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/appointmentReviews", () => ({
  listResolvedAppointmentReviews: listResolvedAppointmentReviewsMock,
}));

import { fetchPublicSalonLandingData } from "@/lib/publicSalonShare";

describe("public salon share", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps only live campaigns and exposes every operational active offer", async () => {
    createAdminClientMock.mockImplementation(() => {
      throw new Error("admin not configured");
    });

    createClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        id: "salon-1",
        name: "Studio Glow",
        brand_color: "#123456",
        client_app_config: {
          centralCampaigns: [
            {
              id: "campaign-live",
              isActive: true,
              priority: "high",
              startsAt: "2000-04-01T09:00:00Z",
              endsAt: "2099-04-30T22:00:00Z",
              audience: "all",
              eyebrow: "Hoje",
              title: "Volte esta semana",
              message: "A agenda estÃ¡ pronta para converter.",
              campaignLabel: "RetenÃ§Ã£o",
              ctaLabel: "Reservar",
              ctaTarget: "explore",
            },
            {
              id: "campaign-scheduled",
              isActive: true,
              priority: "medium",
              startsAt: "2099-05-01T09:00:00Z",
              endsAt: null,
              audience: "all",
              eyebrow: null,
              title: "Campanha futura",
              message: "Ainda nÃ£o deve entrar no app.",
              campaignLabel: null,
              ctaLabel: null,
              ctaTarget: "feed",
            },
            {
              id: "campaign-expired",
              isActive: true,
              priority: "low",
              startsAt: "2000-04-01T09:00:00Z",
              endsAt: "2000-04-02T09:00:00Z",
              audience: "all",
              eyebrow: null,
              title: "Campanha encerrada",
              message: "JÃ¡ passou da vigÃªncia.",
              campaignLabel: null,
              ctaLabel: null,
              ctaTarget: "feed",
            },
            {
              id: "campaign-paused",
              isActive: false,
              priority: "high",
              startsAt: null,
              endsAt: null,
              audience: "all",
              eyebrow: null,
              title: "Campanha pausada",
              message: "NÃ£o deve aparecer.",
              campaignLabel: null,
              ctaLabel: null,
              ctaTarget: "feed",
            },
          ],
        },
      }),
      from: vi.fn((table: string) => {
        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "offer-membership",
                        kind: "membership",
                        title: "Clube operacional",
                        description: "Plano pronto para o app.",
                        highlight_text: "2 sessÃµes no mÃªs",
                        image_path: "offers/operational.jpg",
                        membership_service_id: "service-1",
                        membership_sessions_included: 2,
                        membership_validity_days: 30,
                        price: 149.9,
                        is_active: true,
                        starts_on: "2000-04-01",
                        ends_on: null,
                        sort_order: 0,
                      },
                      {
                        id: "offer-promotion-1",
                        kind: "promotion",
                        title: "Combo da semana",
                        description: "Oferta real puxando agenda.",
                        highlight_text: "SÃ³ esta semana",
                        image_path: "offers/promo-1.jpg",
                        membership_service_id: null,
                        membership_sessions_included: null,
                        membership_validity_days: null,
                        price: 99.9,
                        is_active: true,
                        starts_on: null,
                        ends_on: null,
                        sort_order: 1,
                      },
                      {
                        id: "offer-promotion-2",
                        kind: "promotion",
                        title: "Escova express",
                        description: "Oferta extra para validar o limite.",
                        highlight_text: null,
                        image_path: "offers/promo-2.jpg",
                        membership_service_id: null,
                        membership_sessions_included: null,
                        membership_validity_days: null,
                        price: 79.9,
                        is_active: true,
                        starts_on: null,
                        ends_on: null,
                        sort_order: 2,
                      },
                      {
                        id: "offer-promotion-3",
                        kind: "promotion",
                        title: "HidrataÃ§Ã£o premium",
                        description: "Terceira promoÃ§Ã£o vÃ¡lida na vitrine.",
                        highlight_text: null,
                        image_path: "offers/promo-3.jpg",
                        membership_service_id: null,
                        membership_sessions_included: null,
                        membership_validity_days: null,
                        price: 119.9,
                        is_active: true,
                        starts_on: null,
                        ends_on: null,
                        sort_order: 3,
                      },
                      {
                        id: "offer-broken",
                        kind: "membership",
                        title: "Clube incompleto",
                        description: "Ainda sem configuraÃ§Ã£o final.",
                        highlight_text: null,
                        image_path: null,
                        membership_service_id: "service-2",
                        membership_sessions_included: 2,
                        membership_validity_days: 30,
                        price: 129.9,
                        is_active: true,
                        starts_on: "2000-04-01",
                        ends_on: null,
                        sort_order: 4,
                      },
                      {
                        id: "offer-future",
                        kind: "membership",
                        title: "Clube futuro",
                        description: "SÃ³ comeÃ§a mais tarde.",
                        highlight_text: null,
                        image_path: null,
                        membership_service_id: "service-1",
                        membership_sessions_included: 2,
                        membership_validity_days: 30,
                        price: 159.9,
                        is_active: true,
                        starts_on: "2099-05-01",
                        ends_on: null,
                        sort_order: 5,
                      },
                      {
                        id: "offer-package-future",
                        kind: "membership",
                        title: "Pacote futuro",
                        description: "Esse ainda precisa esperar a janela abrir.",
                        highlight_text: null,
                        image_path: null,
                        membership_service_id: "service-1",
                        membership_sessions_included: 1,
                        membership_validity_days: 7,
                        price: 69.9,
                        is_active: true,
                        starts_on: "2099-05-01",
                        ends_on: null,
                        sort_order: 6,
                      },
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
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "service-1",
                    image_path: "services/hydration.jpg",
                    name: "HidrataÃ§Ã£o premium",
                    is_active: true,
                  },
                  {
                    id: "service-2",
                    image_path: "services/inactive.jpg",
                    name: "ServiÃ§o inativo",
                    is_active: false,
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

    expect(landing?.centralCampaigns).toHaveLength(1);
    expect(landing?.centralCampaigns[0]).toEqual(
      expect.objectContaining({
        id: "campaign-live",
      }),
    );
    expect(landing?.activeOffers).toHaveLength(5);
    expect(landing?.activeOffers[0]).toEqual(
      expect.objectContaining({
        id: "offer-membership",
        actionKind: "request_membership",
        kindLabel: "Plano",
      }),
    );
    expect(landing?.activeOffers.map((offer) => offer.id)).toEqual([
      "offer-membership",
      "offer-promotion-1",
      "offer-promotion-2",
      "offer-promotion-3",
      "offer-future",
    ]);
    expect(landing?.stats.activeOffersCount).toBe(5);
  });

  it("builds a stable public instagram avatar for the app preview and owned posts", async () => {
    process.env.APP_URL = "https://painel.example.com";

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "salon-1",
                    name: "Studio Glow",
                    tagline: "Visual premium",
                    brand_color: "#123456",
                    business_segment: "barbershop",
                    whatsapp_phone: null,
                    logo_path: "logos/salon-1.png",
                    booking_policy_enabled: false,
                    booking_policy_title: null,
                    booking_policy_summary: null,
                    booking_policy_payment_mode: null,
                    booking_policy_pix_key: null,
                    booking_policy_pix_recipient_name: null,
                    booking_policy_pix_recipient_city: null,
                    booking_policy_external_checkout_url: null,
                    booking_policy_requires_deposit: false,
                    booking_policy_deposit_amount: null,
                    booking_policy_payment_instructions: null,
                    client_app_config: {},
                  },
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
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn().mockResolvedValue({
                      data: [],
                      error: null,
                    }),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_posts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                neq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    limit: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "post-1",
                          title: "Instagram do salÃ£o",
                          caption: "Visual novo",
                          image_path: "posts/post-1.jpg",
                          created_at: "2026-04-16T18:00:00.000Z",
                          post_type: "standard",
                          source_type: "instagram_owned_post",
                          external_author_avatar_url:
                            "https://cdn.instagram.example/expired.jpg",
                          external_author_username: "jctecnologi07",
                          services: null,
                          staff_members: null,
                          salon_post_images: [],
                          salon_post_likes: [],
                          salon_post_comments: [],
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

        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "connection-1",
                    updated_at: "2026-04-16T18:10:00.000Z",
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn((bucket: string) => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: {
              publicUrl: `https://cdn.example.com/${bucket}/${path}`,
            },
          })),
        })),
      },
    });

    const landing = await fetchPublicSalonLandingData("D1E438");

    expect(landing?.recentPosts[0]).toEqual(
      expect.objectContaining({
        authorAvatarUrl: "https://cdn.instagram.example/expired.jpg",
      }),
    );

    delete process.env.APP_URL;
  });

  it("merges resolved appointment reviews into the public landing for all salon clients", async () => {
    createClientMock.mockReturnValue({
      rpc: vi.fn().mockResolvedValue({
        preview: {
          salonId: "salon-1",
          joinCode: "D1E438",
          name: "Studio Barber",
          appDisplayName: "Studio Barber",
          tagline: null,
          brandColor: "#265F41",
          secondaryColor: null,
          accentColor: null,
          experienceModel: "beauty_signature",
          homeEmphasis: "services",
          businessSegment: "beauty_salon",
          logoUrl: null,
          heroImageUrl: null,
          galleryCoverImageUrl: null,
          profileCoverImageUrl: null,
          shareImageUrl: null,
          heroHeadline: "Tudo do salao no app",
          heroSupportLine: null,
          primaryCtaLabel: null,
          visualStyle: "glow_signature",
          themeMode: null,
          buttonStyle: null,
          cardStyle: null,
          bannerStyle: null,
          welcomeHeadline: "Tudo do salao no app",
          welcomeMessage: "Avaliacoes reais para todos os clientes do codigo.",
          promotionHeadline: "Avaliacoes reais para todos os clientes do codigo.",
          addressLabel: null,
          whatsappPhone: null,
          mapUrl: null,
          privacyPolicyUrl: null,
          termsOfUseUrl: null,
          supportUrl: null,
          supportEmail: null,
          ratingValue: null,
          ratingCount: null,
          bookingPolicyEnabled: false,
          bookingPolicyTitle: null,
          bookingPolicySummary: null,
          bookingPaymentMode: "manual",
          bookingRequiresDeposit: false,
          bookingDepositAmount: null,
          bookingPaymentInstructions: null,
          bookingPixKey: null,
          bookingPixRecipientName: null,
          bookingPixRecipientCity: null,
          bookingExternalCheckoutUrl: null,
          visibleHomeModules: ["shortcuts", "gallery"],
          moduleLabels: ["Atalhos", "Galeria"],
          segmentLabel: "Salao feminino",
          segmentDescription: "Relacionamento, agenda e prova social.",
        },
        featuredServices: [],
        activeOffers: [],
        recentPosts: [],
        recentReviews: [],
        centralCampaigns: [],
        stats: {
          servicesCount: 0,
          activeOffersCount: 0,
          recentPostsCount: 0,
        },
      }),
    });

    createAdminClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [{ id: "service-1", name: "Tranca" }],
                error: null,
              }),
            })),
          };
        }

        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    id: "staff-1",
                    name: "Maria",
                    image_path: "staff/maria.jpg",
                  },
                ],
                error: null,
              }),
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

    listResolvedAppointmentReviewsMock.mockResolvedValue([
      {
        appointmentId: "appointment-1",
        comment: "Muito bom",
        createdAt: "2026-05-09T20:30:00.000Z",
        customerId: "customer-1",
        rating: 5,
        salonId: "salon-1",
        serviceId: "service-1",
        source: "fallback",
        staffMemberId: "staff-1",
        updatedAt: "2026-05-09T20:30:00.000Z",
      },
      {
        appointmentId: "appointment-2",
        comment: "Volto sempre",
        createdAt: "2026-05-08T18:00:00.000Z",
        customerId: "customer-2",
        rating: 4,
        salonId: "salon-1",
        serviceId: "service-1",
        source: "fallback",
        staffMemberId: "staff-1",
        updatedAt: "2026-05-08T18:00:00.000Z",
      },
    ]);

    const landing = await fetchPublicSalonLandingData("D1E438");

    expect(landing?.preview.ratingCount).toBe(2);
    expect(landing?.preview.ratingValue).toBe(4.5);
    expect(landing?.recentReviews).toEqual([
      expect.objectContaining({
        id: "appointment-1",
        rating: 5,
        comment: "Muito bom",
        serviceName: "Tranca",
        staffName: "Maria",
        staffImageUrl: "https://cdn.example.com/staff/maria.jpg",
      }),
      expect.objectContaining({
        id: "appointment-2",
        rating: 4,
        comment: "Volto sempre",
      }),
    ]);
  });
});
