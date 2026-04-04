import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const { createServerClientMock } = vi.hoisted(() => ({
  createServerClientMock: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: createServerClientMock,
}));

vi.mock("@/lib/env", () => ({
  supabaseAnonKey: "test-anon-key",
  supabaseUrl: "https://project-ref.supabase.co",
}));

import { GET } from "@/app/auth/callback/route";

describe("auth callback route", () => {
  it("exchanges the auth code and returns the session cookies with the redirect", async () => {
    const exchangeCodeForSession = vi.fn().mockImplementation(async () => {
      const [, , options] = createServerClientMock.mock.calls.at(-1) ?? [];
      options.cookies.setAll([
        {
          name: "sb-test-auth-token",
          value: "session-token",
          options: {
            path: "/",
            httpOnly: true,
          },
        },
      ]);

      return { error: null };
    });

    createServerClientMock.mockReturnValue({
      auth: {
        exchangeCodeForSession,
      },
    });

    const request = new NextRequest("https://salon-fun.vercel.app/auth/callback?code=oauth-code&next=%2Fdashboard", {
      headers: {
        cookie: "sb-test-code-verifier=pkce-verifier",
        "x-forwarded-host": "salon-fun.vercel.app",
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("oauth-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://salon-fun.vercel.app/dashboard");
    expect(response.cookies.get("sb-test-auth-token")?.value).toBe("session-token");
  });

  it("reuses the same exchange flow for password recovery links", async () => {
    const exchangeCodeForSession = vi.fn().mockResolvedValue({ error: null });

    createServerClientMock.mockReturnValue({
      auth: {
        exchangeCodeForSession,
      },
    });

    const request = new NextRequest("https://salon-fun.vercel.app/auth/callback?code=recovery-code&next=%2Fauth%2Frecovery", {
      headers: {
        cookie: "sb-test-code-verifier=pkce-verifier",
        "x-forwarded-host": "salon-fun.vercel.app",
        "x-forwarded-proto": "https",
      },
    });

    const response = await GET(request);

    expect(exchangeCodeForSession).toHaveBeenCalledWith("recovery-code");
    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://salon-fun.vercel.app/auth/recovery");
  });
});
