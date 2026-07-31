// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  loadFinancePageDataMock,
  loadManagementPaymentsMock,
  requireOwnerSalonMock,
} = vi.hoisted(() => ({
  loadFinancePageDataMock: vi.fn(),
  loadManagementPaymentsMock: vi.fn(),
  requireOwnerSalonMock: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireOwnerSalon: requireOwnerSalonMock,
}));

vi.mock("@/app/_actions/management", () => ({
  deleteManagementPaymentAction: "/actions/management/delete-payment",
  upsertManagementPaymentAction: "/actions/management/upsert-payment",
}));

vi.mock("@/app/dashboard/finance/_lib", () => ({
  loadFinancePageData: loadFinancePageDataMock,
}));

vi.mock("@/lib/management", () => ({
  PAYMENT_METHOD_OPTIONS: [
    { value: "pix", label: "Pix" },
    { value: "cash", label: "Dinheiro" },
    { value: "debit_card", label: "Cartão de débito" },
    { value: "credit_card", label: "Cartão de crédito" },
  ],
  buildFilterHref: vi.fn(
    () => "/dashboard/gestao/pagamentos?dateFrom=2026-04-08&dateTo=2026-04-08",
  ),
  formatAppointmentPaymentPreferenceLabel: vi.fn((value: string) => {
    const labels: Record<string, string> = {
      cash: "Dinheiro",
      credit_card: "CartÃ£o de crÃ©dito",
      debit_card: "CartÃ£o de dÃ©bito",
      pix: "Pix",
      to_be_defined: "Decidir no salÃ£o",
    };

    return labels[value] ?? value;
  }),
  formatDateTimeLabel: vi.fn((value: string) => value.slice(0, 16)),
  formatPaymentMethodLabel: vi.fn((value: string) => {
    const labels: Record<string, string> = {
      cash: "Dinheiro",
      credit_card: "Cartão de crédito",
      debit_card: "Cartão de débito",
      pix: "Pix",
    };

    return labels[value] ?? value;
  }),
  formatTimeInput: vi.fn(() => "14:30"),
  getLocalDateKey: vi.fn(() => "2026-04-08"),
  loadManagementPayments: loadManagementPaymentsMock,
}));

import PagamentosPage from "@/app/dashboard/gestao/pagamentos/page";

