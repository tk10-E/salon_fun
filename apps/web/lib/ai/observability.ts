import { createAdminClient } from "@/lib/supabase/admin";

type SecurityAuditSeverity = "critical" | "info" | "warn";
export type AiObservabilityOutcome = "answered" | "failed" | "generated";
type AiObservabilityPeriodDays = 7 | 30 | 90;
type AiObservabilityRow = {
  created_at: string;
  event_type: string | null;
  id: string;
  metadata: Record<string, unknown> | null;
  request_path: string | null;
  severity: SecurityAuditSeverity | null;
};
type AiObservabilityRollupRow = {
  day: string | null;
  event_count: number | null;
  fallback_count: number | null;
  feature: string | null;
  model: string | null;
  outcome: string | null;
  prompt_profile: string | null;
  skill_id: string | null;
  skill_label: string | null;
};
type AiObservabilityAggregateRecord = {
  count: number;
  dayKey: string;
  fallbackCount: number;
  feature: string;
  featureLabel: string;
  model: string | null;
  outcome: AiObservabilityOutcome;
  promptProfile: string | null;
  skillId: string | null;
  skillLabel: string | null;
};

export type AiObservabilityFilters = {
  day?: string | null;
  feature?: string | null;
  model?: string | null;
  outcome?: AiObservabilityOutcome | null;
  periodDays?: AiObservabilityPeriodDays;
  promptProfile?: string | null;
  skillId?: string | null;
};

export type AiObservabilityEntry = {
  createdAt: string;
  dayKey: string;
  eventType: string;
  feature: string;
  featureLabel: string;
  id: string;
  model: string | null;
  outcome: AiObservabilityOutcome;
  outcomeLabel: string;
  policyVersion: string | null;
  promptProfile: string | null;
  promptVersion: string | null;
  requestPath: string | null;
  severity: SecurityAuditSeverity | null;
  skillId: string | null;
  skillLabel: string | null;
  summary: string | null;
  usedFallback: boolean;
};

export type AiObservabilityOption = {
  count: number;
  label: string;
  value: string;
};

export type AiObservabilityTrendPoint = {
  dayKey: string;
  dayLabel: string;
  failureCount: number;
  fallbackCount: number;
  successCount: number;
  totalCount: number;
};

export type AiObservabilityBreakdownItem = {
  count: number;
  failureCount: number;
  fallbackCount: number;
  key: string;
  label: string;
  successCount: number;
};

export type AiObservabilitySnapshot = {
  appliedFilters: {
    day: string | null;
    feature: string | null;
    model: string | null;
    outcome: AiObservabilityOutcome | null;
    periodDays: AiObservabilityPeriodDays;
    promptProfile: string | null;
    skillId: string | null;
  };
  breakdowns: {
    features: AiObservabilityBreakdownItem[];
    models: AiObservabilityBreakdownItem[];
    skills: AiObservabilityBreakdownItem[];
  };
  entries: AiObservabilityEntry[];
  options: {
    features: AiObservabilityOption[];
    models: AiObservabilityOption[];
    outcomes: AiObservabilityOption[];
    promptProfiles: AiObservabilityOption[];
    skills: AiObservabilityOption[];
  };
  totals: {
    fallbackCount: number;
    failureCount: number;
    filteredCount: number;
    lastEventAt: string | null;
    successCount: number;
    topFeatureLabel: string;
    topModelLabel: string;
    topPromptLabel: string;
    topSkillLabel: string;
    totalEvents: number;
    truncated: boolean;
  };
  trend: AiObservabilityTrendPoint[];
};

const DEFAULT_PERIOD_DAYS: AiObservabilityPeriodDays = 30;
const DEFAULT_ENTRY_LIMIT = 30;
const MAX_AUDIT_ROWS = 5000;
const AI_FEATURE_LABELS: Record<string, string> = {
  feed_draft: "Rascunho de feed",
  marketing_campaign_message: "Mensagem de campanha",
  panel_assistant: "Assistente do painel",
  promotion_draft: "Rascunho de promocao",
  recovery_campaign: "Campanha de reativacao",
};
const AI_OUTCOME_LABELS: Record<AiObservabilityOutcome, string> = {
  answered: "Respondido",
  failed: "Falha",
  generated: "Gerado",
};
const PANEL_ASSISTANT_EVENT_TYPE = "panel.ai_query";

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maxLength)
    : "";
}

