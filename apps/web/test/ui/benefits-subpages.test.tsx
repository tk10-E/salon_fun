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
  saveSalonGrowthAutomationActionPath: "/__test/save-growth-automation",
  saveSalonLoyaltyProgramActionPath: "/__test/save-loyalty-program",
  saveSalonReferralProgramActionPath: "/__test/save-referral-program",
  updateSalonOfferActionPath: "/__test/update-offer",
}));

vi.mock("next/link", () => ({
  default: (props: { children?: ReactNode; href: string; className?: string }) =>
    createElement("a", { href: props.href, className: props.className }, props.children),
}));

vi.mock("@/app/actions", () => ({
  createSalonOfferAction: createSalonOfferActionPath,
  deleteSalonOfferAction: deleteSalonOfferActionPath,
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
  const actual = await vi.importActual<typeof import("@/app/dashboard/benefits/_lib")>("@/app/dashboard/benefits/_lib");

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
          price: 129.9,
          starts_on: "2026-03-20",
          ends_on: "2026-03-31",
          is_active: true,
          sort_order: 1,
        },
      ],
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
    expect(screen.getByRole("heading", { name: "Promoções e planos" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Promoções e planos publicados" })).toBeInTheDocument();
    expect(screen.getByLabelText("Buscar oferta")).toHaveValue("combo");
    expect(screen.getByRole("button", { name: "Filtrar ofertas" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Promoções" })).toBeInTheDocument();
    expect(screen.getAllByText("Combo de inverno").length).toBeGreaterThan(0);
    expect(screen.getByText(/Valor divulgado:\s*R\$\s*129,90/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar oferta" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover oferta" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Nova promoção ou plano" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Ex.: Plano mensal de corte e barba")).toBeInTheDocument();
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
    expect(screen.getByRole("heading", { name: "Fidelidade e ranking" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Clube de fidelidade e ranking" })).toBeInTheDocument();
    expect(screen.getByText("Clientes ranqueados")).toBeInTheDocument();
    expect(screen.getByText("Cashback gerado")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getByText(/R\$\s*32,50/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Programa de fidelidade" })).toBeInTheDocument();
    expect(screen.getByLabelText("Pontos por visita concluída")).toBeInTheDocument();
    expect(screen.getByLabelText("Cashback (%)")).toBeInTheDocument();
    expect(screen.getByLabelText("Serviço grátis no Ouro")).toHaveValue("service-1");
    expect(screen.getByRole("option", { name: /Hidratação premium/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar programa de fidelidade" })).toBeInTheDocument();
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

    expect(screen.getByText("Programa de indicação salvo.")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Programa de indicação" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Relatório de indicações" })).toBeInTheDocument();
    expect(screen.getByLabelText("Entrada pelo app a partir de")).toHaveValue("2026-03-01");
    expect(screen.getByRole("button", { name: "Filtrar relatório" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Limpar filtros" })).toBeInTheDocument();
    expect(screen.getByText("Recompensas liberadas")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Julia" })).toBeInTheDocument();
    expect(screen.getByText("Maria")).toBeInTheDocument();
    expect(screen.getByText("MARIA10")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Programa de indicação" }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Benefício para quem indicou")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar programa" })).toBeInTheDocument();
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
        winback_body_template: "Já faz {inactive_days} dias desde seu último atendimento.",
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
    expect(screen.getByRole("heading", { name: "Automações comerciais" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Automação comercial inteligente" })).toBeInTheDocument();
    expect(screen.getByText("Clientes em risco")).toBeInTheDocument();
    expect(screen.getByText("Rebooks prontos")).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Maria" }).length).toBeGreaterThan(0);
    expect(screen.getByText("Hora de reagendar")).toBeInTheDocument();
    expect(screen.getByText("Volte para o salão")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Automação de recuperação" })).toBeInTheDocument();
    expect(screen.getByLabelText("Inatividade para acionar")).toBeInTheDocument();
    expect(screen.getByLabelText("Título do push inteligente")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar automação" })).toBeInTheDocument();
  });
});
