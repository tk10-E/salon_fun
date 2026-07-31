export const APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS = [
  { value: "pix", label: "Pix" },
  { value: "cash", label: "Dinheiro" },
  { value: "debit_card", label: "Cartão de débito" },
  { value: "credit_card", label: "Cartão de crédito" },
  { value: "to_be_defined", label: "Decidir no salão" },
] as const;

export type AppointmentPaymentPreference =
  (typeof APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS)[number]["value"];

export function formatAppointmentPaymentPreferenceLabel(
  value: AppointmentPaymentPreference,
) {
  return (
    APPOINTMENT_PAYMENT_PREFERENCE_OPTIONS.find((item) => item.value === value)
      ?.label ?? value
  );
}
