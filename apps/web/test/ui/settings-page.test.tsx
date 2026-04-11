// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createClientMock,
  regenerateSalonCodeActionPath,
  requireOwnerSalonMock,
  updateSalonBookingPolicyActionPath,
  updateSalonBrandingActionPath,
  updateSalonScheduleActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  regenerateSalonCodeActionPath: "/__test/regenerate-salon-code",
  requireOwnerSalonMock: vi.fn(),
  updateSalonBookingPolicyActionPath: "/__test/update-booking-policy",
  updateSalonBrandingActionPath: "/__test/update-branding",
  updateSalonScheduleActionPath: "/__test/update-schedule",
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
  regenerateSalonCodeAction: regenerateSalonCodeActionPath,
  updateSalonBookingPolicyAction: updateSalonBookingPolicyActionPath,
  updateSalonBrandingAction: updateSalonBrandingActionPath,
  updateSalonScheduleAction: updateSalonScheduleActionPath,
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
        client_app_config: {
          heroHeadline: "Seu melhor visual começa aqui",
          experienceModel: "beauty_signature",
          customDomain: "app.studiocentro.com.br",
          welcomeHeadline: "Studio Centro no seu bolso",
          welcomeMessage: "Agenda, loja e feed com leitura rápida.",
          homeEmphasis: "services",
          heroSupportLine: "Tudo alinhado com a identidade do salão.",
          primaryCtaLabel: "Agendar agora",
          visualStyle: "soft_editorial",
          themeMode: "light",
          buttonStyle: "rounded",
          cardStyle: "floating",
          bannerStyle: "editorial",
          whiteLabelActive: true,
          autoPilotEnabled: true,
          instagramUrl: "https://instagram.com/studiocentro",
          supportEmail: "oi@studiocentro.com",
          visibleHomeModules: ["shortcuts", "gallery", "products"],
          centralCampaigns: [
            {
              id: "campaign-1",
              isActive: true,
              priority: "high",
              audience: "all",
              title: "Volte essa semana",
              message: "Uma campanha operacional já pronta para a home.",
              ctaTarget: "explore",
            },
          ],
        },
        created_at: "2026-03-01T12:00:00.000Z",
        join_code: "ABCD1234",
      },
    });
  });

  it("renders branding, online schedule and join code forms", async () => {
    const ui = await SettingsPage({
      searchParams: { message: "Configurações salvas.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Configurações salvas.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Studio Centro", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen
        .getAllByRole("link", { name: "Abrir vitrine pública" })
        .every(
          (link) =>
            link.getAttribute("href") === "https://app.studiocentro.com.br",
        ),
    ).toBe(true);
    expect(
      screen.getByRole("heading", { name: "Identidade do salão" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Nome do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Segmento do salão")).toBeInTheDocument();
    expect(screen.getByLabelText("Nome exibido no app")).toBeInTheDocument();
    expect(screen.getByLabelText(/Endereço da vitrine/)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/WhatsApp público do salão/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Configuração técnica da plataforma"),
    ).not.toBeInTheDocument();
    expect(screen.getByLabelText("Headline principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Título de boas-vindas")).toBeInTheDocument();
    expect(screen.getByLabelText("Modelo de experiência")).toBeInTheDocument();
    expect(screen.getByLabelText("CTA principal")).toBeInTheDocument();
    expect(screen.getByLabelText("Ênfase da home")).toBeInTheDocument();
    expect(screen.getByLabelText("Estilo visual")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "White-label ativo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Piloto automático comercial ativo",
      }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Instagram do salão")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Política de privacidade"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Campanhas da central" }),
    ).toBeInTheDocument();
    expect(screen.getAllByLabelText("Título").length).toBeGreaterThan(0);
    expect(screen.getAllByLabelText("Destino do CTA").length).toBeGreaterThan(
      0,
    );
    expect(
      screen.getByRole("checkbox", { name: "Atalhos de serviços" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cor principal")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar identidade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda online" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Fuso horário")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Intervalo entre horários"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Política de reserva" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Ativar política de reserva" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Título da política")).toBeInTheDocument();
    expect(screen.getByLabelText("Resumo da política")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Janela de cancelamento (horas)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Confirmação antes do horário (minutos)"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Cobrar sinal no agendamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Forma de pagamento do sinal"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Chave Pix")).toBeInTheDocument();
    expect(screen.getByLabelText("Link de pagamento")).toBeInTheDocument();
    expect(
      screen.queryByLabelText("Chave de integração do Asaas"),
    ).not.toBeInTheDocument();
    expect(
      screen.getByLabelText("Instruções de pagamento"),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor do sinal/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar política" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Código para clientes" }),
    ).toBeInTheDocument();
    expect(screen.getByText("ABCD1234")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Gerar novo código" }),
    ).toBeInTheDocument();
  });
});
