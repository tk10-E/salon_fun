export function toFinancialNumber(value: number | string | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function resolveBookedAppointmentAmount(args: {
  servicePrice?: number | string | null;
  servicePriceSnapshot?: number | string | null;
}) {
  if (args.servicePriceSnapshot != null && `${args.servicePriceSnapshot}`.trim() !== "") {
    return toFinancialNumber(args.servicePriceSnapshot);
  }

  return toFinancialNumber(args.servicePrice);
}

export function calculateProjectedCommissionAmount(args: {
  amount: number | string | null | undefined;
  commissionFlatFee?: number | string | null;
  commissionRatePercent?: number | string | null;
}) {
  const amount = toFinancialNumber(args.amount);
  const commissionRatePercent = toFinancialNumber(args.commissionRatePercent);
  const commissionFlatFee = toFinancialNumber(args.commissionFlatFee);

  return Number(
    (amount * (commissionRatePercent / 100) + commissionFlatFee).toFixed(2),
  );
}
