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
      "/dashboard/inventory?message=Shampoo+reconstrutor+adicionado+ao+estoque.&tone=success",
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

  it("keeps the inventory section anchor when a product update returns to the catalog", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "product-1",
        name: "Pomada modeladora",
        brand: "Salon Fun",
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
          returnPath: "/dashboard/inventory?status=low#inventory-products",
          name: "Pomada modeladora premium",
          brand: "Salon Fun",
          sku: "SAL-01",
          unit: "un",
          currentStock: "9",
          minimumStock: "3",
          retailPrice: "55.00",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/inventory?status=low&message=Pomada+modeladora+atualizado+com+sucesso.&tone=success#inventory-products",
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
      "/dashboard/inventory?message=O+estoque+de+Shampoo+reconstrutor+n%C3%A3o+cobre+essa+sa%C3%ADda.&tone=error",
    );
  });

  it("preserves movement filters when an inventory adjustment fails", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: "product-1", name: "Pomada modeladora" },
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
          quantity: "20",
          returnPath: "/dashboard/inventory?status=low#inventory-movements",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/inventory?status=low&message=O+estoque+de+Pomada+modeladora+n%C3%A3o+cobre+essa+sa%C3%ADda.&tone=error#inventory-movements",
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
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-1",
        customer_id: "customer-1",
        order_number: 204,
        total_items: 1,
        cancellation_reason: null,
        customer_product_order_items: [
          { product_name_snapshot: "Pomada modeladora" },
        ],
      },
      error: null,
    });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

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
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "single_customer",
        customer_id: "customer-1",
        notification_type: "store_order_ready",
        salon_id: "salon-1",
      }),
    );
    expect(location).toBe(
      "/dashboard/operations?message=Pedido+%23204+marcado+como+pronto.&tone=success",
    );
  });

  it("preserves the operations queue filter and section when store order status changes", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          order_id: "order-7",
          order_number: 707,
          status: "confirmed",
          updated_at: "2026-04-04T12:00:00.000Z",
        },
      ],
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-7",
        customer_id: "customer-7",
        order_number: 707,
        total_items: 1,
        cancellation_reason: null,
        customer_product_order_items: [
          { product_name_snapshot: "Kit tratamento" },
        ],
      },
      error: null,
    });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateCustomerProductOrderStatusActionImpl(
        makeFormData({
          orderId: "order-7",
          status: "confirmed",
          returnPath: "/dashboard/operations?orderState=pending#store-orders",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/operations?orderState=pending&message=Pedido+%23707+confirmado+com+sucesso.&tone=success#store-orders",
    );
  });

  it("preserves the inventory orders section when updating a store order from the loja screen", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          order_id: "order-9",
          order_number: 901,
          status: "ready",
          updated_at: "2026-04-04T12:00:00.000Z",
        },
      ],
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-9",
        customer_id: "customer-9",
        order_number: 901,
        total_items: 1,
        cancellation_reason: null,
        customer_product_order_items: [
          { product_name_snapshot: "Condicionador hidratante" },
        ],
      },
      error: null,
    });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateCustomerProductOrderStatusActionImpl(
        makeFormData({
          orderId: "order-9",
          status: "ready",
          returnPath: "/dashboard/inventory#inventory-orders",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/inventory?message=Pedido+%23901+marcado+como+pronto.&tone=success#inventory-orders",
    );
  });

  it("confirms a store order from the dashboard home without requiring a cancellation reason", async () => {
    const rpc = vi.fn().mockResolvedValue({
      data: [
        {
          order_id: "order-2",
          order_number: 305,
          status: "confirmed",
          updated_at: "2026-04-04T12:00:00.000Z",
        },
      ],
      error: null,
    });
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "order-2",
        customer_id: "customer-2",
        order_number: 305,
        total_items: 2,
        cancellation_reason: null,
        customer_product_order_items: [
          { product_name_snapshot: "Shampoo reconstrutor" },
        ],
      },
      error: null,
    });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateCustomerProductOrderStatusActionImpl(
        makeFormData({
          orderId: "order-2",
          status: "confirmed",
          returnPath: "/dashboard",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith("update_customer_product_order_status", {
      order_id_input: "order-2",
      status_input: "confirmed",
      cancellation_reason_input: null,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "single_customer",
        customer_id: "customer-2",
        notification_type: "store_order_confirmed",
        salon_id: "salon-1",
      }),
    );
    expect(location).toBe(
      "/dashboard?message=Pedido+%23305+confirmado+com+sucesso.&tone=success",
    );
  });

});
