import { describe, expect, it } from "vitest";

import { __appointmentPlanReservationInternals } from "@/lib/appointmentPlanReservations";

describe("appointment plan reservation recurrence", () => {
  it("builds a fixed weekly cadence for a monthly four-session plan", () => {
    const recurrenceDays =
      __appointmentPlanReservationInternals.calculateMembershipRecurrenceDays({
        membershipEndDayKey: "2026-05-31",
        membershipStartDayKey: "2026-05-01",
        sessionsIncluded: 4,
      });

    expect(recurrenceDays).toBe(7);
    expect(
      __appointmentPlanReservationInternals.buildFixedRecurringDayKeys({
        count: 4,
        endDayKey: "2026-05-31",
        recurrenceDays,
        startDayKey: "2026-05-05",
      }),
    ).toEqual(["2026-05-05", "2026-05-12", "2026-05-19", "2026-05-26"]);
  });

  it("stops the recurring series when the fixed slot exits the plan window", () => {
    const recurrenceDays =
      __appointmentPlanReservationInternals.calculateMembershipRecurrenceDays({
        membershipEndDayKey: "2026-05-31",
        membershipStartDayKey: "2026-05-01",
        sessionsIncluded: 4,
      });

    expect(
      __appointmentPlanReservationInternals.buildFixedRecurringDayKeys({
        count: 4,
        endDayKey: "2026-05-31",
        recurrenceDays,
        startDayKey: "2026-05-17",
      }),
    ).toEqual(["2026-05-17", "2026-05-24", "2026-05-31"]);
  });

  it("keeps a weekly cadence when the next monthly cycle starts midweek", () => {
    expect(
      __appointmentPlanReservationInternals.buildWeeklyRecurringDayKeys({
        count: 3,
        endDayKey: "2026-06-11",
        preferredWeekday: 1,
        startDayKey: "2026-05-13",
      }),
    ).toEqual(["2026-05-18", "2026-05-25", "2026-06-01"]);
  });

  it("uses a weekly recurrence for a three-session monthly plan", () => {
    expect(
      __appointmentPlanReservationInternals.calculateMembershipRecurrenceDays({
        membershipEndDayKey: "2026-06-11",
        membershipStartDayKey: "2026-05-13",
        sessionsIncluded: 3,
      }),
    ).toBe(7);
  });

  it("shifts a requested weekday to the first valid cycle day after approval", () => {
    expect(
      __appointmentPlanReservationInternals.resolveRequestedMembershipSeriesStartDayKey(
        {
          membership: {
            customer_id: "c1",
            expires_at: "2026-06-11",
            id: "m1",
            offer_id: "offer-1",
            price_snapshot: 149.9,
            salon_id: "salon-1",
            service_id: "s1",
            service_name_snapshot: "Corte",
            sessions_included: 3,
            sessions_used: 0,
            started_at: "2026-05-13",
            status: "active",
            title: "Plano corte",
          },
          requestedLocalDayKey: "2026-05-11",
          salonTimeZone: "UTC",
        },
      ),
    ).toBe("2026-05-18");
  });

  it("recognizes when the desired recurring slot is already covered", () => {
    expect(
      __appointmentPlanReservationInternals.isRecurringSlotCovered({
        appointments: [
          {
            appointmentId: "a1",
            customerId: "c1",
            endsAt: "2026-05-18T14:00:00.000Z",
            localDayKey: "2026-05-18",
            localMinutesOfDay: 810,
            serviceId: "s1",
            sessionIndex: 1,
            staffMemberId: "staff-1",
            startsAt: "2026-05-18T13:30:00.000Z",
            status: "confirmed",
          },
        ],
        desiredDayKey: "2026-05-18",
        preferredMinutesOfDay: 810,
        preferredStaffMemberId: "staff-1",
      }),
    ).toBe(true);
  });

  it("does not treat another slot as coverage for the fixed series", () => {
    expect(
      __appointmentPlanReservationInternals.isRecurringSlotCovered({
        appointments: [
          {
            appointmentId: "a1",
            customerId: "c1",
            endsAt: "2026-05-18T14:00:00.000Z",
            localDayKey: "2026-05-18",
            localMinutesOfDay: 810,
            serviceId: "s1",
            sessionIndex: 1,
            staffMemberId: "staff-2",
            startsAt: "2026-05-18T13:30:00.000Z",
            status: "confirmed",
          },
        ],
        desiredDayKey: "2026-05-18",
        preferredMinutesOfDay: 810,
        preferredStaffMemberId: "staff-1",
      }),
    ).toBe(false);
  });

  it("detects when a future plan series is already fixed", () => {
    expect(
      __appointmentPlanReservationInternals.isFutureSeriesAlreadyFixed({
        appointments: [
          {
            appointmentId: "a1",
            customerId: "c1",
            endsAt: "2026-05-05T15:00:00.000Z",
            localDayKey: "2026-05-05",
            localMinutesOfDay: 660,
            serviceId: "s1",
            sessionIndex: 2,
            staffMemberId: "staff-1",
            startsAt: "2026-05-05T14:00:00.000Z",
            status: "confirmed",
          },
          {
            appointmentId: "a2",
            customerId: "c1",
            endsAt: "2026-05-12T15:00:00.000Z",
            localDayKey: "2026-05-12",
            localMinutesOfDay: 660,
            serviceId: "s1",
            sessionIndex: 3,
            staffMemberId: "staff-1",
            startsAt: "2026-05-12T14:00:00.000Z",
            status: "confirmed",
          },
          {
            appointmentId: "a3",
            customerId: "c1",
            endsAt: "2026-05-19T15:00:00.000Z",
            localDayKey: "2026-05-19",
            localMinutesOfDay: 660,
            serviceId: "s1",
            sessionIndex: 4,
            staffMemberId: "staff-1",
            startsAt: "2026-05-19T14:00:00.000Z",
            status: "confirmed",
          },
        ],
        membership: {
          customer_id: "c1",
          expires_at: "2026-05-31",
          id: "m1",
          offer_id: null,
          price_snapshot: null,
          salon_id: "salon-1",
          service_id: "s1",
          service_name_snapshot: "Corte",
          sessions_included: 4,
          sessions_used: 1,
          started_at: "2026-05-01",
          status: "active",
          title: "Plano corte",
        },
        timeZone: "UTC",
      }),
    ).toBe(true);
  });

  it("detects when a future plan series still needs migration", () => {
    expect(
      __appointmentPlanReservationInternals.isFutureSeriesAlreadyFixed({
        appointments: [
          {
            appointmentId: "a1",
            customerId: "c1",
            endsAt: "2026-05-05T15:00:00.000Z",
            localDayKey: "2026-05-05",
            localMinutesOfDay: 660,
            serviceId: "s1",
            sessionIndex: 2,
            staffMemberId: "staff-1",
            startsAt: "2026-05-05T14:00:00.000Z",
            status: "confirmed",
          },
          {
            appointmentId: "a2",
            customerId: "c1",
            endsAt: "2026-05-13T15:00:00.000Z",
            localDayKey: "2026-05-13",
            localMinutesOfDay: 660,
            serviceId: "s1",
            sessionIndex: 3,
            staffMemberId: "staff-1",
            startsAt: "2026-05-13T14:00:00.000Z",
            status: "confirmed",
          },
        ],
        membership: {
          customer_id: "c1",
          expires_at: "2026-05-31",
          id: "m1",
          offer_id: null,
          price_snapshot: null,
          salon_id: "salon-1",
          service_id: "s1",
          service_name_snapshot: "Corte",
          sessions_included: 4,
          sessions_used: 1,
          started_at: "2026-05-01",
          status: "active",
          title: "Plano corte",
        },
        timeZone: "UTC",
      }),
    ).toBe(false);
  });

  it("keeps neutralized plan appointments inside the live booking constraints", () => {
    expect(
      __appointmentPlanReservationInternals.PLAN_NEUTRALIZED_CONFIRMATION_LEAD_MINUTES,
    ).toBe(5);
  });
});
