import Link from "next/link";

import { ActionCommandCenter } from "@/components/ActionCommandCenter";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type AppointmentListItem = {
  id: string;
  date: string;
  status: "pending" | "confirmed" | "cancelled" | "completed";
  customer_id?: string | null;
  customers: { name: string } | { name: string }[] | null;
  services:
    | { category: string | null; name: string; price?: number | string | null }
    | {
        category: string | null;
        name: string;
        price?: number | string | null;
      }[]
    | null;
  staff_members: { name: string } | { name: string }[] | null;
};

type AppointmentRevenueItem = {
  customer_id?: string | null;
  date: string;
  services:
    | { price: number | string | null }
    | { price: number | string | null }[]
    | null;
};

type DashboardPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type DashboardOfferPreview = {
  id: string;
  kind: "promotion" | "membership";
  title: string;
  highlight_text: string | null;
  price: number | string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  sort_order: number;
};

type SmartScheduleSuggestion = {
  staff_member_name: string;
  suggested_start: string;
  headline: string;
  detail: string;
  suggested_service: {
    name: string;
    category: string | null;
    price: number | string | null;
  };
};

type SmartScheduleResponse = {
  suggestions: SmartScheduleSuggestion[];
};

type GrowthAutomationResponse = {
  settings: {
    is_active: boolean;
    smart_rebook_is_active: boolean;
    updated_at: string | null;
  };
  overview: {
    at_risk_customers: number;
    due_now_customers: number;
    smart_rebook_due_customers: number;
    recovered_customers_last_30d: number;
    smart_rebooks_sent_last_30d: number;
    winbacks_sent_last_30d: number;
  };
};

type DashboardIntelligenceResponse = {
  overview: {
    tracked_due_now_customers: number;
    tracked_lapsed_customers: number;
    tracked_top_customers: number;
    tracked_top_services: number;
  };
  lapsed_customers: Array<{
    completed_visits: number;
    id: string;
    inactive_days: number;
    last_service_category: string | null;
    last_service_name: string;
    last_visit_at: string;
    name: string;
    status: "at_risk" | "due_now";
    total_spent: number | string;
  }>;
  top_customers: Array<{
    completed_visits: number;
    id: string;
    last_visit_at: string | null;
    name: string;
    next_appointment_at: string | null;
    total_spent: number | string;
    upcoming_appointments: number;
  }>;
  top_services: Array<{
    category: string | null;
    completed_appointments: number;
    id: string;
    last_booked_at: string | null;
    name: string;
    total_revenue: number | string;
    unique_customers: number;
  }>;
};

type OperationsDashboardResponse = {
  overview: {
    active_inventory_products: number;
    active_staff_members: number;
    average_ticket: number | string;
    estimated_commissions: number | string;
    low_stock_products: number;
    top_staff_name: string | null;
    top_staff_revenue: number | string;
    total_revenue: number | string;
  };
  daily_revenue: Array<{
    completed_appointments: number;
    day: string;
    total_revenue: number | string;
  }>;
  top_staff: Array<{
    completed_appointments: number;
    estimated_commission: number | string;
    id: string;
    name: string;
    pending_appointments: number;
    role: string | null;
    total_revenue: number | string;
    upcoming_appointments: number;
  }>;
};

type InventoryProductSummary = {
  id: string;
  name: string;
  brand: string | null;
  current_stock: number | string;
  minimum_stock: number | string;
  unit: string;
  is_active: boolean;
};

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function toSafeDate(value: string | Date) {
  if (value instanceof Date) {
    return value;
  }

  return value.length <= 10
    ? new Date(`${value}T12:00:00.000Z`)
    : new Date(value);
}

function capitalizeFirst(value: string) {
  if (!value) {
    return value;
  }

  return value.charAt(0).toUpperCase() + value.slice(1);
}

function getLocalDateKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(toSafeDate(value));
}

function getLocalMonthKey(value: string | Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).format(toSafeDate(value));
}

function buildRecentDayKeys(days: number, timeZone: string) {
  const dayKeys = new Set<string>();

  for (let offset = 0; offset < days; offset += 1) {
    dayKeys.add(
      getLocalDateKey(
        new Date(Date.now() - offset * 24 * 60 * 60 * 1000),
        timeZone,
      ),
    );
  }

  return dayKeys;
}

function getServicePrice(
  value: AppointmentListItem["services"] | AppointmentRevenueItem["services"],
) {
  const service = firstRelation(value);
  return Number(service?.price ?? 0);
}

function formatTime(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(new Date(value));
}

function formatOfferPreviewWindow(
  offer: DashboardOfferPreview,
  timeZone: string,
) {
  if (!offer.starts_on && !offer.ends_on) {
    return "Sem vigência definida";
  }

  if (offer.starts_on && offer.ends_on) {
    return `${formatCompactDate(offer.starts_on, timeZone)} até ${formatCompactDate(offer.ends_on, timeZone)}`;
  }

  return offer.starts_on
    ? `A partir de ${formatCompactDate(offer.starts_on, timeZone)}`
    : `Até ${formatCompactDate(offer.ends_on!, timeZone)}`;
}

function formatAgendaDate(value: string | Date, timeZone: string) {
  return capitalizeFirst(
    new Intl.DateTimeFormat("pt-BR", {
      weekday: "long",
      day: "2-digit",
      month: "long",
      timeZone,
    }).format(toSafeDate(value)),
  );
}

function formatCompactDate(value: string, timeZone: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
    timeZone,
  }).format(new Date(value));
}

