import { NextResponse } from "next/server";
import type Stripe from "stripe";

import { getStripeClient } from "@/lib/stripeBilling";
import { getStripeWebhookSecret } from "@/lib/serverEnv";
import { syncStripeSubscriptionRecord } from "@/lib/stripeBillingSync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function syncSubscriptionFromCheckoutSession(session: Stripe.Checkout.Session) {
  if (session.mode !== "subscription" || !session.subscription) {
    return;
  }

  const stripe = getStripeClient();
  const subscriptionId =
    typeof session.subscription === "string" ? session.subscription : session.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await syncStripeSubscriptionRecord(subscription, {
    salonId: session.metadata?.salonId ?? session.client_reference_id ?? null,
    planId: session.metadata?.planId ?? null,
    providerCustomerId:
      typeof session.customer === "string" ? session.customer : session.customer?.id ?? null,
  });
}

async function syncSubscriptionFromInvoice(invoice: Stripe.Invoice) {
  const invoiceRecord = invoice as Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null;
    customer?: string | Stripe.Customer | Stripe.DeletedCustomer | null;
  };

  if (!invoiceRecord.subscription) {
    return;
  }

  const stripe = getStripeClient();
  const subscriptionId =
    typeof invoiceRecord.subscription === "string"
      ? invoiceRecord.subscription
      : invoiceRecord.subscription.id;
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  await syncStripeSubscriptionRecord(subscription, {
    providerCustomerId:
      typeof invoiceRecord.customer === "string"
        ? invoiceRecord.customer
        : invoiceRecord.customer?.id ?? null,
  });
}

async function handleStripeWebhookEvent(event: Stripe.Event) {
  switch (event.type) {
    case "checkout.session.completed":
      await syncSubscriptionFromCheckoutSession(event.data.object as Stripe.Checkout.Session);
      return;
    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      await syncStripeSubscriptionRecord(event.data.object as Stripe.Subscription);
      return;
    case "invoice.paid":
    case "invoice.payment_failed":
      await syncSubscriptionFromInvoice(event.data.object as Stripe.Invoice);
      return;
    default:
      return;
  }
}

export async function POST(request: Request) {
  const webhookSecret = getStripeWebhookSecret();

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "missing_stripe_webhook_secret" },
      { status: 500 },
    );
  }

  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "missing_stripe_signature" }, { status: 400 });
  }

  const rawBody = await request.text();

  try {
    const stripe = getStripeClient();
    const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

    await handleStripeWebhookEvent(event);

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error("stripe-webhook failed", error);

    return NextResponse.json(
      {
        error: "stripe_webhook_failed",
        detail: error instanceof Error ? error.message : "unknown_stripe_webhook_error",
      },
      { status: 400 },
    );
  }
}
