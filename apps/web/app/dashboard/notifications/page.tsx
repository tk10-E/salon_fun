import Link from "next/link";

import { EmptyStateCard } from "@/components/EmptyStateCard";
import { requireOwnerSalon } from "@/lib/auth";
import { formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

import { NotificationsList } from "./NotificationsList";
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

type NotificationsPageProps = {
  searchParams?: {
    q?: string | string[];
    audience?: string | string[];
    category?: string | string[];
    dateFrom?: string | string[];
    dateTo?: string | string[];
    page?: string | string[];
  };
};

const PAGE_SIZE = 20;

function buildHref(
  currentSearchParams: NotificationsPageProps["searchParams"],
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

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const q = firstParam(searchParams?.q).trim();
  const audienceFilter = firstParam(searchParams?.audience).trim();
  const categoryFilter = normalizeCategory(firstParam(searchParams?.category).trim());
  const dateFrom = firstParam(searchParams?.dateFrom).trim();
  const dateTo = firstParam(searchParams?.dateTo).trim();
  const page = parsePage(searchParams?.page);
  const dateFromIso = parseDateStart(dateFrom);
  const dateToIso = parseDateEnd(dateTo);
  const rangeFrom = (page - 1) * PAGE_SIZE;
  const rangeTo = rangeFrom + PAGE_SIZE - 1;

  const filters = {
    q,
    audienceFilter,
    categoryFilter,
    dateFromIso,
    dateToIso,
  };

  const baseSelect =
    "id, audience, notification_type, title, body, created_at, customer_id, customers(name)";

  const [listResult, totalResult, allCustomersResult, singleCustomerResult] = await Promise.all([
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select(baseSelect)
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .range(rangeFrom, rangeTo),
      filters,
    ),
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id),
      filters,
    ),
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id)
        .eq("audience", "salon_customers"),
      {
        ...filters,
        audienceFilter: "",
      },
    ),
    applyNotificationFilters(
      supabase
        .from("salon_customer_notifications")
        .select("id", { count: "exact", head: true })
        .eq("salon_id", salon.id)
        .eq("audience", "single_customer"),
      {
        ...filters,
        audienceFilter: "",
      },
    ),
  ]);

  const notifications = (listResult.data ?? []) as NotificationRow[];
  const dispatchSnapshotsResult = notifications.length
    ? await supabase.rpc("get_salon_notification_dispatch_snapshot", {
        notification_ids_input: notifications.map((notification) => notification.id),
      })
    : { data: [] as NotificationDispatchSnapshot[] };
  const dispatchSnapshots = (dispatchSnapshotsResult.data ?? []) as NotificationDispatchSnapshot[];
  const dispatchMap = new Map(
    dispatchSnapshots.map((snapshot) => [snapshot.notification_id, snapshot]),
  );
  const totalCount = totalResult.count ?? 0;
  const allCustomersCount = allCustomersResult.count ?? 0;
  const singleCustomerCount = singleCustomerResult.count ?? 0;
  const deliveredOnPageCount = dispatchSnapshots.filter((snapshot) => snapshot.status === "delivered").length;
  const issueOnPageCount = dispatchSnapshots.filter(
    (snapshot) => snapshot.status === "delivery_failed" || snapshot.status === "enqueue_failed",
  ).length;
  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const previousPagePath = safePage > 1 ? buildHref(searchParams, { page: safePage - 1 }) : "";
  const currentPagePath = buildHref(searchParams, { page: safePage });
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );
  const exportHref = (() => {
    const params = new URLSearchParams();

    if (q) {
      params.set("q", q);
    }

    if (audienceFilter) {
      params.set("audience", audienceFilter);
    }

    if (categoryFilter) {
      params.set("category", categoryFilter);
    }

    if (dateFrom) {
      params.set("dateFrom", dateFrom);
    }

    if (dateTo) {
      params.set("dateTo", dateTo);
    }

    const search = params.toString();
    return `/dashboard/notifications/export${search ? `?${search}` : ""}`;
  })();

  return (
    <div className="page-grid">
      <section className="stats-grid">
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Total filtrado</span>
          <p className="stat-value">{totalCount}</p>
          <p className="metric-note">Avisos reais enviados pelo salão dentro do filtro atual.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Página atual</span>
          <p className="stat-value">{notifications.length}</p>
          <p className="metric-note">
            Exibindo de {startItem} até {endItem} de um total de {totalCount}.
          </p>
        </article>
        <article className="card metric-card metric-card--accent">
          <span className="eyebrow">Público geral</span>
          <p className="stat-value">{allCustomersCount}</p>
          <p className="metric-note">Avisos enviados para todos os clientes do salão.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Cliente específico</span>
          <p className="stat-value">{singleCustomerCount}</p>
          <p className="metric-note">Avisos 1 a 1 disparados para um cliente específico.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Entregues nesta página</span>
          <p className="stat-value">{deliveredOnPageCount}</p>
          <p className="metric-note">Últimas notificações cuja entrega push fechou como entregue na auditoria.</p>
        </article>
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Com problema</span>
          <p className="stat-value">{issueOnPageCount}</p>
          <p className="metric-note">Avisos desta página que falharam ao enfileirar ou entregar o push.</p>
        </article>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Avisos enviados</h2>
            <p className="muted">
              Acompanhe o que o salão já disparou para o app do cliente com filtros por período,
              paginação e exportação do histórico.
            </p>
          </div>

          <Link href={exportHref} className="secondary-button">
            Exportar CSV
          </Link>
        </div>

        <form method="get" className="services-toolbar notifications-toolbar" style={{ marginTop: 18 }}>
          <div className="notifications-toolbar__grid">
            <div className="field">
              <label htmlFor="notifications-search">Buscar aviso</label>
              <input
                id="notifications-search"
                name="q"
                placeholder="Busque por título ou conteúdo"
                defaultValue={q}
              />
            </div>

            <div className="field">
              <label htmlFor="notifications-audience">Público</label>
              <select id="notifications-audience" name="audience" defaultValue={audienceFilter}>
                <option value="">Todos</option>
                <option value="salon_customers">Todos os clientes</option>
                <option value="single_customer">Cliente específico</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="notifications-category">Tipo</label>
              <select id="notifications-category" name="category" defaultValue={categoryFilter}>
                <option value="">Todos</option>
                <option value="promotion">Promoções</option>
                <option value="growth">Recuperação</option>
                <option value="appointment">Agendamentos</option>
                <option value="referral">Indicações</option>
                <option value="service">Serviços</option>
                <option value="feed">Feed</option>
                <option value="other">Outros avisos</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="notifications-date-from">De</label>
              <input id="notifications-date-from" name="dateFrom" type="date" defaultValue={dateFrom} />
            </div>

            <div className="field">
              <label htmlFor="notifications-date-to">Até</label>
              <input id="notifications-date-to" name="dateTo" type="date" defaultValue={dateTo} />
            </div>
          </div>

          <input type="hidden" name="page" value="1" />

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar
            </button>
            <span className="services-toolbar__count">
              {totalCount} {totalCount === 1 ? "aviso encontrado" : "avisos encontrados"}
            </span>
            {(q || audienceFilter || categoryFilter || dateFrom || dateTo) ? (
              <a href="/dashboard/notifications" className="secondary-button services-toolbar__clear">
                Limpar filtros
              </a>
            ) : null}
          </div>
        </form>

        <div className="row-list" style={{ marginTop: 18 }}>
          {!notifications.length ? (
            <EmptyStateCard
              eyebrow="Nenhum aviso encontrado"
              title="Ainda não há notificações nesse filtro"
              description="Quando o salão publicar promoções, confirmar horários ou disparar novos avisos, tudo vai aparecer aqui."
            />
          ) : (
            <NotificationsList
              items={notifications.map((notification) => {
                const customer = Array.isArray(notification.customers)
                  ? notification.customers[0]
                  : notification.customers;

                return {
                  notification,
                  category: getCategory(notification.notification_type),
                  customerName: customer?.name ?? null,
                  dispatchSnapshot: dispatchMap.get(notification.id) ?? null,
                };
              })}
              returnPathCurrent={currentPagePath}
              returnPathPrevious={previousPagePath}
            />
          )}
        </div>

        {totalPages > 1 ? (
          <nav className="notifications-pagination" aria-label="Paginação dos avisos">
            <div className="notifications-pagination__summary">
              Página {safePage} de {totalPages}
            </div>

            <div className="notifications-pagination__links">
              {safePage > 1 ? (
                <Link
                  href={buildHref(searchParams, { page: safePage - 1 })}
                  className="secondary-button"
                >
                  Anterior
                </Link>
              ) : null}

              {pageNumbers.map((pageNumber) => (
                <Link
                  key={pageNumber}
                  href={buildHref(searchParams, { page: pageNumber })}
                  className={`secondary-button${pageNumber === safePage ? " notifications-pagination__link--active" : ""}`}
                >
                  {pageNumber}
                </Link>
              ))}

              {safePage < totalPages ? (
                <Link
                  href={buildHref(searchParams, { page: safePage + 1 })}
                  className="secondary-button"
                >
                  Próxima
                </Link>
              ) : null}
            </div>
          </nav>
        ) : null}
      </section>
    </div>
  );
}
