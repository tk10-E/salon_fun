import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import {
  BILLING_DISABLED,
  BILLING_PATH,
  getSalonBillingWorkspaceSnapshot,
  type BillingInterval,
} from "@/lib/billing";
import { buildAbsoluteUrl } from "@/lib/requestOrigin";
import {
  getStripeBillingReadiness,
  getStripeClient,
  getStripeOperationalStatus,
  resolveStripePriceId,
} from "@/lib/stripeBilling";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

function redirectIfBillingDisabled() {
  if (BILLING_DISABLED) {
    redirect(buildRedirectNotice("/dashboard", "Assinatura desativada no painel.", "info"));
  }
}

function formatStripeIssues(issues: string[]) {
  if (!issues.length) {
    return "Finalize a configuração live do Stripe antes de continuar.";
  }

  return issues.join(" ");
}

function parseBillingInterval(value: string): BillingInterval | null {
  if (value === "monthly" || value === "yearly") {
    return value;
  }

  return null;
}

function addBillingCycle(start: Date, billingInterval: BillingInterval) {
  const nextDate = new Date(start);
  nextDate.setUTCDate(nextDate.getUTCDate() + (billingInterval === "yearly" ? 365 : 30));
  return nextDate;
}

function revalidateBillingWorkspace() {
  revalidatePath("/dashboard", "layout");
  revalidatePath(BILLING_PATH);
  revalidatePath("/dashboard/settings");
}

function buildBillingAbsoluteUrl() {
  const billingUrl = buildAbsoluteUrl(BILLING_PATH);

  if (!billingUrl) {
    throw new Error("Configure APP_URL para habilitar o checkout absoluto do Stripe.");
  }

  return billingUrl;
}

async function ensureStripeCustomer(params: {
  salonId: string;
  salonName: string;
  ownerUserId: string;
  ownerEmail?: string | null;
}) {
  const { salonId, salonName, ownerUserId, ownerEmail } = params;
  const stripe = getStripeClient();
  const supabase = createClient();
  const billingSnapshot = await getSalonBillingWorkspaceSnapshot(salonId);

  if (
    billingSnapshot.subscription.paymentProvider === "stripe" &&
    billingSnapshot.subscription.providerCustomerId
  ) {
    return billingSnapshot.subscription.providerCustomerId;
  }

  const customer = await stripe.customers.create({
    email: ownerEmail ?? undefined,
    name: salonName,
    metadata: {
      salonId,
      ownerUserId,
    },
  });

  const { error } = await supabase.from("salon_subscriptions").upsert(
    {
      salon_id: salonId,
      plan_id: billingSnapshot.currentPlan.id,
      status: billingSnapshot.subscription.status,
      billing_interval: billingSnapshot.subscription.billingInterval,
      payment_provider: "stripe",
      provider_customer_id: customer.id,
      provider_subscription_id: billingSnapshot.subscription.providerSubscriptionId,
      trial_started_at: billingSnapshot.subscription.trialStartedAt,
      trial_ends_at: billingSnapshot.subscription.trialEndsAt,
      current_period_started_at: billingSnapshot.subscription.currentPeriodStartedAt,
      current_period_ends_at: billingSnapshot.subscription.currentPeriodEndsAt,
      grace_ends_at: billingSnapshot.subscription.graceEndsAt,
      activated_at: billingSnapshot.subscription.activatedAt,
      canceled_at: billingSnapshot.subscription.canceledAt,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    throw new Error("Não foi possível vincular o cliente Stripe ao salão.");
  }

  return customer.id;
}

export async function changeSalonPlanActionImpl(formData: FormData) {
  redirectIfBillingDisabled();
  const requestedPlanId = String(formData.get("planId") ?? "").trim();
  const requestedInterval = parseBillingInterval(String(formData.get("billingInterval") ?? "").trim());
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  if (!requestedPlanId || !requestedInterval) {
    redirect(buildRedirectNotice(BILLING_PATH, "Selecione um plano e um ciclo válidos.", "error"));
  }

  const { data: requestedPlan, error: requestedPlanError } = await supabase
    .from("saas_plan_catalog")
    .select("id, display_name")
    .eq("id", requestedPlanId)
    .eq("is_public", true)
    .maybeSingle();

  if (requestedPlanError || !requestedPlan) {
    redirect(buildRedirectNotice(BILLING_PATH, "Não foi possível localizar o plano escolhido.", "error"));
  }

  const now = new Date();
  const currentPeriodEndsAt = addBillingCycle(now, requestedInterval).toISOString();

  const { error } = await supabase.from("salon_subscriptions").upsert(
    {
      salon_id: salon.id,
      plan_id: requestedPlan.id,
      status: "active",
      billing_interval: requestedInterval,
      activated_at: now.toISOString(),
      current_period_started_at: now.toISOString(),
      current_period_ends_at: currentPeriodEndsAt,
      canceled_at: null,
      grace_ends_at: null,
      trial_started_at: null,
      trial_ends_at: null,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    redirect(buildRedirectNotice(BILLING_PATH, "Não foi possível atualizar a assinatura agora.", "error"));
  }

  revalidateBillingWorkspace();
  redirect(
    buildRedirectNotice(
      BILLING_PATH,
      `${requestedPlan.display_name} ativado com cobrança ${requestedInterval === "yearly" ? "anual" : "mensal"}.`,
      "success",
    ),
  );
}

export async function cancelSalonSubscriptionActionImpl() {
  redirectIfBillingDisabled();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("salon_subscriptions")
    .update({
      status: "canceled",
      canceled_at: now,
      grace_ends_at: null,
    })
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(BILLING_PATH, "Não foi possível cancelar a assinatura agora.", "error"));
  }

  revalidateBillingWorkspace();
  redirect(buildRedirectNotice(BILLING_PATH, "Assinatura marcada para cancelamento ao fim do ciclo.", "success"));
}

