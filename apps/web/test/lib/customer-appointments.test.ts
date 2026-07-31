import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createAdminClientMock,
  createSupabaseClientMock,
  finalizeAppointmentPlanReservationMock,
  neutralizeMembershipPlanAppointmentMock,
  resolveAppointmentPlanReservationMock,
  resolveAuthenticatedCustomerContextMock,
  transferAppointmentPlanReservationMock,
} = vi.hoisted(() => ({
  createAdminClientMock: vi.fn(),
  createSupabaseClientMock: vi.fn(),
  finalizeAppointmentPlanReservationMock: vi.fn(),
  neutralizeMembershipPlanAppointmentMock: vi.fn(),
  resolveAppointmentPlanReservationMock: vi.fn(),
  resolveAuthenticatedCustomerContextMock: vi.fn(),
  transferAppointmentPlanReservationMock: vi.fn(),
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient: createSupabaseClientMock,
}));

vi.mock("@/lib/env", () => ({
  supabaseAnonKey: "anon-key",
  supabaseUrl: "https://example.supabase.co",
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: createAdminClientMock,
}));

vi.mock("@/lib/appointmentReviews", () => ({
  resolveAuthenticatedCustomerContext: resolveAuthenticatedCustomerContextMock,
}));

vi.mock("@/lib/appointmentPlanReservations", () => ({
  finalizeAppointmentPlanReservation: finalizeAppointmentPlanReservationMock,
  neutralizeMembershipPlanAppointment: neutralizeMembershipPlanAppointmentMock,
  resolveAppointmentPlanReservation: resolveAppointmentPlanReservationMock,
  transferAppointmentPlanReservation: transferAppointmentPlanReservationMock,
}));

import {
  completeCustomerAppointment,
  rescheduleCustomerAppointment,
} from "@/lib/customerAppointments";

function buildAppointmentAdmin(args: {
  appointment: Record<string, unknown> | null;
  onUpdate?: () => Promise<{ error: unknown }>;
  onDeleteVacancy?: () => Promise<{ error: unknown }>;
  salonTimeZone?: string;
}) {
  const appointmentQuery = {
    eq: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: args.appointment,
            error: null,
          }),
        })),
      })),
    })),
  };
  const appointmentsTable = {
    select: vi.fn(() => appointmentQuery),
    update: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          eq: vi.fn().mockImplementation(
            args.onUpdate ??
              (() =>
                Promise.resolve({
                  error: null,
                })),
          ),
        })),
      })),
    })),
  };
  const vacancyTable = {
    delete: vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockImplementation(
          args.onDeleteVacancy ??
            (() =>
              Promise.resolve({
                error: null,
              })),
        ),
      })),
    })),
  };
  const salonTable = {
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        maybeSingle: vi.fn().mockResolvedValue({
          data: { timezone: args.salonTimeZone ?? "America/Sao_Paulo" },
          error: null,
        }),
      })),
    })),
  };

  return {
    from: vi.fn((table: string) => {
      if (table === "appointments") {
        return appointmentsTable;
      }

      if (table === "salon_vacancy_alerts") {
        return vacancyTable;
      }

      if (table === "salons") {
        return salonTable;
      }

      throw new Error(`Unexpected table ${table}`);
    }),
  };
}

