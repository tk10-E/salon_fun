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

  it("renders the redesigned promotions workspace with compose hidden by default", async () => {
    loadPromotionsPageDataMock.mockResolvedValue({
      activeOffersCount: 2,
      activeMembershipsCount: 1,
      featuredOffer: {
        id: "offer-1",
        kind: "promotion",
        title: "Combo de inverno",
        description: "Corte com hidratacao",
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
      groupedOffers: {
        Promocoes: [
          {
            id: "offer-1",
            kind: "promotion",
            title: "Combo de inverno",
            description: "Corte com hidratacao",
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
      lifecycleCounts: {
        active: 2,
        expired: 0,
        paused: 0,
        scheduled: 1,
      },
      offerKindFilter: "promotion",
      offerQuery: "combo",
      offerStateFilter: "active",
      offers: [
        {
          id: "offer-1",
          kind: "promotion",
          title: "Combo de inverno",
          description: "Corte com hidratacao",
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
      scheduledOffers: [],
      serviceOptions: [],
      today: "2026-03-22",
    });

    const ui = await PromotionsPage({
      searchParams: Promise.resolve({
        message: "Oferta salva com sucesso.",
        tone: "success",
        offerKind: "promotion",
        offerQ: "combo",
        offerState: "active",
      }),
    });

    render(ui);

    expect(screen.getByText("Oferta salva com sucesso.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Campanhas do app" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Campanhas no app" }),
    ).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("combo").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Filtrar" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Nova campanha" }).getAttribute("href")).toContain(
      "compose=1",
    );
    expect(screen.getByDisplayValue("Combo de inverno")).toBeInTheDocument();
    expect(screen.getByDisplayValue("129.9")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Cabelo completo da semana"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remover" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publicar oferta" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Publicar campanha" }),
    ).not.toBeInTheDocument();
  });

  it("opens the promotions compose panel and empty state when compose=1", async () => {
    loadPromotionsPageDataMock.mockResolvedValue({
      activeOffersCount: 0,
      activeMembershipsCount: 0,
      featuredOffer: null,
      groupedOffers: {},
      hasOfferFilters: false,
      lifecycleCounts: {
        active: 0,
        expired: 0,
        paused: 0,
        scheduled: 0,
      },
      offerKindFilter: "",
      offerQuery: "",
      offerStateFilter: "",
      offers: [],
      scheduledOffers: [],
      serviceOptions: [],
      today: "2026-03-22",
    });

    const ui = await PromotionsPage({
      searchParams: Promise.resolve({
        compose: "1",
      }),
    });

    render(ui);

    expect(screen.getByText("Sem ofertas")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Crie a primeira campanha do app",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Criar campanha" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Assistente de IA")).toBeInTheDocument();
    expect(screen.getByText("Objetivo da campanha")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Preencher oferta com IA" }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Ex.: Pacote corte + barba"),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Publicar campanha" })).toBeInTheDocument();
  });

  it("opens the promotions composer with AI prefill from the panel assistant", async () => {
    loadPromotionsPageDataMock.mockResolvedValue({
      activeOffersCount: 0,
      activeMembershipsCount: 0,
      featuredOffer: null,
      groupedOffers: {},
      hasOfferFilters: false,
      lifecycleCounts: {
        active: 0,
        expired: 0,
        paused: 0,
        scheduled: 0,
      },
      offerKindFilter: "",
      offerQuery: "",
      offerStateFilter: "",
      offers: [],
      scheduledOffers: [],
      serviceOptions: [
        {
          id: "service-1",
          name: "Escova modelada",
          category: "Cabelo",
        },
      ],
      today: "2026-03-22",
    });

    const ui = await PromotionsPage({
      searchParams: Promise.resolve({
        aiGoal: "reativar clientes parados",
        aiNotes: "Traga urgencia leve e convide para reservar hoje.",
        compose: "1",
        prefillDescription: "Oferta pensada para trazer clientes de volta nesta semana.",
        prefillHighlight: "Retorne esta semana com valor especial",
        prefillKind: "promotion",
        prefillPrice: "89.90",
        prefillServiceId: "service-1",
        prefillTitle: "Campanha de retorno",
      }),
    });

    render(ui);

    expect(
      (screen.getByLabelText("Objetivo da campanha") as HTMLSelectElement).value,
    ).toBe("reativar clientes parados");
    expect(
      screen.getByDisplayValue(
        "Traga urgencia leve e convide para reservar hoje.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByDisplayValue("Campanha de retorno")).toBeInTheDocument();
    expect(
      screen.getByDisplayValue("Retorne esta semana com valor especial"),
    ).toBeInTheDocument();
    expect(
      screen.getByDisplayValue(
        "Oferta pensada para trazer clientes de volta nesta semana.",
      ),
    ).toBeInTheDocument();
    expect((screen.getByLabelText("Valor divulgado") as HTMLInputElement).value).toBe(
      "89.90",
    );
    expect(
      (screen.getByLabelText("ServiÃ§o (opcional)") as HTMLSelectElement).value,
    ).toBe("service-1");
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
        vip_reward_service_name: "Hidratacao premium",
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
          name: "Hidratacao premium",
          category: "Tratamentos",
        },
      ],
    });

    const ui = await LoyaltyPage({
      searchParams: Promise.resolve({ message: "Programa salvo.", tone: "success" }),
    });

    render(ui);

    expect(screen.getByText("Programa salvo.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Fidelidade com pontos e cashback",
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Resumo r/i })).toBeInTheDocument();
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
      screen.getByRole("option", { name: /Hidratacao premium/ }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar programa" })).toBeInTheDocument();
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
        description: "Convide uma amiga e ganhe bonus.",
        reward_for_referrer: "1 escova bonus",
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
          rewardDescription: "1 escova bonus",
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
      searchParams: Promise.resolve({
        message: "Programa de indicacao salvo.",
        tone: "success",
        referralStatus: "qualified",
        referralFrom: "2026-03-01",
        referralTo: "2026-03-31",
      }),
    });

    render(ui);

    expect(screen.getByText("Programa de indicacao salvo.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /Programa de indica/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Entradas recentes" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Recompensas liberadas" }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Julia" }).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: "Maria" })).toBeInTheDocument();
    expect(screen.getAllByText(/MARIA10/).length).toBeGreaterThan(0);
    expect(screen.getByRole("heading", { name: /Regra do programa/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Benef.cio para quem indicou/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar programa" })).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Marcar como entregue" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /ltima valida/i })).toBeInTheDocument();
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
          target_period: "a tarde",
          title: "Hora de reagendar",
          body: "Seu melhor horario esta chegando.",
          recovered: true,
          recovered_appointment_at: "2026-03-21T12:00:00.000Z",
        },
      ],
      growthAutomationSettings: {
        is_active: true,
        winback_inactive_days: 30,
        winback_discount_percent: 10,
        winback_title: "Volte para o salao",
        winback_body_template:
          "Ja faz {inactive_days} dias desde seu ultimo atendimento.",
        smart_rebook_is_active: true,
        smart_rebook_window_days: 4,
        smart_rebook_title: "Hora de reagendar",
        smart_rebook_body_template: "Seu proximo melhor horario esta perto.",
        updated_at: "2026-03-20T10:00:00.000Z",
      },
    });

    const ui = await AutomationsPage({
      searchParams: Promise.resolve({ message: "Automacao salva.", tone: "success" }),
    });

    render(ui);

    expect(screen.getByText("Automacao salva.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Retenção automática da base",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Configuração rápida" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Últimos disparos" })).toBeInTheDocument();
    expect(screen.getAllByRole("heading", { name: "Maria" }).length).toBeGreaterThan(0);
    expect(screen.getByDisplayValue("Hora de reagendar")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Volte para o salao")).toBeInTheDocument();
    expect(screen.getByLabelText("Inatividade (dias)")).toBeInTheDocument();
    expect(screen.getByLabelText("Título do lembrete")).toBeInTheDocument();
    expect(
      screen.getAllByText((_, element) =>
        element?.textContent?.includes("Voltou a agendar") ?? false,
      ).length,
    ).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Salvar automação" })).toBeInTheDocument();
  });
});






