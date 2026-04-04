import type Stripe from "stripe";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  mapStripeSubscriptionStatus,
  resolvePlanIdFromStripePriceId,
  stripeTimestampToIso,
} from "@/lib/stripeBilling";

function nonEmptyString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : null;
}

function addGracePeriodIso(days = 3) {
  const nextDate = new Date();
  nextDate.setUTCDate(nextDate.getUTCDate() + days);
  return nextDate.toISOString();
}

async function findExistingSubscription(args: {
  providerSubscriptionId?: string | null;
  providerCustomerId?: string | null;
}): Promise<{ salon_id: string; plan_id: string; activated_at: string | null } | null> {
  const admin = createAdminClient() as any;

  if (args.providerSubscriptionId) {
    const { data } = await admin
      .from("salon_subscriptions")
      .select("salon_id, plan_id, activated_at")
      .eq("provider_subscription_id", args.providerSubscriptionId)
      .maybeSingle();

    if (data) {
      return data as { salon_id: string; plan_id: string; activated_at: string | null };
    }
  }

  if (args.providerCustomerId) {
    const { data } = await admin
      .from("salon_subscriptions")
      .select("salon_id, plan_id, activated_at")
      .eq("provider_customer_id", args.providerCustomerId)
      .maybeSingle();

    if (data) {
      return data as { salon_id: string; plan_id: string; activated_at: string | null };
    }
  }

  return null;
}

export async function syncStripeSubscriptionRecord(
  subscription: Stripe.Subscription,
  context?: {
    salonId?: string | null;
    planId?: string | null;
    providerCustomerId?: string | null;
  },
) {
  const admin = createAdminClient() as any;
  const providerCustomerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer?.id ?? context?.providerCustomerId ?? null;
  const firstItem = subscription.items.data[0];
  const priceId = firstItem?.price?.id ?? null;
  const resolvedPricePlan = priceId ? resolvePlanIdFromStripePriceId(priceId) : null;
  const existingSubscription = await findExistingSubscription({
    providerSubscriptionId: subscription.id,
    providerCustomerId,
  });
  const salonId =
    context?.salonId ??
    nonEmptyString(subscription.metadata?.salonId) ??
    existingSubscription?.salon_id ??
    null;

  if (!salonId) {
    throw new Error(`Não foi possível resolver o salão da assinatura Stripe ${subscription.id}.`);
  }

  const planId =
    context?.planId ??
    nonEmptyString(subscription.metadata?.planId) ??
    resolvedPricePlan?.planId ??
    existingSubscription?.plan_id ??
    "starter";
  const billingInterval =
    resolvedPricePlan?.billingInterval ??
    (firstItem?.price?.recurring?.interval === "year" ? "yearly" : "monthly");
  const mappedStatus = mapStripeSubscriptionStatus(subscription.status);
  const currentPeriodStart = stripeTimestampToIso((subscription as Stripe.Subscription & { current_period_start?: number }).current_period_start);
  const currentPeriodEnd = stripeTimestampToIso((subscription as Stripe.Subscription & { current_period_end?: number }).current_period_end);
  const trialStart = stripeTimestampToIso(subscription.trial_start);
  const trialEnd = stripeTimestampToIso(subscription.trial_end);
  const canceledAt = stripeTimestampToIso(subscription.canceled_at);
  const activatedAt =
    mappedStatus === "active" || mappedStatus === "trialing"
      ? existingSubscription?.activated_at ?? currentPeriodStart ?? trialStart ?? new Date().toISOString()
      : existingSubscription?.activated_at ?? null;

  const { error } = await admin.from("salon_subscriptions").upsert(
    {
      salon_id: salonId,
      plan_id: planId,
      status: mappedStatus,
      billing_interval: billingInterval,
      trial_started_at: trialStart,
      trial_ends_at: trialEnd,
      current_period_started_at: currentPeriodStart,
      current_period_ends_at: currentPeriodEnd,
      grace_ends_at: mappedStatus === "past_due" ? addGracePeriodIso() : null,
      activated_at: activatedAt,
      canceled_at: mappedStatus === "canceled" ? canceledAt ?? new Date().toISOString() : null,
      payment_provider: "stripe",
      provider_customer_id: providerCustomerId,
      provider_subscription_id: subscription.id,
    },
    { onConflict: "salon_id" },
  );

  if (error) {
    throw new Error(`Não foi possível sincronizar a assinatura Stripe ${subscription.id}.`);
  }
}
