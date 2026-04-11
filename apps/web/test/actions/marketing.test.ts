import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const { createClientMock, redirectMock, revalidatePathMock, requireOwnerSalonMock } =
  vi.hoisted(() => ({
    createClientMock: vi.fn(),
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
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
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
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "birthday_campaign",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard/benefits",
        "/dashboard/customers",
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
                      winback_title: "Volte para o salão",
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
          serviceName: "Coloração",
          returnPath: "/dashboard/benefits",
        }),
      ),
      redirectMock,
    );

    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        notification_type: "manual_reactivation",
        title: "Volte para o salão",
        body: expect.stringContaining("43 dias"),
      }),
    );
  });
});
