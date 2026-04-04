import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  makeFormData,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const { createClientMock, redirectMock, revalidatePathMock, requireOwnerSalonMock } = vi.hoisted(() => ({
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
          technicalNotes: "Tonalização fria + reconstrução leve a cada 30 dias.",
          consentStatus: "signed",
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
      beauty_goals_input: "Manter brilho, reduzir frizz e preservar comprimento.",
      contraindications_input: "Evitar calor excessivo após química.",
      technical_notes_input: "Tonalização fria + reconstrução leve a cada 30 dias.",
      consent_status_input: "signed",
      last_assessment_at_input: "2026-03-20",
      internal_notes_input: "Chega cedo e responde bem a combo de retorno.",
    });
    expect(revalidatePathMock).toHaveBeenCalledWith("/dashboard/customers");
    expect(location).toBe(
      "/dashboard/customers?segment=vip&message=CRM+do+cliente+atualizado+com+sucesso.&tone=success",
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
      expect.arrayContaining(["/dashboard/customers", "/dashboard/notifications"]),
    );
    expect(location).toBe(
      "/dashboard/customers?sort=spent&message=Lembrete+enviado+para+o+app+do+cliente.&tone=success",
    );
  });
});
