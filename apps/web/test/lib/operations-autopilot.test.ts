import { describe, expect, it } from "vitest";

import {
  inspectOperationsAutopilotAppointment,
  shouldAutoCompleteAppointment,
  shouldAutoMarkNoShowAppointment,
} from "@/lib/operationsAutopilot";

const referenceNow = new Date("2026-05-20T15:00:00.000Z");

describe("operations autopilot", () => {
  it("auto-completes open appointments only after the grace window and with objective proof", () => {
    expect(
      shouldAutoCompleteAppointment(
        {
          customer_presence_confirmed_at: "2026-05-20T13:30:00.000Z",
          ends_at: "2026-05-20T14:20:00.000Z",
          status: "confirmed",
        },
        referenceNow,
      ),
    ).toBe(true);

    expect(
      shouldAutoCompleteAppointment(
        {
          ends_at: "2026-05-20T14:20:00.000Z",
          status: "confirmed",
        },
        referenceNow,
      ),
    ).toBe(false);

    expect(
      shouldAutoCompleteAppointment(
        {
          customer_presence_confirmed_at: "2026-05-20T14:40:00.000Z",
          ends_at: "2026-05-20T14:50:00.000Z",
          status: "confirmed",
        },
        referenceNow,
      ),
    ).toBe(false);
  });

  it("marks pending appointments as no-show after the short grace window", () => {
    expect(
      shouldAutoMarkNoShowAppointment(
        {
          customer_confirmation_requested_at: "2026-05-20T10:00:00.000Z",
          ends_at: "2026-05-20T12:30:00.000Z",
          protection_confirmation_required: true,
          status: "pending",
        },
        referenceNow,
      ),
    ).toBe(true);
  });

  it("marks confirmed appointments as no-show only after the longer window when there is no proof", () => {
    expect(
      shouldAutoMarkNoShowAppointment(
        {
          ends_at: "2026-05-20T10:30:00.000Z",
          status: "confirmed",
        },
        referenceNow,
      ),
    ).toBe(true);

    expect(
      shouldAutoMarkNoShowAppointment(
        {
          customer_confirmation_requested_at: "2026-05-20T10:00:00.000Z",
          ends_at: "2026-05-20T13:30:00.000Z",
          protection_confirmation_required: true,
          status: "confirmed",
        },
        referenceNow,
      ),
    ).toBe(false);
  });

  it("keeps watched appointments visible when the system is still waiting for a signal", () => {
    expect(
      inspectOperationsAutopilotAppointment(
        {
          customer_confirmation_requested_at: "2026-05-20T10:00:00.000Z",
          ends_at: "2026-05-20T14:10:00.000Z",
          protection_confirmation_required: true,
          status: "confirmed",
        },
        referenceNow,
      ),
    ).toEqual(
      expect.objectContaining({
        action: "watch",
        reason: expect.stringContaining("acompanha"),
      }),
    );
  });
});
