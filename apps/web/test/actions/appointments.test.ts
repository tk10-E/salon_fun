import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const { createClientMock, redirectMock, revalidatePathMock, requireOwnerSalonMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  updateAppointmentDepositActionImpl,
  updateAppointmentStatusActionImpl,
} from "@/app/_actions/appointments";

describe("appointment actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("confirms an appointment, clears vacancy alerts and notifies the customer", async () => {
    const appointmentContext = {
      id: "appointment-1",
      customer_id: "customer-1",
      date: "2026-03-22T15:00:00.000Z",
      ends_at: "2026-03-22T16:00:00.000Z",
      status: "pending" as const,
      services: { name: "Corte premium" },
      staff_members: { name: "Ana" },
    };

    const selectAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: appointmentContext }),
        })),
      })),
    }));
    const updateAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    const deleteVacancyAlerts = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue(undefined),
      })),
    }));

    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: selectAppointment,
            update: updateAppointment,
          };
        }

        if (table === "salon_vacancy_alerts") {
          return {
            delete: deleteVacancyAlerts,
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(),
    });

    const location = await captureRedirect(
      updateAppointmentStatusActionImpl(
        makeFormData({
          appointmentId: "appointment-1",
          status: "confirmed",
        }),
      ),
      redirectMock,
    );

    expect(updateAppointment).toHaveBeenCalledWith({
      status: "confirmed",
      completed_at: null,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "appointment_confirmed",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/dashboard/appointments",
        "/dashboard/benefits",
        "/dashboard/benefits/loyalty",
        "/dashboard/benefits/referrals",
        "/dashboard/benefits/automations",
      ]),
    );
    expect(location).toBe("/dashboard/appointments?message=Agendamento+confirmado+com+sucesso.&tone=success");
  });

  it("marks a protected booking deposit as received", async () => {
    const selectAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "appointment-1",
              deposit_amount: 40,
              deposit_paid_at: null,
              deposit_status: "pending",
            },
          }),
        })),
      })),
    }));
    const updateAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: selectAppointment,
            update: updateAppointment,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(),
    });

    const location = await captureRedirect(
      updateAppointmentDepositActionImpl(
        makeFormData({
          appointmentId: "appointment-1",
          depositStatus: "received",
        }),
      ),
      redirectMock,
    );

    expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        deposit_status: "received",
        deposit_notes: null,
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/appointments"]),
    );
    expect(location).toBe(
      "/dashboard/appointments?message=Sinal+marcado+como+recebido.&tone=success",
    );
  });

  it("clears the customer payment report when a deposit goes back to pending", async () => {
    const selectAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({
            data: {
              id: "appointment-1",
              deposit_amount: 40,
              deposit_paid_at: "2026-04-03T12:00:00.000Z",
              deposit_status: "refunded",
            },
          }),
        })),
      })),
    }));
    const updateAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: selectAppointment,
            update: updateAppointment,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(),
    });

    await captureRedirect(
      updateAppointmentDepositActionImpl(
        makeFormData({
          appointmentId: "appointment-1",
          depositStatus: "pending",
        }),
      ),
      redirectMock,
    );

    expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        deposit_status: "pending",
        deposit_customer_reported_paid_at: null,
        deposit_customer_reported_paid_via: null,
        deposit_customer_reported_reference: null,
      }),
    );
  });
});
