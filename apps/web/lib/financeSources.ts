export const NATIVE_FINANCE_SOURCES = [
  "appointment",
  "store_order",
  "customer_tab",
] as const;

export type NativeFinanceSource = (typeof NATIVE_FINANCE_SOURCES)[number];

export function isNativeFinanceSource(
  value: string | null | undefined,
): value is NativeFinanceSource {
  return NATIVE_FINANCE_SOURCES.includes(value as NativeFinanceSource);
}
