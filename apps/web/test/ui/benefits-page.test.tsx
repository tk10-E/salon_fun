// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSalonOfferActionMock,
  deleteSalonOfferActionMock,
  loadBenefitsOverviewDataMock,
  markReferralRewardRedeemedActionPath,
  saveSalonGrowthAutomationActionMock,
  saveSalonLoyaltyProgramActionMock,
  saveSalonReferralProgramActionMock,
  sendMarketingCustomerCampaignActionPath,
  updateSalonOfferActionMock,
} = vi.hoisted(() => ({
  createSalonOfferActionMock: vi.fn(),
  deleteSalonOfferActionMock: vi.fn(),
  loadBenefitsOverviewDataMock: vi.fn(),
  markReferralRewardRedeemedActionPath: "/__test/redeem-referral-reward",
  saveSalonGrowthAutomationActionMock: vi.fn(),
  saveSalonLoyaltyProgramActionMock: vi.fn(),
  saveSalonReferralProgramActionMock: vi.fn(),
  sendMarketingCustomerCampaignActionPath: "/__test/send-marketing",
  updateSalonOfferActionMock: vi.fn(),
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
  createSalonOfferAction: createSalonOfferActionMock,
  deleteSalonOfferAction: deleteSalonOfferActionMock,
  markReferralRewardRedeemedAction: markReferralRewardRedeemedActionPath,
  saveSalonGrowthAutomationAction: saveSalonGrowthAutomationActionMock,
  saveSalonLoyaltyProgramAction: saveSalonLoyaltyProgramActionMock,
  saveSalonReferralProgramAction: saveSalonReferralProgramActionMock,
  sendMarketingCustomerCampaignAction: sendMarketingCustomerCampaignActionPath,
  updateSalonOfferAction: updateSalonOfferActionMock,
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(),
}));

vi.mock("@/app/dashboard/benefits/_lib", async () => {
  const actual = await vi.importActual<
    typeof import("@/app/dashboard/benefits/_lib")
  >("@/app/dashboard/benefits/_lib");

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
      availableReferralRewardUnlocksCount: 2,
      birthdayCustomers: [
        {
          birth_date: "1990-04-14",
          birth_day: 14,
          customer_id: "customer-1",
          name: "Maria Souza",
          phone: "11988880001",
        },
      ],
      birthdaysThisMonth: 2,
      customersWithBirthDate: 6,
      expiringMemberships: [
        {
          customerId: "customer-1",
          customerName: "Maria Souza",
          expiresAt: "2026-04-10",
          membershipId: "membership-1",
          sessionsRemaining: 2,
          title: "Glow Club",
        },
      ],
      qualifiedReferralsCount: 6,
      pendingReferralsCount: 3,
      inactiveCustomers: [
        {
          customer_id: "customer-2",
          inactive_days: 43,
          last_service_name: "Coloração",
          last_visit_at: "2026-02-21T13:00:00.000Z",
          name: "Lucas Martins",
          phone: "11988880002",
        },
      ],
      inactiveThresholdDays: 30,
      inactiveTotal: 4,
      loyaltyTierDistribution: [
        {
          customer_count: 2,
          is_vip: false,
          label: "Bronze",
          min_visits: 0,
        },
        {
          customer_count: 2,
          is_vip: false,
          label: "Prata",
          min_visits: 3,
        },
        {
          customer_count: 2,
          is_vip: false,
          label: "Ouro",
          min_visits: 5,
        },
        {
          customer_count: 1,
          is_vip: true,
          label: "Diamante",
          min_visits: 8,
        },
      ],
      marketingIdeas: [
        {
          href: "#benefits-birthdays",
          id: "birthday-campaign",
          label: "Aniversário do mês",
          note: "2 clientes fazem aniversário neste mês.",
          title: "Dispare uma ação de aniversário no app",
          tone: "warm",
        },
      ],
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
      redeemedReferralRewardUnlocksCount: 1,
      rewardUnlocks: [
        {
          customerId: "customer-1",
          customerName: "Maria Souza",
          id: "unlock-1",
          redeemedAt: null,
          requiredQualifiedReferrals: 1,
          rewardDescription: "Escova modelada grátis",
          rewardServiceName: "Escova modelada",
          status: "available",
          thresholdReached: 1,
          unlockedAt: "2026-04-01T10:00:00.000Z",
        },
      ],
      walletHighlights: [
        {
          activeMembershipExpiresAt: "2026-04-10",
          activeMembershipTitle: "Glow Club",
          availableReferralRewards: 1,
          cashbackBalance: 42.5,
          completedVisits: 8,
          customerId: "customer-1",
          membershipSessionsRemaining: 2,
          name: "Maria Souza",
          pointsBalance: 120,
          referralCode: "MARIA10",
          tierLabel: "VIP",
        },
      ],
      walletSnapshot: {
        activeMembershipCustomers: 1,
        activeMemberships: 1,
        availableReferralRewards: 2,
        cashbackCustomers: 3,
        cashbackGenerated: 320,
        expiringMemberships: 1,
        redeemedReferralRewards: 1,
        sessionsRemaining: 4,
      },
    });

    const ui = await BenefitsPage({
      searchParams: Promise.resolve({
        message: "Painel comercial atualizado.",
        tone: "success",
      }),
    });

    render(ui);

    expect(
      screen.getByText("Painel comercial atualizado."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Campanhas, fidelidade e retorno da base",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Campanhas rápidas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Carteira do cliente agora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pacotes perto do fim" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recompensas prontas para entrega" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Aniversários do mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Clientes inativas/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Oportunidades do momento" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Maria Souza").length).toBeGreaterThan(0);
    expect(screen.getByText("Lucas Martins")).toBeInTheDocument();
    expect(screen.getByText("Escova modelada grátis")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Enviar no app" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Reativar no app" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar entregue" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir CRM" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Abrir pacotes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Renovar pelo CRM" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Promoções e planos" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Indicações" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Retorno automático" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("link", { name: "Abrir promoções" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Abrir fidelidade" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Abrir indicações" }).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getAllByRole("link", { name: "Abrir automações" }).length,
    ).toBeGreaterThan(0);
  });
});
