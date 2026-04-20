import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { syncStripeSubscriptionRecord } from "@/lib/stripeBillingSync";

function makeAdminClient(params: {
  existingSubscription: Record<string, unknown> | null;
  upsertMock: ReturnType<typeof vi.fn>;
}) {
  return {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: params.existingSubscription,
            error: null,
          }),
        })),
      })),
      upsert: params.upsertMock,
    })),
  };
}

describe("stripe billing sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T12:00:00.000Z"));
    vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_m");
    vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "price_starter_y");
    vi.stubEnv("STRIPE_PRICE_GROWTH_MONTHLY", "price_growth_m");
    vi.stubEnv("STRIPE_PRICE_GROWTH_YEARLY", "price_growth_y");
    vi.stubEnv("STRIPE_PRICE_PREMIUM_MONTHLY", "price_premium_m");
    vi.stubEnv("STRIPE_PRICE_PREMIUM_YEARLY", "price_premium_y");
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("keeps the original grace window instead of extending every past_due webhook", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue(
      makeAdminClient({
        existingSubscription: {
          salon_id: "salon-1",
          plan_id: "starter",
          activated_at: "2026-03-01T12:00:00.000Z",
          status: "past_due",
          grace_ends_at: "2026-04-03T12:00:00.000Z",
        },
        upsertMock,
      }),
    );

    await syncStripeSubscriptionRecord({
      id: "sub_123",
      customer: "cus_123",
      status: "past_due",
      metadata: {
        salonId: "salon-1",
        planId: "starter",
      },
      items: {
        data: [
          {
            price: {
              id: "price_starter_m",
              recurring: { interval: "month" },
            },
          },
        ],
      },
      trial_start: null,
      trial_end: null,
      canceled_at: null,
      current_period_start: 1_743_595_200,
      current_period_end: 1_746_187_200,
    } as never);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        status: "past_due",
        grace_ends_at: "2026-04-03T12:00:00.000Z",
      }),
      { onConflict: "salon_id" },
    );
  });

  it("prefers the billed Stripe price over stale metadata when resolving the plan", async () => {
    const upsertMock = vi.fn().mockResolvedValue({ error: null });
    createAdminClientMock.mockReturnValue(
      makeAdminClient({
        existingSubscription: {
          salon_id: "salon-1",
          plan_id: "starter",
          activated_at: "2026-03-01T12:00:00.000Z",
          status: "active",
          grace_ends_at: null,
        },
        upsertMock,
      }),
    );

    await syncStripeSubscriptionRecord({
      id: "sub_123",
      customer: "cus_123",
      status: "active",
      metadata: {
        salonId: "salon-1",
        planId: "starter",
      },
      items: {
        data: [
          {
            price: {
              id: "price_growth_y",
              recurring: { interval: "year" },
            },
          },
        ],
      },
      trial_start: null,
      trial_end: null,
      canceled_at: null,
      current_period_start: 1_743_595_200,
      current_period_end: 1_775_131_200,
    } as never);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        plan_id: "growth",
        billing_interval: "yearly",
      }),
      { onConflict: "salon_id" },
    );
  });
});
