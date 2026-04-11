export type FinancePageData = {
  currentMonth: {
    expense: number;
    income: number;
    profit: number;
  };
  monthBuckets: Array<{
    expense: number;
    income: number;
    key: string;
    label: string;
  }>;
  timelineEntries: Array<{
    amount: number;
    id: string;
    kind: "income" | "expense";
    occurredAt: string;
    sourceLabel: string;
    subtitle: string;
    title: string;
  }>;
};

export { loadFinancePageData } from "./_loader";
