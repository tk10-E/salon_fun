import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  completeCustomerAppointmentMock,
  getClientIpMock,
  guardApiRequestMock,
  hashSecurityIdentifierMock,
} = vi.hoisted(() => ({
  completeCustomerAppointmentMock: vi.fn(),
  getClientIpMock: vi.fn(),
  guardApiRequestMock: vi.fn(),
  hashSecurityIdentifierMock: vi.fn(),
}));

vi.mock("@/lib/customerAppointments", () => ({
  completeCustomerAppointment: completeCustomerAppointmentMock,
}));

vi.mock("@/lib/security", () => ({
  getClientIp: getClientIpMock,
  guardApiRequest: guardApiRequestMock,
  hashSecurityIdentifier: hashSecurityIdentifierMock,
}));

import { POST } from "@/app/api/public/customer-appointments/status/route";

describe("customer appointment status route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    completeCustomerAppointmentMock.mockReset();
    getClientIpMock.mockReturnValue("127.0.0.1");
    guardApiRequestMock.mockResolvedValue(null);
    hashSecurityIdentifierMock.mockImplementation((value: string) => value);
  });

  it("returns 401 when the client app does not send an access token", async () => {
    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/status",
        {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ appointmentId: "appointment-1" }),
        },
      ),
    );

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({
      error: "unauthenticated",
      ok: false,
    });
    expect(completeCustomerAppointmentMock).not.toHaveBeenCalled();
  });

  it("completes the appointment for the authenticated client app", async () => {
    completeCustomerAppointmentMock.mockResolvedValue({
      completedAt: "2026-05-11T13:35:00.000Z",
      id: "appointment-1",
      status: "completed",
    });

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/status",
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ appointmentId: "appointment-1" }),
        },
      ),
    );

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      appointment: {
        completedAt: "2026-05-11T13:35:00.000Z",
        id: "appointment-1",
        status: "completed",
      },
      ok: true,
    });
    expect(completeCustomerAppointmentMock).toHaveBeenCalledWith({
      accessToken: "customer-token",
      appointmentId: "appointment-1",
    });
  });

  it("maps the 3-minute lock to 409 for the client app", async () => {
    completeCustomerAppointmentMock.mockRejectedValue(
      new Error("appointment_completion_too_early"),
    );

    const response = await POST(
      new Request(
        "https://painel.jc7desenvovimento.online/api/public/customer-appointments/status",
        {
          method: "POST",
          headers: {
            authorization: "Bearer customer-token",
            "content-type": "application/json",
          },
          body: JSON.stringify({ appointmentId: "appointment-1" }),
        },
      ),
    );

    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({
      error: "appointment_completion_too_early",
      ok: false,
    });
  });
});
