type PaymentIntegrityInput = {
  servicePrice?: number | string | null;
  servicePriceSnapshot?: number | string | null;
  submittedAmount: number;
};

export function resolveAuthoritativeAppointmentPayment(input: PaymentIntegrityInput) {
  const expectedAmount = Number(
    input.servicePriceSnapshot ?? input.servicePrice ?? 0,
  );

  if (!Number.isFinite(expectedAmount) || expectedAmount <= 0) {
    return {
      expectedAmount: 0,
      hasMismatch: false,
      isValid: false,
    };
  }

  const normalizedExpectedAmount = Number(expectedAmount.toFixed(2));

  return {
    expectedAmount: normalizedExpectedAmount,
    hasMismatch:
      Math.abs(input.submittedAmount - normalizedExpectedAmount) > 0.009,
    isValid: true,
  };
}