describe("customer appointment domain rules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    createAdminClientMock.mockReset();
    createSupabaseClientMock.mockReset();
    resolveAuthenticatedCustomerContextMock.mockResolvedValue({
      customerId: "customer-1",
      salonId: "salon-1",
      userId: "user-1",
    });
    resolveAppointmentPlanReservationMock.mockResolvedValue(null);
    finalizeAppointmentPlanReservationMock.mockResolvedValue(null);
    neutralizeMembershipPlanAppointmentMock.mockResolvedValue(undefined);
    transferAppointmentPlanReservationMock.mockResolvedValue(null);
  });

  it("only lets the client complete the appointment after the service end plus the release window", async () => {
    const admin = buildAppointmentAdmin({
      appointment: {
        id: "appointment-1",
        customer_id: "customer-1",
        salon_id: "salon-1",
        date: "2026-05-20T12:00:00.000Z",
        ends_at: "2026-05-20T12:40:00.000Z",
        status: "confirmed",
      },
    });

    await expect(
      completeCustomerAppointment({
        accessToken: "customer-token",
        admin,
        appointmentId: "appointment-1",
        now: new Date("2026-05-20T12:42:00.000Z"),
      }),
    ).rejects.toThrow("appointment_completion_too_early");

    expect(admin.from).toHaveBeenCalledWith("appointments");
  });

  it("completes the appointment once the service really finished", async () => {
    const admin = buildAppointmentAdmin({
      appointment: {
        id: "appointment-1",
        customer_id: "customer-1",
        salon_id: "salon-1",
        date: "2026-05-20T12:00:00.000Z",
        ends_at: "2026-05-20T12:40:00.000Z",
        status: "confirmed",
      },
    });

    await expect(
      completeCustomerAppointment({
        accessToken: "customer-token",
        admin,
        appointmentId: "appointment-1",
        now: new Date("2026-05-20T12:43:01.000Z"),
      }),
    ).resolves.toEqual({
      completedAt: "2026-05-20T12:43:01.000Z",
      id: "appointment-1",
      status: "completed",
    });
  });

  it("reschedules through the database routine and transfers the plan reservation to the new appointment", async () => {
    const customerRpc = vi.fn().mockResolvedValue({
      data: {
        date: "2026-05-21T15:00:00.000Z",
        ends_at: "2026-05-21T15:30:00.000Z",
        id: "appointment-2",
        staff_member_id: "staff-2",
        status: "confirmed",
      },
      error: null,
    });
    createSupabaseClientMock.mockReturnValue({
      rpc: customerRpc,
    });
    resolveAppointmentPlanReservationMock.mockResolvedValue({
      appointmentId: "appointment-1",
      customerId: "customer-1",
      membershipExpiresAt: "2026-05-31",
      membershipId: "membership-1",
      membershipStartedAt: "2026-05-01",
      membershipTitle: "Plano corte",
      reservationStatus: "scheduled",
      salonId: "salon-1",
      serviceId: "service-1",
      sessionIndex: 1,
      sessionsIncluded: 4,
      source: "reservation",
    });
    const admin = buildAppointmentAdmin({
      appointment: {
        id: "appointment-1",
        customer_id: "customer-1",
        salon_id: "salon-1",
        service_id: "service-1",
        staff_member_id: "staff-2",
        date: "2026-05-20T15:00:00.000Z",
        ends_at: "2026-05-20T15:30:00.000Z",
        status: "confirmed",
      },
      salonTimeZone: "America/Sao_Paulo",
    });

    await expect(
      rescheduleCustomerAppointment({
        accessToken: "customer-token",
        admin,
        appointmentId: "appointment-1",
        preferredStaffMemberId: "staff-2",
        requestedDate: "2026-05-21T15:00:00.000Z",
        serviceId: "service-1",
      }),
    ).resolves.toEqual({
      date: "2026-05-21T15:00:00.000Z",
      endsAt: "2026-05-21T15:30:00.000Z",
      id: "appointment-2",
      staffMemberId: "staff-2",
      status: "confirmed",
    });

    expect(customerRpc).toHaveBeenCalledWith("reschedule_appointment", {
      appointment_uuid: "appointment-1",
      booking_policy_version_input: null,
      preferred_staff_member_uuid: "staff-2",
      requested_date: "2026-05-21T15:00:00.000Z",
    });
    expect(transferAppointmentPlanReservationMock).toHaveBeenCalledWith({
      admin,
      nextAppointmentId: "appointment-2",
      previousAppointmentId: "appointment-1",
      salonId: "salon-1",
    });
  });

  it("keeps the appointment unchanged when the customer picks the same slot again", async () => {
    const customerRpc = vi.fn();
    createSupabaseClientMock.mockReturnValue({
      rpc: customerRpc,
    });
    const admin = buildAppointmentAdmin({
      appointment: {
        id: "appointment-1",
        customer_id: "customer-1",
        salon_id: "salon-1",
        service_id: "service-1",
        staff_member_id: "staff-2",
        date: "2026-05-21T15:00:00.000Z",
        ends_at: "2026-05-21T15:30:00.000Z",
        status: "confirmed",
      },
      salonTimeZone: "America/Sao_Paulo",
    });

    await expect(
      rescheduleCustomerAppointment({
        accessToken: "customer-token",
        admin,
        appointmentId: "appointment-1",
        preferredStaffMemberId: "staff-2",
        requestedDate: "2026-05-21T15:00:00.000Z",
        serviceId: "service-1",
      }),
    ).resolves.toEqual({
      date: "2026-05-21T15:00:00.000Z",
      endsAt: "2026-05-21T15:30:00.000Z",
      id: "appointment-1",
      staffMemberId: "staff-2",
      status: "confirmed",
    });

    expect(customerRpc).not.toHaveBeenCalled();
  });
});
