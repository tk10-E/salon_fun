import { headers } from "next/headers";

export function buildRequestOrigin() {
  const headerStore = headers();
  const origin = headerStore.get("origin")?.trim();

  if (origin) {
    return origin.replace(/\/+$/, "");
  }

  const host =
    headerStore.get("x-forwarded-host")?.trim() ??
    headerStore.get("host")?.trim();
  if (!host) {
    return undefined;
  }

  const protocol = headerStore.get("x-forwarded-proto")?.trim() || "https";
  return `${protocol}://${host.replace(/\/+$/, "")}`;
}

export function buildAbsoluteUrl(path: string) {
  const origin = buildRequestOrigin();
  if (!origin) {
    return undefined;
  }

  return new URL(path, `${origin}/`).toString();
}
