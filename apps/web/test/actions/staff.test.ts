import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  getSalonBillingEntitlementsMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getSalonBillingEntitlementsMock: vi.fn(),
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

vi.mock("@/lib/billing", () => ({
  getSalonBillingEntitlements: getSalonBillingEntitlementsMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createStaffMemberActionImpl,
  toggleStaffMemberStatusActionImpl,
  updateStaffBusinessHoursActionImpl,
} from "@/app/_actions/staff";

describe("staff actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
    getSalonBillingEntitlementsMock.mockResolvedValue({
      currentPlan: { displayName: "Growth" },
      maxStaffMembers: 10,
    });
  });

  it("creates a staff member and notifies customers", async () => {
    const countActive = vi.fn().mockResolvedValue({ count: 2 });
    const selectStaffCount = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: countActive,
      })),
    }));
    const selectCreatedStaff = vi.fn(() => ({
      single: vi.fn().mockResolvedValue({
        data: { id: "staff-1" },
        error: null,
      }),
    }));
    const insertStaff = vi.fn(() => ({
      select: selectCreatedStaff,
    }));
    const selectServices = vi.fn(() => ({
      eq: vi.fn().mockResolvedValue({
        data: [{ id: "service-1" }, { id: "service-2" }],
        error: null,
      }),
    }));
    const insertAssignments = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: selectStaffCount,
            insert: insertStaff,
          };
        }

        if (table === "services") {
          return { select: selectServices };
        }

        if (table === "staff_service_assignments") {
          return { insert: insertAssignments };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      createStaffMemberActionImpl(
        makeFormData({
          name: "Marina",
          role: "Colorista",
        }),
      ),
      redirectMock,
    );

    expect(insertStaff).toHaveBeenCalledWith({
      salon_id: "salon-1",
      name: "Marina",
      role: "Colorista",
      is_active: true,
    });
    expect(insertAssignments).toHaveBeenCalledWith([
      { staff_member_id: "staff-1", service_id: "service-1" },
      { staff_member_id: "staff-1", service_id: "service-2" },
    ]);
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "staff_published",
        title: "Novo profissional no salão",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+adicionado+com+sucesso.&tone=success",
    );
  });

  it("reactivates a staff member and notifies customers", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "staff-1",
        name: "Marina",
        role: "Colorista",
        is_active: false,
      },
      error: null,
    });
    const updateStatus = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const countAssignments = vi.fn().mockResolvedValue({ count: 2, error: null });
    const selectAssignments = vi.fn(() => ({
      eq: countAssignments,
    }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
            update: updateStatus,
          };
        }

        if (table === "staff_service_assignments") {
          return {
            select: selectAssignments,
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      toggleStaffMemberStatusActionImpl(
        makeFormData({
          staffMemberId: "staff-1",
          isActive: "true",
        }),
      ),
      redirectMock,
    );

    expect(updateStatus).toHaveBeenCalledWith({ is_active: true });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "staff_reactivated",
        title: "Equipe atualizada no salão",
      }),
    );
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/gestao/profissionais",
    );
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+reativado+com+sucesso.&tone=success",
    );
  });

  it("blocks staff openings that are off the salon schedule step", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", slot_step_minutes: 30 },
    });
    const upsertBusinessHours = vi.fn();

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: "staff-1",
                      name: "Marina",
                      role: "Colorista",
                      is_active: true,
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_business_hours") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  {
                    weekday: 1,
                    is_open: true,
                    opens_at: "09:00:00",
                  },
                ],
                error: null,
              }),
            })),
          };
        }

        if (table === "staff_business_hours") {
          return { upsert: upsertBusinessHours };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateStaffBusinessHoursActionImpl(
        makeFormData({
          staffMemberId: "staff-1",
          staffIsOpen_1: "on",
          staffOpensAt_1: "09:15",
          staffClosesAt_1: "18:00",
        }),
      ),
      redirectMock,
    );

    expect(upsertBusinessHours).not.toHaveBeenCalled();
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=A+abertura+do+profissional+em+segunda+precisa+seguir+o+intervalo+oficial+da+agenda+do+sal%C3%A3o.&tone=error",
    );
  });
});
