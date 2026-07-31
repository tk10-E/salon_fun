import {
  coerceSalonSecurityPolicy,
  getRequestCountryCode,
} from "@/lib/panelSecurityPolicy";
import { createAdminClient } from "@/lib/supabase/admin";

type HeaderStore = Headers | { get(name: string): string | null | undefined };
type SessionSecurityEvaluation = {
  action: "allow" | "allow_with_warning" | "created" | "expired" | "revoke";
  allowed: boolean;
  idleTimeoutSeconds: number;
  riskLevel: "low" | "medium" | "high";
  sessionId: string | null;
  suspiciousEvents: number;
  suspiciousReason: string | null;
};
type SessionSecurityAuditSeverity = "info" | "warn" | "critical";
type PanelAccessPolicyEvaluation = {
  action: "allow" | "geo_blocked" | "mfa_required";
  allowed: boolean;
  countryCode: string | null;
  geoAllowlistEnabled: boolean;
  mfaCurrentLevel: "aal1" | "aal2" | null;
  mfaTotpEnabled: boolean;
  reason: string | null;
  salonId: string | null;
};

const DEFAULT_EVALUATION: SessionSecurityEvaluation = {
  action: "allow",
  allowed: true,
  idleTimeoutSeconds: 28800,
  riskLevel: "low",
  sessionId: null,
  suspiciousEvents: 0,
  suspiciousReason: null,
};

const DEFAULT_LOW_RISK_IDLE_TIMEOUT_SECONDS = 28800;

const DEVICE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
const DEVICE_COOKIE_NAME = "sf_device_id";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function readHeader(headerStore: HeaderStore, name: string) {
  const value = headerStore.get(name);
  return typeof value === "string" ? value : value ?? null;
}

function normalizeDeviceId(value: string | null | undefined) {
  const normalized = value?.trim() ?? "";
  return UUID_PATTERN.test(normalized) ? normalized : null;
}

function normalizeUserAgent(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase() ?? "";
  return normalized ? normalized.slice(0, 512) : null;
}

