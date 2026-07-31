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

import {
  approveCustomerMembershipRequestActionImpl,
  markCustomerMembershipRequestPaidActionImpl,
  saveOwnerCustomerProfileActionImpl,
  sendCustomerNudgeActionImpl,
} from "@/app/_actions/customers";

describe("customer CRM actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1" },
    });
  });

  it("updates the owner-facing CRM profile for a customer", async () => {
    const rpcMock = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      rpc: rpcMock,
    });

    const location = await captureRedirect(
      saveOwnerCustomerProfileActionImpl(
        makeFormData({
          customerId: "customer-1",
          returnPath: "/dashboard/customers?segment=vip",
          phone: "(11) 99888-7766",
          crmLabel: "Alta recorrência",
          preferences: "Prefere sexta no fim do dia",
          beautyProducts: "Máscara nutritiva",
          allergies: "Sem formol",
          beautyGoals: "Manter brilho, reduzir frizz e preservar comprimento.",
          contraindications: "Evitar calor excessivo após química.",
          technicalNotes:
            "Tonalização fria + reconstrução leve a cada 30 dias.",
          consentStatus: "signed",
          birthDate: "1990-04-14",
          lastAssessmentAt: "2026-03-20",
          internalNotes: "Chega cedo e responde bem a combo de retorno.",
        }),
      ),
      redirectMock,
    );

    expect(rpcMock).toHaveBeenCalledWith("update_owner_customer_profile", {
      customer_uuid: "customer-1",
      phone_input: "11998887766",
      preferences_input: "Prefere sexta no fim do dia",
      allergies_input: "Sem formol",
      beauty_products_input: "Máscara nutritiva",
      crm_label_input: "Alta recorrência",
      beauty_goals_input:
        "Manter brilho, reduzir frizz e preservar comprimento.",
      contraindications_input: "Evitar calor excessivo após química.",
      technical_notes_input:
        "Tonalização fria + reconstrução leve a cada 30 dias.",
      consent_status_input: "signed",
      birth_date_input: "1990-04-14",
      last_assessment_at_input: "2026-03-20",
      internal_notes_input: "Chega cedo e responde bem a combo de retorno.",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith(
      "/dashboard/gestao/clientes",
    );
    expect(location).toBe(
      "/dashboard/gestao/clientes?segment=vip&message=CRM+do+cliente+atualizado+com+sucesso.&tone=success",
    );
  });

  it("queues a loyalty reminder when the customer has cashback", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    const location = await captureRedirect(
      sendCustomerNudgeActionImpl(
        makeFormData({
          customerId: "customer-1",
          customerName: "Maria",
          cashbackBalance: "28.5",
          tierLabel: "Rubi",
          isVip: "true",
          returnPath: "/dashboard/customers?sort=spent",
        }),
      ),
      redirectMock,
    );

    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "loyalty_balance_reminder",
      }),
    );
    expect(revalidatePathMock.mock.calls.map(([path]) => path)).toEqual(
      expect.arrayContaining([
        "/dashboard/gestao/clientes",
        "/dashboard/notifications",
      ]),
    );
    expect(location).toBe(
      "/dashboard/gestao/clientes?sort=spent&message=Lembrete+enviado+para+o+app+do+cliente.&tone=success",
    );
  });

  it("approves a membership request from the dashboard home with a required activation date", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const membershipRequestMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "request-1",
        salon_id: "salon-1",
        customer_id: "customer-1",
        offer_id: "offer-1",
        offer_title_snapshot: "Plano brilho mensal",
        status: "pending",
      },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "request-1",
        approved_starts_on: "2026-04-15",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customer_membership_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: membershipRequestMaybeSingle,
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

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    });

    const location = await captureRedirect(
      approveCustomerMembershipRequestActionImpl(
        makeFormData({
          requestId: "request-1",
          startsOn: "2026-04-15",
          returnPath: "/dashboard",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith("approve_customer_membership_request", {
      request_uuid: "request-1",
      starts_on_input: "2026-04-15",
      notes_input: null,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "membership_request_approved",
      }),
    );
    expect(location).toBe(
      "/dashboard?message=Pedido+aprovado.+Agora+falta+marcar+o+pagamento+para+ativar+no+app.&tone=success",
    );
  });

  it("approves a membership request even when production is missing preferred schedule columns", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const membershipRequestMissingColumnsMaybeSingle = vi
      .fn()
      .mockResolvedValue({
        data: null,
        error: {
          code: "42703",
          message:
            "column customer_membership_requests.preferred_start_at does not exist",
        },
      });
    const membershipRequestFallbackMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "request-legacy-1",
        salon_id: "salon-1",
        customer_id: "customer-1",
        offer_id: "offer-1",
        offer_title_snapshot: "Plano brilho mensal",
        status: "pending",
        notes:
          "Quero manter esse horario.\n\n[salonfun_membership_preferred_schedule]eyJwcmVmZXJyZWRTdGFydEF0IjoiMjAyNi0wNS0xMlQxMjowMDowMC4wMDBaIiwicHJlZmVycmVkU3RhZmZNZW1iZXJJZCI6InN0YWZmLTEiLCJwcmVmZXJyZWRTdGFmZk1lbWJlck5hbWUiOiJFcXVpcGUgcHJpbmNpcGFsIn0",
      },
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "request-legacy-1",
        approved_starts_on: "2026-04-15",
      },
      error: null,
    });
    let membershipRequestSelectCallCount = 0;

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customer_membership_requests") {
          return {
            select: vi.fn(() => {
              membershipRequestSelectCallCount += 1;
              const maybeSingle =
                membershipRequestSelectCallCount === 1
                  ? membershipRequestMissingColumnsMaybeSingle
                  : membershipRequestFallbackMaybeSingle;

              return {
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    maybeSingle,
                  })),
                })),
              };
            }),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    });

    const location = await captureRedirect(
      approveCustomerMembershipRequestActionImpl(
        makeFormData({
          requestId: "request-legacy-1",
          startsOn: "2026-04-15",
          returnPath: "/dashboard/subscriptions?tab=requests",
        }),
      ),
      redirectMock,
    );

    expect(membershipRequestMissingColumnsMaybeSingle).toHaveBeenCalled();
    expect(membershipRequestFallbackMaybeSingle).toHaveBeenCalled();
    expect(rpc).toHaveBeenCalledWith("approve_customer_membership_request", {
      request_uuid: "request-legacy-1",
      starts_on_input: "2026-04-15",
      notes_input: null,
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "membership_request_approved",
      }),
    );
    expect(location).toBe(
      "/dashboard/subscriptions?tab=requests&message=Pedido+aprovado.+Agora+falta+marcar+o+pagamento+para+ativar+no+app.&tone=success",
    );
  });

  it("marks an approved membership request as paid and activates the plan", async () => {
    const insertNotification = vi.fn().mockResolvedValue({ error: null });
    const membershipRequestMaybeSingle = vi.fn().mockResolvedValue({
      data: {
        id: "request-2",
        salon_id: "salon-1",
        customer_id: "customer-1",
        offer_id: "offer-1",
        offer_title_snapshot: "Plano brilho mensal",
        approved_starts_on: "2020-04-15",
        membership_id: null,
        preferred_start_at: null,
        preferred_staff_member_id: null,
        status: "approved",
      },
      error: null,
    });
    const recentMembershipNotificationQuery = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });
    const rpc = vi.fn().mockResolvedValue({
      data: {
        id: "membership-1",
        expires_at: "2026-05-14",
      },
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "customer_membership_requests") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  maybeSingle: membershipRequestMaybeSingle,
                })),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  eq: vi.fn(() => ({
                    eq: vi.fn(() => ({
                      order: vi.fn(() => ({
                        limit: recentMembershipNotificationQuery,
                      })),
                    })),
                  })),
                })),
              })),
            })),
            insert: insertNotification,
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
    });

    const location = await captureRedirect(
      markCustomerMembershipRequestPaidActionImpl(
        makeFormData({
          requestId: "request-2",
          returnPath: "/dashboard/subscriptions",
        }),
      ),
      redirectMock,
    );

    expect(rpc).toHaveBeenCalledWith("mark_customer_membership_request_paid", {
      request_uuid: "request-2",
    });
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "membership_request_paid",
      }),
    );
    expect(recentMembershipNotificationQuery).toHaveBeenCalled();
    expect(insertNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        salon_id: "salon-1",
        customer_id: "customer-1",
        audience: "single_customer",
        notification_type: "membership_first_slot_required",
      }),
    );
    expect(location).toBe(
      "/dashboard/subscriptions?message=Pagamento+confirmado+e+plano+ativado+para+a+cliente.&tone=success",
    );
  });

  it("blocks membership approval when the activation date is missing or invalid", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn(),
      rpc: vi.fn(),
    });

    const location = await captureRedirect(
      approveCustomerMembershipRequestActionImpl(
        makeFormData({
          requestId: "request-1",
          returnPath: "/dashboard",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard?message=Informe+a+data+real+de+in%C3%ADcio+para+ativar+o+plano.&tone=error",
    );
  });

  it("keeps subscriptions filters when membership approval misses the start date", async () => {
    createClientMock.mockReturnValue({
      from: vi.fn(),
      rpc: vi.fn(),
    });

    const location = await captureRedirect(
      approveCustomerMembershipRequestActionImpl(
        makeFormData({
          requestId: "request-1",
          returnPath: "/dashboard/subscriptions?tab=requests&status=pending",
        }),
      ),
      redirectMock,
    );

    expect(location).toBe(
      "/dashboard/subscriptions?tab=requests&status=pending&message=Informe+a+data+real+de+in%C3%ADcio+para+ativar+o+plano.&tone=error",
    );
  });
});
