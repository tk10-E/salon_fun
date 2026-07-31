// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { loadClientAppHubDataMock } = vi.hoisted(() => ({
  loadClientAppHubDataMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
    target?: string;
    rel?: string;
  }) =>
    createElement(
      "a",
      {
        href: props.href,
        className: props.className,
        target: props.target,
        rel: props.rel,
      },
      props.children,
    ),
}));

vi.mock("@/app/dashboard/client-app/_lib", async () => {
  return {
    loadClientAppHubData: loadClientAppHubDataMock,
  };
});

import ClientAppPage from "@/app/dashboard/client-app/page";

describe("client app page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the client app orchestration hub with commands, touchpoints, and recommendations", async () => {
    loadClientAppHubDataMock.mockResolvedValue({
      salonName: "Studio Solar",
      publicSalonPath: "/s/studio-solar",
      experienceModelLabel: "Beauty Signature",
      visualStyleLabel: "Glow assinatura",
      homeEmphasisLabel: "Serviços e agendamento",
      welcomeHeadline: "Sua próxima visita começa aqui.",
      heroHeadline: "Resultado com cara de marca viva.",
      primaryCtaLabel: "Reservar agora",
      promotionHeadline: "Campanhas da semana",
      brandCoverageCount: 4,
      brandSignals: [
        {
          label: "Logo",
          ready: true,
          summary: "Identidade principal publicada.",
        },
        {
          label: "Tagline",
          ready: true,
          summary: "Mensagem curta de marca configurada.",
        },
        {
          label: "WhatsApp",
          ready: true,
          summary: "Canal oficial liberado no app.",
        },
        {
          label: "Hero",
          ready: true,
          summary: "Capa principal pronta para a home.",
        },
        {
          label: "Galeria",
          ready: false,
          summary: "A central visual ainda não tem capa própria.",
        },
        {
          label: "Perfil",
          ready: false,
          summary: "Falta capa para a área de perfil e benefícios.",
        },
      ],
      centralCampaigns: [
        {
          id: "campaign-1",
          isActive: true,
          priority: "high",
          startsAt: "2020-04-01T09:00:00.000Z",
          endsAt: "2100-04-07T20:00:00.000Z",
          audience: "with_upcoming_appointment",
          eyebrow: "Agora no app",
          title: "Volte essa semana",
          message: "Uma campanha operacional foi publicada direto do painel.",
          campaignLabel: "Retorno da semana",
          ctaLabel: "Reservar agora",
          ctaTarget: "explore",
        },
      ],
      servicesCount: 18,
      postsCount: 5,
      activeOffersCount: 2,
      activeMembershipsCount: 1,
      recentNotificationsCount: 7,
      activePushTokensCount: 14,
      recentPushTokensCount: 9,
      instagramConnectionCount: 1,
      commercialDataHealth: {
        loyaltyDashboardReady: true,
        growthAutomationDashboardReady: true,
        marketingDashboardReady: true,
        hasFallbackData: false,
        warnings: [],
      },
      whiteLabelActive: false,
      autoPilotEnabled: false,
      appDisplayName: null,
      customDomain: null,
      growthAutomationSettings: {
        is_active: true,
        winback_inactive_days: 35,
        winback_discount_percent: 10,
        winback_title: "Volte para o Studio Solar",
        winback_body_template: "Template winback",
        smart_rebook_is_active: true,
        smart_rebook_window_days: 5,
        smart_rebook_title: "Hora de reagendar",
        smart_rebook_body_template: "Template rebook",
        updated_at: "2026-04-01T12:00:00.000Z",
      },
      growthAutomationOverview: {
        at_risk_customers: 12,
        due_now_customers: 4,
        smart_rebook_due_customers: 3,
        winbacks_sent_last_30d: 6,
        smart_rebooks_sent_last_30d: 8,
        recovered_customers_last_30d: 3,
      },
      loyaltyOverview: {
        ranked_customers: 25,
        vip_customers: 6,
        total_completed_visits: 180,
        total_points_earned: 920,
        total_cashback_earned: 420,
      },
      referralProgramActive: true,
      referralProgramTitle: "Indique o Studio Solar",
      qualifiedReferralsCount: 5,
      pendingReferralsCount: 2,
      recentNotifications: [
        {
          id: "notification-1",
          title: "Campanha flash liberada",
          body: "A cliente recebeu um empurrão comercial direto do painel.",
          notificationType: "promotion_published",
          category: "promotion",
          audience: "salon_customers",
          createdAt: "2026-04-02T12:00:00.000Z",
        },
      ],
      recentPosts: [
        {
          id: "post-1",
          title: "Morena iluminada glow",
          caption: null,
          postType: "before_after",
          serviceName: "Morena iluminada",
          createdAt: "2026-04-01T15:00:00.000Z",
          likesCount: 18,
          commentsCount: 4,
        },
      ],
    });

    const ui = await ClientAppPage({
      searchParams: Promise.resolve({
        message: "Central do cliente atualizada.",
        tone: "success",
      }),
    });

    render(ui);

    expect(
      screen.getByText("Central do cliente atualizada."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "App do cliente",
      }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Abrir feed" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir feed" }),
    ).toHaveAttribute("href", "/dashboard/feed");
    expect(
      screen.getByRole("heading", { name: "O que mexer agora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Clubes, pacotes e promoções" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "O que a cliente vê",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Campanha flash liberada")).toBeInTheDocument();
    expect(screen.getByText("Morena iluminada glow")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Base do app",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Volte essa semana")).toBeInTheDocument();
    expect(screen.getByText("14 clientes com app")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver app público" }),
    ).toHaveAttribute("href", "/s/studio-solar");
    expect(
      screen.getByRole("link", { name: "Criar promoção" }),
    ).toHaveAttribute("href", "/dashboard/benefits/promotions?compose=1");
    expect(
      screen.getByRole("link", { name: "Ajustar vitrine" }),
    ).toHaveAttribute("href", "/dashboard/settings#brand-identity");
    expect(
      screen.getByRole("heading", { name: "Próximos passos" }),
    ).toBeInTheDocument();
    expect(screen.getByText("4/6 marca pronta")).toBeInTheDocument();
  });

  it("respects the custom domain and surfaces data warnings when the commercial block is not real", async () => {
    loadClientAppHubDataMock.mockResolvedValue({
      salonName: "Studio Solar",
      publicSalonPath: "https://app.studiosolar.com.br",
      experienceModelLabel: "Beauty Signature",
      visualStyleLabel: "Glow assinatura",
      homeEmphasisLabel: "Serviços e agendamento",
      welcomeHeadline: "Sua próxima visita começa aqui.",
      heroHeadline: "Resultado com cara de marca viva.",
      primaryCtaLabel: "Reservar agora",
      promotionHeadline: "Campanhas da semana",
      brandCoverageCount: 5,
      brandSignals: [],
      centralCampaigns: [],
      servicesCount: 12,
      postsCount: 3,
      activeOffersCount: 1,
      activeMembershipsCount: 1,
      recentNotificationsCount: 2,
      activePushTokensCount: 4,
      recentPushTokensCount: 3,
      instagramConnectionCount: 1,
      commercialDataHealth: {
        loyaltyDashboardReady: true,
        growthAutomationDashboardReady: false,
        marketingDashboardReady: true,
        hasFallbackData: true,
        warnings: [
          "Automacoes do app nao responderam agora. Revise o bloco de automacoes antes de confiar nos numeros.",
        ],
      },
      whiteLabelActive: true,
      autoPilotEnabled: true,
      appDisplayName: "Studio Solar App",
      customDomain: "app.studiosolar.com.br",
      growthAutomationSettings: {
        is_active: false,
        winback_inactive_days: 35,
        winback_discount_percent: 10,
        winback_title: "Volte para o Studio Solar",
        winback_body_template: "Template winback",
        smart_rebook_is_active: false,
        smart_rebook_window_days: 5,
        smart_rebook_title: "Hora de reagendar",
        smart_rebook_body_template: "Template rebook",
        updated_at: "2026-04-01T12:00:00.000Z",
      },
      growthAutomationOverview: {
        at_risk_customers: 0,
        due_now_customers: 0,
        smart_rebook_due_customers: 0,
        winbacks_sent_last_30d: 0,
        smart_rebooks_sent_last_30d: 0,
        recovered_customers_last_30d: 0,
      },
      loyaltyOverview: {
        ranked_customers: 25,
        vip_customers: 6,
        total_completed_visits: 180,
        total_points_earned: 920,
        total_cashback_earned: 420,
      },
      referralProgramActive: true,
      referralProgramTitle: "Indique o Studio Solar",
      qualifiedReferralsCount: 5,
      pendingReferralsCount: 2,
      recentNotifications: [],
      recentPosts: [],
    });

    const ui = await ClientAppPage({});

    render(ui);

    expect(screen.getByText("Dados em atualização")).toBeInTheDocument();
    expect(
      screen.getByText("Alguns dados do app estão sendo atualizados"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver app público" }),
    ).toHaveAttribute("href", "https://app.studiosolar.com.br");
    expect(
      screen.getByRole("link", { name: "Ver app público" }),
    ).toHaveAttribute("target", "_blank");
    expect(screen.getByText("Dados indisponíveis")).toBeInTheDocument();
  });
});
