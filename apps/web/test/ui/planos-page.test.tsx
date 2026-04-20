// @vitest-environment jsdom

import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  captureRedirect,
  TEST_REDIRECT_PREFIX,
} from "@/test/server-action-test-helpers";

const {
  createClientMock,
  getOwnerSalonMock,
  getPublicBillingPlansMock,
  getSalonBillingWorkspaceSnapshotMock,
  getStripeBillingReadinessMock,
  getStripeOperationalStatusMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getOwnerSalonMock: vi.fn(),
  getPublicBillingPlansMock: vi.fn(),
  getSalonBillingWorkspaceSnapshotMock: vi.fn(),
  getStripeBillingReadinessMock: vi.fn(),
  getStripeOperationalStatusMock: vi.fn(),
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
  startStripeCheckoutAction: vi.fn(),
}));

vi.mock("@/components/FlashMessage", () => ({
  FlashMessage: (props: { message: string }) => <div>{props.message}</div>,
}));

vi.mock("@/lib/serverPerformance", () => ({
  measureServerRender: async (_name: string, renderFn: () => unknown) =>
    renderFn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: createClientMock,
}));

vi.mock("@/lib/auth", () => ({
  getOwnerSalon: getOwnerSalonMock,
}));

vi.mock("@/lib/billing", () => ({
  BILLING_DISABLED: false,
  BILLING_PATH: "/dashboard/billing",
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
  getPublicBillingPlans: getPublicBillingPlansMock,
  getSalonBillingWorkspaceSnapshot: getSalonBillingWorkspaceSnapshotMock,
}));

vi.mock("@/lib/stripeBilling", () => ({
  getStripeBillingReadiness: getStripeBillingReadinessMock,
  getStripeOperationalStatus: getStripeOperationalStatusMock,
}));

import PublicBillingPage from "@/app/planos/page";

const defaultPlans = [
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
  {
    id: "growth",
    displayName: "Growth",
    description: "Growth",
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
    highlight: "Mais equipe, campanhas e retenção ativa",
    tagline: "Escala comercial com mais equipe e campanhas",
  },
];

describe("public billing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    getPublicBillingPlansMock.mockResolvedValue(defaultPlans);
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
      billingPortalReturnUrl: "https://painel.example/dashboard/billing",
      webhookConfigured: true,
      webhookUrl: "https://painel.example/api/stripe/webhook",
    });
  });

  it("shows the public pricing page for visitors", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: null },
        }),
      },
    });

    render(await PublicBillingPage({}));

    expect(
      screen.getByRole("heading", {
        name: "Planos do painel para salões profissionais.",
      }),
    ).toBeInTheDocument();
    const loginLinks = screen.getAllByRole("link", {
      name: "Entrar para assinar",
    });
    expect(loginLinks.length).toBeGreaterThan(0);
    expect(
      loginLinks.every((link) => link.getAttribute("href") === "/login"),
    ).toBe(true);
    expect(screen.getByText("Starter")).toBeInTheDocument();
    expect(screen.getByText("Growth")).toBeInTheDocument();
  });

  it("renders checkout actions for locked salons", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "owner-1" } },
        }),
      },
    });
    getOwnerSalonMock.mockResolvedValue({
      id: "salon-1",
      name: "Studio Barber",
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: { id: "starter", displayName: "Starter" },
      isLocked: true,
    });

    render(await PublicBillingPage({}));

    expect(
      screen.getByRole("heading", {
        name: "Escolha o plano para liberar Studio Barber.",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Plano inicial")).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Assinar mensal" })).toHaveLength(2);
  });

  it("redirects active salons back to the internal billing management page", async () => {
    createClientMock.mockReturnValue({
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "owner-1" } },
        }),
      },
    });
    getOwnerSalonMock.mockResolvedValue({
      id: "salon-1",
      name: "Studio Barber",
    });
    getSalonBillingWorkspaceSnapshotMock.mockResolvedValue({
      currentPlan: { id: "growth", displayName: "Growth" },
      isLocked: false,
    });

    const location = await captureRedirect(
      Promise.resolve().then(() => PublicBillingPage({})),
      redirectMock,
    );

    expect(location).toBe("/dashboard/billing");
  });
});
