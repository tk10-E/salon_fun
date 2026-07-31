import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeImageFile,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  cancelAppointmentPlanReservationByAdminMock,
  createClientMock,
  finalizeAppointmentPlanReservationMock,
  neutralizeMembershipPlanAppointmentMock,
  resolveAppointmentPlanReservationMock,
  redirectMock,
  revalidatePathMock,
  requireOwnerSalonMock,
  sendSalonWhatsAppNotificationMessageMock,
} = vi.hoisted(() => ({
  cancelAppointmentPlanReservationByAdminMock: vi.fn(),
  createClientMock: vi.fn(),
  finalizeAppointmentPlanReservationMock: vi.fn(),
  neutralizeMembershipPlanAppointmentMock: vi.fn(),
  resolveAppointmentPlanReservationMock: vi.fn(),
  redirectMock: vi.fn(),
  revalidatePathMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  sendSalonWhatsAppNotificationMessageMock: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/appointmentPlanReservations", () => ({
  cancelAppointmentPlanReservationByAdmin:
    cancelAppointmentPlanReservationByAdminMock,
  finalizeAppointmentPlanReservation: finalizeAppointmentPlanReservationMock,
  neutralizeMembershipPlanAppointment: neutralizeMembershipPlanAppointmentMock,
  resolveAppointmentPlanReservation: resolveAppointmentPlanReservationMock,
}));

