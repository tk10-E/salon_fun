import { cache as reactCache } from "react";

import { createClient } from "@/lib/supabase/server";
import {
  getSaasBillingEnabledFlag,
  getStripePriceId,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "@/lib/serverEnv";

export const SINGLE_BILLING_PLAN_ID = "starter" as const;
export const SINGLE_BILLING_INTERVAL = "monthly" as const;
export const SINGLE_BILLING_INTERVALS = ["monthly", "yearly"] as const;
export const SINGLE_BILLING_PLAN_MONTHLY_PRICE = 89;
export const SINGLE_BILLING_PLAN_YEARLY_PRICE = 890;
export const SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE =
  SINGLE_BILLING_PLAN_MONTHLY_PRICE * 12;
export const SINGLE_BILLING_PLAN_YEARLY_SAVINGS =
  SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE -
  SINGLE_BILLING_PLAN_YEARLY_PRICE;
export const SINGLE_BILLING_PLAN_CURRENCY_CODE = "BRL";
export const SINGLE_BILLING_PLAN_MONTHLY_PRICE_LABEL = formatBillingPrice(
  SINGLE_BILLING_PLAN_MONTHLY_PRICE,
  SINGLE_BILLING_PLAN_CURRENCY_CODE,
);
export const SINGLE_BILLING_PLAN_YEARLY_PRICE_LABEL = formatBillingPrice(
  SINGLE_BILLING_PLAN_YEARLY_PRICE,
  SINGLE_BILLING_PLAN_CURRENCY_CODE,
);
export const SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE_LABEL =
  formatBillingPrice(
    SINGLE_BILLING_PLAN_YEARLY_COMPARE_AT_PRICE,
    SINGLE_BILLING_PLAN_CURRENCY_CODE,
  );
export const SINGLE_BILLING_PLAN_YEARLY_SAVINGS_LABEL = formatBillingPrice(
  SINGLE_BILLING_PLAN_YEARLY_SAVINGS,
  SINGLE_BILLING_PLAN_CURRENCY_CODE,
);

function hasStripeLiveSecret() {
  return getStripeSecretKey()?.startsWith("sk_live_") ?? false;
}

function hasStripeBillingCatalogConfigured() {
  return SINGLE_BILLING_INTERVALS.every((billingInterval) =>
    Boolean(getStripePriceId(SINGLE_BILLING_PLAN_ID, billingInterval)),
  );
}

// O bloqueio automático do painel só entra quando o ambiente já está apto a cobrar de verdade.
// Enquanto o Stripe estiver em modo de teste, o workspace segue visível, mas sem travar a operação.
export const BILLING_DISABLED = !(
  getSaasBillingEnabledFlag() &&
  hasStripeLiveSecret() &&
  Boolean(getStripeWebhookSecret()) &&
  hasStripeBillingCatalogConfigured()
);

export const BILLING_PATH = "/dashboard/billing";
export const PUBLIC_BILLING_PATH = "/planos";
export const BILLING_ALLOWED_PATHS = [BILLING_PATH, PUBLIC_BILLING_PATH] as const;

export type BillingPlanId = typeof SINGLE_BILLING_PLAN_ID;
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

function buildUnifiedPlan(
  plan?: Partial<SalonBillingPlan>,
): SalonBillingPlan {
  const basePlan: SalonBillingPlan = {
    id: SINGLE_BILLING_PLAN_ID,
    displayName: "Plano Único",
    description: "Todos os recursos do painel liberados por um único valor mensal.",
    monthlyPrice: SINGLE_BILLING_PLAN_MONTHLY_PRICE,
    yearlyPrice: SINGLE_BILLING_PLAN_YEARLY_PRICE,
    currencyCode: "BRL",
    trialDays: 3,
    maxStaffMembers: null,
    maxServices: null,
    maxMonthlyNotifications: null,
    includesGrowthAutomation: true,
    includesFeedVideo: true,
    includesCustomBranding: true,
    includesPrioritySupport: true,
    isDefault: true,
    isPublic: true,
    sortOrder: 10,
    highlight: "Mensal por R$ 89 ou anual por R$ 890",
    tagline: "Uma assinatura mensal libera agenda, clientes, equipe, caixa e app",
  };

  const fixedPlan: Partial<SalonBillingPlan> = {
    id: SINGLE_BILLING_PLAN_ID,
    displayName: "Plano Único",
    description: "Todos os recursos do painel liberados por um único valor mensal.",
    monthlyPrice: SINGLE_BILLING_PLAN_MONTHLY_PRICE,
    yearlyPrice: SINGLE_BILLING_PLAN_YEARLY_PRICE,
    maxStaffMembers: null,
    maxServices: null,
    maxMonthlyNotifications: null,
    includesGrowthAutomation: true,
    includesFeedVideo: true,
    includesCustomBranding: true,
    includesPrioritySupport: true,
    isDefault: true,
    isPublic: true,
    sortOrder: 10,
    highlight: "Mensal por R$ 89 ou anual por R$ 890",
    tagline: "Uma assinatura mensal libera agenda, clientes, equipe, caixa e app",
  };

  return {
    ...basePlan,
    ...plan,
    ...fixedPlan,
  };
}



const DEFAULT_BILLING_PLANS: SalonBillingPlan[] = [buildUnifiedPlan()];

function collapsePlansToUnifiedCatalog(plans: SalonBillingPlan[]) {
  const preferredPlan =
    plans.find((plan) => plan.id === SINGLE_BILLING_PLAN_ID) ??
    plans.find((plan) => plan.isDefault) ??
    plans[0] ??
    null;

  return [buildUnifiedPlan(preferredPlan ?? undefined)];
}

const cache = typeof reactCache === "function"
  ? reactCache
  : (<T extends (...args: never[]) => unknown>(fn: T) => fn);

function buildDisabledSnapshot(salonId: string): SalonBillingSnapshot {
  const now = new Date().toISOString();
  const disabledPlan: SalonBillingPlan = {
    id: "free",
    displayName: "Assinatura desativada",
    description: "Cobrança desligada temporariamente.",
    monthlyPrice: 0,
    yearlyPrice: 0,
    currencyCode: "BRL",
    trialDays: 0,
    maxStaffMembers: null,
    maxServices: null,
    maxMonthlyNotifications: null,
    includesGrowthAutomation: true,
    includesFeedVideo: true,
    includesCustomBranding: true,
    includesPrioritySupport: true,
    isDefault: true,
    isPublic: true,
    sortOrder: 0,
    highlight: "Sem cobrança ativa",
    tagline: "Billing desativado",
  };

  return {
    plans: [disabledPlan],
    currentPlan: disabledPlan,
    subscription: {
      id: `disabled-${salonId}`,
      salonId,
      planId: disabledPlan.id,
      status: "active",
      billingInterval: "monthly",
      trialStartedAt: null,
      trialEndsAt: null,
      currentPeriodStartedAt: null,
      currentPeriodEndsAt: null,
      graceEndsAt: null,
      activatedAt: now,
      canceledAt: null,
      paymentProvider: null,
      providerCustomerId: null,
      providerSubscriptionId: null,
      createdAt: now,
      updatedAt: now,
    },
    accessState: "healthy",
    isLocked: false,
    shouldShowBanner: false,
    statusLabel: "Desativado",
    bannerTitle: null,
    bannerMessage: null,
    bannerTone: "soft",
    nextBillingDateLabel: null,
    statusDetail: "Cobrança desligada temporariamente.",
    trialDaysRemaining: null,
    graceDaysRemaining: null,
    allowedPathsWhenLocked: BILLING_ALLOWED_PATHS,
    isUsingFallback: true,
  } satisfies SalonBillingSnapshot;
}

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

function nonNegativeNumber(value: unknown, fallback = 0) {
  const parsed = maybeNumber(value);

  if (parsed === null) {
    return fallback;
  }

  return Math.max(parsed, 0);
}

function nonNegativeInteger(value: unknown, fallback = 0) {
  return Math.trunc(nonNegativeNumber(value, fallback));
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
    monthlyPrice: nonNegativeNumber(row.monthly_price),
    yearlyPrice: nonNegativeNumber(row.yearly_price),
    currencyCode: maybeString(row.currency_code) ?? "BRL",
    trialDays: nonNegativeInteger(row.trial_days),
    maxStaffMembers:
      row.max_staff_members == null ? null : nonNegativeInteger(row.max_staff_members),
    maxServices: row.max_services == null ? null : nonNegativeInteger(row.max_services),
    maxMonthlyNotifications:
      row.max_monthly_notifications == null
        ? null
        : nonNegativeInteger(row.max_monthly_notifications),
    includesGrowthAutomation: maybeBoolean(row.includes_growth_automation),
    includesFeedVideo: maybeBoolean(row.includes_feed_video),
    includesCustomBranding: maybeBoolean(row.includes_custom_branding),
    includesPrioritySupport: maybeBoolean(row.includes_priority_support),
    isDefault: maybeBoolean(row.is_default),
    isPublic: row.is_public === undefined ? true : maybeBoolean(row.is_public),
    sortOrder: nonNegativeInteger(row.sort_order),
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
    planId: maybeString(row.plan_id) ?? SINGLE_BILLING_PLAN_ID,
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

function buildFallbackSubscription(salonId: string, plans: SalonBillingPlan[]): SalonBillingSubscription {
  const defaultPlan = plans.find((plan) => plan.isDefault) ?? plans[0] ?? DEFAULT_BILLING_PLANS[0];
  const now = new Date();

  return {
    id: `virtual-${salonId}`,
    salonId,
    planId: defaultPlan.id,
    status: "paused",
    billingInterval: SINGLE_BILLING_INTERVAL,
    trialStartedAt: null,
    trialEndsAt: null,
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

function isPendingActivationSubscription(subscription: SalonBillingSubscription) {
  return (
    subscription.status === "paused" &&
    !subscription.activatedAt &&
    !subscription.currentPeriodStartedAt &&
    !subscription.currentPeriodEndsAt &&
    !subscription.trialStartedAt &&
    !subscription.trialEndsAt
  );
}

function buildSnapshot(plans: SalonBillingPlan[], subscription: SalonBillingSubscription, isUsingFallback: boolean) {
  const currentPlan =
    plans.find((plan) => plan.id === subscription.planId) ??
    plans.find((plan) => plan.isDefault) ??
    DEFAULT_BILLING_PLANS[0];
  const trialDaysRemaining = getDaysRemaining(subscription.trialEndsAt);
  const graceDaysRemaining = getDaysRemaining(subscription.graceEndsAt);
  const pendingActivation = isPendingActivationSubscription(subscription);
  const accessState =
    pendingActivation
      ? "locked"
      : subscription.status === "active"
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
  let statusDetail = pendingActivation
    ? "Conta criada. Conclua a assinatura mensal de R$ 89 para liberar o painel completo."
    : `Plano ${currentPlan.displayName} em ${getStatusLabel(subscription.status).toLowerCase()}.`;

  if (pendingActivation) {
    shouldShowBanner = true;
    bannerTone = "accent";
    bannerTitle = "Ative a assinatura para começar";
    bannerMessage =
      "Conclua a assinatura mensal de R$ 89 para liberar agenda, clientes, equipe, caixa e demais áreas operacionais.";
    nextBillingDateLabel = null;
  } else if (subscription.status === "trialing" && trialDaysRemaining !== null && trialDaysRemaining <= 5) {
    shouldShowBanner = true;
    bannerTone = "warm";
    bannerTitle = "Seu trial está perto do fim";
    bannerMessage =
      trialDaysRemaining <= 0
        ? "O período de teste terminou. Ative a assinatura de R$ 89 para evitar bloqueios no painel."
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
        ? `Regularize em até ${graceDaysRemaining} dia${graceDaysRemaining === 1 ? "" : "s"} para evitar o bloqueio das áreas operacionais.`
        : "O acesso às áreas operacionais foi travado. Reative a assinatura mensal para voltar a editar o painel.";
    statusDetail =
      graceDaysRemaining !== null && graceDaysRemaining > 0
        ? "Pagamento pendente com janela de regularização em aberto."
        : "Cobrança em aberto sem janela de regularização ativa.";
  } else if (subscription.status === "canceled") {
    shouldShowBanner = true;
    bannerTone = accessState === "locked" ? "danger" : "soft";
    bannerTitle = accessState === "locked" ? "Assinatura encerrada" : "Assinatura cancelada";
    bannerMessage =
      accessState === "locked"
        ? "Reative a assinatura mensal para voltar a operar o painel completo."
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
    statusLabel: pendingActivation ? "Aguardando assinatura" : getStatusLabel(subscription.status),
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
    status: "paused",
    billing_interval: "monthly",
    trial_started_at: null,
      trial_ends_at: null,
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

async function loadSalonBillingSnapshot(
  salonId: string,
  options?: {
    includeWorkspaceDataWhenDisabled?: boolean;
  },
): Promise<SalonBillingSnapshot> {
  if (BILLING_DISABLED && !options?.includeWorkspaceDataWhenDisabled) {
    return buildDisabledSnapshot(salonId);
  }

  const supabase = createClient();
  const [planResult, subscriptionResult] = await Promise.all([
    supabase.from("saas_plan_catalog").select("*").eq("is_public", true).order("sort_order"),
    supabase.from("salon_subscriptions").select("*").eq("salon_id", salonId).maybeSingle(),
  ]);

  const billingTablesMissing = relationIsMissing(planResult.error) || relationIsMissing(subscriptionResult.error);
  const shouldFallback = billingTablesMissing || Boolean(planResult.error && !planResult.data) || Boolean(subscriptionResult.error && !subscriptionResult.data);

  const plans =
    !planResult.error && Array.isArray(planResult.data) && planResult.data.length
      ? collapsePlansToUnifiedCatalog(
          planResult.data.map((row) => normalizePlan(row as Record<string, unknown>)),
        )
      : DEFAULT_BILLING_PLANS;

  if (shouldFallback) {
    return buildSnapshot(plans, buildFallbackSubscription(salonId, plans), true);
  }

  const ensuredSubscription =
    subscriptionResult.data
      ? normalizeSubscription(subscriptionResult.data as Record<string, unknown>, salonId)
      : await createDefaultSubscriptionRow({ salonId, plans });

  return buildSnapshot(plans, ensuredSubscription ?? buildFallbackSubscription(salonId, plans), !ensuredSubscription);
}

async function loadPublicBillingPlans(): Promise<SalonBillingPlan[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("saas_plan_catalog")
    .select("*")
    .eq("is_public", true)
    .order("sort_order");

  if (relationIsMissing(error) || error || !Array.isArray(data) || data.length === 0) {
    return DEFAULT_BILLING_PLANS;
  }

  return collapsePlansToUnifiedCatalog(
    data.map((row) => normalizePlan(row as Record<string, unknown>)),
  );
}

export const getSalonBillingSnapshot = cache(async (salonId: string): Promise<SalonBillingSnapshot> => {
  return loadSalonBillingSnapshot(salonId);
});

export const getSalonBillingWorkspaceSnapshot = cache(async (salonId: string): Promise<SalonBillingSnapshot> => {
  return loadSalonBillingSnapshot(salonId, { includeWorkspaceDataWhenDisabled: true });
});

export const getPublicBillingPlans = cache(async (): Promise<SalonBillingPlan[]> => {
  return loadPublicBillingPlans();
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

