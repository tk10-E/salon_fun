import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  consumeSecurityRateLimitMock,
  createClientMock,
  recordSecurityAuditEventMock,
  redirectMock,
  registerSecurityRequestReplayMock,
} = vi.hoisted(() => ({
  consumeSecurityRateLimitMock: vi.fn(),
  createClientMock: vi.fn(),
  recordSecurityAuditEventMock: vi.fn(),
  redirectMock: vi.fn(),
  registerSecurityRequestReplayMock: vi.fn(),
}));

const headersMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("next/headers", () => ({
  headers: headersMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/lib/security", async () => {
  const actual = await vi.importActual<typeof import("@/lib/security")>(
    "@/lib/security",
  );

  return {
    ...actual,
    consumeSecurityRateLimit: consumeSecurityRateLimitMock,
    recordSecurityAuditEvent: recordSecurityAuditEventMock,
    registerSecurityRequestReplay: registerSecurityRequestReplayMock,
  };
});

import {
  runProtectedAction,
  runProtectedFormAction,
} from "@/app/_actions/security";

describe("security action guards", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    headersMock.mockResolvedValue({
      get(name: string) {
        switch (name) {
          case "origin":
            return "https://painel.salonfun.com.br";
          case "host":
            return "painel.salonfun.com.br";
          case "x-forwarded-proto":
            return "https";
          case "x-forwarded-for":
            return "203.0.113.10";
          case "cookie":
            return "sf_device_id=550e8400-e29b-41d4-a716-446655440000";
          default:
            return null;
        }
      },
    });
    consumeSecurityRateLimitMock.mockResolvedValue({
      allowed: true,
      attempts: 1,
      blockedUntil: null,
      retryAfterSeconds: 0,
      source: "memory",
    });
    createClientMock.mockReturnValue({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: {
            session: {
              user: {
                id: "user-1",
              },
            },
          },
        }),
      },
    });
    recordSecurityAuditEventMock.mockResolvedValue(undefined);
    registerSecurityRequestReplayMock.mockResolvedValue(true);
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("applies rate limits by IP and authenticated actor", async () => {
    const result = await runProtectedFormAction(
      async () => "ok",
      makeFormData({
        title: "Mensagem",
      }),
      {
        actionName: "notifications.send",
        fallbackPath: "/dashboard",
      },
    );

    expect(result).toBe("ok");
    expect(consumeSecurityRateLimitMock).toHaveBeenCalledTimes(2);
    expect(consumeSecurityRateLimitMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        key: "203.0.113.10",
        scope: "notifications.send.ip",
      }),
    );
    expect(consumeSecurityRateLimitMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        key: "user-1",
        scope: "notifications.send.actor",
      }),
    );
    expect(registerSecurityRequestReplayMock).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: "notifications.send",
      }),
    );
  });

  it("blocks duplicated action replays", async () => {
    registerSecurityRequestReplayMock.mockResolvedValue(false);

    const location = await captureRedirect(
      runProtectedAction(async () => "ok", {
        actionName: "billing.cancel_subscription",
        fallbackPath: "/dashboard",
      }),
      redirectMock,
    );

    expect(recordSecurityAuditEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        eventType: "billing.cancel_subscription.replay_blocked",
        severity: "warn",
      }),
    );
    expect(location).toBe(
      "/dashboard?message=Pedido+duplicado+bloqueado+por+seguran%C3%A7a.+Atualize+a+p%C3%A1gina+antes+de+tentar+de+novo.&tone=error",
    );
  });
});
