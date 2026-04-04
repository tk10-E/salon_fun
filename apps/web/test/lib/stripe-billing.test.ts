import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getStripeBillingReadiness,
  mapStripeSubscriptionStatus,
  resolvePlanIdFromStripePriceId,
} from "@/lib/stripeBilling";

describe("stripe billing helpers", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("reports missing Stripe configuration when env vars are incomplete", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "");
    vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "");

    const readiness = getStripeBillingReadiness();

    expect(readiness.configured).toBe(false);
    expect(readiness.missing).toContain("STRIPE_SECRET_KEY");
    expect(readiness.missing).toContain("STRIPE_WEBHOOK_SECRET");
  });

  it("resolves plan and interval from Stripe price ids", () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_123");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
    vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_m");
    vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "price_starter_y");
    vi.stubEnv("STRIPE_PRICE_GROWTH_MONTHLY", "price_growth_m");
    vi.stubEnv("STRIPE_PRICE_GROWTH_YEARLY", "price_growth_y");
    vi.stubEnv("STRIPE_PRICE_PREMIUM_MONTHLY", "price_premium_m");
    vi.stubEnv("STRIPE_PRICE_PREMIUM_YEARLY", "price_premium_y");

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
    expect(mapStripeSubscriptionStatus("canceled")).toBe("canceled");
  });
});
