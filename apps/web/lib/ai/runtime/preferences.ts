import { resolveBookedAppointmentAmount } from "@/lib/financialMetrics";

import { cleanAiText, relationIsMissing } from "./guardrails";
import type {
  AiLongMemorySettingsInput,
  AiLongMemorySnapshot,
} from "./types";

type AiSettingRow = {
  setting_key: string;
  setting_value: unknown;
};

type AiMemoryRow = {
  memory_key: string;
  memory_value: unknown;
};

type CompletedAppointmentRow = {
  completed_at: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  services:
    | {
        category?: string | null;
        name?: string | null;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        name?: string | null;
        price?: number | string | null;
      }[]
    | null;
  staff_members:
    | {
        name?: string | null;
      }
    | {
        name?: string | null;
      }[]
    | null;
};

type SalonPostRow = {
  caption: string | null;
  created_at: string;
  source_type?: string | null;
  title: string;
};

type AuditLogRow = {
  metadata: Record<string, unknown> | null;
};

const AI_SETTING_KEYS = {
  businessGoals: "business_goals",
  idealCustomerProfile: "ideal_customer_profile",
  preferredTone: "preferred_tone",
  priorityProfessionals: "priority_professionals",
  recentCampaigns: "recent_campaigns",
  topServices: "top_services",
} as const;

const LONG_MEMORY_LOOKBACK_DAYS = 180;
const MAX_DERIVED_ITEMS = 3;

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function readRecord(value: unknown) {
  return value && typeof value === "object"
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeSettingToken(value: string | null | undefined) {
  return cleanAiText(value, 120);
}

function extractString(value: unknown, maxLength = 180) {
  if (typeof value !== "string") {
    return null;
  }

  return cleanAiText(value, maxLength) || null;
}

function extractStringArray(value: unknown, maxLength = 80, limit = 5) {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string")
      .map((item) => cleanAiText(item, maxLength))
      .filter(Boolean)
      .slice(0, limit);
  }

  if (typeof value === "string") {
    const normalized = cleanAiText(value, maxLength * limit);

    if (!normalized) {
      return [];
    }

    return normalized
      .split(/[,\n;|]/)
      .map((item) => cleanAiText(item, maxLength))
      .filter(Boolean)
      .slice(0, limit);
  }

  return [];
}

function unwrapStoredValue(value: unknown) {
  const record = readRecord(value);

  if (!record) {
    return value;
  }

  if (Array.isArray(record.values)) {
    return record.values;
  }

  if (typeof record.value === "string") {
    return record.value;
  }

  return value;
}

function uniqueStrings(items: string[], limit = 5) {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const key = item.trim().toLowerCase();

    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    normalized.push(item);

    if (normalized.length >= limit) {
      break;
    }
  }

  return normalized;
}

function readSettingArray(
  settings: Map<string, unknown>,
  memory: Map<string, unknown>,
  key: string,
) {
  return uniqueStrings([
    ...extractStringArray(unwrapStoredValue(settings.get(key))),
    ...extractStringArray(unwrapStoredValue(memory.get(key))),
  ]);
}

function readSettingString(
  settings: Map<string, unknown>,
  memory: Map<string, unknown>,
  key: string,
) {
  return (
    extractString(unwrapStoredValue(settings.get(key))) ??
    extractString(unwrapStoredValue(memory.get(key))) ??
    null
  );
}

function mapIntentToFocus(intent: string | null | undefined) {
  switch (intent) {
    case "schedule_availability":
    case "vacancy_strategy":
      return "preencher horarios vagos";
    case "movement_forecast":
      return "corrigir janelas fracas da agenda";
    case "recovery_campaign":
      return "reativar clientes com melhor chance de retorno";
    case "promotion_strategy":
      return "rodar campanhas com retorno mais claro";
    case "customer_summary":
      return "reter clientes de maior valor";
    case "finance_analysis":
      return "proteger faturamento e ticket";
    default:
      return null;
  }
}

function buildSnapshotSummary(snapshot: Omit<AiLongMemorySnapshot, "summary">) {
  const parts: string[] = [];

  if (snapshot.preferredTone) {
    parts.push(`Tom preferido do salao: ${snapshot.preferredTone}.`);
  }

  if (snapshot.businessGoals.length) {
    parts.push(`Metas declaradas: ${snapshot.businessGoals.join(", ")}.`);
  } else if (snapshot.recentFocuses.length) {
    parts.push(`Focos recentes do salao: ${snapshot.recentFocuses.join(", ")}.`);
  }

  if (snapshot.topServices.length) {
    parts.push(`Servicos mais fortes: ${snapshot.topServices.join(", ")}.`);
  }

  if (snapshot.priorityProfessionals.length) {
    parts.push(
      `Profissionais prioritarios: ${snapshot.priorityProfessionals.join(", ")}.`,
    );
  }

  if (snapshot.idealCustomerProfile) {
    parts.push(`Perfil ideal de cliente: ${snapshot.idealCustomerProfile}.`);
  }

  if (snapshot.recentCampaigns.length) {
    parts.push(`Campanhas recentes: ${snapshot.recentCampaigns.join(", ")}.`);
  }

  return cleanAiText(parts.join(" "), 700) || null;
}

