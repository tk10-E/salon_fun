import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));
const {
  ensureResponseDeviceIdMock,
  evaluatePanelAccessPolicyMock,
  evaluateSessionSecurityMock,
  resolveRequestDeviceIdMock,
} = vi.hoisted(() => ({
  ensureResponseDeviceIdMock: vi.fn(),
  evaluatePanelAccessPolicyMock: vi.fn(),
  evaluateSessionSecurityMock: vi.fn(),
  resolveRequestDeviceIdMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/sessionSecurity", () => ({
  ensureResponseDeviceId: ensureResponseDeviceIdMock,
  evaluatePanelAccessPolicy: evaluatePanelAccessPolicyMock,
  evaluateSessionSecurity: evaluateSessionSecurityMock,
  resolveRequestDeviceId: resolveRequestDeviceIdMock,
}));

vi.mock("@/lib/env", () => ({
  supabaseAnonKey: "test-anon-key",
  supabaseUrl: "https://project-ref.supabase.co",
}));

import { updateSession } from "@/lib/supabase/middleware";

const originalAppUrl = process.env.APP_URL;
const originalServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const originalVercel = process.env.VERCEL;
const originalVercelEnv = process.env.VERCEL_ENV;
const authenticatedCookie = "sb-test-auth-token=session-token";

