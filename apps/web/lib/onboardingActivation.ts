import { PUBLIC_BILLING_PATH } from "@/lib/billing";

export function resolveOnboardingReturnPath(
  value: string | null | undefined,
) {
  const candidate = value?.trim() ?? "";

  if (!candidate.startsWith("/")) {
    return PUBLIC_BILLING_PATH;
  }

  try {
    const parsed = new URL(candidate, "https://dashboard.local");

    if (parsed.pathname !== PUBLIC_BILLING_PATH) {
      return PUBLIC_BILLING_PATH;
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return PUBLIC_BILLING_PATH;
  }
}