async function safeSelectList<T>(
  queryFactory: () => Promise<{ data: T[] | null; error: { code?: string | null; message?: string | null } | null }>,
) {
  try {
    const result = await queryFactory();

    if (result.error) {
      throw result.error;
    }

    return result.data ?? [];
  } catch (error) {
    if (relationIsMissing(error as { code?: string | null; message?: string | null })) {
      return [];
    }

    throw error;
  }
}

function deriveTopServices(appointments: CompletedAppointmentRow[]) {
  const counters = new Map<
    string,
    { count: number; total: number }
  >();

  for (const appointment of appointments) {
    const service = firstRelation(appointment.services);
    const serviceName = cleanAiText(service?.name, 80);

    if (!serviceName) {
      continue;
    }

    const amount = resolveBookedAppointmentAmount({
      servicePrice: service?.price,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    const current = counters.get(serviceName) ?? {
      count: 0,
      total: 0,
    };
    current.count += 1;
    current.total += amount;
    counters.set(serviceName, current);
  }

  return [...counters.entries()]
    .sort((left, right) => {
      if (right[1].count !== left[1].count) {
        return right[1].count - left[1].count;
      }

      return right[1].total - left[1].total;
    })
    .slice(0, MAX_DERIVED_ITEMS)
    .map(([name]) => name);
}

function derivePriorityProfessionals(appointments: CompletedAppointmentRow[]) {
  const counters = new Map<string, number>();

  for (const appointment of appointments) {
    const professional = firstRelation(appointment.staff_members);
    const name = cleanAiText(professional?.name, 80);

    if (!name) {
      continue;
    }

    counters.set(name, (counters.get(name) ?? 0) + 1);
  }

  return [...counters.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, MAX_DERIVED_ITEMS)
    .map(([name]) => name);
}

function deriveRecentCampaigns(posts: SalonPostRow[]) {
  return uniqueStrings(
    posts.flatMap((post) => {
      const title = cleanAiText(post.title, 80);
      const caption = cleanAiText(post.caption, 80);

      return [title, caption].filter((item): item is string => Boolean(item));
    }),
    MAX_DERIVED_ITEMS,
  );
}

function deriveRecentFocuses(rows: AuditLogRow[]) {
  const focuses = rows
    .map((row) =>
      mapIntentToFocus(extractString(readRecord(row.metadata)?.intent, 80)),
    )
    .flatMap((item) => (item ? [item] : []));

  return uniqueStrings(focuses, MAX_DERIVED_ITEMS);
}

export async function buildAiLongMemorySnapshot(args: {
  salonId: string;
  supabase: any;
}): Promise<AiLongMemorySnapshot> {
  const lookbackStart = new Date(
    Date.now() - LONG_MEMORY_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
  const [settingsRows, memoryRows, appointments, posts, auditLogs] =
    await Promise.all([
      safeSelectList<AiSettingRow>(async () =>
        await args.supabase
          .from("ai_settings")
          .select("setting_key,setting_value")
          .eq("salon_id", args.salonId)
          .limit(24),
      ),
      safeSelectList<AiMemoryRow>(async () =>
        await args.supabase
          .from("ai_memory")
          .select("memory_key,memory_value")
          .eq("salon_id", args.salonId)
          .eq("scope", "long")
          .order("last_used_at", { ascending: false })
          .limit(24),
      ),
      safeSelectList<CompletedAppointmentRow>(async () =>
        await args.supabase
          .from("appointments")
          .select(
            "completed_at,date,service_price_snapshot,services(name,category,price),staff_members(name)",
          )
          .eq("salon_id", args.salonId)
          .eq("status", "completed")
          .gte("date", lookbackStart)
          .order("date", { ascending: false })
          .limit(600),
      ),
      safeSelectList<SalonPostRow>(async () =>
        await args.supabase
          .from("salon_posts")
          .select("title,caption,created_at,source_type")
          .eq("salon_id", args.salonId)
          .order("created_at", { ascending: false })
          .limit(12),
      ),
      safeSelectList<AuditLogRow>(async () =>
        await args.supabase
          .from("security_audit_logs")
          .select("metadata")
          .eq("salon_id", args.salonId)
          .eq("event_type", "panel.ai_query")
          .order("created_at", { ascending: false })
          .limit(12),
      ),
    ]);

  const settings = new Map(
    settingsRows.map((row) => [normalizeSettingToken(row.setting_key), row.setting_value]),
  );
  const memory = new Map(
    memoryRows.map((row) => [normalizeSettingToken(row.memory_key), row.memory_value]),
  );

  const topServices =
    readSettingArray(settings, memory, AI_SETTING_KEYS.topServices) ||
    [];
  const priorityProfessionals =
    readSettingArray(settings, memory, AI_SETTING_KEYS.priorityProfessionals) ||
    [];

  const snapshotWithoutSummary = {
    businessGoals: readSettingArray(settings, memory, AI_SETTING_KEYS.businessGoals),
    idealCustomerProfile: readSettingString(
      settings,
      memory,
      AI_SETTING_KEYS.idealCustomerProfile,
    ),
    preferredTone: readSettingString(
      settings,
      memory,
      AI_SETTING_KEYS.preferredTone,
    ),
    priorityProfessionals: priorityProfessionals.length
      ? priorityProfessionals
      : derivePriorityProfessionals(appointments),
    recentCampaigns: (() => {
      const configured = readSettingArray(settings, memory, AI_SETTING_KEYS.recentCampaigns);
      return configured.length ? configured : deriveRecentCampaigns(posts);
    })(),
    recentFocuses: deriveRecentFocuses(auditLogs),
    topServices: topServices.length ? topServices : deriveTopServices(appointments),
  } satisfies Omit<AiLongMemorySnapshot, "summary">;

  return {
    ...snapshotWithoutSummary,
    summary: buildSnapshotSummary(snapshotWithoutSummary),
  };
}

function normalizeSettingsForPersist(
  input: AiLongMemorySettingsInput,
) {
  return {
    [AI_SETTING_KEYS.preferredTone]:
      input.preferredTone != null
        ? { value: cleanAiText(input.preferredTone, 120) || null }
        : undefined,
    [AI_SETTING_KEYS.businessGoals]:
      input.businessGoals != null
        ? { values: uniqueStrings(extractStringArray(input.businessGoals, 80, 6), 6) }
        : undefined,
    [AI_SETTING_KEYS.idealCustomerProfile]:
      input.idealCustomerProfile != null
        ? { value: cleanAiText(input.idealCustomerProfile, 220) || null }
        : undefined,
    [AI_SETTING_KEYS.priorityProfessionals]:
      input.priorityProfessionals != null
        ? { values: uniqueStrings(extractStringArray(input.priorityProfessionals, 80, 6), 6) }
        : undefined,
    [AI_SETTING_KEYS.topServices]:
      input.topServices != null
        ? { values: uniqueStrings(extractStringArray(input.topServices, 80, 6), 6) }
        : undefined,
    [AI_SETTING_KEYS.recentCampaigns]:
      input.recentCampaigns != null
        ? { values: uniqueStrings(extractStringArray(input.recentCampaigns, 80, 6), 6) }
        : undefined,
  };
}

export async function saveAiLongMemorySettings(args: {
  salonId: string;
  supabase: any;
  userId: string;
  values: AiLongMemorySettingsInput;
}) {
  const normalized = normalizeSettingsForPersist(args.values);
  const rowsToUpsert = Object.entries(normalized)
    .filter((entry) => entry[1] !== undefined)
    .filter((entry) => {
      const payload = entry[1] as Record<string, unknown>;
      const value = payload.value;
      const values = payload.values;

      if (typeof value === "string") {
        return value.length > 0;
      }

      if (Array.isArray(values)) {
        return values.length > 0;
      }

      return false;
    })
    .map(([settingKey, settingValue]) => ({
      actor_user_id: args.userId,
      salon_id: args.salonId,
      setting_key: settingKey,
      setting_value: settingValue,
    }));
  const keysToDelete = Object.entries(normalized)
    .filter((entry) => entry[1] !== undefined)
    .filter((entry) => {
      const payload = entry[1] as Record<string, unknown>;
      const value = payload.value;
      const values = payload.values;

      if (value == null) {
        return true;
      }

      return Array.isArray(values) && values.length === 0;
    })
    .map(([settingKey]) => settingKey);

  if (rowsToUpsert.length) {
    const upsertResult = await args.supabase
      .from("ai_settings")
      .upsert(rowsToUpsert, { onConflict: "salon_id,setting_key" });

    if (upsertResult.error) {
      throw upsertResult.error;
    }
  }

  if (keysToDelete.length) {
    const deleteResult = await args.supabase
      .from("ai_settings")
      .delete()
      .eq("salon_id", args.salonId)
      .in("setting_key", keysToDelete);

    if (deleteResult.error) {
      throw deleteResult.error;
    }
  }
}