export async function resumeSalonSubscriptionActionImpl() {
  redirectIfBillingDisabled();
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const { data: currentSubscription, error: currentSubscriptionError } = await supabase
    .from("salon_subscriptions")
    .select("plan_id, billing_interval")
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (currentSubscriptionError || !currentSubscription) {
    redirect(buildRedirectNotice(BILLING_PATH, "Não foi possível localizar a assinatura atual.", "error"));
  }

  const billingInterval = parseBillingInterval(currentSubscription.billing_interval) ?? "monthly";
  const now = new Date();
  const { error } = await supabase
    .from("salon_subscriptions")
    .update({
      status: "active",
      canceled_at: null,
      grace_ends_at: null,
      activated_at: now.toISOString(),
      current_period_started_at: now.toISOString(),
      current_period_ends_at: addBillingCycle(now, billingInterval).toISOString(),
    })
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(BILLING_PATH, "Não foi possível retomar a assinatura agora.", "error"));
  }

  revalidateBillingWorkspace();
  redirect(buildRedirectNotice(BILLING_PATH, "Assinatura retomada com sucesso.", "success"));
}

export async function startStripeCheckoutActionImpl(formData: FormData) {
  const requestedPlanId = String(formData.get("planId") ?? "").trim();
  const requestedInterval = parseBillingInterval(String(formData.get("billingInterval") ?? "").trim());
  const readiness = getStripeBillingReadiness();
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient();

  if (!readiness.configured) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        `Stripe ainda não está completo neste ambiente. Faltam: ${readiness.missing.join(", ")}.`,
        "error",
      ),
    );
  }

  if (!requestedPlanId || !requestedInterval) {
    redirect(buildRedirectNotice(BILLING_PATH, "Selecione um plano e um ciclo válidos.", "error"));
  }

  const operationalStatus = await getStripeOperationalStatus();

  if (operationalStatus.mode !== "live" || !operationalStatus.webhookConfigured) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        formatStripeIssues(operationalStatus.issues),
        "error",
      ),
    );
  }

  const { data: requestedPlan, error: requestedPlanError } = await supabase
    .from("saas_plan_catalog")
    .select("id, display_name")
    .eq("id", requestedPlanId)
    .eq("is_public", true)
    .maybeSingle();

  if (requestedPlanError || !requestedPlan) {
    redirect(buildRedirectNotice(BILLING_PATH, "Não foi possível localizar o plano escolhido.", "error"));
  }

  let checkoutUrl: string | null = null;

  try {
    const stripe = getStripeClient();
    const billingUrl = buildBillingAbsoluteUrl();
    const customerId = await ensureStripeCustomer({
      salonId: salon.id,
      salonName: salon.name,
      ownerUserId: user.id,
      ownerEmail: user.email,
    });
    const priceId = resolveStripePriceId(requestedPlan.id, requestedInterval);
    const checkoutSession = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId,
      client_reference_id: salon.id,
      allow_promotion_codes: true,
      billing_address_collection: "auto",
      success_url: `${billingUrl}?message=Checkout+conclu%C3%ADdo.+A+assinatura+ser%C3%A1+atualizada+assim+que+o+Stripe+confirmar+o+pagamento.&tone=success`,
      cancel_url: `${billingUrl}?message=Checkout+cancelado.+Voc%C3%AA+pode+tentar+novamente+quando+quiser.&tone=info`,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      metadata: {
        salonId: salon.id,
        ownerUserId: user.id,
        planId: requestedPlan.id,
        billingInterval: requestedInterval,
      },
      subscription_data: {
        metadata: {
          salonId: salon.id,
          ownerUserId: user.id,
          planId: requestedPlan.id,
          billingInterval: requestedInterval,
        },
      },
    });

    if (!checkoutSession.url) {
      throw new Error("O Stripe não devolveu a URL do checkout.");
    }
    checkoutUrl = checkoutSession.url;
  } catch (error) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        error instanceof Error ? error.message : "Não foi possível abrir o checkout do Stripe agora.",
        "error",
      ),
    );
  }

  if (!checkoutUrl) {
    redirect(buildRedirectNotice(BILLING_PATH, "O Stripe não devolveu a URL do checkout.", "error"));
  }

  redirect(checkoutUrl);
}

