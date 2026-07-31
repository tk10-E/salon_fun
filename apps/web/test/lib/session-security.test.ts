import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { evaluatePanelAccessPolicy } from "@/lib/sessionSecurity";

function buildAccessToken(
  aal: "aal1" | "aal2",
  extraPayload?: Record<string, unknown>,
) {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({ aal, ...extraPayload }),
  ).toString("base64url");

  return `${header}.${payload}.signature`;
}

function mockAdminClient(options?: {
  factors?: Array<{
    factor_type?: string | null;
    status?: string | null;
  }>;
  mfaTotpEnabled?: boolean;
}) {
  const factors = options?.factors ?? [];
  const mfaTotpEnabled = options?.mfaTotpEnabled ?? true;
  const listFactors = vi.fn().mockResolvedValue({
    data: { factors },
    error: null,
  });

  createAdminClientMock.mockReturnValue({
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "salon-1",
              salon_security_settings: {
                mfa_totp_enabled: mfaTotpEnabled,
                geo_allowlist_enabled: false,
                allowed_country_codes: [],
              },
            },
            error: null,
          }),
        })),
      })),
    })),
    auth: {
      admin: {
        mfa: {
          listFactors,
        },
      },
    },
  });

  return {
    listFactors,
  };
}

function mockSessionSecurityAdminClient(options?: {
  rpcData?: Record<string, unknown> | null;
  rpcError?: Error | { message: string } | null;
}) {
  const rpc = vi.fn().mockResolvedValue({
    data: options?.rpcData ?? null,
    error: options?.rpcError ?? null,
  });

  createAdminClientMock.mockReturnValue({
    rpc,
    from: vi.fn(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    })),
  });

  return {
    rpc,
  };
}

describe("session security access policy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does not require MFA when the salon policy is enabled but the user has no verified TOTP factor", async () => {
    const { listFactors } = mockAdminClient({
      factors: [
        {
          factor_type: "totp",
          status: "unverified",
        },
      ],
    });

    const evaluation = await evaluatePanelAccessPolicy({
      accessToken: buildAccessToken("aal1"),
      headerStore: new Headers({
        "x-vercel-ip-country": "BR",
      }),
      requestPath: "/dashboard",
      userId: "user-1",
    });

    expect(listFactors).toHaveBeenCalledWith({
      userId: "user-1",
    });
    expect(evaluation).toMatchObject({
      action: "allow",
      allowed: true,
      mfaTotpEnabled: false,
      reason: "verified_totp_factor_missing",
      salonId: "salon-1",
    });
  });

  it("requires MFA when the salon policy is enabled and the user has a verified TOTP factor", async () => {
    mockAdminClient({
      factors: [
        {
          factor_type: "totp",
          status: "verified",
        },
      ],
    });

    const evaluation = await evaluatePanelAccessPolicy({
      accessToken: buildAccessToken("aal1"),
      headerStore: new Headers({
        "x-vercel-ip-country": "BR",
      }),
      requestPath: "/dashboard",
      userId: "user-1",
    });

    expect(evaluation).toMatchObject({
      action: "mfa_required",
      allowed: false,
      mfaTotpEnabled: true,
      reason: "aal_upgrade_required",
      salonId: "salon-1",
    });
  });

  it("maps the relaxed low-risk idle timeout returned by session security", async () => {
    const { rpc } = mockSessionSecurityAdminClient({
      rpcData: {
        action: "allow",
        allowed: true,
        idle_timeout_seconds: 28800,
        risk_level: "low",
        suspicious_events: 0,
        suspicious_reason: null,
      },
    });
    const { evaluateSessionSecurity } = await import("@/lib/sessionSecurity");

    const evaluation = await evaluateSessionSecurity({
      accessToken: buildAccessToken("aal1", {
        session_id: "session-1",
      }),
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      headerStore: new Headers({
        "user-agent": "Vitest",
        "x-vercel-ip-country": "BR",
      }),
      requestPath: "/dashboard",
      userId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(rpc).toHaveBeenCalledWith(
      "upsert_session_security_context",
      expect.objectContaining({
        session_id_input: "session-1",
      }),
    );
    expect(evaluation).toMatchObject({
      action: "allow",
      allowed: true,
      idleTimeoutSeconds: 28800,
      riskLevel: "low",
      suspiciousEvents: 0,
    });
  });

  it("falls back to the relaxed default timeout when the security rpc is unavailable", async () => {
    mockSessionSecurityAdminClient({
      rpcError: new Error("rpc_unavailable"),
    });
    const { evaluateSessionSecurity } = await import("@/lib/sessionSecurity");

    const evaluation = await evaluateSessionSecurity({
      accessToken: buildAccessToken("aal1"),
      deviceId: "550e8400-e29b-41d4-a716-446655440000",
      headerStore: new Headers({
        "user-agent": "Vitest",
        "x-vercel-ip-country": "BR",
      }),
      requestPath: "/dashboard",
      userId: "550e8400-e29b-41d4-a716-446655440001",
    });

    expect(evaluation).toMatchObject({
      action: "allow",
      allowed: true,
      idleTimeoutSeconds: 28800,
      riskLevel: "low",
    });
  });
});
