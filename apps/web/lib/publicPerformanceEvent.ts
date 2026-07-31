const MAX_STRING_LENGTH = 160;
const MAX_ROUTE_LENGTH = 220;
const MAX_USER_AGENT_LENGTH = 220;
const MAX_JOIN_CODE_LENGTH = 24;

type PublicPerformanceSource = "mobile" | "web";
type PublicPerformanceOutcome = "failed" | "ok";
type PublicPerformanceSeverity = "critical" | "slow";

export type PublicPerformanceEvent = {
  cacheStatus: string | null;
  durationMs: number;
  joinCode: string | null;
  operation: string;
  outcome: PublicPerformanceOutcome;
  route: string | null;
  severity: PublicPerformanceSeverity;
  source: PublicPerformanceSource;
  surface: string;
  userAgent: string | null;
};

function normalizeString(value: unknown, maxLength = MAX_STRING_LENGTH) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim().replace(/\s+/g, " ").slice(0, maxLength);
  return normalized || null;
}

function normalizeJoinCode(value: unknown) {
  const normalized = normalizeString(value, MAX_JOIN_CODE_LENGTH)?.toUpperCase() ?? null;
  return normalized && /^[A-Z0-9_-]{4,24}$/.test(normalized) ? normalized : null;
}

function normalizeDurationMs(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  const rounded = Math.round(parsed);
  if (rounded < 0 || rounded > 120_000) {
    return null;
  }

  return rounded;
}

function normalizeSource(value: unknown): PublicPerformanceSource | null {
  return value === "mobile" || value === "web" ? value : null;
}

function normalizeOutcome(value: unknown): PublicPerformanceOutcome | null {
  return value === "failed" || value === "ok" ? value : null;
}

function resolveSeverity(args: {
  durationMs: number;
  outcome: PublicPerformanceOutcome;
}) {
  if (args.outcome === "failed" || args.durationMs >= 4_000) {
    return "critical";
  }

  return "slow";
}

export function parsePublicPerformanceEvent(args: {
  payload: unknown;
  userAgent?: string | null;
}) {
  const body =
    args.payload && typeof args.payload === "object" && !Array.isArray(args.payload)
      ? (args.payload as Record<string, unknown>)
      : null;

  if (!body) {
    return null;
  }

  const source = normalizeSource(body.source);
  const surface = normalizeString(body.surface);
  const operation = normalizeString(body.operation);
  const outcome = normalizeOutcome(body.outcome);
  const durationMs = normalizeDurationMs(body.durationMs);

  if (!source || !surface || !operation || !outcome || durationMs === null) {
    return null;
  }

  return {
    cacheStatus: normalizeString(body.cacheStatus),
    durationMs,
    joinCode: normalizeJoinCode(body.joinCode),
    operation,
    outcome,
    route: normalizeString(body.route, MAX_ROUTE_LENGTH),
    severity: resolveSeverity({ durationMs, outcome }),
    source,
    surface,
    userAgent: normalizeString(args.userAgent, MAX_USER_AGENT_LENGTH),
  } satisfies PublicPerformanceEvent;
}