export async function startStripeBillingPortalActionImpl() {
  const readiness = getStripeBillingReadiness();
  const { salon } = await requireOwnerSalon();
  const billingSnapshot = await getSalonBillingWorkspaceSnapshot(salon.id);

  if (!readiness.configured) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        `Stripe ainda não está completo neste ambiente. Faltam: ${readiness.missing.join(", ")}.`,
        "error",
      ),
    );
  }

  if (
    billingSnapshot.subscription.paymentProvider !== "stripe" ||
    !billingSnapshot.subscription.providerCustomerId
  ) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        "Ainda não existe um cliente Stripe vinculado ao salão. Inicie um checkout primeiro.",
        "error",
      ),
    );
  }

  const operationalStatus = await getStripeOperationalStatus();

  if (operationalStatus.mode !== "live" || !operationalStatus.portalConfigured) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        formatStripeIssues(operationalStatus.issues),
        "error",
      ),
    );
  }

  let portalUrl: string | null = null;

  try {
    const stripe = getStripeClient();
    const session = await stripe.billingPortal.sessions.create({
      customer: billingSnapshot.subscription.providerCustomerId,
      return_url: buildBillingAbsoluteUrl(),
    });
    portalUrl = session.url;
  } catch (error) {
    redirect(
      buildRedirectNotice(
        BILLING_PATH,
        error instanceof Error
          ? error.message
          : "Não foi possível abrir o portal de cobrança do Stripe agora.",
        "error",
      ),
    );
  }

  if (!portalUrl) {
    redirect(buildRedirectNotice(BILLING_PATH, "O Stripe não devolveu a URL do portal.", "error"));
  }

  redirect(portalUrl);
}
