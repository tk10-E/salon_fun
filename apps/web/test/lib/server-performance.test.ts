import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { measureServerRender } from "@/lib/serverPerformance";

describe("server performance helper", () => {
  const originalPerfEnv = process.env.PANEL_PERF_LOG_ALL;

  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.PANEL_PERF_LOG_ALL;
  });

  afterEach(() => {
    if (originalPerfEnv === undefined) {
      delete process.env.PANEL_PERF_LOG_ALL;
    } else {
      process.env.PANEL_PERF_LOG_ALL = originalPerfEnv;
    }
  });

  it("logs slow renders after the threshold", async () => {
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(Date, "now").mockReturnValueOnce(1_000).mockReturnValueOnce(1_620);

    const result = await measureServerRender(
      "dashboard.home",
      async () => "ok",
      { thresholdMs: 400 },
    );

    expect(result).toBe("ok");
    expect(infoSpy).toHaveBeenCalledWith(
      JSON.stringify({
        duration_ms: 620,
        label: "dashboard.home",
        level: "info",
        outcome: "completed",
        threshold_ms: 400,
        type: "server_render",
      }),
    );
  });

  it("can log every render when the env flag is enabled", async () => {
    process.env.PANEL_PERF_LOG_ALL = "1";
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.spyOn(Date, "now").mockReturnValueOnce(2_000).mockReturnValueOnce(2_040);

    await measureServerRender("dashboard.feed", async () => "ok", {
      thresholdMs: 400,
    });

    expect(infoSpy).toHaveBeenCalledWith(
      JSON.stringify({
        duration_ms: 40,
        label: "dashboard.feed",
        level: "info",
        outcome: "completed",
        threshold_ms: 400,
        type: "server_render",
      }),
    );
  });

  it("logs and rethrows failures", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const failure = new Error("database timeout");
    vi.spyOn(Date, "now").mockReturnValueOnce(3_000).mockReturnValueOnce(3_380);

    await expect(
      measureServerRender("dashboard.whatsapp", async () => {
        throw failure;
      }),
    ).rejects.toThrow("database timeout");

    expect(errorSpy).toHaveBeenCalledWith(
      JSON.stringify({
        duration_ms: 380,
        label: "dashboard.whatsapp",
        level: "error",
        outcome: "failed",
        threshold_ms: 400,
        type: "server_render",
      }),
      failure,
    );
  });
});
