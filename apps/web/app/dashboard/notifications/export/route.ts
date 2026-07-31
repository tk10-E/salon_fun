import { NextRequest, NextResponse } from "next/server";

import { getOwnerSalon } from "@/lib/auth";
import {
  getClientIp,
  guardApiRequest,
  hashSecurityIdentifier,
  recordSecurityAuditEvent,
} from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

import {
  formatDispatchStatus,
  formatAudienceLabel,
  formatCategoryLabel,
  formatNotificationType,
  getCategory,
  getTypesForCategory,
  KNOWN_NOTIFICATION_TYPES,
  parseDateEnd,
  parseDateStart,
  toCsvRow,
  type NotificationCategory,
  type NotificationDispatchSnapshot,
  type NotificationRow,
} from "../shared";

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

function sanitizeSearchQuery(value: string) {
  return value
    .replace(/[()%*,]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 80);
}

function applyNotificationFilters(
  query: any,
  filters: {
    q: string;
    audienceFilter: string;
    categoryFilter: NotificationCategory | "";
    dateFromIso: string | null;
    dateToIso: string | null;
  },
) {
  let nextQuery = query;

  if (
    filters.audienceFilter === "salon_customers" ||
    filters.audienceFilter === "single_customer"
  ) {
    nextQuery = nextQuery.eq("audience", filters.audienceFilter);
  }

  if (filters.q) {
    nextQuery = nextQuery.or(`title.ilike.%${filters.q}%,body.ilike.%${filters.q}%`);
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
      nextQuery = nextQuery.in("notification_type", getTypesForCategory(filters.categoryFilter));
    }
  }

  return nextQuery;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

export async function GET(request: NextRequest) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "notification_export",
    allowMissingOrigin: true,
    blockSeconds: 900,
    limit: 8,
    rateLimitKey:
      hashSecurityIdentifier(
        `${getClientIp(request.headers) ?? "unknown"}:${request.nextUrl.search}`,
      ) ?? undefined,
    windowSeconds: 600,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const salon = await getOwnerSalon(user.id);

  if (!salon) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  const q = sanitizeSearchQuery(
    request.nextUrl.searchParams.get("q")?.trim() ?? "",
  );
  const audienceFilter = request.nextUrl.searchParams.get("audience")?.trim() ?? "";
  const categoryFilter = normalizeCategory(
    request.nextUrl.searchParams.get("category")?.trim() ?? "",
  );
  const dateFrom = request.nextUrl.searchParams.get("dateFrom")?.trim() ?? "";
  const dateTo = request.nextUrl.searchParams.get("dateTo")?.trim() ?? "";
  const dateFromIso = parseDateStart(dateFrom);
  const dateToIso = parseDateEnd(dateTo);

  const filters = {
    q,
    audienceFilter,
    categoryFilter,
    dateFromIso,
    dateToIso,
  };

  const allRows: NotificationRow[] = [];
  const batchSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select(
          "id, audience, notification_type, title, body, created_at, customer_id, customers(name)",
        )
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .range(from, from + batchSize - 1),
      filters,
    );

    if (error) {
      return NextResponse.json({ error: "Não foi possível exportar os avisos." }, { status: 500 });
    }

    const rows = (data ?? []) as NotificationRow[];
    allRows.push(...rows);

    if (rows.length < batchSize) {
      break;
    }

    from += batchSize;
  }

  const dispatchSnapshots = allRows.length
    ? (
        await Promise.all(
          chunkArray(
            allRows.map((notification) => notification.id),
            500,
          ).map(async (notificationIds) => {
            const snapshotResult = await supabase.rpc("get_salon_notification_dispatch_snapshot", {
              notification_ids_input: notificationIds,
            });

            return (snapshotResult.data ?? []) as NotificationDispatchSnapshot[];
          }),
        )
      ).flat()
    : [];
  const dispatchMap = new Map(
    dispatchSnapshots.map((snapshot) => [snapshot.notification_id, snapshot]),
  );

  const header = toCsvRow([
    "Data",
    "Categoria",
    "Tipo",
    "Público",
    "Cliente",
    "Status push",
    "Resposta push",
    "Enviados",
    "Falhas",
    "Título",
    "Mensagem",
  ]);

  const lines = allRows.map((notification) => {
    const customer = Array.isArray(notification.customers)
      ? notification.customers[0]
      : notification.customers;
    const dispatchSnapshot = dispatchMap.get(notification.id);

    return toCsvRow([
      notification.created_at,
      formatCategoryLabel(getCategory(notification.notification_type)),
      formatNotificationType(notification.notification_type),
      formatAudienceLabel(notification.audience),
      customer?.name ?? "",
      formatDispatchStatus(dispatchSnapshot?.status),
      dispatchSnapshot?.response_status == null ? "" : String(dispatchSnapshot.response_status),
      dispatchSnapshot?.sent_count == null ? "" : String(dispatchSnapshot.sent_count),
      dispatchSnapshot?.failed_count == null ? "" : String(dispatchSnapshot.failed_count),
      notification.title,
      notification.body,
    ]);
  });

  const csvContent = `\ufeff${[header, ...lines].join("\n")}`;

  await recordSecurityAuditEvent({
    actorUserId: user.id,
    eventType: "notification_export.generated",
    ipAddress: getClientIp(request.headers),
    metadata: {
      audienceFilter,
      categoryFilter,
      exportedRows: allRows.length,
      q,
    },
    requestPath: request.nextUrl.pathname,
    salonId: salon.id,
    severity: "info",
    userAgent: request.headers.get("user-agent"),
  });

  return new NextResponse(csvContent, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="avisos-enviados-${salon.id}.csv"`,
      "Cache-Control": "no-store",
      "X-Robots-Tag": "noindex, nofollow",
    },
  });
}
