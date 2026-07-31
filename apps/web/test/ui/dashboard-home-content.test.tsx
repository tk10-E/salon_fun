// @vitest-environment jsdom

import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/link", () => ({
  default: (props: {
    children?: ReactNode;
    href: string;
    className?: string;
    [key: string]: unknown;
  }) => createElement("a", props, props.children),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    refresh: vi.fn(),
  }),
}));

vi.mock("@/app/actions", () => ({
  approveCustomerMembershipRequestAction: "/__test/approve-membership",
  markCustomerMembershipRequestPaidAction: "/__test/mark-membership-paid",
  updateCustomerProductOrderStatusAction: "/__test/update-order",
}));

vi.mock("@/app/_actions/management", () => ({
  updateManagementAppointmentStatusAction: "/__test/update-appointment",
}));

vi.mock("@/app/_actions/dashboard-birthdays", () => ({
  updateSalonBirthdayCampaignAction: "/__test/update-birthday",
  deleteSalonBirthdayCampaignAction: "/__test/delete-birthday",
}));

import {
  DashboardBirthdaysPageContent,
  DashboardHomeContent,
} from "@/app/dashboard/_components";
import type { DashboardHomeData } from "@/app/dashboard/_lib";

const sampleData: DashboardHomeData = {
  salonName: "Salon Fun",
  birthdays: {
    campaign: {
      isActive: true,
      mediaKind: "image",
      mediaUrl: "https://cdn.example.com/birthday.jpg",
      message: "Hoje o salão preparou um carinho especial para você.",
      title: "Feliz aniversário!",
    },
    items: [
      {
        birthDateLabel: "16 de abril",
        id: "customer-1",
        name: "Ana Souza",
        phone: "16999999999",
        turningAge: 32,
      },
    ],
    todayCount: 1,
    todayLabel: "1 aniversariante hoje",
  },
  signals: [],
  customerGrowth: {
    activeCustomersLast30d: 12,
    hasPreviousBaseline: true,
    monthlyDeltaLabel: "+10%",
    newCustomersThisMonth: 4,
    newCustomersToday: 1,
    series: [],
    totalCustomers: 28,
  },
  agenda: {
    dateLabel: "quarta-feira, 16 de abril",
    items: [],
  },
  finance: {
    averageTicketLabel: "R$ 120,00",
    monthCompletedAppointmentsCount: 8,
    monthRevenueLabel: "R$ 960,00",
    openTabsCount: 0,
    openTabsPendingLabel: "R$ 0,00",
    todayAppointmentsCount: 0,
    todayRevenueLabel: "R$ 0,00",
  },
  clientAppRequests: {
    pendingCount: 0,
    appointments: [],
    memberships: [],
    storeOrders: [],
  },
  vacancyRadar: {
    openCount: 0,
    items: [],
  },
  movementForecast: {
    focusServiceLabel: null,
    hasBaseline: false,
    lowWindowLabel: null,
    strongestDayLabel: null,
    strongestDayVolumeLabel: null,
    suggestions: [],
    summary: "Sem dados suficientes.",
    weakestDayLabel: null,
    weakestDayVolumeLabel: null,
  },
  smartFillCampaign: {
    available: false,
    candidateCount: 0,
    dayLabel: "quinta-feira, 15/05",
    headline: "Nenhuma vaga em destaque",
    highChanceCount: 0,
    openSlotsCount: 0,
    serviceName: "escova",
    staffName: "Carla",
    summary: "Sem campanha pronta agora.",
    topChanceLabel: "Baixa",
    windowLabel: "15:00 até 17:00",
  },
  copilot: {
    fillChanceLabel: "Baixa",
    insights: [],
    lastAnalysisLabel: "Última análise há 2 min",
    latestAnalysisQuestion: "Qual profissional tem mais horários livres hoje?",
    monitoringLabel: "Acompanhando agenda e ocupação",
    occupancyTomorrowLabel: "42%",
    operationalRiskLabel: "Médio",
    opportunityPrompt: "Crie uma promoção para quinta com baixo movimento.",
    statusLabel: "Resumo automático ativo",
    statusSummary:
      "Amanhã pede atenção: ocupação em 42% e 2 confirmações pendentes.",
  },
  attentionItems: [],
};

describe("DashboardHomeContent", () => {
  it("renders the simpler dashboard home focused on agenda, caixa and atendimento", () => {
    render(<DashboardHomeContent data={sampleData} />);

    expect(
      screen.getByRole("heading", { name: "Tudo do salão em uma tela" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Nenhum horário confirmado hoje. Vale reforçar a agenda."),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Novas clientes no mês" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Comandas em aberto" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Horários vazios hoje" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "O que fazer agora" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Finanças do salão" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Agenda do dia" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Pedidos do aplicativo" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "O que merece atenção hoje" }),
    ).toBeInTheDocument();
    expect(
      screen.queryByText("Mensagem de aniversário no app"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: "Assistente do painel" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /vagas para preencher/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("heading", { name: /movimento previsto/i }),
    ).not.toBeInTheDocument();
  });

  it("renders the dedicated birthday page with composer, delete action and today's customers", () => {
    render(<DashboardBirthdaysPageContent birthdays={sampleData.birthdays} />);

    expect(
      screen.getByRole("heading", { name: /aniversários do salão/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /salvar mensagem de aniversário/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /excluir mensagem/i }),
    ).toBeInTheDocument();
    expect(screen.getByText("Aniversariantes do dia")).toBeInTheDocument();
    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.getByText("Faz 32 anos")).toBeInTheDocument();
  });
});
