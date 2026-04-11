import { requireOwnerSalon } from "@/lib/auth";
import { formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

import type {
  NotificationsPageData,
  NotificationsPageSearchParams,
} from "./_lib";
import {
  firstParam,
  getCategory,
  getTypesForCategory,
  KNOWN_NOTIFICATION_TYPES,
  parseDateEnd,
  parseDateStart,
  parsePage,
  type NotificationCategory,
  type NotificationDispatchSnapshot,
  type NotificationRow,
} from "./shared";

type NotificationsFilterState = {
  audienceFilter: string;
  categoryFilter: NotificationCategory | "";
  dateFrom: string;
  dateFromIso: string | null;
  dateTo: string;
  dateToIso: string | null;
  q: string;
};

const PAGE_SIZE = 20;

function buildNotificationsHref(
  currentSearchParams: NotificationsPageSearchParams | undefined,
  overrides: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  const entries = [
    ["q", firstParam(currentSearchParams?.q)],
    ["audience", firstParam(currentSearchParams?.audience)],
    ["category", firstParam(currentSearchParams?.category)],
    ["dateFrom", firstParam(currentSearchParams?.dateFrom)],
    ["dateTo", firstParam(currentSearchParams?.dateTo)],
    ["page", String(parsePage(currentSearchParams?.page))],
  ] as const;

  for (const [key, value] of entries) {
    if (value) {
      params.set(key, value);
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined || value === "") {
      params.delete(key);
      continue;
    }

    params.set(key, String(value));
  }

  const search = params.toString();
  return `/dashboard/notifications${search ? `?${search}` : ""}`;
}

function normalizeCategory(value: string): NotificationCategory | "" {
  if (
    value === "promotion" ||
    value === "growth" ||
    value === "appointment" ||
    value === "referral" ||
    value === "service" ||
    value === "feed" ||
    value === "other"
  ) {
    return value;
  }

  return "";
}

function applyNotificationFilters(
  query: any,
  filters: NotificationsFilterState,
) {
  let nextQuery = query;

  if (
    filters.audienceFilter === "salon_customers" ||
    filters.audienceFilter === "single_customer"
  ) {
    nextQuery = nextQuery.eq("audience", filters.audienceFilter);
  }

  if (filters.q) {
    nextQuery = nextQuery.or(
      `title.ilike.%${filters.q}%,body.ilike.%${filters.q}%`,
    );
  }

  if (filters.dateFromIso) {
    nextQuery = nextQuery.gte("created_at", filters.dateFromIso);
  }

  if (filters.dateToIso) {
    nextQuery = nextQuery.lte("created_at", filters.dateToIso);
  }

  if (filters.categoryFilter) {
    if (filters.categoryFilter === "other") {
      nextQuery = nextQuery.not(
        "notification_type",
        "in",
        `(${KNOWN_NOTIFICATION_TYPES.map((type) => `"${type}"`).join(",")})`,
      );
    } else {
      nextQuery = nextQuery.in(
        "notification_type",
        getTypesForCategory(filters.categoryFilter),
      );
    }
  }

  return nextQuery;
}

function buildNotificationsFilterSummary(filters: {
  audienceFilter: string;
  categoryFilter: NotificationCategory | "";
  dateFrom: string;
  dateTo: string;
  q: string;
}) {
  const parts: string[] = [];

  if (filters.q) {
    parts.push(`busca por "${filters.q}"`);
  }

  if (filters.audienceFilter === "salon_customers") {
    parts.push("público geral");
  } else if (filters.audienceFilter === "single_customer") {
    parts.push("cliente específico");
  }

  if (filters.categoryFilter) {
    parts.push(`categoria ${filters.categoryFilter}`);
  }

  if (filters.dateFrom) {
    parts.push(`de ${filters.dateFrom}`);
  }

  if (filters.dateTo) {
    parts.push(`até ${filters.dateTo}`);
  }

  return parts.length ? parts.join(" • ") : "sem filtro ativo";
}

function buildExportHref(filters: {
  audienceFilter: string;
  categoryFilter: NotificationCategory | "";
  dateFrom: string;
  dateTo: string;
  q: string;
}) {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.audienceFilter) {
    params.set("audience", filters.audienceFilter);
  }

  if (filters.categoryFilter) {
    params.set("category", filters.categoryFilter);
  }

  if (filters.dateFrom) {
    params.set("dateFrom", filters.dateFrom);
  }

  if (filters.dateTo) {
    params.set("dateTo", filters.dateTo);
  }

  const search = params.toString();
  return `/dashboard/notifications/export${search ? `?${search}` : ""}`;
}

