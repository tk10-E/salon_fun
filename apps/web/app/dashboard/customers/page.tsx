import Link from "next/link";

import { EmptyStateCard } from "@/components/EmptyStateCard";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type CustomersPageProps = {
  searchParams?: {
    page?: string | string[];
    q?: string | string[];
    segment?: string | string[];
    sort?: string | string[];
  };
};

type LoyaltyTierSnapshot = {
  discount_percent: number | string;
  is_vip: boolean;
  label: string;
  min_visits: number;
};

type CustomerDirectoryItem = {
  allergies?: string | null;
  beauty_products?: string | null;
  cashback_balance: number | string;
  completed_visits: number;
  created_at: string;
  current_tier: LoyaltyTierSnapshot | null;
  id: string;
  last_reward_at: string | null;
  last_visit_at: string | null;
  name: string;
  next_appointment_at: string | null;
  pending_appointments: number;
  points_balance: number;
  preferences?: string | null;
  referral_code: string | null;
  last_completed_service_name?: string | null;
  last_completed_staff_member_name?: string | null;
  last_completed_at?: string | null;
  total_spent: number | string;
  upcoming_appointments: number;
};

type CustomerDirectoryResponse = {
  overview: {
    cashback_customers: number;
    customers_with_upcoming_appointment: number;
    returning_customers: number;
    total_customers: number;
    vip_customers: number;
  };
  total_count: number;
  total_pages: number;
  page: number;
  page_size: number;
  items: CustomerDirectoryItem[];
};

const PAGE_SIZE = 15;

function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function parsePage(value?: string | string[]) {
  const pageValue = Number(firstParam(value));
  if (!Number.isFinite(pageValue) || pageValue < 1) {
    return 1;
  }

  return Math.floor(pageValue);
}

function normalizeSegment(value: string) {
  if (
    value === "all" ||
    value === "vip" ||
    value === "cashback" ||
    value === "returning" ||
    value === "upcoming" ||
    value === "new"
  ) {
    return value;
  }

  return "all";
}

function normalizeSort(value: string) {
  if (
    value === "recent" ||
    value === "name" ||
    value === "loyalty" ||
    value === "spent" ||
    value === "upcoming"
  ) {
    return value;
  }

  return "recent";
}

