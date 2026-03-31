import { beforeEach, describe, expect, it, vi } from "vitest";

import { WEEKDAY_OPTIONS } from "@/lib/schedule";
import {
  captureRedirect,
  makeFormData,
  makeImageFile,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  fetchRemoteClientAppImageMock,
  generateClientAppImageVariantsMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
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
  updateSalonBrandingActionImpl,
  updateSalonScheduleActionImpl,
} from "@/app/_actions/settings";

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
        logo_path: "logos/current.png",
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

  it("rejects invalid whatsapp numbers before updating branding", async () => {
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
          whatsappPhone: "123",
        }),
      ),
      redirectMock,
    );

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(location).toContain("/dashboard/settings?");
    expect(location).toContain("WhatsApp+v%C3%A1lido");
  });

  it("updates branding, business segment and contact details", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          update: updateSalon,
        };
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
          whatsappPhone: "55 11 99999-9999",
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith({
      name: "Studio Centro",
      tagline: "Atendimento elegante e direto no app.",
      brand_color: "#B35D77",
      business_segment: "nail_studio",
      client_app_config: {
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
      },
      whatsapp_phone: "5511999999999",
      logo_path: "logos/current.png",
    });
    expect(eq).toHaveBeenCalledWith("id", "salon-1");
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

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          update: updateSalon,
        };
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
          clientAppWelcomeHeadline: "Seu próximo trato começa aqui.",
          clientAppWelcomeMessage:
            "Agenda rápida, profissionais fortes e uma vitrine com presença.",
          clientAppPromotionHeadline:
            "Combos, clube e produtos com assinatura da casa.",
          clientAppHeroImageUrl: "https://cdn.example.com/hero.jpg",
          clientAppGalleryCoverImageUrl:
            "https://cdn.example.com/gallery.jpg",
          clientAppInstagramUrl: "https://instagram.com/barbeariaelite",
          clientAppAddressLabel: "Rua Augusta, 500 - São Paulo",
          clientAppMapUrl: "https://maps.example.com/barbearia",
          clientAppRatingValue: "4.9",
          clientAppRatingCount: "186",
          clientAppVisibleHomeModules: ["shortcuts", "gallery", "products"],
        }),
      ),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith({
      name: "Barbearia Elite",
      tagline: null,
      brand_color: "#C56B43",
      business_segment: "barbershop",
      client_app_config: {
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
        welcomeHeadline: "Seu próximo trato começa aqui.",
        welcomeMessage:
          "Agenda rápida, profissionais fortes e uma vitrine com presença.",
        promotionHeadline:
          "Combos, clube e produtos com assinatura da casa.",
        heroImageUrl: "https://cdn.example.com/salon-1/client-app/hero/source",
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
        instagramUrl: "https://instagram.com/barbeariaelite",
        addressLabel: "Rua Augusta, 500 - São Paulo",
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
      },
      whatsapp_phone: null,
      logo_path: "logos/current.png",
    });
    expect(location).toBe(
      "/dashboard/settings?message=Identidade+do+sal%C3%A3o+atualizada+com+sucesso.&tone=success",
    );
    expect(upload).toHaveBeenCalledTimes(8);
  });

  it("uploads hero, gallery and profile assets to storage and saves their public URLs", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSalon = vi.fn(() => ({ eq }));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const getPublicUrl = vi.fn((path: string) => ({
      data: { publicUrl: `https://cdn.example.com/${path}` },
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salons") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          update: updateSalon,
        };
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
          clientAppGalleryCoverImageFile: makeImageFile("gallery.jpg"),
          clientAppProfileCoverImageFile: makeImageFile("profile.jpg"),
        }),
      ),
      redirectMock,
    );

    expect(upload).toHaveBeenCalledTimes(12);
    expect(upload).toHaveBeenNthCalledWith(
      1,
      "salon-1/client-app/hero/source",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
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
    expect(upload).toHaveBeenNthCalledWith(
      5,
      "salon-1/client-app/gallery-cover/source",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      6,
      "salon-1/client-app/gallery-cover/mobile.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      7,
      "salon-1/client-app/gallery-cover/tablet.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      8,
      "salon-1/client-app/gallery-cover/share.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      9,
      "salon-1/client-app/profile-cover/source",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      10,
      "salon-1/client-app/profile-cover/mobile.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      11,
      "salon-1/client-app/profile-cover/tablet.jpg",
      expect.any(Buffer),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(upload).toHaveBeenNthCalledWith(
      12,
      "salon-1/client-app/profile-cover/share.jpg",
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
          heroImageUrl: "https://cdn.example.com/salon-1/client-app/hero/source",
          heroImageVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/mobile.jpg",
          heroImageTabletVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/tablet.jpg",
          heroImageShareVariantUrl:
            "https://cdn.example.com/salon-1/client-app/hero/share.jpg",
          heroImageZoom: 1,
          galleryCoverImagePath: "salon-1/client-app/gallery-cover/mobile.jpg",
          galleryCoverImageSourcePath:
            "salon-1/client-app/gallery-cover/source",
          galleryCoverImageUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/source",
          galleryCoverImageVariantUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/mobile.jpg",
          galleryCoverImageTabletVariantUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/tablet.jpg",
          galleryCoverImageShareVariantUrl:
            "https://cdn.example.com/salon-1/client-app/gallery-cover/share.jpg",
          galleryCoverImageZoom: 1,
          profileCoverImagePath: "salon-1/client-app/profile-cover/mobile.jpg",
          profileCoverImageSourcePath:
            "salon-1/client-app/profile-cover/source",
          profileCoverImageUrl:
            "https://cdn.example.com/salon-1/client-app/profile-cover/source",
          profileCoverImageVariantUrl:
            "https://cdn.example.com/salon-1/client-app/profile-cover/mobile.jpg",
          profileCoverImageTabletVariantUrl:
            "https://cdn.example.com/salon-1/client-app/profile-cover/tablet.jpg",
          profileCoverImageShareVariantUrl:
            "https://cdn.example.com/salon-1/client-app/profile-cover/share.jpg",
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
});
