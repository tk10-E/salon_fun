import { Buffer } from "node:buffer";
import { createHmac, timingSafeEqual } from "node:crypto";

export const INSTAGRAM_META_GRAPH_VERSION = "v23.0";
export const INSTAGRAM_OAUTH_STATE_COOKIE = "instagram_meta_oauth_state";
export const INSTAGRAM_META_OAUTH_SCOPES = [
  "instagram_basic",
  "instagram_manage_comments",
  "pages_manage_metadata",
  "pages_show_list",
  "pages_read_engagement",
  "pages_read_user_content",
  "business_management",
] as const;

type InstagramOAuthStatePayload = {
  salonId: string;
  issuedAt: number;
};

export type InstagramMetaPageAccount = {
  id: string;
  name?: string;
  access_token?: string;
  instagram_business_account?: {
    id?: string;
    username?: string;
  } | null;
};

type PreferredInstagramConnection = {
  facebookPageId?: string | null;
  instagramUserId?: string | null;
  instagramUsername?: string | null;
};

function getInstagramOAuthStateSecret() {
  const secret = process.env.INSTAGRAM_CONNECTION_TOKEN_SECRET?.trim();

  if (!secret) {
    throw new Error("INSTAGRAM_CONNECTION_TOKEN_SECRET is not configured.");
  }

  return secret;
}

function signInstagramOAuthState(encodedPayload: string) {
  return createHmac("sha256", getInstagramOAuthStateSecret())
    .update(encodedPayload)
    .digest("base64url");
}

export function getInstagramMetaAppId() {
  const appId = process.env.INSTAGRAM_META_APP_ID?.trim();

  if (!appId) {
    throw new Error("INSTAGRAM_META_APP_ID is not configured.");
  }

  return appId;
}

export function getInstagramMetaAppSecret() {
  const appSecret = process.env.INSTAGRAM_META_APP_SECRET?.trim();

  if (!appSecret) {
    throw new Error("INSTAGRAM_META_APP_SECRET is not configured.");
  }

  return appSecret;
}

export function getInstagramMetaConfigId() {
  return process.env.INSTAGRAM_META_CONFIG_ID?.trim() || null;
}

export function getInstagramMetaRedirectOrigin() {
  const rawOrigin = process.env.INSTAGRAM_META_REDIRECT_ORIGIN?.trim();

  if (!rawOrigin) {
    return null;
  }

  const parsedOrigin = new URL(rawOrigin);

  if (parsedOrigin.protocol !== "https:" && parsedOrigin.protocol !== "http:") {
    throw new Error("INSTAGRAM_META_REDIRECT_ORIGIN must use http or https.");
  }

  parsedOrigin.pathname = "/";
  parsedOrigin.search = "";
  parsedOrigin.hash = "";

  return parsedOrigin.origin;
}

export function buildInstagramMetaRedirectUri(pathname: string, fallbackBaseUrl?: string) {
  const configuredOrigin = getInstagramMetaRedirectOrigin();

  if (configuredOrigin) {
    return new URL(pathname, configuredOrigin).toString();
  }

  if (!fallbackBaseUrl) {
    throw new Error(
      "INSTAGRAM_META_REDIRECT_ORIGIN is not configured and no fallback base URL was provided.",
    );
  }

  return new URL(pathname, fallbackBaseUrl).toString();
}

export function createInstagramOAuthState(salonId: string) {
  const payload = Buffer.from(
    JSON.stringify({
      salonId,
      issuedAt: Date.now(),
    } satisfies InstagramOAuthStatePayload),
    "utf8",
  ).toString("base64url");

  return `${payload}.${signInstagramOAuthState(payload)}`;
}

export function verifyInstagramOAuthState(rawState: string, maxAgeMs = 10 * 60 * 1000) {
  const [encodedPayload, signature] = rawState.split(".", 2);

  if (!encodedPayload || !signature) {
    throw new Error("invalid_instagram_oauth_state");
  }

  const expectedSignature = signInstagramOAuthState(encodedPayload);
  const expectedBuffer = Buffer.from(expectedSignature);
  const actualBuffer = Buffer.from(signature);

  if (
    expectedBuffer.length !== actualBuffer.length ||
    !timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    throw new Error("invalid_instagram_oauth_state");
  }

  const payload = JSON.parse(
    Buffer.from(encodedPayload, "base64url").toString("utf8"),
  ) as InstagramOAuthStatePayload;

  if (!payload.salonId || !payload.issuedAt) {
    throw new Error("invalid_instagram_oauth_state");
  }

  if (Date.now() - payload.issuedAt > maxAgeMs) {
    throw new Error("expired_instagram_oauth_state");
  }

  return payload;
}

export function resolveInstagramOAuthState(
  rawState: string | null | undefined,
  cookieState: string | null | undefined,
  maxAgeMs = 10 * 60 * 1000,
) {
  const queryState = rawState?.trim() ?? "";
  const storedState = cookieState?.trim() ?? "";

  if (!queryState && !storedState) {
    throw new Error("missing_instagram_oauth_state");
  }

  if (queryState && storedState && queryState !== storedState) {
    throw new Error("mismatched_instagram_oauth_state");
  }

  return verifyInstagramOAuthState(queryState || storedState, maxAgeMs);
}

export function buildInstagramMetaAuthorizeUrl(args: {
  redirectUri: string;
  state: string;
}) {
  const url = new URL(`https://www.facebook.com/${INSTAGRAM_META_GRAPH_VERSION}/dialog/oauth`);
  const configId = getInstagramMetaConfigId();

  url.searchParams.set("client_id", getInstagramMetaAppId());
  url.searchParams.set("redirect_uri", args.redirectUri);
  url.searchParams.set("state", args.state);
  url.searchParams.set("response_type", "code");

  if (configId) {
    url.searchParams.set("config_id", configId);
  } else {
    url.searchParams.set("scope", INSTAGRAM_META_OAUTH_SCOPES.join(","));
  }

  return url.toString();
}

export function pickInstagramPageAccount(
  accounts: InstagramMetaPageAccount[],
  preferred: PreferredInstagramConnection = {},
) {
  const eligibleAccounts = accounts.filter((account) => account.instagram_business_account?.id);

  if (eligibleAccounts.length === 0) {
    return null;
  }

  if (preferred.facebookPageId) {
    const matchingPage = eligibleAccounts.find((account) => account.id === preferred.facebookPageId);
    if (matchingPage) {
      return matchingPage;
    }
  }

  if (preferred.instagramUserId) {
    const matchingInstagramId = eligibleAccounts.find(
      (account) => account.instagram_business_account?.id === preferred.instagramUserId,
    );
    if (matchingInstagramId) {
      return matchingInstagramId;
    }
  }

  if (preferred.instagramUsername) {
    const normalizedUsername = preferred.instagramUsername.replace(/^@/, "").toLowerCase();
    const matchingUsername = eligibleAccounts.find(
      (account) =>
        account.instagram_business_account?.username?.replace(/^@/, "").toLowerCase() === normalizedUsername,
    );
    if (matchingUsername) {
      return matchingUsername;
    }
  }

  if (eligibleAccounts.length === 1) {
    return eligibleAccounts[0];
  }

  return null;
}