function buildHref(
  currentSearchParams: CustomersPageProps["searchParams"],
  overrides: Record<string, string | number | undefined>,
) {
  const params = new URLSearchParams();

  const entries = [
    ["q", firstParam(currentSearchParams?.q)],
    ["segment", firstParam(currentSearchParams?.segment)],
    ["sort", firstParam(currentSearchParams?.sort)],
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
  return `/dashboard/customers${search ? `?${search}` : ""}`;
}

function formatTierDiscount(value: number | string) {
  const numericValue = Number(value ?? 0);

  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(numericValue);
}

function normalizeText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function firstRelation<T extends { name?: string | null }>(
  value: T | T[] | null,
): T | null {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildCustomerRelationshipSummary(customer: CustomerDirectoryItem) {
  const isVip = customer.current_tier?.is_vip ?? false;

  if (customer.upcoming_appointments > 0 && isVip) {
    return "Cliente VIP com retorno já encaminhado e alto potencial de recompra.";
  }

  if (customer.upcoming_appointments > 0) {
    return "Retorno já encaminhado, com agenda futura ajudando a proteger a recorrência.";
  }

  if (isVip) {
    return "Cliente VIP sem próxima agenda; vale puxar um retorno antes de esfriar.";
  }

  if (customer.completed_visits >= 3) {
    return "Cliente recorrente sem próxima agenda; boa candidata para rebook ou oferta inteligente.";
  }

  return "Cliente em construção de hábito com o salão; a próxima experiência ajuda a travar retenção.";
}

export default async function CustomersPage({ searchParams }: CustomersPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const q = firstParam(searchParams?.q).trim();
  const segment = normalizeSegment(firstParam(searchParams?.segment).trim() || "all");
  const sort = normalizeSort(firstParam(searchParams?.sort).trim() || "recent");
  const requestedPage = parsePage(searchParams?.page);

  const directoryResult = await supabase.rpc("get_owner_customer_directory", {
    search_input: q || null,
    segment_input: segment,
    sort_input: sort,
    page_input: requestedPage,
    page_size_input: PAGE_SIZE,
  });

  const directory = (directoryResult.data ?? {
    overview: {
      cashback_customers: 0,
      customers_with_upcoming_appointment: 0,
      returning_customers: 0,
      total_customers: 0,
      vip_customers: 0,
    },
    total_count: 0,
    total_pages: 1,
    page: 1,
    page_size: PAGE_SIZE,
    items: [],
  }) as CustomerDirectoryResponse;

  const customers = directory.items ?? [];
  const safePage = directory.page ?? 1;
  const totalPages = directory.total_pages ?? 1;
  const totalCount = directory.total_count ?? 0;
  const hasFilters = Boolean(q || segment !== "all" || sort !== "recent");
  const startItem = totalCount === 0 ? 0 : (safePage - 1) * PAGE_SIZE + 1;
  const endItem = totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );
  const customerIds = customers.map((customer) => customer.id);
  const customerBeautyProfileById = new Map<
    string,
    {
      allergies: string | null;
      beauty_products: string | null;
      preferences: string | null;
    }
  >();
  const latestCompletedHistoryByCustomerId = new Map<
    string,
    {
      last_completed_at: string | null;
      last_completed_service_name: string | null;
      last_completed_staff_member_name: string | null;
    }
  >();

  if (customerIds.length) {
    const [beautyProfilesResult, completedAppointmentsResult] = await Promise.all([
      supabase
        .from("customers")
        .select("id, preferences, allergies, beauty_products")
        .in("id", customerIds),
      supabase
        .from("appointments")
        .select("customer_id, date, completed_at, services(name), staff_members(name)")
        .eq("salon_id", salon.id)
        .eq("status", "completed")
        .in("customer_id", customerIds)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("date", { ascending: false }),
    ]);

    const beautyProfiles = (beautyProfilesResult.data ?? []) as Array<{
      allergies?: string | null;
      beauty_products?: string | null;
      id: string;
      preferences?: string | null;
    }>;

    for (const profile of beautyProfiles) {
      customerBeautyProfileById.set(profile.id, {
        allergies: normalizeText(profile.allergies),
        beauty_products: normalizeText(profile.beauty_products),
        preferences: normalizeText(profile.preferences),
      });
    }

    const completedAppointments = (completedAppointmentsResult.data ?? []) as Array<{
      completed_at: string | null;
      customer_id: string;
      date: string;
      services: { name?: string | null } | { name?: string | null }[] | null;
      staff_members: { name?: string | null } | { name?: string | null }[] | null;
    }>;

    for (const appointment of completedAppointments) {
      if (latestCompletedHistoryByCustomerId.has(appointment.customer_id)) {
        continue;
      }

      latestCompletedHistoryByCustomerId.set(appointment.customer_id, {
        last_completed_at: appointment.completed_at ?? appointment.date,
        last_completed_service_name: normalizeText(
          firstRelation(appointment.services)?.name,
        ),
        last_completed_staff_member_name: normalizeText(
          firstRelation(appointment.staff_members)?.name,
        ),
      });
    }
  }

  const hydratedCustomers = customers.map((customer) => ({
    ...customer,
    ...customerBeautyProfileById.get(customer.id),
    ...latestCompletedHistoryByCustomerId.get(customer.id),
  }));

  return (
    <div className="page-grid">
      <section className="stats-grid">
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Clientes no filtro</span>
          <p className="stat-value">{directory.overview.total_customers ?? 0}</p>
          <p className="metric-note">Base visível para o salão no recorte atual de busca.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Clientes VIP</span>
          <p className="stat-value">{directory.overview.vip_customers ?? 0}</p>
          <p className="metric-note">Clientes com o nível mais alto de fidelidade ativo.</p>
        </article>
        <article className="card metric-card metric-card--accent">
          <span className="eyebrow">Com cashback</span>
          <p className="stat-value">{directory.overview.cashback_customers ?? 0}</p>
          <p className="metric-note">Clientes com saldo pronto para usar em novas visitas.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Com agenda futura</span>
          <p className="stat-value">{directory.overview.customers_with_upcoming_appointment ?? 0}</p>
          <p className="metric-note">Clientes já amarrados em retorno próximo com o salão.</p>
        </article>
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Recorrentes</span>
          <p className="stat-value">{directory.overview.returning_customers ?? 0}</p>
          <p className="metric-note">Clientes com pelo menos duas visitas concluídas.</p>
        </article>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Clientes</h2>
            <p className="muted">Trate essa área como um CRM leve do salão: retenção, recorrência, cashback e agenda futura.</p>
          </div>
        </div>

        <form method="get" className="services-toolbar" style={{ marginTop: 18 }}>
          <div className="customers-toolbar__grid">
            <div className="field">
              <label htmlFor="customers-search">Buscar cliente</label>
              <input
                id="customers-search"
                name="q"
                placeholder="Nome ou código de indicação"
                defaultValue={q}
              />
            </div>

            <div className="field">
              <label htmlFor="customers-segment">Segmento</label>
              <select id="customers-segment" name="segment" defaultValue={segment}>
                <option value="all">Todos</option>
                <option value="vip">VIP</option>
                <option value="cashback">Com cashback</option>
                <option value="returning">Recorrentes</option>
                <option value="upcoming">Com agenda futura</option>
                <option value="new">Novos em 30 dias</option>
              </select>
            </div>

            <div className="field">
              <label htmlFor="customers-sort">Ordenar por</label>
              <select id="customers-sort" name="sort" defaultValue={sort}>
                <option value="recent">Entrada recente</option>
                <option value="name">Nome</option>
                <option value="loyalty">Pontos e visitas</option>
                <option value="spent">Maior gasto</option>
                <option value="upcoming">Próximo atendimento</option>
              </select>
            </div>
          </div>

          <input type="hidden" name="page" value="1" />

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar clientes
            </button>
            <span className="services-toolbar__count">
              {totalCount} {totalCount === 1 ? "cliente encontrado" : "clientes encontrados"}
            </span>
            {hasFilters ? (
              <a href="/dashboard/customers" className="secondary-button services-toolbar__clear">
                Limpar filtros
              </a>
            ) : null}
          </div>
        </form>

        <div className="row-list" style={{ marginTop: 16 }}>
          {!customers.length ? (
            <EmptyStateCard
              eyebrow={hasFilters ? "Nenhum resultado" : "Sem clientes ainda"}
              title={hasFilters ? "Nenhum cliente encontrado nesse recorte" : "Nenhum cliente vinculado"}
              description={
                hasFilters
                  ? "Ajuste a busca, o segmento ou a ordenação para encontrar o perfil certo."
                  : "Assim que alguém entrar com o código do seu salão, o nome vai aparecer aqui com histórico e fidelidade."
              }
            />
          ) : (
            hydratedCustomers.map((customer) => (
              <article key={customer.id} className="list-row customer-card">
                <div className="customer-card__content">
                  <div className="customer-card__header">
                    <div className="customer-card__identity">
                      <div className="list-row__content">
                        <h3>{customer.name}</h3>
                        <div className="customer-card__badges">
                          {customer.current_tier ? (
                            <span className={customer.current_tier.is_vip ? "badge badge--confirmed" : "badge badge--soft"}>
                              {customer.current_tier.label}
                            </span>
                          ) : (
                            <span className="badge badge--soft">Sem fidelidade ativa</span>
                          )}
                          {customer.current_tier?.is_vip ? <span className="badge badge--confirmed">VIP</span> : null}
                          {customer.referral_code ? (
                            <span className="badge badge--pending">Código {customer.referral_code}</span>
                          ) : null}
                        </div>
                      </div>
                      <p className="customer-card__summary">{buildCustomerRelationshipSummary(customer)}</p>
                    </div>
                  </div>

                  <div className="customer-card__details">
                    <div className="customer-detail-item">
                      <span className="customer-detail-item__label">Entrou no salão</span>
                      <strong>{formatDate(customer.created_at)}</strong>
                    </div>
                    <div className="customer-detail-item">
                      <span className="customer-detail-item__label">Última visita</span>
                      <strong>{customer.last_visit_at ? formatDateTime(customer.last_visit_at) : "Ainda não concluiu atendimento"}</strong>
                    </div>
                    <div className="customer-detail-item">
                      <span className="customer-detail-item__label">Próximo horário</span>
                      <strong>{customer.next_appointment_at ? formatDateTime(customer.next_appointment_at) : "Sem agendamento futuro"}</strong>
                    </div>
                    <div className="customer-detail-item">
                      <span className="customer-detail-item__label">Agenda aberta</span>
                      <strong>
                        {customer.upcoming_appointments} futuro{customer.upcoming_appointments === 1 ? "" : "s"} •{" "}
                        {customer.pending_appointments} pendente{customer.pending_appointments === 1 ? "" : "s"}
                      </strong>
                    </div>
                  </div>

                  <div className="customer-card__metrics">
                    <div className="customer-metric-tile">
                      <span className="customer-detail-item__label">Visitas</span>
                      <strong>{customer.completed_visits}</strong>
                    </div>
                    <div className="customer-metric-tile">
                      <span className="customer-detail-item__label">Pontos</span>
                      <strong>{customer.points_balance}</strong>
                    </div>
                    <div className="customer-metric-tile">
                      <span className="customer-detail-item__label">Cashback</span>
                      <strong>{formatCurrency(Number(customer.cashback_balance ?? 0))}</strong>
                    </div>
                    <div className="customer-metric-tile">
                      <span className="customer-detail-item__label">Gasto concluído</span>
                      <strong>{formatCurrency(Number(customer.total_spent ?? 0))}</strong>
                    </div>
                  </div>

                  {customer.preferences ||
                  customer.allergies ||
                  customer.beauty_products ||
                  customer.last_completed_service_name ? (
                    <div className="customer-card__section">
                      <div className="customer-card__section-heading">
                        <span className="eyebrow">Prontuário rápido</span>
                        <small className="list-meta">
                          Último resultado, preferências e cuidados que ajudam o salão a manter consistência no próximo atendimento.
                        </small>
                      </div>

                      <div className="customer-card__beauty">
                        {customer.last_completed_service_name ? (
                          <div className="customer-detail-item">
                            <span className="customer-detail-item__label">Último resultado registrado</span>
                            <strong>
                              {customer.last_completed_service_name}
                              {customer.last_completed_staff_member_name
                                ? ` • com ${customer.last_completed_staff_member_name}`
                                : ""}
                              {customer.last_completed_at
                                ? ` • ${formatDateTime(customer.last_completed_at)}`
                                : ""}
                            </strong>
                          </div>
                        ) : null}
                        {customer.preferences ? (
                          <div className="customer-detail-item">
                            <span className="customer-detail-item__label">Preferências</span>
                            <strong>{customer.preferences}</strong>
                          </div>
                        ) : null}
                        {customer.beauty_products ? (
                          <div className="customer-detail-item">
                            <span className="customer-detail-item__label">Produtos usados ou preferidos</span>
                            <strong>{customer.beauty_products}</strong>
                          </div>
                        ) : null}
                        {customer.allergies ? (
                          <div className="customer-detail-item">
                            <span className="customer-detail-item__label">Alergias e cuidados</span>
                            <strong>{customer.allergies}</strong>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}

                  {customer.current_tier ? (
                    <div className="customer-card__footer">
                      <small className="list-meta">
                        Desconto atual de {formatTierDiscount(customer.current_tier.discount_percent)}% para esse cliente
                        {customer.last_reward_at ? ` • última recompensa em ${formatDateTime(customer.last_reward_at)}` : ""}.
                      </small>
                    </div>
                  ) : null}
                </div>
              </article>
            ))
          )}
        </div>

        {totalPages > 1 ? (
          <nav className="notifications-pagination" aria-label="Paginação dos clientes">
            <div className="notifications-pagination__summary">
              Exibindo de {startItem} até {endItem} de {totalCount}. Página {safePage} de {totalPages}.
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
