// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  closeCashSessionActionPath,
  createPayableActionPath,
  createRecurringExpenseRuleActionPath,
  createSalonFinancialTransactionActionPath,
  createTeamPayoutActionPath,
  loadFinancePageDataMock,
  openCashSessionActionPath,
  recordRecurringExpensePostingActionPath,
  settlePayableActionPath,
  toggleRecurringExpenseRuleActionPath,
} = vi.hoisted(() => ({
  closeCashSessionActionPath: "/__test/close-cash-session",
  createPayableActionPath: "/__test/create-payable",
  createRecurringExpenseRuleActionPath: "/__test/create-recurring-expense",
  createSalonFinancialTransactionActionPath: "/__test/create-finance-entry",
  createTeamPayoutActionPath: "/__test/create-team-payout",
  loadFinancePageDataMock: vi.fn(),
  openCashSessionActionPath: "/__test/open-cash-session",
  recordRecurringExpensePostingActionPath: "/__test/record-recurring-expense",
  settlePayableActionPath: "/__test/settle-payable",
  toggleRecurringExpenseRuleActionPath: "/__test/toggle-recurring-expense",
}));

vi.mock("@/app/actions", () => ({
  closeCashSessionAction: closeCashSessionActionPath,
  createPayableAction: createPayableActionPath,
  createRecurringExpenseRuleAction: createRecurringExpenseRuleActionPath,
  createSalonFinancialTransactionAction:
    createSalonFinancialTransactionActionPath,
  createTeamPayoutAction: createTeamPayoutActionPath,
  openCashSessionAction: openCashSessionActionPath,
  recordRecurringExpensePostingAction: recordRecurringExpensePostingActionPath,
  settlePayableAction: settlePayableActionPath,
  toggleRecurringExpenseRuleAction: toggleRecurringExpenseRuleActionPath,
}));

vi.mock("@/app/dashboard/finance/_lib", () => ({
  loadFinancePageData: loadFinancePageDataMock,
}));

import FinancePage from "@/app/dashboard/finance/page";

