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
const INTERNAL_SESSION_PING_PATH = "/api/internal/session/ping";
const SUPABASE_AUTH_LOOKUP_TIMEOUT_MS = 2500;
const SESSION_ACCESS_EVALUATION_TIMEOUT_MS = 2500;
const SUPABASE_SESSION_REFRESH_TIMEOUT_MS = 2500;
const API_UNAUTHORIZED_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate",
} as const;

type MiddlewareResponseCookie = {
  name: string;
  value: string;
} & Partial<CookieOptions>;

type SecurityCacheContext = {
  accessToken: string;
  countryCode: string;
  deviceId: string;
  userAgent: string;
  userId: string;
};

type SessionAccessEvaluation = {
  accessPolicyEvaluation: Awaited<ReturnType<typeof evaluatePanelAccessPolicy>>;
  canUseCachedSecurity: boolean;
  securityCacheContext: SecurityCacheContext;
  securityEvaluation: Awaited<ReturnType<typeof evaluateSessionSecurity>>;
  timedOut: boolean;
};

type TimedOperationResult<T> = {
  timedOut: boolean;
  value: T;
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

  if (
    !Number.isFinite(expiresAt) ||
    expiresAt <= Math.floor(Date.now() / 1000)
  ) {
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

function isInternalSessionPingRequest(request: NextRequest) {
  return (
    request.nextUrl.pathname === INTERNAL_SESSION_PING_PATH ||
    request.headers.has("x-panel-keepalive") ||
    request.headers.has("x-panel-session-ready")
  );
}

function buildUnauthorizedApiResponse(args: {
  request: NextRequest;
  response: NextResponse;
}) {
  const unauthorizedResponse = NextResponse.json(
    {
      error: "unauthorized",
      ok: false,
    },
    {
      headers: API_UNAUTHORIZED_HEADERS,
      status: 401,
    },
  );

  for (const cookie of args.response.cookies.getAll()) {
    unauthorizedResponse.cookies.set(cookie);
  }

  return applySecurityHeaders(unauthorizedResponse, args.request);
}

function rebuildResponseWithRequest(
  request: NextRequest,
  currentResponse: NextResponse,
) {
  const nextResponse = NextResponse.next({
    request,
  });

  for (const [headerName, headerValue] of currentResponse.headers.entries()) {
    if (headerName.toLowerCase() === "set-cookie") {
      continue;
    }

    nextResponse.headers.set(headerName, headerValue);
  }

  for (const cookie of currentResponse.cookies.getAll()) {
    nextResponse.cookies.set(cookie);
  }

  return nextResponse;
}

async function withTimeoutFallback<T>(args: {
  fallback: () => T;
  operation: () => Promise<T>;
  timeoutMs: number;
}): Promise<TimedOperationResult<T>> {
  const timeoutToken = Symbol("timeout");
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      args.operation(),
      new Promise<typeof timeoutToken>((resolve) => {
        timeoutHandle = setTimeout(() => resolve(timeoutToken), args.timeoutMs);
      }),
    ]);

    if (result === timeoutToken) {
      return {
        timedOut: true,
        value: args.fallback(),
      };
    }

    return {
      timedOut: false,
      value: result,
    };
  } catch {
    return {
      timedOut: false,
      value: args.fallback(),
    };
  } finally {
    if (timeoutHandle !== undefined) {
      clearTimeout(timeoutHandle);
    }
  }
}

function buildAllowedSecurityEvaluation() {
  return {
    action: "allow" as const,
    allowed: true,
    idleTimeoutSeconds: 28800,
    riskLevel: "low" as const,
    sessionId: null,
    suspiciousEvents: 0,
    suspiciousReason: null,
  };
}

function buildAllowedAccessPolicyEvaluation(countryCode: string) {
  return {
    action: "allow" as const,
    allowed: true as const,
    countryCode: countryCode === "-" ? null : countryCode,
    geoAllowlistEnabled: false,
    mfaCurrentLevel: null,
    mfaTotpEnabled: false,
    reason: null,
    salonId: null as string | null,
  };
}

