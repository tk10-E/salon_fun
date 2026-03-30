// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSalonOfferActionMock,
  deleteSalonOfferActionMock,
  loadBenefitsOverviewDataMock,
  saveSalonGrowthAutomationActionMock,
  saveSalonLoyaltyProgramActionMock,
  saveSalonReferralProgramActionMock,
  updateSalonOfferActionMock,
} = vi.hoisted(() => ({
  createSalonOfferActionMock: vi.fn(),
  deleteSalonOfferActionMock: vi.fn(),
  loadBenefitsOverviewDataMock: vi.fn(),
  saveSalonGrowthAutomationActionMock: vi.fn(),
  saveSalonLoyaltyProgramActionMock: vi.fn(),
  saveSalonReferralProgramActionMock: vi.fn(),
  updateSalonOfferActionMock: vi.fn(),
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/app/actions", () => ({
  createSalonOfferAction: createSalonOfferActionMock,
  deleteSalonOfferAction: deleteSalonOfferActionMock,
  saveSalonGrowthAutomationAction: saveSalonGrowthAutomationActionMock,
  saveSalonLoyaltyProgramAction: saveSalonLoyaltyProgramActionMock,
  saveSalonReferralProgramAction: saveSalonReferralProgramActionMock,
  updateSalonOfferAction: updateSalonOfferActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/dashboard/benefits/_lib", async () => {
  const actual = await vi.importActual<typeof import("@/app/dashboard/benefits/_lib")>("@/app/dashboard/benefits/_lib");

  return {
    ...actual,
    loadBenefitsOverviewData: loadBenefitsOverviewDataMock,
  };
});

import BenefitsPage from "@/app/dashboard/benefits/page";

describe("benefits page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders commercial overview cards and navigation", async () => {
    loadBenefitsOverviewDataMock.mockResolvedValue({
      activeOffersCount: 4,
      activeMembershipsCount: 2,
      qualifiedReferralsCount: 6,
      pendingReferralsCount: 3,
      loyaltyProgram: {
        title: "Clube Studio",
        description: "Programa principal",
        points_per_visit: 10,
        cashback_percent: 5,
        tier_one_name: "Bronze",
        tier_one_min_visits: 3,
        tier_one_discount_percent: 5,
        tier_two_name: "Prata",
        tier_two_min_visits: 5,
        tier_two_discount_percent: 10,
        vip_tier_name: "VIP",
        vip_min_visits: 8,
        vip_discount_percent: 15,
        is_active: true,
        tiers: [],
      },
      loyaltyOverview: {
        ranked_customers: 18,
        vip_customers: 5,
        total_completed_visits: 120,
        total_points_earned: 850,
        total_cashback_earned: 320,
      },
      growthAutomationSettings: {
        is_active: true,
        winback_inactive_days: 30,
        winback_discount_percent: 10,
        winback_title: "Volte para o salão",
        winback_body_template: "Template",
        smart_rebook_is_active: true,
        smart_rebook_window_days: 4,
        smart_rebook_title: "Hora de reagendar",
        smart_rebook_body_template: "Template",
        updated_at: null,
      },
      growthAutomationOverview: {
        at_risk_customers: 8,
        due_now_customers: 4,
        smart_rebook_due_customers: 3,
        winbacks_sent_last_30d: 5,
        smart_rebooks_sent_last_30d: 7,
        recovered_customers_last_30d: 2,
      },
      referralProgram: {
        id: "ref-1",
        title: "Indique e ganhe",
        description: "Programa de indicação",
        reward_for_referrer: "15% OFF",
        reward_for_invited: "10% OFF",
        is_active: true,
        required_qualified_referrals: 1,
        reward_service_id: null,
        reward_service_name: null,
        updated_at: "2026-03-20T12:00:00.000Z",
      },
    });

    const ui = await BenefitsPage({
      searchParams: { message: "Painel comercial atualizado.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Painel comercial atualizado.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Comercial e retenção" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Visão geral" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Promoções" })).toBeInTheDocument();
    expect(screen.getByText("Ofertas ativas")).toBeInTheDocument();
    expect(screen.getByText("Clientes VIP")).toBeInTheDocument();
    expect(screen.getByText("Clientes em risco")).toBeInTheDocument();
    expect(screen.getByText("Indicações validadas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Promoções e planos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Fidelidade e ranking" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Indicações" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Rebook e recuperação" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir promoções" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir fidelidade" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir indicações" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir automações" })).toBeInTheDocument();
  });
});
