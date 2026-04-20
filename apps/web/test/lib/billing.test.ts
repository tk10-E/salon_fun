import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

async function importBillingModule() {
  vi.resetModules();
  vi.stubEnv("ENABLE_SAAS_BILLING", "true");
  vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_123");
  vi.stubEnv("STRIPE_WEBHOOK_SECRET", "whsec_123");
  vi.stubEnv("STRIPE_PRICE_STARTER_MONTHLY", "price_starter_m");
  vi.stubEnv("STRIPE_PRICE_STARTER_YEARLY", "price_starter_y");
  vi.stubEnv("STRIPE_PRICE_GROWTH_MONTHLY", "price_growth_m");
  vi.stubEnv("STRIPE_PRICE_GROWTH_YEARLY", "price_growth_y");
  vi.stubEnv("STRIPE_PRICE_PREMIUM_MONTHLY", "price_premium_m");
  vi.stubEnv("STRIPE_PRICE_PREMIUM_YEARLY", "price_premium_y");

  return import("@/lib/billing");
}

describe("billing helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-02T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("falls back to a locked starter subscription when billing tables are missing", async () => {
    const { getSalonBillingSnapshot } = await importBillingModule();

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "saas_plan_catalog") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: "PGRST205",
                    message: 'Could not find the table "public.saas_plan_catalog" in the schema cache',
                  },
                }),
              })),
            })),
          };
        }

        if (table === "salon_subscriptions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: {
                    code: "PGRST205",
                    message: 'Could not find the table "public.salon_subscriptions" in the schema cache',
                  },
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const snapshot = await getSalonBillingSnapshot("salon-fallback");

    expect(snapshot.isUsingFallback).toBe(true);
    expect(snapshot.currentPlan.id).toBe("starter");
    expect(snapshot.subscription.status).toBe("paused");
    expect(snapshot.isLocked).toBe(true);
    expect(snapshot.statusLabel).toBe("Aguardando assinatura");
  });

  it("hydrates the current plan and access state from billing tables", async () => {
    const { getSalonBillingSnapshot } = await importBillingModule();

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "saas_plan_catalog") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn().mockResolvedValue({
                  data: [
                    {
                      id: "starter",
                      display_name: "Starter",
                      description: "Base",
                      monthly_price: 79,
                      yearly_price: 790,
                      currency_code: "BRL",
                      trial_days: 14,
                      max_staff_members: 3,
                      max_services: 25,
                      max_monthly_notifications: 1500,
                      includes_growth_automation: false,
                      includes_feed_video: false,
                      includes_custom_branding: true,
                      includes_priority_support: false,
                      is_default: true,
                      is_public: true,
                      sort_order: 10,
                      metadata: { highlight: "Starter" },
                    },
                    {
                      id: "growth",
                      display_name: "Growth",
                      description: "Scale",
                      monthly_price: 149,
                      yearly_price: 1490,
                      currency_code: "BRL",
                      trial_days: 7,
                      max_staff_members: 8,
                      max_services: 80,
                      max_monthly_notifications: 10000,
                      includes_growth_automation: true,
                      includes_feed_video: true,
                      includes_custom_branding: true,
                      includes_priority_support: false,
                      is_default: false,
                      is_public: true,
                      sort_order: 20,
                      metadata: { highlight: "Growth" },
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "salon_subscriptions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    id: "sub-1",
                    salon_id: "salon-growth",
                    plan_id: "growth",
                    status: "active",
                    billing_interval: "yearly",
                    trial_started_at: null,
                    trial_ends_at: null,
                    current_period_started_at: "2026-04-01T12:00:00.000Z",
                    current_period_ends_at: "2027-04-01T12:00:00.000Z",
                    grace_ends_at: null,
                    activated_at: "2026-04-01T12:00:00.000Z",
                    canceled_at: null,
                    payment_provider: "stripe",
                    provider_customer_id: "cust-1",
                    provider_subscription_id: "sub-ext-1",
                    created_at: "2026-04-01T12:00:00.000Z",
                    updated_at: "2026-04-01T12:00:00.000Z",
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const snapshot = await getSalonBillingSnapshot("salon-growth");

    expect(snapshot.isUsingFallback).toBe(false);
    expect(snapshot.currentPlan.id).toBe("growth");
    expect(snapshot.currentPlan.includesFeedVideo).toBe(true);
    expect(snapshot.accessState).toBe("healthy");
    expect(snapshot.statusLabel).toBe("Ativa");
    expect(snapshot.nextBillingDateLabel).toBeTruthy();
  });

  it("formats price and limits for the billing UI", async () => {
    const { formatBillingPrice, formatLimitLabel } = await importBillingModule();

    expect(formatBillingPrice(149)).toMatch(/149/);
    expect(formatLimitLabel(null, "serviço", "serviços")).toBe("Ilimitado");
    expect(formatLimitLabel(3, "profissional", "profissionais")).toBe("3 profissionais");
  });
});
