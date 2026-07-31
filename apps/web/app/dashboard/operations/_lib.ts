type GoalCard = {
  currentLabel: string;
  id: string;
  label: string;
  note: string;
  progress: number;
  targetLabel: string;
  targetValue: number;
};

export type OperationsPageData = {
  autopilot: {
    active: boolean;
    cards: Array<{
      id: string;
      label: string;
      note: string;
      value: string;
    }>;
    queue: Array<{
      badgeClassName: string;
      badgeLabel: string;
      id: string;
      meta: string;
      note: string;
      signalBadges: string[];
      title: string;
    }>;
    rules: string[];
    schedulerReady: boolean;
    statusNote: string;
  };
  customersAttention: {
    lostCustomers: Array<{
      contactSummary: string;
      hasContact: boolean;
      id: string;
      lastVisitLabel: string | null;
      name: string;
      phoneValue: string;
      stageBadges: string[];    }>;
    stageCounters: {
      fidelizado: number;
      novo: number;
      perdido: number;
      retorno: number;
    };
  };
  goals: {
    cards: GoalCard[];
    currentMonthReference: string;
    helperText: string;
    monthLabel: string;
    monthlyTargetSaved: boolean;
  };
  header: {
    autoPilotEnabled: boolean;
    currentMonthRevenueLabel: string;
    currentMonthServedCustomersLabel: string;
    estimatedCommissionsLabel: string;
    lowStockProductsLabel: string;
    monthLabel: string;
    storeOrdersLabel: string;
    ticketLabel: string;
  };
  insights: {
    bestHourSummary: string;
    cancelRateSummary: string;
    highlights: string[];
    revenueSummary: string;
    serviceSummary: string;
    ticketSummary: string;
    topCustomerSummary: string;
  };
  inventory: {
    lowStockProducts: Array<{
      id: string;
      imageUrl: string | null;
      minimumStockLabel: string;
      name: string;
      stockLabel: string;
    }>;
    movements: Array<{
      createdAtLabel: string;
      id: string;
      movementLabel: string;
      productName: string;
      quantityLabel: string;
      reason: string | null;
      resultingStockLabel: string;
    }>;
  };
  store: {
    orders: Array<{
      canCancel: boolean;
      canComplete: boolean;
      canConfirm: boolean;
      canReady: boolean;
      contactLabel: string;
      customerName: string;
      id: string;
      itemsSummary: string;
      notes: string | null;
      orderMomentLabel: string;
      orderNumberLabel: string;
      status: "pending" | "confirmed" | "ready" | "completed" | "cancelled";
      statusBadgeClass: string;
      statusLabel: string;
      totalItemsLabel: string;
      totalLabel: string;
    }>;
  };
  team: {
    members: Array<{
      assignedServicesSummary: string;
      commissionFlatFee: number;
      commissionRatePercent: number;
      estimatedCommissionLabel: string;
      id: string;
      name: string;
      performanceSummary: string;
      roleSummary: string;
      statusBadgeClass: string;
      statusLabel: string;
    }>;
  };
};

export { loadOperationsPageData } from "./_loader";
