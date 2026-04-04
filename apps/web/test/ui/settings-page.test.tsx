// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  regenerateSalonCodeActionMock,
  requireOwnerSalonMock,
  updateSalonBookingPolicyActionMock,
  updateSalonBrandingActionMock,
  updateSalonScheduleActionMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  regenerateSalonCodeActionMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  updateSalonBookingPolicyActionMock: vi.fn(),
  updateSalonBrandingActionMock: vi.fn(),
  updateSalonScheduleActionMock: vi.fn(),
}));

vi.mock("next/image", () => ({
  default: () => null,
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
  regenerateSalonCodeAction: regenerateSalonCodeActionMock,
  updateSalonBookingPolicyAction: updateSalonBookingPolicyActionMock,
  updateSalonBrandingAction: updateSalonBrandingActionMock,
  updateSalonScheduleAction: updateSalonScheduleActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

import SettingsPage from "@/app/dashboard/settings/page";

describe("settings page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Centro",
        tagline: "Beleza com agenda inteligente.",
        brand_color: "#C56B43",
        business_segment: "beauty_salon",
        booking_policy_auto_cancel_lead_minutes: 10,
        booking_policy_auto_cancel_pending_deposit: true,
        booking_policy_auto_cancel_unconfirmed: true,
        booking_policy_asaas_api_key: "aact_live_12345678901234567890",
        booking_policy_asaas_environment: "production",
        booking_policy_asaas_webhook_token:
          "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef",
        booking_policy_cancellation_window_hours: 24,
        booking_policy_confirmation_lead_minutes: 30,
        booking_policy_confirmation_required: true,
        booking_policy_deposit_amount: 35,
        booking_policy_deposit_reminder_lead_hours: 6,
        booking_policy_enabled: true,
        booking_policy_external_checkout_url: null,
        booking_policy_payment_instructions: "Pix pelo WhatsApp",
        booking_policy_payment_mode: "pix",
        booking_policy_pix_key: "pix@studio.com",
        booking_policy_pix_recipient_city: "SAO PAULO",
        booking_policy_pix_recipient_name: "Studio Centro",
        booking_policy_requires_deposit: true,
        booking_policy_summary: "Sinal para segurar horarios premium.",
        booking_policy_title: "Reserva protegida",
        booking_policy_version: "booking-policy-20260403193000",
        whatsapp_phone: "5511999999999",
        timezone: "America/Sao_Paulo",
        slot_step_minutes: 30,
        logo_path: null,
        created_at: "2026-03-01T12:00:00.000Z",
        join_code: "ABCD1234",
      },
    });
  });

  it("renders branding, online schedule and join code forms", async () => {
    const businessHoursOrder = vi.fn().mockResolvedValue({
      data: [
        {
          weekday: 1,
          is_open: true,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
        },
        {
          weekday: 2,
          is_open: true,
          opens_at: "09:00:00",
          closes_at: "18:00:00",
        },
      ],
      error: null,
    });

    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_business_hours") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                order: businessHoursOrder,
              })),
            })),
          };
        }

        if (table === "services") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 18, error: null }),
            })),
          };
        }

        if (table === "salon_posts") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 6, error: null }),
            })),
          };
        }

        if (table === "salon_offers") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn().mockResolvedValue({ count: 3, error: null }),
              })),
            })),
          };
        }

        if (table === "salon_customer_notifications") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                gte: vi.fn().mockResolvedValue({ count: 14, error: null }),
              })),
            })),
          };
        }

        if (table === "customer_push_tokens") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                eq: vi.fn(() => ({
                  count: 11,
                  error: null,
                  gte: vi.fn().mockResolvedValue({ count: 8, error: null }),
                })),
              })),
            })),
          };
        }

        if (table === "instagram_connections") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn().mockResolvedValue({ count: 1, error: null }),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
      storage: {
        from: vi.fn(() => ({
          getPublicUrl: vi.fn((path: string) => ({
            data: { publicUrl: `https://cdn.example.com/${path}` },
          })),
        })),
      },
    });

    const ui = await SettingsPage({
      searchParams: { message: "Configurações salvas.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Configurações salvas.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "O que já está pronto para vender, operar e distribuir",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Push e comunicação")).toBeInTheDocument();
    expect(screen.getByText("Instagram e menções")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Publico da publicacao 1"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Janela de inicio 1")).toBeInTheDocument();
    expect(screen.getByLabelText("Janela de fim 1")).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Abrir vitrine pública" })
        .every((link) => link.getAttribute("href") === "/s/ABCD1234"),
    ).toBe(true);
    expect(screen.getByRole("link", { name: "Push e avisos" })).toHaveAttribute(
      "href",
      "/dashboard/notifications",
    );
    expect(
      screen.getByRole("heading", { name: "Identidade do salão" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Preview do app")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Segmento do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Cor principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo da experiência")).toBeInTheDocument();
    expect(screen.getByLabelText("Tema do app do cliente")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Headline premium da home"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Titulo da publicacao 1")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Mensagem da publicacao 1"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Destino do CTA 1")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Imagem hero principal por arquivo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Imagem da galeria por arquivo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Capa institucional do perfil por arquivo"),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Foco horizontal").length).toBeGreaterThan(
      2,
    );
    expect(screen.getByText("Módulos visíveis na home")).toBeInTheDocument();
    expect(screen.getAllByLabelText("Zoom da imagem").length).toBeGreaterThan(
      2,
    );
    expect(screen.getByLabelText("Instagram do salão")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar identidade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda online" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fuso horário")).toBeInTheDocument();
    expect(screen.getByLabelText("Intervalo da agenda")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Reserva protegida" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByLabelText("Titulo da politica")).toBeInTheDocument();
    expect(screen.getByLabelText("Resumo para o cliente")).toBeInTheDocument();
    expect(screen.getByLabelText("Valor do sinal")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Modo de cobranca do sinal"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Chave de API do Asaas")).toBeInTheDocument();
    expect(screen.getByLabelText("Ambiente do Asaas")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Token do webhook do Asaas"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("URL do webhook")).toBeInTheDocument();
    expect(screen.getByLabelText("Chave Pix do salao")).toBeInTheDocument();
    expect(
      screen.getByLabelText("URL do checkout externo"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Confirmacao de presenca"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Minutos antes para auto cancelamento"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar politica de reserva" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Código para clientes" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("ABCD1234").length).toBeGreaterThan(1);
    expect(
      screen.getByRole("button", { name: "Gerar novo código" }),
    ).toBeInTheDocument();
  });
});
