export type FinancePageData = {
  cashRegister: {
    recentSessions: Array<{
      differenceAmount: number | null;
      expectedAmount: number | null;
      id: string;
      openedAt: string;
      openingAmount: number;
      reportedAmount: number | null;
      sessionDate: string;
      status: "open" | "closed";
    }>;
    today: {
      differenceAmount: number | null;
      expectedBalance: number;
      expenseAmount: number;
      incomeAmount: number;
      isOpen: boolean;
      openingAmount: number;
      reportedAmount: number | null;
      sessionId: string | null;
      sessionDate: string;
      statusLabel: string;
    };
  };
  storeOrders: {
    openAmount: number;
    openCount: number;
    items: Array<{
      customerName: string;
      id: string;
      orderMoment: string;
      orderNumber: number;
      status: "pending" | "confirmed" | "ready";
      statusLabel: string;
      statusTone: "success" | "accent" | "warm" | "soft";
      subtotalAmount: number;
      totalItems: number;
    }>;
  };
  receivablesDashboard: {
    alerts: Array<{
      description: string;
      id: string;
      title: string;
      tone: "success" | "accent" | "warm" | "soft";
    }>;
    cashHealth: {
      availableBalance: number;
      forecastToday: number;
      upcomingAmount: number;
    };
    focusDateKey: string;
    focusDateLabel: string;
    methodBreakdown: {
      items: Array<{
        amount: number;
        key: "pix" | "cards" | "cash" | "other";
        label: string;
        share: number;
      }>;
      totalAmount: number;
    };
    rangeDays: number;
    recent: {
      items: Array<{
        amount: number;
        avatarUrl: string | null;
        id: string;
        occurredAt: string;
        occurredLabel: string;
        paymentMethodLabel: string | null;
        sourceLabel: string;
        subtitle: string;
        title: string;
      }>;
    };
    pendingSettlements: {
      items: Array<{
        amount: number;
        completedAt: string;
        customerName: string;
        id: string;
        paymentPreferenceLabel: string;
        professionalName: string;
        serviceName: string;
      }>;
      totalAmount: number;
      totalCount: number;
    };
    todaySummary: {
      averageTicket: number;
      averageTicketDeltaPercent: number | null;
      methods: Array<{
        amount: number;
        count: number;
        deltaPercent: number | null;
        key: "pix" | "cards" | "cash";
        label: string;
      }>;
      totalCount: number;
      totalDeltaPercent: number | null;
      totalReceived: number;
    };
    trend: {
      actualPoints: Array<{
        cumulative: number;
        daily: number;
        key: string;
        label: string;
      }>;
      actualTotal: number;
      conversionRate: number;
      potentialTotal: number;
      projectedPoints: Array<{
        cumulative: number;
        daily: number;
        key: string;
        label: string;
      }>;
      upcomingTotal: number;
    };
    upcoming: {
      items: Array<{
        amount: number;
        customerAvatarUrl: string | null;
        customerName: string;
        dateKey: string;
        dayLabel: string;
        id: string;
        paymentPreferenceLabel: string;
        serviceName: string;
        status: "pending" | "confirmed" | "completed";
      }>;
      totalAmount: number;
    };
  };
  currentMonth: {
    appointmentMethodComparison: {
      actualTotal: number;
      forecastTotal: number;
      items: Array<{
        actualAmount: number;
        actualCount: number;
        forecastAmount: number;
        forecastCount: number;
        key: string;
        label: string;
      }>;
    };
    cashProfit: number;
    expense: number;
    operationalIncome: number;
    pendingCompletedServicesAmount: number;
    pendingCompletedServicesCount: number;
    projectedCommissions: number;
    commissionPendingPayout: number;
    projectedNet: number;
    realizedIncome: number;
    teamPayoutsPaid: number;
  };
  monthBuckets: Array<{
    expense: number;
    key: string;
    label: string;
    operationalIncome: number;
    realizedIncome: number;
  }>;
  timelineEntries: Array<{
    amount: number;
    avatarUrl?: string | null;
    id: string;
    kind: "income" | "expense";
    occurredAt: string;
    paymentMethodLabel?: string | null;
    sourceLabel: string;
    subtitle: string;
    title: string;
  }>;
  recurringExpenses: {
    activeCount: number;
    dueAmount: number;
    dueCount: number;
    items: Array<{
      amount: number;
      cadence: "weekly" | "monthly" | "yearly";
      category: string;
      id: string;
      isActive: boolean;
      lastPostedOn: string | null;
      nextDueOn: string;
      notes: string | null;
      paymentMethod: string | null;
      statusLabel: string;
      statusTone: "success" | "accent" | "warm" | "soft";
      title: string;
    }>;
  };
  payables: {
    dueAmount: number;
    dueCount: number;
    items: Array<{
      amount: number;
      category: string;
      dueOn: string;
      id: string;
      notes: string | null;
      paidOn: string | null;
      paymentMethod: string | null;
      status: "pending" | "paid" | "cancelled";
      statusLabel: string;
      statusTone: "success" | "accent" | "warm" | "soft";
      title: string;
    }>;
  };
  staffOptions: Array<{
    id: string;
    label: string;
  }>;
  teamPayouts: {
    items: Array<{
      amount: number;
      id: string;
      notes: string | null;
      occurredOn: string;
      paymentMethod: string | null;
      professionalName: string;
      title: string;
    }>;
  };
};

export { loadFinancePageData } from "./_loader";