export async function loadNotificationsPageData(
  searchParams?: NotificationsPageSearchParams,
): Promise<NotificationsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const recentWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const q = firstParam(searchParams?.q).trim();
  const audienceFilter = firstParam(searchParams?.audience).trim();
  const categoryFilter = normalizeCategory(
    firstParam(searchParams?.category).trim(),
  );
  const dateFrom = firstParam(searchParams?.dateFrom).trim();
  const dateTo = firstParam(searchParams?.dateTo).trim();
  const page = parsePage(searchParams?.page);
  const dateFromIso = parseDateStart(dateFrom);
  const dateToIso = parseDateEnd(dateTo);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const filters: NotificationsFilterState = {
    audienceFilter,
    categoryFilter,
    dateFrom,
    dateFromIso,
    dateTo,
    dateToIso,
    q,
  };

  const baseSelect =
    "id, audience, notification_type, title, body, created_at, customer_id, customers(name)";

  const [
    listResult,
    totalResult,
    activePushTokensResult,
    recentPushTokensResult,
  ] = await Promise.all([
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select(baseSelect)
        .eq("salon_id", salon.id),
      filters,
    )
      .order("created_at", { ascending: false })
      .range(rangeFrom, rangeTo),
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
      filters,
    ),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .gte("last_seen_at", recentWindowStart),
  ]);

  const notifications = (listResult.data ?? []) as NotificationRow[];
  const dispatchSnapshotsResult = notifications.length
    ? await supabase.rpc("get_salon_notification_dispatch_snapshot", {
        notification_ids_input: notifications.map(
          (notification) => notification.id,
        ),
      })
    : { data: [] as NotificationDispatchSnapshot[] };
  const dispatchSnapshots = (dispatchSnapshotsResult.data ??
    []) as NotificationDispatchSnapshot[];
  const dispatchMap = new Map(
    dispatchSnapshots.map((snapshot) => [snapshot.notification_id, snapshot]),
  );

  const totalCount = totalResult.count ?? 0;
  const activePushTokensCount = activePushTokensResult.count ?? 0;
  const deliveredOnPageCount = dispatchSnapshots.filter(
    (snapshot) => snapshot.status === "delivered",
  ).length;
  const issueOnPageCount = dispatchSnapshots.filter(
    (snapshot) =>
      snapshot.status === "delivery_failed" ||
      snapshot.status === "enqueue_failed",
  ).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem =
    totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );

  return {
    filters: {
      audienceFilter,
      categoryFilter,
      clearHref: "/dashboard/notifications",
      dateFrom,
      dateTo,
      endItem,
      filterSummary: buildNotificationsFilterSummary({
        audienceFilter,
        categoryFilter,
        dateFrom,
        dateTo,
        q,
      }),
      q,
      safePage,
      showClear: Boolean(
        q || audienceFilter || categoryFilter || dateFrom || dateTo,
      ),
      startItem,
      totalPages,
    },
    header: {
      activePushTokensCount,
      recentPushTokensCount: recentPushTokensResult.count ?? 0,
      deliveredOnPageCount,
      exportHref: buildExportHref({
        audienceFilter,
        categoryFilter,
        dateFrom,
        dateTo,
        q,
      }),
      issueOnPageCount,
      totalCount,
    },
    history: {
      currentPagePath: buildNotificationsHref(searchParams, { page: safePage }),
      items: notifications.map((notification) => {
        const customer = Array.isArray(notification.customers)
          ? (notification.customers[0] ?? null)
          : notification.customers;
        const dispatch = dispatchMap.get(notification.id) ?? null;

        return {
          audience: notification.audience,
          body: notification.body,
          category: getCategory(notification.notification_type),
          createdAtLabel: formatDateTime(notification.created_at),
          destinationLabel:
            notification.audience === "single_customer"
              ? customer?.name ?? "Cliente específico"
              : "Todos os clientes",
          dispatchStatus: dispatch?.status ?? null,
          failedCount: dispatch?.failed_count ?? null,
          id: notification.id,
          responseStatus: dispatch?.response_status ?? null,
          sentCount: dispatch?.sent_count ?? null,
          title: notification.title,
        };
      }),
      nextPageHref:
        safePage < totalPages
          ? buildNotificationsHref(searchParams, { page: safePage + 1 })
          : null,
      pageLinks: pageNumbers.map((pageNumber) => ({
        href: buildNotificationsHref(searchParams, { page: pageNumber }),
        isActive: pageNumber === safePage,
        label: `${pageNumber}`,
      })),
      previousPageHref:
        safePage > 1
          ? buildNotificationsHref(searchParams, { page: safePage - 1 })
          : null,
      previousPagePath:
        safePage > 1
          ? buildNotificationsHref(searchParams, { page: safePage - 1 })
          : "",
      summary: `Página ${safePage} de ${totalPages}`,
    },
  };
}
