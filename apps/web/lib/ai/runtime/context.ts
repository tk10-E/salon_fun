import type { User } from "@supabase/supabase-js";

import { getSalonBillingWorkspaceSnapshot } from "@/lib/billing";
import { createClient } from "@/lib/supabase/server";

import { getPanelAssistantToolCatalog } from "./tools";
import type {
  AiTenantSnapshot,
  AuthenticatedPanelAssistantContext,
} from "./types";

type CounterResult = {
  count: number | null;
  error: Error | null;
};

const PERMISSION_METADATA_KEYS = [
  "permissions",
  "internal_permissions",
  "feature_access",
  "feature_flags",
  "app_permissions",
  "panel_permissions",
  "roles",
  "app_roles",
  "internal_roles",
] as const;

function readMetadataRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function collectPermissionTokens(user: Pick<User, "app_metadata" | "user_metadata">) {
  const metadataSources = [
    readMetadataRecord(user.app_metadata),
    readMetadataRecord(user.user_metadata),
  ].filter((item): item is Record<string, unknown> => Boolean(item));
  const tokens = new Set<string>();

  for (const metadata of metadataSources) {
    for (const key of PERMISSION_METADATA_KEYS) {
      const rawValue = metadata[key];

      if (typeof rawValue === "string") {
        for (const token of rawValue.split(/[,\n;]/)) {
          const normalized = token.trim().toLowerCase();
          if (normalized) {
            tokens.add(normalized);
          }
        }

        continue;
      }

      if (Array.isArray(rawValue)) {
        for (const token of rawValue) {
          if (typeof token !== "string") {
            continue;
          }

          const normalized = token.trim().toLowerCase();
          if (normalized) {
            tokens.add(normalized);
          }
        }
      }
    }
  }

  if (!tokens.size) {
    tokens.add("panel_owner");
  }

  return [...tokens];
}

function loadCount(
  supabase: any,
  table: string,
  configure?: (query: any) => any,
): Promise<CounterResult> {
  const baseQuery = supabase.from(table).select("id", { count: "exact", head: true });
  const query = configure ? configure(baseQuery) : baseQuery;

  return query.then((result: CounterResult) => result);
}

async function hasSalonBusinessHoursConfigured(
  supabase: any,
  salonId: string,
) {
  const result = await loadCount(supabase, "salon_business_hours", (query) =>
    query.eq("salon_id", salonId),
  ).catch((error: Error) => ({
    count: null,
    error,
  }));

  if (result.error) {
    return null;
  }

  return (result.count ?? 0) > 0;
}

export async function getAuthenticatedPanelAssistantContext(): Promise<AuthenticatedPanelAssistantContext | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeUser = user ?? null;

  if (!activeUser) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    activeUser = session?.user ?? null;
  }

  if (!activeUser) {
    return null;
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("id,name,timezone,slot_step_minutes")
    .eq("owner_user_id", activeUser.id)
    .maybeSingle();

  if (!salon) {
    return null;
  }

  return {
    permissions: collectPermissionTokens(activeUser),
    salon,
    supabase,
    user: {
      app_metadata: activeUser.app_metadata,
      email: activeUser.email,
      id: activeUser.id,
      user_metadata: activeUser.user_metadata,
    },
    userId: activeUser.id,
  };
}

export async function buildAiTenantSnapshot(
  context: AuthenticatedPanelAssistantContext,
): Promise<AiTenantSnapshot> {
  const [billingSnapshot, activeProfessionalsResult, activeServicesResult, customerCountResult, todayAppointmentsResult, pendingAppointmentsResult, businessHoursConfigured] =
    await Promise.all([
      getSalonBillingWorkspaceSnapshot(context.salon.id).catch(() => null),
      loadCount(context.supabase, "staff_members", (query) =>
        query.eq("salon_id", context.salon.id).eq("is_active", true),
      ).catch((error: Error) => ({ count: null, error })),
      loadCount(context.supabase, "services", (query) =>
        query.eq("salon_id", context.salon.id).eq("is_active", true),
      ).catch((error: Error) => ({ count: null, error })),
      loadCount(context.supabase, "customers", (query) =>
        query.eq("salon_id", context.salon.id),
      ).catch((error: Error) => ({ count: null, error })),
      loadCount(context.supabase, "appointments", (query) =>
        query
          .eq("salon_id", context.salon.id)
          .gte("date", new Date(new Date().setHours(0, 0, 0, 0)).toISOString())
          .lt("date", new Date(new Date().setHours(24, 0, 0, 0)).toISOString()),
      ).catch((error: Error) => ({ count: null, error })),
      loadCount(context.supabase, "appointments", (query) =>
        query.eq("salon_id", context.salon.id).eq("status", "pending"),
      ).catch((error: Error) => ({ count: null, error })),
      hasSalonBusinessHoursConfigured(context.supabase, context.salon.id),
    ]);

  return {
    activeProfessionalsCount: activeProfessionalsResult.error
      ? null
      : activeProfessionalsResult.count ?? 0,
    activeServicesCount: activeServicesResult.error
      ? null
      : activeServicesResult.count ?? 0,
    availableTools: getPanelAssistantToolCatalog(),
    businessHoursConfigured,
    customerCount: customerCountResult.error ? null : customerCountResult.count ?? 0,
    pendingAppointmentsCount: pendingAppointmentsResult.error
      ? null
      : pendingAppointmentsResult.count ?? 0,
    permissions: context.permissions,
    planId: billingSnapshot?.currentPlan.id ?? null,
    planLabel: billingSnapshot?.currentPlan.displayName ?? null,
    salonId: context.salon.id,
    salonName: context.salon.name,
    slotStepMinutes: context.salon.slot_step_minutes ?? null,
    subscriptionStatus: billingSnapshot?.subscription.status ?? null,
    timezone: context.salon.timezone ?? "America/Sao_Paulo",
    todayAppointmentsCount: todayAppointmentsResult.error
      ? null
      : todayAppointmentsResult.count ?? 0,
  };
}
