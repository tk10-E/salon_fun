import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  createSecurityDigest,
  consumeSecurityRateLimit,
  getClientIp,
  getSafeRefererPath,
  getUserAgent,
  hashSecurityIdentifier,
  isTrustedRequestOrigin,
  recordSecurityAuditEvent,
  registerSecurityRequestReplay,
} from "@/lib/security";
import { getDeviceCookieName } from "@/lib/sessionSecurity";
import { createClient } from "@/lib/supabase/server";
import { buildRequestOriginFromHeaders } from "@/lib/requestOrigin";

import { buildRedirectNotice } from "./shared";

type FormActionGuardOptions = {
  actionName: string;
  blockSeconds?: number;
  fallbackPath: string;
  limit?: number;
  rateLimitKey?: string | null;
  windowSeconds?: number;
};
type ActionGuardOptions = Omit<FormActionGuardOptions, "rateLimitKey">;

const defaultOwnerActionRateLimit = {
  limit: 120,
  windowSeconds: 300,
  blockSeconds: 600,
} as const;
const defaultReplayProtectionWindowSeconds = 20;

function readCookieValue(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) {
    return null;
  }

  for (const chunk of cookieHeader.split(";")) {
    const [rawName, ...rawValue] = chunk.split("=");
    if (rawName?.trim() !== name) {
      continue;
    }

    const value = rawValue.join("=");

    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  return null;
}

function serializeFormData(formData: FormData) {
  const entries: string[] = [];

  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      entries.push(
        `${key}=[file:${value.name}:${value.size}:${value.type || "application/octet-stream"}]`,
      );
      continue;
    }

    entries.push(`${key}=${String(value)}`);
  }

  return entries.sort((left, right) => left.localeCompare(right)).join("&");
}

async function resolveActorUserId() {
  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.user?.id ?? null;
  } catch {
    return null;
  }
}

async function enforceRateLimitDimension(args: {
  actionName: string;
  blockSeconds: number;
  fallbackPath: string;
  ipAddress: string | null;
  key: string | null | undefined;
  limit: number;
  scopeSuffix: "actor" | "ip";
  userAgent: string | null;
  windowSeconds: number;
}) {
  const normalizedKey = args.key?.trim() ?? "";

  if (!normalizedKey) {
    return null;
  }

  const rateLimitResult = await consumeSecurityRateLimit({
    blockSeconds: args.blockSeconds,
    key: normalizedKey,
    limit: args.limit,
    scope: `${args.actionName}.${args.scopeSuffix}`,
    windowSeconds: args.windowSeconds,
  });

  if (rateLimitResult.allowed) {
    return null;
  }

  await recordSecurityAuditEvent({
    eventType: `${args.actionName}.rate_limited`,
    ipAddress: args.ipAddress,
    metadata: {
      attempts: rateLimitResult.attempts,
      blockedUntil: rateLimitResult.blockedUntil,
      dimension: args.scopeSuffix,
      retryAfterSeconds: rateLimitResult.retryAfterSeconds,
    },
    requestPath: args.fallbackPath,
    severity: "warn",
    userAgent: args.userAgent,
  });

  redirect(
    buildRedirectNotice(
      args.fallbackPath,
      "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.",
      "error",
    ),
  );
}

