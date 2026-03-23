import { beforeEach, describe, expect, it, vi } from "vitest";

import { WEEKDAY_OPTIONS } from "@/lib/schedule";
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
  regenerateSalonCodeActionImpl,
  updateSalonBrandingActionImpl,
  updateSalonScheduleActionImpl,
} from "@/app/_actions/settings";

describe("settings actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        logo_path: "logos/current.png",
      },
    });
  });

  it("regenerates the salon code and revalidates dashboard/settings", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: "ABCD1234",
      error: null,
    });
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(regenerateSalonCodeActionImpl(), redirectMock);

    expect(rpc).toHaveBeenCalledWith("generate_join_code");
    expect(updateSalon).toHaveBeenCalledWith({ join_code: "ABCD1234" });
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/settings"]),
    );
    expect(location).toBe("/dashboard/settings?message=Novo+c%C3%B3digo+gerado+com+sucesso.&tone=success");
  });

  it("rejects invalid whatsapp numbers before updating branding", async () => {
    const from = vi.fn();
    const storageFrom = vi.fn();

    createClientMock.mockReturnValue({
      from,
      storage: {
        from: storageFrom,
      },
    });

    const location = await captureRedirect(
      updateSalonBrandingActionImpl(
        makeFormData({
          name: "Studio Centro",
          whatsappPhone: "123",
        }),
      ),
      redirectMock,
    );

    expect(from).not.toHaveBeenCalled();
    expect(storageFrom).not.toHaveBeenCalled();
    expect(location).toContain("/dashboard/settings?");
    expect(location).toContain("WhatsApp+v%C3%A1lido");
  });

  it("updates the online schedule and business hours", async () => {
    const updateSalon = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({ error: null }),
    }));
    const upsertBusinessHours = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salons") {
          return {
            update: updateSalon,
          };
        }

        if (table === "salon_business_hours") {
          return {
            upsert: upsertBusinessHours,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const formValues: Record<string, string> = {
      timezone: "America/Sao_Paulo",
      slotStepMinutes: "30",
    };

    for (const weekday of WEEKDAY_OPTIONS) {
      formValues[`isOpen_${weekday.value}`] = "on";
      formValues[`opensAt_${weekday.value}`] = "09:00";
      formValues[`closesAt_${weekday.value}`] = "18:00";
    }

    const location = await captureRedirect(
      updateSalonScheduleActionImpl(makeFormData(formValues)),
      redirectMock,
    );

    expect(updateSalon).toHaveBeenCalledWith({
      timezone: "America/Sao_Paulo",
      slot_step_minutes: 30,
    });
    expect(upsertBusinessHours).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          salon_id: "salon-1",
          weekday: 0,
          is_open: true,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
        }),
      ]),
      { onConflict: "salon_id,weekday" },
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/settings"]),
    );
    expect(location).toBe("/dashboard/settings?message=Agenda+online+atualizada+com+sucesso.&tone=success");
  });
});
