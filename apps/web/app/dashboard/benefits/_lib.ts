import { requireOwnerSalon } from "@/lib/auth";
import { formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type SearchParamValue = string | string[] | undefined;

export type NoticeSearchParams = {
  message?: string;
  tone?: string;
};

export type OfferSearchParams = NoticeSearchParams & {
  offerKind?: SearchParamValue;
  offerQ?: SearchParamValue;
  offerState?: SearchParamValue;
};

export type ReferralSearchParams = NoticeSearchParams & {
  referralFrom?: SearchParamValue;
  referralStatus?: SearchParamValue;
  referralTo?: SearchParamValue;
};

export type OfferRow = {
  id: string;
  kind: "promotion" | "membership";
  title: string;
  description: string | null;
  highlight_text: string | null;
  price: number | string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  sort_order: number;
};

type ReferralProgramRow = {
  id: string;
  title: string;
  description: string | null;
  reward_for_referrer: string;
  reward_for_invited: string | null;
  is_active: boolean;
  required_qualified_referrals?: number | null;
  reward_service_id?: string | null;
  reward_service_name?: string | null;
  updated_at: string;
};

type ReferralEventRow = {
  id: string;
  referrer_customer_id: string;
  invited_customer_id: string;
  status: "pending" | "qualified";
  qualified_at: string | null;
  created_at: string;
};

type CustomerRow = {
  id: string;
  name: string;
  referral_code: string | null;
};

export type LoyaltyTierSnapshot = {
  label: string;
  min_visits: number;
  discount_percent: number | string;
  is_vip: boolean;
};

export type LoyaltyProgramRow = {
  title: string;
  description: string | null;
  points_per_visit: number;
  cashback_percent: number | string;
  tier_one_name: string;
  tier_one_min_visits: number;
  tier_one_discount_percent: number | string;
  tier_two_name: string;
  tier_two_min_visits: number;
  tier_two_discount_percent: number | string;
  vip_tier_name: string;
  vip_min_visits: number;
  vip_discount_percent: number | string;
  vip_reward_service_id?: string | null;
  vip_reward_service_name?: string | null;
  is_active: boolean;
  tiers: LoyaltyTierSnapshot[];
};

export type LoyaltyOverview = {
  ranked_customers: number;
  vip_customers: number;
  total_completed_visits: number;
  total_points_earned: number;
  total_cashback_earned: number | string;
};

export type LoyaltyLeaderboardItem = {
  customer_id: string;
  customer_name: string;
  rank_position: number;
  points_balance: number;
  total_points_earned: number;
  cashback_balance: number | string;
  total_cashback_earned: number | string;
  completed_visits: number;
  current_tier: LoyaltyTierSnapshot | null;
  last_reward_at: string | null;
};

type LoyaltyDashboardResponse = {
  program: LoyaltyProgramRow | null;
  overview: LoyaltyOverview;
  leaderboard: LoyaltyLeaderboardItem[];
};

export type GrowthAutomationSettings = {
  is_active: boolean;
  winback_inactive_days: number;
  winback_discount_percent: number;
  winback_title: string;
  winback_body_template: string;
  smart_rebook_is_active: boolean;
  smart_rebook_window_days: number;
  smart_rebook_title: string;
  smart_rebook_body_template: string;
  updated_at: string | null;
};

export type GrowthAutomationOverview = {
  at_risk_customers: number;
  due_now_customers: number;
  smart_rebook_due_customers: number;
  winbacks_sent_last_30d: number;
  smart_rebooks_sent_last_30d: number;
  recovered_customers_last_30d: number;
};

export type GrowthAutomationRecentRun = {
  id: string;
  automation_type: "winback_offer" | "smart_rebook_prompt";
  customer_id: string;
  customer_name: string;
  notification_id: string | null;
  sent_at: string;
  inactive_days: number;
  discount_percent: number;
  service_name: string;
  target_weekday: string | null;
  target_period: string | null;
  title: string | null;
  body: string | null;
  recovered: boolean;
  recovered_appointment_at: string | null;
};

type GrowthAutomationDashboardResponse = {
  settings: GrowthAutomationSettings;
  overview: GrowthAutomationOverview;
  recent_runs: GrowthAutomationRecentRun[];
};

export type OfferLifecycle = "active" | "scheduled" | "expired" | "paused";

export type BenefitsOverviewData = {
  activeOffersCount: number;
  activeMembershipsCount: number;
  qualifiedReferralsCount: number;
  pendingReferralsCount: number;
  loyaltyProgram: LoyaltyProgramRow | null;
  loyaltyOverview: LoyaltyOverview;
  growthAutomationSettings: GrowthAutomationSettings;
  growthAutomationOverview: GrowthAutomationOverview;
  referralProgram: ReferralProgramRow | null;
};

export type PromotionsPageData = {
  activeOffersCount: number;
  activeMembershipsCount: number;
  groupedOffers: Record<string, OfferRow[]>;
  hasOfferFilters: boolean;
  offerKindFilter: string;
  offerQuery: string;
  offerStateFilter: string;
  offers: OfferRow[];
  today: string;
};

export type ReferralEntry = {
  id: string;
  created_at: string;
  invited_name: string;
  qualified_at: string | null;
  referrer_name: string;
  status: "pending" | "qualified";
  used_referral_code: string;
};

export type ReferralServiceOption = {
  id: string;
  name: string;
  category: string | null;
};

export type ReferralsPageData = {
  availableRewardUnlocksCount: number;
  hasReferralFilters: boolean;
  pendingCountInPeriod: number;
  periodQualifiedCount: number;
  referralEvents: ReferralEntry[];
  referralEventsBaseCount: number;
  referralFrom: string;
  referralProgram: ReferralProgramRow | null;
  rewardUnlocksCount: number;
  referralStatusFilter: string;
  referralTo: string;
  serviceOptions: ReferralServiceOption[];
};

export type LoyaltyPageData = {
  loyaltyLeaderboard: LoyaltyLeaderboardItem[];
  loyaltyOverview: LoyaltyOverview;
  loyaltyProgram: LoyaltyProgramRow | null;
  serviceOptions: ReferralServiceOption[];
};

export type GrowthAutomationPageData = {
  growthAutomationOverview: GrowthAutomationOverview;
  growthAutomationRecentRuns: GrowthAutomationRecentRun[];
  growthAutomationSettings: GrowthAutomationSettings;
};

export function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function startOfDayIso(value: string) {
  return `${value}T00:00:00.000Z`;
}

function endOfDayExclusiveIso(value: string) {
  const day = new Date(`${value}T00:00:00.000Z`);
  day.setUTCDate(day.getUTCDate() + 1);
  return day.toISOString();
}

export function getOfferLifecycle(offer: OfferRow, today: string): OfferLifecycle {
  if (!offer.is_active) {
    return "paused";
  }

  if (offer.starts_on && offer.starts_on > today) {
    return "scheduled";
  }

  if (offer.ends_on && offer.ends_on < today) {
    return "expired";
  }

  return "active";
}

export function formatOfferKind(kind: OfferRow["kind"]) {
  return kind === "membership" ? "Plano mensal" : "Promoção";
}

export function formatOfferPeriod(offer: OfferRow) {
  if (!offer.starts_on && !offer.ends_on) {
    return "Sem data definida";
  }

  if (offer.starts_on && offer.ends_on) {
    return `${formatDate(offer.starts_on)} até ${formatDate(offer.ends_on)}`;
  }

  return offer.starts_on ? `A partir de ${formatDate(offer.starts_on)}` : `Até ${formatDate(offer.ends_on!)}`;
}

export function formatPercent(value: number | string) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(Number(value))}%`;
}

export function formatLifecycleLabel(lifecycle: OfferLifecycle) {
  switch (lifecycle) {
    case "active":
      return "ativa";
    case "scheduled":
      return "agendada";
    case "expired":
      return "expirada";
    default:
      return "pausada";
  }
}

export function badgeClassForLifecycle(lifecycle: OfferLifecycle) {
  switch (lifecycle) {
    case "active":
      return "badge badge--confirmed";
    case "scheduled":
      return "badge badge--pending";
    case "expired":
      return "badge badge--cancelled";
    default:
      return "badge badge--soft";
  }
}

export function lifecycleHint(offer: OfferRow, lifecycle: OfferLifecycle, today: string) {
  if (lifecycle === "scheduled" && offer.starts_on) {
    return `Entra no app em ${formatDate(offer.starts_on)}.`;
  }

  if (lifecycle === "expired" && offer.ends_on) {
    return `Saiu de vigência em ${formatDate(offer.ends_on)}.`;
  }

  if (lifecycle === "active" && offer.ends_on === today) {
    return "Vence hoje.";
  }

  if (lifecycle === "paused") {
    return "Não aparece para o cliente enquanto estiver pausada.";
  }

  return "Disponível no app do cliente conforme a vigência acima.";
}

function defaultLoyaltyDashboard(): LoyaltyDashboardResponse {
  return {
    program: null,
    overview: {
      ranked_customers: 0,
      vip_customers: 0,
      total_completed_visits: 0,
      total_points_earned: 0,
      total_cashback_earned: 0,
    },
    leaderboard: [],
  };
}

function defaultGrowthAutomationDashboard(): GrowthAutomationDashboardResponse {
  return {
    settings: {
      is_active: true,
      winback_inactive_days: 30,
      winback_discount_percent: 10,
      winback_title: "Sentimos sua falta 😄",
      winback_body_template:
        "Já faz {inactive_days} dias desde seu último {service_name}. Volte esta semana e agende com {discount}% OFF pelo app.",
      smart_rebook_is_active: true,
      smart_rebook_window_days: 4,
      smart_rebook_title: "Hora do seu próximo {service_name}",
      smart_rebook_body_template:
        "Quer agendar para {target_weekday} {target_period}? Se quiser, você também pode incluir {combo_service_name}.",
      updated_at: null,
    },
    overview: {
      at_risk_customers: 0,
      due_now_customers: 0,
      winbacks_sent_last_30d: 0,
      smart_rebook_due_customers: 0,
      smart_rebooks_sent_last_30d: 0,
      recovered_customers_last_30d: 0,
    },
    recent_runs: [],
  };
}

export async function loadBenefitsOverviewData(): Promise<BenefitsOverviewData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [
    referralProgramResult,
    loyaltyDashboardResult,
    growthAutomationDashboardResult,
    activeOffersCountResult,
    activeMembershipsCountResult,
    qualifiedReferralsCountResult,
    pendingReferralsCountResult,
  ] = await Promise.all([
    supabase.from("salon_referral_programs").select("*").eq("salon_id", salon.id).maybeSingle(),
    supabase.rpc("get_salon_loyalty_dashboard"),
    supabase.rpc("get_salon_growth_automation_dashboard"),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("kind", "membership"),
    supabase
      .from("salon_referral_events")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "qualified"),
    supabase
      .from("salon_referral_events")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "pending"),
  ]);

  const loyaltyDashboard = (loyaltyDashboardResult.data ?? defaultLoyaltyDashboard()) as LoyaltyDashboardResponse;
  const growthAutomationDashboard = (growthAutomationDashboardResult.data ??
    defaultGrowthAutomationDashboard()) as GrowthAutomationDashboardResponse;

  return {
    activeOffersCount: activeOffersCountResult.count ?? 0,
    activeMembershipsCount: activeMembershipsCountResult.count ?? 0,
    qualifiedReferralsCount: qualifiedReferralsCountResult.count ?? 0,
    pendingReferralsCount: pendingReferralsCountResult.count ?? 0,
    loyaltyProgram: loyaltyDashboard.program,
    loyaltyOverview: loyaltyDashboard.overview,
    growthAutomationSettings: growthAutomationDashboard.settings,
    growthAutomationOverview: growthAutomationDashboard.overview,
    referralProgram: (referralProgramResult.data ?? null) as ReferralProgramRow | null,
  };
}

export async function loadPromotionsPageData(searchParams?: OfferSearchParams): Promise<PromotionsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const today = new Date().toISOString().slice(0, 10);
  const offerQuery = firstParam(searchParams?.offerQ).trim();
  const offerKindFilter = firstParam(searchParams?.offerKind).trim();
  const offerStateFilter = firstParam(searchParams?.offerState).trim();
  const hasOfferFilters = Boolean(offerQuery || offerKindFilter || offerStateFilter);

  const offersQuery = (() => {
    let query = supabase.from("salon_offers").select("*").eq("salon_id", salon.id);

    if (offerKindFilter === "promotion" || offerKindFilter === "membership") {
      query = query.eq("kind", offerKindFilter);
    }

    if (offerQuery) {
      query = query.or(
        `title.ilike.%${offerQuery}%,description.ilike.%${offerQuery}%,highlight_text.ilike.%${offerQuery}%`,
      );
    }

    return query.order("sort_order").order("created_at");
  })();

  const [offersResult, activeOffersCountResult, activeMembershipsCountResult] = await Promise.all([
    offersQuery,
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("kind", "membership"),
  ]);

  const offers = ((offersResult.data ?? []) as OfferRow[]).filter((offer) => {
    if (!offerStateFilter) {
      return true;
    }

    return getOfferLifecycle(offer, today) === offerStateFilter;
  });

  const groupedOffers = offers.reduce<Record<string, OfferRow[]>>((groups, offer) => {
    const key = offer.kind === "membership" ? "Planos mensais" : "Promoções";
    groups[key] ??= [];
    groups[key].push(offer);
    return groups;
  }, {});

  return {
    activeOffersCount: activeOffersCountResult.count ?? 0,
    activeMembershipsCount: activeMembershipsCountResult.count ?? 0,
    groupedOffers,
    hasOfferFilters,
    offerKindFilter,
    offerQuery,
    offerStateFilter,
    offers,
    today,
  };
}

export async function loadReferralsPageData(searchParams?: ReferralSearchParams): Promise<ReferralsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const referralStatusFilter = firstParam(searchParams?.referralStatus).trim();
  const referralFrom = firstParam(searchParams?.referralFrom).trim();
  const referralTo = firstParam(searchParams?.referralTo).trim();
  const hasReferralFilters = Boolean(referralStatusFilter || referralFrom || referralTo);

  const referralEventsQuery = (() => {
    let query = supabase
      .from("salon_referral_events")
      .select("id, referrer_customer_id, invited_customer_id, status, qualified_at, created_at")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false });

    if (referralFrom) {
      query = query.gte("created_at", startOfDayIso(referralFrom));
    }

    if (referralTo) {
      query = query.lt("created_at", endOfDayExclusiveIso(referralTo));
    }

    return query;
  })();

  const [referralProgramResult, referralEventsResult, rewardUnlocksCountResult, availableRewardUnlocksCountResult, servicesResult] = await Promise.all([
    supabase.from("salon_referral_programs").select("*").eq("salon_id", salon.id).maybeSingle(),
    referralEventsQuery,
    supabase
      .from("salon_referral_reward_unlocks")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_referral_reward_unlocks")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "available"),
    supabase.from("services").select("id, name, category").eq("salon_id", salon.id).order("category").order("name"),
  ]);

  const referralEventsBase = (referralEventsResult.data ?? []) as ReferralEventRow[];
  const filteredEvents = referralStatusFilter
    ? referralEventsBase.filter((event) => event.status === referralStatusFilter)
    : referralEventsBase;

  const periodQualifiedCount = referralEventsBase.filter((event) => {
    if (!event.qualified_at) {
      return false;
    }

    if (referralFrom && event.qualified_at < startOfDayIso(referralFrom)) {
      return false;
    }

    if (referralTo && event.qualified_at >= endOfDayExclusiveIso(referralTo)) {
      return false;
    }

    return true;
  }).length;

  const customerIds = [
    ...new Set(
      filteredEvents
        .map((event) => event.referrer_customer_id)
        .concat(filteredEvents.map((event) => event.invited_customer_id)),
    ),
  ];
  const customerResult = customerIds.length
    ? await supabase.from("customers").select("id, name, referral_code").in("id", customerIds)
    : { data: [] as CustomerRow[] };
  const customerMap = new Map((customerResult.data ?? []).map((customer) => [customer.id, customer as CustomerRow]));

  const referralEvents = filteredEvents.map((event) => {
    const referrer = customerMap.get(event.referrer_customer_id);
    const invited = customerMap.get(event.invited_customer_id);

    return {
      id: event.id,
      created_at: event.created_at,
      invited_name: invited?.name ?? "Cliente indicado",
      qualified_at: event.qualified_at,
      referrer_name: referrer?.name ?? "Cliente do salão",
      status: event.status,
      used_referral_code: referrer?.referral_code ?? "Não identificado",
    } satisfies ReferralEntry;
  });

  const serviceOptions = ((servicesResult.data ?? []) as ReferralServiceOption[]).map((service) => ({
    id: service.id,
    name: service.name,
    category: service.category ?? null,
  }));
  const rewardServiceMap = new Map(serviceOptions.map((service) => [service.id, service.name]));
  const rawReferralProgram = (referralProgramResult.data ?? null) as ReferralProgramRow | null;
  const referralProgram = rawReferralProgram
    ? {
        ...rawReferralProgram,
        reward_service_name:
          rawReferralProgram.reward_service_name ??
          (rawReferralProgram.reward_service_id ? rewardServiceMap.get(rawReferralProgram.reward_service_id) ?? null : null),
      }
    : null;

  return {
    availableRewardUnlocksCount: availableRewardUnlocksCountResult.count ?? 0,
    hasReferralFilters,
    pendingCountInPeriod: referralEventsBase.filter((event) => event.status === "pending").length,
    periodQualifiedCount,
    referralEvents,
    referralEventsBaseCount: referralEventsBase.length,
    referralFrom,
    referralProgram,
    rewardUnlocksCount: rewardUnlocksCountResult.count ?? 0,
    referralStatusFilter,
    referralTo,
    serviceOptions,
  };
}

export async function loadLoyaltyPageData(): Promise<LoyaltyPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const [loyaltyDashboardResult, serviceOptionsResult] = await Promise.all([
    supabase.rpc("get_salon_loyalty_dashboard"),
    supabase.from("services").select("id, name, category").eq("salon_id", salon.id).order("category").order("name"),
  ]);

  const loyaltyDashboard = (loyaltyDashboardResult.data ?? defaultLoyaltyDashboard()) as LoyaltyDashboardResponse;

  return {
    loyaltyLeaderboard: loyaltyDashboard.leaderboard,
    loyaltyOverview: loyaltyDashboard.overview,
    loyaltyProgram: loyaltyDashboard.program,
    serviceOptions: ((serviceOptionsResult.data ?? []) as ReferralServiceOption[]).map((service) => ({
      id: service.id,
      name: service.name,
      category: service.category ?? null,
    })),
  };
}

export async function loadGrowthAutomationPageData(): Promise<GrowthAutomationPageData> {
  await requireOwnerSalon();
  const supabase = createClient();
  const growthAutomationDashboard = ((
    await supabase.rpc("get_salon_growth_automation_dashboard")
  ).data ?? defaultGrowthAutomationDashboard()) as GrowthAutomationDashboardResponse;

  return {
    growthAutomationOverview: growthAutomationDashboard.overview,
    growthAutomationRecentRuns: growthAutomationDashboard.recent_runs,
    growthAutomationSettings: growthAutomationDashboard.settings,
  };
}
