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
  registerInventoryMovementActionImpl,
  saveInventoryProductActionImpl,
  saveStaffCommissionSettingsActionImpl,
} from "@/app/_actions/operations";

describe("operations actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("updates automatic commission settings for a staff member", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "staff-1", name: "Ana" },
      error: null,
    });
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "staff_members") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
          })),
          update,
        };
      }),
    });

    const location = await captureRedirect(
      saveStaffCommissionSettingsActionImpl(
        makeFormData({
          staffMemberId: "staff-1",
          commissionRatePercent: "35",
          commissionFlatFee: "12.50",
        }),
      ),
      redirectMock,
    );

    expect(update).toHaveBeenCalledWith({
      commission_rate_percent: 35,
      commission_flat_fee: 12.5,
    });
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard/operations", "/dashboard"]),
    );
    expect(location).toBe(
      "/dashboard/operations?message=Comiss%C3%A3o+autom%C3%A1tica+de+Ana+atualizada+com+sucesso.&tone=success",
    );
  });

  it("creates an inventory product for the salon", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "inventory_products") {
          throw new Error(`Unexpected table ${table}`);
        }

        return { insert };
      }),
    });

    const location = await captureRedirect(
      saveInventoryProductActionImpl(
        makeFormData({
          name: "Shampoo reconstrutor",
          brand: "Wella",
          sku: "WEL-01",
          unit: "un",
          currentStock: "8",
          minimumStock: "2",
          costPrice: "24.90",
          retailPrice: "44.90",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(insert).toHaveBeenCalledWith({
      salon_id: "salon-1",
      name: "Shampoo reconstrutor",
      brand: "Wella",
      sku: "WEL-01",
      unit: "un",
      current_stock: 8,
      minimum_stock: 2,
      cost_price: 24.9,
      retail_price: 44.9,
      is_active: true,
    });
    expect(location).toBe(
      "/dashboard/operations?message=Shampoo+reconstrutor+adicionado+ao+estoque.&tone=success",
    );
  });

  it("shows a friendly error when stock movement exceeds inventory", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "product-1", name: "Shampoo reconstrutor" },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "insufficient_inventory_stock" },
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table !== "inventory_products") {
          throw new Error(`Unexpected table ${table}`);
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle,
              })),
            })),
          })),
        };
      }),
      rpc,
    });

    const location = await captureRedirect(
      registerInventoryMovementActionImpl(
        makeFormData({
          productId: "product-1",
          movementType: "out",
          quantity: "15",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith("register_inventory_movement", {
      product_id_input: "product-1",
      movement_type_input: "out",
      quantity_input: 15,
      reason_input: null,
      staff_member_id_input: null,
    });
    expect(location).toBe(
      "/dashboard/operations?message=O+estoque+de+Shampoo+reconstrutor+n%C3%A3o+cobre+essa+sa%C3%ADda.&tone=error",
    );
  });
});
