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
  SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE: 1068,
  SINGLE_BILLING_PLAN_YEARLY_SAVINGS: 178,
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

  it("shows the dashboard as subscription management when the system is already signed", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "starter",
        displayName: "Plano único",
        trialDays: 14,
      },
      plans: [
        {
          id: "starter",
          displayName: "Plano único",
          description: "Todos os recursos liberados por um valor mensal.",
          monthlyPrice: 89,
          yearlyPrice: 890,
          currencyCode: "BRL",
          trialDays: 14,
          maxStaffMembers: null,
          maxServices: null,
          maxMonthlyNotifications: null,
          includesGrowthAutomation: true,
          includesFeedVideo: true,
          includesCustomBranding: true,
          includesPrioritySupport: true,
          isDefault: true,
          isPublic: true,
          sortOrder: 10,
          highlight: "Mensal por R$ 89 ou anual por R$ 890",
          tagline: "Uma assinatura mensal libera agenda, clientes, equipe, caixa e app",
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
      statusDetail: "Trial do plano Plano único ativo.",
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
        name: "Sistema assinado e em operação.",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/As clientes não compram nada aqui/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Plano único" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Começar com 14 dias grátis/i }),
    ).not.toBeInTheDocument();
  });

  it("preserves flash params while rendering the billing workspace", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "starter",
        displayName: "Plano único",
        trialDays: 0,
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
      statusDetail: "Plano Plano único ativo.",
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
    expect(screen.getByText("Sistema assinado e em operação.")).toBeInTheDocument();
  });

  it("uses the portal as the only management path for linked Stripe subscriptions", async () => {
    billingRuntimeMock.disabled = false;
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "starter",
        displayName: "Plano único",
        trialDays: 0,
      },
      plans: [
        {
          id: "starter",
          displayName: "Plano único",
          description: "Todos os recursos liberados por um valor mensal.",
          monthlyPrice: 89,
          yearlyPrice: 890,
          currencyCode: "BRL",
          trialDays: 0,
          maxStaffMembers: null,
          maxServices: null,
          maxMonthlyNotifications: null,
          includesGrowthAutomation: true,
          includesFeedVideo: true,
          includesCustomBranding: true,
          includesPrioritySupport: true,
          isDefault: true,
          isPublic: true,
          sortOrder: 10,
          highlight: "Mensal por R$ 89 ou anual por R$ 890",
          tagline: "Uma assinatura mensal libera agenda, clientes, equipe, caixa e app",
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
      statusDetail: "Plano Plano único ativo.",
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
      screen.queryByRole("button", { name: /Ativar anual por R\$\s?890/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        /Toda troca posterior de cartão, renovação ou regularização segue pela área da assinatura/i,
      ),
    ).toBeInTheDocument();
  });

  it("prioritizes activation when the panel is still locked", async () => {
    requireOwnerSalonMock.mockResolvedValue({
      salon: { id: "salon-1", name: "Studio Barber" },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: {
        id: "starter",
        displayName: "Plano único",
        trialDays: 0,
      },
      plans: [
        {
          id: "starter",
          displayName: "Plano único",
          description: "Todos os recursos liberados por um valor mensal.",
          monthlyPrice: 89,
          yearlyPrice: 890,
          currencyCode: "BRL",
          trialDays: 0,
          maxStaffMembers: null,
          maxServices: null,
          maxMonthlyNotifications: null,
          includesGrowthAutomation: true,
          includesFeedVideo: true,
          includesCustomBranding: true,
          includesPrioritySupport: true,
          isDefault: true,
          isPublic: true,
          sortOrder: 10,
          highlight: "Liberação do painel logo após o pagamento",
          tagline: "Uma assinatura mensal libera agenda, clientes, equipe, caixa e app",
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
      statusDetail: "Conta criada. Conclua a assinatura mensal de R$ 89 para liberar o painel completo.",
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
