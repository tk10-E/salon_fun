import { NextResponse, type NextRequest } from "next/server";

import { supabaseUrl } from "@/lib/env";

type SecurityRequest = Pick<NextRequest, "nextUrl" | "url">;

const sensitiveRoutePrefixes = ["/dashboard", "/login", "/auth", "/api/internal"];
const csrfExemptRoutePrefixes = [
  "/api/meta/webhook",
  "/api/stripe/webhook",
  "/api/internal/whatsapp/dispatch",
];

export function normalizeSecurityOrigin(value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return new URL(trimmed).origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function getConfiguredAppOrigin() {
  return (
    normalizeSecurityOrigin(process.env.APP_URL) ??
    normalizeSecurityOrigin(process.env.NEXT_PUBLIC_APP_URL)
  );
}

function getFirebaseAuthOrigin() {
  const configuredAuthDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN?.trim();
  if (!configuredAuthDomain) {
    return null;
  }

  if (/^https?:\/\//i.test(configuredAuthDomain)) {
    return normalizeSecurityOrigin(configuredAuthDomain);
  }

  return normalizeSecurityOrigin(`https://${configuredAuthDomain}`);
}

function getSupabaseOrigins() {
  const parsedOrigin = normalizeSecurityOrigin(supabaseUrl);
  if (!parsedOrigin) {
    return [];
  }

  const origins = [parsedOrigin];
  if (parsedOrigin.startsWith("https://")) {
    origins.push(parsedOrigin.replace(/^https:/, "wss:"));
  }

  return origins;
}

export function getTrustedOrigins(requestUrl?: string) {
  const trustedOrigins = new Set<string>();
  const configuredOrigin = getConfiguredAppOrigin();
  const requestOrigin = normalizeSecurityOrigin(requestUrl);
  const vercelProductionOrigin = normalizeSecurityOrigin(
    process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null,
  );

  for (const value of [
    configuredOrigin,
    normalizeSecurityOrigin(process.env.APP_URL),
    normalizeSecurityOrigin(process.env.NEXT_PUBLIC_APP_URL),
    vercelProductionOrigin,
    requestOrigin,
    "http://127.0.0.1:3000",
    "http://localhost:3000",
  ]) {
    if (value) {
      trustedOrigins.add(value);
    }
  }

  return trustedOrigins;
}

function buildContentSecurityPolicy(requestUrl?: string) {
  const firebaseAuthOrigin = getFirebaseAuthOrigin();
  const connectSrc = new Set<string>([
    "'self'",
    ...getSupabaseOrigins(),
    "https://identitytoolkit.googleapis.com",
    "https://securetoken.googleapis.com",
    "https://firebasestorage.googleapis.com",
    "https://www.googleapis.com",
    "https://apis.google.com",
    "https://accounts.google.com",
  ]);
  const imageSrc = new Set<string>(["'self'", "data:", "blob:", "https:"]);
  const fontSrc = new Set<string>(["'self'", "data:", "https:"]);
  const frameSrc = new Set<string>(["'self'", "https://accounts.google.com"]);
  const formAction = new Set<string>(["'self'"]);

  if (firebaseAuthOrigin) {
    connectSrc.add(firebaseAuthOrigin);
    frameSrc.add(firebaseAuthOrigin);
    formAction.add(firebaseAuthOrigin);
  }

  for (const origin of getTrustedOrigins(requestUrl)) {
    connectSrc.add(origin);
    imageSrc.add(origin);
    formAction.add(origin);
  }

  const scriptSrc = [
    "'self'",
    "'unsafe-inline'",
    "https://accounts.google.com",
    "https://apis.google.com",
    "https://www.gstatic.com",
  ];
  if (process.env.NODE_ENV !== "production") {
    scriptSrc.push("'unsafe-eval'");
  }

  const directives = [
    `default-src 'self'`,
    `base-uri 'self'`,
    `frame-ancestors 'none'`,
    `object-src 'none'`,
    `manifest-src 'self'`,
    `script-src ${scriptSrc.join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src ${Array.from(imageSrc).join(" ")}`,
    `font-src ${Array.from(fontSrc).join(" ")}`,
    `connect-src ${Array.from(connectSrc).join(" ")}`,
    `frame-src ${Array.from(frameSrc).join(" ")}`,
    `media-src 'self' blob: data: https:`,
    `form-action ${Array.from(formAction).join(" ")}`,
  ];

  if (normalizeSecurityOrigin(requestUrl)?.startsWith("https://")) {
    directives.push("upgrade-insecure-requests");
  }

  return directives.join("; ");
}

export function isTrustedRequestOrigin(
  origin: string | null | undefined,
  requestUrl?: string,
) {
  const normalizedOrigin = normalizeSecurityOrigin(origin);
  if (!normalizedOrigin) {
    return false;
  }

  return getTrustedOrigins(requestUrl).has(normalizedOrigin);
}

export function shouldBypassCsrfCheck(pathname: string) {
  return csrfExemptRoutePrefixes.some((prefix) => pathname.startsWith(prefix));
}

export function applySecurityHeaders(
  response: NextResponse,
  request: SecurityRequest,
) {
  const isHttps = normalizeSecurityOrigin(request.url)?.startsWith("https://");
  const pathname = request.nextUrl.pathname;

  response.headers.set(
    "Content-Security-Policy",
    buildContentSecurityPolicy(request.url),
  );
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
  );
  response.headers.set("Cross-Origin-Opener-Policy", "same-origin-allow-popups");
  response.headers.set("Cross-Origin-Resource-Policy", "same-site");
  response.headers.set("Origin-Agent-Cluster", "?1");

  if (isHttps) {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload",
    );
  }

  if (sensitiveRoutePrefixes.some((prefix) => pathname.startsWith(prefix))) {
    response.headers.set(
      "Cache-Control",
      "no-store, no-cache, max-age=0, must-revalidate",
    );
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
  }

  if (pathname.startsWith("/dashboard") || pathname.startsWith("/api/internal")) {
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  }

  return response;
}
