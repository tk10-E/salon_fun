// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createSalonOfferActionPath,
  deleteSalonOfferActionPath,
  loadGrowthAutomationPageDataMock,
  loadLoyaltyPageDataMock,
  loadPromotionsPageDataMock,
  loadReferralsPageDataMock,
  markReferralRewardRedeemedActionPath,
  saveSalonGrowthAutomationActionPath,
  saveSalonLoyaltyProgramActionPath,
  saveSalonReferralProgramActionPath,
  updateSalonOfferActionPath,
} = vi.hoisted(() => ({
  createSalonOfferActionPath: "/__test/create-offer",
  deleteSalonOfferActionPath: "/__test/delete-offer",
  loadGrowthAutomationPageDataMock: vi.fn(),
  loadLoyaltyPageDataMock: vi.fn(),
  loadPromotionsPageDataMock: vi.fn(),
  loadReferralsPageDataMock: vi.fn(),
  markReferralRewardRedeemedActionPath: "/__test/redeem-referral-reward",
  saveSalonGrowthAutomationActionPath: "/__test/save-growth-automation",
  saveSalonLoyaltyProgramActionPath: "/__test/save-loyalty-program",
  saveSalonReferralProgramActionPath: "/__test/save-referral-program",
  updateSalonOfferActionPath: "/__test/update-offer",
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
  createSalonOfferAction: createSalonOfferActionPath,
  deleteSalonOfferAction: deleteSalonOfferActionPath,
  markReferralRewardRedeemedAction: markReferralRewardRedeemedActionPath,
  saveSalonGrowthAutomationAction: saveSalonGrowthAutomationActionPath,
  saveSalonLoyaltyProgramAction: saveSalonLoyaltyProgramActionPath,
  saveSalonReferralProgramAction: saveSalonReferralProgramActionPath,
  updateSalonOfferAction: updateSalonOfferActionPath,
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
    loadGrowthAutomationPageData: loadGrowthAutomationPageDataMock,
    loadLoyaltyPageData: loadLoyaltyPageDataMock,
    loadPromotionsPageData: loadPromotionsPageDataMock,
    loadReferralsPageData: loadReferralsPageDataMock,
  };
});

import AutomationsPage from "@/app/dashboard/benefits/automations/page";
import LoyaltyPage from "@/app/dashboard/benefits/loyalty/page";
import PromotionsPage from "@/app/dashboard/benefits/promotions/page";
import ReferralsPage from "@/app/dashboard/benefits/referrals/page";

