import { describe, expect, it } from "vitest";

import {
  calculateProjectedCommissionAmount,
  resolveBookedAppointmentAmount,
} from "@/lib/financialMetrics";

describe("financial metrics", () => {
  it("prefers the appointment snapshot over the current service price", () => {
    expect(
      resolveBookedAppointmentAmount({
        servicePrice: 180,
        servicePriceSnapshot: 150,
      }),
    ).toBe(150);
  });

  it("falls back to the current service price when no snapshot exists", () => {
    expect(
      resolveBookedAppointmentAmount({
        servicePrice: 180,
        servicePriceSnapshot: null,
      }),
    ).toBe(180);
  });

  it("calculates projected commission with percentage and fixed fee", () => {
    expect(
      calculateProjectedCommissionAmount({
        amount: 200,
        commissionFlatFee: 15,
        commissionRatePercent: 35,
      }),
    ).toBe(85);
  });
});
