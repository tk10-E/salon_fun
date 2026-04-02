import { headers } from "next/headers";

type HeaderStore = {
  get(name: string): string | null | undefined;
};

function normalizeOrigin(value: string | null | undefined) {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return undefined;
  }

  try {
    return new URL(normalizedValue).origin.replace(/\/+$/, "");
  } catch {
    return undefined;
  }
}

export function getConfiguredAppOrigin() {
  return normalizeOrigin(process.env.APP_URL) ?? normalizeOrigin(process.env.NEXT_PUBLIC_APP_URL);
}

export function buildRequestOriginFromHeaders(headerStore: HeaderStore) {
  const origin = headerStore.get("origin")?.trim();

  if (origin) {
    return origin.replace(/\/+$/, "");
  }

  const host = headerStore.get("x-forwarded-host")?.trim() ?? headerStore.get("host")?.trim();
  if (!host) {
    return undefined;
  }

  const protocol = headerStore.get("x-forwarded-proto")?.trim() || "https";
  return `${protocol}://${host.replace(/\/+$/, "")}`;
}

export function buildRequestOrigin() {
  return getConfiguredAppOrigin() ?? buildRequestOriginFromHeaders(headers());
}

export function resolveRequestOriginFromRequest(request: Request) {
  return (
    getConfiguredAppOrigin() ??
    buildRequestOriginFromHeaders(request.headers) ??
    new URL(request.url).origin
  );
}

export function buildAbsoluteUrl(path: string) {
  const origin = buildRequestOrigin();
  if (!origin) {
    return undefined;
  }

  return new URL(path, `${origin}/`).toString();
}