function normalizeFilterValue(value: unknown, maxLength: number) {
  const normalized = cleanText(value, maxLength);
  return normalized || null;
}

function normalizeModel(value: unknown) {
  return normalizeFilterValue(typeof value === "string" ? value : null, 120);
}

function normalizeBoolean(value: unknown) {
  return value === true;
}

function normalizeOutcome(value: unknown): AiObservabilityOutcome | null {
  return value === "answered" || value === "failed" || value === "generated"
    ? value
    : null;
}

function normalizeDayKey(value: unknown) {
  const normalized = cleanText(value, 10);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return null;
  }

  const date = new Date(`${normalized}T12:00:00Z`);
  return Number.isNaN(date.getTime()) ? null : normalized;
}

function resolveFeatureLabel(feature: string) {
  return AI_FEATURE_LABELS[feature] ?? feature.replace(/_/g, " ");
}

function resolveOutcomeLabel(outcome: AiObservabilityOutcome) {
  return AI_OUTCOME_LABELS[outcome] ?? "Respondido";
}

function resolveSkillLabel(metadata: Record<string, unknown>) {
  return (
    normalizeFilterValue(metadata.skillLabel as string | null | undefined, 80) ??
    normalizeFilterValue(metadata.skillId as string | null | undefined, 80)
  );
}

function resolveSummary(metadata: Record<string, unknown>, featureLabel: string) {
  const answerSummary = normalizeFilterValue(metadata.answerSummary, 220);
  if (answerSummary) {
    return answerSummary;
  }

  const campaignType = normalizeFilterValue(metadata.campaignType, 80);
  if (campaignType) {
    return `${featureLabel} para ${campaignType.replace(/_/g, " ")}`;
  }

  const offerKind = normalizeFilterValue(metadata.offerKind, 80);
  if (offerKind) {
    return `${featureLabel} para ${offerKind.replace(/_/g, " ")}`;
  }

  const postType = normalizeFilterValue(metadata.postType, 80);
  if (postType) {
    return `${featureLabel} em ${postType.replace(/_/g, " ")}`;
  }

  return featureLabel;
}

function formatDayLabel(dayKey: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(`${dayKey}T12:00:00Z`));
}

function mapAuditRowToEntry(row: AiObservabilityRow): AiObservabilityEntry | null {
  const eventType = cleanText(row.event_type, 120);
  const metadata = row.metadata ?? {};

  if (!eventType) {
    return null;
  }

  if (eventType === PANEL_ASSISTANT_EVENT_TYPE) {
    const feature =
      normalizeFilterValue(metadata.feature as string | null | undefined, 80) ??
      "panel_assistant";
    const featureLabel = resolveFeatureLabel(feature);

    return {
      createdAt: row.created_at,
      dayKey: row.created_at.slice(0, 10),
      eventType,
      feature,
      featureLabel,
      id: row.id,
      model: normalizeModel(metadata.model),
      outcome: "answered",
      outcomeLabel: resolveOutcomeLabel("answered"),
      policyVersion: normalizeFilterValue(metadata.policyVersion, 80),
      promptProfile: normalizeFilterValue(metadata.promptProfile, 120),
      promptVersion: normalizeFilterValue(metadata.promptVersion, 40),
      requestPath: normalizeFilterValue(row.request_path, 220),
      severity: row.severity,
      skillId: normalizeFilterValue(metadata.skillId, 80),
      skillLabel: resolveSkillLabel(metadata),
      summary: resolveSummary(metadata, featureLabel),
      usedFallback: cleanText(metadata.model, 160).includes("(fallback)"),
    };
  }

  const aiEventMatch = eventType.match(/^ai\.(.+)_(generated|failed)$/);

  if (!aiEventMatch) {
    return null;
  }

  const feature = cleanText(aiEventMatch[1], 80);
  const outcome = normalizeOutcome(aiEventMatch[2]);

  if (!feature || !outcome || outcome === "answered") {
    return null;
  }

  const featureLabel = resolveFeatureLabel(feature);

  return {
    createdAt: row.created_at,
    dayKey: row.created_at.slice(0, 10),
    eventType,
    feature,
    featureLabel,
    id: row.id,
    model: normalizeModel(metadata.aiModel ?? metadata.model),
    outcome,
    outcomeLabel: resolveOutcomeLabel(outcome),
    policyVersion: normalizeFilterValue(metadata.policyVersion, 80),
    promptProfile: normalizeFilterValue(metadata.promptProfile, 120),
    promptVersion: normalizeFilterValue(metadata.promptVersion, 40),
    requestPath: normalizeFilterValue(row.request_path, 220),
    severity: row.severity,
    skillId: normalizeFilterValue(metadata.skillId, 80),
    skillLabel: resolveSkillLabel(metadata),
    summary: resolveSummary(metadata, featureLabel),
    usedFallback: normalizeBoolean(metadata.usedFallback),
  };
}

