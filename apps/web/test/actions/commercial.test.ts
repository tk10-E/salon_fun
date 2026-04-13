import { Buffer } from "node:buffer";

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  makeImageFile,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  getSalonBillingEntitlementsMock,
  optimizeUploadedImageMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getSalonBillingEntitlementsMock: vi.fn(),
  optimizeUploadedImageMock: vi.fn(),
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

vi.mock("@/lib/billing", () => ({
  getSalonBillingEntitlements: getSalonBillingEntitlementsMock,
}));

vi.mock("@/lib/uploadedImageOptimization", () => ({
  optimizeUploadedImage: optimizeUploadedImageMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createSalonOfferActionImpl,
  markReferralRewardRedeemedActionImpl,
  saveSalonGrowthAutomationActionImpl,
  saveSalonLoyaltyProgramActionImpl,
} from "@/app/_actions/commercial";

describe("commercial actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
    getSalonBillingEntitlementsMock.mockResolvedValue({
      currentPlan: { displayName: "Growth" },
      includesGrowthAutomation: true,
    });
  });

  it("creates an active offer and queues a customer notification", async () => {
    const insertOffer = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_offers") {
          return { insert: insertOffer };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      createSalonOfferActionImpl(
        makeFormData({
          kind: "promotion",
          title: "Combo de inverno",
          description: "Corte + hidratação",
          highlightText: "Combo especial da semana",
          membershipServiceId: "service-1",
          price: "129.9",
          startsOn: "2026-03-25",
          endsOn: "2026-03-31",
          sortOrder: "1",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(insertOffer).toHaveBeenCalledWith({
      salon_id: "salon-1",
      kind: "promotion",
      title: "Combo de inverno",
      description: "Corte + hidratação",
      highlight_text: "Combo especial da semana",
      image_path: null,
      membership_service_id: "service-1",
      membership_sessions_included: null,
      membership_validity_days: null,
      price: 129.9,
      starts_on: "2026-03-25",
      ends_on: "2026-03-31",
      sort_order: 1,
      is_active: true,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "promotion_published",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard/benefits",
        "/dashboard/benefits/promotions",
      ]),
    );
    expect(location).toBe(
      "/dashboard/benefits/promotions?message=Oferta+salva+com+sucesso.&tone=success",
    );
  });

  it("uploads an offer image before creating a membership plan", async () => {
    optimizeUploadedImageMock.mockResolvedValue({
      buffer: Buffer.from("optimized-image"),
      contentType: "image/jpeg",
      extension: "jpg",
      width: 1200,
      height: 900,
    });

    const insertOffer = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const uploadImage = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_offers") {
          return { insert: insertOffer };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          upload: uploadImage,
        })),
      },
    });

    const location = await captureRedirect(
      createSalonOfferActionImpl(
        makeFormData({
          kind: "membership",
          title: "Clube premium",
          description: "Plano recorrente com 2 atendimentos.",
          highlightText: "Beneficio principal em destaque",
          membershipServiceId: "service-1",
          membershipSessionsIncluded: "2",
          membershipValidityDays: "30",
          price: "199.9",
          sortOrder: "0",
          isActive: "on",
          offerImage: makeImageFile("membership.jpg"),
        }),
      ),
      redirectMock,
    );

    expect(optimizeUploadedImageMock).toHaveBeenCalled();
    expect(uploadImage).toHaveBeenCalledWith(
      expect.stringMatching(/^salon-1\/offers\/.+\.jpg$/),
      expect.any(Buffer),
      {
        contentType: "image/jpeg",
        upsert: true,
      },
    );
    expect(insertOffer).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        kind: "membership",
        image_path: expect.stringMatching(/^salon-1\/offers\/.+\.jpg$/),
      }),
    );
    expect(location).toBe(
      "/dashboard/benefits/promotions?message=Oferta+salva+com+sucesso.&tone=success",
    );
  });

  it("rejects loyalty tiers that do not grow progressively", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn(),
    });

    const location = await captureRedirect(
      saveSalonLoyaltyProgramActionImpl(
        makeFormData({
          title: "Clube Studio",
          tierOneName: "Bronze",
          tierOneMinVisits: "3",
          tierOneDiscountPercent: "5",
          tierTwoName: "Prata",
          tierTwoMinVisits: "2",
          tierTwoDiscountPercent: "10",
          vipTierName: "VIP",
          vipMinVisits: "6",
          vipDiscountPercent: "15",
          pointsPerVisit: "1",
          cashbackPercent: "5",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/benefits/loyalty?message=As+visitas+m%C3%ADnimas+precisam+crescer+do+primeiro+n%C3%ADvel+at%C3%A9+o+VIP.&tone=error",
    );
  });

  it("saves loyalty with an optional VIP reward service", async () => {
    const upsertProgram = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "service-1", name: "Hidratação premium" },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_loyalty_programs") {
          return {
            upsert: upsertProgram,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      saveSalonLoyaltyProgramActionImpl(
        makeFormData({
          title: "Clube Studio",
          description: "Pontue a cada visita.",
          tierOneName: "Bronze",
          tierOneMinVisits: "3",
          tierOneDiscountPercent: "5",
          tierTwoName: "Prata",
          tierTwoMinVisits: "6",
          tierTwoDiscountPercent: "10",
          vipTierName: "Ouro",
          vipMinVisits: "10",
          vipDiscountPercent: "15",
          vipRewardServiceId: "service-1",
          pointsPerVisit: "10",
          cashbackPercent: "5",
        }),
      ),
      redirectMock,
    );

    expect(upsertProgram).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        vip_reward_service_id: "service-1",
        vip_tier_name: "Ouro",
      }),
      { onConflict: "salon_id" },
    );
    expect(location).toBe(
      "/dashboard/benefits/loyalty?message=Programa+de+fidelidade+atualizado+com+sucesso.&tone=success",
    );
  });

  it("marks an available referral reward as redeemed", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "unlock-1" },
      error: null,
    });
    const select = vi.fn(() => ({
      maybeSingle,
    }));
    const statusFilter = vi.fn(() => ({
      select,
    }));
    const salonFilter = vi.fn(() => ({
      eq: statusFilter,
    }));
    const idFilter = vi.fn(() => ({
      eq: salonFilter,
    }));
    const updateUnlock = vi.fn(() => ({
      eq: idFilter,
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salon_referral_reward_unlocks") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          update: updateUnlock,
        };
      }),
    });

    const location = await captureRedirect(
      markReferralRewardRedeemedActionImpl(
        makeFormData({
          returnPath: "/dashboard/benefits/referrals",
          unlockId: "unlock-1",
        }),
      ),
      redirectMock,
    );

    expect(updateUnlock).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "redeemed",
      }),
    );
    expect(idFilter).toHaveBeenCalledWith("id", "unlock-1");
    expect(salonFilter).toHaveBeenCalledWith("salon_id", "salon-1");
    expect(statusFilter).toHaveBeenCalledWith("status", "available");
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard/benefits",
        "/dashboard/benefits/referrals",
      ]),
    );
    expect(location).toBe(
      "/dashboard/benefits/referrals?message=Recompensa+marcada+como+entregue.&tone=success",
    );
  });

  it("saves active growth automation and revalidates dashboard/notifications", async () => {
    const upsertSettings = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salon_growth_automation_settings") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          upsert: upsertSettings,
        };
      }),
    });

    const location = await captureRedirect(
      saveSalonGrowthAutomationActionImpl(
        makeFormData({
          isActive: "on",
          smartRebookIsActive: "on",
          winbackInactiveDays: "30",
          winbackDiscountPercent: "15",
          winbackTitle: "Volte para o studio",
          winbackBodyTemplate:
            "Sentimos sua falta. Temos uma condição especial para você voltar.",
          smartRebookWindowDays: "3",
          smartRebookTitle: "Hora de reagendar",
          smartRebookBodyTemplate:
            "Seu melhor momento de retorno está chegando. Quer reservar?",
        }),
      ),
      redirectMock,
    );

    expect(upsertSettings).toHaveBeenCalledWith(
      {
        salon_id: "salon-1",
        is_active: true,
        winback_inactive_days: 30,
        winback_discount_percent: 15,
        winback_title: "Volte para o studio",
        winback_body_template:
          "Sentimos sua falta. Temos uma condição especial para você voltar.",
        smart_rebook_is_active: true,
        smart_rebook_window_days: 3,
        smart_rebook_title: "Hora de reagendar",
        smart_rebook_body_template:
          "Seu melhor momento de retorno está chegando. Quer reservar?",
      },
      { onConflict: "salon_id" },
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/dashboard/notifications",
        "/dashboard/benefits",
        "/dashboard/benefits/automations",
      ]),
    );
    expect(location).toContain("/dashboard/benefits/automations?");
    expect(location).toContain("Automa%C3%A7%C3%A3o+comercial+salva");
  });
});