async function guardRequest(
  actionName: string,
  options: {
    blockSeconds?: number;
    fallbackPath: string;
    limit?: number;
    rateLimitKey?: string | null;
    windowSeconds?: number;
  },
) {
  const headerStore = await headers();
  const requestOrigin = buildRequestOriginFromHeaders(headerStore);
  const originHeader = headerStore.get("origin")?.trim() ?? null;
  const ipAddress = getClientIp(headerStore);
  const userAgent = getUserAgent(headerStore);
  const actorUserId = await resolveActorUserId();
  const actorRateLimitKey =
    options.rateLimitKey?.trim() ||
    actorUserId ||
    readCookieValue(headerStore.get("cookie"), getDeviceCookieName());
  const fallbackPath = getSafeRefererPath(
    headerStore,
    requestOrigin,
    options.fallbackPath,
  );

  if (
    originHeader &&
    requestOrigin &&
    !isTrustedRequestOrigin(originHeader, requestOrigin)
  ) {
    await recordSecurityAuditEvent({
      eventType: `${actionName}.blocked_origin`,
      ipAddress,
      metadata: {
        origin: originHeader,
        requestOrigin,
      },
      requestPath: fallbackPath,
      severity: "warn",
      userAgent,
    });

    redirect(
      buildRedirectNotice(
        fallbackPath,
        "Solicitação bloqueada por segurança. Recarregue a página e tente de novo.",
        "error",
      ),
    );
  }

  const limit = options.limit ?? defaultOwnerActionRateLimit.limit;
  const blockSeconds =
    options.blockSeconds ?? defaultOwnerActionRateLimit.blockSeconds;
  const windowSeconds =
    options.windowSeconds ?? defaultOwnerActionRateLimit.windowSeconds;
  const ipRateLimitResult = await consumeSecurityRateLimit({
    blockSeconds,
    key: ipAddress ?? "unknown",
    limit,
    scope: `${actionName}.ip`,
    windowSeconds,
  });

  if (!ipRateLimitResult.allowed) {
    await recordSecurityAuditEvent({
      eventType: `${actionName}.rate_limited`,
      ipAddress,
      metadata: {
        attempts: ipRateLimitResult.attempts,
        blockedUntil: ipRateLimitResult.blockedUntil,
        dimension: "ip",
        retryAfterSeconds: ipRateLimitResult.retryAfterSeconds,
      },
      requestPath: fallbackPath,
      severity: "warn",
      userAgent,
    });

    redirect(
      buildRedirectNotice(
        fallbackPath,
        "Muitas tentativas em sequência. Aguarde alguns instantes e tente novamente.",
        "error",
      ),
    );
  }

  await enforceRateLimitDimension({
    actionName,
    blockSeconds,
    fallbackPath,
    ipAddress,
    key: actorRateLimitKey,
    limit,
    scopeSuffix: "actor",
    userAgent,
    windowSeconds,
  });

  return {
    actorRateLimitKey,
    actorUserId,
    fallbackPath,
    headerStore,
    ipAddress,
    userAgent,
  };
}

export async function runProtectedFormAction<T>(
  action: (formData: FormData) => Promise<T>,
  formData: FormData,
  options: FormActionGuardOptions,
) {
  const requestContext = await guardRequest(options.actionName, options);
  const requestHash = createSecurityDigest(
    [
      options.actionName,
      requestContext.actorUserId ?? requestContext.actorRateLimitKey ?? requestContext.ipAddress ?? "unknown",
      readCookieValue(
        requestContext.headerStore.get("cookie"),
        getDeviceCookieName(),
      ) ?? "no-device",
      serializeFormData(formData),
    ].join("|"),
  );
  const replayAllowed = await registerSecurityRequestReplay({
    requestHash,
    scope: options.actionName,
    ttlSeconds: defaultReplayProtectionWindowSeconds,
  });

  if (!replayAllowed) {
    await recordSecurityAuditEvent({
      actorUserId: requestContext.actorUserId,
      eventType: `${options.actionName}.replay_blocked`,
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestHash,
      },
      requestPath: requestContext.fallbackPath,
      severity: "warn",
      userAgent: requestContext.userAgent,
    });

    redirect(
      buildRedirectNotice(
        requestContext.fallbackPath,
        "Pedido duplicado bloqueado por segurança. Atualize a página antes de tentar de novo.",
        "error",
      ),
    );
  }

  return action(formData);
}

export async function runProtectedAction<T>(
  action: () => Promise<T>,
  options: ActionGuardOptions,
) {
  const requestContext = await guardRequest(options.actionName, options);
  const requestHash = createSecurityDigest(
    [
      options.actionName,
      requestContext.actorUserId ?? requestContext.actorRateLimitKey ?? requestContext.ipAddress ?? "unknown",
      readCookieValue(
        requestContext.headerStore.get("cookie"),
        getDeviceCookieName(),
      ) ?? "no-device",
      "action",
    ].join("|"),
  );
  const replayAllowed = await registerSecurityRequestReplay({
    requestHash,
    scope: options.actionName,
    ttlSeconds: defaultReplayProtectionWindowSeconds,
  });

  if (!replayAllowed) {
    await recordSecurityAuditEvent({
      actorUserId: requestContext.actorUserId,
      eventType: `${options.actionName}.replay_blocked`,
      ipAddress: requestContext.ipAddress,
      metadata: {
        requestHash,
      },
      requestPath: requestContext.fallbackPath,
      severity: "warn",
      userAgent: requestContext.userAgent,
    });

    redirect(
      buildRedirectNotice(
        requestContext.fallbackPath,
        "Pedido duplicado bloqueado por segurança. Atualize a página antes de tentar de novo.",
        "error",
      ),
    );
  }

  return action();
}

export function buildAuthRateLimitKey(formData: FormData, field = "email") {
  const rawEmail = String(formData.get(field) ?? "").trim().toLowerCase();
  return hashSecurityIdentifier(rawEmail);
}
