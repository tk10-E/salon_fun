type MeasureServerRenderOptions = {
  thresholdMs?: number;
};

const DEFAULT_THRESHOLD_MS = 400;

function buildServerRenderLog(args: {
  durationMs: number;
  label: string;
  outcome: "completed" | "failed";
  thresholdMs: number;
}) {
  return JSON.stringify({
    duration_ms: args.durationMs,
    label: args.label,
    level: args.outcome === "failed" ? "error" : "info",
    outcome: args.outcome,
    threshold_ms: args.thresholdMs,
    type: "server_render",
  });
}

function shouldLogAllRenders() {
  return process.env.PANEL_PERF_LOG_ALL === "1";
}

export async function measureServerRender<T>(
  label: string,
  load: () => Promise<T>,
  options: MeasureServerRenderOptions = {},
): Promise<T> {
  const startedAt = Date.now();
  const thresholdMs = options.thresholdMs ?? DEFAULT_THRESHOLD_MS;

  try {
    const result = await load();
    const durationMs = Date.now() - startedAt;

    if (shouldLogAllRenders() || durationMs >= thresholdMs) {
      console.info(
        buildServerRenderLog({
          durationMs,
          label,
          outcome: "completed",
          thresholdMs,
        }),
      );
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(
      buildServerRenderLog({
        durationMs,
        label,
        outcome: "failed",
        thresholdMs,
      }),
      error,
    );
    throw error;
  }
}
