import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";

import { evaluatePanelAccessPolicy } from "@/lib/sessionSecurity";
import {
  BILLING_PATH,
  PUBLIC_BILLING_PATH,
  getSalonBillingSnapshot,
} from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Salon = Database["public"]["Tables"]["salons"]["Row"];
type AuthMetadataRecord = Record<string, unknown>;
type InternalAiAccessSubject = Pick<User, "app_metadata" | "email" | "user_metadata">;
type FlashTone = "success" | "error" | "info";

const SESSION_EXPIRED_MESSAGE = "Sessão expirada. Entre novamente para continuar.";
const SUPABASE_AUTH_COOKIE_PATTERN =
  /^(sb-.+-auth-token(?:\.\d+)?|sb-access-token|sb-refresh-token|supabase-auth-token)$/;
const INTERNAL_AI_ACCESS_FLAG_KEYS = [
  "ai_observability_access",
  "can_access_ai_observability",
  "is_internal_ai_operator",
  "is_internal_admin",
] as const;
const INTERNAL_AI_ACCESS_PERMISSION_KEYS = [
  "permissions",
  "internal_permissions",
  "feature_access",
  "feature_flags",
] as const;
const INTERNAL_AI_ACCESS_ROLE_KEYS = [
  "internal_role",
  "internal_roles",
  "app_role",
  "app_roles",
  "platform_role",
  "platform_roles",
] as const;
const INTERNAL_AI_ACCESS_ROLE_VALUES = new Set([
  "ai_observability_admin",
  "developer",
  "internal_admin",
  "internal_operator",
  "platform_admin",
  "support_engineer",
  "super_admin",
  "superadmin",
]);
const INTERNAL_AI_ACCESS_PERMISSION_VALUES = new Set([
  "ai:observability:read",
  "ai_observability.read",
  "internal.ai_observability",
  "internal:ai:observability",
]);
const withCache = typeof cache === "function"
  ? cache
  : (<T extends (...args: never[]) => unknown>(fn: T) => fn);

async function hasSupabaseAuthCookie() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .some((cookie) => SUPABASE_AUTH_COOKIE_PATTERN.test(cookie.name));
}

const getAuthenticatedUser = withCache(async () => {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) {
    return user;
  }

  if (error) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.user ?? null;
  }

  return null;
});

export function buildRedirectPath(
  pathname: string,
  options?: {
    message?: string;
    tone?: FlashTone;
  },
) {
  if (!options?.message) {
    return pathname;
  }

  const searchParams = new URLSearchParams({
    message: options.message,
    tone: options.tone ?? "info",
  });

  return `${pathname}?${searchParams.toString()}`;
}

export function buildLoginRedirectPath(options?: {
  message?: string;
  tone?: FlashTone;
}) {
  return buildRedirectPath("/login", options);
}

export async function requireUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(buildLoginRedirectPath({
      message: SESSION_EXPIRED_MESSAGE,
      tone: "info",
    }));
  }

  return { supabase: createClient(), user };
}

const getOwnerSalonCached = withCache(async (userId: string) => {
  const supabase = createClient();
  const { data } = await supabase
    .from("salons")
    .select("*")
    .match({ owner_user_id: userId })
    .maybeSingle();

  return data as Salon | null;
});

// Cache only within a single request so the dashboard shell and page loaders
// can share the same salon lookup without showing stale data after redirects.
export async function getOwnerSalon(userId: string) {
  return getOwnerSalonCached(userId);
}

export async function getAuthenticatedPanelEntryPath() {
  if (!(await hasSupabaseAuthCookie())) {
    return null;
  }

  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const accessPolicy = await evaluatePanelAccessPolicy({
        accessToken: session.access_token,
        headerStore: await headers(),
        requestPath: "/login",
        userId: user.id,
      });

      if (!accessPolicy.allowed && accessPolicy.action === "mfa_required") {
        return null;
      }
    }
  } catch {
    // best effort: if policy lookup fails, keep the previous entry routing
  }

  const salon = await getOwnerSalon(user.id);

  if (!salon) {
    return "/onboarding";
  }

  const billingSnapshot = await getSalonBillingSnapshot(salon.id);
  return billingSnapshot.isLocked ? PUBLIC_BILLING_PATH : "/dashboard";
}

function readMetadataRecord(value: unknown): AuthMetadataRecord | null {
  return value && typeof value === "object"
    ? value as AuthMetadataRecord
    : null;
}

