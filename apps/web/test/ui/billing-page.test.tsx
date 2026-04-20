// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  billingRuntimeMock,
  getSalonBillingWorkspaceSnapshotMock,
  getStripeBillingReadinessMock,
  getStripeOperationalStatusMock,
  requireOwnerSalonMock,
  redirectMock,
} = vi.hoisted(() => ({
  billingRuntimeMock: {
    disabled: true,
  },
  getSalonBillingWorkspaceSnapshotMock: vi.fn(),
  getStripeBillingReadinessMock: vi.fn(),
  getStripeOperationalStatusMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
  }) => (
    <a href={props.href} className={props.className}>
      {props.children}
    </a>
  ),
}));

vi.mock("next/navigation", () => ({
  redirect: redirectMock,
}));

vi.mock("@/app/actions", () => ({
  startStripeBillingPortalAction: vi.fn(),
  startStripeCheckoutAction: vi.fn(),
}));

vi.mock("@/lib/serverPerformance", () => ({
  measureServerRender: async (_name: string, renderFn: () => unknown) =>
    renderFn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/billing", () => ({
  get BILLING_DISABLED() {
    return billingRuntimeMock.disabled;
  },
  PUBLIC_BILLING_PATH: "/planos",
  formatBillingPrice: (price: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(price),
  formatLimitLabel: (
    value: number | null,
    singular: string,
    plural = singular,
  ) => (value === null ? "Ilimitado" : `${value} ${value === 1 ? singular : plural}`),
  getSalonBillingWorkspaceSnapshot: getSalonBillingWorkspaceSnapshotMock,
}));

vi.mock("@/lib/stripeBilling", () => ({
  getStripeBillingReadiness: getStripeBillingReadinessMock,
  getStripeOperationalStatus: getStripeOperationalStatusMock,
}));

import BillingPage from "@/app/dashboard/billing/page";

describe("billing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    billingRuntimeMock.disabled = true;
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
  });

  it("renders the billing workspace without redirecting to salon memberships", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "growth",
        displayName: "Growth",
      },
      plans: [
        {
          id: "starter",
          displayName: "Starter",
          description: "Base",
          monthlyPrice: 79,
          yearlyPrice: 790,
          currencyCode: "BRL",
          trialDays: 14,
          maxStaffMembers: 3,
          maxServices: 25,
          maxMonthlyNotifications: 1500,
          includesGrowthAutomation: false,
          includesFeedVideo: false,
          includesCustomBranding: true,
          includesPrioritySupport: false,
          isDefault: true,
          isPublic: true,
          sortOrder: 10,
          highlight: "Entrada rápida com trial automático",
          tagline: "Operação base e app do cliente no ar",
        },
        {
          id: "growth",
          displayName: "Growth",
          description: "Scale",
          monthlyPrice: 149,
          yearlyPrice: 1490,
          currencyCode: "BRL",
          trialDays: 7,
          maxStaffMembers: 8,
          maxServices: 80,
          maxMonthlyNotifications: 10000,
          includesGrowthAutomation: true,
          includesFeedVideo: true,
          includesCustomBranding: true,
          includesPrioritySupport: false,
          isDefault: false,
          isPublic: true,
          sortOrder: 20,
          highlight: "Vídeo no feed e automação inteligente",
          tagline: "Mais equipe, mais campanhas, mais retenção",
        },
      ],
      subscription: {
        billingInterval: "monthly",
        paymentProvider: null,
        providerCustomerId: null,
        status: "trialing",
        activatedAt: "2026-04-10T12:00:00.000Z",
      },
      statusLabel: "Em trial",
      statusDetail: "Trial do plano Growth ativo.",
      nextBillingDateLabel: "17 de abril de 2026",
      isLocked: false,
    });
    getStripeBillingReadinessMock.mockReturnValue({
      configured: true,
      missing: [],
    });
    getStripeOperationalStatusMock.mockResolvedValue({
      configured: true,
      mode: "test",
      liveReady: false,
      issues: ["Stripe ainda está em modo de teste."],
      activePortalConfigCount: 1,
      portalConfigured: true,
      billingPortalReturnUrl: "https://painel.salon.fun/dashboard/billing",
      webhookConfigured: true,
      webhookUrl: "https://painel.salon.fun/api/stripe/webhook",
    });

    render(await BillingPage({}));

    expect(
      screen.getByRole("heading", {
        name: "Growth para Studio Barber",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Cobrança do painel por estabelecimento"),
    ).toBeInTheDocument();
    expect(screen.getByText("Cobrança em preparação")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Ver planos do salão" }),
    ).toHaveAttribute("href", "/dashboard/subscriptions");
    expect(
      screen.getAllByRole("button", { name: "Assinar mensal" }),
    ).toSatisfy((buttons: HTMLButtonElement[]) =>
      buttons.every((button) => button.disabled),
    );
  });

  it("preserves flash params while rendering the billing workspace", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "starter",
        displayName: "Starter",
      },
      plans: [],
      subscription: {
        billingInterval: "monthly",
        paymentProvider: null,
        providerCustomerId: null,
        status: "active",
        activatedAt: "2026-04-10T12:00:00.000Z",
      },
      statusLabel: "Ativa",
      statusDetail: "Plano Starter ativo.",
      nextBillingDateLabel: "17 de abril de 2026",
      isLocked: false,
    });
    getStripeBillingReadinessMock.mockReturnValue({
      configured: false,
      missing: ["STRIPE_SECRET_KEY"],
    });
    getStripeOperationalStatusMock.mockResolvedValue({
      configured: false,
      mode: "unknown",
      liveReady: false,
      issues: ["Missing STRIPE_SECRET_KEY."],
      activePortalConfigCount: 0,
      portalConfigured: false,
      billingPortalReturnUrl: null,
      webhookConfigured: false,
      webhookUrl: null,
    });

    render(
      await BillingPage({
        searchParams: Promise.resolve({
          message: "Billing revisado.",
          tone: "success",
        }),
      }),
    );

    expect(screen.getByText("Billing revisado.")).toBeInTheDocument();
    expect(
      screen.getByText("Cobrança ainda em preparação"),
    ).toBeInTheDocument();
  });

  it("uses the portal as the only management path for linked Stripe subscriptions", async () => {
    billingRuntimeMock.disabled = false;
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "growth",
        displayName: "Growth",
      },
      plans: [
        {
          id: "growth",
          displayName: "Growth",
          description: "Scale",
          monthlyPrice: 149,
          yearlyPrice: 1490,
          currencyCode: "BRL",
          trialDays: 0,
          maxStaffMembers: 8,
          maxServices: 80,
          maxMonthlyNotifications: 10000,
          includesGrowthAutomation: true,
          includesFeedVideo: true,
          includesCustomBranding: true,
          includesPrioritySupport: false,
          isDefault: false,
          isPublic: true,
          sortOrder: 20,
          highlight: "Vídeo no feed e automação inteligente",
          tagline: "Mais equipe, mais campanhas, mais retenção",
        },
      ],
      subscription: {
        billingInterval: "monthly",
        paymentProvider: "stripe",
        providerCustomerId: "cus_123",
        providerSubscriptionId: "sub_123",
        status: "active",
        activatedAt: "2026-04-10T12:00:00.000Z",
      },
      statusLabel: "Ativa",
      statusDetail: "Plano Growth ativo.",
      nextBillingDateLabel: "10 de maio de 2026",
      isLocked: false,
    });
    getStripeBillingReadinessMock.mockReturnValue({
      configured: true,
      missing: [],
    });
    getStripeOperationalStatusMock.mockResolvedValue({
      configured: true,
      mode: "live",
      liveReady: true,
      issues: [],
      activePortalConfigCount: 1,
      portalConfigured: true,
      billingPortalReturnUrl: "https://painel.salon.fun/dashboard/billing",
      webhookConfigured: true,
      webhookUrl: "https://painel.salon.fun/api/stripe/webhook",
    });

    render(await BillingPage({}));

    expect(
      screen.getByRole("button", { name: "Gerenciar assinatura" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Assinar mensal" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(/trocas de plano, cartão e regularização seguem pela gestão da assinatura/i),
    ).toBeInTheDocument();
  });

  it("prioritizes activation when the panel is still locked", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "starter",
        displayName: "Starter",
      },
      plans: [
        {
          id: "starter",
          displayName: "Starter",
          description: "Base",
          monthlyPrice: 79,
          yearlyPrice: 790,
          currencyCode: "BRL",
          trialDays: 0,
          maxStaffMembers: 3,
          maxServices: 25,
          maxMonthlyNotifications: 1500,
          includesGrowthAutomation: false,
          includesFeedVideo: false,
          includesCustomBranding: true,
          includesPrioritySupport: false,
          isDefault: true,
          isPublic: true,
          sortOrder: 10,
          highlight: "Liberação do painel logo após o pagamento",
          tagline: "Base operacional para entrar no ar com segurança",
        },
      ],
      subscription: {
        billingInterval: "monthly",
        paymentProvider: null,
        providerCustomerId: null,
        status: "paused",
        activatedAt: null,
      },
      statusLabel: "Aguardando assinatura",
      statusDetail: "Conta criada. Escolha um plano e conclua o pagamento para liberar o painel Starter.",
      nextBillingDateLabel: null,
      isLocked: true,
    });
    getStripeBillingReadinessMock.mockReturnValue({
      configured: true,
      missing: [],
    });
    getStripeOperationalStatusMock.mockResolvedValue({
      configured: true,
      mode: "live",
      liveReady: true,
      issues: [],
      activePortalConfigCount: 1,
      portalConfigured: true,
      billingPortalReturnUrl: "https://painel.salon.fun/dashboard/billing",
      webhookConfigured: true,
      webhookUrl: "https://painel.salon.fun/api/stripe/webhook",
    });

    const location = await captureRedirect(
      Promise.resolve().then(() => BillingPage({})),
      redirectMock,
    );

    expect(location).toBe("/planos");
  });
});
