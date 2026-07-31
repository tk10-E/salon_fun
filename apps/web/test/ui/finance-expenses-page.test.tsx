// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  createPayableActionPath,
  createRecurringExpenseRuleActionPath,
  createSalonFinancialTransactionActionPath,
  loadFinancePageDataMock,
  recordRecurringExpensePostingActionPath,
  settlePayableActionPath,
  toggleRecurringExpenseRuleActionPath,
} = vi.hoisted(() => ({
  createPayableActionPath: "/__test/create-payable",
  createRecurringExpenseRuleActionPath: "/__test/create-recurring-expense",
  createSalonFinancialTransactionActionPath: "/__test/create-finance-entry",
  loadFinancePageDataMock: vi.fn(),
  recordRecurringExpensePostingActionPath: "/__test/record-recurring-expense",
  settlePayableActionPath: "/__test/settle-payable",
  toggleRecurringExpenseRuleActionPath: "/__test/toggle-recurring-expense",
}));

vi.mock("@/app/actions", () => ({
  createPayableAction: createPayableActionPath,
  createRecurringExpenseRuleAction: createRecurringExpenseRuleActionPath,
  createSalonFinancialTransactionAction:
    createSalonFinancialTransactionActionPath,
  recordRecurringExpensePostingAction: recordRecurringExpensePostingActionPath,
  settlePayableAction: settlePayableActionPath,
  toggleRecurringExpenseRuleAction: toggleRecurringExpenseRuleActionPath,
}));

vi.mock("@/app/dashboard/finance/_lib", () => ({
  loadFinancePageData: loadFinancePageDataMock,
}));

import FinanceExpensesPage from "@/app/dashboard/finance/despesas/page";

describe("finance expenses page", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    loadFinancePageDataMock.mockResolvedValue({
      cashRegister: {
        recentSessions: [],
        today: {
          differenceAmount: null,
          expectedBalance: 720,
          expenseAmount: 320,
          incomeAmount: 1040,
          isOpen: true,
          openingAmount: 0,
          reportedAmount: null,
          sessionDate: "2026-04-08",
          sessionId: "cash-1",
          statusLabel: "Caixa aberto",
        },
      },
      storeOrders: {
        openAmount: 0,
        openCount: 0,
        items: [],
      },
      currentMonth: {
        appointmentMethodComparison: {
          actualTotal: 0,
          forecastTotal: 0,
          items: [],
        },
        cashProfit: 720,
        commissionPendingPayout: 0,
        expense: 1542,
        operationalIncome: 0,
        pendingCompletedServicesAmount: 0,
        pendingCompletedServicesCount: 0,
        projectedCommissions: 0,
        projectedNet: 720,
        realizedIncome: 2262,
        teamPayoutsPaid: 0,
      },
      monthBuckets: [
        {
          expense: 1542,
          key: "2026-04",
          label: "abr",
          operationalIncome: 2262,
          realizedIncome: 2262,
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
            amount: 120,
            category: "estrutura",
            dueOn: "2026-04-02",
            id: "payable-2",
            notes: "Quitada",
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
        alerts: [],
        cashHealth: {
          availableBalance: 0,
          forecastToday: 0,
          upcomingAmount: 0,
        },
        focusDateKey: "2026-04-08",
        focusDateLabel: "8 de abril de 2026",
        methodBreakdown: { items: [], totalAmount: 0 },
        rangeDays: 14,
        recent: { items: [] },
        todaySummary: {
          averageTicket: 0,
          averageTicketDeltaPercent: null,
          methods: [],
          totalCount: 0,
          totalDeltaPercent: null,
          totalReceived: 0,
        },
        trend: {
          actualPoints: [],
          actualTotal: 0,
          conversionRate: 0,
          potentialTotal: 0,
          projectedPoints: [],
          upcomingTotal: 0,
        },
        upcoming: { items: [], totalAmount: 0 },
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
            paymentMethod: "transferência",
            statusLabel: "Atrasada • Mensal",
            statusTone: "warm",
            title: "Aluguel",
          },
        ],
      },
      staffOptions: [],
      teamPayouts: { items: [] },
      timelineEntries: [
        {
          amount: 1200,
          id: "manual-entry-1",
          kind: "expense",
          occurredAt: "2026-04-01T12:00:00.000Z",
          sourceLabel: "Conta fixa",
          subtitle: "estrutura • transferência",
          title: "Aluguel",
        },
      ],
    });
  });

  it("renders an expense-focused financial workspace using real finance loaders", async () => {
    const ui = await FinanceExpensesPage({
      searchParams: Promise.resolve({
        message: "Despesa atualizada.",
        tone: "success",
      }),
    });

    render(ui);

    expect(screen.getByText("Despesa atualizada.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Despesas" })).toBeInTheDocument();
    expect(screen.getByText("Despesas do mês")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contas a pagar" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Contas fixas e recorrentes" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Transações de saída" })).toBeInTheDocument();
    expect(screen.getByText("Fornecedor abril")).toBeInTheDocument();
    expect(screen.getAllByText("Aluguel").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Baixar no caixa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Lancar vencimento" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar conta a pagar" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar conta fixa" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Salvar despesa" })).toBeInTheDocument();
  });
});