async function evaluateSessionAccess(args: {
  accessToken: string;
  request: NextRequest;
  requestDeviceId: string;
  userId: string;
}) {
  const securityCacheContext = {
    accessToken: args.accessToken,
    countryCode: getRequestCountryCode(args.request),
    deviceId: args.requestDeviceId,
    userAgent: getRequestUserAgent(args.request),
    userId: args.userId,
  };
  const canUseCachedSecurity =
    canUseSecurityCache(args.request) &&
    (await securityCacheMatches(args.request, securityCacheContext));
  const securityEvaluation = canUseCachedSecurity
    ? buildAllowedSecurityEvaluation()
    : null;
  const accessPolicyEvaluation = canUseCachedSecurity
    ? buildAllowedAccessPolicyEvaluation(securityCacheContext.countryCode)
    : null;

  const [securityResult, accessPolicyResult] = canUseCachedSecurity
    ? [
        {
          timedOut: false,
          value: securityEvaluation ?? buildAllowedSecurityEvaluation(),
        },
        {
          timedOut: false,
          value:
            accessPolicyEvaluation ??
            buildAllowedAccessPolicyEvaluation(securityCacheContext.countryCode),
        },
      ]
    : await Promise.all([
        withTimeoutFallback({
          fallback: buildAllowedSecurityEvaluation,
          operation: () =>
            evaluateSessionSecurity({
              accessToken: args.accessToken,
              deviceId: args.requestDeviceId,
              headerStore: args.request.headers,
              requestPath: args.request.nextUrl.pathname,
              userId: args.userId,
            }),
          timeoutMs: SESSION_ACCESS_EVALUATION_TIMEOUT_MS,
        }),
        withTimeoutFallback({
          fallback: () =>
            buildAllowedAccessPolicyEvaluation(
              securityCacheContext.countryCode,
            ),
          operation: () =>
            evaluatePanelAccessPolicy({
              accessToken: args.accessToken,
              headerStore: args.request.headers,
              requestPath: args.request.nextUrl.pathname,
              userId: args.userId,
            }),
          timeoutMs: SESSION_ACCESS_EVALUATION_TIMEOUT_MS,
        }),
      ]);

  return {
    accessPolicyEvaluation: accessPolicyResult.value,
    canUseCachedSecurity,
    securityCacheContext,
    securityEvaluation: securityResult.value,
    timedOut: securityResult.timedOut || accessPolicyResult.timedOut,
  } satisfies SessionAccessEvaluation;
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
  const requestDeviceId =
    resolveRequestDeviceId(request) ?? crypto.randomUUID();
  const shouldSetDeviceCookie = resolveRequestDeviceId(request) == null;
  const isInternalPingRequest = isInternalSessionPingRequest(request);

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
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet: MiddlewareResponseCookie[]) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie);
        }

        response = rebuildResponseWithRequest(request, response);

        for (const cookie of cookiesToSet) {
          response.cookies.set(cookie);
        }
      },
    },
  });

  const timeoutReasons: string[] = [];
  const getUserResult = await withTimeoutFallback({
    fallback: () =>
      ({
        data: { user: null },
        error: null,
      }) as unknown as Awaited<ReturnType<typeof supabase.auth.getUser>>,
    operation: () => supabase.auth.getUser(),
    timeoutMs: SUPABASE_AUTH_LOOKUP_TIMEOUT_MS,
  });
  const {
    data: { user },
  } = getUserResult.value;

  if (getUserResult.timedOut) {
    timeoutReasons.push("get-user");
  }

  if (user) {
    const getSessionResult = await withTimeoutFallback({
      fallback: () =>
        ({
          data: { session: null },
          error: null,
        }) as unknown as Awaited<ReturnType<typeof supabase.auth.getSession>>,
      operation: () => supabase.auth.getSession(),
      timeoutMs: SUPABASE_AUTH_LOOKUP_TIMEOUT_MS,
    });
    const {
      data: { session },
    } = getSessionResult.value;

    if (getSessionResult.timedOut) {
      timeoutReasons.push("get-session");
    }

    if (session?.access_token) {
      let evaluation = await evaluateSessionAccess({
        accessToken: session.access_token,
        request,
        requestDeviceId,
        userId: user.id,
      });

      if (evaluation.timedOut) {
        timeoutReasons.push("session-access");
      }

      response.headers.set(
        "X-Panel-Security-Cache",
        evaluation.canUseCachedSecurity ? "hit" : "miss",
      );

      if (
        !evaluation.securityEvaluation.allowed &&
        evaluation.securityEvaluation.action === "expired"
      ) {
        const refreshSessionResult = await withTimeoutFallback({
          fallback: () =>
            ({
              data: { session: null },
              error: null,
            }) as unknown as Awaited<
              ReturnType<typeof supabase.auth.refreshSession>
            >,
          operation: () => supabase.auth.refreshSession(),
          timeoutMs: SUPABASE_SESSION_REFRESH_TIMEOUT_MS,
        });
        const { data: refreshedSessionData, error: refreshError } =
          refreshSessionResult.value;
        const refreshedAccessToken =
          refreshedSessionData.session?.access_token?.trim() ?? "";

        if (refreshSessionResult.timedOut) {
          timeoutReasons.push("refresh-session");
        }

        if (!refreshError && refreshedAccessToken) {
          evaluation = await evaluateSessionAccess({
            accessToken: refreshedAccessToken,
            request,
            requestDeviceId,
            userId: user.id,
          });

          if (evaluation.timedOut) {
            timeoutReasons.push("session-access");
          }
          response.headers.set("X-Panel-Session-Recovered", "refreshed");
          response.headers.set(
            "X-Panel-Security-Cache",
            evaluation.canUseCachedSecurity ? "hit" : "miss",
          );
        }
      }

      if (!evaluation.securityEvaluation.allowed) {
        await supabase.auth.signOut({ scope: "local" });

        if (isInternalPingRequest) {
          if (shouldSetDeviceCookie) {
            ensureResponseDeviceId({
              deviceId: requestDeviceId,
              request,
              response,
            });
          }

          return buildUnauthorizedApiResponse({
            request,
            response,
          });
        }

        response = buildSecurityRedirectResponse(
          request,
          response,
          evaluation.securityEvaluation.action === "expired"
            ? "Sessão encerrada por inatividade. Entre novamente para continuar."
            : "Sessão bloqueada por segurança. Entre novamente para continuar.",
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

      if (evaluation.securityEvaluation.action === "allow_with_warning") {
        response.headers.set(
          "X-Session-Risk",
          evaluation.securityEvaluation.riskLevel,
        );
      }

      if (!evaluation.accessPolicyEvaluation.allowed) {
        if (evaluation.accessPolicyEvaluation.action === "mfa_required") {
          if (request.nextUrl.pathname !== "/login") {
            if (isInternalPingRequest) {
              await supabase.auth.signOut({ scope: "local" });

              if (shouldSetDeviceCookie) {
                ensureResponseDeviceId({
                  deviceId: requestDeviceId,
                  request,
                  response,
                });
              }

              return buildUnauthorizedApiResponse({
                request,
                response,
              });
            }

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

          if (isInternalPingRequest) {
            if (shouldSetDeviceCookie) {
              ensureResponseDeviceId({
                deviceId: requestDeviceId,
                request,
                response,
              });
            }

            return buildUnauthorizedApiResponse({
              request,
              response,
            });
          }

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
        !evaluation.canUseCachedSecurity &&
        !evaluation.timedOut &&
        canUseSecurityCache(request) &&
        evaluation.securityEvaluation.allowed &&
        evaluation.securityEvaluation.action === "allow" &&
        evaluation.accessPolicyEvaluation.allowed &&
        evaluation.accessPolicyEvaluation.action === "allow"
      ) {
        await setSecurityCacheCookie({
          context: evaluation.securityCacheContext,
          request,
          response,
        });
      }
    }
  }

  if (timeoutReasons.length > 0) {
    response.headers.set(
      "X-Panel-Session-Timeout",
      Array.from(new Set(timeoutReasons)).join(","),
    );
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
