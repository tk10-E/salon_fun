import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  buildInstagramMetaRedirectUri,
  buildInstagramMetaAuthorizeUrl,
  createInstagramOAuthState,
  resolveInstagramOAuthState,
  pickInstagramPageAccount,
  verifyInstagramOAuthState,
} from "@/lib/instagram-oauth";

describe("instagram oauth helpers", () => {
  const originalConnectionSecret = process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET;
  const originalMetaAppId = process.env.INSTAGRAM_META_APP_ID;
  const originalMetaRedirectOrigin = process.env.INSTAGRAM_META_REDIRECT_ORIGIN;

  beforeEach(() => {
    process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET = "test-instagram-connection-secret";
    process.env.INSTAGRAM_META_APP_ID = "1490951809405535";
    delete process.env.INSTAGRAM_META_REDIRECT_ORIGIN;
  });

  afterEach(() => {
    process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET = originalConnectionSecret;
    process.env.INSTAGRAM_META_APP_ID = originalMetaAppId;
    process.env.INSTAGRAM_META_REDIRECT_ORIGIN = originalMetaRedirectOrigin;
  });

  it("round-trips the signed oauth state", () => {
    const state = createInstagramOAuthState("salon-1");
    const payload = verifyInstagramOAuthState(state);

    expect(payload.salonId).toBe("salon-1");
    expect(typeof payload.issuedAt).toBe("number");
  });

  it("builds the Meta authorize URL with the expected scope set", () => {
    const url = new URL(
      buildInstagramMetaAuthorizeUrl({
        redirectUri: "https://painel.example.com/dashboard/instagram/connect/callback",
        state: "signed-state",
      }),
    );

    expect(url.origin).toBe("https://www.facebook.com");
    expect(url.pathname).toContain("/dialog/oauth");
    expect(url.searchParams.get("client_id")).toBe("1490951809405535");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://painel.example.com/dashboard/instagram/connect/callback",
    );
    expect(url.searchParams.get("state")).toBe("signed-state");
    expect(url.searchParams.get("scope")).toContain("instagram_manage_comments");
    expect(url.searchParams.get("scope")).toContain("pages_show_list");
  });

  it("falls back to the cookie state when Meta does not echo the query state", () => {
    const state = createInstagramOAuthState("salon-cookie");
    const payload = resolveInstagramOAuthState(null, state);

    expect(payload.salonId).toBe("salon-cookie");
  });

  it("prefers the configured redirect origin for OAuth callbacks", () => {
    process.env.INSTAGRAM_META_REDIRECT_ORIGIN = "https://painel.jc7desenvolvimento.online/";

    expect(buildInstagramMetaRedirectUri("/dashboard/instagram/connect/callback")).toBe(
      "https://painel.jc7desenvolvimento.online/dashboard/instagram/connect/callback",
    );
  });

  it("falls back to the request URL base when no redirect origin is configured", () => {
    expect(
      buildInstagramMetaRedirectUri(
        "/dashboard/instagram/connect/callback",
        "https://preview.example.com/dashboard/instagram/connect",
      ),
    ).toBe("https://preview.example.com/dashboard/instagram/connect/callback");
  });

  it("rejects the callback when query state and cookie state disagree", () => {
    const state = createInstagramOAuthState("salon-1");
    const otherState = createInstagramOAuthState("salon-2");

    expect(() => resolveInstagramOAuthState(state, otherState)).toThrowError(
      "mismatched_instagram_oauth_state",
    );
  });

  it("prefers the saved page when multiple Meta pages are available", () => {
    const selectedAccount = pickInstagramPageAccount(
      [
        {
          id: "page-1",
          instagram_business_account: {
            id: "ig-1",
            username: "primeiro",
          },
        },
        {
          id: "page-2",
          instagram_business_account: {
            id: "ig-2",
            username: "segundo",
          },
        },
      ],
      {
        facebookPageId: "page-2",
      },
    );

    expect(selectedAccount?.id).toBe("page-2");
    expect(selectedAccount?.instagram_business_account?.username).toBe("segundo");
  });
});
