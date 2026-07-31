import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getStripeBillingReadiness,
  mapStripeSubscriptionStatus,
  resolvePlanIdFromStripePriceId,
  webhookEndpointHandlesRequiredBillingEvents,
} from "@/lib/stripeBilling";

describe("stripe billing helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports missing Stripe configuration when the single paid plan is incomplete", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "");
    vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "");

    const readiness = getStripeBillingReadiness();

    expect(readiness.configured).toBe(false);
    expect(readiness.missing).toContain("STRIPE_SECRET_KEY");
    expect(readiness.missing).toContain("STRIPE_WEBHOOK_SECRET");
    expect(readiness.missing).toContain("STRIPE_PRICE_STARTER_MONTHLY");
    expect(readiness.missing).toContain("STRIPE_PRICE_STARTER_YEARLY");
  });

  it("requires both starter prices for new sales while keeping legacy price mapping", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_m");
    vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "price_starter_y");
    vi.stubEnv("STRIPE_PRICE_GROWTH_YEARLY", "price_growth_y");

    expect(resolvePlanIdFromStripePriceId("price_growth_y")).toEqual({
      planId: "growth",
      billingInterval: "yearly",
    });
    expect(getStripeBillingReadiness().configured).toBe(true);
  });

  it("maps Stripe subscription statuses to internal billing states", () => {
    expect(mapStripeSubscriptionStatus("active")).toBe("active");
    expect(mapStripeSubscriptionStatus("trialing")).toBe("trialing");
    expect(mapStripeSubscriptionStatus("past_due")).toBe("past_due");
    expect(mapStripeSubscriptionStatus("incomplete")).toBe("paused");
    expect(mapStripeSubscriptionStatus("unpaid")).toBe("paused");
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
  });

  it("checks whether the webhook listens to every billing event we depend on", () => {
    expect(
      webhookEndpointHandlesRequiredBillingEvents({
        enabled_events: [
          "checkout.session.completed",
          "customer.subscription.created",
          "customer.subscription.updated",
          "customer.subscription.deleted",
          "invoice.paid",
          "invoice.payment_failed",
        ],
      }),
    ).toBe(true);

    expect(
      webhookEndpointHandlesRequiredBillingEvents({
        enabled_events: [
          "checkout.session.completed",
          "customer.subscription.updated",
        ],
      }),
    ).toBe(false);
  });
});