describe("finance page UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadFinancePageDataMock.mockResolvedValue({
      cashRegister: {
        recentSessions: [
          {
            differenceAmount: -12,
            expectedAmount: 368,
            id: "cash-closed-1",
            openedAt: "2026-04-02T09:00:00.000Z",
            openingAmount: 80,
            reportedAmount: 356,
            sessionDate: "2026-04-02",
            status: "closed",
          },
          {
            differenceAmount: null,
            expectedAmount: null,
            id: "cash-open-1",
            openedAt: "2026-04-03T09:00:00.000Z",
            openingAmount: 100,
            reportedAmount: null,
            sessionDate: "2026-04-03",
            status: "open",
          },
        ],
        today: {
          differenceAmount: null,
          expectedBalance: 472,
          expenseAmount: 120,
          incomeAmount: 592,
          isOpen: true,
          openingAmount: 0,
          reportedAmount: null,
          sessionDate: "2026-04-03",
          sessionId: "cash-open-1",
          statusLabel: "Caixa aberto",
        },
      },
      storeOrders: {
        openAmount: 145,
        openCount: 2,
        items: [
          {
            customerName: "Marina",
            id: "store-open-1",
            orderMoment: "2026-04-08T15:00:00.000Z",
            orderNumber: 404,
            status: "confirmed",
            statusLabel: "Separando",
            statusTone: "accent",
            subtotalAmount: 90,
            totalItems: 2,
          },
          {
            customerName: "Bianca",
            id: "store-open-2",
            orderMoment: "2026-04-08T17:00:00.000Z",
            orderNumber: 405,
            status: "ready",
            statusLabel: "Pronto",
            statusTone: "success",
            subtotalAmount: 55,
            totalItems: 1,
          },
        ],
      },
      currentMonth: {
        appointmentMethodComparison: {
          actualTotal: 250,
          forecastTotal: 430,
          items: [
            {
              actualAmount: 250,
              actualCount: 1,
              forecastAmount: 250,
              forecastCount: 1,
              key: "pix",
              label: "Pix",
            },
            {
              actualAmount: 0,
              actualCount: 0,
              forecastAmount: 180,
              forecastCount: 1,
              key: "to_be_defined",
              label: "Decidir no salao",
            },
          ],
        },
        cashProfit: -950,
        commissionPendingPayout: 142,
        expense: 1542,
        operationalIncome: 430,
        pendingCompletedServicesAmount: 180,
        pendingCompletedServicesCount: 1,
        projectedCommissions: 442,
        projectedNet: -1392,
        realizedIncome: 592,
        teamPayoutsPaid: 300,
      },
      monthBuckets: [
        {
          expense: 1542,
          key: "2026-04",
          label: "abr",
          operationalIncome: 430,
          realizedIncome: 592,
        },
      ],
      payables: {
        dueAmount: 320,
        dueCount: 1,
        items: [
          {
            amount: 320,
            category: "fornecedor",
            dueOn: "2026-04-05",
            id: "payable-1",
            notes: "Produto profissional",
            paidOn: null,
            paymentMethod: "boleto",
            status: "pending",
            statusLabel: "Vencido",
            statusTone: "warm",
            title: "Fornecedor abril",
          },
          {
            amount: 210,
            category: "estrutura",
            dueOn: "2026-04-02",
            id: "payable-2",
            notes: "Energia quitada",
            paidOn: "2026-04-02",
            paymentMethod: "pix",
            status: "paid",
            statusLabel: "Pago",
            statusTone: "success",
            title: "Energia",
          },
        ],
      },
      receivablesDashboard: {
        alerts: [
          {
            description: "Sem pendencias criticas agora.",
            id: "healthy",
            title: "Leitura financeira esta estavel",
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
            { amount: 120, key: "cards", label: "Cartoes", share: 29 },
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
        pendingSettlements: {
          items: [
            {
              amount: 180,
              completedAt: "2026-04-08T16:00:00.000Z",
              customerName: "Marina",
              id: "appointment-1",
              paymentPreferenceLabel: "Pix",
              professionalName: "Ana",
              serviceName: "Coloracao",
            },
          ],
          totalAmount: 180,
          totalCount: 1,
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
              label: "Cartoes",
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
              serviceName: "Coloracao",
              status: "confirmed",
            },
          ],
          totalAmount: 180,
        },
      },
      recurringExpenses: {
        activeCount: 2,
        dueAmount: 1350,
        dueCount: 1,
        items: [
          {
            amount: 1200,
            cadence: "monthly",
            category: "estrutura",
            id: "recurring-1",
            isActive: true,
            lastPostedOn: "2026-03-01",
            nextDueOn: "2026-04-01",
            notes: "Aluguel da loja",
            paymentMethod: "transferencia",
            statusLabel: "Atrasada - Mensal",
            statusTone: "warm",
            title: "Aluguel",
          },
          {
            amount: 150,
            cadence: "monthly",
            category: "assinaturas",
            id: "recurring-2",
            isActive: false,
            lastPostedOn: "2026-03-10",
            nextDueOn: "2026-04-10",
            notes: "Sistema",
            paymentMethod: "pix",
            statusLabel: "Pausada - Mensal",
            statusTone: "soft",
            title: "Software",
          },
        ],
      },
      staffOptions: [
        { id: "staff-1", label: "Ana" },
        { id: "staff-2", label: "Carlos" },
      ],
      teamPayouts: {
        items: [
          {
            amount: 300,
            id: "payout-1",
            notes: "Repasse da semana",
            occurredOn: "2026-04-03",
            paymentMethod: "pix",
            professionalName: "Ana",
            title: "Repasse - Ana",
          },
        ],
      },
      timelineEntries: [
        {
          amount: 250,
          id: "appointment-payment-1",
          kind: "income",
          occurredAt: "2026-04-02T15:05:00.000Z",
          sourceLabel: "Atendimento",
          subtitle: "Maria - Pix",
          title: "Coloracao",
        },
        {
          amount: 1200,
          id: "manual-entry-1",
          kind: "expense",
          occurredAt: "2026-04-01T12:00:00.000Z",
          sourceLabel: "Conta fixa",
          subtitle: "estrutura - transferencia",
          title: "Aluguel",
        },
      ],
    });
  });

  it("renders finance with team payouts and recurring expenses", async () => {
    const ui = await FinancePage({
      searchParams: Promise.resolve({ message: "Financeiro atualizado.", tone: "success" }),
    });

    render(ui);

    expect(screen.getByText("Financeiro atualizado.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Baixas pendentes" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Baixar agora" })).toHaveAttribute(
      "href",
      "/dashboard/gestao/pagamentos?compose=1&appointmentId=appointment-1#payment-create",
    );
    expect(screen.getByRole("heading", { name: "Caixa" })).toBeInTheDocument();
    expect(screen.getAllByText("Recebido").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Repasse pago").length).toBeGreaterThan(0);
    expect(
      screen.getByRole("heading", { name: "Caixa do dia" }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Esperado agora").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Loja do app").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Fechar caixa" })).toBeInTheDocument();
    expect(screen.getByText("Ultimos caixas")).toBeInTheDocument();
    expect(screen.getByText(/Diferenca/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Repasses da equipe" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Loja do app" })).toBeInTheDocument();
    expect(screen.getAllByText("Marina").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Ver pedidos" })).toHaveAttribute(
      "href",
      "/dashboard/inventory#inventory-orders",
    );
    expect(screen.getByText(/Repasse - Ana/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Registrar repasse" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contas a pagar" })).toBeInTheDocument();
    expect(screen.getByText("Fornecedor abril")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Baixar no caixa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar conta a pagar" })).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: "Contas fixas" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Atrasada/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lancar vencimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar conta fixa" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ultimos lancamentos" })).toBeInTheDocument();
    expect(screen.getByText("Coloracao")).toBeInTheDocument();
    expect(screen.getByText("Maria - Pix")).toBeInTheDocument();
    expect(screen.getAllByText("Aluguel").length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Novo lancamento" })).toHaveAttribute(
      "href",
      "#finance-new",
    );
    expect(screen.getByRole("heading", { name: "Novo lancamento" })).toBeInTheDocument();
    expect(screen.getAllByText("Categoria").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Salvar transacao" })).toBeInTheDocument();
  });
});
