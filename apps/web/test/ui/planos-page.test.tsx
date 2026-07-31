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
  getStripeOperationalStatusMock,
  redirectMock,
} = vi.hoisted(() => ({
  createClientMock: vi.fn(),
  getOwnerSalonMock: vi.fn(),
  getPublicBillingPlansMock: vi.fn(),
  getSalonBillingWorkspaceSnapshotMock: vi.fn(),
  getStripeOperationalStatusMock: vi.fn(),
  redirectMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
    "aria-label"?: string;
  }) => (
    <a href={props.href} className={props.className} aria-label={props["aria-label"]}>
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
  SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE: 1068,
  SINGLE_BILLING_PLAN_YEARLY_SAVINGS: 178,
  formatBillingPrice: (price: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(price),
  getPublicBillingPlans: getPublicBillingPlansMock,
  getSalonBillingWorkspaceSnapshot: getSalonBillingWorkspaceSnapshotMock,
}));

vi.mock("@/lib/stripeBilling", () => ({
  getStripeOperationalStatus: getStripeOperationalStatusMock,
}));

import PublicBillingPage from "@/app/planos/page";

const defaultPlans = [
  {
    id: "starter",
    displayName: "Plano único",
    description: "Todos os recursos liberados por um valor mensal.",
    monthlyPrice: 89,
    yearlyPrice: 890,
    currencyCode: "BRL",
    trialDays: 3,
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
    highlight: "Tudo liberado por R$ 89 por mês",
    tagline: "Agenda, clientes, equipe, caixa e app no mesmo plano",
  },
];

describe("public billing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    redirectMock.mockImplementation((location: string) => {
      throw new Error(`${TEST_REDIRECT_PREFIX}${location}`);
    });
    getPublicBillingPlansMock.mockResolvedValue(defaultPlans);
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
        name: /Mais agenda\..*Menos.*enrolação\./i,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Pagamento 100% seguro")).toBeInTheDocument();
    expect(screen.getByText("Escolha o plano ideal para o seu salão")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ativar mensal por R\$\s?89/i }),
    ).toHaveAttribute("href", expect.stringContaining("/comecar?message="));
    expect(
      screen.getByRole("link", { name: /Ativar mensal por R\$\s?89/i }),
    ).toHaveAttribute("href", expect.stringContaining("returnPath=%2Fplanos%3Finterval%3Dmonthly"));
    expect(
      screen.getByRole("link", { name: /Ativar anual por R\$\s?890/i }),
    ).toHaveAttribute("href", expect.stringContaining("/comecar?message="));
    expect(
      screen.getByRole("link", { name: /Ativar anual por R\$\s?890/i }),
    ).toHaveAttribute("href", expect.stringContaining("returnPath=%2Fplanos%3Finterval%3Dyearly"));
    expect(screen.getAllByText("Começar teste grátis")).toHaveLength(2);
    expect(
      screen.getByText("O salão acompanha tudo no mesmo lugar."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir suporte" })).toHaveAttribute(
      "href",
      "/suporte",
    );
    expect(screen.getByAltText("Logo Salon Fun")).toHaveAttribute("src", "/icon.png");
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
      currentPlan: { id: "starter", displayName: "Plano único" },
      isLocked: true,
    });

    render(await PublicBillingPage({}));

    expect(screen.getByText("Escolha o plano ideal para Studio Barber")).toBeInTheDocument();
    expect(screen.getByText("Studio Barber pronto para ativação")).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "A conta de Studio Barber já está pronta. Confirmou o pagamento, o painel abre na hora.",
      ),
    ).toHaveLength(2);
    expect(
      screen.getByRole("button", { name: /Ativar mensal por R\$\s?89/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /Ativar anual por R\$\s?890/i }),
    ).toBeInTheDocument();
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
      currentPlan: { id: "starter", displayName: "Plano único" },
      isLocked: false,
    });

    const location = await captureRedirect(
      Promise.resolve().then(() => PublicBillingPage({})),
      redirectMock,
    );

    expect(location).toBe("/dashboard/billing");
  });
});
