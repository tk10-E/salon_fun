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

import { createServiceActionImpl, deleteServiceActionImpl } from "@/app/_actions/services";

describe("service actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("creates a service, notifies customers and revalidates dashboards", async () => {
    const insertService = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return { insert: insertService };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(),
      },
    });

    const location = await captureRedirect(
      createServiceActionImpl(
        makeFormData({
          category: "hair",
          name: "Corte premium",
          description: "Com lavagem",
          price: "90",
          duration: "50",
          sortOrder: "2",
        }),
      ),
      redirectMock,
    );

    expect(insertService).toHaveBeenCalledWith({
      salon_id: "salon-1",
      category: "hair",
      name: "Corte premium",
      description: "Com lavagem",
      price: 90,
      duration: 50,
      sort_order: 2,
      image_path: null,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "service_published",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard", "/dashboard/services", "/dashboard/team"]),
    );
    expect(location).toBe("/dashboard/services?message=Servi%C3%A7o+adicionado+com+sucesso.&tone=success");
  });

  it("blocks service deletion when linked appointments or posts exist", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "service-1",
        name: "Corte premium",
        image_path: null,
      },
      error: null,
    });
    const selectService = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle,
        })),
      })),
    }));
    const deleteService = vi.fn();

    const appointmentsCount = vi.fn().mockResolvedValue({ count: 2 });
    const selectAppointments = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: appointmentsCount,
      })),
    }));

    const linkedPostsCount = vi.fn().mockResolvedValue({ count: 1 });
    const selectPosts = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: linkedPostsCount,
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: selectService,
            delete: deleteService,
          };
        }

        if (table === "appointments") {
          return { select: selectAppointments };
        }

        if (table === "salon_posts") {
          return { select: selectPosts };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(),
      },
    });

    const location = await captureRedirect(
      deleteServiceActionImpl(
        makeFormData({
          serviceId: "service-1",
        }),
      ),
      redirectMock,
    );

    expect(deleteService).not.toHaveBeenCalled();
    expect(location).toContain("/dashboard/services?");
    expect(location).toContain("N%C3%A3o+foi+poss%C3%ADvel+excluir+Corte+premium");
  });
});
