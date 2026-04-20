import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import {
  ensureResponseDeviceId,
  evaluatePanelAccessPolicy,
  evaluateSessionSecurity,
  resolveRequestDeviceId,
} from "@/lib/sessionSecurity";
import {
  applySecurityHeaders,
  shouldBypassCsrfCheck,
} from "@/lib/securityHeaders";

const SUPABASE_AUTH_COOKIE_PATTERN =
  /^(sb-.+-auth-token(?:\.\d+)?|sb-access-token|sb-refresh-token|supabase-auth-token)$/;
const SECURITY_CACHE_COOKIE_NAME = "sf_panel_security_ok";
const SECURITY_CACHE_TTL_SECONDS = 30;
const SECURITY_CACHE_VERSION = "v1";

type SecurityCacheContext = {
  accessToken: string;
  countryCode: string;
  deviceId: string;
  userAgent: string;
  userId: string;
};

function normalizeCachePart(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return normalized ? normalized.slice(0, 512) : "-";
}

function getRequestCountryCode(request: NextRequest) {
  return normalizeCachePart(
    request.headers.get("x-vercel-ip-country") ??
      request.headers.get("cf-ipcountry"),
  ).toUpperCase();
}

function getRequestUserAgent(request: NextRequest) {
  return normalizeCachePart(request.headers.get("user-agent")).toLowerCase();
}

