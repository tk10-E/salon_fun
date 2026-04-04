// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  requireOwnerSalonMock,
  updateAppointmentDepositActionMock,
  updateAppointmentStatusActionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  updateAppointmentDepositActionMock: vi.fn(),
  updateAppointmentStatusActionMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
  }) =>
    createElement(
      "a",
      { href: props.href, className: props.className },
      props.children,
    ),
}));

vi.mock("@/app/actions", () => ({
  updateAppointmentDepositAction: updateAppointmentDepositActionMock,
  updateAppointmentStatusAction: updateAppointmentStatusActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import AppointmentsPage from "@/app/dashboard/appointments/page";

describe("appointments page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", slot_step_minutes: 30 },
    });
  });

  it("renders smart suggestions, board sections and actions for the current agenda", async () => {
    const staffOrder = vi.fn(() =>
      Promise.resolve({ data: [{ id: "staff-1", name: "Ana" }], error: null }),
    );
    const selectDepositReceipts = vi.fn(() => ({
      eq: vi.fn(() => ({
        in: vi.fn(() =>
          Promise.resolve({
            data: [
              {
                id: "appointment-1",
                deposit_payment_provider: "asaas",
                deposit_payment_provider_invoice_url:
                  "https://www.asaas.com/i/pay_123",
                deposit_payment_provider_last_synced_at:
                  "2026-03-21T16:30:00.000Z",
                deposit_payment_provider_status: "PENDING",
                deposit_receipt_path:
                  "salon-1/customer-1/appointment-1/receipt.jpg",
                deposit_receipt_uploaded_at: "2026-03-21T16:25:00.000Z",
                deposit_receipt_content_type: "image/jpeg",
              },
            ],
            error: null,
          }),
        ),
      })),
    }));
    const rpc = vi.fn((name: string) => {
      if (name === "get_owner_appointment_board") {
        return Promise.resolve({
          data: {
            overview: {
              pending: 1,
              confirmed: 1,
              awaiting_completion: 1,
              completed: 0,
              cancelled: 0,
              deposit_pending: 2,
              deposit_received: 1,
            },
            total_count: 3,
            total_pages: 1,
            page: 1,
            page_size: 18,
            items: [
              {
                id: "appointment-1",
                booking_policy_acknowledged_at: "2026-03-21T11:00:00.000Z",
                booking_policy_snapshot: "Reserva protegida",
                booking_policy_version: "booking-policy-20260321110000",
                customer_name: "Maria",
                service_category: "Cabelo",
                service_name: "Escova modelada",
                service_duration: 60,
                staff_member_name: "Ana",
                date: "2026-03-22T12:00:00.000Z",
                deposit_amount: 35,
                deposit_customer_reported_paid_at: "2026-03-21T16:20:00.000Z",
                deposit_customer_reported_paid_via: "pix",
                deposit_customer_reported_reference: "SF123ABC",
                deposit_notes: null,
                deposit_paid_at: null,
                deposit_status: "pending",
                ends_at: "2026-03-22T13:00:00.000Z",
                board_status: "pending",
                status: "pending",
                cancellation_reason: null,
                cancelled_at: null,
                cancelled_by: null,
                completed_at: null,
                customer_confirmation_requested_at: null,
                customer_presence_confirmed_at: null,
              },
              {
                id: "appointment-2",
                booking_policy_acknowledged_at: "2026-03-21T14:30:00.000Z",
                booking_policy_snapshot: "Reserva protegida",
                booking_policy_version: "booking-policy-20260321110000",
                customer_name: "Joana",
                service_category: "Cabelo",
                service_name: "Coloração",
                service_duration: 120,
                staff_member_name: "Ana",
                date: "2026-03-22T15:00:00.000Z",
                deposit_amount: 50,
                deposit_customer_reported_paid_at: null,
                deposit_customer_reported_paid_via: null,
                deposit_customer_reported_reference: null,
                deposit_notes: null,
                deposit_paid_at: "2026-03-21T15:10:00.000Z",
                deposit_status: "received",
                ends_at: "2026-03-22T17:00:00.000Z",
                board_status: "confirmed",
                status: "confirmed",
                cancellation_reason: null,
                cancelled_at: null,
                cancelled_by: null,
                completed_at: null,
                customer_confirmation_requested_at: "2026-03-21T15:00:00.000Z",
                customer_presence_confirmed_at: null,
              },
              {
                id: "appointment-3",
                booking_policy_acknowledged_at: null,
                booking_policy_snapshot: null,
                booking_policy_version: null,
                customer_name: "Paula",
                service_category: "Unhas",
                service_name: "Alongamento",
                service_duration: 90,
                staff_member_name: "Ana",
                date: "2026-03-22T09:00:00.000Z",
                deposit_amount: 0,
                deposit_customer_reported_paid_at: null,
                deposit_customer_reported_paid_via: null,
                deposit_customer_reported_reference: null,
                deposit_notes: null,
                deposit_paid_at: null,
                deposit_status: "not_required",
                ends_at: "2026-03-22T10:30:00.000Z",
                board_status: "awaiting-completion",
                status: "confirmed",
                cancellation_reason: null,
                cancelled_at: null,
                cancelled_by: null,
                completed_at: null,
                customer_confirmation_requested_at: null,
                customer_presence_confirmed_at: "2026-03-22T08:00:00.000Z",
              },
            ],
          },
          error: null,
        });
      }

      if (name === "get_smart_schedule_opportunities") {
        return Promise.resolve({
          data: {
            target_day: "2026-03-22",
            timezone: "America/Sao_Paulo",
            slot_step_minutes: 30,
            suggestions: [
              {
                staff_member_id: "staff-1",
                staff_member_name: "Ana",
                gap_kind: "between_appointments",
                gap_start: "2026-03-22T14:00:00.000Z",
                gap_end: "2026-03-22T15:30:00.000Z",
                gap_minutes: 90,
                suggested_start: "2026-03-22T14:00:00.000Z",
                suggested_end: "2026-03-22T15:00:00.000Z",
                headline: "Encaixe premium",
                detail: "Janela boa para vender um serviço de maior ticket.",
                compatible_service_count: 2,
                compatible_services: [
                  {
                    id: "service-1",
                    name: "Escova modelada",
                    category: "Cabelo",
                    duration: 60,
                    price: 120,
                  },
                ],
                suggested_service: {
                  id: "service-1",
                  name: "Escova modelada",
                  category: "Cabelo",
                  duration: 60,
                  price: 120,
                },
              },
            ],
          },
          error: null,
        });
      }

      throw new Error(`Unexpected rpc ${name}`);
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "staff_members") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: staffOrder,
              })),
            })),
          };
        }

        if (table === "appointments") {
          return {
            select: vi.fn((columns: string) => {
              if (
                columns ===
                "id, deposit_receipt_path, deposit_receipt_uploaded_at, deposit_receipt_content_type, deposit_payment_provider, deposit_payment_provider_status, deposit_payment_provider_invoice_url, deposit_payment_provider_last_synced_at"
              ) {
                return selectDepositReceipts();
              }

              if (columns === "id, customer_id, service_id") {
                return {
                  eq: vi.fn(() => ({
                    in: vi.fn(() =>
                      Promise.resolve({
                        data: [
                          {
                            id: "appointment-1",
                            customer_id: "customer-1",
                            service_id: "service-1",
                          },
                          {
                            id: "appointment-2",
                            customer_id: "customer-2",
                            service_id: "service-2",
                          },
                          {
                            id: "appointment-3",
                            customer_id: "customer-3",
                            service_id: "service-3",
                          },
                        ],
                        error: null,
                      }),
                    ),
                  })),
                };
              }

              throw new Error(`Unexpected appointments columns ${columns}`);
            }),
          };
        }

        if (table === "customer_membership_redemptions") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  is: vi.fn(() =>
                    Promise.resolve({
                      data: [],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        if (table === "customer_memberships") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                in: vi.fn(() => ({
                  neq: vi.fn(() =>
                    Promise.resolve({
                      data: [],
                      error: null,
                    }),
                  ),
                })),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      rpc,
      storage: {
        from: vi.fn((bucket: string) => {
          if (bucket !== "appointment-deposit-proofs") {
            throw new Error(`Unexpected bucket ${bucket}`);
          }

          return {
            createSignedUrl: vi.fn((path: string) =>
              Promise.resolve({
                data: {
                  signedUrl: `https://signed.example/${encodeURIComponent(path)}`,
                },
                error: null,
              }),
            ),
          };
        }),
      },
    });

    const ui = await AppointmentsPage({
      searchParams: {
        message: "Agenda atualizada com sucesso.",
        tone: "success",
      },
    });

    render(ui);

    expect(
      screen.getByRole("heading", { name: "Encaixes inteligentes de hoje" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Encaixe premium")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agendamentos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Agenda atualizada com sucesso."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Operação que merece atenção agora",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Pendências do salão que pedem resposta imediata"),
    ).toBeInTheDocument();
    expect(screen.getByText("1 em aberto")).toBeInTheDocument();
    expect(screen.getByText("R$ 120,00")).toBeInTheDocument();
    expect(
      screen.getByText("Sinais pendentes que pedem follow-up agora"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar agenda")).toBeInTheDocument();
    expect(screen.getByText("3 agendamentos encontrados")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Confirmados" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Aguardando conclusão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Comprovante anexado")).toBeInTheDocument();
    expect(screen.getByText("Pix gerenciado")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir comprovante" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir cobranca Pix" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Confirmar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar sinal recebido" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Cliente informou")).toBeInTheDocument();
    expect(
      screen.getByText(/Pix aguardando pagamento em/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cliente informou pagamento via Pix em/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como atendido" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Liberado após o horário" }),
    ).toBeDisabled();
    expect(
      screen.getAllByRole("button", { name: "Cancelar" }).length,
    ).toBeGreaterThan(0);
  });
});