describe("benefits subpages UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders promotions catalog, filters and creation panel", async () => {
    loadPromotionsPageDataMock.mockResolvedValue({
      activeOffersCount: 2,
      activeMembershipsCount: 1,
      groupedOffers: {
        Promoções: [
          {
            id: "offer-1",
            kind: "promotion",
            title: "Combo de inverno",
            description: "Corte com hidratação",
            highlight_text: "Cabelo completo da semana",
            membership_service_id: null,
            membership_sessions_included: null,
            membership_validity_days: null,
            price: 129.9,
            starts_on: "2026-03-20",
            ends_on: "2026-03-31",
            is_active: true,
            sort_order: 1,
          },
        ],
      },
      hasOfferFilters: true,
      offerKindFilter: "promotion",
      offerQuery: "combo",
      offerStateFilter: "active",
      offers: [
        {
          id: "offer-1",
          kind: "promotion",
          title: "Combo de inverno",
          description: "Corte com hidratação",
          highlight_text: "Cabelo completo da semana",
          membership_service_id: null,
          membership_sessions_included: null,
          membership_validity_days: null,
          price: 129.9,
          starts_on: "2026-03-20",
          ends_on: "2026-03-31",
          is_active: true,
          sort_order: 1,
        },
      ],
      serviceOptions: [],
      today: "2026-03-22",
    });

    const ui = await PromotionsPage({
      searchParams: {
        message: "Oferta salva com sucesso.",
        tone: "success",
        offerKind: "promotion",
        offerQ: "combo",
        offerState: "active",
      },
    });

    render(ui);

    expect(screen.getByText("Oferta salva com sucesso.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Promoções para o app do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Nova oferta",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Ofertas cadastradas" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Voltar para campanhas" }),
    ).toHaveAttribute("href", "/dashboard/benefits");
    expect(screen.getByLabelText("Buscar")).toHaveValue("combo");
    expect(
      screen.getByRole("button", { name: "Filtrar" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: "Limpar" }),
    ).toHaveAttribute("href", "/dashboard/benefits/promotions");
    expect(screen.getByDisplayValue("Combo de inverno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("129.9")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Cabelo completo da semana"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Remover" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ex.: Pacote corte + barba"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Publicar oferta" }),
    ).toBeInTheDocument();
  });

  it("renders activation guidance when no promotions exist yet", async () => {
    loadPromotionsPageDataMock.mockResolvedValue({
      activeOffersCount: 0,
      activeMembershipsCount: 0,
      groupedOffers: {},
      hasOfferFilters: false,
      offerKindFilter: "",
      offerQuery: "",
      offerStateFilter: "",
      offers: [],
      serviceOptions: [],
      today: "2026-03-22",
    });

    const ui = await PromotionsPage({});

    render(ui);

    expect(screen.getByText("Sem ofertas")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Crie a primeira oferta para aparecer no app",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Use o formulário acima para publicar rapidamente."),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar oferta" })).toBeInTheDocument();
  });

  it("renders loyalty overview, leaderboard and loyalty program form", async () => {
    loadLoyaltyPageDataMock.mockResolvedValue({
      loyaltyOverview: {
        ranked_customers: 18,
        vip_customers: 5,
        total_completed_visits: 120,
        total_points_earned: 850,
        total_cashback_earned: 320,
      },
      loyaltyProgram: {
        title: "Clube Studio",
        description: "Pontue a cada visita.",
        points_per_visit: 10,
        cashback_percent: 5,
        tier_one_name: "Bronze",
        tier_one_min_visits: 3,
        tier_one_discount_percent: 5,
        tier_two_name: "Prata",
        tier_two_min_visits: 6,
        tier_two_discount_percent: 10,
        vip_tier_name: "Ouro",
        vip_min_visits: 10,
        vip_discount_percent: 15,
        vip_reward_service_id: "service-1",
        vip_reward_service_name: "Hidratação premium",
        is_active: true,
        tiers: [],
      },
      loyaltyLeaderboard: [
        {
          customer_id: "customer-1",
          customer_name: "Maria",
          rank_position: 1,
          points_balance: 120,
          total_points_earned: 240,
          cashback_balance: 32.5,
          total_cashback_earned: 70,
          completed_visits: 8,
          current_tier: {
            label: "VIP",
            min_visits: 10,
            discount_percent: 15,
            is_vip: true,
          },
          last_reward_at: "2026-03-21T15:00:00.000Z",
        },
      ],
      serviceOptions: [
        {
          id: "service-1",
          name: "Hidratação premium",
          category: "Tratamentos",
        },
      ],
    });

    const ui = await LoyaltyPage({
      searchParams: { message: "Programa salvo.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Programa salvo.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Fidelidade com pontos e cashback",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Resumo rápido" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Clube Studio")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*32,50/)).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Regras do programa" }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText("Pontos por visita")).toBeInTheDocument();
    expect(screen.getByLabelText("Cashback (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Recompensa VIP (opcional)")).toHaveValue(
      "service-1",
    );
    expect(
      screen.getByRole("option", { name: /Hidratação premium/ }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar programa" }),
    ).toBeInTheDocument();
  });

  it("renders referrals report, metrics and referral program form", async () => {
    loadReferralsPageDataMock.mockResolvedValue({
      availableRewardUnlocksCount: 1,
      hasReferralFilters: true,
      pendingCountInPeriod: 2,
      periodQualifiedCount: 4,
      referralEvents: [
        {
          id: "event-1",
          created_at: "2026-03-10T12:00:00.000Z",
          invited_name: "Julia",
          qualified_at: "2026-03-18T12:00:00.000Z",
          referrer_name: "Maria",
          status: "qualified",
          used_referral_code: "MARIA10",
        },
      ],
      referralEventsBaseCount: 6,
      referralFrom: "2026-03-01",
      referralProgram: {
        id: "ref-1",
        title: "Indique e ganhe",
        description: "Convide uma amiga e ganhe bônus.",
        reward_for_referrer: "1 escova bônus",
        reward_for_invited: "10% OFF na primeira visita",
        is_active: true,
        required_qualified_referrals: 5,
        reward_service_id: "service-1",
        reward_service_name: "Escova modelada",
        updated_at: "2026-03-20T15:00:00.000Z",
      },
      rewardUnlocks: [
        {
          id: "unlock-1",
          customerName: "Maria",
          rewardDescription: "1 escova bônus",
          rewardServiceName: "Escova modelada",
          thresholdReached: 5,
          requiredQualifiedReferrals: 5,
          unlockedAt: "2026-03-20T15:00:00.000Z",
          redeemedAt: null,
          status: "available",
        },
      ],
      rewardUnlocksCount: 2,
      referralStatusFilter: "qualified",
      referralTo: "2026-03-31",
      serviceOptions: [
        { id: "service-1", name: "Escova modelada", category: "Cabelo" },
      ],
    });

    const ui = await ReferralsPage({
      searchParams: {
        message: "Programa de indicação salvo.",
        tone: "success",
        referralStatus: "qualified",
        referralFrom: "2026-03-01",
        referralTo: "2026-03-31",
      },
    });

    render(ui);

    expect(
      screen.getByText("Programa de indicação salvo."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Programa de indicações do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Entradas recentes" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recompensas liberadas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Julia" }).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Maria" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText(/MARIA10/).length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Regra do programa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Benefício para quem indicou"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Salvar programa" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como entregue" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Última validação" }),
    ).toBeInTheDocument();
  });

  it("renders automation overview, recent runs and automation settings form", async () => {
    loadGrowthAutomationPageDataMock.mockResolvedValue({
      growthAutomationOverview: {
        at_risk_customers: 8,
        due_now_customers: 3,
        smart_rebook_due_customers: 5,
        winbacks_sent_last_30d: 4,
        smart_rebooks_sent_last_30d: 7,
        recovered_customers_last_30d: 2,
      },
      growthAutomationRecentRuns: [
        {
          id: "run-1",
          automation_type: "smart_rebook_prompt",
          customer_id: "customer-1",
          customer_name: "Maria",
          notification_id: "notification-1",
          sent_at: "2026-03-20T14:00:00.000Z",
          inactive_days: 0,
          discount_percent: 0,
          service_name: "Escova modelada",
          target_weekday: "sexta-feira",
          target_period: "à tarde",
          title: "Hora de reagendar",
          body: "Seu melhor horário está chegando.",
          recovered: true,
          recovered_appointment_at: "2026-03-21T12:00:00.000Z",
        },
      ],
      growthAutomationSettings: {
        is_active: true,
        winback_inactive_days: 30,
        winback_discount_percent: 10,
        winback_title: "Volte para o salão",
        winback_body_template:
          "Já faz {inactive_days} dias desde seu último atendimento.",
        smart_rebook_is_active: true,
        smart_rebook_window_days: 4,
        smart_rebook_title: "Hora de reagendar",
        smart_rebook_body_template: "Seu próximo melhor horário está perto.",
        updated_at: "2026-03-20T10:00:00.000Z",
      },
    });

    const ui = await AutomationsPage({
      searchParams: { message: "Automação salva.", tone: "success" },
    });

    render(ui);

    expect(screen.getByText("Automação salva.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Retenção automática da base",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Configuração rápida" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Últimos disparos" }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole("heading", { name: "Maria" }).length,
    ).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Hora de reagendar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Volte para o salão")).toBeInTheDocument();
    expect(
      screen.getByLabelText("Inatividade (dias)"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("Título do lembrete"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        element?.textContent?.includes("Voltou a agendar") ?? false,
      ).length,
    ).toBeGreaterThan(0);
    expect(
      screen.getByRole("button", { name: "Salvar automação" }),
    ).toBeInTheDocument();
  });
});
