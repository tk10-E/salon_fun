import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  constructEventMock,
  getStripeWebhookSecretMock,
  recordSecurityAuditEventMock,
  registerSecurityRequestReplayMock,
  syncStripeSubscriptionRecordMock,
} = vi.hoisted(() => ({
  constructEventMock: vi.fn(),
  getStripeWebhookSecretMock: vi.fn(),
  recordSecurityAuditEventMock: vi.fn(),
  registerSecurityRequestReplayMock: vi.fn(),
  syncStripeSubscriptionRecordMock: vi.fn(),
}));

vi.mock("@/lib/serverEnv", () => ({
  getStripeWebhookSecret: getStripeWebhookSecretMock,
}));

vi.mock("@/lib/stripeBilling", () => ({
  getStripeClient: vi.fn(() => ({
    webhooks: {
      constructEvent: constructEventMock,
    },
  })),
}));

vi.mock("@/lib/stripeBillingSync", () => ({
  syncStripeSubscriptionRecord: syncStripeSubscriptionRecordMock,
}));

vi.mock("@/lib/security", () => ({
  recordSecurityAuditEvent: recordSecurityAuditEventMock,
  registerSecurityRequestReplay: registerSecurityRequestReplayMock,
}));

import { POST } from "@/app/api/stripe/webhook/route";

describe("stripe webhook route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("processes the event before marking duplicates and reports duplicate delivery", async () => {
    getStripeWebhookSecretMock.mockReturnValue("whsec_live");
    constructEventMock.mockReturnValue({
      id: "evt_duplicate",
      type: "customer.subscription.updated",
      data: {
        object: {
          id: "sub_123",
        },
      },
    });
    syncStripeSubscriptionRecordMock.mockResolvedValue(undefined);
    registerSecurityRequestReplayMock.mockResolvedValue(false);

    const response = await POST(
      new Request("https://painel.example/api/stripe/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=test",
          "user-agent": "vitest",
        },
        body: JSON.stringify({ ok: true }),
      }),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      duplicate: true,
      received: true,
    });
    expect(syncStripeSubscriptionRecordMock).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "sub_123",
      }),
    );
    expect(registerSecurityRequestReplayMock).toHaveBeenCalledWith({
      requestHash: "evt_duplicate",
      scope: "stripe.webhook.event",
      ttlSeconds: 60 * 60 * 24 * 30,
    });
    expect(
      syncStripeSubscriptionRecordMock.mock.invocationCallOrder[0],
    ).toBeLessThan(registerSecurityRequestReplayMock.mock.invocationCallOrder[0]);
    expect(recordSecurityAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "stripe.webhook_duplicate_event",
        metadata: {
          eventId: "evt_duplicate",
          eventType: "customer.subscription.updated",
        },
      }),
    );
  });

  it("returns 400 and records the failure when Stripe signature validation breaks", async () => {
    getStripeWebhookSecretMock.mockReturnValue("whsec_live");
    constructEventMock.mockImplementation(() => {
      throw new Error("invalid signature");
    });

    const response = await POST(
      new Request("https://painel.example/api/stripe/webhook", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "stripe-signature": "t=1,v1=invalid",
          "user-agent": "vitest",
        },
        body: JSON.stringify({ ok: false }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "stripe_webhook_failed",
    });
    expect(syncStripeSubscriptionRecordMock).not.toHaveBeenCalled();
    expect(registerSecurityRequestReplayMock).not.toHaveBeenCalled();
    expect(recordSecurityAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "stripe.webhook_failed",
        severity: "warn",
      }),
    );
  });
});
