import { describe, expect, it } from "vitest";

import { parsePublicPerformanceEvent } from "@/lib/publicPerformanceEvent";

describe("public performance event parser", () => {
  it("accepts a valid mobile slow event", () => {
    expect(
      parsePublicPerformanceEvent({
        payload: {
          cacheStatus: "network_miss",
          durationMs: 1480,
          joinCode: "jc70",
          operation: "agenda.fetchAppointments",
          outcome: "ok",
          route: "/agenda",
          source: "mobile",
          surface: "agenda",
        },
        userAgent: "Dart/3.10 (Android)",
      }),
    ).toMatchObject({
      cacheStatus: "network_miss",
      durationMs: 1480,
      joinCode: "JC70",
      operation: "agenda.fetchAppointments",
      outcome: "ok",
      route: "/agenda",
      severity: "slow",
      source: "mobile",
      surface: "agenda",
      userAgent: "Dart/3.10 (Android)",
    });
  });

  it("marks failures as critical", () => {
    expect(
      parsePublicPerformanceEvent({
        payload: {
          durationMs: 320,
          operation: "session.restore",
          outcome: "failed",
          source: "mobile",
          surface: "auth",
        },
      }),
    ).toMatchObject({
      durationMs: 320,
      outcome: "failed",
      severity: "critical",
    });
  });

  it("rejects malformed payloads", () => {
    expect(
      parsePublicPerformanceEvent({
        payload: {
          durationMs: -10,
          operation: "",
          outcome: "ok",
          source: "desktop",
          surface: "feed",
        },
      }),
    ).toBeNull();
  });
});
