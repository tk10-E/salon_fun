// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireOwnerSalonMock,
  sendSalonManualWhatsAppActionPath,
  updateSalonWhatsAppSettingsActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  sendSalonManualWhatsAppActionPath: "/__test/send-manual-whatsapp",
  updateSalonWhatsAppSettingsActionPath: "/__test/update-whatsapp-settings",
}));

vi.mock("@/app/actions", () => ({
  sendSalonManualWhatsAppAction: sendSalonManualWhatsAppActionPath,
  updateSalonWhatsAppSettingsAction: updateSalonWhatsAppSettingsActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import WhatsAppPage from "@/app/dashboard/whatsapp/page";

function buildThenableQuery<T>(result: T) {
  const chain = {
    eq: vi.fn(() => chain),
    gte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn().mockResolvedValue(result),
    then: (
      onFulfilled?: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) => Promise.resolve(result).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(result).catch(onRejected),
    finally: (onFinally?: () => void) =>
      Promise.resolve(result).finally(onFinally),
  };

  return chain;
}

function buildFilterableQuery<T>(
  resolver: (
    filters: Map<string, unknown>,
    meta: { head: boolean; maybeSingle: boolean },
  ) => T,
  head = false,
) {
  const filters = new Map<string, unknown>();
  const chain = {
    eq: vi.fn((field: string, value: unknown) => {
      filters.set(field, value);
      return chain;
    }),
    gte: vi.fn(() => chain),
    in: vi.fn(() => chain),
    is: vi.fn(() => chain),
    not: vi.fn(() => chain),
    order: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    maybeSingle: vi.fn().mockImplementation(() =>
      Promise.resolve(resolver(filters, { head, maybeSingle: true })),
    ),
    then: (
      onFulfilled?: (value: T) => unknown,
      onRejected?: (reason: unknown) => unknown,
    ) =>
      Promise.resolve(
        resolver(filters, { head, maybeSingle: false }),
      ).then(onFulfilled, onRejected),
    catch: (onRejected?: (reason: unknown) => unknown) =>
      Promise.resolve(
        resolver(filters, { head, maybeSingle: false }),
      ).catch(onRejected),
    finally: (onFinally?: () => void) =>
      Promise.resolve(
        resolver(filters, { head, maybeSingle: false }),
      ).finally(onFinally),
  };

  return chain;
}

describe("whatsapp page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T12:00:00.000Z"));

    let notificationHeadQueryCount = 0;
    let inboundQueryCount = 0;

    const customerRows = [
      {
        id: "customer-1",
        created_at: "2025-10-10T13:00:00.000Z",
        name: "Ana Paula",
        phone: "5511991112222",
        whatsapp_phone: "5511991112222",
      },
      {
        id: "customer-2",
        created_at: "2025-11-08T11:00:00.000Z",
        name: "Carla Mendes",
        phone: "5511988887777",
        whatsapp_phone: "5511988887777",
      },
      {
        id: "customer-3",
        created_at: "2026-04-08T09:00:00.000Z",
        name: "Marina Costa",
        phone: "5511977776666",
        whatsapp_phone: "5511977776666",
      },
    ];

    const appointmentHistoryByCustomer: Record<
      string,
      Array<{
        completed_at: string | null;
        date: string;
        id: string;
        status: string | null;
      }>
    > = {
      "customer-1": [
        {
          id: "appointment-today-1",
          date: "2026-04-12T15:00:00.000Z",
          status: "confirmed",
          completed_at: null,
        },
        {
          id: "appointment-completed-1",
          date: "2026-04-01T14:00:00.000Z",
          status: "completed",
          completed_at: "2026-04-01T15:30:00.000Z",
        },
      ],
      "customer-2": [
        {
          id: "appointment-completed-2",
          date: "2026-02-01T15:00:00.000Z",
          status: "completed",
          completed_at: "2026-02-01T17:00:00.000Z",
        },
      ],
    };

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn((_columns: string, options?: { head?: boolean }) => {
              if (options?.head) {
                notificationHeadQueryCount += 1;

                if (notificationHeadQueryCount === 1) {
                  return buildThenableQuery({ count: 18, error: null });
                }

                if (notificationHeadQueryCount === 2) {
                  return buildThenableQuery({ count: 1, error: null });
                }

                return buildThenableQuery({ count: 4, error: null });
              }

              return buildThenableQuery({
                data: [
                  {
                    id: "dispatch-1",
                    title: "Lembrete de retorno",
                    body: "Oi Ana Paula, estamos te esperando hoje às 14h.",
                    notification_type: "smart_rebook_prompt",
                    customer_id: "customer-1",
                    payload: {
                      customerName: "Ana Paula",
                      customerPhone: "5511991112222",
                    },
                    created_at: "2026-04-10T14:00:00.000Z",
                    whatsapp_delivery_status: "delivered",
                    whatsapp_error: null,
                    whatsapp_status_at: "2026-04-10T14:02:00.000Z",
                    customers: {
                      name: "Ana Paula",
                      phone: "5511991112222",
                      whatsapp_phone: "5511991112222",
                    },
                  },
                  {
                    id: "dispatch-2",
                    title: "Campanha de aniversário",
                    body: "Parabéns, Carla. Seu benefício já está ativo.",
                    notification_type: "birthday_campaign",
                    customer_id: "customer-2",
                    payload: {
                      customerName: "Carla Mendes",
                      customerPhone: "5511988887777",
                    },
                    created_at: "2026-04-09T10:00:00.000Z",
                    whatsapp_delivery_status: "failed",
                    whatsapp_error: "missing_template",
                    whatsapp_status_at: "2026-04-09T10:05:00.000Z",
                    customers: {
                      name: "Carla Mendes",
                      phone: "5511988887777",
                      whatsapp_phone: "5511988887777",
                    },
                  },
                ],
                error: null,
              });
            }),
          };
        }

        if (table === "whatsapp_inbound_messages") {
          return {
            select: vi.fn((_columns: string, options?: { head?: boolean }) => {
              if (options?.head) {
                return buildThenableQuery({ count: 5, error: null });
              }

              inboundQueryCount += 1;

              if (inboundQueryCount === 1) {
                return buildThenableQuery({
                  data: {
                    id: "message-1",
                    created_at: "2026-04-10T14:10:00.000Z",
                    from_phone: "5511991112222",
                    profile_name: "Ana Paula",
                    message_body: "SIM, pode confirmar.",
                    interpreted_intent: "confirm_appointment",
                    handled_action: "appointment_confirmed",
                  },
                  error: null,
                });
              }

              return buildThenableQuery({
                data: [
                  {
                    id: "message-1",
                    created_at: "2026-04-10T14:10:00.000Z",
                    from_phone: "5511991112222",
                    profile_name: "Ana Paula",
                    message_body: "SIM, pode confirmar.",
                    interpreted_intent: "confirm_appointment",
                    handled_action: "appointment_confirmed",
                  },
                  {
                    id: "message-2",
                    created_at: "2026-04-09T15:00:00.000Z",
                    from_phone: "5511988887777",
                    profile_name: "Carla Mendes",
                    message_body: "Preciso remarcar.",
                    interpreted_intent: "reschedule_appointment",
                    handled_action: "appointment_reschedule_requested",
                  },
                ],
                error: null,
              });
            }),
          };
        }

        if (table === "customers") {
          return {
            select: vi.fn((columns: string) => {
              if (columns.includes("name")) {
                return buildThenableQuery({
                  data: customerRows.filter((customer) =>
                    ["customer-1", "customer-3"].includes(customer.id),
                  ),
                  error: null,
                });
              }

              return buildFilterableQuery((filters) => {
                const customerId = String(filters.get("id") ?? "");
                const customer = customerRows.find(
                  (row) => row.id === customerId,
                );

                return {
                  data: customer
                    ? {
                        id: customer.id,
                        created_at: customer.created_at,
                      }
                    : null,
                  error: null,
                };
              });
            }),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((_columns: string, options?: { head?: boolean }) => {
              if (options?.head) {
                return buildFilterableQuery((filters) => {
                  const customerId = String(filters.get("customer_id") ?? "");
                  return {
                    count: customerId === "customer-1" ? 12 : customerId === "customer-2" ? 2 : 0,
                    error: null,
                  };
                }, true);
              }

              return buildFilterableQuery((filters) => {
                const customerId = String(filters.get("customer_id") ?? "");
                return {
                  data: appointmentHistoryByCustomer[customerId] ?? [],
                  error: null,
                };
              });
            }),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Centro",
        timezone: "America/Sao_Paulo",
        whatsapp_dispatch_enabled: true,
        whatsapp_meta_business_account_id: "210248555053210",
        whatsapp_meta_phone_number_id: "123456789012345",
        whatsapp_phone: "5511999999999",
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  it("renders the whatsapp workspace with conversation-first UI for end users", async () => {
    const ui = await WhatsAppPage({
      searchParams: Promise.resolve({
        lead: "customer-1",
        message: "WhatsApp salvo.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("WhatsApp salvo.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "WhatsApp do salão, organizado como conversa",
        level: 1,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Conversas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Canal do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Como a equipe usa essa tela" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ana Paula", level: 2 }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nova conversa")).toBeInTheDocument();
    expect(screen.getByLabelText("Número oficial do salão")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Permitir mensagens pelo painel e pelas automações",
      }),
    ).toBeChecked();
    expect(
      screen.getByRole("button", { name: "Salvar WhatsApp" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar mensagem" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sugestões para confirmação • Agenda hoje"),
    ).toBeInTheDocument();
    expect(screen.getByText("Agenda hoje")).toBeInTheDocument();
    expect(screen.getByText("VIP")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Te esperamos hoje" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Chegue 10 min antes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Objetivos da conversa")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Fechar agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Vender pacote" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar sem falta" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem")).toHaveValue(
      "Oi Ana Paula, vi sua agenda de hoje aqui no salão Studio Centro. Se precisar de qualquer ajuste antes do atendimento, me chama.",
    );
    expect(
      screen.queryByLabelText("ID do número na Meta"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText("ID da conta de negócio"),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir no WhatsApp" })).toHaveAttribute(
      "href",
      "https://wa.me/5511991112222",
    );
    expect(
      screen.getByRole("link", { name: "Ir para agenda" }),
    ).toHaveAttribute("href", "/dashboard/gestao/agendamentos");
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(screen.getByText(/Entregue/)).toBeInTheDocument();
    expect(
      screen.getByText(/Confirmação refletida na agenda/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Conectada pela equipe técnica/),
    ).toBeInTheDocument();

    const settingsSubmitButton = screen.getByRole("button", {
      name: "Salvar WhatsApp",
    });
    expect(settingsSubmitButton.closest("form")).toHaveAttribute(
      "action",
      updateSalonWhatsAppSettingsActionPath,
    );

    const manualSubmitButton = screen.getByRole("button", {
      name: "Enviar mensagem",
    });
    expect(manualSubmitButton.closest("form")).toHaveAttribute(
      "action",
      sendSalonManualWhatsAppActionPath,
    );
  });

  it("adapts quick replies when the customer asks to reschedule", async () => {
    const ui = await WhatsAppPage({
      searchParams: Promise.resolve({
        lead: "customer-2",
      }),
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Carla Mendes", level: 2 }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Sugestões para reagendamento • Em retorno"),
    ).toBeInTheDocument();
    expect(screen.getByText("Em retorno")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Que bom te ver" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Quero te ajudar a voltar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Sugerir horários" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Recuperar cliente" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Mensagem")).toHaveValue(
      "Oi Carla Mendes, que bom falar com você de novo. Posso te ajudar a voltar para a agenda do salão Studio Centro.",
    );
  });

  it("accepts the global panel channel ids from env when the salon has no technical ids saved", async () => {
    vi.stubEnv("WHATSAPP_PHONE_NUMBER_ID", "999674686571590");
    vi.stubEnv("WHATSAPP_BUSINESS_ACCOUNT_ID", "971985821845039");

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Centro",
        timezone: "America/Sao_Paulo",
        whatsapp_dispatch_enabled: true,
        whatsapp_meta_business_account_id: null,
        whatsapp_meta_phone_number_id: null,
        whatsapp_phone: "5511999999999",
      },
    });

    const ui = await WhatsAppPage({
      searchParams: Promise.resolve({}),
    });

    render(ui);

    expect(
      screen.getByText(/Conectada pelo canal padrão do painel/),
    ).toBeInTheDocument();
  });
});
