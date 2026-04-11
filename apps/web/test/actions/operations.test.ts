import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  dispatchPendingWhatsAppNotificationsMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  dispatchPendingWhatsAppNotificationsMock: vi.fn(),
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

vi.mock("@/lib/whatsappDispatch", () => ({
  dispatchPendingWhatsAppNotifications: dispatchPendingWhatsAppNotificationsMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  registerInventoryMovementActionImpl,
  runSalonAutoPilotActionImpl,
  saveInventoryProductActionImpl,
  saveStaffCommissionSettingsActionImpl,
  updateCustomerProductOrderStatusActionImpl,
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
    dispatchPendingWhatsAppNotificationsMock.mockResolvedValue({
      ok: true,
      failed: 0,
      missingConfigSalons: [],
      missingPhone: 0,
      processed: 0,
      sent: 0,
    });
  });

  it("runs appointment, growth and haircut reminders in auto pilot", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {}, error: null });

    createClientMock.mockReturnValue({ rpc });

    const location = await captureRedirect(
      runSalonAutoPilotActionImpl(makeFormData({})),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith(
      "queue_due_appointment_customer_notifications",
      expect.objectContaining({ run_at: expect.any(String) }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "queue_due_customer_growth_notifications",
      expect.objectContaining({ run_at: expect.any(String) }),
    );
    expect(rpc).toHaveBeenCalledWith(
      "queue_due_haircut_rebook_notifications",
      expect.objectContaining({ run_at: expect.any(String) }),
    );
    expect(dispatchPendingWhatsAppNotificationsMock).toHaveBeenCalledWith({
      limit: 25,
      salonId: "salon-1",
    });
    expect(location).toBe(
      "/dashboard/operations?message=Modo+automatico+rodou+agora+e+nao+encontrou+mensagens+vencidas+para+disparar.&tone=success",
    );
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
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "inventory_products") {
          return { insert };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        if (table !== "inventory_products") {
          throw new Error(`Unexpected table ${table}`);
        }
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
      description: null,
      sku: "WEL-01",
      unit: "un",
      current_stock: 8,
      minimum_stock: 2,
      cost_price: 24.9,
      retail_price: 44.9,
      max_purchase_quantity: 6,
      image_paths: [],
      is_active: true,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "store_product_published",
      }),
    );
    expect(location).toBe(
      "/dashboard/operations?message=Shampoo+reconstrutor+adicionado+ao+estoque.&tone=success",
    );
  });

  it("updates an active inventory product and notifies customers", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "product-1",
        name: "Shampoo reconstrutor",
        brand: "Wella",
        image_paths: [],
        is_active: true,
      },
    });
    const update = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "inventory_products") {
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
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove: vi.fn(),
        })),
      },
    });

    const location = await captureRedirect(
      saveInventoryProductActionImpl(
        makeFormData({
          productId: "product-1",
          returnPath: "/dashboard/inventory",
          name: "Shampoo reconstrutor premium",
          brand: "Wella",
          unit: "un",
          currentStock: "12",
          minimumStock: "3",
          retailPrice: "59.90",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Shampoo reconstrutor premium",
        brand: "Wella",
        current_stock: 12,
        minimum_stock: 3,
        retail_price: 59.9,
        is_active: true,
      }),
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "store_product_updated",
      }),
    );
    expect(location).toBe(
      "/dashboard/inventory?message=Shampoo+reconstrutor+atualizado+com+sucesso.&tone=success",
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

  it("updates the store order status for the salon", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          order_id: "order-1",
          order_number: 204,
          status: "ready",
          updated_at: "2026-04-04T12:00:00.000Z",
        },
      ],
      error: null,
    });

    createClientMock.mockReturnValue({ rpc });

    const location = await captureRedirect(
      updateCustomerProductOrderStatusActionImpl(
        makeFormData({
          orderId: "order-1",
          status: "ready",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith("update_customer_product_order_status", {
      order_id_input: "order-1",
      status_input: "ready",
      cancellation_reason_input: null,
    });
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining(["/dashboard/operations", "/dashboard"]),
    );
    expect(location).toBe(
      "/dashboard/operations?message=Pedido+%23204+marcado+como+pronto.&tone=success",
    );
  });
});
