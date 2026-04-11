// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  getSalonBillingWorkspaceSnapshotMock,
  getStripeBillingReadinessMock,
  getStripeOperationalStatusMock,
  requireOwnerSalonMock,
  startStripeBillingPortalActionPath,
  startStripeCheckoutActionPath,
} = vi.hoisted(() => ({
  getSalonBillingWorkspaceSnapshotMock: vi.fn(),
  getStripeBillingReadinessMock: vi.fn(),
  getStripeOperationalStatusMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
  startStripeBillingPortalActionPath: "/__test/stripe-portal",
  startStripeCheckoutActionPath: "/__test/stripe-checkout",
}));

vi.mock("@/app/actions", () => ({
  startStripeBillingPortalAction: startStripeBillingPortalActionPath,
  startStripeCheckoutAction: startStripeCheckoutActionPath,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/lib/billing", async () => {
  return {
    BILLING_DISABLED: true,
    formatBillingPrice: (price: number) =>
      new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
      }).format(price),
    formatLimitLabel: (limit: number | null, singular: string, plural = singular) =>
      limit === null ? "Ilimitado" : `${limit} ${limit === 1 ? singular : plural}`,
    getSalonBillingWorkspaceSnapshot: getSalonBillingWorkspaceSnapshotMock,
  };
});

vi.mock("@/lib/stripeBilling", () => ({
  getStripeBillingReadiness: getStripeBillingReadinessMock,
  getStripeOperationalStatus: getStripeOperationalStatusMock,
}));

import BillingPage from "@/app/dashboard/billing/page";

describe("billing page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        name: "Studio Beleza",
      },
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      plans: [
        {
          id: "starter",
          displayName: "Starter",
          description: "Plano base",
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
          highlight: "Entrada rápida",
          tagline: "Base",
        },
        {
          id: "growth",
          displayName: "Growth",
          description: "Plano comercial",
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
          highlight: "Mais vendido",
          tagline: "Growth",
        },
      ],
      currentPlan: {
        id: "starter",
        displayName: "Starter",
        description: "Plano base",
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
        highlight: "Entrada rápida",
        tagline: "Base",
      },
      subscription: {
        id: "sub-1",
        salonId: "salon-1",
        planId: "starter",
        status: "trialing",
        billingInterval: "monthly",
        trialStartedAt: "2026-04-01T12:00:00.000Z",
        trialEndsAt: "2026-04-15T12:00:00.000Z",
        currentPeriodStartedAt: null,
        currentPeriodEndsAt: null,
        graceEndsAt: null,
        activatedAt: null,
        canceledAt: null,
        paymentProvider: null,
        providerCustomerId: null,
        providerSubscriptionId: null,
        createdAt: "2026-04-01T12:00:00.000Z",
        updatedAt: "2026-04-01T12:00:00.000Z",
      },
      accessState: "healthy",
      isLocked: false,
      shouldShowBanner: false,
      statusLabel: "Em trial",
      bannerTitle: null,
      bannerMessage: null,
      bannerTone: "soft",
      nextBillingDateLabel: "15 de abril de 2026",
      statusDetail: "Trial do plano Starter ativo até 15 de abril de 2026.",
      trialDaysRemaining: 7,
      graceDaysRemaining: null,
      allowedPathsWhenLocked: ["/dashboard/billing", "/dashboard/settings"],
      isUsingFallback: false,
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
  });

  it("renders the plan workspace with public-facing plan actions", async () => {
    const ui = await BillingPage({
      searchParams: { message: "Billing atualizado.", tone: "success" },
    });

    render(ui);

    expect(requireOwnerSalonMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Billing atualizado.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Plano do salão" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Seu plano atual" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Planos disponíveis" })).toBeInTheDocument();
    expect(screen.getAllByText("Starter").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Growth").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Assinar mensal" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: "Assinar anual" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("heading", { name: "Conta técnica" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Stripe live/i)).not.toBeInTheDocument();
  });
});
