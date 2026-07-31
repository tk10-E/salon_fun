import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
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

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import { closeCashSessionActionImpl } from "@/app/_actions/finance";

describe("finance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        timezone: "America/Sao_Paulo",
      },
      user: {
        id: "user-1",
      },
    });
  });

  it("closes the cash session without double counting native store revenue", async () => {
    const sessionMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "cash-1",
        opening_amount: 100,
        session_date: "2026-04-08",
        status: "open",
      },
      error: null,
    });
    const updateSessionEqSalon = vi.fn().mockResolvedValue({ error: null });
    const updateSessionEqId = vi.fn(() => ({
      eq: updateSessionEqSalon,
    }));
    const updateSession = vi.fn(() => ({
      eq: updateSessionEqId,
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_cash_sessions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: sessionMaybeSingle,
                })),
              })),
            })),
            update: updateSession,
          };
        }

        if (table === "appointment_payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn().mockResolvedValue({
                    data: [
                      {
                        amount: 50,
                        paid_at: "2026-04-08T13:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "customer_product_orders") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  not: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      lt: vi.fn().mockResolvedValue({
                        data: [
                          {
                            completed_at: "2026-04-08T14:00:00.000Z",
                            subtotal_amount: 40,
                          },
                        ],
                        error: null,
                      }),
                    })),
                  })),
                })),
              })),
            })),
          };
        }

        if (table === "customer_tab_payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn(() => ({
                  lt: vi.fn().mockResolvedValue({
                    data: [
                      {
                        amount: 10,
                        created_at: "2026-04-08T16:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_financial_transactions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [
                    {
                      amount: 40,
                      entry_type: "income",
                      occurred_on: "2026-04-08",
                      source: "store_order",
                    },
                    {
                      amount: 30,
                      entry_type: "income",
                      occurred_on: "2026-04-08",
                      source: "manual",
                    },
                    {
                      amount: 20,
                      entry_type: "expense",
                      occurred_on: "2026-04-08",
                      source: "manual",
                    },
                  ],
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      closeCashSessionActionImpl(
        makeFormData({
          sessionId: "cash-1",
          reportedAmount: "210",
        }),
      ),
      redirectMock,
    );

    expect(updateSession).toHaveBeenCalledWith(
      expect.objectContaining({
        closed_at: expect.any(String),
        closed_by: "user-1",
        closing_difference_amount: 0,
        closing_expected_amount: 210,
        closing_reported_amount: 210,
        status: "closed",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard/finance",
        "/dashboard",
        "/dashboard/gestao/comissoes",
        "/dashboard/operations",
      ]),
    );
    expect(location).toBe(
      "/dashboard/finance?message=Caixa+fechado+sem+diferen%C3%A7a.&tone=success",
    );
  });
});
