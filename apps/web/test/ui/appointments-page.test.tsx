import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  TEST_REDIRECT_PREFIX,
} from "../server-action-test-helpers";

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

import AppointmentsPage from "@/app/dashboard/appointments/page";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

describe("appointments page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("redireciona a rota legada para a agenda da gestao", async () => {
    const location = await captureRedirect(
      Promise.resolve().then(() =>
        AppointmentsPage({
          searchParams: {
            dateFrom: "2026-03-22",
            message: "Agenda atualizada.",
            staffMemberId: "staff-1",
            status: "confirmed",
            tone: "success",
          },
        }),
      ),
      redirectMock,
    );

    const url = new URL(`https://painel.example${location}`);

    expect(url.pathname).toBe(MANAGEMENT_ROUTES.appointments);
    expect(url.searchParams.get("day")).toBe("2026-03-22");
    expect(url.searchParams.get("professionalId")).toBe("staff-1");
    expect(url.searchParams.get("status")).toBe("confirmed");
    expect(url.searchParams.get("message")).toBe("Agenda atualizada.");
    expect(url.searchParams.get("tone")).toBe("success");
  });
});
