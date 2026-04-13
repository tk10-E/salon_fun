type HeaderStore = Headers | { get(name: string): string | null | undefined };

export type SalonSecurityPolicy = {
  allowedCountryCodes: string[];
  geoAllowlistEnabled: boolean;
  mfaTotpEnabled: boolean;
  salonId: string | null;
};

export const DEFAULT_SALON_SECURITY_POLICY: SalonSecurityPolicy = {
  allowedCountryCodes: [],
  geoAllowlistEnabled: false,
  mfaTotpEnabled: false,
  salonId: null,
};

const COUNTRY_CODE_PATTERN = /^[A-Z]{2}$/;
const REQUEST_COUNTRY_HEADER_NAMES = [
  "cf-ipcountry",
  "x-vercel-ip-country",
  "cloudfront-viewer-country",
  "x-country-code",
] as const;
const INVALID_COUNTRY_CODES = new Set(["T1", "XX", "ZZ"]);

function readHeader(headerStore: HeaderStore, name: string) {
  const value = headerStore.get(name);
  return typeof value === "string" ? value : value ?? null;
}

export function normalizeCountryCode(value: string | null | undefined) {
  const normalized = value?.trim().toUpperCase() ?? "";

  if (
    !COUNTRY_CODE_PATTERN.test(normalized) ||
    INVALID_COUNTRY_CODES.has(normalized)
  ) {
    return null;
  }

  return normalized;
}

export function normalizeCountryCodesInput(
  value: readonly string[] | string | null | undefined,
) {
  const entries = Array.isArray(value)
    ? value
    : String(value ?? "")
        .split(/[,\n\r\t ;]+/)
        .filter(Boolean);

  const deduped = new Set<string>();

  for (const entry of entries) {
    const normalized = normalizeCountryCode(entry);

    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

export function getRequestCountryCode(headerStore: HeaderStore) {
  for (const headerName of REQUEST_COUNTRY_HEADER_NAMES) {
    const normalized = normalizeCountryCode(readHeader(headerStore, headerName));

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function coerceSalonSecurityPolicy(args: {
  row?: Record<string, unknown> | null;
  salonId?: string | null;
}) {
  return {
    allowedCountryCodes: normalizeCountryCodesInput(
      Array.isArray(args.row?.allowed_country_codes)
        ? (args.row?.allowed_country_codes as string[])
        : [],
    ),
    geoAllowlistEnabled: args.row?.geo_allowlist_enabled === true,
    mfaTotpEnabled: args.row?.mfa_totp_enabled === true,
    salonId:
      typeof args.salonId === "string" && args.salonId.trim()
        ? args.salonId.trim()
        : null,
  } satisfies SalonSecurityPolicy;
}