function getInitials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function compactLabel(value: string) {
  if (value.length <= 12) {
    return value;
  }

  const [firstWord] = value.split(" ");
  return firstWord || value.slice(0, 12);
}

export default async function DashboardPage({
  searchParams,
}: DashboardPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const now = new Date();
  const upcomingWindowStart = new Date(
    now.getTime() - 24 * 60 * 60 * 1000,
  ).toISOString();
  const upcomingWindowEnd = new Date(
    now.getTime() + 7 * 24 * 60 * 60 * 1000,
  ).toISOString();
  const recentWindowStart = new Date(
    now.getTime() - 45 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    { count: customersCount },
    { count: pendingCount },
    { count: servicesCount },
    { count: offersCount },
    featuredOffersResult,
    { count: postsCount },
    { count: notificationsCount },
    { count: activePushTokensCount },
    { count: instagramConnectionCount },
    { count: instagramMentionsCount },
    upcomingAppointmentsResult,
    completedAppointmentsResult,
    pendingRevenueAppointmentsResult,
    growthAutomationResult,
    dashboardIntelligenceResult,
    smartScheduleResult,
    operationsResult,
    inventoryProductsResult,
  ] = await Promise.all([
    supabase
      .from("customers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "pending"),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_offers")
      .select(
        "id, kind, title, highlight_text, price, starts_on, ends_on, is_active, sort_order",
      )
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("salon_posts")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_customer_notifications")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("instagram_connections")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("instagram_mentions")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("appointments")
      .select(
        "id, date, status, customer_id, customers(name), services(category, name, price), staff_members(name)",
      )
      .eq("salon_id", salon.id)
      .gte("date", upcomingWindowStart)
      .lt("date", upcomingWindowEnd)
      .order("date", { ascending: true })
      .limit(24),
    supabase
      .from("appointments")
      .select("customer_id, date, services(price)")
      .eq("salon_id", salon.id)
      .eq("status", "completed")
      .gte("date", recentWindowStart)
      .order("date", { ascending: false })
      .limit(400),
    supabase
      .from("appointments")
      .select("date, services(price)")
      .eq("salon_id", salon.id)
      .eq("status", "pending")
      .order("date", { ascending: true })
      .limit(200),
    supabase.rpc("get_salon_growth_automation_dashboard"),
    supabase.rpc("get_owner_dashboard_intelligence", {
      lapsed_limit_input: 4,
      top_customer_limit_input: 5,
      top_service_limit_input: 5,
    }),
    supabase.rpc("get_smart_schedule_opportunities", {}),
    supabase.rpc("get_owner_operations_dashboard", {
      days_input: 7,
      top_staff_limit_input: 4,
    }),
    supabase
      .from("inventory_products")
      .select("id, name, brand, current_stock, minimum_stock, unit, is_active")
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .order("current_stock", { ascending: true })
      .limit(4),
  ]);

  const growthAutomation = (growthAutomationResult.data ?? {
    settings: {
      is_active: true,
      smart_rebook_is_active: true,
      updated_at: null,
    },
    overview: {
      at_risk_customers: 0,
      due_now_customers: 0,
      smart_rebook_due_customers: 0,
      recovered_customers_last_30d: 0,
      smart_rebooks_sent_last_30d: 0,
      winbacks_sent_last_30d: 0,
    },
  }) as GrowthAutomationResponse;
  const dashboardIntelligence = (dashboardIntelligenceResult.data ?? {
    overview: {
      tracked_due_now_customers: 0,
      tracked_lapsed_customers: 0,
      tracked_top_customers: 0,
      tracked_top_services: 0,
    },
    lapsed_customers: [],
    top_customers: [],
    top_services: [],
  }) as DashboardIntelligenceResponse;
  const smartSchedule = (smartScheduleResult.data ?? {
    suggestions: [],
  }) as SmartScheduleResponse;
  const operations = (operationsResult.data ?? {
    overview: {
      active_inventory_products: 0,
      active_staff_members: 0,
      average_ticket: 0,
      estimated_commissions: 0,
      low_stock_products: 0,
      top_staff_name: null,
      top_staff_revenue: 0,
      total_revenue: 0,
    },
    daily_revenue: [],
    top_staff: [],
  }) as OperationsDashboardResponse;

  const upcomingAppointments = (upcomingAppointmentsResult.data ??
    []) as AppointmentListItem[];
  const completedAppointments = (completedAppointmentsResult.data ??
    []) as AppointmentRevenueItem[];
  const pendingRevenueAppointments = (pendingRevenueAppointmentsResult.data ??
    []) as AppointmentRevenueItem[];
  const inventoryProducts = (inventoryProductsResult.data ??
    []) as InventoryProductSummary[];
  const featuredOffers = (
    (featuredOffersResult.data ?? []) as DashboardOfferPreview[]
  ).sort((left, right) => {
    const kindComparison =
      (left.kind === "membership" ? 0 : 1) -
      (right.kind === "membership" ? 0 : 1);

    if (kindComparison !== 0) {
      return kindComparison;
    }

    return left.sort_order - right.sort_order;
  });
  const featuredMemberships = featuredOffers.filter(
    (offer) => offer.kind === "membership",
  );
  const featuredPromotions = featuredOffers.filter(
    (offer) => offer.kind === "promotion",
  );
  const leadingCommercialOffer =
    featuredMemberships[0] ?? featuredPromotions[0] ?? null;
  const todayKey = getLocalDateKey(now, timeZone);
  const currentMonthKey = getLocalMonthKey(now, timeZone);
  const recentDayKeys = buildRecentDayKeys(7, timeZone);
  const todayAppointments = upcomingAppointments.filter(
    (appointment) =>
      getLocalDateKey(appointment.date, timeZone) === todayKey &&
      appointment.status !== "cancelled",
  );
  const todayPendingCount = todayAppointments.filter(
    (appointment) => appointment.status === "pending",
  ).length;
  const todayConfirmedCount = todayAppointments.filter(
    (appointment) => appointment.status === "confirmed",
  ).length;
  const todayForecastRevenue = todayAppointments.reduce(
    (accumulator, appointment) =>
      accumulator + getServicePrice(appointment.services),
    0,
  );
  const activeStaffToday = new Set(
    todayAppointments
      .map((appointment) => firstRelation(appointment.staff_members)?.name)
      .filter(
        (name): name is string => typeof name === "string" && name.length > 0,
      ),
  ).size;
  const monthRevenue = completedAppointments.reduce(
    (accumulator, appointment) => {
      if (getLocalMonthKey(appointment.date, timeZone) !== currentMonthKey) {
        return accumulator;
      }

      return accumulator + getServicePrice(appointment.services);
    },
    0,
  );
  const weekServedCustomerIds = new Set(
    completedAppointments
      .filter((appointment) =>
        recentDayKeys.has(getLocalDateKey(appointment.date, timeZone)),
      )
      .map((appointment) => appointment.customer_id)
      .filter(
        (customerId): customerId is string =>
          typeof customerId === "string" && customerId.length > 0,
      ),
  );
  const pendingRevenue = pendingRevenueAppointments.reduce(
    (accumulator, appointment) =>
      accumulator + getServicePrice(appointment.services),
    0,
  );
  const lowStockProducts = inventoryProducts.filter(
    (product) =>
      Number(product.current_stock ?? 0) <= Number(product.minimum_stock ?? 0),
  );
  const topProfessionals = operations.top_staff.slice(0, 3);
  const topServices = dashboardIntelligence.top_services.slice(0, 5);
  const topServicesVolume = topServices.reduce(
    (accumulator, service) =>
      accumulator + Number(service.completed_appointments ?? 0),
    0,
  );
  const serviceCatalogCount = servicesCount ?? 0;
  const commercialOfferCount = offersCount ?? 0;
  const feedPostsCount = postsCount ?? 0;
  const activePushDeliveryCount = activePushTokensCount ?? 0;
  const clientAppVisibleSignalCount = [
    serviceCatalogCount > 0,
    commercialOfferCount > 0,
    feedPostsCount > 0,
    activePushDeliveryCount > 0,
    upcomingAppointments.length > 0 || completedAppointments.length > 0,
  ].filter(Boolean).length;
  const clientAppVisibleSignalSummary =
    commercialOfferCount === 0 || feedPostsCount === 0
      ? "O app funciona, mas ainda precisa de campanha, clube e conteúdo para passar mais valor logo na abertura."
      : "O app já mistura agenda, conteúdo, clubes e campanhas com sinais mais fortes de valor percebido.";
  const maxServiceVolume = Math.max(
    ...topServices.map((service) =>
      Number(service.completed_appointments ?? 0),
    ),
    1,
  );
  const highValueOpportunities = smartSchedule.suggestions.slice(0, 3);
  const automationLive =
    growthAutomation.settings.is_active ||
    growthAutomation.settings.smart_rebook_is_active;
  const nextTopCustomerWithoutReturn = dashboardIntelligence.top_customers.find(
    (customer) => customer.upcoming_appointments === 0,
  );
  const topStaffName = operations.overview.top_staff_name?.trim() || null;
  const heroHighlightValue = automationLive
    ? `${growthAutomation.overview.smart_rebook_due_customers ?? 0} rebooks e ${
        growthAutomation.overview.due_now_customers ?? 0
      } winbacks prontos`
    : `${todayPendingCount} pendentes e ${lowStockProducts.length} alertas operacionais`;
  const heroHighlightNote = nextTopCustomerWithoutReturn
    ? `${nextTopCustomerWithoutReturn.name} ja gerou ${formatCurrency(
        Number(nextTopCustomerWithoutReturn.total_spent ?? 0),
      )} e ainda esta sem proxima agenda.`
    : leadingCommercialOffer
      ? `${leadingCommercialOffer.title} ja esta visivel no app como ${
          leadingCommercialOffer.kind === "membership"
            ? "clube ou pacote"
            : "campanha"
        }.`
      : highValueOpportunities[0]
        ? `${highValueOpportunities[0].headline} com ${highValueOpportunities[0].staff_member_name} as ${formatTime(
            highValueOpportunities[0].suggested_start,
            timeZone,
          )}.`
        : "A abertura da home agora junta agenda, retencao e operacao em uma mesma leitura.";
  const dashboardSignals = [
    {
      label: "Receita prevista hoje",
      value: formatCurrency(todayForecastRevenue),
      note: todayAppointments.length
        ? `${todayAppointments.length} horarios ja desenhados para hoje.`
        : "Sem horarios no radar do dia neste momento.",
      tone: "accent" as const,
    },
    {
      label: "Retencao em jogo",
      value: `${growthAutomation.overview.due_now_customers ?? 0} clientes`,
      note: automationLive
        ? `${growthAutomation.overview.smart_rebook_due_customers ?? 0} rebooks prontos e ${
            growthAutomation.overview.winbacks_sent_last_30d ?? 0
          } winbacks enviados nos ultimos 30 dias.`
        : "Ative as automacoes para reacender recorrencia sem depender so do caixa de hoje.",
      tone: automationLive ? ("soft" as const) : ("warm" as const),
    },
    {
      label: "Equipe em cena",
      value: String(
        Math.max(
          activeStaffToday,
          Number(operations.overview.active_staff_members ?? 0),
        ),
      ),
      note: topStaffName
        ? `${topStaffName} lidera a semana com ${formatCurrency(
            Number(operations.overview.top_staff_revenue ?? 0),
          )}.`
        : "Conforme os atendimentos fecharem, o ranking da equipe ganha mais nitidez.",
      tone: topStaffName ? ("success" as const) : ("soft" as const),
    },
    {
      label: "Clubes e pacotes",
      value: featuredMemberships.length
        ? `${featuredMemberships.length} ativos`
        : commercialOfferCount > 0
          ? `${commercialOfferCount} campanhas`
          : "Sem clube no ar",
      note: leadingCommercialOffer
        ? `${leadingCommercialOffer.title} ja ajuda o app a vender ${
            leadingCommercialOffer.kind === "membership"
              ? "recorrencia"
              : "campanha"
          }.`
        : "Quando o salao publicar um clube, pacote ou campanha, ele passa a aparecer aqui como motor comercial.",
      tone: featuredMemberships.length
        ? ("accent" as const)
        : commercialOfferCount > 0
          ? ("warm" as const)
          : ("soft" as const),
    },
    {
      label: "Operacao sensivel",
      value: lowStockProducts.length
        ? `${lowStockProducts.length} alertas`
        : "Tudo abastecido",
      note: lowStockProducts[0]
        ? `${lowStockProducts[0].name} ja entrou no radar do estoque.`
        : `${Number(operations.overview.active_inventory_products ?? 0)} produtos ativos monitorados sem ruptura imediata.`,
      tone: lowStockProducts.length ? ("warm" as const) : ("success" as const),
    },
  ];
  const commandCards = [
    {
      eyebrow: "Agenda",
      highlight: `${todayAppointments.length} no dia`,
      title: "Agenda do dia",
      description: "Horários, confirmações e encaixes.",
      ctaLabel: "Ir para agenda",
      href: "/dashboard/appointments",
      support: highValueOpportunities[0]
        ? `Proximo encaixe: ${formatTime(
            highValueOpportunities[0].suggested_start,
            timeZone,
          )} com ${highValueOpportunities[0].staff_member_name}.`
        : "Sem encaixe crítico aberto agora.",
      tone: "accent" as const,
    },
    {
      eyebrow: "Comercial",
      highlight: `${serviceCatalogCount} serviços`,
      title: "Serviços, benefícios e feed",
      description: "Catálogo, campanhas e prova social.",
      ctaLabel: "Abrir comercial",
      href: "/dashboard/services",
      support:
        leadingCommercialOffer || feedPostsCount > 0
          ? `${commercialOfferCount} ofertas e ${feedPostsCount} posts ativos no app.`
          : "Publique serviços, campanhas e conteúdo para fortalecer o app.",
      tone: "warm" as const,
    },
    {
      eyebrow: "Operação",
      highlight: `${operations.overview.low_stock_products ?? 0} alertas`,
      title: "Loja, pedidos e estoque",
      description: "Caixa, produtos e movimentações.",
      ctaLabel: "Abrir operação",
      href: "/dashboard/operations",
      support: lowStockProducts[0]
        ? `${lowStockProducts[0].name} já entrou no radar do estoque.`
        : "Sem ruptura imediata de estoque no momento.",
      tone: "soft" as const,
    },
    {
      eyebrow: "App cliente",
      highlight: `${clientAppVisibleSignalCount}/5 sinais`,
      title: "App do cliente",
      description: "O que a cliente vê no mobile.",
      ctaLabel: "Abrir app",
      href: "/dashboard/client-app",
      support:
        leadingCommercialOffer || feedPostsCount > 0
          ? `${featuredMemberships.length} clubes e ${feedPostsCount} posts já ajudam a deixar o app vivo.`
          : "Ajuste o app do cliente para mostrar mais valor logo na entrada.",
      tone: "accent" as const,
    },
  ];
  const focusCards = [
    {
      href: "/dashboard/appointments",
      eyebrow: "Atendimento",
      title: "Agenda, clientes e equipe",
      value: `${todayAppointments.length} atendimentos`,
      note: "Agenda, CRM e equipe ficam juntos no menu para o dia a dia.",
      tone: "accent" as const,
      ctaLabel: "Abrir atendimento",
    },
    {
      href: "/dashboard/services",
      eyebrow: "Comercial",
      title: "Serviços, benefícios e feed",
      value: `${commercialOfferCount + feedPostsCount} ativos`,
      note: "Catálogo, campanhas, publicações, Instagram e notificações.",
      tone: "warm" as const,
      ctaLabel: "Abrir comercial",
    },
    {
      href: "/dashboard/operations",
      eyebrow: "Operação",
      title: "Loja, pedidos e estoque",
      value: formatCurrency(monthRevenue),
      note: lowStockProducts[0]
        ? `${formatCurrency(pendingRevenue)} em aberto e ${lowStockProducts[0].name} em alerta.`
        : `${formatCurrency(pendingRevenue)} em aberto e estoque sem alerta imediato.`,
      tone: lowStockProducts.length ? ("warm" as const) : ("success" as const),
      ctaLabel: "Abrir operação",
    },
    {
      href: "/dashboard/client-app",
      eyebrow: "Configuração",
      title: "App do cliente, cobrança e ajustes",
      value: `${clientAppVisibleSignalCount}/5 frentes`,
      note: "Configurações do app, assinatura e ajustes gerais do salão.",
      tone:
        clientAppVisibleSignalCount >= 4
          ? ("success" as const)
          : ("warm" as const),
      ctaLabel: "Abrir configuração",
    },
  ];
  return (
    <div className="page-grid dashboard-home">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        className="dashboard-command-hero"
        eyebrow="Painel do salão"
        title={`${salon.name}: operação, vendas e cliente em um lugar.`}
        description="A navegação foi reorganizada para você encontrar agenda, comercial, loja e app do cliente sem ficar procurando função espalhada."
        highlight={{
          label: automationLive ? "Foco de agora" : "Foco do dia",
          value: heroHighlightValue,
          note: heroHighlightNote,
        }}
        signals={[
          {
            label: "Hoje",
            value: `${todayAppointments.length} atendimentos`,
            tone: todayAppointments.length ? "accent" : "soft",
          },
          {
            label: "Equipe ativa",
            value: `${Math.max(activeStaffToday, Number(operations.overview.active_staff_members ?? 0))} profissionais`,
            tone: "soft",
          },
          {
            label: "Estoque",
            value: lowStockProducts.length
              ? `${lowStockProducts.length} alertas`
              : "Abastecido",
            tone: lowStockProducts.length ? "warm" : "success",
          },
          {
            label: "Automacao",
            value: automationLive ? "Ligada" : "Pausada",
            tone: automationLive ? "accent" : "soft",
          },
        ]}
        stats={[
          {
            label: "Receita do mes",
            value: formatCurrency(monthRevenue),
            note: "Leitura acumulada dos atendimentos concluidos no mes atual.",
            tone: "accent",
          },
          {
            label: "Receita em aberto",
            value: formatCurrency(pendingRevenue),
            note: `${pendingCount ?? 0} agendamentos aguardando virar caixa.`,
            tone: "warm",
          },
          {
            label: "Clientes ativos",
            value: `${customersCount ?? 0}`,
            note: `${weekServedCustomerIds.size} atendidos nos ultimos 7 dias.`,
            tone: "soft",
          },
          {
            label: "Destaque da semana",
            value: topStaffName
              ? `Equipe ${topStaffName}`
              : "Operacao distribuida",
            note: topStaffName
              ? `${formatCurrency(Number(operations.overview.top_staff_revenue ?? 0))} gerados por quem mais rendeu.`
              : "Sem lider isolado no momento; a operacao segue equilibrada.",
            tone: "success",
          },
        ]}
        actions={
          <>
            <Link href="/dashboard/appointments" className="primary-button">
              Abrir agenda
            </Link>
            <Link href="/dashboard/operations" className="secondary-button">
              Loja e estoque
            </Link>
            <Link href="/dashboard/client-app" className="secondary-button">
              App do cliente
            </Link>
          </>
        }
        aside={
          <div className="dashboard-command-hero__aside">
            <span className="workspace-panel__eyebrow">Comece por aqui</span>
            <h3>Entre pela área certa sem se perder no painel.</h3>

            <div className="dashboard-command-hero__checklist">
              <div className="dashboard-command-hero__check">
                <strong>Agenda</strong>
                <span>
                  {highValueOpportunities[0]
                    ? `${highValueOpportunities[0].suggested_service.name} as ${formatTime(
                        highValueOpportunities[0].suggested_start,
                        timeZone,
                      )}.`
                    : "Sem encaixe crítico no radar agora."}
                </span>
              </div>
              <div className="dashboard-command-hero__check">
                <strong>Comercial</strong>
                <span>
                  {leadingCommercialOffer
                    ? `${leadingCommercialOffer.title} já está pronta para vender no app.`
                    : "Serviços, campanhas e feed ficam agrupados para achar rápido."}
                </span>
              </div>
              <div className="dashboard-command-hero__check">
                <strong>Operação</strong>
                <span>
                  {lowStockProducts[0]
                    ? `${lowStockProducts[0].name} merece reposição antes do próximo pico.`
                    : "Estoque e equipe sem gargalo imediato."}
                </span>
              </div>
            </div>

            <div className="dashboard-command-hero__spotlight">
              <span>Próxima ação</span>
              <strong>
                {leadingCommercialOffer?.title ??
                  topServices[0]?.name ??
                  topStaffName ??
                  "Ajustar a vitrine comercial do salão"}
              </strong>
              <p>
                {leadingCommercialOffer
                  ? `${leadingCommercialOffer.kind === "membership" ? "Clube ou pacote" : "Campanha"} pronto para aparecer no app com ${
                      leadingCommercialOffer.price != null
                        ? formatCurrency(Number(leadingCommercialOffer.price))
                        : "benefício divulgado"
                    }.`
                  : topServices[0]
                    ? `${topServices[0].completed_appointments} atendimentos e ${formatCurrency(
                        Number(topServices[0].total_revenue ?? 0),
                      )} gerados pelo servico mais forte.`
                    : "Use benefícios e feed para reforçar desejo e valor percebido."}
              </p>
            </div>
          </div>
        }
      />

      <section className="dashboard-signal-strip dashboard-signal-strip--immersive">
        {dashboardSignals.map((signal) => (
          <article
            key={signal.label}
            className={`dashboard-signal-card dashboard-signal-card--${signal.tone}`}
          >
            <span>{signal.label}</span>
            <strong>{signal.value}</strong>
            <small>{signal.note}</small>
          </article>
        ))}
      </section>

      <ActionCommandCenter
        className="dashboard-command-center"
        title="Acessos rápidos"
        description="As áreas principais do sistema ficam aqui e no menu lateral."
        cards={commandCards}
      />

      <section className="dashboard-capability-map">
        <div className="section-heading dashboard-capability-map__heading">
          <div>
            <span className="eyebrow">Mapa do painel</span>
            <h2>Onde cada função do sistema fica</h2>
            <p className="muted">
              O painel foi reorganizado por uso real para ficar mais fácil achar
              cada área.
            </p>
          </div>
        </div>

        <div className="dashboard-capability-grid">
          {focusCards.map((card) => (
            <article
              key={card.href}
              className={`dashboard-panel dashboard-capability-card dashboard-capability-card--${card.tone}`}
            >
              <div className="dashboard-capability-card__topline">
                <span className="workspace-panel__eyebrow">{card.eyebrow}</span>
                <strong>{card.value}</strong>
              </div>
              <div className="dashboard-capability-card__body">
                <h3>{card.title}</h3>
                <p>{card.note}</p>
              </div>
              <Link
                href={card.href}
                className="dashboard-capability-card__link"
              >
                {card.ctaLabel}
              </Link>
            </article>
          ))}
        </div>
      </section>

      <section className="dashboard-reference-grid">
        <article className="dashboard-panel dashboard-panel--agenda">
          <div className="dashboard-panel__header">
            <h2>Agenda do Dia</h2>

            <Link
              href="/dashboard/appointments"
              className="dashboard-panel__link dashboard-panel__link--date"
            >
              <span>
                {formatAgendaDate(todayAppointments[0]?.date ?? now, timeZone)}
              </span>
              <span className="dashboard-panel__link-icon" aria-hidden="true">
                ›
              </span>
            </Link>
          </div>

          <div className="dashboard-agenda-list">
            {!todayAppointments.length ? (
              <div className="dashboard-empty">
                Nenhum agendamento encontrado para hoje. Se abrir uma janela
                nova, ela vai aparecer aqui.
              </div>
            ) : (
              todayAppointments.map((appointment) => {
                const customer = firstRelation(appointment.customers);
                const service = firstRelation(appointment.services);

                return (
                  <div key={appointment.id} className="dashboard-agenda-item">
                    <div className="dashboard-agenda-item__content">
                      <strong className="dashboard-agenda-item__time">
                        {formatTime(appointment.date, timeZone)}
                      </strong>
                      <span className="dashboard-agenda-item__separator">
                        —
                      </span>
                      <strong>{service?.name ?? "Servico do salao"}</strong>
                      <span>{customer?.name ?? "Cliente"}</span>
                    </div>

                    {appointment.status === "pending" ? (
                      <span className="dashboard-agenda-item__flag" />
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--finance">
          <div className="dashboard-panel__header">
            <h2>Resumo Financeiro</h2>
          </div>

          <div className="dashboard-finance-list">
            <div className="dashboard-finance-row">
              <div>
                <span>Hoje</span>
                <small>{todayAppointments.length} servicos previstos</small>
              </div>
              <strong>{formatCurrency(todayForecastRevenue)}</strong>
            </div>

            <div className="dashboard-finance-row">
              <div>
                <span>Mês Atual</span>
                <small>
                  {formatCurrency(
                    Number(operations.overview.total_revenue ?? 0),
                  )}{" "}
                  nos ultimos 7 dias
                </small>
              </div>
              <strong>{formatCurrency(monthRevenue)}</strong>
            </div>

            <div className="dashboard-finance-row dashboard-finance-row--accent">
              <div>
                <span>Pendências</span>
                <small>{pendingCount ?? 0} agendamentos aguardando</small>
              </div>
              <Link
                href="/dashboard/operations"
                className="dashboard-finance-pill"
              >
                {formatCurrency(pendingRevenue)} a receber
              </Link>
            </div>
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--ranking">
          <div className="dashboard-panel__header">
            <h2>Top Profissionais</h2>
          </div>

          <div className="dashboard-ranking-list">
            {!topProfessionals.length ? (
              <div className="dashboard-empty">
                O ranking aparece assim que houver atendimentos vinculados a
                profissionais.
              </div>
            ) : (
              topProfessionals.map((professional) => (
                <div key={professional.id} className="dashboard-ranking-item">
                  <div className="dashboard-ranking-item__identity">
                    <span className="dashboard-avatar" aria-hidden="true">
                      {getInitials(professional.name)}
                    </span>

                    <div>
                      <strong>{professional.name}</strong>
                      <span>
                        {professional.completed_appointments} atendimentos
                      </span>
                    </div>
                  </div>

                  <div className="dashboard-ranking-item__meta">
                    <span>{professional.role || "Atendimento do salao"}</span>
                    <strong>›</strong>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--services">
          <div className="dashboard-panel__header">
            <h2>Estatísticas de Serviços</h2>
          </div>

          <div className="dashboard-service-stat-list">
            {!topServices.length ? (
              <div className="dashboard-empty">
                Quando os atendimentos forem concluídos, os serviços mais fortes
                aparecem aqui.
              </div>
            ) : (
              topServices.slice(0, 4).map((service) => {
                const percentage =
                  topServicesVolume === 0
                    ? 0
                    : Math.round(
                        (Number(service.completed_appointments ?? 0) /
                          topServicesVolume) *
                          100,
                      );

                return (
                  <div key={service.id} className="dashboard-service-stat">
                    <div className="dashboard-service-stat__header dashboard-service-stat__header--stacked">
                      <span
                        className="dashboard-service-stat__dot"
                        aria-hidden="true"
                      />
                      <div>
                        <strong>{service.name}</strong>
                        <span>{service.category || "Atendimento"}</span>
                      </div>
                      <strong>{percentage}%</strong>
                    </div>

                    <div className="dashboard-progress" aria-hidden="true">
                      <span
                        className="dashboard-progress__fill"
                        style={{ width: `${Math.max(percentage, 8)}%` }}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </article>

        <article className="dashboard-panel dashboard-panel--stock">
          <div className="dashboard-panel__header">
            <h2>Produtos em Falta</h2>
          </div>

          <div className="dashboard-stock-list">
            {!lowStockProducts.length ? (
              <div className="dashboard-empty">
                Estoque sob controle no momento. O painel avisa quando algum
                item cair abaixo do minimo.
              </div>
            ) : (
              lowStockProducts.slice(0, 3).map((product) => (
                <div key={product.id} className="dashboard-stock-item">
                  <div>
                    <strong>{product.name}</strong>
                    <span>{product.brand || "Linha profissional"}</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="dashboard-chart">
            <div className="dashboard-chart__heading">
              <h3>Serviços Realizados</h3>
            </div>

            {!topServices.length ? (
              <div className="dashboard-empty">
                Sem historico suficiente para gerar o grafico agora.
              </div>
            ) : (
              <div
                className="dashboard-chart__bars"
                aria-label="Grafico de servicos realizados"
              >
                {topServices.map((service) => {
                  const height = Math.max(
                    20,
                    Math.round(
                      (Number(service.completed_appointments ?? 0) /
                        maxServiceVolume) *
                        100,
                    ),
                  );

                  return (
                    <div key={service.id} className="dashboard-chart__item">
                      <span className="dashboard-chart__value">
                        {service.completed_appointments}
                      </span>
                      <div className="dashboard-chart__bar-shell">
                        <span
                          className="dashboard-chart__bar"
                          style={{ height: `${height}%` }}
                        />
                      </div>
                      <span className="dashboard-chart__label">
                        {compactLabel(service.name)}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </article>
      </section>

      <section className="dashboard-radar">
        <div className="section-heading dashboard-radar__heading">
          <div>
            <span className="eyebrow">Automação e inteligência</span>
            <h2>Recursos avançados</h2>
            <p className="muted">
              Os recursos de encaixe, retenção e leitura operacional continuam
              aqui embaixo.
            </p>
          </div>
        </div>

        <div className="dashboard-radar__grid">
          <article className="dashboard-panel dashboard-radar-card">
            <div className="dashboard-panel__header">
              <div>
                <h2>Encaixes Inteligentes</h2>
                <p className="muted">
                  Oportunidades com maior chance de virar venda nas janelas
                  livres.
                </p>
              </div>

              <Link
                href="/dashboard/appointments#encaixes-inteligentes"
                className="dashboard-panel__link"
              >
                Trabalhar agenda
              </Link>
            </div>

            <div className="dashboard-radar-list">
              {!highValueOpportunities.length ? (
                <div className="dashboard-empty">
                  Nenhuma janela premium aberta agora. A sugestao aparece assim
                  que surgir o proximo gap relevante.
                </div>
              ) : (
                highValueOpportunities.map((suggestion, index) => (
                  <div
                    key={`${suggestion.staff_member_name}-${index}`}
                    className="dashboard-radar-item"
                  >
                    <div className="dashboard-radar-item__content">
                      <strong>{suggestion.suggested_service.name}</strong>
                      <span>
                        {suggestion.staff_member_name} •{" "}
                        {formatTime(suggestion.suggested_start, timeZone)}
                      </span>
                    </div>
                    <div className="dashboard-radar-item__meta">
                      <strong>
                        {formatCurrency(
                          Number(suggestion.suggested_service.price ?? 0),
                        )}
                      </strong>
                      <small>{suggestion.detail}</small>
                    </div>
                  </div>
                ))
              )}
            </div>
          </article>

          <article className="dashboard-panel dashboard-radar-card">
            <div className="dashboard-panel__header">
              <div>
                <h2>Clientes para Reativar</h2>
                <p className="muted">
                  Quem esfriou, quanto tempo ficou sem voltar e onde agir
                  primeiro.
                </p>
              </div>

              <Link
                href="/dashboard/benefits/automations"
                className="dashboard-panel__link"
              >
                Abrir retencao
              </Link>
            </div>

            <div className="dashboard-radar-list">
              {!dashboardIntelligence.lapsed_customers.length ? (
                <div className="dashboard-empty">
                  Nenhum cliente fora da janela ideal agora. Bom sinal para a
                  recorrencia do salao.
                </div>
              ) : (
                dashboardIntelligence.lapsed_customers
                  .slice(0, 3)
                  .map((customer) => (
                    <div key={customer.id} className="dashboard-radar-item">
                      <div className="dashboard-radar-item__content">
                        <strong>{customer.name}</strong>
                        <span>
                          {customer.inactive_days} dias sem voltar •{" "}
                          {customer.last_service_name}
                        </span>
                      </div>

                      <div className="dashboard-radar-item__meta">
                        <span
                          className={
                            customer.status === "due_now"
                              ? "badge badge--pending"
                              : "badge badge--soft"
                          }
                        >
                          {customer.status === "due_now"
                            ? "Winback agora"
                            : "Em risco"}
                        </span>
                        <small>
                          {formatCurrency(Number(customer.total_spent ?? 0))} em
                          historico
                        </small>
                      </div>
                    </div>
                  ))
              )}
            </div>
          </article>

          <article className="dashboard-panel dashboard-radar-card">
            <div className="dashboard-panel__header">
              <div>
                <h2>Clubes, pacotes e campanhas</h2>
                <p className="muted">
                  A camada comercial que ajuda o salão a vender retorno e
                  preencher agenda sem depender só de mensagem manual.
                </p>
              </div>

              <Link
                href="/dashboard/benefits/promotions"
                className="dashboard-panel__link"
              >
                Abrir comercial
              </Link>
            </div>

            <div className="dashboard-radar-list">
              {!featuredOffers.length ? (
                <div className="dashboard-empty">
                  Ainda não há clube, pacote ou campanha publicado. Quando o
                  salão ativar a primeira oferta, ela passa a aparecer aqui e no
                  app da cliente.
                </div>
              ) : (
                featuredOffers.slice(0, 3).map((offer) => (
                  <div key={offer.id} className="dashboard-radar-item">
                    <div className="dashboard-radar-item__content">
                      <strong>{offer.title}</strong>
                      <span>
                        {offer.kind === "membership"
                          ? "Clube / pacote"
                          : "Campanha ativa"}{" "}
                        • {formatOfferPreviewWindow(offer, timeZone)}
                      </span>
                    </div>

                    <div className="dashboard-radar-item__meta">
                      <strong>
                        {offer.price != null
                          ? formatCurrency(Number(offer.price))
                          : "Sem valor fixo"}
                      </strong>
                      <small>
                        {offer.highlight_text?.trim() ||
                          "Use este espaco para vender o beneficio principal da oferta no app."}
                      </small>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="dashboard-inline-pills">
              <span className="dashboard-mini-pill">
                {featuredMemberships.length} clubes ativos
              </span>
              <span className="dashboard-mini-pill">
                {featuredPromotions.length} campanhas visiveis
              </span>
            </div>

            <div className="dashboard-automation-note">
              <strong>
                {featuredMemberships.length > 0
                  ? "Recorrencia ja em jogo"
                  : "Motor comercial ainda pode crescer"}
              </strong>
              <p>
                {leadingCommercialOffer
                  ? `${leadingCommercialOffer.title} ajuda o app a parecer mais forte logo na abertura e reduz a sensacao de catalogo vazio.`
                  : "Clube, pacote e campanha publicados com clareza ajudam a cliente a entender valor antes mesmo de falar com a equipe."}
              </p>
              <small>
                {commercialOfferCount} ofertas comerciais no total e{" "}
                {featuredMemberships.length} com foco em receita recorrente.
              </small>
            </div>
          </article>

          <article className="dashboard-panel dashboard-radar-card">
            <div className="dashboard-panel__header">
              <div>
                <h2>Automações do Salão</h2>
                <p className="muted">
                  Rebook e winback com leitura executiva para o dono acompanhar
                  resultado.
                </p>
              </div>

              <Link
                href="/dashboard/benefits/automations"
                className="dashboard-panel__link"
              >
                Configurar
              </Link>
            </div>

            <div className="dashboard-radar-metrics">
              <div className="dashboard-radar-metric">
                <span>Em risco</span>
                <strong>
                  {growthAutomation.overview.at_risk_customers ?? 0}
                </strong>
              </div>
              <div className="dashboard-radar-metric">
                <span>Winback</span>
                <strong>
                  {growthAutomation.overview.due_now_customers ?? 0}
                </strong>
              </div>
              <div className="dashboard-radar-metric">
                <span>Recuperados</span>
                <strong>
                  {growthAutomation.overview.recovered_customers_last_30d ?? 0}
                </strong>
              </div>
            </div>

            <div className="dashboard-inline-pills">
              <span className="dashboard-mini-pill">
                {growthAutomation.overview.smart_rebook_due_customers ?? 0}{" "}
                rebooks prontos
              </span>
              <span className="dashboard-mini-pill">
                {automationLive ? "Motor ativo" : "Motor pausado"}
              </span>
            </div>

            <div className="dashboard-automation-note">
              <strong>
                {automationLive ? "Automacao ligada" : "Automacao pausada"}
              </strong>
              <p>
                {nextTopCustomerWithoutReturn
                  ? `${nextTopCustomerWithoutReturn.name} ja gerou ${formatCurrency(
                      Number(nextTopCustomerWithoutReturn.total_spent ?? 0),
                    )} e ainda esta sem proxima agenda.`
                  : "O painel continua observando clientes de maior valor para sugerir o melhor momento de retorno."}
              </p>
              <small>
                {growthAutomation.overview.smart_rebooks_sent_last_30d ?? 0}{" "}
                rebooks e{" "}
                {growthAutomation.overview.winbacks_sent_last_30d ?? 0} winbacks
                enviados nos ultimos 30 dias.
              </small>
              {topServices[0]?.last_booked_at ? (
                <small>
                  Servico lider atualizado em{" "}
                  {formatCompactDate(topServices[0].last_booked_at, timeZone)}.
                </small>
              ) : null}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
