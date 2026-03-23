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

import { deleteSalonNotificationActionImpl } from "@/app/_actions/notifications";

describe("notification actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("deletes selected notifications and returns to the previous page when the page is emptied", async () => {
    const maybeExistingIds = [{ id: "n1" }, { id: "n2" }];
    const loadNotifications = vi.fn().mockResolvedValue({
      data: maybeExistingIds,
      error: null,
    });
    const deleteNotifications = vi.fn(() => ({
      in: vi.fn(() => ({
        eq: vi.fn(() => ({
          select: vi.fn().mockResolvedValue({
            data: maybeExistingIds,
            error: null,
          }),
        })),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "salon_customer_notifications") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => ({
            in: vi.fn(() => ({
              eq: vi.fn(() => ({
                returns: loadNotifications,
              })),
            })),
          })),
          delete: deleteNotifications,
        };
      }),
    });

    const location = await captureRedirect(
      deleteSalonNotificationActionImpl(
        makeFormData({
          notificationIds: ["n1", "n2"],
          returnPathCurrent: "/dashboard/notifications?page=2",
          returnPathPrevious: "/dashboard/notifications?page=1",
          pageItemCount: "2",
        }),
      ),
      redirectMock,
    );

    expect(loadNotifications).toHaveBeenCalled();
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/notifications"]),
    );
    expect(location).toBe("/dashboard/notifications?page=1&message=2+avisos+exclu%C3%ADdos+com+sucesso.&tone=success");
  });

  it("requires at least one selected notification", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn(),
    });

    const location = await captureRedirect(
      deleteSalonNotificationActionImpl(
        makeFormData({
          returnPathCurrent: "/dashboard/notifications",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe("/dashboard/notifications?message=Selecione+pelo+menos+um+aviso+para+excluir.&tone=error");
  });
});
