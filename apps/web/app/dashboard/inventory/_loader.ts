import { requireOwnerSalon } from "@/lib/auth";
import { getLocalDateKey, getUtcRangeForLocalMonth } from "@/lib/management";
import { createClient } from "@/lib/supabase/server";

import type { InventoryPageData } from "./_lib";

type InventoryProductRow = {
  id: string;
  name: string;
  brand: string | null;
  description: string | null;
  image_paths: string[];
  sku: string | null;
  unit: string;
  current_stock: number | string;
  minimum_stock: number | string;
  cost_price: number | string | null;
  retail_price: number | string | null;
  max_purchase_quantity: number;
  is_active: boolean;
  updated_at: string;
};

type InventoryMovementRow = {
  id: string;
  movement_type: "in" | "out" | "adjustment";
  quantity: number | string;
  previous_stock: number | string;
  resulting_stock: number | string;
  reason: string | null;
  created_at: string;
  inventory_products: { name: string } | { name: string }[] | null;
  staff_members: { name: string } | { name: string }[] | null;
};

type StoreOrderItemRow = {
  id: string;
  line_total_amount: number | string;
  product_brand_snapshot: string | null;
  product_id: string | null;
  product_image_path: string | null;
  product_name_snapshot: string;
  quantity: number;
  unit_price_snapshot: number | string;
  unit_snapshot: string;
};

type StoreOrderRow = {
  id: string;
  order_number: number;
  status: "pending" | "confirmed" | "ready" | "completed" | "cancelled";
  total_items: number;
  subtotal_amount: number | string;
  notes: string | null;
  cancellation_reason: string | null;
  created_at: string;
  confirmed_at: string | null;
  ready_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  customers:
    | { name: string; phone: string | null }
    | { name: string; phone: string | null }[]
    | null;
  customer_product_order_items: StoreOrderItemRow[] | null;
};

type StaffOptionRow = {
  id: string;
  is_active: boolean;
  name: string;
};

function firstRelation<T>(value: T | T[] | null) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildInventoryProductImageUrls(
  supabase: ReturnType<typeof createClient>,
  imagePaths: string[] | null | undefined,
) {
  if (!Array.isArray(imagePaths)) {
    return [];
  }

  return imagePaths
    .filter(
      (path): path is string => typeof path === "string" && path.trim().length > 0,
    )
    .map(
      (path) =>
        supabase.storage.from("inventory-products").getPublicUrl(path).data
          .publicUrl,
    );
}

function isVisibleInStorefront(product: {
  currentStock: number | string;
  isActive: boolean;
  retailPrice: number | string | null;
}) {
  return (
    product.isActive &&
    Number(product.currentStock ?? 0) > 0 &&
    Number(product.retailPrice ?? 0) > 0
  );
}

function mapStoreOrders(rows: StoreOrderRow[]) {
  return rows.map((order) => {
    const customer = firstRelation(order.customers);

    return {
      id: order.id,
      orderNumber: order.order_number,
      status: order.status,
      totalItems: order.total_items,
      subtotalAmount: order.subtotal_amount,
      notes: order.notes,
      cancellationReason: order.cancellation_reason,
      createdAt: order.created_at,
      confirmedAt: order.confirmed_at,
      readyAt: order.ready_at,
      completedAt: order.completed_at,
      cancelledAt: order.cancelled_at,
      orderMoment:
        order.cancelled_at ??
        order.completed_at ??
        order.ready_at ??
        order.confirmed_at ??
        order.created_at,
      customerName: customer?.name ?? "Cliente",
      customerPhone: customer?.phone?.trim() || null,
      items: (order.customer_product_order_items ?? []).map((item) => ({
        id: item.id,
        lineTotalAmount: item.line_total_amount,
        productBrandSnapshot: item.product_brand_snapshot,
        productId: item.product_id,
        productImagePath: item.product_image_path,
        productNameSnapshot: item.product_name_snapshot,
        quantity: item.quantity,
        unitPriceSnapshot: item.unit_price_snapshot,
        unitSnapshot: item.unit_snapshot,
      })),
    };
  });
}

