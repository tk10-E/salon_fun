type NumericValue = number | string;

export type InventoryStoreOrderStatus =
  | "pending"
  | "confirmed"
  | "ready"
  | "completed"
  | "cancelled";

export type InventoryProduct = {
  brand: string | null;
  costPrice: NumericValue | null;
  currentStock: NumericValue;
  description: string | null;
  id: string;
  imageUrls: string[];
  isActive: boolean;
  isLowStock: boolean;
  maxPurchaseQuantity: number;
  minimumStock: NumericValue;
  name: string;
  retailPrice: NumericValue | null;
  sku: string | null;
  unit: string;
  updatedAt: string;
};

export type InventoryStoreOrder = {
  cancellationReason: string | null;
  completedAt: string | null;
  confirmedAt: string | null;
  createdAt: string;
  customerName: string;
  customerPhone: string | null;
  id: string;
  items: Array<{
    lineTotalAmount: NumericValue;
    productBrandSnapshot: string | null;
    productId: string | null;
    productImagePath: string | null;
    id: string;
    productNameSnapshot: string;
    quantity: number;
    unitPriceSnapshot: NumericValue;
    unitSnapshot: string;
  }>;
  notes: string | null;
  orderMoment: string;
  orderNumber: number;
  readyAt: string | null;
  status: InventoryStoreOrderStatus;
  subtotalAmount: NumericValue;
  totalItems: number;
};

export type InventoryMovement = {
  createdAt: string;
  id: string;
  movementType: "in" | "out" | "adjustment";
  previousStock: NumericValue;
  productName: string;
  quantity: NumericValue;
  reason: string | null;
  resultingStock: NumericValue;
  staffName: string | null;
};

export type InventoryPageData = {
  analytics: {
    completedStoreOrders: InventoryStoreOrder[];
    periodLabel: string;
  };
  alerts: {
    lowStockProducts: Array<{
      currentStock: NumericValue;
      id: string;
      minimumStock: NumericValue;
      name: string;
      unit: string;
    }>;
  };
  header: {
    hiddenStoreProductsCount: number;
    lowStockProductsCount: number;
    openStoreOrders: number;
    publishedStoreProducts: number;
    storeRevenue: number;
  };
  movements: {
    inventoryMovements: InventoryMovement[];
  };
  orders: {
    storeOrders: InventoryStoreOrder[];
  };
  products: {
    inventoryProducts: InventoryProduct[];
  };
  staffOptions: Array<{
    id: string;
    name: string;
  }>;
};

export { loadInventoryPageData } from "./_loader";
