import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getClientIpMock,
  guardApiRequestMock,
  hashSecurityIdentifierMock,
  rescheduleCustomerAppointmentMock,
} = vi.hoisted(() => ({
  getClientIpMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  hashSecurityIdentifierMock: vi.fn(),
  rescheduleCustomerAppointmentMock: vi.fn(),
}));

vi.mock("@/lib/customerAppointments", () => ({
  rescheduleCustomerAppointment: rescheduleCustomerAppointmentMock,
}));

vi.mock("@/lib/security", () => ({
  getClientIp: getClientIpMock,
  guardApiRequest: guardApiRequestMock,
  hashSecurityIdentifier: hashSecurityIdentifierMock,
}));

import { POST } from "@/app/api/public/customer-appointments/reschedule/route";

describe("customer appointment reschedule route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getClientIpMock.mockReturnValue("127.0.0.1");
    guardApiRequestMock.mockResolvedValue(null);
    hashSecurityIdentifierMock.mockImplementation((value: string) => value);
  });

  it("returns 401 when the client app does not send an access token", async () => {
    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/reschedule",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            appointmentId: "appointment-1",
            preferredStaffMemberId: "staff-1",
            requestedDate: "2026-05-12T17:00:00.000Z",
            serviceId: "service-1",
          }),
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
      ok: false,
    });
    expect(rescheduleCustomerAppointmentMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the client app omits the reschedule payload", async () => {
    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/reschedule",
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            appointmentId: "appointment-1",
            requestedDate: "2026-05-12T17:00:00.000Z",
          }),
        },
      ),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: "appointment_reschedule_payload_required",
      ok: false,
    });
    expect(rescheduleCustomerAppointmentMock).not.toHaveBeenCalled();
  });

  it("reschedules the appointment for the authenticated client app", async () => {
    rescheduleCustomerAppointmentMock.mockResolvedValue({
      date: "2026-05-12T17:00:00.000Z",
      endsAt: "2026-05-12T17:30:00.000Z",
      id: "appointment-1",
      staffMemberId: "staff-1",
      status: "confirmed",
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/reschedule",
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            appointmentId: "appointment-1",
            preferredStaffMemberId: "staff-1",
            requestedDate: "2026-05-12T17:00:00.000Z",
            serviceId: "service-1",
          }),
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appointment: {
        date: "2026-05-12T17:00:00.000Z",
        endsAt: "2026-05-12T17:30:00.000Z",
        id: "appointment-1",
        staffMemberId: "staff-1",
        status: "confirmed",
      },
      ok: true,
    });
    expect(rescheduleCustomerAppointmentMock).toHaveBeenCalledWith({
      accessToken: "customer-token",
      appointmentId: "appointment-1",
      preferredStaffMemberId: "staff-1",
      requestedDate: "2026-05-12T17:00:00.000Z",
      serviceId: "service-1",
    });
  });

  it("maps business-rule conflicts to the correct response codes", async () => {
    rescheduleCustomerAppointmentMock.mockRejectedValue(
      new Error("membership_plan_staff_locked"),
    );

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/reschedule",
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({
            appointmentId: "appointment-1",
            preferredStaffMemberId: "staff-2",
            requestedDate: "2026-05-12T17:00:00.000Z",
            serviceId: "service-1",
          }),
        },
      ),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "membership_plan_staff_locked",
      ok: false,
    });
  });
});
