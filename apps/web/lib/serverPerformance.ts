type MeasureServerRenderOptions = {
  thresholdMs?: number;
};

const DEFAULT_THRESHOLD_MS = 400;

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
      console.info(`[panel-perf] ${label} completed in ${durationMs}ms`);
    }

    return result;
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    console.error(`[panel-perf] ${label} failed after ${durationMs}ms`, error);
    throw error;
  }
}