describe("supabase middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureResponseDeviceIdMock.mockReturnValue("device-123");
    evaluateSessionSecurityMock.mockResolvedValue({
      action: "allow",
      allowed: true,
      idleTimeoutSeconds: 3600,
      riskLevel: "low",
      sessionId: "session-1",
      suspiciousEvents: 0,
      suspiciousReason: null,
    });
    evaluatePanelAccessPolicyMock.mockResolvedValue({
      action: "allow",
      allowed: true,
      countryCode: "BR",
      geoAllowlistEnabled: false,
      mfaCurrentLevel: "aal2",
      mfaTotpEnabled: false,
      reason: null,
      salonId: "salon-1",
    });
    resolveRequestDeviceIdMock.mockReturnValue("device-123");
  });

  afterEach(() => {
    vi.useRealTimers();

    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
    }

    if (originalServiceRoleKey === undefined) {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    } else {
      process.env.SUPABASE_SERVICE_ROLE_KEY = originalServiceRoleKey;
    }

    if (originalVercel === undefined) {
      delete process.env.VERCEL;
    } else {
      process.env.VERCEL = originalVercel;
    }

    if (originalVercelEnv === undefined) {
      delete process.env.VERCEL_ENV;
    } else {
      process.env.VERCEL_ENV = originalVercelEnv;
    }
  });

  it("redirects GET requests to the configured canonical production origin", async () => {
    process.env.APP_URL = "https://painel.jc7desenvovimento.online";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";

    const request = new NextRequest(
      "https://salon-fun.vercel.app/login?message=old",
    );

    const response = await updateSession(request);

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "https://painel.jc7desenvovimento.online/login?message=old",
    );
    expect(createServerClientMock).not.toHaveBeenCalled();
  });

  it("keeps non-GET requests on the current origin and refreshes auth state", async () => {
    process.env.APP_URL = "https://painel.jc7desenvovimento.online";
    process.env.VERCEL = "1";
    process.env.VERCEL_ENV = "production";

    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });
    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/login",
      {
        headers: {
          cookie: authenticatedCookie,
        },
        method: "POST",
      },
    );

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(getUser).toHaveBeenCalled();
    expect(getSession).toHaveBeenCalled();
    expect(evaluateSessionSecurityMock).toHaveBeenCalledWith(
      expect.objectContaining({
        deviceId: "device-123",
        requestPath: "/login",
        userId: "user-1",
      }),
    );
    expect(evaluatePanelAccessPolicyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        requestPath: "/login",
        userId: "user-1",
      }),
    );
  });

  it("skips the Supabase auth refresh when the request has no auth cookie", async () => {
    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/login",
    );

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(createServerClientMock).not.toHaveBeenCalled();
    expect(evaluateSessionSecurityMock).not.toHaveBeenCalled();
    expect(evaluatePanelAccessPolicyMock).not.toHaveBeenCalled();
  });

  it("fails open when getUser exceeds the middleware deadline", async () => {
    vi.useFakeTimers();

    const getUser = vi.fn().mockImplementation(
      () => new Promise(() => {}),
    );
    createServerClientMock.mockReturnValue({
      auth: {
        getUser,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard/feed",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );

    const responsePromise = updateSession(request);
    await vi.advanceTimersByTimeAsync(3000);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Panel-Session-Timeout")).toContain(
      "get-user",
    );
  });

  it("reuses a short signed security cache for repeated authenticated GET requests", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-cache-secret";

    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });
    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
      },
    });

    const firstRequest = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard",
      {
        headers: {
          cookie: authenticatedCookie,
          "user-agent": "Vitest",
          "x-vercel-ip-country": "BR",
        },
      },
    );
    const firstResponse = await updateSession(firstRequest);
    const cacheCookie = firstResponse.cookies.get("sf_panel_security_ok");

    expect(cacheCookie?.value).toBeTruthy();
    expect(firstResponse.headers.get("X-Panel-Security-Cache")).toBe("miss");
    expect(evaluateSessionSecurityMock).toHaveBeenCalledTimes(1);
    expect(evaluatePanelAccessPolicyMock).toHaveBeenCalledTimes(1);

    evaluateSessionSecurityMock.mockClear();
    evaluatePanelAccessPolicyMock.mockClear();

    const secondRequest = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard/appointments",
      {
        headers: {
          cookie: `${authenticatedCookie}; sf_device_id=device-123; sf_panel_security_ok=${cacheCookie?.value}`,
          "user-agent": "Vitest",
          "x-vercel-ip-country": "BR",
        },
      },
    );
    const secondResponse = await updateSession(secondRequest);

    expect(secondResponse.headers.get("X-Panel-Security-Cache")).toBe("hit");
    expect(evaluateSessionSecurityMock).not.toHaveBeenCalled();
    expect(evaluatePanelAccessPolicyMock).not.toHaveBeenCalled();
  });

  it("preserves all refreshed auth cookie chunks when Supabase rotates the session", async () => {
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });

    createServerClientMock.mockImplementation((_url, _key, options: any) => ({
      auth: {
        getSession,
        getUser: vi.fn().mockImplementation(async () => {
          await options.cookies.setAll([
            {
              name: "sb-test-auth-token.0",
              value: "chunk-a",
              path: "/",
            },
            {
              name: "sb-test-auth-token.1",
              value: "chunk-b",
              path: "/",
            },
          ]);

          return {
            data: { user: { id: "user-1" } },
            error: null,
          };
        }),
      },
    }));

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );

    const response = await updateSession(request);
    const refreshedCookies = response.cookies
      .getAll()
      .filter((cookie) => cookie.name.startsWith("sb-test-auth-token."));

    expect(response.status).toBe(200);
    expect(refreshedCookies).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "sb-test-auth-token.0",
          value: "chunk-a",
        }),
        expect.objectContaining({
          name: "sb-test-auth-token.1",
          value: "chunk-b",
        }),
      ]),
    );
  });

  it("fails open when session security evaluation exceeds the middleware deadline", async () => {
    vi.useFakeTimers();

    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });

    evaluateSessionSecurityMock.mockImplementation(
      () => new Promise(() => {}),
    );

    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard/feed",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );

    const responsePromise = updateSession(request);
    await vi.advanceTimersByTimeAsync(3000);
    const response = await responsePromise;

    expect(response.status).toBe(200);
    expect(response.headers.get("X-Panel-Security-Cache")).toBe("miss");
    expect(response.headers.get("X-Panel-Session-Timeout")).toContain(
      "session-access",
    );
  });

  it("redirects to login when the active session is blocked by session security", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    evaluateSessionSecurityMock.mockResolvedValue({
      action: "revoke",
      allowed: false,
      idleTimeoutSeconds: 900,
      riskLevel: "high",
      sessionId: "session-1",
      suspiciousEvents: 2,
      suspiciousReason: "device_mismatch",
    });

    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
        signOut,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );
    const response = await updateSession(request);

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?message=");
    expect(response.headers.get("location")).toContain(
      "Sess%C3%A3o+bloqueada+por+seguran%C3%A7a",
    );
  });

  it("returns 401 for internal session ping requests and preserves the cleared auth cookie", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });
    const signOut = vi.fn().mockImplementation(async () => {
      const createServerClientCall = createServerClientMock.mock.calls.at(-1);
      const options = createServerClientCall?.[2];
      await options.cookies.setAll([
        {
          name: "sb-test-auth-token",
          value: "",
          maxAge: 0,
          path: "/",
        },
      ]);
      return { error: null };
    });

    evaluateSessionSecurityMock.mockResolvedValue({
      action: "expired",
      allowed: false,
      idleTimeoutSeconds: 28800,
      riskLevel: "low",
      sessionId: "session-1",
      suspiciousEvents: 0,
      suspiciousReason: "idle_timeout",
    });

    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
        refreshSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: new Error("refresh_failed"),
        }),
        signOut,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/api/internal/session/ping",
      {
        headers: {
          cookie: authenticatedCookie,
          "x-panel-keepalive": "1",
        },
      },
    );

    const response = await updateSession(request);
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload).toEqual({
      error: "unauthorized",
      ok: false,
    });
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("");
  });

  it("refreshes the Supabase session once before redirecting an idle panel session", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "expired-token",
        },
      },
      error: null,
    });
    const refreshSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "fresh-token",
        },
      },
      error: null,
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    evaluateSessionSecurityMock
      .mockResolvedValueOnce({
        action: "expired",
        allowed: false,
        idleTimeoutSeconds: 28800,
        riskLevel: "low",
        sessionId: "session-old",
        suspiciousEvents: 0,
        suspiciousReason: "idle_timeout",
      })
      .mockResolvedValueOnce({
        action: "allow",
        allowed: true,
        idleTimeoutSeconds: 28800,
        riskLevel: "low",
        sessionId: "session-new",
        suspiciousEvents: 0,
        suspiciousReason: null,
      });

    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
        refreshSession,
        signOut,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard/gestao/agendamentos",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );

    const response = await updateSession(request);

    expect(response.status).toBe(200);
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
    expect(evaluateSessionSecurityMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        accessToken: "expired-token",
      }),
    );
    expect(evaluateSessionSecurityMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        accessToken: "fresh-token",
      }),
    );
    expect(response.headers.get("X-Panel-Session-Recovered")).toBe(
      "refreshed",
    );
  });

  it("redirects to login without signing out when MFA is still required", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    evaluatePanelAccessPolicyMock.mockResolvedValue({
      action: "mfa_required",
      allowed: false,
      countryCode: "BR",
      geoAllowlistEnabled: false,
      mfaCurrentLevel: "aal1",
      mfaTotpEnabled: true,
      reason: "aal_upgrade_required",
      salonId: "salon-1",
    });

    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
        signOut,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );
    const response = await updateSession(request);

    expect(signOut).not.toHaveBeenCalled();
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "Confirme+o+c%C3%B3digo+do+autenticador+para+continuar.",
    );
  });

  it("signs out and redirects to login when the current country is blocked", async () => {
    const getUser = vi.fn().mockResolvedValue({
      data: { user: { id: "user-1" } },
      error: null,
    });
    const getSession = vi.fn().mockResolvedValue({
      data: {
        session: {
          access_token: "header.payload.signature",
        },
      },
      error: null,
    });
    const signOut = vi.fn().mockResolvedValue({ error: null });

    evaluatePanelAccessPolicyMock.mockResolvedValue({
      action: "geo_blocked",
      allowed: false,
      countryCode: "FR",
      geoAllowlistEnabled: true,
      mfaCurrentLevel: "aal2",
      mfaTotpEnabled: false,
      reason: "country_not_allowed",
      salonId: "salon-1",
    });

    createServerClientMock.mockReturnValue({
      auth: {
        getSession,
        getUser,
        signOut,
      },
    });

    const request = new NextRequest(
      "https://painel.jc7desenvovimento.online/dashboard",
      {
        headers: {
          cookie: authenticatedCookie,
        },
      },
    );
    const response = await updateSession(request);

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "Acesso+ao+painel+bloqueado+para+esta+localiza%C3%A7%C3%A3o.",
    );
  });
});
