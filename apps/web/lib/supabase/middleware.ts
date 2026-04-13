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
      const securityEvaluation = await evaluateSessionSecurity({
        accessToken: session.access_token,
        deviceId: requestDeviceId,
        headerStore: request.headers,
        requestPath: request.nextUrl.pathname,
        userId: user.id,
      });

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

      const accessPolicyEvaluation = await evaluatePanelAccessPolicy({
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
