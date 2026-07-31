// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

const { usePathnameMock } = vi.hoisted(() => ({
  usePathnameMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
    onClick?: () => void;
  }) =>
    createElement(
      "a",
      { href: props.href, className: props.className, onClick: props.onClick },
      props.children,
    ),
}));

vi.mock("next/navigation", () => ({
  usePathname: usePathnameMock,
}));

vi.mock("@/components/PanelResponseController", () => ({
  PanelResponseController: () => null,
}));

vi.mock("@/components/DashboardLiveSync", () => ({
  DashboardLiveSync: () => null,
}));

vi.mock("@/components/SidebarNav", () => ({
  SidebarNav: () => <nav aria-label="NavegaÃ§Ã£o lateral">Sidebar</nav>,
}));

vi.mock("@/components/auth/PanelSignOutButton", () => ({
  PanelSignOutButton: () => <button type="button">Sair</button>,
}));

vi.mock("@/components/DashboardAccessGate", () => ({
  DashboardAccessGate: () => null,
}));

import { DashboardShell } from "@/components/DashboardShell";
import type { SalonBillingSnapshot } from "@/lib/billing";

const billingSnapshot: SalonBillingSnapshot = {
  plans: [
    {
      id: "starter",
      displayName: "Starter",
      description: "Plano base",
      monthlyPrice: 89,
      yearlyPrice: 890,
      currencyCode: "BRL",
      trialDays: 3,
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
      highlight: null,
      tagline: null,
    },
  ],
  currentPlan: {
    id: "starter",
    displayName: "Starter",
    description: "Plano base",
    monthlyPrice: 89,
    yearlyPrice: 890,
    currencyCode: "BRL",
    trialDays: 3,
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
    highlight: null,
    tagline: null,
  },
  subscription: {
    id: "sub-1",
    salonId: "salon-1",
    planId: "starter",
    status: "active",
    billingInterval: "monthly",
    trialStartedAt: null,
    trialEndsAt: null,
    currentPeriodStartedAt: "2026-05-01T00:00:00.000Z",
    currentPeriodEndsAt: "2026-06-01T00:00:00.000Z",
    graceEndsAt: null,
    activatedAt: "2026-05-01T00:00:00.000Z",
    canceledAt: null,
    paymentProvider: "stripe",
    providerCustomerId: "cus_123",
    providerSubscriptionId: "sub_123",
    createdAt: "2026-05-01T00:00:00.000Z",
    updatedAt: "2026-05-01T00:00:00.000Z",
  },
  accessState: "healthy",
  isLocked: false,
  shouldShowBanner: false,
  statusLabel: "Ativa",
  bannerTitle: null,
  bannerMessage: null,
  bannerTone: "soft",
  nextBillingDateLabel: "1 de junho de 2026",
  statusDetail: "Plano Starter em ativa.",
  trialDaysRemaining: null,
  graceDaysRemaining: null,
  allowedPathsWhenLocked: ["/dashboard/settings"],
  isUsingFallback: false,
};

const OriginalImage = globalThis.Image;

class MockImage {
  onload: null | (() => void) = null;
  onerror: null | (() => void) = null;

  set src(value: string) {
    queueMicrotask(() => {
      if (value.includes("broken-avatar")) {
        this.onerror?.();
        return;
      }

      this.onload?.();
    });
  }
}

