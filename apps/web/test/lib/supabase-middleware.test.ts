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
const originalVercel = process.env.VERCEL;
const originalVercelEnv = process.env.VERCEL_ENV;

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
    if (originalAppUrl === undefined) {
      delete process.env.APP_URL;
    } else {
      process.env.APP_URL = originalAppUrl;
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

    const request = new NextRequest("https://salon-fun.vercel.app/login?message=old");

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

    const request = new NextRequest("https://painel.jc7desenvovimento.online/login", {
      method: "POST",
    });

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

    const request = new NextRequest("https://painel.jc7desenvovimento.online/dashboard");
    const response = await updateSession(request);

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain("/login?message=");
    expect(response.headers.get("location")).toContain("Sessao+bloqueada+por+seguranca");
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

    const request = new NextRequest("https://painel.jc7desenvovimento.online/dashboard");
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

    const request = new NextRequest("https://painel.jc7desenvovimento.online/dashboard");
    const response = await updateSession(request);

    expect(signOut).toHaveBeenCalledWith({ scope: "local" });
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toContain(
      "Acesso+ao+painel+bloqueado+para+esta+localiza%C3%A7%C3%A3o.",
    );
  });
});
