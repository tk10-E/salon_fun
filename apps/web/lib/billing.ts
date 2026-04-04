import { cache as reactCache } from "react";

import { createClient } from "@/lib/supabase/server";

export const BILLING_PATH = "/dashboard/billing";
export const BILLING_ALLOWED_PATHS = [BILLING_PATH, "/dashboard/settings"] as const;

export type BillingPlanId = "starter" | "growth" | "premium";
export type BillingInterval = "monthly" | "yearly";
export type BillingStatus = "trialing" | "active" | "past_due" | "paused" | "canceled";
export type BillingAccessState = "healthy" | "attention" | "locked";

export type SalonBillingPlan = {
  id: string;
  displayName: string;
  description: string;
  monthlyPrice: number;
  yearlyPrice: number;
  currencyCode: string;
  trialDays: number;
  maxStaffMembers: number | null;
  maxServices: number | null;
  maxMonthlyNotifications: number | null;
  includesGrowthAutomation: boolean;
  includesFeedVideo: boolean;
  includesCustomBranding: boolean;
  includesPrioritySupport: boolean;
  isDefault: boolean;
  isPublic: boolean;
  sortOrder: number;
  highlight: string | null;
  tagline: string | null;
};

export type SalonBillingSubscription = {
  id: string;
  salonId: string;
  planId: string;
  status: BillingStatus;
  billingInterval: BillingInterval;
  trialStartedAt: string | null;
  trialEndsAt: string | null;
  currentPeriodStartedAt: string | null;
  currentPeriodEndsAt: string | null;
  graceEndsAt: string | null;
  activatedAt: string | null;
  canceledAt: string | null;
  paymentProvider: string | null;
  providerCustomerId: string | null;
  providerSubscriptionId: string | null;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SalonBillingSnapshot = {
  plans: SalonBillingPlan[];
  currentPlan: SalonBillingPlan;
  subscription: SalonBillingSubscription;
  accessState: BillingAccessState;
  isLocked: boolean;
  shouldShowBanner: boolean;
  statusLabel: string;
  bannerTitle: string | null;
  bannerMessage: string | null;
  bannerTone: "soft" | "warm" | "accent" | "success" | "danger";
  nextBillingDateLabel: string | null;
  statusDetail: string;
  trialDaysRemaining: number | null;
  graceDaysRemaining: number | null;
  allowedPathsWhenLocked: readonly string[];
  isUsingFallback: boolean;
};

const DEFAULT_BILLING_PLANS: SalonBillingPlan[] = [
  {
    id: "starter",
    displayName: "Starter",
    description: "Base essencial para colocar o app do salão no ar com agenda, catálogo e visual próprio.",
    monthlyPrice: 79,
    yearlyPrice: 790,
    currencyCode: "BRL",
    trialDays: 14,
    maxStaffMembers: 3,
    maxServices: 25,
    maxMonthlyNotifications: 1500,
    includesGrowthAutomation: false,
    includesFeedVideo: false,
    includesCustomBranding: true,
    includesPrioritySupport: false,
    isDefault: true,
    isPublic: true,
    sortOrder: 10,
    highlight: "Entrada rápida com trial automático",
    tagline: "Operação base e app do cliente no ar",
  },
  {
    id: "growth",
    displayName: "Growth",
    description: "Escala comercial com automações, vídeo no feed e mais espaço para equipe e serviços.",
    monthlyPrice: 149,
    yearlyPrice: 1490,
    currencyCode: "BRL",
    trialDays: 7,
    maxStaffMembers: 8,
    maxServices: 80,
    maxMonthlyNotifications: 10000,
    includesGrowthAutomation: true,
    includesFeedVideo: true,
    includesCustomBranding: true,
    includesPrioritySupport: false,
    isDefault: false,
    isPublic: true,
    sortOrder: 20,
    highlight: "Vídeo no feed e automação inteligente",
    tagline: "Mais equipe, mais campanhas, mais retenção",
  },
  {
    id: "premium",
    displayName: "Premium",
    description: "Camada completa para operação madura com suporte prioritário e escala máxima.",
    monthlyPrice: 249,
    yearlyPrice: 2490,
    currencyCode: "BRL",
    trialDays: 7,
    maxStaffMembers: 25,
    maxServices: 250,
    maxMonthlyNotifications: 50000,
    includesGrowthAutomation: true,
    includesFeedVideo: true,
    includesCustomBranding: true,
    includesPrioritySupport: true,
    isDefault: false,
    isPublic: true,
    sortOrder: 30,
    highlight: "Escala máxima com suporte prioritário",
    tagline: "Estrutura pronta para alto volume",
  },
];

const cache = typeof reactCache === "function"
  ? reactCache
  : (<T extends (...args: never[]) => unknown>(fn: T) => fn);

function relationIsMissing(error: { code?: string | null; message?: string | null } | null | undefined) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist/i.test(error.message ?? "") ||
    /could not find the table/i.test(error.message ?? "")
  );
}

function maybeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function maybeNumber(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function maybeBoolean(value: unknown) {
  return typeof value === "boolean" ? value : false;
}

function normalizePlan(row: Record<string, unknown>): SalonBillingPlan {
  const metadata =
    row.metadata && typeof row.metadata === "object" && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};

  return {
    id: maybeString(row.id) ?? "starter",
    displayName: maybeString(row.display_name) ?? "Starter",
    description: maybeString(row.description) ?? "Plano do salão.",
    monthlyPrice: maybeNumber(row.monthly_price) ?? 0,
    yearlyPrice: maybeNumber(row.yearly_price) ?? 0,
    currencyCode: maybeString(row.currency_code) ?? "BRL",
    trialDays: maybeNumber(row.trial_days) ?? 0,
    maxStaffMembers: maybeNumber(row.max_staff_members),
    maxServices: maybeNumber(row.max_services),
    maxMonthlyNotifications: maybeNumber(row.max_monthly_notifications),
    includesGrowthAutomation: maybeBoolean(row.includes_growth_automation),
    includesFeedVideo: maybeBoolean(row.includes_feed_video),
    includesCustomBranding: maybeBoolean(row.includes_custom_branding),
    includesPrioritySupport: maybeBoolean(row.includes_priority_support),
    isDefault: maybeBoolean(row.is_default),
    isPublic: row.is_public === undefined ? true : maybeBoolean(row.is_public),
    sortOrder: maybeNumber(row.sort_order) ?? 0,
    highlight: maybeString(metadata.highlight),
    tagline: maybeString(metadata.tagline),
  };
}

function normalizeStatus(value: unknown): BillingStatus {
  return value === "active" ||
      value === "past_due" ||
      value === "paused" ||
      value === "canceled" ||
      value === "trialing"
    ? value
    : "trialing";
}

function normalizeInterval(value: unknown): BillingInterval {
  return value === "yearly" ? "yearly" : "monthly";
}

function normalizeSubscription(
  row: Record<string, unknown>,
  salonId: string,
): SalonBillingSubscription {
  return {
    id: maybeString(row.id) ?? `virtual-${salonId}`,
    salonId,
    planId: maybeString(row.plan_id) ?? "starter",
    status: normalizeStatus(row.status),
    billingInterval: normalizeInterval(row.billing_interval),
    trialStartedAt: maybeString(row.trial_started_at),
    trialEndsAt: maybeString(row.trial_ends_at),
    currentPeriodStartedAt: maybeString(row.current_period_started_at),
    currentPeriodEndsAt: maybeString(row.current_period_ends_at),
    graceEndsAt: maybeString(row.grace_ends_at),
    activatedAt: maybeString(row.activated_at),
    canceledAt: maybeString(row.canceled_at),
    paymentProvider: maybeString(row.payment_provider),
    providerCustomerId: maybeString(row.provider_customer_id),
    providerSubscriptionId: maybeString(row.provider_subscription_id),
    createdAt: maybeString(row.created_at),
    updatedAt: maybeString(row.updated_at),
  };
}

function addDays(baseDate: Date, days: number) {
  const nextDate = new Date(baseDate);
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate;
}

function buildFallbackSubscription(salonId: string, plans: SalonBillingPlan[]): SalonBillingSubscription {
  const now = new Date();
  const defaultPlan = plans.find((plan) => plan.isDefault) ?? plans[0] ?? DEFAULT_BILLING_PLANS[0];

  return {
    id: `virtual-${salonId}`,
    salonId,
    planId: defaultPlan.id,
    status: defaultPlan.trialDays > 0 ? "trialing" : "active",
    billingInterval: "monthly" as const,
    trialStartedAt: now.toISOString(),
    trialEndsAt: defaultPlan.trialDays > 0 ? addDays(now, defaultPlan.trialDays).toISOString() : null,
    currentPeriodStartedAt: null,
    currentPeriodEndsAt: null,
    graceEndsAt: null,
    activatedAt: null,
    canceledAt: null,
    paymentProvider: null,
    providerCustomerId: null,
    providerSubscriptionId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };
}

