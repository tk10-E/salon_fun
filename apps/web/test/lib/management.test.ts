import { beforeEach, describe, expect, it, vi } from "vitest";

const { createClientMock } = vi.hoisted(() => ({
  createClientMock: vi.fn(),
}));
const { listResolvedAppointmentReviewsMock } = vi.hoisted(() => ({
  listResolvedAppointmentReviewsMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/appointmentReviews", () => ({
  listResolvedAppointmentReviews: listResolvedAppointmentReviewsMock,
}));

import {
  loadManagementProfessionals,
  resolveManagementAgendaDisplayDay,
  resolveManagementAppointmentCustomerName,
} from "@/lib/management";

describe("management helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    listResolvedAppointmentReviewsMock.mockResolvedValue([]);
  });

  it("falls back to the customer contact when the name is missing", () => {
    expect(
      resolveManagementAppointmentCustomerName({
        name: "   ",
        phone: "(16) 99999-8888",
        email: "cliente@example.com",
      }),
    ).toBe("(16) 99999-8888");

    expect(
      resolveManagementAppointmentCustomerName({
        name: null,
        phone: "   ",
        email: "cliente@example.com",
      }),
    ).toBe("cliente@example.com");

    expect(
      resolveManagementAppointmentCustomerName({
        name: null,
        phone: null,
        email: null,
      }),
    ).toBe("Cliente app");
  });

  it("chooses the nearest day with appointments for the monthly agenda detail", () => {
    expect(
      resolveManagementAgendaDisplayDay({
        requestedDay: "2026-05-10",
        appointments: [
          { date: "2026-05-05T14:30:00.000Z" },
          { date: "2026-05-05T16:00:00.000Z" },
        ],
        timeZone: "America/Sao_Paulo",
      }),
    ).toBe("2026-05-05");

    expect(
      resolveManagementAgendaDisplayDay({
        requestedDay: "2026-05-10",
        appointments: [
          { date: "2026-05-12T14:30:00.000Z" },
          { date: "2026-05-18T16:00:00.000Z" },
        ],
        timeZone: "America/Sao_Paulo",
      }),
    ).toBe("2026-05-12");

    expect(
      resolveManagementAgendaDisplayDay({
        requestedDay: "2026-05-10",
        appointments: [],
        timeZone: "America/Sao_Paulo",
      }),
    ).toBe("2026-05-10");
  });

  it("uses the stable public bucket url for professional avatars", async () => {
    const getPublicUrl = vi.fn(() => ({
      data: {
        publicUrl:
          "https://cdn.example.com/storage/v1/object/public/salon-assets/salon-1/staff/camila.jpg",
      },
    }));
    let appointmentsQueryCount = 0;

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: vi.fn(() => ({
                  order: vi.fn().mockResolvedValue({
                    data: [
                      {
                        id: "professional-1",
                        name: "Camila",
                        role: "Trancista",
                        phone: "11999999999",
                        image_path: "salon-1/staff/camila.jpg",
                        is_active: true,
                        commission_rate_percent: 35,
                        commission_flat_fee: 0,
                        created_at: "2026-01-01T10:00:00.000Z",
                        updated_at: "2026-04-08T10:00:00.000Z",
                      },
                    ],
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "staff_service_assignments") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [],
                error: null,
              }),
            })),
          };
        }

        if (table === "appointments") {
          appointmentsQueryCount += 1;

          if (appointmentsQueryCount === 1) {
            return {
              select: vi.fn(() => ({
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    in: vi.fn(() => ({
                      order: vi.fn(() => ({
                        range: vi.fn().mockResolvedValue({
                          data: [],
                          error: null,
                        }),
                      })),
                    })),
                  })),
                })),
              })),
            };
          }

          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  not: vi.fn(() => ({
                    gte: vi.fn(() => ({
                      lt: vi.fn(() => ({
                        order: vi.fn(() => ({
                          range: vi.fn().mockResolvedValue({
                            data: [],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  })),
                })),
              })),
            })),
          };
        }
        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl,
        })),
      },
    });

    const result = await loadManagementProfessionals({
      salonId: "salon-1",
      timeZone: "America/Sao_Paulo",
    });

    expect(result).toHaveLength(1);
    expect(result[0]?.imageUrl).toBe(
      "https://cdn.example.com/storage/v1/object/public/salon-assets/salon-1/staff/camila.jpg",
    );
    expect(getPublicUrl).toHaveBeenCalledTimes(1);
    expect(getPublicUrl.mock.calls[0]).toEqual(["salon-1/staff/camila.jpg"]);
  });
});
