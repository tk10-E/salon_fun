import { beforeEach, describe, expect, it, vi } from "vitest";

import { WEEKDAY_OPTIONS } from "@/lib/schedule";
import {
  captureRedirect,
  makeFormData,
  makeImageFile,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createAdminClientMock,
  createClientMock,
  fetchRemoteClientAppImageMock,
  generateClientAppImageVariantsMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createClientMock: vi.fn(),
  fetchRemoteClientAppImageMock: vi.fn(),
  generateClientAppImageVariantsMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/clientAppImageVariants", async () => {
  const actual = await vi.importActual<
    typeof import("@/lib/clientAppImageVariants")
  >("@/lib/clientAppImageVariants");

  return {
    ...actual,
    fetchRemoteClientAppImage: fetchRemoteClientAppImageMock,
    generateClientAppImageVariants: generateClientAppImageVariantsMock,
  };
});

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  regenerateSalonCodeActionImpl,
  updateSalonBookingPolicyActionImpl,
  updateSalonBrandingActionImpl,
  updateSalonSecurityPolicyActionImpl,
  updateSalonScheduleActionImpl,
} from "@/app/_actions/settings";

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          mfa: {
            listFactors: vi.fn().mockResolvedValue({
              data: {
                factors: [],
              },
              error: null,
            }),
          },
        },
      },
      schema: vi.fn(() => ({
        from: vi.fn(() => ({
          upsert: vi.fn().mockResolvedValue({
            error: null,
          }),
        })),
      })),
    });
    fetchRemoteClientAppImageMock.mockResolvedValue({
      buffer: Buffer.from("remote-image"),
      contentType: "image/jpeg",
    });
    generateClientAppImageVariantsMock.mockResolvedValue({
      normalizedSource: Buffer.from("normalized-source"),
      variants: {
        mobile: {
          buffer: Buffer.from("mobile-variant-image"),
          contentType: "image/jpeg",
        },
        tablet: {
          buffer: Buffer.from("tablet-variant-image"),
          contentType: "image/jpeg",
        },
        share: {
          buffer: Buffer.from("share-variant-image"),
          contentType: "image/jpeg",
        },
      },
    });
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        booking_policy_cancellation_window_hours: 24,
        booking_policy_confirmation_lead_minutes: 30,
        booking_policy_confirmation_required: true,
        booking_policy_deposit_amount: 0,
        booking_policy_deposit_reminder_lead_hours: 6,
        booking_policy_enabled: false,
        booking_policy_auto_confirm_new_appointments: false,
        booking_policy_asaas_api_key: null,
        booking_policy_asaas_environment: "sandbox",
        booking_policy_asaas_webhook_token: null,
        booking_policy_external_checkout_url: null,
        booking_policy_auto_cancel_lead_minutes: 10,
        booking_policy_auto_cancel_pending_deposit: false,
        booking_policy_auto_cancel_unconfirmed: true,
        booking_policy_payment_instructions: null,
        booking_policy_payment_mode: "manual",
        booking_policy_pix_key: null,
        booking_policy_pix_recipient_city: null,
        booking_policy_pix_recipient_name: null,
        booking_policy_requires_deposit: false,
        booking_policy_summary: null,
        booking_policy_title: "Reserva protegida",
        booking_policy_version: "booking-policy-20260403190000",
        join_code: "ABCD1234",
        logo_path: "logos/current.png",
      },
      user: {
        id: "user-1",
        email: "owner@studio.com",
      },
    });
  });

  it("regenerates the salon code and revalidates dashboard/settings", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "ABCD1234",
      error: null,
    });
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      regenerateSalonCodeActionImpl(),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith("generate_join_code");
    expect(updateSalon).toHaveBeenCalledWith({ join_code: "ABCD1234" });
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/settings"]),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Novo+c%C3%B3digo+gerado+com+sucesso.&tone=success",
    );
  });

  it("rejects an invalid map link before saving client app info", async () => {
    const from = vi.fn();
    const storageFrom = vi.fn();

    createClientMock.mockReturnValue({
      from,
      storage: {
        from: storageFrom,
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppMapUrl: "notaurl",
        }),
      ),
      redirectMock,
    );

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(location).toContain("/dashboard/settings?");
    expect(location).toContain("URL+v%C3%A1lida+de+mapa");
  });

  it("rejects an invalid support email before saving the client app", async () => {
    const from = vi.fn();
    const storageFrom = vi.fn();

    createClientMock.mockReturnValue({
      from,
      storage: {
        from: storageFrom,
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppSupportEmail: "suporte-studio.example.com",
        }),
      ),
      redirectMock,
    );

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(location).toContain("/dashboard/settings?");
    expect(location).toContain("e-mail+de+suporte");
  });

  it("accepts a full storefront URL and stores only the custom domain", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
          upload: vi.fn(),
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppCustomDomain:
            "https://www.app.studiocentro.com.br/cliente/agenda?origem=painel",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        client_app_config: expect.objectContaining({
          customDomain: "app.studiocentro.com.br",
        }),
      }),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Identidade+do+sal%C3%A3o+atualizada+com+sucesso.&tone=success",
    );
  });

  it("updates branding, business segment and contact details", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
          upload: vi.fn(),
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          tagline: "Atendimento elegante e direto no app.",
          brandColor: "#B35D77",
          businessSegment: "nail_studio",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Studio Centro",
        tagline: "Atendimento elegante e direto no app.",
        brand_color: "#B35D77",
        business_segment: "nail_studio",
        client_app_config: expect.objectContaining({
          experienceModel: "auto",
          visualStyle: "auto",
          homeEmphasis: "auto",
          heroHeadline: null,
          heroSupportLine: null,
          primaryCtaLabel: null,
          heroImageFocusX: 50,
          heroImageFocusY: 50,
          heroImageZoom: 1,
          galleryCoverImageFocusX: 50,
          galleryCoverImageFocusY: 50,
          galleryCoverImageZoom: 1,
          profileCoverImageFocusX: 50,
          profileCoverImageFocusY: 50,
          profileCoverImageZoom: 1,
          autoPilotEnabled: false,
          whiteLabelActive: false,
        }),
      }),
    );
    expect(eq).toHaveBeenCalledWith("id", "salon-1");
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "client_app_updated",
        title: "Novidades no app do salão",
      }),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Identidade+do+sal%C3%A3o+atualizada+com+sucesso.&tone=success",
    );
  });

  it("preserves premium tenant config fields while updating the settings page", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        logo_path: "logos/current.png",
        client_app_config: {
          experienceModel: "auto",
          visualStyle: "auto",
          homeEmphasis: "auto",
          welcomeHeadline: "Marca antiga",
          featuredProducts: [
            {
              id: "kit-1",
              name: "Kit premium",
            },
          ],
        },
      },
    });

    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }
      }),
      storage: {
        from: vi.fn(() => ({
          remove,
          upload,
          getPublicUrl,
        })),
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Barbearia Elite",
          businessSegment: "barbershop",
          clientAppThemeMode: "dark",
          clientAppButtonStyle: "elevated",
          clientAppCardStyle: "glass",
          clientAppBannerStyle: "immersive",
          clientAppSecondaryColor: "#3B3028",
          clientAppAccentColor: "#CDAA74",
          clientAppWelcomeHeadline: "Seu prÃ³ximo trato comeÃ§a aqui.",
          clientAppWelcomeMessage:
            "Agenda rÃ¡pida, profissionais fortes e uma vitrine com presenÃ§a.",
          clientAppPromotionHeadline:
            "Combos, clube e produtos com assinatura da casa.",
          clientAppHeroImageUrl: "https://cdn.example.com/hero.jpg",
          clientAppGalleryCoverImageUrl: "https://cdn.example.com/gallery.jpg",
          clientAppPrivacyPolicyUrl: "https://barbeariaelite.com/privacidade",
          clientAppTermsOfUseUrl: "https://barbeariaelite.com/termos",
          clientAppSupportUrl: "https://barbeariaelite.com/suporte",
          clientAppSupportEmail: "suporte@barbeariaelite.com",
          clientAppAddressLabel: "Rua Augusta, 500 - SÃ£o Paulo",
          clientAppMapUrl: "https://maps.example.com/barbearia",
          clientAppRatingValue: "4.9",
          clientAppRatingCount: "186",
          clientAppVisibleHomeModules: ["shortcuts", "gallery", "products"],
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Barbearia Elite",
        tagline: null,
        brand_color: "#C56B43",
        business_segment: "barbershop",
        client_app_config: expect.objectContaining({
          experienceModel: "auto",
          visualStyle: "auto",
          homeEmphasis: "auto",
          heroHeadline: null,
          heroSupportLine: null,
          primaryCtaLabel: null,
          themeMode: "dark",
          buttonStyle: "elevated",
          cardStyle: "glass",
          bannerStyle: "immersive",
          secondaryColor: "#3B3028",
          accentColor: "#CDAA74",
          welcomeHeadline: "Seu prÃ³ximo trato comeÃ§a aqui.",
          welcomeMessage:
            "Agenda rÃ¡pida, profissionais fortes e uma vitrine com presenÃ§a.",
          promotionHeadline: "Combos, clube e produtos com assinatura da casa.",
          heroImageUrl:
            "https://cdn.example.com/salon-1/client-app/hero/source",
          heroImageVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/mobile.jpg",
          heroImageTabletVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/tablet.jpg",
          heroImageShareVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/share.jpg",
          heroImagePath: "salon-1/client-app/hero/mobile.jpg",
          heroImageSourcePath: "salon-1/client-app/hero/source",
          heroImageSourceUrl: "https://cdn.example.com/hero.jpg",
          galleryCoverImageUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/source",
          galleryCoverImageVariantUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/mobile.jpg",
          galleryCoverImageTabletVariantUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/tablet.jpg",
          galleryCoverImageShareVariantUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/share.jpg",
          galleryCoverImagePath: "salon-1/client-app/gallery-cover/mobile.jpg",
          galleryCoverImageSourcePath:
            "salon-1/client-app/gallery-cover/source",
          galleryCoverImageSourceUrl: "https://cdn.example.com/gallery.jpg",
          heroImageFocusX: 50,
          heroImageFocusY: 50,
          heroImageZoom: 1,
          galleryCoverImageFocusX: 50,
          galleryCoverImageFocusY: 50,
          galleryCoverImageZoom: 1,
          profileCoverImageFocusX: 50,
          profileCoverImageFocusY: 50,
          profileCoverImageZoom: 1,
          privacyPolicyUrl: "https://barbeariaelite.com/privacidade",
          termsOfUseUrl: "https://barbeariaelite.com/termos",
          supportUrl: "https://barbeariaelite.com/suporte",
          supportEmail: "suporte@barbeariaelite.com",
          addressLabel: "Rua Augusta, 500 - SÃ£o Paulo",
          mapUrl: "https://maps.example.com/barbearia",
          ratingValue: 4.9,
          ratingCount: 186,
          visibleHomeModules: ["shortcuts", "gallery", "products"],
          featuredProducts: [
            {
              id: "kit-1",
              name: "Kit premium",
            },
          ],
          autoPilotEnabled: false,
          whiteLabelActive: false,
        }),
      }),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Identidade+do+sal%C3%A3o+atualizada+com+sucesso.&tone=success",
    );
    expect(upload).toHaveBeenCalledTimes(8);
  });

  it("publishes central campaigns for the client app with CTA targets", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
          upload: vi.fn(),
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppCampaignIsActive_1: "on",
          clientAppCampaignPriority_1: "high",
          clientAppCampaignAudience_1: "with_upcoming_appointment",
          clientAppCampaignStartsAt_1: "2026-04-01T09:00",
          clientAppCampaignEndsAt_1: "2026-04-07T20:00",
          clientAppCampaignEyebrow_1: "Agora no app",
          clientAppCampaignLabel_1: "Retorno da semana",
          clientAppCampaignTitle_1: "Volte essa semana",
          clientAppCampaignMessage_1:
            "Uma publicacao operacional leva a cliente direto para reservar.",
          clientAppCampaignCtaLabel_1: "Reservar agora",
          clientAppCampaignCtaTarget_1: "explore",
          clientAppCampaignPriority_2: "low",
          clientAppCampaignAudience_2: "without_active_benefits",
          clientAppCampaignTitle_2: "Fale com a equipe",
          clientAppCampaignMessage_2:
            "O salao tambem pode abrir o canal oficial direto da central.",
          clientAppCampaignCtaTarget_2: "support",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        client_app_config: expect.objectContaining({
          centralCampaigns: [
            {
              id: "campaign-1",
              isActive: true,
              priority: "high",
              startsAt: "2026-04-01T09:00",
              endsAt: "2026-04-07T20:00",
              audience: "with_upcoming_appointment",
              eyebrow: "Agora no app",
              title: "Volte essa semana",
              message:
                "Uma publicacao operacional leva a cliente direto para reservar.",
              campaignLabel: "Retorno da semana",
              ctaLabel: "Reservar agora",
              ctaTarget: "explore",
            },
            {
              id: "campaign-2",
              isActive: false,
              priority: "low",
              startsAt: null,
              endsAt: null,
              audience: "without_active_benefits",
              eyebrow: null,
              title: "Fale com a equipe",
              message:
                "O salao tambem pode abrir o canal oficial direto da central.",
              campaignLabel: null,
              ctaLabel: null,
              ctaTarget: "support",
            },
          ],
        }),
      }),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Identidade+do+sal%C3%A3o+atualizada+com+sucesso.&tone=success",
    );
  });

  it("rejects client app campaigns with an invalid date window", async () => {
    const updateSalon = vi.fn();

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: vi.fn().mockResolvedValue({ error: null }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
          upload: vi.fn(),
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppCampaignIsActive_1: "on",
          clientAppCampaignTitle_1: "Virada de agenda",
          clientAppCampaignMessage_1: "Essa campanha nÃ£o deveria ser salva.",
          clientAppCampaignStartsAt_1: "2026-04-10T20:00",
          clientAppCampaignEndsAt_1: "2026-04-09T09:00",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).not.toHaveBeenCalled();
    expect(location).toBe(
      "/dashboard/settings?message=A+data+final+das+campanhas+do+app+precisa+ser+igual+ou+posterior+%C3%A0+inicial.&tone=error",
    );
  });

  it("supports a dynamic number of client app campaigns instead of stopping at three fixed slots", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
          upload: vi.fn(),
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppCampaignIsActive_1: "on",
          clientAppCampaignTitle_1: "Campanha principal",
          clientAppCampaignMessage_1: "Primeira campanha visÃ­vel.",
          clientAppCampaignCtaTarget_1: "explore",
          clientAppCampaignTitle_4: "Campanha extra",
          clientAppCampaignMessage_4: "Essa campanha veio de um slot dinÃ¢mico.",
          clientAppCampaignPriority_4: "high",
          clientAppCampaignAudience_4: "with_active_benefits",
          clientAppCampaignCtaTarget_4: "support",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        client_app_config: expect.objectContaining({
          centralCampaigns: [
            expect.objectContaining({
              id: "campaign-1",
              title: "Campanha principal",
            }),
            expect.objectContaining({
              id: "campaign-4",
              title: "Campanha extra",
              priority: "high",
              audience: "with_active_benefits",
              ctaTarget: "support",
            }),
          ],
        }),
      }),
    );
  });

  it("uploads a single local client app asset and saves its processed public URLs", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }
      }),
      storage: {
        from: vi.fn(() => ({
          remove,
          upload,
          getPublicUrl,
        })),
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          clientAppHeroImageFile: makeImageFile("hero.jpg"),
        }),
      ),
      redirectMock,
    );

    expect(upload).toHaveBeenCalledTimes(4);
    expect(upload).toHaveBeenNthCalledWith(
      1,
      "salon-1/client-app/hero/source",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/png",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      2,
      "salon-1/client-app/hero/mobile.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      3,
      "salon-1/client-app/hero/tablet.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      4,
      "salon-1/client-app/hero/share.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        client_app_config: expect.objectContaining({
          heroImagePath: "salon-1/client-app/hero/mobile.jpg",
          heroImageSourcePath: "salon-1/client-app/hero/source",
          heroImageUrl:
            "https://cdn.example.com/salon-1/client-app/hero/source",
          heroImageVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/mobile.jpg",
          heroImageTabletVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/tablet.jpg",
          heroImageShareVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/share.jpg",
          heroImageZoom: 1,
          galleryCoverImageZoom: 1,
          profileCoverImageZoom: 1,
        }),
      }),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Identidade+do+sal%C3%A3o+atualizada+com+sucesso.&tone=success",
    );
  });

  it("updates the online schedule and business hours", async () => {
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const upsertBusinessHours = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_business_hours") {
          return {
            upsert: upsertBusinessHours,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const formValues: Record<string, string> = {
      timezone: "America/Sao_Paulo",
      slotStepMinutes: "30",
    };

    for (const weekday of WEEKDAY_OPTIONS) {
      formValues[`isOpen_${weekday.value}`] = "on";
      formValues[`opensAt_${weekday.value}`] = "09:00";
      formValues[`closesAt_${weekday.value}`] = "18:00";
    }

    const location = await captureRedirect(
      updateSalonScheduleActionImpl(makeFormData(formValues)),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith({
      timezone: "America/Sao_Paulo",
      slot_step_minutes: 30,
    });
    expect(upsertBusinessHours).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          salon_id: "salon-1",
          weekday: 0,
          is_open: true,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
        }),
      ]),
      { onConflict: "salon_id,weekday" },
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/settings"]),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Agenda+online+atualizada+com+sucesso.&tone=success",
    );
  });

  it("updates the protected booking policy and bumps the version when needed", async () => {
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateSalonBookingPolicyActionImpl(
        makeFormData({
          bookingPolicyEnabled: "on",
          bookingPolicyAutoConfirmNewAppointments: "on",
          bookingPolicyTitle: "Reserva protegida",
          bookingPolicySummary: "Sinal para segurar horarios premium.",
          bookingPolicyCancellationWindowHours: "12",
          bookingPolicyConfirmationRequired: "on",
          bookingPolicyConfirmationLeadMinutes: "25",
          bookingPolicyAutoCancelUnconfirmed: "on",
          bookingPolicyAutoCancelLeadMinutes: "10",
          bookingPolicyAutoCancelPendingDeposit: "on",
          bookingPolicyRequiresDeposit: "on",
          bookingPolicyDepositAmount: "40",
          bookingPolicyDepositReminderLeadHours: "8",
          bookingPolicyPaymentMode: "pix",
          bookingPolicyPixKey: "pix@studio.com",
          bookingPolicyPixRecipientName: "Studio Glow",
          bookingPolicyPixRecipientCity: "SAO PAULO",
          bookingPolicyPaymentInstructions:
            "Envie o Pix e o comprovante pelo WhatsApp.",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_policy_enabled: true,
        booking_policy_auto_confirm_new_appointments: true,
        booking_policy_title: "Reserva protegida",
        booking_policy_summary: "Sinal para segurar horarios premium.",
        booking_policy_cancellation_window_hours: 12,
        booking_policy_confirmation_required: true,
        booking_policy_confirmation_lead_minutes: 25,
        booking_policy_auto_cancel_unconfirmed: true,
        booking_policy_auto_cancel_lead_minutes: 10,
        booking_policy_auto_cancel_pending_deposit: true,
        booking_policy_requires_deposit: true,
        booking_policy_deposit_amount: 40,
        booking_policy_deposit_reminder_lead_hours: 8,
        booking_policy_payment_mode: "pix",
        booking_policy_pix_key: "pix@studio.com",
        booking_policy_pix_recipient_name: "Studio Glow",
        booking_policy_pix_recipient_city: "SAO PAULO",
        booking_policy_payment_instructions:
          "Envie o Pix e o comprovante pelo WhatsApp.",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/settings"]),
    );
    expect(location).toBe(
      "/dashboard/settings?message=Pol%C3%ADtica+de+reserva+protegida+atualizada+com+sucesso.&tone=success",
    );
  });

  it("saves the salon autopilot flag from the booking policy form", async () => {
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await captureRedirect(
      updateSalonBookingPolicyActionImpl(
        makeFormData({
          bookingPolicyEnabled: "on",
          clientAppAutoPilotEnabled: "on",
          bookingPolicyTitle: "Reserva protegida",
          bookingPolicyCancellationWindowHours: "12",
          bookingPolicyConfirmationLeadMinutes: "25",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        client_app_config: expect.objectContaining({
          autoPilotEnabled: true,
        }),
      }),
    );
  });

  it("saves the managed Pix configuration for Asaas and generates a webhook token", async () => {
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await captureRedirect(
      updateSalonBookingPolicyActionImpl(
        makeFormData({
          bookingPolicyEnabled: "on",
          bookingPolicyRequiresDeposit: "on",
          bookingPolicyDepositAmount: "55",
          bookingPolicyPaymentMode: "asaas_pix",
          bookingPolicyAsaasEnvironment: "production",
          bookingPolicyAsaasApiKey: "\$aact_live_12345678901234567890",
          bookingPolicyPaymentInstructions:
            "O Pix confirma sozinho assim que o Asaas responder.",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_policy_payment_mode: "asaas_pix",
        booking_policy_asaas_environment: "production",
        booking_policy_asaas_api_key: "\$aact_live_12345678901234567890",
        booking_policy_payment_instructions:
          "O Pix confirma sozinho assim que o Asaas responder.",
        booking_policy_asaas_webhook_token:
          expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );
  });

  it("normalizes auto-cancellation flags when confirmation or deposit are disabled", async () => {
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await captureRedirect(
      updateSalonBookingPolicyActionImpl(
        makeFormData({
          bookingPolicyEnabled: "on",
          bookingPolicyTitle: "Reserva protegida",
          bookingPolicyCancellationWindowHours: "12",
          bookingPolicyAutoCancelUnconfirmed: "on",
          bookingPolicyAutoCancelLeadMinutes: "10",
          bookingPolicyAutoCancelPendingDeposit: "on",
          bookingPolicyDepositReminderLeadHours: "8",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith(
      expect.objectContaining({
        booking_policy_confirmation_required: false,
        booking_policy_auto_cancel_unconfirmed: false,
        booking_policy_requires_deposit: false,
        booking_policy_auto_cancel_pending_deposit: false,
      }),
    );
  });

  it("requires at least one country when the geo allowlist is enabled", async () => {
    const location = await captureRedirect(
      updateSalonSecurityPolicyActionImpl(
        makeFormData({
          geoAllowlistEnabled: "on",
          allowedCountryCodes: "",
        }),
      ),
      redirectMock,
    );

    expect(location).toContain("dashboard/settings");
    expect(location).toContain("pelo+menos+um+pa%C3%ADs");
  });

  it("requires a verified TOTP factor before enabling MFA", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn(),
    });

    const location = await captureRedirect(
      updateSalonSecurityPolicyActionImpl(
        makeFormData({
          mfaTotpEnabled: "on",
        }),
      ),
      redirectMock,
    );

    expect(location).toContain("Conecte+e+confirme+um+autenticador+TOTP");
  });

  it("saves the salon security policy when MFA and allowed countries are valid", async () => {
    const upsert = vi.fn().mockResolvedValue({ error: null });
    const listFactors = vi.fn().mockResolvedValue({
      data: {
        factors: [
          {
            factor_type: "totp",
            status: "verified",
          },
        ],
      },
      error: null,
    });

    createAdminClientMock.mockReturnValue({
      auth: {
        admin: {
          mfa: {
            listFactors,
          },
        },
      },
    });
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_security_settings") {
          return {
            upsert,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateSalonSecurityPolicyActionImpl(
        makeFormData({
          mfaTotpEnabled: "on",
          geoAllowlistEnabled: "on",
          allowedCountryCodes: "br, us, BR",
        }),
      ),
      redirectMock,
    );

    expect(listFactors).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(upsert).toHaveBeenCalledWith(
      {
        allowed_country_codes: ["BR", "US"],
        geo_allowlist_enabled: true,
        mfa_totp_enabled: true,
        salon_id: "salon-1",
      },
      {
        onConflict: "salon_id",
      },
    );
    expect(location).toBe(
      "/dashboard/settings?message=Pol%C3%ADtica+de+seguran%C3%A7a+do+painel+atualizada+com+sucesso.&tone=success",
    );
  });
});