function parseJwtPayload(token: string) {
  const encodedPayload = token.split(".")[1];
  if (!encodedPayload) {
    return null;
  }

  try {
    const base64 = encodedPayload
      .replace(/-/g, "+")
      .replace(/_/g, "/")
      .padEnd(Math.ceil(encodedPayload.length / 4) * 4, "=");
    const decoded = atob(base64);
    return JSON.parse(decoded) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function extractJwtAuthenticatorLevel(accessToken: string) {
  const payload = parseJwtPayload(accessToken);
  const assuranceLevel = payload?.aal;

  return assuranceLevel === "aal2" ? "aal2" : assuranceLevel === "aal1" ? "aal1" : null;
}

function hasVerifiedTotpFactor(rawFactors: unknown) {
  if (!Array.isArray(rawFactors)) {
    return false;
  }

  return rawFactors.some(
    (factor) =>
      factor &&
      typeof factor === "object" &&
      (factor as { factor_type?: unknown }).factor_type === "totp" &&
      (factor as { status?: unknown }).status === "verified",
  );
}

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function insertSessionSecurityAuditEvent(args: {
  eventType: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  requestPath?: string | null;
  severity?: SessionSecurityAuditSeverity;
  targetId?: string | null;
  targetType?: string | null;
  userAgent?: string | null;
  userId: string;
}) {
  try {
    const admin = createAdminClient() as any;
    await admin.from("security_audit_logs").insert({
      actor_user_id: args.userId,
      event_type: args.eventType,
      ip_address: args.ipAddress ?? null,
      metadata: args.metadata ?? {},
      request_path: args.requestPath ?? null,
      severity: args.severity ?? "info",
      target_id: args.targetId ?? null,
      target_type: args.targetType ?? "session",
      user_agent: args.userAgent ?? null,
    });
  } catch {
    // best effort: auth hardening must not fail closed if audit logging is down
  }
}

export function getDeviceCookieName() {
  return DEVICE_COOKIE_NAME;
}

export function getRequestDeviceId(headerStore: HeaderStore) {
  const cookieHeader = readHeader(headerStore, "cookie");

  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = part.split("=");
    if (rawName?.trim() !== DEVICE_COOKIE_NAME) {
      continue;
    }

    const value = rawValue.join("=");
    try {
      return normalizeDeviceId(decodeURIComponent(value));
    } catch {
      return normalizeDeviceId(value);
    }
  }

  return null;
}

export function resolveRequestDeviceId(args: {
  cookies: {
    get(name: string): { value: string } | undefined;
  };
}) {
  return normalizeDeviceId(args.cookies.get(DEVICE_COOKIE_NAME)?.value);
}

export function ensureResponseDeviceId(args: {
  deviceId?: string | null;
  request: {
    cookies: {
      get(name: string): { value: string } | undefined;
    };
    nextUrl: {
      protocol: string;
    };
  };
  response: {
    cookies: {
      set(options: {
        httpOnly: boolean;
        maxAge: number;
        name: string;
        path: string;
        sameSite: "lax";
        secure: boolean;
        value: string;
      }): void;
    };
  };
}) {
  const existing = normalizeDeviceId(
    args.request.cookies.get(DEVICE_COOKIE_NAME)?.value,
  );

  if (existing) {
    return existing;
  }

  const deviceId = normalizeDeviceId(args.deviceId) ?? crypto.randomUUID();
  args.response.cookies.set({
    name: DEVICE_COOKIE_NAME,
    value: deviceId,
    httpOnly: true,
    maxAge: DEVICE_COOKIE_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: args.request.nextUrl.protocol === "https:",
  });

  return deviceId;
}

export async function extractSessionIdentifier(accessToken: string) {
  const payload = parseJwtPayload(accessToken);
  const sessionId = payload?.session_id;

  if (typeof sessionId === "string" && sessionId.trim()) {
    return sessionId.trim();
  }

  return sha256Hex(`access-token:${accessToken}`);
}

function mapEvaluationRow(
  row: Record<string, unknown> | null | undefined,
  sessionId: string,
): SessionSecurityEvaluation {
  if (!row) {
    return {
      ...DEFAULT_EVALUATION,
      sessionId,
    };
  }

  const rawRiskLevel = String(row.risk_level ?? "low");
  const rawAction = String(row.action ?? "allow");

  return {
    action:
      rawAction === "created" ||
      rawAction === "allow_with_warning" ||
      rawAction === "expired" ||
      rawAction === "revoke"
        ? rawAction
        : "allow",
    allowed: row.allowed === true,
    idleTimeoutSeconds: Math.max(
      300,
      Number(row.idle_timeout_seconds ?? DEFAULT_LOW_RISK_IDLE_TIMEOUT_SECONDS),
    ),
    riskLevel:
      rawRiskLevel === "high" || rawRiskLevel === "medium"
        ? rawRiskLevel
        : "low",
    sessionId,
    suspiciousEvents: Math.max(0, Number(row.suspicious_events ?? 0)),
    suspiciousReason:
      typeof row.suspicious_reason === "string" && row.suspicious_reason.trim()
        ? row.suspicious_reason.trim()
        : null,
  };
}

export async function evaluateSessionSecurity(args: {
  accessToken: string;
  deviceId: string;
  headerStore: HeaderStore;
  requestPath?: string | null;
  userId: string;
}) {
  const sessionId = await extractSessionIdentifier(args.accessToken);
  const ipAddress = readHeader(args.headerStore, "x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .find(Boolean) ??
    readHeader(args.headerStore, "cf-connecting-ip") ??
    readHeader(args.headerStore, "x-real-ip") ??
    readHeader(args.headerStore, "x-vercel-forwarded-for") ??
    null;
  const userAgent = normalizeUserAgent(readHeader(args.headerStore, "user-agent"));
  const deviceIdHash = await sha256Hex(`device:${args.deviceId}`);
  const ipHash = ipAddress ? await sha256Hex(`ip:${ipAddress}`) : null;
  const userAgentHash = userAgent ? await sha256Hex(`ua:${userAgent}`) : null;

  try {
    const admin = createAdminClient() as any;
    const { data, error } = await admin.rpc("upsert_session_security_context", {
      session_id_input: sessionId,
      user_id_input: args.userId,
      device_id_hash_input: deviceIdHash,
      ip_hash_input: ipHash,
      user_agent_hash_input: userAgentHash,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    const evaluation = mapEvaluationRow(row, sessionId);

    if (evaluation.action === "created") {
      await insertSessionSecurityAuditEvent({
        userId: args.userId,
        eventType: "auth.session_created",
        ipAddress,
        metadata: {
          idleTimeoutSeconds: evaluation.idleTimeoutSeconds,
          riskLevel: evaluation.riskLevel,
        },
        requestPath: args.requestPath,
        targetId: sessionId,
        userAgent,
      });
    } else if (evaluation.action === "allow_with_warning") {
      await insertSessionSecurityAuditEvent({
        userId: args.userId,
        eventType: "auth.session_ip_changed",
        ipAddress,
        metadata: {
          riskLevel: evaluation.riskLevel,
          suspiciousEvents: evaluation.suspiciousEvents,
          suspiciousReason: evaluation.suspiciousReason,
        },
        requestPath: args.requestPath,
        severity: "warn",
        targetId: sessionId,
        userAgent,
      });
    } else if (!evaluation.allowed) {
      await insertSessionSecurityAuditEvent({
        userId: args.userId,
        eventType:
          evaluation.action === "expired"
            ? "auth.session_expired"
            : "auth.session_blocked",
        ipAddress,
        metadata: {
          idleTimeoutSeconds: evaluation.idleTimeoutSeconds,
          riskLevel: evaluation.riskLevel,
          suspiciousEvents: evaluation.suspiciousEvents,
          suspiciousReason: evaluation.suspiciousReason,
        },
        requestPath: args.requestPath,
        severity: evaluation.action === "expired" ? "warn" : "critical",
        targetId: sessionId,
        userAgent,
      });
    }

    return evaluation;
  } catch {
    return {
      ...DEFAULT_EVALUATION,
      sessionId,
    };
  }
}

export async function evaluatePanelAccessPolicy(args: {
  accessToken: string;
  headerStore: HeaderStore;
  requestPath?: string | null;
  userId: string;
}) {
  const countryCode = getRequestCountryCode(args.headerStore);
  const ipAddress = readHeader(args.headerStore, "x-forwarded-for")
    ?.split(",")
    .map((entry) => entry.trim())
    .find(Boolean) ??
    readHeader(args.headerStore, "cf-connecting-ip") ??
    readHeader(args.headerStore, "x-real-ip") ??
    readHeader(args.headerStore, "x-vercel-forwarded-for") ??
    null;
  const mfaCurrentLevel = extractJwtAuthenticatorLevel(args.accessToken);
  const userAgent = normalizeUserAgent(readHeader(args.headerStore, "user-agent"));

  try {
    const admin = createAdminClient() as any;
    const { data, error } = await admin
      .from("salons")
      .select(
        "id, salon_security_settings(mfa_totp_enabled, geo_allowlist_enabled, allowed_country_codes)",
      )
      .eq("owner_user_id", args.userId)
      .maybeSingle();

    if (error || !data?.id) {
      throw error ?? new Error("owner_salon_not_found");
    }

    const rawPolicy = Array.isArray(data.salon_security_settings)
      ? data.salon_security_settings[0]
      : data.salon_security_settings;
    const policy = coerceSalonSecurityPolicy({
      row:
        rawPolicy && typeof rawPolicy === "object"
          ? (rawPolicy as Record<string, unknown>)
          : null,
      salonId: data.id,
    });

    if (
      policy.geoAllowlistEnabled &&
      policy.allowedCountryCodes.length > 0 &&
      countryCode &&
      !policy.allowedCountryCodes.includes(countryCode)
    ) {
      await insertSessionSecurityAuditEvent({
        userId: args.userId,
        eventType: "auth.geo_blocked",
        ipAddress,
        metadata: {
          allowedCountryCodes: policy.allowedCountryCodes,
          countryCode,
        },
        requestPath: args.requestPath,
        severity: "warn",
        targetId: policy.salonId,
        targetType: "salon",
        userAgent,
      });

      return {
        action: "geo_blocked",
        allowed: false,
        countryCode,
        geoAllowlistEnabled: true,
        mfaCurrentLevel,
        mfaTotpEnabled: policy.mfaTotpEnabled,
        reason: "country_not_allowed",
        salonId: policy.salonId,
      } satisfies PanelAccessPolicyEvaluation;
    }

    if (policy.mfaTotpEnabled && mfaCurrentLevel !== "aal2") {
      const { data: factorData, error: factorError } =
        await admin.auth.admin.mfa.listFactors({
          userId: args.userId,
        });

      if (factorError) {
        throw factorError;
      }

      if (!hasVerifiedTotpFactor(factorData?.factors)) {
        return {
          action: "allow",
          allowed: true,
          countryCode,
          geoAllowlistEnabled: policy.geoAllowlistEnabled,
          mfaCurrentLevel,
          mfaTotpEnabled: false,
          reason: "verified_totp_factor_missing",
          salonId: policy.salonId,
        } satisfies PanelAccessPolicyEvaluation;
      }

      return {
        action: "mfa_required",
        allowed: false,
        countryCode,
        geoAllowlistEnabled: policy.geoAllowlistEnabled,
        mfaCurrentLevel,
        mfaTotpEnabled: true,
        reason: "aal_upgrade_required",
        salonId: policy.salonId,
      } satisfies PanelAccessPolicyEvaluation;
    }

    return {
      action: "allow",
      allowed: true,
      countryCode,
      geoAllowlistEnabled: policy.geoAllowlistEnabled,
      mfaCurrentLevel,
      mfaTotpEnabled: policy.mfaTotpEnabled,
      reason: null,
      salonId: policy.salonId,
    } satisfies PanelAccessPolicyEvaluation;
  } catch {
    return {
      action: "allow",
      allowed: true,
      countryCode,
      geoAllowlistEnabled: false,
      mfaCurrentLevel,
      mfaTotpEnabled: false,
      reason: null,
      salonId: null,
    } satisfies PanelAccessPolicyEvaluation;
  }
}
