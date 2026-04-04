import Link from "next/link";

import {
  assignCustomerMembershipPackageAction,
  saveOwnerCustomerProfileAction,
  sendCustomerNudgeAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type CustomersPageProps = {
  searchParams?: {
    message?: string;
    page?: string | string[];
    q?: string | string[];
    segment?: string | string[];
    sort?: string | string[];
    tone?: string;
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
  beauty_goals?: string | null;
  beauty_products?: string | null;
  cashback_balance: number | string;
  completed_visits: number;
  consent_signed_at?: string | null;
  consent_status?: "pending" | "signed" | "not_required" | null;
  consent_version?: string | null;
  contraindications?: string | null;
  created_at: string;
  crm_label?: string | null;
  current_tier: LoyaltyTierSnapshot | null;
  id: string;
  internal_notes?: string | null;
  last_reward_at: string | null;
  last_assessment_at?: string | null;
  last_visit_at: string | null;
  name: string;
  next_appointment_at: string | null;
  pending_appointments: number;
  phone?: string | null;
  points_balance: number;
  preferences?: string | null;
  referral_code: string | null;
  technical_notes?: string | null;
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

type MembershipOfferOption = {
  id: string;
  title: string;
  membership_service_id: string | null;
  membership_sessions_included: number | null;
  membership_validity_days: number | null;
  price: number | string | null;
};

type CustomerMembershipRecord = {
  created_at: string;
  customer_id: string;
  expires_at: string;
  id: string;
  notes: string | null;
  price_snapshot: number | string | null;
  service_id: string | null;
  service_name_snapshot: string;
  sessions_included: number;
  sessions_used: number;
  started_at: string;
  status: "active" | "completed" | "expired" | "cancelled";
  title: string;
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

function normalizeConsentStatus(value?: string | null) {
  if (value === "pending" || value === "signed" || value === "not_required") {
    return value;
  }

  return "not_required";
}

function normalizePhone(value?: string | null) {
  const digits = value?.replace(/\D/g, "") ?? "";
  return digits || null;
}

function formatPhone(value?: string | null) {
  const digits = normalizePhone(value);

  if (!digits) {
    return null;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

function buildWhatsAppHref(value?: string | null) {
  const digits = normalizePhone(value);

  if (!digits || digits.length < 10 || digits.length > 15) {
    return null;
  }

  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountryCode}`;
}

function formatConsentStatus(value?: string | null) {
  switch (normalizeConsentStatus(value)) {
    case "pending":
      return "Consentimento pendente";
    case "signed":
      return "Consentimento assinado";
    default:
      return "Sem termo exigido";
  }
}

function getConsentTone(value?: string | null) {
  switch (normalizeConsentStatus(value)) {
    case "pending":
      return "badge badge--pending";
    case "signed":
      return "badge badge--confirmed";
    default:
      return "badge badge--soft";
  }
}

function toNumber(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

function toTimestamp(value?: string | null) {
  if (!value) {
    return 0;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
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

function getSegmentLabel(segment: ReturnType<typeof normalizeSegment>) {
  switch (segment) {
    case "vip":
      return "VIP";
    case "cashback":
      return "Cashback";
    case "returning":
      return "Recorrentes";
    case "upcoming":
      return "Com agenda futura";
    case "new":
      return "Novos em 30 dias";
    default:
      return "Base completa";
  }
}

function getSortLabel(sort: ReturnType<typeof normalizeSort>) {
  switch (sort) {
    case "name":
      return "Nome";
    case "loyalty":
      return "Fidelidade";
    case "spent":
      return "Maior gasto";
    case "upcoming":
      return "Próximo atendimento";
    default:
      return "Entrada recente";
  }
}

function compareCustomersByAttention(
  left: CustomerDirectoryItem,
  right: CustomerDirectoryItem,
) {
  const vipDifference =
    Number(right.current_tier?.is_vip ?? false) -
    Number(left.current_tier?.is_vip ?? false);
  if (vipDifference !== 0) {
    return vipDifference;
  }

  const spentDifference =
    toNumber(right.total_spent) - toNumber(left.total_spent);
  if (spentDifference !== 0) {
    return spentDifference;
  }

  const cashbackDifference =
    toNumber(right.cashback_balance) - toNumber(left.cashback_balance);
  if (cashbackDifference !== 0) {
    return cashbackDifference;
  }

  const visitsDifference = right.completed_visits - left.completed_visits;
  if (visitsDifference !== 0) {
    return visitsDifference;
  }

  return (
    toTimestamp(right.last_visit_at ?? right.created_at) -
    toTimestamp(left.last_visit_at ?? left.created_at)
  );
}

function buildCustomerMomentumLabel(customer: CustomerDirectoryItem) {
  if (customer.upcoming_appointments > 0) {
    return `${customer.upcoming_appointments} agenda${
      customer.upcoming_appointments === 1 ? "" : "s"
    } futura${customer.upcoming_appointments === 1 ? "" : "s"}`;
  }

  if (customer.current_tier?.is_vip) {
    return `VIP ${customer.current_tier.label}`;
  }

  if (toNumber(customer.cashback_balance) > 0) {
    return `${formatCurrency(toNumber(customer.cashback_balance))} em cashback`;
  }

  if (customer.completed_visits > 0) {
    return `${customer.completed_visits} visita${
      customer.completed_visits === 1 ? "" : "s"
    } concluída${customer.completed_visits === 1 ? "" : "s"}`;
  }

  return `Entrou em ${formatDate(customer.created_at)}`;
}

function resolveCustomerMembershipStatus(
  membership: CustomerMembershipRecord,
  today: string,
) {
  if (membership.status === "cancelled") {
    return "cancelled";
  }

  if (membership.sessions_used >= membership.sessions_included) {
    return "completed";
  }

  if (membership.expires_at < today || membership.status === "expired") {
    return "expired";
  }

  return "active";
}

function formatCustomerMembershipStatusLabel(
  status: ReturnType<typeof resolveCustomerMembershipStatus>,
) {
  switch (status) {
    case "completed":
      return "Pacote concluído";
    case "expired":
      return "Pacote expirado";
    case "cancelled":
      return "Pacote cancelado";
    default:
      return "Pacote ativo";
  }
}

function customerMembershipBadgeClass(
  status: ReturnType<typeof resolveCustomerMembershipStatus>,
) {
  switch (status) {
    case "completed":
      return "badge badge--confirmed";
    case "expired":
      return "badge badge--cancelled";
    case "cancelled":
      return "badge badge--soft";
    default:
      return "badge badge--accent";
  }
}

export default async function CustomersPage({
  searchParams,
}: CustomersPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const q = firstParam(searchParams?.q).trim();
  const segment = normalizeSegment(
    firstParam(searchParams?.segment).trim() || "all",
  );
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
  const endItem =
    totalCount === 0 ? 0 : Math.min(safePage * PAGE_SIZE, totalCount);
  const pageNumbers = Array.from(
    new Set(
      [safePage - 1, safePage, safePage + 1].filter(
        (value) => value >= 1 && value <= totalPages,
      ),
    ),
  );
  const customerIds = customers.map((customer) => customer.id);
  const today = new Date().toISOString().slice(0, 10);
  const customerBeautyProfileById = new Map<
    string,
    {
      allergies: string | null;
      beauty_goals: string | null;
      beauty_products: string | null;
      consent_signed_at: string | null;
      consent_status: "pending" | "signed" | "not_required";
      consent_version: string | null;
      contraindications: string | null;
      crm_label: string | null;
      internal_notes: string | null;
      last_assessment_at: string | null;
      phone: string | null;
      preferences: string | null;
      technical_notes: string | null;
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
  const customerMembershipsByCustomerId = new Map<
    string,
    CustomerMembershipRecord[]
  >();

  const [operationalMembershipOffersResult, serviceCatalogResult] =
    await Promise.all([
      supabase
        .from("salon_offers")
        .select(
          "id, title, membership_service_id, membership_sessions_included, membership_validity_days, price",
        )
        .eq("salon_id", salon.id)
        .eq("kind", "membership")
        .eq("is_active", true)
        .not("membership_service_id", "is", null)
        .not("membership_sessions_included", "is", null)
        .not("membership_validity_days", "is", null)
        .order("sort_order")
        .order("created_at"),
      supabase
        .from("services")
        .select("id, name, category")
        .eq("salon_id", salon.id)
        .order("sort_order")
        .order("name"),
    ]);

  const operationalMembershipOffers = (operationalMembershipOffersResult.data ??
    []) as MembershipOfferOption[];
  const serviceNameById = new Map(
    (
      (serviceCatalogResult.data ?? []) as Array<{
        category?: string | null;
        id: string;
        name: string;
      }>
    ).map((service) => [
      service.id,
      service.category ? `${service.category} • ${service.name}` : service.name,
    ]),
  );

  if (customerIds.length) {
    const [
      beautyProfilesResult,
      completedAppointmentsResult,
      membershipsResult,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select(
          "id, phone, preferences, allergies, beauty_products, crm_label, internal_notes, beauty_goals, contraindications, technical_notes, consent_status, consent_signed_at, consent_version, last_assessment_at",
        )
        .in("id", customerIds),
      supabase
        .from("appointments")
        .select(
          "customer_id, date, completed_at, services(name), staff_members(name)",
        )
        .eq("salon_id", salon.id)
        .eq("status", "completed")
        .in("customer_id", customerIds)
        .order("completed_at", { ascending: false, nullsFirst: false })
        .order("date", { ascending: false }),
      supabase
        .from("customer_memberships")
        .select(
          "id, customer_id, title, service_id, service_name_snapshot, price_snapshot, sessions_included, sessions_used, started_at, expires_at, status, notes, created_at",
        )
        .eq("salon_id", salon.id)
        .in("customer_id", customerIds)
        .order("created_at", { ascending: false }),
    ]);

    const beautyProfiles = (beautyProfilesResult.data ?? []) as Array<{
      allergies?: string | null;
      beauty_goals?: string | null;
      beauty_products?: string | null;
      consent_signed_at?: string | null;
      consent_status?: "pending" | "signed" | "not_required" | null;
      consent_version?: string | null;
      contraindications?: string | null;
      crm_label?: string | null;
      id: string;
      internal_notes?: string | null;
      last_assessment_at?: string | null;
      phone?: string | null;
      preferences?: string | null;
      technical_notes?: string | null;
    }>;

    for (const profile of beautyProfiles) {
      customerBeautyProfileById.set(profile.id, {
        allergies: normalizeText(profile.allergies),
        beauty_goals: normalizeText(profile.beauty_goals),
        beauty_products: normalizeText(profile.beauty_products),
        consent_signed_at: profile.consent_signed_at ?? null,
        consent_status: normalizeConsentStatus(profile.consent_status),
        consent_version: normalizeText(profile.consent_version),
        contraindications: normalizeText(profile.contraindications),
        crm_label: normalizeText(profile.crm_label),
        internal_notes: normalizeText(profile.internal_notes),
        last_assessment_at: profile.last_assessment_at ?? null,
        phone: normalizePhone(profile.phone),
        preferences: normalizeText(profile.preferences),
        technical_notes: normalizeText(profile.technical_notes),
      });
    }

    const completedAppointments = (completedAppointmentsResult.data ??
      []) as Array<{
      completed_at: string | null;
      customer_id: string;
      date: string;
      services: { name?: string | null } | { name?: string | null }[] | null;
      staff_members:
        | { name?: string | null }
        | { name?: string | null }[]
        | null;
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

    const memberships = (membershipsResult.data ??
      []) as CustomerMembershipRecord[];
    for (const membership of memberships) {
      const currentMemberships =
        customerMembershipsByCustomerId.get(membership.customer_id) ?? [];

      currentMemberships.push(membership);
      currentMemberships.sort((left, right) => {
        const leftStatus = resolveCustomerMembershipStatus(left, today);
        const rightStatus = resolveCustomerMembershipStatus(right, today);
        const leftPriority =
          leftStatus === "active"
            ? 0
            : leftStatus === "completed"
              ? 1
              : leftStatus === "expired"
                ? 2
                : 3;
        const rightPriority =
          rightStatus === "active"
            ? 0
            : rightStatus === "completed"
              ? 1
              : rightStatus === "expired"
                ? 2
                : 3;

        if (leftPriority !== rightPriority) {
          return leftPriority - rightPriority;
        }

        return toTimestamp(right.created_at) - toTimestamp(left.created_at);
      });
      customerMembershipsByCustomerId.set(
        membership.customer_id,
        currentMemberships,
      );
    }
  }

  const hydratedCustomers = customers.map((customer) => ({
    ...customer,
    ...customerBeautyProfileById.get(customer.id),
    ...latestCompletedHistoryByCustomerId.get(customer.id),
  }));
  const currentFocusLabel = getSegmentLabel(segment);
  const currentSortLabel = getSortLabel(sort);
  const topCustomerBySpend = [...hydratedCustomers].sort(
    (left, right) =>
      Number(right.total_spent ?? 0) - Number(left.total_spent ?? 0),
  )[0];
  const customersWithoutUpcoming = hydratedCustomers.filter(
    (customer) => customer.upcoming_appointments === 0,
  );
  const customersWithUpcoming = hydratedCustomers.filter(
    (customer) => customer.upcoming_appointments > 0,
  );
  const reactivationCandidates = [...customersWithoutUpcoming]
    .filter(
      (customer) =>
        customer.completed_visits > 0 ||
        toNumber(customer.total_spent) > 0 ||
        toNumber(customer.cashback_balance) > 0 ||
        customer.current_tier?.is_vip,
    )
    .sort(compareCustomersByAttention)
    .slice(0, 3);
  const cashbackRecoveryCandidates = [...customersWithoutUpcoming]
    .filter((customer) => toNumber(customer.cashback_balance) > 0)
    .sort(
      (left, right) =>
        toNumber(right.cashback_balance) - toNumber(left.cashback_balance) ||
        compareCustomersByAttention(left, right),
    )
    .slice(0, 3);
  const protectedRecurringCustomers = [...customersWithUpcoming]
    .sort(compareCustomersByAttention)
    .slice(0, 3);
  const firstReturnCandidates = [...customersWithoutUpcoming]
    .filter((customer) => customer.completed_visits <= 1)
    .sort(
      (left, right) =>
        toTimestamp(right.created_at) - toTimestamp(left.created_at),
    )
    .slice(0, 3);
  const visibleRevenueAtRisk = customersWithoutUpcoming.reduce(
    (total, customer) => total + toNumber(customer.total_spent),
    0,
  );
  const visibleCashbackBalance = customersWithoutUpcoming.reduce(
    (total, customer) => total + toNumber(customer.cashback_balance),
    0,
  );
  const vipWithoutUpcomingCount = customersWithoutUpcoming.filter(
    (customer) => customer.current_tier?.is_vip,
  ).length;
  const freshRelationshipCount = customersWithoutUpcoming.filter(
    (customer) => customer.completed_visits <= 1,
  ).length;
  const currentReturnPath = buildHref(searchParams, {});

  return (
    <div className="page-grid workspace-page customers-page">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        eyebrow="CRM do salão"
        title="Clientes, recorrência e valor vitalício em uma leitura só."
        description="A base de clientes agora aparece como operação viva: quem volta, quem já tem próxima agenda, quem carrega cashback e quem merece ação comercial antes de esfriar."
        highlight={{
          label: "Foco do recorte",
          value: currentFocusLabel,
          note: hasFilters
            ? `Ordenação atual em ${currentSortLabel.toLowerCase()} com ${totalCount} cliente${totalCount === 1 ? "" : "s"} visíveis.`
            : "Sem filtro ativo, olhando a carteira completa do salão.",
        }}
        signals={[
          {
            label: "Ordenação",
            value: currentSortLabel,
            tone: "soft",
          },
          {
            label: "Agenda futura",
            value: directory.overview.customers_with_upcoming_appointment ?? 0,
            tone: "accent",
          },
          {
            label: "Recorrentes",
            value: directory.overview.returning_customers ?? 0,
            tone: "warm",
          },
        ]}
        stats={[
          {
            label: "Clientes no filtro",
            value: directory.overview.total_customers ?? 0,
            note: "Base visível para o salão dentro do recorte atual.",
            tone: "warm",
          },
          {
            label: "Clientes VIP",
            value: directory.overview.vip_customers ?? 0,
            note: "Perfis com fidelidade alta e maior expectativa de retenção.",
            tone: "soft",
          },
          {
            label: "Com cashback",
            value: directory.overview.cashback_customers ?? 0,
            note: "Clientes com saldo pronto para virar nova visita.",
            tone: "accent",
          },
          {
            label: "Agenda futura",
            value: directory.overview.customers_with_upcoming_appointment ?? 0,
            note: "Retornos já protegidos na agenda do salão.",
            tone: "success",
          },
        ]}
        aside={
          <>
            <span className="workspace-panel__eyebrow">Leitura executiva</span>
            <h3>
              {topCustomerBySpend
                ? `${topCustomerBySpend.name} puxa o maior gasto visível.`
                : "A carteira está pronta para ganhar densidade."}
            </h3>
            <p>
              {topCustomerBySpend
                ? `${topCustomerBySpend.name} lidera o gasto concluído visível nesta base. Use esse bloco para decidir retenção, resgate de cliente e próximas campanhas.`
                : "Assim que a base crescer, esta área passa a mostrar quem já tem maior potencial de recompra e relacionamento."}
            </p>
          </>
        }
      />

      <section
        className="customers-command-deck"
        aria-label="Cockpit de retenção"
      >
        <article className="card insight-card customer-command-card customer-command-card--priority">
          <div className="customer-command-card__topline">
            <span className="workspace-panel__eyebrow">
              Prioridade comercial
            </span>
            <span className="customer-command-card__metric">
              {reactivationCandidates.length}
            </span>
          </div>
          <div className="customer-command-card__header">
            <div>
              <h2>Clientes para reativar hoje</h2>
              <p>
                {reactivationCandidates.length > 0
                  ? `Existe ${formatCurrency(visibleRevenueAtRisk)} em histórico concluído visível sem próxima agenda.`
                  : "A base filtrada não mostra clientes quentes sem próximo horário neste momento."}
              </p>
            </div>
          </div>
          <div className="customer-command-card__chips">
            <span className="badge badge--soft">
              {customersWithoutUpcoming.length} sem agenda futura
            </span>
            <span className="badge badge--pending">
              {vipWithoutUpcomingCount} VIP precisando de retorno
            </span>
          </div>
          <div className="customer-command-card__list">
            {reactivationCandidates.length > 0 ? (
              reactivationCandidates.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/dashboard/appointments?q=${encodeURIComponent(customer.name)}`}
                  className="customer-command-card__customer"
                >
                  <strong>{customer.name}</strong>
                  <span>{buildCustomerMomentumLabel(customer)}</span>
                  <small>
                    {customer.last_visit_at
                      ? `Última visita em ${formatDateTime(customer.last_visit_at)}`
                      : "Ainda sem atendimento concluído no histórico."}
                  </small>
                </Link>
              ))
            ) : (
              <p className="customer-command-card__empty">
                Quando aparecer alguém importante sem retorno protegido, esta
                área sobe os nomes automaticamente.
              </p>
            )}
          </div>
          <div className="insight-card__footer">
            <Link
              href={buildHref(searchParams, { segment: "returning", page: 1 })}
              className="secondary-button"
            >
              Abrir recorrentes
            </Link>
          </div>
        </article>

        <article className="card insight-card customer-command-card customer-command-card--cashback">
          <div className="customer-command-card__topline">
            <span className="workspace-panel__eyebrow">
              Saldo pronto para virar agenda
            </span>
            <span className="customer-command-card__metric">
              {formatCurrency(visibleCashbackBalance)}
            </span>
          </div>
          <div className="customer-command-card__header">
            <div>
              <h2>Cashback esperando ação</h2>
              <p>
                Clientes com saldo e sem próxima agenda costumam responder bem a
                rebook, resgate ou combo de retorno.
              </p>
            </div>
          </div>
          <div className="customer-command-card__chips">
            <span className="badge badge--accent">
              {cashbackRecoveryCandidates.length} nome
              {cashbackRecoveryCandidates.length === 1 ? "" : "s"} no topo
            </span>
            <span className="badge badge--soft">
              {formatCurrency(
                cashbackRecoveryCandidates.reduce(
                  (total, customer) =>
                    total + toNumber(customer.cashback_balance),
                  0,
                ),
              )}{" "}
              nos maiores saldos
            </span>
          </div>
          <div className="customer-command-card__list">
            {cashbackRecoveryCandidates.length > 0 ? (
              cashbackRecoveryCandidates.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/dashboard/appointments?q=${encodeURIComponent(customer.name)}`}
                  className="customer-command-card__customer"
                >
                  <strong>{customer.name}</strong>
                  <span>
                    {formatCurrency(toNumber(customer.cashback_balance))} em
                    cashback
                  </span>
                  <small>
                    {customer.next_appointment_at
                      ? `Próximo horário em ${formatDateTime(customer.next_appointment_at)}`
                      : "Sem retorno protegido na agenda."}
                  </small>
                </Link>
              ))
            ) : (
              <p className="customer-command-card__empty">
                Nenhum saldo parado apareceu neste recorte. Bom sinal para uso
                do benefício ou para filtros mais específicos.
              </p>
            )}
          </div>
          <div className="insight-card__footer">
            <Link
              href={buildHref(searchParams, { segment: "cashback", page: 1 })}
              className="secondary-button"
            >
              Ver clientes com cashback
            </Link>
          </div>
        </article>

        <article className="card insight-card customer-command-card customer-command-card--retention">
          <div className="customer-command-card__topline">
            <span className="workspace-panel__eyebrow">
              Retenção já protegida
            </span>
            <span className="customer-command-card__metric">
              {customersWithUpcoming.length}
            </span>
          </div>
          <div className="customer-command-card__header">
            <div>
              <h2>Clientes com próxima visita encaminhada</h2>
              <p>
                Este bloco mostra quem já está com o próximo passo travado na
                agenda e ajuda a enxergar recorrência protegida.
              </p>
            </div>
          </div>
          <div className="customer-command-card__chips">
            <span className="badge badge--confirmed">
              {
                protectedRecurringCustomers.filter(
                  (customer) => customer.current_tier?.is_vip,
                ).length
              }{" "}
              VIP com retorno protegido
            </span>
            <span className="badge badge--soft">
              {directory.overview.customers_with_upcoming_appointment ?? 0} na
              carteira com agenda futura
            </span>
          </div>
          <div className="customer-command-card__list">
            {protectedRecurringCustomers.length > 0 ? (
              protectedRecurringCustomers.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/dashboard/appointments?q=${encodeURIComponent(customer.name)}&status=confirmed`}
                  className="customer-command-card__customer"
                >
                  <strong>{customer.name}</strong>
                  <span>{buildCustomerMomentumLabel(customer)}</span>
                  <small>
                    {customer.next_appointment_at
                      ? `Próximo horário em ${formatDateTime(customer.next_appointment_at)}`
                      : "Agenda futura identificada neste filtro."}
                  </small>
                </Link>
              ))
            ) : (
              <p className="customer-command-card__empty">
                Ainda não há clientes com recorrência protegida nesta leitura.
                Esse é o bloco que cresce quando o rebook começa a funcionar.
              </p>
            )}
          </div>
          <div className="insight-card__footer">
            <Link
              href={buildHref(searchParams, { segment: "upcoming", page: 1 })}
              className="secondary-button"
            >
              Abrir agenda futura
            </Link>
          </div>
        </article>

        <article className="card insight-card customer-command-card customer-command-card--warmup">
          <div className="customer-command-card__topline">
            <span className="workspace-panel__eyebrow">
              Construção de hábito
            </span>
            <span className="customer-command-card__metric">
              {freshRelationshipCount}
            </span>
          </div>
          <div className="customer-command-card__header">
            <div>
              <h2>Novos clientes pedindo segundo passo</h2>
              <p>
                Quem ainda não travou a rotina precisa de acompanhamento cedo.
                Aqui ficam os nomes mais recentes sem próxima agenda.
              </p>
            </div>
          </div>
          <div className="customer-command-card__chips">
            <span className="badge badge--warm">
              {firstReturnCandidates.length} prioridade
              {firstReturnCandidates.length === 1 ? "" : "s"} recente
              {firstReturnCandidates.length === 1 ? "" : "s"}
            </span>
            <span className="badge badge--soft">
              {directory.overview.total_customers ?? 0} clientes visíveis no
              recorte
            </span>
          </div>
          <div className="customer-command-card__list">
            {firstReturnCandidates.length > 0 ? (
              firstReturnCandidates.map((customer) => (
                <Link
                  key={customer.id}
                  href={`/dashboard/appointments?q=${encodeURIComponent(customer.name)}`}
                  className="customer-command-card__customer"
                >
                  <strong>{customer.name}</strong>
                  <span>{buildCustomerMomentumLabel(customer)}</span>
                  <small>
                    {customer.created_at
                      ? `Entrou em ${formatDateTime(customer.created_at)}`
                      : "Cliente recente sem histórico suficiente."}
                  </small>
                </Link>
              ))
            ) : (
              <p className="customer-command-card__empty">
                Quando novos clientes aparecerem sem segunda visita encaminhada,
                eles entram aqui para o salão agir cedo.
              </p>
            )}
          </div>
          <div className="insight-card__footer">
            <Link
              href={buildHref(searchParams, { segment: "new", page: 1 })}
              className="secondary-button"
            >
              Ver novos clientes
            </Link>
          </div>
        </article>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Clientes</h2>
            <p className="muted">
              Trate essa área como um CRM leve do salão: retenção, recorrência,
              cashback e agenda futura.
            </p>
          </div>
        </div>

        <form
          method="get"
          className="services-toolbar"
          style={{ marginTop: 18 }}
        >
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
              <select
                id="customers-segment"
                name="segment"
                defaultValue={segment}
              >
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
              {totalCount}{" "}
              {totalCount === 1 ? "cliente encontrado" : "clientes encontrados"}
            </span>
            {hasFilters ? (
              <a
                href="/dashboard/customers"
                className="secondary-button services-toolbar__clear"
              >
                Limpar filtros
              </a>
            ) : null}
          </div>
        </form>

        <div className="row-list" style={{ marginTop: 16 }}>
          {!customers.length ? (
            <EmptyStateCard
              eyebrow={hasFilters ? "Nenhum resultado" : "Sem clientes ainda"}
              title={
                hasFilters
                  ? "Nenhum cliente encontrado nesse recorte"
                  : "Nenhum cliente vinculado"
              }
              description={
                hasFilters
                  ? "Ajuste a busca, o segmento ou a ordenação para encontrar o perfil certo."
                  : "Assim que alguém entrar com o código do seu salão, o nome vai aparecer aqui com histórico e fidelidade."
              }
            />
          ) : (
            hydratedCustomers.map((customer) => {
              const customerMemberships =
                customerMembershipsByCustomerId.get(customer.id) ?? [];

              return (
                <article key={customer.id} className="list-row customer-card">
                  <div className="customer-card__content">
                    <div className="customer-card__header">
                      <div className="customer-card__identity">
                        <div className="list-row__content">
                          <h3>{customer.name}</h3>
                          <div className="customer-card__badges">
                            {customer.current_tier ? (
                              <span
                                className={
                                  customer.current_tier.is_vip
                                    ? "badge badge--confirmed"
                                    : "badge badge--soft"
                                }
                              >
                                {customer.current_tier.label}
                              </span>
                            ) : (
                              <span className="badge badge--soft">
                                Sem fidelidade ativa
                              </span>
                            )}
                            {customer.crm_label ? (
                              <span className="badge badge--accent">
                                {customer.crm_label}
                              </span>
                            ) : null}
                            {customer.current_tier?.is_vip ? (
                              <span className="badge badge--confirmed">
                                VIP
                              </span>
                            ) : null}
                            {customer.consent_status &&
                            customer.consent_status !== "not_required" ? (
                              <span
                                className={getConsentTone(
                                  customer.consent_status,
                                )}
                              >
                                {formatConsentStatus(customer.consent_status)}
                              </span>
                            ) : null}
                            {customer.referral_code ? (
                              <span className="badge badge--pending">
                                Código {customer.referral_code}
                              </span>
                            ) : null}
                          </div>
                        </div>
                        <p className="customer-card__summary">
                          {buildCustomerRelationshipSummary(customer)}
                        </p>
                      </div>
                    </div>

                    <div className="customer-card__details">
                      <div className="customer-detail-item">
                        <span className="customer-detail-item__label">
                          Entrou no salão
                        </span>
                        <strong>{formatDate(customer.created_at)}</strong>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-item__label">
                          Última visita
                        </span>
                        <strong>
                          {customer.last_visit_at
                            ? formatDateTime(customer.last_visit_at)
                            : "Ainda não concluiu atendimento"}
                        </strong>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-item__label">
                          Próximo horário
                        </span>
                        <strong>
                          {customer.next_appointment_at
                            ? formatDateTime(customer.next_appointment_at)
                            : "Sem agendamento futuro"}
                        </strong>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-item__label">
                          Agenda aberta
                        </span>
                        <strong>
                          {customer.upcoming_appointments} futuro
                          {customer.upcoming_appointments === 1 ? "" : "s"} •{" "}
                          {customer.pending_appointments} pendente
                          {customer.pending_appointments === 1 ? "" : "s"}
                        </strong>
                      </div>
                      <div className="customer-detail-item">
                        <span className="customer-detail-item__label">
                          Contato
                        </span>
                        <strong>
                          {formatPhone(customer.phone) ??
                            "Telefone ainda não registrado"}
                        </strong>
                      </div>
                    </div>

                    <div className="customer-card__metrics">
                      <div className="customer-metric-tile">
                        <span className="customer-detail-item__label">
                          Visitas
                        </span>
                        <strong>{customer.completed_visits}</strong>
                      </div>
                      <div className="customer-metric-tile">
                        <span className="customer-detail-item__label">
                          Pontos
                        </span>
                        <strong>{customer.points_balance}</strong>
                      </div>
                      <div className="customer-metric-tile">
                        <span className="customer-detail-item__label">
                          Cashback
                        </span>
                        <strong>
                          {formatCurrency(
                            Number(customer.cashback_balance ?? 0),
                          )}
                        </strong>
                      </div>
                      <div className="customer-metric-tile">
                        <span className="customer-detail-item__label">
                          Gasto concluído
                        </span>
                        <strong>
                          {formatCurrency(Number(customer.total_spent ?? 0))}
                        </strong>
                      </div>
                    </div>

                    <div className="customer-card__actions">
                      <Link
                        href={`/dashboard/appointments?q=${encodeURIComponent(customer.name)}`}
                        className="secondary-button"
                      >
                        Abrir agenda desse cliente
                      </Link>
                      {customer.upcoming_appointments > 0 ? (
                        <Link
                          href={`/dashboard/appointments?q=${encodeURIComponent(customer.name)}&status=confirmed`}
                          className="secondary-button"
                        >
                          Ver próximos horários
                        </Link>
                      ) : null}
                      {buildWhatsAppHref(customer.phone) ? (
                        <a
                          href={buildWhatsAppHref(customer.phone) ?? "#"}
                          className="secondary-button"
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir WhatsApp
                        </a>
                      ) : null}
                      {customer.upcoming_appointments === 0 ? (
                        <form
                          action={sendCustomerNudgeAction}
                          style={{ display: "inline-flex" }}
                        >
                          <input
                            type="hidden"
                            name="customerId"
                            value={customer.id}
                          />
                          <input
                            type="hidden"
                            name="customerName"
                            value={customer.name}
                          />
                          <input
                            type="hidden"
                            name="serviceName"
                            value={customer.last_completed_service_name ?? ""}
                          />
                          <input
                            type="hidden"
                            name="tierLabel"
                            value={customer.current_tier?.label ?? ""}
                          />
                          <input
                            type="hidden"
                            name="cashbackBalance"
                            value={String(toNumber(customer.cashback_balance))}
                          />
                          <input
                            type="hidden"
                            name="isVip"
                            value={
                              customer.current_tier?.is_vip ? "true" : "false"
                            }
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={currentReturnPath}
                          />
                          <button type="submit" className="secondary-button">
                            Enviar lembrete no app
                          </button>
                        </form>
                      ) : null}
                    </div>

                    {customer.preferences ||
                    customer.allergies ||
                    customer.beauty_goals ||
                    customer.beauty_products ||
                    customer.contraindications ||
                    customer.internal_notes ||
                    customer.last_assessment_at ||
                    (customer.consent_status &&
                      customer.consent_status !== "not_required") ||
                    customer.technical_notes ||
                    customer.last_completed_service_name ? (
                      <div className="customer-card__section">
                        <div className="customer-card__section-heading">
                          <span className="eyebrow">
                            Prontuário operacional
                          </span>
                          <small className="list-meta">
                            Objetivo, restrições, técnica e consentimento em uma
                            leitura rápida para cabelo, unhas, sobrancelha,
                            corporal e demais frentes da estética.
                          </small>
                        </div>

                        <div className="customer-card__beauty">
                          {customer.last_completed_service_name ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Último resultado registrado
                              </span>
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
                              <span className="customer-detail-item__label">
                                Preferências
                              </span>
                              <strong>{customer.preferences}</strong>
                            </div>
                          ) : null}
                          {customer.beauty_goals ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Objetivo / queixa principal
                              </span>
                              <strong>{customer.beauty_goals}</strong>
                            </div>
                          ) : null}
                          {customer.beauty_products ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Produtos usados ou preferidos
                              </span>
                              <strong>{customer.beauty_products}</strong>
                            </div>
                          ) : null}
                          {customer.allergies ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Alergias e cuidados
                              </span>
                              <strong>{customer.allergies}</strong>
                            </div>
                          ) : null}
                          {customer.contraindications ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Contraindicações e restrições
                              </span>
                              <strong>{customer.contraindications}</strong>
                            </div>
                          ) : null}
                          {customer.technical_notes ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Fórmula / protocolo atual
                              </span>
                              <strong>{customer.technical_notes}</strong>
                            </div>
                          ) : null}
                          {customer.last_assessment_at ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Última avaliação
                              </span>
                              <strong>
                                {formatDate(customer.last_assessment_at)}
                              </strong>
                            </div>
                          ) : null}
                          {customer.consent_status &&
                          customer.consent_status !== "not_required" ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Consentimento
                              </span>
                              <strong>
                                {formatConsentStatus(customer.consent_status)}
                                {customer.consent_signed_at
                                  ? ` • assinado em ${formatDateTime(customer.consent_signed_at)}`
                                  : ""}
                                {customer.consent_version
                                  ? ` • ${customer.consent_version}`
                                  : ""}
                              </strong>
                            </div>
                          ) : null}
                          {customer.internal_notes ? (
                            <div className="customer-detail-item">
                              <span className="customer-detail-item__label">
                                Anotações internas do salão
                              </span>
                              <strong>{customer.internal_notes}</strong>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}

                    <div className="customer-card__section">
                      <div className="customer-card__section-heading">
                        <span className="eyebrow">CRM do salão</span>
                        <small className="list-meta">
                          Registre contexto comercial e dados de prontuário para
                          a equipe trabalhar melhor nas próximas visitas.
                        </small>
                      </div>

                      <form
                        action={saveOwnerCustomerProfileAction}
                        className="customer-card__crm-form"
                      >
                        <input
                          type="hidden"
                          name="customerId"
                          value={customer.id}
                        />
                        <input
                          type="hidden"
                          name="returnPath"
                          value={currentReturnPath}
                        />

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                          }}
                        >
                          <div className="field">
                            <label htmlFor={`customer-phone-${customer.id}`}>
                              Telefone / WhatsApp
                            </label>
                            <input
                              id={`customer-phone-${customer.id}`}
                              name="phone"
                              placeholder="DDD + número"
                              defaultValue={customer.phone ?? ""}
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`customer-label-${customer.id}`}>
                              Etiqueta interna
                            </label>
                            <input
                              id={`customer-label-${customer.id}`}
                              name="crmLabel"
                              placeholder="Ex.: VIP de corte, noiva, alto ticket"
                              defaultValue={customer.crm_label ?? ""}
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`customer-consent-${customer.id}`}>
                              Consentimento
                            </label>
                            <select
                              id={`customer-consent-${customer.id}`}
                              name="consentStatus"
                              defaultValue={normalizeConsentStatus(
                                customer.consent_status,
                              )}
                            >
                              <option value="not_required">Nao exigido</option>
                              <option value="pending">Pendente</option>
                              <option value="signed">Assinado</option>
                            </select>
                          </div>

                          <div className="field">
                            <label
                              htmlFor={`customer-assessment-${customer.id}`}
                            >
                              Ultima avaliacao
                            </label>
                            <input
                              id={`customer-assessment-${customer.id}`}
                              name="lastAssessmentAt"
                              type="date"
                              defaultValue={customer.last_assessment_at ?? ""}
                            />
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            marginTop: 12,
                          }}
                        >
                          <div className="field">
                            <label
                              htmlFor={`customer-preferences-${customer.id}`}
                            >
                              Preferências
                            </label>
                            <textarea
                              id={`customer-preferences-${customer.id}`}
                              name="preferences"
                              rows={3}
                              placeholder="Horário, acabamento, estilo, rotina..."
                              defaultValue={customer.preferences ?? ""}
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`customer-goals-${customer.id}`}>
                              Objetivo / queixa principal
                            </label>
                            <textarea
                              id={`customer-goals-${customer.id}`}
                              name="beautyGoals"
                              rows={3}
                              placeholder="Resultado buscado, incomodo relatado ou prioridade da cliente"
                              defaultValue={customer.beauty_goals ?? ""}
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`customer-products-${customer.id}`}>
                              Produtos usados ou preferidos
                            </label>
                            <textarea
                              id={`customer-products-${customer.id}`}
                              name="beautyProducts"
                              rows={3}
                              placeholder="Produtos, fórmulas ou linhas que funcionam bem"
                              defaultValue={customer.beauty_products ?? ""}
                            />
                          </div>

                          <div className="field">
                            <label
                              htmlFor={`customer-allergies-${customer.id}`}
                            >
                              Alergias e cuidados
                            </label>
                            <textarea
                              id={`customer-allergies-${customer.id}`}
                              name="allergies"
                              rows={3}
                              placeholder="Restrições, sensibilidade, observações de segurança"
                              defaultValue={customer.allergies ?? ""}
                            />
                          </div>

                          <div className="field">
                            <label
                              htmlFor={`customer-contraindications-${customer.id}`}
                            >
                              Contraindicações e restrições
                            </label>
                            <textarea
                              id={`customer-contraindications-${customer.id}`}
                              name="contraindications"
                              rows={3}
                              placeholder="Gestacao, sensibilidade, quimica, pos-procedimento, observacoes de seguranca"
                              defaultValue={customer.contraindications ?? ""}
                            />
                          </div>
                        </div>

                        <div className="field" style={{ marginTop: 12 }}>
                          <label htmlFor={`customer-technical-${customer.id}`}>
                            Fórmula / protocolo atual
                          </label>
                          <textarea
                            id={`customer-technical-${customer.id}`}
                            name="technicalNotes"
                            rows={4}
                            placeholder="Mistura, protocolo corporal, tecnica, tonalizacao, curvatura, combinacao de produtos..."
                            defaultValue={customer.technical_notes ?? ""}
                          />
                        </div>

                        <div className="field" style={{ marginTop: 12 }}>
                          <label htmlFor={`customer-notes-${customer.id}`}>
                            Anotações internas
                          </label>
                          <textarea
                            id={`customer-notes-${customer.id}`}
                            name="internalNotes"
                            rows={4}
                            placeholder="Contexto comercial, preferências da equipe, postura no atendimento, próxima sugestão..."
                            defaultValue={customer.internal_notes ?? ""}
                          />
                        </div>

                        <div
                          className="customer-card__actions"
                          style={{ marginTop: 14 }}
                        >
                          <button type="submit" className="secondary-button">
                            Salvar CRM
                          </button>
                        </div>
                      </form>
                    </div>

                    <div className="customer-card__section">
                      <div className="customer-card__section-heading">
                        <span className="eyebrow">Pacotes ativos e saldo</span>
                        <small className="list-meta">
                          Clubes e pacotes operacionais aparecem aqui com
                          sessões, validade e leitura pronta para a equipe.
                        </small>
                      </div>

                      {customerMemberships.length > 0 ? (
                        <div
                          style={{
                            display: "grid",
                            gap: 12,
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(220px, 1fr))",
                            marginBottom: 14,
                          }}
                        >
                          {customerMemberships.map((membership) => {
                            const membershipStatus =
                              resolveCustomerMembershipStatus(
                                membership,
                                today,
                              );
                            const remainingSessions = Math.max(
                              membership.sessions_included -
                                membership.sessions_used,
                              0,
                            );

                            return (
                              <div
                                key={membership.id}
                                className="customer-detail-item"
                                style={{ gap: 8 }}
                              >
                                <span
                                  className={customerMembershipBadgeClass(
                                    membershipStatus,
                                  )}
                                >
                                  {formatCustomerMembershipStatusLabel(
                                    membershipStatus,
                                  )}
                                </span>
                                <strong>{membership.title}</strong>
                                <small className="list-meta">
                                  {membership.service_name_snapshot} •{" "}
                                  {remainingSessions} restante
                                  {remainingSessions === 1 ? "" : "s"} de{" "}
                                  {membership.sessions_included}
                                </small>
                                <small className="list-meta">
                                  Iniciado em{" "}
                                  {formatDate(membership.started_at)} • válido
                                  até {formatDate(membership.expires_at)}
                                </small>
                                {membership.price_snapshot != null ? (
                                  <small className="list-meta">
                                    Valor do pacote:{" "}
                                    {formatCurrency(
                                      Number(membership.price_snapshot),
                                    )}
                                  </small>
                                ) : null}
                                {membership.notes ? (
                                  <small className="list-meta">
                                    Observação: {membership.notes}
                                  </small>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="muted list-description">
                          Nenhum pacote operacional ativo para essa cliente por
                          enquanto.
                        </p>
                      )}

                      {operationalMembershipOffers.length > 0 ? (
                        <form
                          action={assignCustomerMembershipPackageAction}
                          className="customer-card__crm-form"
                        >
                          <input
                            type="hidden"
                            name="customerId"
                            value={customer.id}
                          />
                          <input
                            type="hidden"
                            name="returnPath"
                            value={currentReturnPath}
                          />

                          <div
                            style={{
                              display: "grid",
                              gap: 12,
                              gridTemplateColumns:
                                "repeat(auto-fit, minmax(220px, 1fr))",
                            }}
                          >
                            <div className="field">
                              <label
                                htmlFor={`customer-membership-${customer.id}`}
                              >
                                Ativar clube / pacote
                              </label>
                              <select
                                id={`customer-membership-${customer.id}`}
                                name="offerId"
                                defaultValue=""
                                required
                              >
                                <option value="">
                                  Selecione um pacote pronto
                                </option>
                                {operationalMembershipOffers.map((offer) => {
                                  const serviceLabel =
                                    offer.membership_service_id
                                      ? (serviceNameById.get(
                                          offer.membership_service_id,
                                        ) ?? "Serviço configurado")
                                      : "Serviço configurado";
                                  const sessionsLabel =
                                    offer.membership_sessions_included === 1
                                      ? "1 sessão"
                                      : `${offer.membership_sessions_included} sessões`;
                                  const validityLabel =
                                    offer.membership_validity_days === 1
                                      ? "1 dia"
                                      : `${offer.membership_validity_days} dias`;

                                  return (
                                    <option key={offer.id} value={offer.id}>
                                      {offer.title} • {serviceLabel} •{" "}
                                      {sessionsLabel} • {validityLabel}
                                    </option>
                                  );
                                })}
                              </select>
                            </div>

                            <div className="field">
                              <label
                                htmlFor={`customer-membership-start-${customer.id}`}
                              >
                                Início do pacote
                              </label>
                              <input
                                id={`customer-membership-start-${customer.id}`}
                                name="startsOn"
                                type="date"
                              />
                            </div>
                          </div>

                          <div className="field" style={{ marginTop: 12 }}>
                            <label
                              htmlFor={`customer-membership-notes-${customer.id}`}
                            >
                              Observação operacional
                            </label>
                            <textarea
                              id={`customer-membership-notes-${customer.id}`}
                              name="notes"
                              rows={3}
                              placeholder="Ex.: pacote vendido na recepção, começar após a próxima visita, benefício para retorno..."
                            />
                          </div>

                          <div
                            className="customer-card__actions"
                            style={{ marginTop: 14 }}
                          >
                            <button type="submit" className="secondary-button">
                              Ativar pacote com saldo
                            </button>
                          </div>
                        </form>
                      ) : (
                        <p className="muted list-description">
                          O comercial ainda não tem nenhum pacote operacional
                          pronto. Configure serviço, sessões e validade em
                          Clubes, pacotes e promoções.
                        </p>
                      )}
                    </div>

                    {customer.current_tier ? (
                      <div className="customer-card__footer">
                        <small className="list-meta">
                          Desconto atual de{" "}
                          {formatTierDiscount(
                            customer.current_tier.discount_percent,
                          )}
                          % para esse cliente
                          {customer.last_reward_at
                            ? ` • última recompensa em ${formatDateTime(customer.last_reward_at)}`
                            : ""}
                          .
                        </small>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          )}
        </div>

        {totalPages > 1 ? (
          <nav
            className="notifications-pagination"
            aria-label="Paginação dos clientes"
          >
            <div className="notifications-pagination__summary">
              Exibindo de {startItem} até {endItem} de {totalCount}. Página{" "}
              {safePage} de {totalPages}.
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
