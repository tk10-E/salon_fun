import { afterEach, describe, expect, it } from "vitest";

import { getConfiguredAppOrigin, resolveRequestOriginFromRequest } from "@/lib/requestOrigin";

const originalAppUrl = process.env.APP_URL;
const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) {
    delete process.env.APP_URL;
  } else {
    process.env.APP_URL = originalAppUrl;
  }

  if (originalPublicAppUrl === undefined) {
    delete process.env.NEXT_PUBLIC_APP_URL;
  } else {
    process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
  }
});

describe("request origin helpers", () => {
  it("normalizes the configured APP_URL origin", () => {
    process.env.APP_URL = "https://painel.salonfun.com.br/login?from=invite";
    delete process.env.NEXT_PUBLIC_APP_URL;

    expect(getConfiguredAppOrigin()).toBe("https://painel.salonfun.com.br");
  });

  it("falls back to forwarded headers when no configured origin exists", () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;

    const request = new Request("http://127.0.0.1:3000/auth/callback", {
      headers: {
        "x-forwarded-host": "painel.salonfun.com.br",
        "x-forwarded-proto": "https",
      },
    });

    expect(resolveRequestOriginFromRequest(request)).toBe("https://painel.salonfun.com.br");
  });
});
