import type {
  NotificationCategory,
  NotificationDispatchSnapshot,
  NotificationRow,
} from "./shared";

export type NotificationsPageSearchParams = {
  q?: string | string[];
  audience?: string | string[];
  category?: string | string[];
  dateFrom?: string | string[];
  dateTo?: string | string[];
  page?: string | string[];
  message?: string;
  tone?: string;
};

type NotificationsHistoryItem = {
  audience: NotificationRow["audience"];
  body: string;
  category: NotificationCategory;
  createdAtLabel: string;
  destinationLabel: string;
  dispatchStatus: NotificationDispatchSnapshot["status"] | null;
  failedCount: number | null;
  id: string;
  sentCount: number | null;
  title: string;
};

type NotificationsInternalAlertItem = {
  body: string;
  href: string;
  id: string;
  label: string;
  title: string;
  tone: "warning" | "danger";
};

export type NotificationsPageData = {
  filters: {
    audienceFilter: string;
    categoryFilter: NotificationCategory | "";
    clearHref: string;
    dateFrom: string;
    dateTo: string;
    endItem: number;
    filterSummary: string;
    q: string;
    safePage: number;
    showClear: boolean;
    startItem: number;
    totalPages: number;
  };
  header: {
    activePushTokensCount: number;
    recentPushTokensCount: number;
    deliveredOnPageCount: number;
    exportHref: string;
    issueOnPageCount: number;
    totalCount: number;
  };
  internalAlerts: {
    dueFinancialCount: number;
    items: NotificationsInternalAlertItem[];
    lowStockCount: number;
    operationalCount: number;
  };
  history: {
    currentPagePath: string;
    items: NotificationsHistoryItem[];
    nextPageHref: string | null;
    pageLinks: Array<{
      href: string;
      isActive: boolean;
      label: string;
    }>;
    previousPageHref: string | null;
    previousPagePath: string;
    summary: string;
  };
};

export { loadNotificationsPageData } from "./_loader";