describe("management payments page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    requireOwnerSalonMock.mockResolvedValue({
      salon: {
        id: "salon-1",
        timezone: "America/Sao_Paulo",
      },
    });

    loadManagementPaymentsMock.mockResolvedValue({
      items: [
        {
          amount: 210,
          amountNumber: 210,
          appointment_id: "appointment-1",
          customerName: "Ana Paula",
          id: "payment-1",
          notes: "Entrada do dia.",
          paid_at: "2026-04-08T14:00:00.000Z",
          payment_method: "pix",
          professionalName: "Camila",
          serviceName: "Corte feminino",
        },
        {
          amount: 200,
          amountNumber: 200,
          appointment_id: "appointment-2",
          customerName: "Bruna Costa",
          id: "payment-2",
          notes: null,
          paid_at: "2026-04-08T15:00:00.000Z",
          payment_method: "cash",
          professionalName: "Ricardo",
          serviceName: "Escova premium",
        },
      ],
      summary: {
        byMethod: {
          cash: 80,
          credit_card: 60,
          debit_card: 60,
          pix: 210,
        },
        totalReceived: 410,
      },
      unpaidAppointments: [
        {
          amount: 210,
          completedAt: "2026-04-08T13:55:00.000Z",
          customerName: "Ana Paula",
          id: "appointment-1",
          label: "Ana Paula",
          paymentPreference: "pix",
          professionalName: "Camila",
          secondary: "Corte feminino",
          serviceName: "Corte feminino",
        },
      ],
    });

    loadFinancePageDataMock.mockResolvedValue({
      cashRegister: {
        recentSessions: [],
        today: {
          differenceAmount: null,
          expectedBalance: 410,
          expenseAmount: 0,
          incomeAmount: 410,
          isOpen: true,
          openingAmount: 0,
          reportedAmount: null,
          sessionDate: "2026-04-08",
          sessionId: "cash-1",
          statusLabel: "Caixa aberto",
        },
      },
      currentMonth: {
        appointmentMethodComparison: {
          actualTotal: 410,
          forecastTotal: 590,
          items: [],
        },
        cashProfit: 410,
        commissionPendingPayout: 0,
        expense: 0,
        operationalIncome: 590,
        pendingCompletedServicesAmount: 0,
        pendingCompletedServicesCount: 0,
        projectedCommissions: 0,
        projectedNet: 410,
        realizedIncome: 410,
        teamPayoutsPaid: 0,
      },
      monthBuckets: [],
      payables: {
        dueAmount: 0,
        dueCount: 0,
        items: [],
      },
      receivablesDashboard: {
        alerts: [
          {
            description: "Sem pendências críticas agora.",
            id: "healthy",
            title: "Leitura financeira está estável",
            tone: "success",
          },
        ],
        cashHealth: {
          availableBalance: 410,
          forecastToday: 410,
          upcomingAmount: 180,
        },
        focusDateKey: "2026-04-08",
        focusDateLabel: "8 de abril de 2026",
        methodBreakdown: {
          items: [
            { amount: 210, key: "pix", label: "Pix", share: 51 },
            { amount: 120, key: "cards", label: "Cartões", share: 29 },
            { amount: 80, key: "cash", label: "Dinheiro", share: 20 },
          ],
          totalAmount: 410,
        },
        rangeDays: 14,
        recent: {
          items: [
            {
              amount: 210,
              avatarUrl: null,
              id: "recent-1",
              occurredAt: "2026-04-08T14:00:00.000Z",
              occurredLabel: "08/04/2026 14:00",
              paymentMethodLabel: "Pix",
              sourceLabel: "Atendimento",
              subtitle: "Ana Paula - Pix",
              title: "Corte feminino",
            },
          ],
        },
        todaySummary: {
          averageTicket: 205,
          averageTicketDeltaPercent: 10,
          methods: [
            { amount: 210, count: 1, deltaPercent: 12, key: "pix", label: "Pix" },
            {
              amount: 120,
              count: 1,
              deltaPercent: 4,
              key: "cards",
              label: "Cartões",
            },
            {
              amount: 80,
              count: 1,
              deltaPercent: -8,
              key: "cash",
              label: "Dinheiro",
            },
          ],
          totalCount: 2,
          totalDeltaPercent: 18,
          totalReceived: 410,
        },
        trend: {
          actualPoints: [
            { cumulative: 120, daily: 120, key: "2026-04-01", label: "01/04" },
            { cumulative: 410, daily: 290, key: "2026-04-08", label: "08/04" },
          ],
          actualTotal: 410,
          conversionRate: 69,
          potentialTotal: 590,
          projectedPoints: [
            { cumulative: 590, daily: 180, key: "2026-04-09", label: "09/04" },
          ],
          upcomingTotal: 180,
        },
        upcoming: {
          items: [
            {
              amount: 180,
              customerAvatarUrl: null,
              customerName: "Marina",
              dateKey: "2026-04-09",
              dayLabel: "09 ABR",
              id: "upcoming-1",
              paymentPreferenceLabel: "Pix",
              serviceName: "Coloração",
              status: "confirmed",
            },
          ],
          totalAmount: 180,
        },
      },
      recurringExpenses: {
        activeCount: 0,
        dueAmount: 0,
        dueCount: 0,
        items: [],
      },
      staffOptions: [],
      teamPayouts: {
        items: [],
      },
      timelineEntries: [],
    });
  });

  it("renders the receipts dashboard without changing payment actions", async () => {
    const ui = await PagamentosPage({
      searchParams: Promise.resolve({
        dateFrom: "2026-04-08",
        dateTo: "2026-04-08",
        message: "Pagamento salvo.",
        paymentMethod: "pix",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Pagamento salvo.")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        name: "Caixa do salao",
      }),
    ).toBeInTheDocument();
    expect(screen.getByText("Entrou no filtro")).toBeInTheDocument();
    expect(screen.getByText("Ticket medio")).toBeInTheDocument();
    expect(screen.getByText("Pendentes para baixar")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Novo recebimento" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Filtro do caixa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Movimentacoes do caixa" })).toBeInTheDocument();
    expect(screen.getAllByText("Ana Paula").length).toBeGreaterThan(0);
    expect(
      screen.queryByRole("heading", { name: "Novo recebimento" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Salvar pagamento" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getAllByRole("button", { name: "Remover pagamento" }).length,
    ).toBeGreaterThan(0);
  });

  it("opens the receipt form when compose is enabled", async () => {
    const ui = await PagamentosPage({
      searchParams: Promise.resolve({
        appointmentId: "appointment-1",
        compose: "1",
        dateFrom: "2026-04-08",
        dateTo: "2026-04-08",
      }),
    });

    render(ui);

    expect(screen.getByRole("heading", { name: "Novo recebimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar pagamento" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fechar" })).toBeInTheDocument();
    expect(screen.getByDisplayValue("210.00")).toBeInTheDocument();
    expect(screen.getByText(/Valor oficial R\$ 210,00\./)).toBeInTheDocument();
  });
});