vi.mock("@/lib/whatsapp", () => ({
  sanitizePhone: (value: string | null | undefined) =>
    (value ?? "").replace(/\D+/g, "") || null,
  sendSalonWhatsAppNotificationMessage:
    sendSalonWhatsAppNotificationMessageMock,
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("next/cache", () => ({
  revalidatePath: revalidatePathMock,
}));

import {
  createManagementAppointmentAction,
  createManagementCategoryAction,
  createManagementProfessionalAction,
  createManagementServiceAction,
  deleteManagementServiceAction,
  deleteManagementProfessionalAction,
  updateManagementAppointmentAction,
  updateManagementAppointmentStatusAction,
  updateManagementProfessionalAction,
  updateManagementServiceAction,
  upsertManagementPaymentAction,
} from "@/app/_actions/management";

const categoryId = "11111111-1111-4111-8111-111111111111";
const serviceId = "22222222-2222-4222-8222-222222222222";
const professionalId = "33333333-3333-4333-8333-333333333333";
const customerId = "44444444-4444-4444-8444-444444444444";
const appointmentId = "55555555-5555-4555-8555-555555555555";

describe("management catalog notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cancelAppointmentPlanReservationByAdminMock.mockResolvedValue(null);
    finalizeAppointmentPlanReservationMock.mockResolvedValue(null);
    neutralizeMembershipPlanAppointmentMock.mockResolvedValue(undefined);
    resolveAppointmentPlanReservationMock.mockResolvedValue(null);
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

  it("returns inline success state when creating a category in async mode", async () => {
    const insertCategory = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "service_categories") {
          return { insert: insertCategory };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const result = await createManagementCategoryAction(
      makeFormData({
        __actionMode: "inline",
        name: "Cabelo",
        description: "Principal",
        isActive: "on",
      }),
    );

    expect(insertCategory).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        name: "Cabelo",
        is_active: true,
      }),
    );
    expect(result).toEqual({
      ok: true,
      message: "Categoria cadastrada com sucesso.",
      tone: "success",
    });
    expect(redirectMock).not.toHaveBeenCalled();
  });

  it("returns inline error state when the professional phone is invalid", async () => {
    const result = await updateManagementProfessionalAction(
      makeFormData({
        __actionMode: "inline",
        professionalId,
        name: "Marina",
        specialty: "Colorista",
        phone: "1234567",
        commissionRatePercent: "40",
        isActive: "on",
      }),
    );

    expect(result).toEqual({
      ok: false,
      message: "Telefone precisa ter entre 8 e 30 caracteres.",
      tone: "error",
    });
    expect(requireOwnerSalonMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
    expect(redirectMock).not.toHaveBeenCalled();
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

  it("keeps the success redirect intact when creating an appointment", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
    });

    const location = await captureRedirect(
      createManagementAppointmentAction(
        makeFormData({
          clientId: customerId,
          professionalId: professionalId,
          serviceId,
          date: "2099-04-12",
          time: "15:30",
          notes: "Cliente prefere janela.",
          returnPath: "/dashboard/gestao/agendamentos?day=2099-04-12",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith(
      "create_management_appointment",
      expect.objectContaining({
        customer_uuid: customerId,
        service_uuid: serviceId,
        staff_member_uuid: professionalId,
        notes_input: "Cliente prefere janela.",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/agendamentos?day=2099-04-12&message=Agendamento+criado+com+sucesso.&tone=success",
    );
  });

  it("keeps the success redirect intact when updating an open appointment", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const appointmentReads = [
      {
        id: appointmentId,
        customer_id: customerId,
        staff_member_id: professionalId,
        date: "2099-04-12T15:30:00.000Z",
        services: { name: "Corte masculino" },
        staff_members: { name: "Rafa" },
      },
      {
        id: appointmentId,
        customer_id: customerId,
        staff_member_id: professionalId,
        date: "2099-04-12T16:00:00.000Z",
        services: { name: "Corte masculino" },
        staff_members: { name: "Rafa" },
      },
    ];
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: appointmentReads.shift() ?? null,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentAction(
        makeFormData({
          appointmentId,
          clientId: customerId,
          professionalId,
          serviceId,
          date: "2099-04-12",
          time: "16:00",
          notes: "Cliente vai chegar um pouco antes.",
          returnPath: "/dashboard/gestao/agendamentos?day=2099-04-12",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith(
      "update_management_appointment",
      expect.objectContaining({
        appointment_uuid: appointmentId,
        customer_uuid: customerId,
        service_uuid: serviceId,
        staff_member_uuid: professionalId,
        notes_input: "Cliente vai chegar um pouco antes.",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/agendamentos?day=2099-04-12&message=Agendamento+atualizado+com+sucesso.&tone=success",
    );
  });

  it("keeps plan-backed appointments tied to the same customer and service", async () => {
    resolveAppointmentPlanReservationMock.mockResolvedValue({
      appointmentId,
      membershipExpiresAt: "2099-04-30",
      membershipId: "membership-1",
      membershipStartedAt: "2099-04-01",
      membershipTitle: "Plano brilho",
      reservationStatus: "scheduled",
      salonId: "salon-1",
      serviceId,
      sessionIndex: 1,
      sessionsIncluded: 4,
      source: "reservation",
      customerId,
    });

    createClientMock.mockReturnValue({
      rpc: vi.fn(),
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      customer_id: customerId,
                      service_id: serviceId,
                      staff_member_id: professionalId,
                      date: "2099-04-12T15:30:00.000Z",
                      services: { name: "Corte masculino" },
                      staff_members: { name: "Rafa" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentAction(
        makeFormData({
          appointmentId,
          clientId: "66666666-6666-4666-8666-666666666666",
          professionalId,
          serviceId,
          date: "2099-04-12",
          time: "16:00",
        }),
      ),
      redirectMock,
    );

    expect(location).toContain(
      "Atendimentos+cobertos+por+plano+precisam+manter+a+mesma+cliente+do+app",
    );
  });

  it("keeps plan-backed appointments tied to the reserved professional", async () => {
    resolveAppointmentPlanReservationMock.mockResolvedValue({
      appointmentId,
      membershipExpiresAt: "2099-04-30",
      membershipId: "membership-1",
      membershipStartedAt: "2099-04-01",
      membershipTitle: "Plano brilho",
      reservationStatus: "scheduled",
      salonId: "salon-1",
      serviceId,
      sessionIndex: 1,
      sessionsIncluded: 4,
      source: "reservation",
      customerId,
    });

    createClientMock.mockReturnValue({
      rpc: vi.fn(),
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      customer_id: customerId,
                      service_id: serviceId,
                      staff_member_id: professionalId,
                      date: "2099-04-12T15:30:00.000Z",
                      services: { name: "Corte masculino" },
                      staff_members: { name: "Rafa" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentAction(
        makeFormData({
          appointmentId,
          clientId: customerId,
          professionalId: "77777777-7777-4777-8777-777777777777",
          serviceId,
          date: "2099-04-12",
          time: "16:00",
        }),
      ),
      redirectMock,
    );

    expect(location).toContain(
      "Atendimentos+cobertos+por+plano+precisam+manter+o+profissional+reservado+para+o+plano",
    );
  });

  it("neutralizes payment fields again after rescheduling a plan-backed appointment", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    resolveAppointmentPlanReservationMock.mockResolvedValue({
      appointmentId,
      membershipExpiresAt: "2099-04-30",
      membershipId: "membership-1",
      membershipStartedAt: "2099-04-01",
      membershipTitle: "Plano brilho",
      reservationStatus: "scheduled",
      salonId: "salon-1",
      serviceId,
      sessionIndex: 1,
      sessionsIncluded: 4,
      source: "reservation",
      customerId,
    });
    const appointmentReads = [
      {
        id: appointmentId,
        customer_id: customerId,
        service_id: serviceId,
        staff_member_id: professionalId,
        date: "2099-04-12T15:30:00.000Z",
        services: { name: "Corte masculino" },
        staff_members: { name: "Rafa" },
      },
      {
        id: appointmentId,
        customer_id: customerId,
        service_id: serviceId,
        staff_member_id: professionalId,
        date: "2099-04-12T16:00:00.000Z",
        services: { name: "Corte masculino" },
        staff_members: { name: "Rafa" },
      },
    ];
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: appointmentReads.shift() ?? null,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    await captureRedirect(
      updateManagementAppointmentAction(
        makeFormData({
          appointmentId,
          clientId: customerId,
          professionalId,
          serviceId,
          date: "2099-04-12",
          time: "16:00",
          paymentPreference: "pix",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith(
      "update_management_appointment",
      expect.objectContaining({
        appointment_uuid: appointmentId,
        payment_preference_input: null,
      }),
    );
    expect(neutralizeMembershipPlanAppointmentMock).toHaveBeenCalledWith({
      appointmentId,
    });
  });

  it("notifies the customer when the salon reschedules an appointment", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const appointmentReads = [
      {
        id: appointmentId,
        customer_id: customerId,
        staff_member_id: professionalId,
        date: "2099-04-12T15:30:00.000Z",
        services: { name: "Corte masculino" },
        staff_members: { name: "Rafa" },
      },
      {
        id: appointmentId,
        customer_id: customerId,
        staff_member_id: professionalId,
        date: "2099-04-12T16:00:00.000Z",
        services: { name: "Corte premium" },
        staff_members: { name: "Lia" },
      },
    ];

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: appointmentReads.shift() ?? null,
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentAction(
        makeFormData({
          appointmentId,
          clientId: customerId,
          professionalId,
          serviceId,
          date: "2099-04-12",
          time: "16:00",
          notes: "Cliente vai chegar um pouco antes.",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/gestao/agendamentos?message=Agendamento+atualizado+com+sucesso.&tone=success",
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "single_customer",
        customer_id: customerId,
        notification_type: "appointment_rescheduled",
        salon_id: "salon-1",
      }),
    );
  });

  it("blocks completion from the panel while the appointment is still running", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      customer_id: customerId,
                      date: "2099-04-12T15:30:00.000Z",
                      ends_at: "2099-04-12T16:15:00.000Z",
                      status: "confirmed",
                      services: { name: "Corte masculino" },
                      staff_members: { name: "Rafa" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table === "appointment_payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentStatusAction(
        makeFormData({
          appointmentId,
          status: "completed",
          cancellationReason: "",
          returnPath: "/dashboard/gestao/agendamentos?day=2099-04-12",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/gestao/agendamentos?day=2099-04-12&message=Conclua+o+atendimento+apenas+depois+do+hor%C3%A1rio+final.&tone=error",
    );
    expect(location).not.toContain("NEXT_REDIRECT");
    expect(rpc).not.toHaveBeenCalled();
    expect(insertNotification).not.toHaveBeenCalled();
  });

  it("finalizes the reserved plan session when the panel concludes a finished plan-backed appointment", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    resolveAppointmentPlanReservationMock.mockResolvedValue({
      appointmentId,
      membershipExpiresAt: "2020-04-30",
      membershipId: "membership-1",
      membershipStartedAt: "2020-04-01",
      membershipTitle: "Plano brilho",
      reservationStatus: "scheduled",
      salonId: "salon-1",
      serviceId,
      sessionIndex: 1,
      sessionsIncluded: 4,
      source: "reservation",
      customerId,
    });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      customer_id: customerId,
                      date: "2020-04-12T15:30:00.000Z",
                      ends_at: "2020-04-12T16:15:00.000Z",
                      status: "confirmed",
                      services: { name: "Corte masculino" },
                      staff_members: { name: "Rafa" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table === "appointment_payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentStatusAction(
        makeFormData({
          appointmentId,
          status: "completed",
          returnPath: "/dashboard/gestao/agendamentos?day=2020-04-12",
        }),
      ),
      redirectMock,
    );

    expect(
      new URLSearchParams(location.split("?")[1]).get("message"),
    ).toBe("Atendimento concluído com sucesso.");
    expect(rpc).toHaveBeenCalledWith("mark_appointment_completed", {
      appointment_uuid: appointmentId,
    });
    expect(finalizeAppointmentPlanReservationMock).toHaveBeenCalledWith({
      appointmentId,
      ownerSupabase: expect.any(Object),
      salonId: "salon-1",
    });
    expect(insertNotification).toHaveBeenCalled();
  });

  it("confirms an appointment from the dashboard home even when cancellationReason is omitted", async () => {
    const rpc = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc,
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      customer_id: customerId,
                      date: "2099-04-12T09:00:00.000Z",
                      ends_at: "2099-04-12T09:45:00.000Z",
                      status: "pending",
                      services: { name: "Escova" },
                      staff_members: { name: "Lia" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }

        if (table === "appointment_payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        if (table === "salon_vacancy_alerts") {
          return {
            delete: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue(undefined),
              })),
            })),
          };
        }

        return {
          select: vi.fn(() => ({
            eq: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: null,
                  error: null,
                }),
              })),
            })),
          })),
        };
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentStatusAction(
        makeFormData({
          appointmentId,
          status: "confirmed",
          returnPath: "/dashboard",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard?message=Status+do+agendamento+atualizado+com+sucesso.&tone=success",
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "single_customer",
        customer_id: customerId,
        notification_type: "appointment_confirmed",
        salon_id: "salon-1",
      }),
    );
  });

  it("blocks reopening a cancelled appointment through status updates", async () => {
    createClientMock.mockReturnValue({
      rpc: vi.fn(),
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      date: "2099-04-12T15:30:00.000Z",
                      ends_at: "2099-04-12T16:15:00.000Z",
                      status: "cancelled",
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentStatusAction(
        makeFormData({
          appointmentId,
          status: "confirmed",
          cancellationReason: "",
          returnPath: "/dashboard/gestao/agendamentos?day=2099-04-12",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/gestao/agendamentos?day=2099-04-12&message=Esse+agendamento+j%C3%A1+foi+encerrado+e+n%C3%A3o+pode+voltar+para+a+agenda+por+essa+a%C3%A7%C3%A3o.&tone=error",
    );
  });

  it("notifies the customer when the salon marks an appointment as no-show", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc: vi.fn(),
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      customer_id: customerId,
                      date: "2020-04-12T09:00:00.000Z",
                      ends_at: "2020-04-12T09:45:00.000Z",
                      status: "confirmed",
                      services: { name: "Escova" },
                      staff_members: { name: "Lia" },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
            update: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ error: null }),
              })),
            })),
          };
        }

        if (table === "appointment_payments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                count: 0,
                error: null,
              }),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return { insert: insertNotification };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      updateManagementAppointmentStatusAction(
        makeFormData({
          appointmentId,
          status: "no_show",
          returnPath: "/dashboard/gestao/agendamentos?day=2099-04-12",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/gestao/agendamentos?day=2099-04-12&message=Status+do+agendamento+atualizado+com+sucesso.&tone=success",
    );
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        audience: "single_customer",
        customer_id: customerId,
        notification_type: "appointment_no_show",
        salon_id: "salon-1",
      }),
    );
  });

  it("blocks avulso payments for appointments already covered by a plan", async () => {
    resolveAppointmentPlanReservationMock.mockResolvedValue({
      appointmentId,
      membershipExpiresAt: "2099-04-30",
      membershipId: "membership-1",
      membershipStartedAt: "2099-04-01",
      membershipTitle: "Plano brilho",
      reservationStatus: "consumed",
      salonId: "salon-1",
      serviceId,
      sessionIndex: 1,
      sessionsIncluded: 4,
      source: "official",
      customerId,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: vi.fn().mockResolvedValue({
                    data: {
                      id: appointmentId,
                      status: "completed",
                      service_price_snapshot: 90,
                      services: {
                        id: serviceId,
                        name: "Escova premium",
                        price: 90,
                      },
                    },
                    error: null,
                  }),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      upsertManagementPaymentAction(
        makeFormData({
          appointmentId,
          amount: "90",
          paymentMethod: "pix",
          paidAtDate: "2099-04-12",
          paidAtTime: "16:15",
        }),
      ),
      redirectMock,
    );

    expect(location).toContain(
      "Atendimentos+cobertos+por+plano+n%C3%A3o+recebem+pagamento+avulso",
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

  it("uses the selected services when management creates a specialized professional", async () => {
    const insertStaff = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: { id: professionalId },
          error: null,
        }),
      })),
    }));
    const insertAssignments = vi.fn().mockResolvedValue({ error: null });
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return { insert: insertStaff };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: serviceId, name: "Trança" },
                  { id: "service-2", name: "Pigmentação" },
                ],
                error: null,
              }),
            })),
          };
        }

        if (table === "staff_service_assignments") {
          return { insert: insertAssignments };
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
          name: "Tania",
          specialty: "Trancista",
          phone: "",
          commissionRatePercent: "35",
          isActive: "on",
          serviceSelectionReady: "1",
          serviceIds: [serviceId],
        }),
      ),
      redirectMock,
    );

    expect(insertAssignments).toHaveBeenCalledWith([
      { staff_member_id: professionalId, service_id: serviceId },
    ]);
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+cadastrado+com+sucesso.&tone=success",
    );
  });

  it("stores a professional profile photo without changing the management flow", async () => {
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
    const upload = vi.fn().mockResolvedValue({ error: null });

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
      storage: {
        from: vi.fn(() => ({
          upload,
        })),
      },
    });

    const location = await captureRedirect(
      createManagementProfessionalAction(
        makeFormData({
          name: "Marina",
          specialty: "Colorista",
          phone: "",
          commissionRatePercent: "35",
          isActive: "on",
          image: makeImageFile("marina.png"),
        }),
      ),
      redirectMock,
    );

    expect(upload).toHaveBeenCalledWith(
      expect.stringMatching(/^salon-1\/staff\/.+\.jpg$/),
      expect.any(Uint8Array),
      expect.objectContaining({
        contentType: "image/jpeg",
        upsert: true,
      }),
    );
    expect(insertStaff).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        image_path: expect.stringMatching(/^salon-1\/staff\/.+\.jpg$/),
        name: "Marina",
      }),
    );
    expect(location).toBe(
      "/dashboard/gestao/profissionais?message=Profissional+cadastrado+com+sucesso.&tone=success",
    );
  });

  it("shows migration guidance when creating a professional with photo hits a missing image column", async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });
    const insertStaff = vi.fn(() => ({
      select: vi.fn(() => ({
        single: vi.fn().mockResolvedValue({
          data: null,
          error: {
            code: "PGRST204",
            message:
              "Could not find the 'image_path' column of 'staff_members' in the schema cache",
          },
        }),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return { insert: insertStaff };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove,
          upload,
        })),
      },
    });

    const location = await captureRedirect(
      createManagementProfessionalAction(
        makeFormData({
          name: "Marina",
          specialty: "Colorista",
          phone: "",
          commissionRatePercent: "35",
          isActive: "on",
          image: makeImageFile("marina.png"),
        }),
      ),
      redirectMock,
    );
    const params = new URLSearchParams(location.split("?")[1]);

    expect(upload).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^salon-1\/staff\/.+\.jpg$/),
    ]);
    expect(params.get("message")).toBe(
      "Atualize o banco com a migration da foto dos profissionais antes de enviar esse arquivo.",
    );
    expect(params.get("tone")).toBe("error");
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

  it("blocks removing a service when the professional still has future bookings in it", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: professionalId, is_active: true },
      error: null,
    });
    const updateStaff = vi.fn();

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
              eq: vi.fn().mockResolvedValue({
                data: [
                  { id: serviceId, name: "Trança" },
                  { id: "service-2", name: "Pigmentação" },
                ],
                error: null,
              }),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  in: vi.fn(() => ({
                    gte: vi.fn().mockResolvedValue({
                      data: [
                        {
                          id: appointmentId,
                          service_id: "service-2",
                          services: { name: "Pigmentação" },
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
          serviceSelectionReady: "1",
          serviceIds: [serviceId],
        }),
      ),
      redirectMock,
    );
    const params = new URLSearchParams(location.split("?")[1]);

    expect(params.get("message")).toBe(
      "Remaneje ou conclua os próximos horários de Pigmentação antes de tirar esses serviços da agenda desse profissional.",
    );
    expect(params.get("tone")).toBe("error");
    expect(updateStaff).not.toHaveBeenCalled();
  });

  it("shows a friendly message when updating a professional hits the phone constraint", async () => {
    const maybeSingle = vi.fn().mockResolvedValue({
      data: { id: professionalId, is_active: true },
      error: null,
    });
    const updateStaff = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          error: {
            code: "23514",
            message:
              'new row for relation "staff_members" violates check constraint "staff_members_phone_length_check"',
          },
        }),
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
            update: updateStaff,
          };
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
          phone: "12345678",
          commissionRatePercent: "40",
          isActive: "on",
        }),
      ),
      redirectMock,
    );
    const params = new URLSearchParams(location.split("?")[1]);

    expect(params.get("message")).toBe(
      "Telefone precisa ter entre 8 e 30 caracteres.",
    );
    expect(params.get("tone")).toBe("error");
  });

  it("falls back from the legacy professional photo select and shows migration guidance on update", async () => {
    const maybeSingleWithImagePath = vi.fn().mockResolvedValue({
      data: null,
      error: {
        code: "PGRST204",
        message:
          "Could not find the 'image_path' column of 'staff_members' in the schema cache",
      },
    });
    const maybeSingleWithoutImagePath = vi.fn().mockResolvedValue({
      data: { id: professionalId, is_active: true },
      error: null,
    });
    const selectStaff = vi.fn((columns: string) => {
      if (columns === "id, is_active, image_path") {
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleWithImagePath,
            })),
          })),
        };
      }

      if (columns === "id, is_active") {
        return {
          eq: vi.fn(() => ({
            eq: vi.fn(() => ({
              maybeSingle: maybeSingleWithoutImagePath,
            })),
          })),
        };
      }

      throw new Error(`Unexpected staff selection ${columns}`);
    });
    const updateStaff = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({
          error: {
            code: "PGRST204",
            message:
              "Could not find the 'image_path' column of 'staff_members' in the schema cache",
          },
        }),
      })),
    }));
    const upload = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: selectStaff,
            update: updateStaff,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          remove,
          upload,
        })),
      },
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
          image: makeImageFile("marina.png"),
        }),
      ),
      redirectMock,
    );
    const params = new URLSearchParams(location.split("?")[1]);

    expect(maybeSingleWithImagePath).toHaveBeenCalledTimes(1);
    expect(maybeSingleWithoutImagePath).toHaveBeenCalledTimes(1);
    expect(upload).toHaveBeenCalledTimes(1);
    expect(remove).toHaveBeenCalledWith([
      expect.stringMatching(/^salon-1\/staff\/.+\.jpg$/),
    ]);
    expect(params.get("message")).toBe(
      "Atualize o banco com a migration da foto dos profissionais antes de salvar essa imagem.",
    );
    expect(params.get("tone")).toBe("error");
  });

  it("validates professional phone length before trying to update the database", async () => {
    const location = await captureRedirect(
      updateManagementProfessionalAction(
        makeFormData({
          professionalId,
          name: "Marina",
          specialty: "Colorista",
          phone: "1234567",
          commissionRatePercent: "40",
          isActive: "on",
        }),
      ),
      redirectMock,
    );
    const params = new URLSearchParams(location.split("?")[1]);

    expect(params.get("message")).toBe(
      "Telefone precisa ter entre 8 e 30 caracteres.",
    );
    expect(params.get("tone")).toBe("error");
    expect(requireOwnerSalonMock).not.toHaveBeenCalled();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("keeps the success redirect intact when deleting a service", async () => {
    const deleteService = vi.fn(() => ({
      eq: vi.fn(() => ({
        eq: vi.fn().mockResolvedValue({ error: null }),
      })),
    }));

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
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

        if (table === "services") {
          return {
            delete: deleteService,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      deleteManagementServiceAction(
        makeFormData({
          serviceId,
        }),
      ),
      redirectMock,
    );

    expect(deleteService).toHaveBeenCalled();
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard",
        "/dashboard/gestao",
        "/dashboard/gestao/servicos",
      ]),
    );
    expect(location).toBe(
      "/dashboard/gestao/servicos?message=Servi%C3%A7o+removido+com+sucesso.&tone=success",
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
    sendSalonWhatsAppNotificationMessageMock.mockResolvedValue({
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
    expect(sendSalonWhatsAppNotificationMessageMock).not.toHaveBeenCalled();
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
    const insertNotifications = vi.fn().mockResolvedValue({ error: null });
    const rpc = vi.fn((fn: string) => {
      if (fn === "get_available_staff_slots_for_service") {
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
      }

      if (fn === "offboard_management_professional_with_transfers") {
        return Promise.resolve({
          data: {
            deleted_blocks_count: 1,
            transferred_count: 1,
          },
          error: null,
        });
      }

      throw new Error(`Unexpected rpc ${fn}`);
    });

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
                                customer_id:
                                  "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
                                service_id:
                                  "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
                                date: "2026-04-12T14:00:00.000Z",
                                ends_at: "2026-04-12T15:00:00.000Z",
                                notes: "Cliente prefere a tarde.",
                                status: "confirmed",
                                customers: {
                                  name: "Maria",
                                  phone: "(11) 99999-0000",
                                },
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
                          staff_member_id:
                            "22222222-2222-4222-8222-222222222222",
                          status: "completed",
                          date: "2026-04-08T13:00:00.000Z",
                        },
                        {
                          staff_member_id:
                            "22222222-2222-4222-8222-222222222222",
                          status: "completed",
                          date: "2026-04-07T13:00:00.000Z",
                        },
                        {
                          staff_member_id:
                            "33333333-3333-4333-8333-333333333333",
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
      rpc,
    });

    const location = await captureRedirect(
      deleteManagementProfessionalAction(
        makeFormData({
          professionalId: "11111111-1111-4111-8111-111111111111",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith(
      "offboard_management_professional_with_transfers",
      expect.objectContaining({
        target_staff_member_uuid: "11111111-1111-4111-8111-111111111111",
        transfer_plans: [
          expect.objectContaining({
            appointmentId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
            customerId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            nextStartAt: "2026-04-12T14:00:00.000Z",
            replacementStaffMemberId: "22222222-2222-4222-8222-222222222222",
            serviceId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
          }),
        ],
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
    expect(sendSalonWhatsAppNotificationMessageMock).not.toHaveBeenCalled();
    expect(location).toContain(
      "Ricardo+saiu+da+equipe+ativa+e+foi+movido+para+o+hist%C3%B3rico.+1+cliente%28s%29+foram+remanejados",
    );
  });
});
