import { beforeEach, describe, expect, it, vi } from "vitest";

const { createAdminClientMock } = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

import { evaluatePanelAccessPolicy } from "@/lib/sessionSecurity";

function buildAccessToken(aal: "aal1" | "aal2") {
  const header = Buffer.from(
    JSON.stringify({ alg: "HS256", typ: "JWT" }),
  ).toString("base64url");
  const payload = Buffer.from(JSON.stringify({ aal })).toString("base64url");

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
});
