import { describe, expect, it } from "vitest";

import { resolveAuthoritativeAppointmentPayment } from "@/lib/paymentIntegrity";

describe("payment integrity", () => {
  it("prefers the server-side appointment snapshot over the submitted amount", () => {
    expect(
      resolveAuthoritativeAppointmentPayment({
        servicePrice: 150,
        servicePriceSnapshot: 119.9,
        submittedAmount: 10,
      }),
    ).toEqual({
      expectedAmount: 119.9,
      hasMismatch: true,
      isValid: true,
    });
  });

  it("rejects invalid or missing authoritative values", () => {
    expect(
      resolveAuthoritativeAppointmentPayment({
        servicePrice: null,
        servicePriceSnapshot: null,
        submittedAmount: 10,
      }),
    ).toEqual({
      expectedAmount: 0,
      hasMismatch: false,
      isValid: false,
    });
  });
});