describe("DashboardShell", () => {
  beforeAll(() => {
    vi.stubGlobal("Image", MockImage);
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query === "(min-width: 961px)",
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
  });

  afterAll(() => {
    vi.stubGlobal("Image", OriginalImage);
  });

  it("keeps the dashboard home on the expanded desktop canvas without hiding the top chrome", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    const { container } = render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Studio Centro Prime"
        ownerEmail="ana@studiocentro.com"
        ownerDisplayName="Ana Paula"
        salonLogoUrl="https://cdn.example.com/logo.png"
        ownerAvatarUrl="https://cdn.example.com/avatar.png"
        billingSnapshot={billingSnapshot}
      >
        <div>Resumo</div>
      </DashboardShell>,
    );

    expect(container.querySelector(".dashboard-main")).toHaveClass(
      "dashboard-main--wide",
    );
    expect(
      screen.queryByRole("link", { name: /configuracoes/i }),
    ).not.toBeInTheDocument();
  });

  it("prioritizes the Google profile photo and name in the sidebar and header", async () => {
    usePathnameMock.mockReturnValue("/dashboard");

    const { container } = render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Studio Centro Prime"
        ownerEmail="ana@studiocentro.com"
        ownerDisplayName="Ana Paula"
        salonLogoUrl="https://cdn.example.com/logo.png"
        ownerAvatarUrl="https://cdn.example.com/avatar.png"
        billingSnapshot={billingSnapshot}
      >
        <div>Resumo</div>
      </DashboardShell>,
    );

    await waitFor(() => {
      const ownerPhotos = container.querySelectorAll(
        'img[src="https://cdn.example.com/avatar.png"]',
      );
      expect(ownerPhotos).toHaveLength(3);
    });
    expect(
      screen.queryByRole("img", { name: "Marca do Centro Prime" }),
    ).not.toBeInTheDocument();
    expect(screen.getAllByText("Ana Paula")).toHaveLength(3);
    expect(screen.getAllByText("Centro Prime")).toHaveLength(2);
  });

  it("keeps the owner's social photo in the sidebar when there is no salon logo", async () => {
    usePathnameMock.mockReturnValue("/dashboard");

    const { container } = render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Barbearia Central"
        ownerEmail="tecnologijc@gmail.com"
        ownerDisplayName="Tecnologijc"
        salonLogoUrl={null}
        ownerAvatarUrl="https://cdn.example.com/social-avatar.png"
        billingSnapshot={billingSnapshot}
      >
        <div>Resumo</div>
      </DashboardShell>,
    );

    await waitFor(() => {
      const ownerPhotos = container.querySelectorAll(
        'img[src="https://cdn.example.com/social-avatar.png"]',
      );
      expect(ownerPhotos).toHaveLength(3);
    });
  });

  it("keeps a stable owner initials fallback when no image is available", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    const { container } = render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Barbearia Central"
        ownerEmail="tecnologijc@gmail.com"
        billingSnapshot={billingSnapshot}
      >
        <div>Resumo</div>
      </DashboardShell>,
    );

    expect(container.querySelector(".sidebar-brand__mark-image")).toBeNull();
    expect(container.querySelector(".page-header__avatar-image")).toBeNull();
    expect(screen.getAllByText("Tecnologijc")).toHaveLength(3);
    expect(screen.getAllByText("Barbearia Central")).toHaveLength(2);
  });

  it("falls back to the salon logo in the sidebar when the owner's avatar fails", async () => {
    usePathnameMock.mockReturnValue("/dashboard");

    const { container } = render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Studio Centro Prime"
        ownerEmail="ana@studiocentro.com"
        ownerDisplayName="Ana Paula"
        salonLogoUrl="https://cdn.example.com/logo.png"
        ownerAvatarUrl="https://cdn.example.com/broken-avatar.png"
        billingSnapshot={billingSnapshot}
      >
        <div>Resumo</div>
      </DashboardShell>,
    );

    await waitFor(() => {
      const sidebarPhoto = container.querySelector(".sidebar-brand__mark-image");
      expect(sidebarPhoto).not.toBeNull();
      expect(sidebarPhoto).toHaveAttribute("src", "https://cdn.example.com/logo.png");
    });
  });

  it("renders mobile navigation controls without affecting the desktop shell content", () => {
    usePathnameMock.mockReturnValue("/dashboard");

    render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Studio Centro Prime"
        ownerEmail="ana@studiocentro.com"
        ownerDisplayName="Ana Paula"
        salonLogoUrl="https://cdn.example.com/logo.png"
        ownerAvatarUrl="https://cdn.example.com/avatar.png"
        billingSnapshot={billingSnapshot}
      >
        <div>Resumo</div>
      </DashboardShell>,
    );

    expect(
      screen.getByRole("button", { name: /abrir menu do painel/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ajustes/i })).toHaveAttribute(
      "href",
      "/dashboard/settings",
    );
    expect(screen.getByRole("button", { name: /fechar/i })).toBeInTheDocument();
    expect(screen.getByText("Resumo")).toBeInTheDocument();
  });

  it("keeps focused management routes wide and removes the default top header", () => {
    usePathnameMock.mockReturnValue("/dashboard/gestao/clientes");

    const { container } = render(
      <DashboardShell
        salonId="salon-1"
        salonCode="D1E438"
        salonName="Studio Centro Prime"
        ownerEmail="ana@studiocentro.com"
        ownerDisplayName="Ana Paula"
        salonLogoUrl="https://cdn.example.com/logo.png"
        ownerAvatarUrl="https://cdn.example.com/avatar.png"
        billingSnapshot={billingSnapshot}
      >
        <div>Clientes</div>
      </DashboardShell>,
    );

    expect(container.querySelector(".dashboard-main")).toHaveClass(
      "dashboard-main--wide",
    );
    expect(
      screen.queryByRole("link", { name: /configuracoes/i }),
    ).not.toBeInTheDocument();
  });
});


