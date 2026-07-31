const DEFAULT_MIN_REFRESH_INTERVAL_MS = 1800;
const DEFAULT_MAX_DEFERRED_REFRESH_MS = 5000;

export function getDashboardRefreshDelay(args: {
  debounceMs: number;
  lastRefreshAt: number;
  now: number;
  queuedAt?: number | null;
  minRefreshIntervalMs?: number;
  maxDeferredRefreshMs?: number;
}) {
  const minRefreshIntervalMs =
    args.minRefreshIntervalMs ?? DEFAULT_MIN_REFRESH_INTERVAL_MS;
  const maxDeferredRefreshMs =
    args.maxDeferredRefreshMs ?? DEFAULT_MAX_DEFERRED_REFRESH_MS;

  const queuedAt = args.queuedAt ?? null;
  if (queuedAt !== null && queuedAt > 0) {
    const deferredForMs = args.now - queuedAt;
    if (deferredForMs >= maxDeferredRefreshMs) {
      return 0;
    }
  }

  if (args.lastRefreshAt <= 0) {
    return args.debounceMs;
  }

  const elapsedSinceLastRefresh = Math.max(0, args.now - args.lastRefreshAt);
  const throttleDelay = Math.max(
    0,
    minRefreshIntervalMs - elapsedSinceLastRefresh,
  );

  return Math.max(args.debounceMs, throttleDelay);
}
