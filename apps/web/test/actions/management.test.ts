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
  sendSalonWhatsAppTextMessageMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  sendSalonWhatsAppTextMessageMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/whatsapp", () => ({
  sanitizePhone: (value: string | null | undefined) =>
    (value ?? "").replace(/\D+/g, "") || null,
  sendSalonWhatsAppTextMessage: sendSalonWhatsAppTextMessageMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createManagementProfessionalAction,
  createManagementServiceAction,
  deleteManagementProfessionalAction,
  updateManagementProfessionalAction,
  updateManagementServiceAction,
} from "@/app/_actions/management";

const categoryId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const professionalId = "33333333-3333-4333-8333-333333333333";

describe("management catalog notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Salon Fun",
        timezone: "America/Sao_Paulo",
      },
    });
  });

  it("notifies customers when management creates an active service", async () => {
    const insertService = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 2 }),
            })),
            insert: insertService,
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: { from: vi.fn() },
    });

    const location = await captureRedirect(
      createManagementServiceAction(
        makeFormData({
          name: "Escova premium",
          serviceCategoryId: categoryId,
          duration: "45",
          price: "120",
          description: "Finalização com brilho",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(insertService).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        name: "Escova premium",
        is_active: true,
      }),
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "service_published",
        title: "Novo serviço disponível no app",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/servicos?message=Servi%C3%A7o+cadastrado+com+sucesso.&tone=success",
    );
  });

  it("notifies customers when management updates an active service", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: serviceId, image_path: null, is_active: true },
      error: null,
    });
    const updateService = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
            update: updateService,
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: { from: vi.fn() },
    });

    const location = await captureRedirect(
      updateManagementServiceAction(
        makeFormData({
          serviceId,
          name: "Escova premium plus",
          serviceCategoryId: categoryId,
          duration: "50",
          price: "140",
          description: "Finalização com tratamento",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(updateService).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Escova premium plus",
        is_active: true,
      }),
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "service_updated",
        title: "Serviço atualizado no app",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/servicos?message=Servi%C3%A7o+atualizado+com+sucesso.&tone=success",
    );
  });

  it("notifies customers when management creates an active professional", async () => {
    const insertStaff = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: professionalId },
          error: null,
        }),
      })),
    }));
    const upsertAssignments = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return { insert: insertStaff };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: serviceId }],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "staff_service_assignments") {
          return { upsert: upsertAssignments };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      createManagementProfessionalAction(
        makeFormData({
          name: "Marina",
          specialty: "Colorista",
          phone: "",
          commissionRatePercent: "35",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(insertStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        name: "Marina",
        role: "Colorista",
        is_active: true,
      }),
    );
    expect(upsertAssignments).toHaveBeenCalledWith(
      [{ staff_member_id: professionalId, service_id: serviceId }],
      { onConflict: "staff_member_id,service_id" },
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "staff_published",
        title: "Novo profissional no salão",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+cadastrado+com+sucesso.&tone=success",
    );
  });

  it("notifies customers when management reactivates a professional", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: professionalId, is_active: false },
      error: null,
    });
    const updateStaff = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const upsertAssignments = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
            update: updateStaff,
          };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  data: [{ id: serviceId }],
                  error: null,
                }),
              })),
            })),
          };
        }

        if (table === "staff_service_assignments") {
          return { upsert: upsertAssignments };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementProfessionalAction(
        makeFormData({
          professionalId,
          name: "Marina",
          specialty: "Colorista",
          phone: "",
          commissionRatePercent: "40",
          isActive: "on",
        }),
      ),
      redirectMock,
    );

    expect(updateStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Marina",
        role: "Colorista",
        is_active: true,
      }),
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        notification_type: "staff_reactivated",
        title: "Equipe atualizada no salão",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+atualizado+com+sucesso.&tone=success",
    );
  });
});

