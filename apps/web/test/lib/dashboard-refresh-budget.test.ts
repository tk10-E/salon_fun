import { describe, expect, it } from "vitest";

import { getDashboardRefreshDelay } from "@/lib/dashboardRefreshBudget";

describe("dashboard refresh budget", () => {
  it("uses the debounce delay before the first refresh", () => {
    expect(
      getDashboardRefreshDelay({
        debounceMs: 240,
        lastRefreshAt: 0,
        now: 10_000,
      }),
    ).toBe(240);
  });

  it("throttles refreshes when the previous refresh was too recent", () => {
    expect(
      getDashboardRefreshDelay({
        debounceMs: 240,
        lastRefreshAt: 9_200,
        minRefreshIntervalMs: 1_800,
        now: 10_000,
      }),
    ).toBe(1_000);
  });

  it("flushes immediately after a long deferred burst", () => {
    expect(
      getDashboardRefreshDelay({
        debounceMs: 240,
        lastRefreshAt: 9_900,
        maxDeferredRefreshMs: 5_000,
        minRefreshIntervalMs: 1_800,
        now: 10_000,
        queuedAt: 4_900,
      }),
    ).toBe(0);
  });
});
