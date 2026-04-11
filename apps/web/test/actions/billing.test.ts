import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  buildAbsoluteUrlMock,
  createClientMock,
  getSalonBillingSnapshotMock,
  getStripeBillingReadinessMock,
  getStripeClientMock,
  resolveStripePriceIdMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  buildAbsoluteUrlMock: vi.fn(),
  createClientMock: vi.fn(),
  getSalonBillingSnapshotMock: vi.fn(),
  getStripeBillingReadinessMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  resolveStripePriceIdMock: vi.fn(),
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

vi.mock("@/lib/billing", async () => {
  const actual = await vi.importActual<typeof import("@/lib/billing")>("@/lib/billing");

  return {
    ...actual,
    getSalonBillingSnapshot: getSalonBillingSnapshotMock,
  };
});

vi.mock("@/lib/requestOrigin", () => ({
  buildAbsoluteUrl: buildAbsoluteUrlMock,
}));

vi.mock("@/lib/stripeBilling", () => ({
  getStripeBillingReadiness: getStripeBillingReadinessMock,
  getStripeClient: getStripeClientMock,
  resolveStripePriceId: resolveStripePriceIdMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  cancelSalonSubscriptionActionImpl,
  changeSalonPlanActionImpl,
  startStripeBillingPortalActionImpl,
  startStripeCheckoutActionImpl,
} from "@/app/_actions/billing";

describe.skip("billing actions (desativado no painel)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Centro" },
      user: { id: "user-1", email: "owner@salon.fun" },
    });
    buildAbsoluteUrlMock.mockReturnValue("https://painel.salon.fun/dashboard/billing");
    getStripeBillingReadinessMock.mockReturnValue({ configured: true, missing: [] });
    getSalonBillingSnapshotMock.mockResolvedValue({
      currentPlan: { id: "starter", displayName: "Starter" },
      subscription: {
        status: "trialing",
        billingInterval: "monthly",
        paymentProvider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        trialStartedAt: "2026-04-01T12:00:00.000Z",
        trialEndsAt: "2026-04-15T12:00:00.000Z",
        currentPeriodStartedAt: null,
        currentPeriodEndsAt: null,
        graceEndsAt: null,
        activatedAt: null,
        canceledAt: null,
      },
    });
    resolveStripePriceIdMock.mockReturnValue("price_growth_yearly");
  });

  it("activates the selected plan and revalidates the dashboard layout", async () => {
    const upsertSubscription = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "saas_plan_catalog") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "growth",
                      display_name: "Growth",
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_subscriptions") {
          return {
            upsert: upsertSubscription,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      changeSalonPlanActionImpl(
        makeFormData({
          planId: "growth",
          billingInterval: "yearly",
        }),
      ),
      redirectMock,
    );

    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        plan_id: "growth",
        status: "active",
        billing_interval: "yearly",
        canceled_at: null,
        grace_ends_at: null,
      }),
      { onConflict: "salon_id" },
    );
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard", "layout");
    expect(location).toBe("/dashboard/billing?message=Growth+ativado+com+cobran%C3%A7a+anual.&tone=success");
  });

  it("marks the subscription for cancellation at the end of the cycle", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const updateSubscription = vi.fn(() => ({ eq }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salon_subscriptions") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          update: updateSubscription,
        };
      }),
    });

    const location = await captureRedirect(cancelSalonSubscriptionActionImpl(), redirectMock);

    expect(updateSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "canceled",
        grace_ends_at: null,
      }),
    );
    expect(eq).toHaveBeenCalledWith("salon_id", "salon-1");
    expect(location).toBe(
      "/dashboard/billing?message=Assinatura+marcada+para+cancelamento+ao+fim+do+ciclo.&tone=success",
    );
  });

  it("creates a Stripe checkout session for the selected plan", async () => {
    const upsertSubscription = vi.fn().mockResolvedValue({ error: null });
    const stripeCustomerCreate = vi.fn().mockResolvedValue({ id: "cus_123" });
    const stripeCheckoutCreate = vi.fn().mockResolvedValue({
      url: "https://checkout.stripe.com/session_123",
    });

    getStripeClientMock.mockReturnValue({
      customers: {
        create: stripeCustomerCreate,
      },
      checkout: {
        sessions: {
          create: stripeCheckoutCreate,
        },
      },
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "saas_plan_catalog") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: { id: "growth", display_name: "Growth" },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_subscriptions") {
          return {
            upsert: upsertSubscription,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      startStripeCheckoutActionImpl(
        makeFormData({
          planId: "growth",
          billingInterval: "yearly",
        }),
      ),
      redirectMock,
    );

    expect(stripeCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "owner@salon.fun",
        name: "Studio Centro",
        metadata: expect.objectContaining({ salonId: "salon-1" }),
      }),
    );
    expect(upsertSubscription).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        payment_provider: "stripe",
        provider_customer_id: "cus_123",
      }),
      { onConflict: "salon_id" },
    );
    expect(stripeCheckoutCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: "cus_123",
        client_reference_id: "salon-1",
        line_items: [{ price: "price_growth_yearly", quantity: 1 }],
      }),
    );
    expect(location).toBe("https://checkout.stripe.com/session_123");
  });

  it("opens the Stripe billing portal for linked customers", async () => {
    const stripePortalCreate = vi.fn().mockResolvedValue({
      url: "https://billing.stripe.com/session_123",
    });

    getSalonBillingSnapshotMock.mockResolvedValue({
      currentPlan: { id: "growth", displayName: "Growth" },
      subscription: {
        status: "active",
        billingInterval: "monthly",
        paymentProvider: "stripe",
        providerCustomerId: "cus_123",
        providerSubscriptionId: "sub_123",
        trialStartedAt: null,
        trialEndsAt: null,
        currentPeriodStartedAt: "2026-04-01T12:00:00.000Z",
        currentPeriodEndsAt: "2026-05-01T12:00:00.000Z",
        graceEndsAt: null,
        activatedAt: "2026-04-01T12:00:00.000Z",
        canceledAt: null,
      },
    });
    getStripeClientMock.mockReturnValue({
      billingPortal: {
        sessions: {
          create: stripePortalCreate,
        },
      },
    });

    const location = await captureRedirect(startStripeBillingPortalActionImpl(), redirectMock);

    expect(stripePortalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://painel.salon.fun/dashboard/billing",
    });
    expect(location).toBe("https://billing.stripe.com/session_123");
  });
});