function mapEntryToAggregateRecord(
  entry: AiObservabilityEntry,
): AiObservabilityAggregateRecord {
  return {
    count: 1,
    dayKey: entry.dayKey,
    fallbackCount: entry.usedFallback ? 1 : 0,
    feature: entry.feature,
    featureLabel: entry.featureLabel,
    model: entry.model,
    outcome: entry.outcome,
    promptProfile: entry.promptProfile,
    skillId: entry.skillId,
    skillLabel: entry.skillLabel,
  };
}

function mapRollupRowToAggregateRecord(
  row: AiObservabilityRollupRow,
): AiObservabilityAggregateRecord | null {
  const dayKey = normalizeDayKey(row.day);
  const feature = normalizeFilterValue(row.feature, 80);
  const outcome = normalizeOutcome(row.outcome);

  if (!dayKey || !feature || !outcome) {
    return null;
  }

  const count = Math.max(0, Number(row.event_count ?? 0));
  if (!Number.isFinite(count) || count < 1) {
    return null;
  }

  return {
    count,
    dayKey,
    fallbackCount: Math.max(0, Number(row.fallback_count ?? 0)),
    feature,
    featureLabel: resolveFeatureLabel(feature),
    model: normalizeModel(row.model),
    outcome,
    promptProfile: normalizeFilterValue(row.prompt_profile, 120),
    skillId: normalizeFilterValue(row.skill_id, 80),
    skillLabel: normalizeFilterValue(row.skill_label, 80),
  };
}

function countOptions(
  values: Array<{ label?: string | null; value: string | null; weight?: number }>,
) {
  const counts = new Map<string, { count: number; label: string }>();

  for (const item of values) {
    if (!item.value) {
      continue;
    }

    const weight = Math.max(1, Number(item.weight ?? 1));
    const current = counts.get(item.value) ?? {
      count: 0,
      label: item.label ?? item.value,
    };
    current.count += weight;
    counts.set(item.value, current);
  }

  return [...counts.entries()]
    .map(([value, item]) => ({
      count: item.count,
      label: item.label,
      value,
    }))
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    );
}

function resolveTopLabel(
  options: AiObservabilityOption[],
  emptyLabel: string,
) {
  return options[0]?.label ?? emptyLabel;
}