function getSecurityCacheSecret() {
  return (
    process.env.SESSION_SECURITY_CACHE_SECRET?.trim() ||
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    null
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

async function sha256Base64Url(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return bytesToBase64Url(new Uint8Array(digest));
}

async function signSecurityCacheData(data: string) {
  const secret = getSecurityCacheSecret();

  if (!secret) {
    return null;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    {
      hash: "SHA-256",
      name: "HMAC",
    },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(data),
  );

  return bytesToBase64Url(new Uint8Array(signature));
}

function safeEqual(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;

  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

async function buildSecurityCacheData(
  context: SecurityCacheContext,
  expiresAt: number,
) {
  const [accessTokenHash, deviceHash, userAgentHash] = await Promise.all([
    sha256Base64Url(context.accessToken),
    sha256Base64Url(context.deviceId),
    sha256Base64Url(context.userAgent),
  ]);

  return [
    SECURITY_CACHE_VERSION,
    String(expiresAt),
    context.userId,
    accessTokenHash,
    deviceHash,
    normalizeCachePart(context.countryCode),
    userAgentHash,
  ].join(".");
}

async function buildSecurityCacheCookieValue(context: SecurityCacheContext) {
  const expiresAt = Math.floor(Date.now() / 1000) + SECURITY_CACHE_TTL_SECONDS;
  const data = await buildSecurityCacheData(context, expiresAt);
  const signature = await signSecurityCacheData(data);

  return signature ? `${data}.${signature}` : null;
}

async function securityCacheMatches(
  request: NextRequest,
  context: SecurityCacheContext,
) {
  const rawCookie = request.cookies.get(SECURITY_CACHE_COOKIE_NAME)?.value;

  if (!rawCookie) {
    return false;
  }

  const parts = rawCookie.split(".");

  if (parts.length !== 8 || parts[0] !== SECURITY_CACHE_VERSION) {
    return false;
  }

  const expiresAt = Number(parts[1]);

  if (!Number.isFinite(expiresAt) || expiresAt <= Math.floor(Date.now() / 1000)) {
    return false;
  }

  const data = parts.slice(0, 7).join(".");
  const expectedData = await buildSecurityCacheData(context, expiresAt);

  if (!safeEqual(data, expectedData)) {
    return false;
  }

  const expectedSignature = await signSecurityCacheData(data);

  return Boolean(expectedSignature && safeEqual(parts[7], expectedSignature));
}

async function setSecurityCacheCookie(args: {
  context: SecurityCacheContext;
  request: NextRequest;
  response: NextResponse;
}) {
  const value = await buildSecurityCacheCookieValue(args.context);

  if (!value) {
    return;
  }

  args.response.cookies.set({
    name: SECURITY_CACHE_COOKIE_NAME,
    value,
    httpOnly: true,
    maxAge: SECURITY_CACHE_TTL_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: args.request.nextUrl.protocol === "https:",
  });
}

function canUseSecurityCache(request: NextRequest) {
  return request.method === "GET" || request.method === "HEAD";
}

function getCanonicalOrigin() {
  const value = process.env.APP_URL?.trim();
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value).origin.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

function shouldRedirectToCanonicalOrigin(request: NextRequest) {
  if (process.env.VERCEL !== "1" || process.env.VERCEL_ENV !== "production") {
    return false;
  }

  return request.method === "GET" || request.method === "HEAD";
}

function buildSecurityRedirectResponse(
  request: NextRequest,
  response: NextResponse,
  message: string,
  tone: "error" | "info" = "error",
) {
  const redirectUrl = request.nextUrl.clone();
  redirectUrl.pathname = "/login";
  redirectUrl.search = "";
  redirectUrl.searchParams.set("message", message);
  redirectUrl.searchParams.set("tone", tone);

  const redirectResponse = NextResponse.redirect(redirectUrl, 307);

  for (const cookie of response.cookies.getAll()) {
    redirectResponse.cookies.set(cookie);
  }

  return redirectResponse;
}

function hasSupabaseAuthCookie(request: NextRequest) {
  return request.cookies
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name));
}

export async function updateSession(request: NextRequest) {
  const canonicalOrigin = getCanonicalOrigin();
  const isMutatingRequest =
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS";
  const originHeader = request.headers.get("origin")?.trim();

  if (canonicalOrigin && shouldRedirectToCanonicalOrigin(request)) {
    const requestUrl = new URL(request.url);
    const canonicalUrl = new URL(canonicalOrigin);

    if (requestUrl.origin !== canonicalUrl.origin) {
      requestUrl.protocol = canonicalUrl.protocol;
      requestUrl.host = canonicalUrl.host;
      return applySecurityHeaders(
        NextResponse.redirect(requestUrl, 307),
        request,
      );
    }
  }

  if (
    isMutatingRequest &&
    originHeader &&
    originHeader !== request.nextUrl.origin &&
    !shouldBypassCsrfCheck(request.nextUrl.pathname)
  ) {
    return applySecurityHeaders(
      NextResponse.json({ error: "request_blocked" }, { status: 403 }),
      request,
    );
  }

  let response = NextResponse.next({
    request,
  });
  const requestDeviceId = resolveRequestDeviceId(request) ?? crypto.randomUUID();
  const shouldSetDeviceCookie = resolveRequestDeviceId(request) == null;

  if (!hasSupabaseAuthCookie(request)) {
    if (shouldSetDeviceCookie) {
      ensureResponseDeviceId({
        deviceId: requestDeviceId,
        request,
        response,
      });
    }

    return applySecurityHeaders(response, request);
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        request.cookies.set({ name, value, ...options });
        response = NextResponse.next({
          request,
        });
        response.cookies.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        request.cookies.set({ name, value: "", ...options });
        response = NextResponse.next({
          request,
        });
        response.cookies.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const securityCacheContext = {
        accessToken: session.access_token,
        countryCode: getRequestCountryCode(request),
        deviceId: requestDeviceId,
        userAgent: getRequestUserAgent(request),
        userId: user.id,
      };
      const canUseCachedSecurity =
        canUseSecurityCache(request) &&
        await securityCacheMatches(request, securityCacheContext);
      const securityEvaluation = canUseCachedSecurity
        ? {
            action: "allow" as const,
            allowed: true,
            idleTimeoutSeconds: 28800,
            riskLevel: "low" as const,
            sessionId: null,
            suspiciousEvents: 0,
            suspiciousReason: null,
          }
        : await evaluateSessionSecurity({
            accessToken: session.access_token,
            deviceId: requestDeviceId,
            headerStore: request.headers,
            requestPath: request.nextUrl.pathname,
            userId: user.id,
          });

      response.headers.set(
        "X-Panel-Security-Cache",
        canUseCachedSecurity ? "hit" : "miss",
      );

      if (!securityEvaluation.allowed) {
        await supabase.auth.signOut({ scope: "local" });

        response = buildSecurityRedirectResponse(
          request,
          response,
          securityEvaluation.action === "expired"
            ? "Sessao encerrada por inatividade. Entre novamente para continuar."
            : "Sessao bloqueada por seguranca. Entre novamente para continuar.",
        );

        if (shouldSetDeviceCookie) {
          ensureResponseDeviceId({
            deviceId: requestDeviceId,
            request,
            response,
          });
        }

        return applySecurityHeaders(response, request);
      }

      if (securityEvaluation.action === "allow_with_warning") {
        response.headers.set("X-Session-Risk", securityEvaluation.riskLevel);
      }

      const accessPolicyEvaluation = canUseCachedSecurity
        ? {
            action: "allow" as const,
            allowed: true,
            countryCode:
              securityCacheContext.countryCode === "-"
                ? null
                : securityCacheContext.countryCode,
            geoAllowlistEnabled: false,
            mfaCurrentLevel: null,
            mfaTotpEnabled: false,
            reason: null,
            salonId: null,
          }
        : await evaluatePanelAccessPolicy({
            accessToken: session.access_token,
            headerStore: request.headers,
            requestPath: request.nextUrl.pathname,
            userId: user.id,
          });

      if (!accessPolicyEvaluation.allowed) {
        if (accessPolicyEvaluation.action === "mfa_required") {
          if (request.nextUrl.pathname !== "/login") {
            response = buildSecurityRedirectResponse(
              request,
              response,
              "Confirme o código do autenticador para continuar.",
              "info",
            );

            if (shouldSetDeviceCookie) {
              ensureResponseDeviceId({
                deviceId: requestDeviceId,
                request,
                response,
              });
            }

            return applySecurityHeaders(response, request);
          }
        } else {
          await supabase.auth.signOut({ scope: "local" });

          response = buildSecurityRedirectResponse(
            request,
            response,
            "Acesso ao painel bloqueado para esta localização.",
          );

          if (shouldSetDeviceCookie) {
            ensureResponseDeviceId({
              deviceId: requestDeviceId,
              request,
              response,
            });
          }

          return applySecurityHeaders(response, request);
        }
      }

      if (
        !canUseCachedSecurity &&
        canUseSecurityCache(request) &&
        securityEvaluation.allowed &&
        securityEvaluation.action === "allow" &&
        accessPolicyEvaluation.allowed &&
        accessPolicyEvaluation.action === "allow"
      ) {
        await setSecurityCacheCookie({
          context: securityCacheContext,
          request,
          response,
        });
      }
    }
  }

  if (shouldSetDeviceCookie) {
    ensureResponseDeviceId({
      deviceId: requestDeviceId,
      request,
      response,
    });
  }

  return applySecurityHeaders(response, request);
}