function formatBillingDate(value: string | null) {
  if (!value) {
    return null;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "long",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function getDaysRemaining(targetDateIso: string | null) {
  if (!targetDateIso) {
    return null;
  }

  const targetTime = new Date(targetDateIso).getTime();
  const now = Date.now();
  const diff = targetTime - now;

  if (Number.isNaN(diff)) {
    return null;
  }

  return Math.ceil(diff / (24 * 60 * 60 * 1000));
}

function getStatusLabel(status: BillingStatus) {
  switch (status) {
    case "active":
      return "Ativa";
    case "trialing":
      return "Em trial";
    case "past_due":
      return "Pagamento pendente";
    case "paused":
      return "Pausada";
    case "canceled":
      return "Cancelada";
    default:
      return "Em revisão";
  }
}

function buildSnapshot(plans: SalonBillingPlan[], subscription: SalonBillingSubscription, isUsingFallback: boolean) {
  const currentPlan =
    plans.find((plan) => plan.id === subscription.planId) ??
    plans.find((plan) => plan.isDefault) ??
    DEFAULT_BILLING_PLANS[0];
  const trialDaysRemaining = getDaysRemaining(subscription.trialEndsAt);
  const graceDaysRemaining = getDaysRemaining(subscription.graceEndsAt);
  const accessState =
    subscription.status === "active"
      ? "healthy"
      : subscription.status === "trialing"
        ? trialDaysRemaining !== null && trialDaysRemaining <= 5
          ? "attention"
          : "healthy"
        : subscription.status === "past_due"
          ? graceDaysRemaining !== null && graceDaysRemaining > 0
            ? "attention"
            : "locked"
          : subscription.status === "canceled"
            ? (getDaysRemaining(subscription.currentPeriodEndsAt) ?? -1) > 0
              ? "attention"
              : "locked"
            : "locked";

  let bannerTitle: string | null = null;
  let bannerMessage: string | null = null;
  let bannerTone: SalonBillingSnapshot["bannerTone"] = "soft";
  let shouldShowBanner = false;
  let nextBillingDateLabel = formatBillingDate(subscription.currentPeriodEndsAt ?? subscription.trialEndsAt);
  let statusDetail = `Plano ${currentPlan.displayName} em ${getStatusLabel(subscription.status).toLowerCase()}.`;

  if (subscription.status === "trialing" && trialDaysRemaining !== null && trialDaysRemaining <= 5) {
    shouldShowBanner = true;
    bannerTone = "warm";
    bannerTitle = "Seu trial está perto do fim";
    bannerMessage =
      trialDaysRemaining <= 0
        ? "O período de teste terminou. Escolha um plano para evitar bloqueios no painel."
        : `Faltam ${trialDaysRemaining} dia${trialDaysRemaining === 1 ? "" : "s"} para encerrar o trial.`;
    statusDetail =
      nextBillingDateLabel
        ? `Trial do plano ${currentPlan.displayName} ativo até ${nextBillingDateLabel}.`
        : `Trial do plano ${currentPlan.displayName} ativo.`;
  } else if (subscription.status === "past_due") {
    shouldShowBanner = true;
    bannerTone = graceDaysRemaining !== null && graceDaysRemaining > 0 ? "accent" : "danger";
    bannerTitle = graceDaysRemaining !== null && graceDaysRemaining > 0 ? "Cobrança em aberto" : "Painel bloqueado por inadimplência";
    bannerMessage =
      graceDaysRemaining !== null && graceDaysRemaining > 0
        ? `Regularize em até ${graceDaysRemaining} dia${graceDaysRemaining === 1 ? "" : "s"} para evitar o bloqueio das áreas premium.`
        : "O acesso às áreas operacionais foi travado. Reative um plano para voltar a editar o painel.";
    statusDetail =
      graceDaysRemaining !== null && graceDaysRemaining > 0
        ? `Pagamento pendente com janela de regularização em aberto.`
        : `Cobrança em aberto sem janela de regularização ativa.`;
  } else if (subscription.status === "canceled") {
    shouldShowBanner = true;
    bannerTone = accessState === "locked" ? "danger" : "soft";
    bannerTitle = accessState === "locked" ? "Assinatura encerrada" : "Assinatura cancelada";
    bannerMessage =
      accessState === "locked"
        ? "Escolha um plano para voltar a operar o painel completo."
        : nextBillingDateLabel
          ? `O acesso segue liberado até ${nextBillingDateLabel}. Depois disso, o painel será bloqueado.`
          : "O cancelamento está agendado ao fim do ciclo atual.";
    statusDetail =
      nextBillingDateLabel
        ? `Cancelamento programado para ${nextBillingDateLabel}.`
        : `Assinatura cancelada.`;
  } else if (subscription.status === "paused") {
    shouldShowBanner = true;
    bannerTone = "danger";
    bannerTitle = "Assinatura pausada";
    bannerMessage = "As áreas operacionais do painel estão bloqueadas até a retomada do plano.";
    statusDetail = "Assinatura pausada manualmente.";
  }

  return {
    plans,
    currentPlan,
    subscription,
    accessState,
    isLocked: accessState === "locked",
    shouldShowBanner,
    statusLabel: getStatusLabel(subscription.status),
    bannerTitle,
    bannerMessage,
    bannerTone,
    nextBillingDateLabel,
    statusDetail,
    trialDaysRemaining,
    graceDaysRemaining,
    allowedPathsWhenLocked: BILLING_ALLOWED_PATHS,
    isUsingFallback,
  } satisfies SalonBillingSnapshot;
}

async function createDefaultSubscriptionRow(params: {
  salonId: string;
  plans: SalonBillingPlan[];
}) {
  const { salonId, plans } = params;
  const supabase = createClient();
  const defaultPlan = plans.find((plan) => plan.isDefault) ?? plans[0] ?? DEFAULT_BILLING_PLANS[0];
  const now = new Date();
  const payload = {
    salon_id: salonId,
    plan_id: defaultPlan.id,
    status: defaultPlan.trialDays > 0 ? "trialing" : "active",
    billing_interval: "monthly",
    trial_started_at: now.toISOString(),
    trial_ends_at: defaultPlan.trialDays > 0 ? addDays(now, defaultPlan.trialDays).toISOString() : null,
  };

  const { data, error } = await supabase
    .from("salon_subscriptions")
    .upsert(payload, { onConflict: "salon_id" })
    .select("*")
    .single();

  if (error || !data) {
    return null;
  }

  return normalizeSubscription(data as Record<string, unknown>, salonId);
}

export const getSalonBillingSnapshot = cache(async (salonId: string): Promise<SalonBillingSnapshot> => {
  const supabase = createClient();
  const [planResult, subscriptionResult] = await Promise.all([
    supabase.from("saas_plan_catalog").select("*").eq("is_public", true).order("sort_order"),
    supabase.from("salon_subscriptions").select("*").eq("salon_id", salonId).maybeSingle(),
  ]);

  const billingTablesMissing = relationIsMissing(planResult.error) || relationIsMissing(subscriptionResult.error);
  const shouldFallback = billingTablesMissing || Boolean(planResult.error && !planResult.data) || Boolean(subscriptionResult.error && !subscriptionResult.data);

  const plans =
    !planResult.error && Array.isArray(planResult.data) && planResult.data.length
      ? planResult.data.map((row) => normalizePlan(row as Record<string, unknown>))
      : DEFAULT_BILLING_PLANS;

  if (shouldFallback) {
    return buildSnapshot(plans, buildFallbackSubscription(salonId, plans), true);
  }

  const ensuredSubscription =
    subscriptionResult.data
      ? normalizeSubscription(subscriptionResult.data as Record<string, unknown>, salonId)
      : await createDefaultSubscriptionRow({ salonId, plans });

  return buildSnapshot(plans, ensuredSubscription ?? buildFallbackSubscription(salonId, plans), !ensuredSubscription);
});

export async function getSalonBillingEntitlements(salonId: string) {
  const snapshot = await getSalonBillingSnapshot(salonId);

  return {
    snapshot,
    currentPlan: snapshot.currentPlan,
    maxStaffMembers: snapshot.currentPlan.maxStaffMembers,
    maxServices: snapshot.currentPlan.maxServices,
    maxMonthlyNotifications: snapshot.currentPlan.maxMonthlyNotifications,
    includesGrowthAutomation: snapshot.currentPlan.includesGrowthAutomation,
    includesFeedVideo: snapshot.currentPlan.includesFeedVideo,
    includesCustomBranding: snapshot.currentPlan.includesCustomBranding,
    includesPrioritySupport: snapshot.currentPlan.includesPrioritySupport,
  };
}

export function formatBillingPrice(price: number, currencyCode = "BRL") {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: currencyCode,
    minimumFractionDigits: 0,
  }).format(price);
}

export function formatLimitLabel(limit: number | null, singular: string, plural = singular) {
  if (limit === null) {
    return "Ilimitado";
  }

  return `${limit} ${limit === 1 ? singular : plural}`;
}
