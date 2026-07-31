import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

const {
  createClientMock,
  generateMarketingCampaignMessageWithAiMock,
  isMarketingCampaignAiEnabledMock,
  recordAiGenerationAuditMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  generateMarketingCampaignMessageWithAiMock: vi.fn(),
  isMarketingCampaignAiEnabledMock: vi.fn(),
  recordAiGenerationAuditMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("@/lib/ai/marketingCampaign", () => ({
  generateMarketingCampaignMessageWithAi: generateMarketingCampaignMessageWithAiMock,
  isMarketingCampaignAiEnabled: isMarketingCampaignAiEnabledMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/ai/audit", () => ({
  recordAiGenerationAudit: recordAiGenerationAuditMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { sendMarketingCustomerCampaignActionImpl } from "@/app/_actions/marketing";

describe("marketing customer campaign actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isMarketingCampaignAiEnabledMock.mockReturnValue(false);
    recordAiGenerationAuditMock.mockResolvedValue(undefined);
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
      user: { id: "user-1" },
    });
  });

  it("queues a birthday campaign for a single customer", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() =>
                    Promise.resolve({
                      data: { id: "customer-1", name: "Maria Souza" },
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        if (table === "salon_growth_automation_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({
                    data: null,
                    error: null,
                  }),
                ),
              })),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(() =>
                          Promise.resolve({
                            data: { id: "offer-1", title: "Glow Day" },
                            error: null,
                          }),
                        ),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      sendMarketingCustomerCampaignActionImpl(
        makeFormData({
          campaignType: "birthday_campaign",
          customerId: "customer-1",
          customerName: "Maria Souza",
          returnPath: "/dashboard/benefits",
        }),
      ),
      redirectMock,
    );

    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "single_customer",
        customer_id: "customer-1",
        notification_type: "birthday_campaign",
        salon_id: "salon-1",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard/benefits",
        "/dashboard/gestao/clientes",
        "/dashboard/notifications",
      ]),
    );
    expect(location).toBe(
      "/dashboard/benefits?message=Mensagem+de+anivers%C3%A1rio+enviada+para+o+app.&tone=success",
    );
  });

  it("uses the automation template for manual reactivation", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() =>
                    Promise.resolve({
                      data: { id: "customer-2", name: "Lucas Martins" },
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        if (table === "salon_growth_automation_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      winback_inactive_days: 30,
                      winback_discount_percent: 15,
                      winback_title: "Volte para o salao",
                      winback_body_template:
                        "Ja faz {inactive_days} dias desde seu ultimo {service_name}. Volte com {discount}% OFF.",
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(() =>
                          Promise.resolve({
                            data: null,
                            error: null,
                          }),
                        ),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await captureRedirect(
      sendMarketingCustomerCampaignActionImpl(
        makeFormData({
          campaignType: "manual_reactivation",
          customerId: "customer-2",
          customerName: "Lucas Martins",
          inactiveDays: "43",
          serviceName: "Coloracao",
          returnPath: "/dashboard/benefits",
        }),
      ),
      redirectMock,
    );

    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: expect.stringContaining("43 dias"),
        notification_type: "manual_reactivation",
        title: "Volte para o salao",
      }),
    );
  });

  it("uses AI to enrich the campaign text when the provider is enabled", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    isMarketingCampaignAiEnabledMock.mockReturnValue(true);
    generateMarketingCampaignMessageWithAiMock.mockResolvedValue({
      body: "Lucas, sentimos sua falta. Volte nesta semana para cuidar da coloracao com uma condicao especial no app.",
      model: "google/gemma-4-31b-it:free",
      title: "Seu retorno merece destaque",
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn(() =>
                    Promise.resolve({
                      data: { id: "customer-2", name: "Lucas Martins" },
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        if (table === "salon_growth_automation_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(() =>
                  Promise.resolve({
                    data: {
                      winback_inactive_days: 30,
                      winback_discount_percent: 15,
                      winback_title: "Volte para o salao",
                      winback_body_template:
                        "Ja faz {inactive_days} dias desde seu ultimo {service_name}. Volte com {discount}% OFF.",
                    },
                    error: null,
                  }),
                ),
              })),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  order: vi.fn(() => ({
                    order: vi.fn(() => ({
                      limit: vi.fn(() => ({
                        maybeSingle: vi.fn(() =>
                          Promise.resolve({
                            data: { id: "offer-1", title: "Coloracao glow" },
                            error: null,
                          }),
                        ),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await captureRedirect(
      sendMarketingCustomerCampaignActionImpl(
        makeFormData({
          campaignType: "manual_reactivation",
          customerId: "customer-2",
          customerName: "Lucas Martins",
          inactiveDays: "43",
          serviceName: "Coloracao",
          returnPath: "/dashboard/benefits",
        }),
      ),
      redirectMock,
    );

    expect(generateMarketingCampaignMessageWithAiMock).toHaveBeenCalledWith(
      expect.objectContaining({
        activeOfferTitle: "Coloracao glow",
        campaignType: "manual_reactivation",
        customerName: "Lucas Martins",
        discountPercent: 15,
        inactiveDays: 43,
        salonName: "Studio Barber",
        serviceName: "Coloracao",
      }),
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        body: "Lucas, sentimos sua falta. Volte nesta semana para cuidar da coloracao com uma condicao especial no app.",
        payload: expect.objectContaining({
          aiGenerated: true,
          aiModel: "google/gemma-4-31b-it:free",
        }),
        title: "Seu retorno merece destaque",
      }),
    );
    expect(recordAiGenerationAuditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "user-1",
        feature: AI_FEATURE_REGISTRY.marketingCampaignMessage.feature,
        outcome: "generated",
        salonId: "salon-1",
        targetId: "customer-2",
      }),
    );
  });
});
