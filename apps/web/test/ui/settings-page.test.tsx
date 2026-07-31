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
  updateSalonSecurityPolicyActionPath,
  updateSalonScheduleActionPath,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  regenerateSalonCodeActionPath: "/__test/regenerate-salon-code",
  requireOwnerSalonMock: vi.fn(),
  updateSalonBookingPolicyActionPath: "/__test/update-booking-policy",
  updateSalonBrandingActionPath: "/__test/update-branding",
  updateSalonSecurityPolicyActionPath: "/__test/update-security-policy",
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
  updateSalonSecurityPolicyAction: updateSalonSecurityPolicyActionPath,
  updateSalonScheduleAction: updateSalonScheduleActionPath,
}));

vi.mock("@/components/SalonSecuritySettingsPanel", () => ({
  SalonSecuritySettingsPanel: () => (
    <div>
      <h3>Autenticador do painel</h3>
      <label htmlFor="allowed-country-codes">Países permitidos</label>
      <input id="allowed-country-codes" />
      <button type="button">Salvar segurança do painel</button>
    </div>
  ),
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
    createClientMock.mockReturnValue({
      from: vi.fn((table: string) => {
        if (table === "salon_security_settings") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn().mockResolvedValue({
                  data: {
                    mfa_totp_enabled: true,
                    geo_allowlist_enabled: true,
                    allowed_country_codes: ["BR", "US"],
                  },
                  error: null,
                }),
              })),
            })),
          };
        }

        throw new Error(`Unexpected table ${table}`);
      }),
    });
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
        booking_policy_auto_confirm_new_appointments: true,
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
        whatsapp_dispatch_enabled: true,
        whatsapp_meta_business_account_id: "210248555053210",
        whatsapp_meta_phone_number_id: "123456789012345",
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

  it("renders a simplified settings flow with operational autopilot controls", async () => {
    const ui = await SettingsPage({
      searchParams: Promise.resolve({
        message: "Configurações salvas.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Configurações salvas.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Studio Centro", level: 1 }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Comece por aqui/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nome, cor, logo e vitrine")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Abrir vitrine/i }),
    ).toHaveAttribute("href", "https://app.studiocentro.com.br");
    expect(
      screen.getByRole("link", { name: "Abrir identidade" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir agenda" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir regras" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Identidade do sal/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Nome do sal/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Segmento do sal/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Nome exibido no app")).toBeInTheDocument();
    expect(screen.getByLabelText(/Endere.* da vitrine/i)).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "White-label ativo" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Cor principal")).toBeInTheDocument();
    expect(screen.getByText(/Mais ajustes do app/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar identidade" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Agenda online/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Fuso hor/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Intervalo entre hor/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar agenda" }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Pol.*tica de reserva/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Automa.* do sal/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Piloto automático")).toBeInTheDocument();
    expect(screen.getByText("Lançamentos do painel")).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: /Piloto autom.*tico do sal/i,
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: /Ativar pol.*tica de reserva/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", {
        name: "Aceitar sozinho horários lançados no painel",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Mensagem para a cliente/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/T.*tulo da pol/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Resumo da pol/i)).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Instru.*es de pagamento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Janela de cancelamento/i),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/^Confirma.*antes do hor.*\(minutos\)$/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("checkbox", { name: "Cobrar sinal no agendamento" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText(/Forma de pagamento do sinal/i),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Chave Pix")).toBeInTheDocument();
    expect(screen.getByLabelText("Link de pagamento")).toBeInTheDocument();
    expect(screen.getByLabelText(/Valor do sinal/)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Salvar pol.*tica/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /Seguran.* do painel/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Autenticador do painel/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/Pa.*ses permitidos/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Salvar seguran.* do painel/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("heading", { name: /C.*digo para clientes/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("ABCD1234")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Gerar novo c.*digo/i }),
    ).toBeInTheDocument();
  }, 10000);
});