describe("management professional offboarding", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Salon Fun",
        timezone: "America/Sao_Paulo",
      },
    });
    sendSalonWhatsAppTextMessageMock.mockResolvedValue({
      ok: true,
      id: "wamid-1",
    });
  });

  it("hard deletes a professional with no linked appointments", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Camila",
        is_default: false,
      },
      error: null,
    });
    const deleteProfessional = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle,
                })),
              })),
            })),
            delete: deleteProfessional,
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({
                  count: 0,
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn(),
    });

    const location = await captureRedirect(
      deleteManagementProfessionalAction(
        makeFormData({
          professionalId: "11111111-1111-4111-8111-111111111111",
        }),
      ),
      redirectMock,
    );

    expect(deleteProfessional).toHaveBeenCalled();
    expect(sendSalonWhatsAppTextMessageMock).not.toHaveBeenCalled();
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/dashboard/gestao",
        "/dashboard/gestao/profissionais",
      ]),
    );
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+removido+com+sucesso.&tone=success",
    );
  });

  it("offboards a professional with future appointments, reassigns the slot and asks the customer to confirm", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "11111111-1111-4111-8111-111111111111",
        name: "Ricardo",
        is_default: false,
      },
      error: null,
    });
    const updateProfessional = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const deleteBlocks = vi.fn(() => ({
      eq: vi.fn(() => ({
        gte: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const updateAppointment = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));
    const insertNotifications = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn((columns: string) => {
              if (columns.includes("is_default")) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      maybeSingle,
                    })),
                  })),
                };
              }

              if (columns.includes("is_active")) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: "22222222-2222-4222-8222-222222222222",
                          name: "Camila",
                          is_active: true,
                        },
                        {
                          id: "33333333-3333-4333-8333-333333333333",
                          name: "Luna",
                          is_active: true,
                        },
                      ],
                      error: null,
                    }),
                  })),
                };
              }

              throw new Error(`Unexpected select on staff_members: ${columns}`);
            }),
            update: updateProfessional,
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string, options?: { head?: boolean }) => {
              if (options?.head) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn().mockResolvedValue({
                      count: 3,
                      error: null,
                    }),
                  })),
                };
              }

              if (columns.includes("customers(")) {
                return {
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      gt: vi.fn(() => ({
                        in: vi.fn(() => ({
                          order: vi.fn().mockResolvedValue({
                            data: [
                              {
                                id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
                                customer_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                                service_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                                date: "2026-04-12T14:00:00.000Z",
                                ends_at: "2026-04-12T15:00:00.000Z",
                                notes: "Cliente prefere a tarde.",
                                status: "confirmed",
                                customers: { name: "Maria", phone: "(11) 99999-0000" },
                                services: { name: "Corte", duration: 60 },
                              },
                            ],
                            error: null,
                          }),
                        })),
                      })),
                    })),
                  })),
                };
              }

              return {
                eq: vi.fn(() => ({
                  gte: vi.fn(() => ({
                    in: vi.fn().mockResolvedValue({
                      data: [
                        {
                          staff_member_id: "22222222-2222-4222-8222-222222222222",
                          status: "completed",
                          date: "2026-04-08T13:00:00.000Z",
                        },
                        {
                          staff_member_id: "22222222-2222-4222-8222-222222222222",
                          status: "completed",
                          date: "2026-04-07T13:00:00.000Z",
                        },
                        {
                          staff_member_id: "33333333-3333-4333-8333-333333333333",
                          status: "completed",
                          date: "2026-04-06T13:00:00.000Z",
                        },
                      ],
                      error: null,
                    }),
                  })),
                })),
              };
            }),
            update: updateAppointment,
          };
        }

        if (table === "staff_service_assignments") {
          return {
            select: vi.fn(() => ({
              in: vi.fn().mockResolvedValue({
                data: [
                  {
                    staff_member_id: "22222222-2222-4222-8222-222222222222",
                    service_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  },
                  {
                    staff_member_id: "33333333-3333-4333-8333-333333333333",
                    service_id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                  },
                ],
                error: null,
              }),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotifications,
          };
        }

        if (table === "staff_blocks") {
          return {
            delete: deleteBlocks,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc: vi.fn((fn: string) => {
        if (fn !== "get_available_staff_slots_for_service") {
          throw new Error(`Unexpected rpc ${fn}`);
        }

        return Promise.resolve({
          data: [
            {
              start_at: "2026-04-12T14:00:00.000Z",
              ends_at: "2026-04-12T15:00:00.000Z",
              staff_member_id: "22222222-2222-4222-8222-222222222222",
              staff_member_name: "Camila",
            },
          ],
          error: null,
        });
      }),
    });

    const location = await captureRedirect(
      deleteManagementProfessionalAction(
        makeFormData({
          professionalId: "11111111-1111-4111-8111-111111111111",
        }),
      ),
      redirectMock,
    );

    expect(updateAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        staff_member_id: "22222222-2222-4222-8222-222222222222",
        date: "2026-04-12T14:00:00.000Z",
        ends_at: "2026-04-12T15:00:00.000Z",
        status: "pending",
      }),
    );
    expect(insertNotifications).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          salon_id: "salon-1",
          customer_id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
          notification_type: "appointment_staff_reassigned",
        }),
      ]),
    );
    expect(sendSalonWhatsAppTextMessageMock).toHaveBeenCalledWith(
      "salon-1",
      "11999990000",
      expect.stringContaining("Camila"),
    );
    expect(updateProfessional).toHaveBeenCalledWith({ is_active: false });
    expect(location).toContain(
      "Ricardo+saiu+da+equipe+ativa+e+foi+movido+para+o+hist%C3%B3rico.+1+cliente%28s%29+foram+remanejados",
    );
  });
});