function getAuthMetadataSources(user: InternalAiAccessSubject) {
  return [
    readMetadataRecord(user.app_metadata),
    readMetadataRecord(user.user_metadata),
  ].filter((item): item is AuthMetadataRecord => Boolean(item));
}

function normalizeMetadataToken(value: string) {
  return value.trim().toLowerCase();
}

function collectMetadataTokens(
  user: InternalAiAccessSubject,
  keys: readonly string[],
) {
  const tokens: string[] = [];

  for (const metadata of getAuthMetadataSources(user)) {
    for (const key of keys) {
      const rawValue = metadata[key];

      if (typeof rawValue === "string") {
        tokens.push(
          ...rawValue
            .split(/[,\n;]/)
            .map(normalizeMetadataToken)
            .filter(Boolean),
        );
        continue;
      }

      if (Array.isArray(rawValue)) {
        tokens.push(
          ...rawValue
            .filter((item): item is string => typeof item === "string")
            .map(normalizeMetadataToken)
            .filter(Boolean),
        );
      }
    }
  }

  return tokens;
}

function readMetadataBoolean(
  user: InternalAiAccessSubject,
  keys: readonly string[],
) {
  for (const metadata of getAuthMetadataSources(user)) {
    for (const key of keys) {
      const rawValue = metadata[key];

      if (typeof rawValue === "boolean") {
        return rawValue;
      }

      if (typeof rawValue === "string") {
        const normalized = normalizeMetadataToken(rawValue);

        if (["1", "true", "yes"].includes(normalized)) {
          return true;
        }

        if (["0", "false", "no"].includes(normalized)) {
          return false;
        }
      }
    }
  }

  return false;
}

export function hasInternalAiObservabilityAccess(
  user: InternalAiAccessSubject | null | undefined,
) {
  if (!user) {
    return false;
  }

  if (readMetadataBoolean(user, INTERNAL_AI_ACCESS_FLAG_KEYS)) {
    return true;
  }

  const roles = collectMetadataTokens(user, INTERNAL_AI_ACCESS_ROLE_KEYS);

  if (roles.some((role) => INTERNAL_AI_ACCESS_ROLE_VALUES.has(role))) {
    return true;
  }

  const permissions = collectMetadataTokens(
    user,
    INTERNAL_AI_ACCESS_PERMISSION_KEYS,
  );

  return permissions.some((permission) =>
    INTERNAL_AI_ACCESS_PERMISSION_VALUES.has(permission)
  );
}

function readUserMetadataValue(
  user: User,
  keys: string[],
) {
  const metadata =
    user.user_metadata && typeof user.user_metadata === "object"
      ? user.user_metadata as Record<string, unknown>
      : null;

  if (!metadata) {
    return null;
  }

  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }

  return null;
}

function getAuthenticatedUserDisplayName(user: User) {
  return readUserMetadataValue(user, [
    "full_name",
    "name",
    "display_name",
    "user_name",
    "preferred_username",
  ]);
}

function getAuthenticatedUserAvatarUrl(user: User) {
  return readUserMetadataValue(user, [
    "avatar_url",
    "picture",
    "picture_url",
    "image",
    "photoURL",
    "profile_image_url",
  ]);
}

export async function requireOwnerSalon(): Promise<{
  salon: Salon;
  user: {
    canAccessInternalAiObservability: boolean;
    id: string;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}>;
export async function requireOwnerSalon(options: {
  allowLocked?: boolean;
}): Promise<{
  salon: Salon;
  user: {
    canAccessInternalAiObservability: boolean;
    id: string;
    email?: string | null;
    displayName?: string | null;
    avatarUrl?: string | null;
  };
}>;
export async function requireOwnerSalon(options?: {
  allowLocked?: boolean;
}) {
  const { user } = await requireUser();
  const salon = await getOwnerSalon(user.id);

  if (!salon) {
    redirect("/onboarding");
  }

  if (!options?.allowLocked) {
    const billingSnapshot = await getSalonBillingSnapshot(salon.id);

    if (billingSnapshot.isLocked) {
      redirect(
        buildRedirectPath(PUBLIC_BILLING_PATH, {
          message: "Escolha um plano para liberar as áreas operacionais do painel.",
          tone: "info",
        }),
      );
    }
  }

  return {
    salon,
    user: {
      canAccessInternalAiObservability: hasInternalAiObservabilityAccess(user),
      id: user.id,
      email: user.email,
      displayName: getAuthenticatedUserDisplayName(user),
      avatarUrl: getAuthenticatedUserAvatarUrl(user),
    },
  };
}
