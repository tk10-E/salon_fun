import { createHash } from "node:crypto";

import { NextResponse } from "next/server";

import {
  applySecurityHeaders,
  getTrustedOrigins,
  isTrustedRequestOrigin,
  normalizeSecurityOrigin,
  shouldBypassCsrfCheck,
} from "@/lib/securityHeaders";
import { createAdminClient } from "@/lib/supabase/admin";

type HeaderStore = Headers | { get(name: string): string | null | undefined };
type RateLimitBucket = {
  attempts: number;
  blockedUntil: number;
  windowStartedAt: number;
};
type ReplayBucket = {
  expiresAt: number;
};

export type SecurityAuditSeverity = "info" | "warn" | "critical";
export type SecurityRateLimitResult = {
  allowed: boolean;
  attempts: number;
  blockedUntil: string | null;
  retryAfterSeconds: number;
  source: "database" | "memory";
};
type ConsumeSecurityRateLimitArgs = {
  blockSeconds?: number;
  key: string;
  limit: number;
  scope: string;
  windowSeconds: number;
};
type SecurityAuditEventArgs = {
  actorUserId?: string | null;
  eventType: string;
  ipAddress?: string | null;
  metadata?: Record<string, unknown>;
  requestPath?: string | null;
  salonId?: string | null;
  severity?: SecurityAuditSeverity;
  targetId?: string | null;
  targetType?: string | null;
  userAgent?: string | null;
};
type GuardApiRequestOptions = {
  actionName: string;
  allowMissingOrigin?: boolean;
  blockSeconds?: number;
  limit: number;
  rateLimitKey?: string | null;
  windowSeconds: number;
};

const memoryRateLimitBuckets = new Map<string, RateLimitBucket>();
const memoryReplayBuckets = new Map<string, ReplayBucket>();

export {
  applySecurityHeaders,
  isTrustedRequestOrigin,
  normalizeSecurityOrigin,
  shouldBypassCsrfCheck,
};

function readHeader(headerStore: HeaderStore, name: string) {
  const value = headerStore.get(name);
  return typeof value === "string" ? value : value ?? null;
}

function sanitizeMetadataValue(value: unknown): unknown {
  if (
    value == null ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value ?? null;
  }

  if (typeof value === "string") {
    return value.trim().slice(0, 512);
  }

  if (Array.isArray(value)) {
    return value.slice(0, 12).map((entry) => sanitizeMetadataValue(entry));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .slice(0, 20)
        .map(([key, entry]) => [key.slice(0, 64), sanitizeMetadataValue(entry)]),
    );
  }

  return String(value).slice(0, 256);
}

export function getClientIp(headerStore: HeaderStore) {
  const forwarded = readHeader(headerStore, "x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded
      .split(",")
      .map((entry) => entry.trim())
      .find(Boolean);
    if (firstIp) {
      return firstIp;
    }
  }

  return (
    readHeader(headerStore, "cf-connecting-ip") ??
    readHeader(headerStore, "x-real-ip") ??
    readHeader(headerStore, "x-vercel-forwarded-for") ??
    null
  );
}

export function getUserAgent(headerStore: HeaderStore) {
  return readHeader(headerStore, "user-agent")?.trim().slice(0, 512) ?? null;
}

export function getSafeRefererPath(
  headerStore: HeaderStore,
  requestUrl: string | null | undefined,
  fallbackPath: string,
) {
  const referer = readHeader(headerStore, "referer");
  const normalizedReferer = normalizeSecurityOrigin(referer);
  const trustedOrigins = getTrustedOrigins(requestUrl ?? undefined);

  if (!referer || !normalizedReferer || !trustedOrigins.has(normalizedReferer)) {
    return fallbackPath;
  }

  try {
    const url = new URL(referer);
    return url.pathname.startsWith("/") ? `${url.pathname}${url.search}` : fallbackPath;
  } catch {
    return fallbackPath;
  }
}

export function hashSecurityIdentifier(value: string | null | undefined) {
  const normalized = value?.trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  return createHash("sha256").update(normalized).digest("hex");
}

