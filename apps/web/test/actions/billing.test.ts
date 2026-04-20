import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  buildAbsoluteUrlMock,
  createClientMock,
  getSalonBillingWorkspaceSnapshotMock,
  getStripeBillingReadinessMock,
  getStripeClientMock,
  getStripeOperationalStatusMock,
  resolveStripePriceIdMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  buildAbsoluteUrlMock: vi.fn(),
  createClientMock: vi.fn(),
  getSalonBillingWorkspaceSnapshotMock: vi.fn(),
  getStripeBillingReadinessMock: vi.fn(),
  getStripeClientMock: vi.fn(),
  getStripeOperationalStatusMock: vi.fn(),
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

vi.mock("@/lib/billing", () => ({
  BILLING_DISABLED: false,
  BILLING_PATH: "/dashboard/billing",
  PUBLIC_BILLING_PATH: "/planos",
  getSalonBillingWorkspaceSnapshot: getSalonBillingWorkspaceSnapshotMock,
}));

vi.mock("@/lib/requestOrigin", () => ({
  buildAbsoluteUrl: buildAbsoluteUrlMock,
}));

vi.mock("@/lib/stripeBilling", () => ({
  getStripeBillingReadiness: getStripeBillingReadinessMock,
  getStripeClient: getStripeClientMock,
  getStripeOperationalStatus: getStripeOperationalStatusMock,
  isTerminalStripeSubscriptionStatus: (status: string) =>
    status === "canceled" || status === "incomplete_expired",
  resolveStripePriceId: resolveStripePriceIdMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  changeSalonPlanActionImpl,
  startStripeBillingPortalActionImpl,
  startStripeCheckoutActionImpl,
} from "@/app/_actions/billing";

function makeWorkspaceSnapshot(overrides?: Record<string, unknown>) {
  return {
    currentPlan: {
      id: "starter",
      displayName: "Starter",
    },
    subscription: {
      status: "paused",
      billingInterval: "monthly",
      paymentProvider: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStartedAt: null,
      currentPeriodEndsAt: null,
      graceEndsAt: null,
      activatedAt: null,
      canceledAt: null,
      ...overrides,
    },
  };
}

describe("billing actions", () => {
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
    getStripeOperationalStatusMock.mockResolvedValue({
      configured: true,
      mode: "live",
      liveReady: true,
      issues: [],
      activePortalConfigCount: 1,
      portalConfigured: true,
      billingPortalReturnUrl: "https://painel.salon.fun/dashboard/billing",
      webhookConfigured: true,
      webhookUrl: "https://painel.salon.fun/api/stripe/webhook",
    });
    resolveStripePriceIdMock.mockReturnValue("price_growth_yearly");
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue(makeWorkspaceSnapshot());
  });

  it("creates a Stripe checkout session for a new subscription", async () => {
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

  it("redirects to the billing portal instead of creating a duplicate subscription", async () => {
    const stripeCheckoutCreate = vi.fn();
    const stripePortalCreate = vi.fn().mockResolvedValue({
      url: "https://billing.stripe.com/session_existing",
    });
    const stripeRetrieveSubscription = vi.fn().mockResolvedValue({
      id: "sub_123",
      status: "active",
    });

    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue(
      makeWorkspaceSnapshot({
        status: "active",
        paymentProvider: "stripe",
        providerCustomerId: "cus_123",
        providerSubscriptionId: "sub_123",
        activatedAt: "2026-04-01T12:00:00.000Z",
      }),
    );
    getStripeClientMock.mockReturnValue({
      subscriptions: {
        retrieve: stripeRetrieveSubscription,
      },
      billingPortal: {
        sessions: {
          create: stripePortalCreate,
        },
      },
      checkout: {
        sessions: {
          create: stripeCheckoutCreate,
        },
      },
    });
    createClientMock.mockReturnValue({
      from: vi.fn(() => {
        throw new Error("Supabase should not be queried before portal redirection.");
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

    expect(stripeRetrieveSubscription).toHaveBeenCalledWith("sub_123");
    expect(stripePortalCreate).toHaveBeenCalledWith({
      customer: "cus_123",
      return_url: "https://painel.salon.fun/dashboard/billing",
    });
    expect(stripeCheckoutCreate).not.toHaveBeenCalled();
    expect(location).toBe("https://billing.stripe.com/session_existing");
  });

  it("blocks direct local plan changes when the Stripe subscription is already linked", async () => {
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue(
      makeWorkspaceSnapshot({
        status: "active",
        paymentProvider: "stripe",
        providerCustomerId: "cus_123",
        providerSubscriptionId: "sub_123",
      }),
    );

    const location = await captureRedirect(
      changeSalonPlanActionImpl(
        makeFormData({
          planId: "growth",
          billingInterval: "yearly",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/billing?message=Use+a+gest%C3%A3o+da+assinatura+para+trocar+o+plano+sem+criar+cobran%C3%A7a+duplicada.&tone=info",
    );
  });

  it("opens the Stripe billing portal for linked customers", async () => {
    const stripePortalCreate = vi.fn().mockResolvedValue({
      url: "https://billing.stripe.com/session_123",
    });

    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue(
      makeWorkspaceSnapshot({
        status: "active",
        paymentProvider: "stripe",
        providerCustomerId: "cus_123",
        providerSubscriptionId: "sub_123",
        currentPeriodStartedAt: "2026-04-01T12:00:00.000Z",
        currentPeriodEndsAt: "2026-05-01T12:00:00.000Z",
        activatedAt: "2026-04-01T12:00:00.000Z",
      }),
    );
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