export async function loadInventoryPageData(): Promise<InventoryPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const currentMonthKey = getLocalDateKey(new Date(), timeZone).slice(0, 7);
  const currentMonthRange = getUtcRangeForLocalMonth(currentMonthKey, timeZone);
  const currentMonthLabel = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    timeZone,
    year: "numeric",
  }).format(new Date(currentMonthRange.start));

  const [
    inventoryProductsResult,
    storeOrdersResult,
    analyticsStoreOrdersResult,
    inventoryMovementsResult,
    staffOptionsResult,
  ] = await Promise.all([
      supabase
        .from("inventory_products")
        .select(
          "id, name, brand, description, image_paths, sku, unit, current_stock, minimum_stock, cost_price, retail_price, max_purchase_quantity, is_active, updated_at",
        )
        .eq("salon_id", salon.id)
        .order("is_active", { ascending: false })
        .order("name"),
      supabase
        .from("customer_product_orders")
        .select(
          "id, order_number, status, total_items, subtotal_amount, notes, cancellation_reason, created_at, confirmed_at, ready_at, completed_at, cancelled_at, customers(name, phone), customer_product_order_items(id, product_name_snapshot, product_brand_snapshot, product_image_path, product_id, quantity, unit_price_snapshot, line_total_amount, unit_snapshot)",
        )
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .limit(12),
      supabase
        .from("customer_product_orders")
        .select(
          "id, order_number, status, total_items, subtotal_amount, notes, cancellation_reason, created_at, confirmed_at, ready_at, completed_at, cancelled_at, customers(name, phone), customer_product_order_items(id, product_name_snapshot, product_brand_snapshot, product_image_path, product_id, quantity, unit_price_snapshot, line_total_amount, unit_snapshot)",
        )
        .eq("salon_id", salon.id)
        .eq("status", "completed")
        .gte("completed_at", currentMonthRange.start.toISOString())
        .lt("completed_at", currentMonthRange.end.toISOString())
        .order("completed_at", { ascending: false })
        .limit(500),
      supabase
        .from("inventory_movements")
        .select(
          "id, movement_type, quantity, previous_stock, resulting_stock, reason, created_at, inventory_products(name), staff_members(name)",
        )
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("staff_members")
        .select("id, name, is_active")
        .eq("salon_id", salon.id)
        .order("name"),
    ]);

  const inventoryProducts = ((inventoryProductsResult.data ?? []) as InventoryProductRow[])
    .map((product) => ({
      id: product.id,
      name: product.name,
      brand: product.brand,
      description: product.description,
      imageUrls: buildInventoryProductImageUrls(supabase, product.image_paths),
      sku: product.sku,
      unit: product.unit,
      currentStock: product.current_stock,
      minimumStock: product.minimum_stock,
      costPrice: product.cost_price,
      retailPrice: product.retail_price,
      maxPurchaseQuantity: product.max_purchase_quantity,
      isActive: product.is_active,
      updatedAt: product.updated_at,
      isLowStock:
        Number(product.current_stock ?? 0) <= Number(product.minimum_stock ?? 0),
    }))
    .sort((left, right) => {
      if (left.isLowStock !== right.isLowStock) {
        return left.isLowStock ? -1 : 1;
      }

      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    });

  const storeOrders = mapStoreOrders((storeOrdersResult.data ?? []) as StoreOrderRow[]);
  const completedStoreOrders = mapStoreOrders(
    (analyticsStoreOrdersResult.data ?? []) as StoreOrderRow[],
  );

  const inventoryMovements = ((inventoryMovementsResult.data ?? []) as InventoryMovementRow[]).map(
    (movement) => ({
      id: movement.id,
      movementType: movement.movement_type,
      quantity: movement.quantity,
      previousStock: movement.previous_stock,
      resultingStock: movement.resulting_stock,
      reason: movement.reason,
      createdAt: movement.created_at,
      productName: firstRelation(movement.inventory_products)?.name ?? "Produto",
      staffName: firstRelation(movement.staff_members)?.name ?? null,
    }),
  );

  const staffOptions = ((staffOptionsResult.data ?? []) as StaffOptionRow[])
    .filter((staff) => staff.is_active)
    .map((staff) => ({
      id: staff.id,
      name: staff.name,
    }));

  const lowStockProducts = inventoryProducts.filter((product) => product.isLowStock);
  const openStoreOrders = storeOrders.filter(
    (order) => order.status !== "completed" && order.status !== "cancelled",
  ).length;
  const publishedStoreProducts = inventoryProducts.filter(
    isVisibleInStorefront,
  ).length;
  const hiddenStoreProductsCount = inventoryProducts.filter(
    (product) => product.isActive && !isVisibleInStorefront(product),
  ).length;
  const storeRevenue = completedStoreOrders
    .reduce((sum, order) => sum + Number(order.subtotalAmount ?? 0), 0);

  return {
    analytics: {
      completedStoreOrders,
      periodLabel: currentMonthLabel,
    },
    header: {
      hiddenStoreProductsCount,
      openStoreOrders,
      lowStockProductsCount: lowStockProducts.length,
      publishedStoreProducts,
      storeRevenue,
    },
    alerts: {
      lowStockProducts: lowStockProducts.map((product) => ({
        id: product.id,
        name: product.name,
        currentStock: product.currentStock,
        minimumStock: product.minimumStock,
        unit: product.unit,
      })),
    },
    orders: {
      storeOrders,
    },
    products: {
      inventoryProducts,
    },
    movements: {
      inventoryMovements,
    },
    staffOptions,
  };
}