export function createSecurityDigest(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function consumeMemoryRateLimit(
  args: ConsumeSecurityRateLimitArgs,
): Promise<SecurityRateLimitResult> {
  const now = Date.now();
  const key = `${args.scope}:${args.key}`;
  const blockSeconds = Math.max(args.blockSeconds ?? 0, 0);
  const existing = memoryRateLimitBuckets.get(key);
  const resetWindowAt = (existing?.windowStartedAt ?? now) + args.windowSeconds * 1000;

  if (existing?.blockedUntil && existing.blockedUntil > now) {
    return {
      allowed: false,
      attempts: existing.attempts,
      blockedUntil: new Date(existing.blockedUntil).toISOString(),
      retryAfterSeconds: Math.max(1, Math.ceil((existing.blockedUntil - now) / 1000)),
      source: "memory",
    };
  }

  const shouldResetWindow = !existing || resetWindowAt <= now;
  const nextAttempts = shouldResetWindow ? 1 : existing.attempts + 1;
  const windowStartedAt = shouldResetWindow ? now : existing.windowStartedAt;
  const blockedUntil =
    nextAttempts > args.limit
      ? now + Math.max(blockSeconds, args.windowSeconds) * 1000
      : 0;

  memoryRateLimitBuckets.set(key, {
    attempts: nextAttempts,
    blockedUntil,
    windowStartedAt,
  });

  return {
    allowed: nextAttempts <= args.limit,
    attempts: nextAttempts,
    blockedUntil: blockedUntil ? new Date(blockedUntil).toISOString() : null,
    retryAfterSeconds: blockedUntil
      ? Math.max(1, Math.ceil((blockedUntil - now) / 1000))
      : 0,
    source: "memory",
  };
}

export async function consumeSecurityRateLimit(
  args: ConsumeSecurityRateLimitArgs,
): Promise<SecurityRateLimitResult> {
  try {
    const adminClient = createAdminClient() as any;
    const { data, error } = await adminClient.rpc("consume_security_rate_limit", {
      rate_scope_input: args.scope,
      rate_key_input: args.key,
      max_attempts_input: args.limit,
      window_seconds_input: args.windowSeconds,
      block_seconds_input: args.blockSeconds ?? 0,
    });

    if (error) {
      throw error;
    }

    const row = Array.isArray(data) ? data[0] : data;
    if (!row) {
      throw new Error("empty_rate_limit_response");
    }

    return {
      allowed: row.allowed === true,
      attempts: Number(row.attempts ?? 0),
      blockedUntil:
        typeof row.blocked_until === "string" ? row.blocked_until : null,
      retryAfterSeconds: Math.max(0, Number(row.retry_after_seconds ?? 0)),
      source: "database",
    };
  } catch {
    return consumeMemoryRateLimit(args);
  }
}

export async function recordSecurityAuditEvent(args: SecurityAuditEventArgs) {
  const sanitizedMetadata = sanitizeMetadataValue(args.metadata ?? {});

  try {
    const adminClient = createAdminClient() as any;
    const { error } = await adminClient.from("security_audit_logs").insert({
      actor_user_id: args.actorUserId ?? null,
      event_type: args.eventType,
      ip_address: args.ipAddress ?? null,
      metadata: sanitizedMetadata,
      request_path: args.requestPath ?? null,
      salon_id: args.salonId ?? null,
      severity: args.severity ?? "info",
      target_id: args.targetId ?? null,
      target_type: args.targetType ?? null,
      user_agent: args.userAgent ?? null,
    });

    if (error) {
      throw error;
    }
  } catch {
    // best effort: audit logging must never break the request path
  }
}

async function registerMemoryReplay(args: {
  requestHash: string;
  scope: string;
  ttlSeconds?: number;
}) {
  const now = Date.now();
  const ttlSeconds = Math.max(args.ttlSeconds ?? 30, 5);
  const key = `${args.scope}:${args.requestHash}`;
  const existing = memoryReplayBuckets.get(key);

  if (existing && existing.expiresAt > now) {
    return false;
  }

  memoryReplayBuckets.set(key, {
    expiresAt: now + ttlSeconds * 1000,
  });

  return true;
}

export async function registerSecurityRequestReplay(args: {
  requestHash: string;
  scope: string;
  ttlSeconds?: number;
}) {
  try {
    const adminClient = createAdminClient() as any;
    const { data, error } = await adminClient.rpc(
      "register_security_request_replay",
      {
        replay_scope_input: args.scope,
        request_hash_input: args.requestHash,
        ttl_seconds_input: args.ttlSeconds ?? 30,
      },
    );

    if (error) {
      throw error;
    }

    if (typeof data === "boolean") {
      return data;
    }

    if (Array.isArray(data)) {
      return data[0] === true;
    }

    return Boolean(data);
  } catch {
    return registerMemoryReplay(args);
  }
}

export async function guardApiRequest(
  request: Request,
  options: GuardApiRequestOptions,
) {
  const url = new URL(request.url);
  const origin = readHeader(request.headers, "origin");
  const safeOrigin = normalizeSecurityOrigin(origin);
  const requestIp = getClientIp(request.headers);

  if (
    request.method !== "GET" &&
    request.method !== "HEAD" &&
    request.method !== "OPTIONS" &&
    !options.allowMissingOrigin &&
    safeOrigin &&
    !isTrustedRequestOrigin(safeOrigin, request.url)
  ) {
    await recordSecurityAuditEvent({
      eventType: `${options.actionName}.blocked_origin`,
      ipAddress: requestIp,
      metadata: { origin: safeOrigin },
      requestPath: url.pathname,
      severity: "warn",
      userAgent: getUserAgent(request.headers),
    });

    return NextResponse.json({ error: "request_blocked" }, { status: 403 });
  }

  const rateLimitResult = await consumeSecurityRateLimit({
    blockSeconds: options.blockSeconds,
    key: options.rateLimitKey ?? requestIp ?? "unknown",
    limit: options.limit,
    scope: options.actionName,
    windowSeconds: options.windowSeconds,
  });

  if (!rateLimitResult.allowed) {
    await recordSecurityAuditEvent({
      eventType: `${options.actionName}.rate_limited`,
      ipAddress: requestIp,
      metadata: {
        attempts: rateLimitResult.attempts,
        blockedUntil: rateLimitResult.blockedUntil,
        retryAfterSeconds: rateLimitResult.retryAfterSeconds,
        source: rateLimitResult.source,
      },
      requestPath: url.pathname,
      severity: "warn",
      userAgent: getUserAgent(request.headers),
    });

    return NextResponse.json(
      { error: "too_many_requests" },
      {
        status: 429,
        headers: {
          "Retry-After": String(rateLimitResult.retryAfterSeconds),
        },
      },
    );
  }

  return null;
}