function startDateForPeriod(periodDays: AiObservabilityPeriodDays) {
  return new Date(
    Date.now() - (periodDays - 1) * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function startDayKeyForPeriod(periodDays: AiObservabilityPeriodDays) {
  return startDateForPeriod(periodDays).slice(0, 10);
}

function normalizePeriodDays(value: number | null | undefined) {
  return value === 7 || value === 30 || value === 90
    ? value
    : DEFAULT_PERIOD_DAYS;
}

function resolveObservabilityAdminClient(input?: any | null) {
  if (input) {
    return input;
  }

  try {
    return createAdminClient() as any;
  } catch {
    return null;
  }
}

function applyAggregateFilters(
  records: AiObservabilityAggregateRecord[],
  filters: AiObservabilitySnapshot["appliedFilters"],
) {
  return records.filter((record) => {
    if (filters.day && record.dayKey !== filters.day) {
      return false;
    }

    if (filters.feature && record.feature !== filters.feature) {
      return false;
    }

    if (filters.model && record.model !== filters.model) {
      return false;
    }

    if (filters.outcome && record.outcome !== filters.outcome) {
      return false;
    }

    if (filters.promptProfile && record.promptProfile !== filters.promptProfile) {
      return false;
    }

    if (filters.skillId && record.skillId !== filters.skillId) {
      return false;
    }

    return true;
  });
}

function buildTrend(
  records: AiObservabilityAggregateRecord[],
  periodDays: AiObservabilityPeriodDays,
  selectedDay: string | null,
) {
  const countsByDay = new Map<
    string,
    {
      failureCount: number;
      fallbackCount: number;
      successCount: number;
      totalCount: number;
    }
  >();

  for (const record of records) {
    const current = countsByDay.get(record.dayKey) ?? {
      failureCount: 0,
      fallbackCount: 0,
      successCount: 0,
      totalCount: 0,
    };

    current.totalCount += record.count;
    current.fallbackCount += record.fallbackCount;

    if (record.outcome === "failed") {
      current.failureCount += record.count;
    } else {
      current.successCount += record.count;
    }

    countsByDay.set(record.dayKey, current);
  }

  if (selectedDay) {
    const current = countsByDay.get(selectedDay) ?? {
      failureCount: 0,
      fallbackCount: 0,
      successCount: 0,
      totalCount: 0,
    };

    return [
      {
        dayKey: selectedDay,
        dayLabel: formatDayLabel(selectedDay),
        ...current,
      },
    ];
  }

  const trend: AiObservabilityTrendPoint[] = [];
  const periodStart = new Date(`${startDayKeyForPeriod(periodDays)}T12:00:00Z`);

  for (let offset = 0; offset < periodDays; offset += 1) {
    const currentDate = new Date(periodStart);
    currentDate.setUTCDate(currentDate.getUTCDate() + offset);
    const dayKey = currentDate.toISOString().slice(0, 10);
    const current = countsByDay.get(dayKey) ?? {
      failureCount: 0,
      fallbackCount: 0,
      successCount: 0,
      totalCount: 0,
    };

    trend.push({
      dayKey,
      dayLabel: formatDayLabel(dayKey),
      ...current,
    });
  }

  return trend;
}

function buildBreakdown(
  records: AiObservabilityAggregateRecord[],
  kind: "feature" | "model" | "skill",
) {
  const grouped = new Map<string, AiObservabilityBreakdownItem>();

  for (const record of records) {
    const key =
      kind === "feature"
        ? record.feature
        : kind === "model"
          ? record.model
          : record.skillId;
    const label =
      kind === "feature"
        ? record.featureLabel
        : kind === "model"
          ? record.model
          : record.skillLabel;

    if (!key || !label) {
      continue;
    }

    const current = grouped.get(key) ?? {
      count: 0,
      failureCount: 0,
      fallbackCount: 0,
      key,
      label,
      successCount: 0,
    };

    current.count += record.count;
    current.fallbackCount += record.fallbackCount;

    if (record.outcome === "failed") {
      current.failureCount += record.count;
    } else {
      current.successCount += record.count;
    }

    grouped.set(key, current);
  }

  return [...grouped.values()]
    .sort(
      (left, right) =>
        right.count - left.count || left.label.localeCompare(right.label),
    )
    .slice(0, 8);
}

function sumAggregateCount(records: AiObservabilityAggregateRecord[]) {
  return records.reduce((total, record) => total + record.count, 0);
}

function sumAggregateFallback(records: AiObservabilityAggregateRecord[]) {
  return records.reduce((total, record) => total + record.fallbackCount, 0);
}

function buildEmptySnapshot(
  filters: AiObservabilitySnapshot["appliedFilters"],
): AiObservabilitySnapshot {
  return {
    appliedFilters: filters,
    breakdowns: {
      features: [],
      models: [],
      skills: [],
    },
    entries: [],
    options: {
      features: [],
      models: [],
      outcomes: [],
      promptProfiles: [],
      skills: [],
    },
    totals: {
      fallbackCount: 0,
      failureCount: 0,
      filteredCount: 0,
      lastEventAt: null,
      successCount: 0,
      topFeatureLabel: "Sem feature suficiente",
      topModelLabel: "Sem modelo suficiente",
      topPromptLabel: "Sem prompt suficiente",
      topSkillLabel: "Sem skill suficiente",
      totalEvents: 0,
      truncated: false,
    },
    trend: buildTrend([], filters.periodDays, filters.day),
  };
}

async function loadAiObservabilityRollups(args: {
  admin: any;
  periodDays: AiObservabilityPeriodDays;
  salonId: string;
}) {
  try {
    const result = await args.admin
      .from("ai_observability_daily_rollup")
      .select(
        "day,event_count,fallback_count,feature,model,outcome,prompt_profile,skill_id,skill_label",
      )
      .eq("salon_id", args.salonId)
      .gte("day", startDayKeyForPeriod(args.periodDays));

    if (result.error) {
      throw result.error;
    }

    return ((result.data ?? []) as AiObservabilityRollupRow[])
      .map(mapRollupRowToAggregateRecord)
      .filter((item): item is AiObservabilityAggregateRecord => item !== null);
  } catch {
    return null;
  }
}

export function parseAiObservabilityPeriodDays(
  value: string | null | undefined,
) {
  const parsed = Number(value ?? "");
  return normalizePeriodDays(Number.isFinite(parsed) ? parsed : null);
}

export function parseAiObservabilityOutcomeFilter(
  value: string | null | undefined,
) {
  return normalizeOutcome(value);
}

export function parseAiObservabilityDayFilter(value: string | null | undefined) {
  return normalizeDayKey(value);
}

export async function getAiObservabilitySnapshot(args: {
  admin?: any | null;
  entryLimit?: number;
  filters?: AiObservabilityFilters;
  limit?: number;
  salonId: string;
}): Promise<AiObservabilitySnapshot> {
  const admin = resolveObservabilityAdminClient(args.admin ?? null);
  const appliedFilters: AiObservabilitySnapshot["appliedFilters"] = {
    day: normalizeDayKey(args.filters?.day),
    feature: normalizeFilterValue(args.filters?.feature, 80),
    model: normalizeFilterValue(args.filters?.model, 120),
    outcome: normalizeOutcome(args.filters?.outcome),
    periodDays: normalizePeriodDays(args.filters?.periodDays),
    promptProfile: normalizeFilterValue(args.filters?.promptProfile, 120),
    skillId: normalizeFilterValue(args.filters?.skillId, 80),
  };

  if (!admin) {
    return buildEmptySnapshot(appliedFilters);
  }

  const limit = Math.max(100, Math.min(args.limit ?? MAX_AUDIT_ROWS, MAX_AUDIT_ROWS));
  const entryLimit = Math.max(
    1,
    Math.min(args.entryLimit ?? DEFAULT_ENTRY_LIMIT, limit),
  );
  let logQuery = admin
    .from("security_audit_logs")
    .select("id,created_at,event_type,metadata,severity,request_path")
    .eq("salon_id", args.salonId)
    .gte(
      "created_at",
      appliedFilters.day
        ? `${appliedFilters.day}T00:00:00.000Z`
        : startDateForPeriod(appliedFilters.periodDays),
    );

  if (appliedFilters.day) {
    logQuery = logQuery.lt(
      "created_at",
      `${appliedFilters.day}T23:59:59.999Z`,
    );
  }

  const result = await logQuery.order("created_at", { ascending: false }).limit(limit);

  if (result.error) {
    throw result.error;
  }

  const allRelevantEntries = ((result.data ?? []) as AiObservabilityRow[])
    .map(mapAuditRowToEntry)
    .filter((item): item is AiObservabilityEntry => item !== null);
  const aggregateSource =
    (await loadAiObservabilityRollups({
      admin,
      periodDays: appliedFilters.periodDays,
      salonId: args.salonId,
    })) ?? allRelevantEntries.map(mapEntryToAggregateRecord);
  const filteredAggregateRecords = applyAggregateFilters(
    aggregateSource,
    appliedFilters,
  );
  const filteredEntries = allRelevantEntries.filter((item) => {
    if (appliedFilters.day && item.dayKey !== appliedFilters.day) {
      return false;
    }

    if (appliedFilters.feature && item.feature !== appliedFilters.feature) {
      return false;
    }

    if (appliedFilters.model && item.model !== appliedFilters.model) {
      return false;
    }

    if (appliedFilters.outcome && item.outcome !== appliedFilters.outcome) {
      return false;
    }

    if (
      appliedFilters.promptProfile &&
      item.promptProfile !== appliedFilters.promptProfile
    ) {
      return false;
    }

    if (appliedFilters.skillId && item.skillId !== appliedFilters.skillId) {
      return false;
    }

    return true;
  });
  const breakdowns = {
    features: buildBreakdown(filteredAggregateRecords, "feature"),
    models: buildBreakdown(filteredAggregateRecords, "model"),
    skills: buildBreakdown(filteredAggregateRecords, "skill"),
  };
  const options = {
    features: countOptions(
      aggregateSource.map((item) => ({
        label: item.featureLabel,
        value: item.feature,
        weight: item.count,
      })),
    ),
    models: countOptions(
      aggregateSource.map((item) => ({
        value: item.model,
        weight: item.count,
      })),
    ),
    outcomes: countOptions(
      aggregateSource.map((item) => ({
        label: resolveOutcomeLabel(item.outcome),
        value: item.outcome,
        weight: item.count,
      })),
    ),
    promptProfiles: countOptions(
      aggregateSource.map((item) => ({
        value: item.promptProfile,
        weight: item.count,
      })),
    ),
    skills: countOptions(
      aggregateSource.map((item) => ({
        label: item.skillLabel,
        value: item.skillId,
        weight: item.count,
      })),
    ),
  };
  const filteredCount = sumAggregateCount(filteredAggregateRecords);
  const failureCount = sumAggregateCount(
    filteredAggregateRecords.filter((item) => item.outcome === "failed"),
  );
  const successCount = filteredCount - failureCount;
  const fallbackCount = sumAggregateFallback(filteredAggregateRecords);

  return {
    appliedFilters,
    breakdowns,
    entries: filteredEntries.slice(0, entryLimit),
    options,
    totals: {
      fallbackCount,
      failureCount,
      filteredCount,
      lastEventAt: filteredEntries[0]?.createdAt ?? null,
      successCount,
      topFeatureLabel: resolveTopLabel(
        countOptions(
          breakdowns.features.map((item) => ({
            label: item.label,
            value: item.key,
            weight: item.count,
          })),
        ),
        "Sem feature suficiente",
      ),
      topModelLabel: resolveTopLabel(
        countOptions(
          breakdowns.models.map((item) => ({
            label: item.label,
            value: item.key,
            weight: item.count,
          })),
        ),
        "Sem modelo suficiente",
      ),
      topPromptLabel: resolveTopLabel(
        countOptions(
          filteredAggregateRecords.map((item) => ({
            value: item.promptProfile,
            weight: item.count,
          })),
        ),
        "Sem prompt suficiente",
      ),
      topSkillLabel: resolveTopLabel(
        countOptions(
          breakdowns.skills.map((item) => ({
            label: item.label,
            value: item.key,
            weight: item.count,
          })),
        ),
        "Sem skill suficiente",
      ),
      totalEvents: sumAggregateCount(aggregateSource),
      truncated:
        allRelevantEntries.length >= limit || filteredEntries.length > entryLimit,
    },
    trend: buildTrend(
      filteredAggregateRecords,
      appliedFilters.periodDays,
      appliedFilters.day,
    ),
  };
}

export function formatAiObservabilityCsv(entries: AiObservabilityEntry[]) {
  const header = [
    "Data",
    "Dia",
    "Feature",
    "Resultado",
    "Skill",
    "Modelo",
    "Prompt profile",
    "Prompt version",
    "Policy version",
    "Fallback",
    "Resumo",
    "Rota",
    "Severidade",
    "Event type",
  ];

  const escapeCsv = (value: unknown) =>
    `"${String(value ?? "").replaceAll('"', '""')}"`;

  return `\ufeff${[
    header.map(escapeCsv).join(","),
    ...entries.map((entry) =>
      [
        entry.createdAt,
        entry.dayKey,
        entry.featureLabel,
        entry.outcomeLabel,
        entry.skillLabel ?? "",
        entry.model ?? "",
        entry.promptProfile ?? "",
        entry.promptVersion ?? "",
        entry.policyVersion ?? "",
        entry.usedFallback ? "sim" : "nao",
        entry.summary ?? "",
        entry.requestPath ?? "",
        entry.severity ?? "",
        entry.eventType,
      ]
        .map(escapeCsv)
        .join(","),
    ),
  ].join("\n")}`;
}

export function getAiObservabilityExportFilename(args: {
  day?: string | null;
  periodDays: AiObservabilityPeriodDays;
  salonId: string;
}) {
  const scope = args.day ? `dia-${args.day}` : `${args.periodDays}d`;
  return `ia-observabilidade-${args.salonId}-${scope}.csv`;
}
