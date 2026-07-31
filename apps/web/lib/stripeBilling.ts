import { unstable_cache } from "next/cache";
import Stripe from "stripe";

import {
  SINGLE_BILLING_INTERVALS,
  SINGLE_BILLING_PLAN_ID,
  type BillingInterval,
  type BillingStatus,
} from "@/lib/billing";
import { getConfiguredAppOrigin } from "@/lib/requestOrigin";
import {
  getStripePriceEnvName,
  getStripePriceId,
  getStripeSecretKey,
  getStripeWebhookSecret,
} from "@/lib/serverEnv";

const REQUIRED_STRIPE_PRICES = SINGLE_BILLING_INTERVALS.map(
  (billingInterval) => ({
    planId: SINGLE_BILLING_PLAN_ID,
    billingInterval,
  }),
);
const PLAN_IDS = ["starter", "growth", "premium"] as const;
const BILLING_INTERVALS = ["monthly", "yearly"] as const;
const STRIPE_BILLING_RETURN_PATH = "/dashboard/billing";
export const STRIPE_REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
] as const;

let stripeClient: Stripe | null = null;

export type StripeBillingReadiness = {
  configured: boolean;
  missing: string[];
};

export type StripeOperationalStatus = {
  configured: boolean;
  mode: "test" | "live" | "mixed" | "unknown";
  liveReady: boolean;
  issues: string[];
  activePortalConfigCount: number;
  portalConfigured: boolean;
  billingPortalReturnUrl: string | null;
  webhookConfigured: boolean;
  webhookUrl: string | null;
};

export function getStripeClient() {
  if (stripeClient) {
    return stripeClient;
  }

  const stripeSecretKey = getStripeSecretKey();

  if (!stripeSecretKey) {
    throw new Error("Missing STRIPE_SECRET_KEY.");
  }

  stripeClient = new Stripe(stripeSecretKey);
  return stripeClient;
}

export function getStripeBillingReadiness(): StripeBillingReadiness {
  const missing: string[] = [];

  if (!getStripeSecretKey()) {
    missing.push("STRIPE_SECRET_KEY");
  }

  if (!getStripeWebhookSecret()) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }

  for (const { planId, billingInterval } of REQUIRED_STRIPE_PRICES) {
    if (!getStripePriceId(planId, billingInterval)) {
      missing.push(getStripePriceEnvName(planId, billingInterval));
    }
  }

  return {
    configured: missing.length === 0,
    missing,
  };
}

async function loadStripeOperationalStatus(): Promise<StripeOperationalStatus> {
  const readiness = getStripeBillingReadiness();
  const configuredOrigin = getConfiguredAppOrigin();
  const billingPortalReturnUrl = configuredOrigin ? `${configuredOrigin}${STRIPE_BILLING_RETURN_PATH}` : null;
  const webhookUrl = configuredOrigin ? `${configuredOrigin}/api/stripe/webhook` : null;

  if (!readiness.configured) {
    return {
      configured: false,
      mode: "unknown",
      liveReady: false,
      issues: readiness.missing.map((item) => `Missing ${item}.`),
      activePortalConfigCount: 0,
      portalConfigured: false,
      billingPortalReturnUrl,
      webhookConfigured: false,
      webhookUrl,
    };
  }

  const stripe = getStripeClient();
  const issues: string[] = [];

  const priceResults = await Promise.all(
    REQUIRED_STRIPE_PRICES.map(async ({ planId, billingInterval }) => {
      const priceId = resolveStripePriceId(planId, billingInterval);

        try {
          const price = await stripe.prices.retrieve(priceId);
          return {
            name: getStripePriceEnvName(planId, billingInterval),
            livemode: price.livemode,
          };
        } catch (error) {
          issues.push(
            error instanceof Error
              ? `${getStripePriceEnvName(planId, billingInterval)} inválido: ${error.message}`
              : `${getStripePriceEnvName(planId, billingInterval)} inválido.`,
          );

          return null;
        }
      }),
  );

  const priceModes = new Set(priceResults.flatMap((item) => (item ? [item.livemode] : [])));
  const mode =
    priceModes.size === 0
      ? "unknown"
      : priceModes.size > 1
      ? "mixed"
      : priceModes.has(true)
      ? "live"
      : "test";

  if (mode === "test") {
    issues.push("Stripe ainda está em modo de teste.");
  }

  if (mode === "mixed") {
    issues.push("Os price IDs misturam itens de teste e produção.");
  }

  const [portalStatus, webhookStatus] = await Promise.all([
    (async () => {
      try {
        const portalConfigs = await stripe.billingPortal.configurations.list({ limit: 20 });
        const activeConfigs = portalConfigs.data.filter((config) => config.active);
        const portalConfigured = Boolean(
          billingPortalReturnUrl &&
            activeConfigs.some((config) => config.default_return_url === billingPortalReturnUrl),
        );

        return {
          activePortalConfigCount: activeConfigs.length,
          issue: portalConfigured
            ? null
            : "Customer Portal do Stripe ainda não está configurado para o billing do painel.",
          portalConfigured,
        };
      } catch (error) {
        return {
          activePortalConfigCount: 0,
          issue:
            error instanceof Error
              ? `Não foi possível validar o Customer Portal do Stripe: ${error.message}`
              : "Não foi possível validar o Customer Portal do Stripe.",
          portalConfigured: false,
        };
      }
    })(),
    (async () => {
      try {
        const webhookEndpoints = await stripe.webhookEndpoints.list({ limit: 20 });
        const matchedEndpoint = webhookEndpoints.data.find((endpoint) =>
          endpoint.url === webhookUrl &&
          endpoint.status === "enabled" &&
          webhookEndpointHandlesRequiredBillingEvents(endpoint)
        );
        const webhookConfigured = Boolean(webhookUrl && matchedEndpoint);

        if (webhookConfigured) {
          return {
            issue: null,
            webhookConfigured,
          };
        }

        const enabledEndpointWithMissingEvents = webhookEndpoints.data.find((endpoint) =>
          endpoint.url === webhookUrl && endpoint.status === "enabled"
        );

        return {
          issue:
            webhookUrl && enabledEndpointWithMissingEvents
              ? "Webhook do Stripe ainda não está ouvindo todos os eventos de cobrança necessários."
              : "Webhook do Stripe ainda não aponta para /api/stripe/webhook no domínio ativo.",
          webhookConfigured,
        };
      } catch (error) {
        return {
          issue:
            error instanceof Error
              ? `Não foi possível validar o webhook do Stripe: ${error.message}`
              : "Não foi possível validar o webhook do Stripe.",
          webhookConfigured: false,
        };
      }
    })(),
  ]);

  if (portalStatus.issue) {
    issues.push(portalStatus.issue);
  }

  if (webhookStatus.issue) {
    issues.push(webhookStatus.issue);
  }

  return {
    configured: true,
    mode,
    liveReady:
      issues.length === 0 &&
      mode === "live" &&
      portalStatus.portalConfigured &&
      webhookStatus.webhookConfigured,
    issues,
    activePortalConfigCount: portalStatus.activePortalConfigCount,
    portalConfigured: portalStatus.portalConfigured,
    billingPortalReturnUrl,
    webhookConfigured: webhookStatus.webhookConfigured,
    webhookUrl,
  };
}

const getStripeOperationalStatusCached = unstable_cache(
  async () => loadStripeOperationalStatus(),
  ["stripe-operational-status"],
  { revalidate: 300 },
);

export async function getStripeOperationalStatus(): Promise<StripeOperationalStatus> {
  return getStripeOperationalStatusCached();
}

export function resolveStripePriceId(planId: string, billingInterval: BillingInterval) {
  const priceId = getStripePriceId(planId, billingInterval);

  if (!priceId) {
    throw new Error(`Missing ${getStripePriceEnvName(planId, billingInterval)}.`);
  }

  return priceId;
}

export function resolvePlanIdFromStripePriceId(priceId: string) {
  for (const planId of PLAN_IDS) {
    for (const billingInterval of BILLING_INTERVALS) {
      if (getStripePriceId(planId, billingInterval) === priceId) {
        return {
          planId,
          billingInterval,
        };
      }
    }
  }

  return null;
}

export function isTerminalStripeSubscriptionStatus(
  status: Stripe.Subscription.Status,
) {
  return status === "canceled" || status === "incomplete_expired";
}

export function webhookEndpointHandlesRequiredBillingEvents(
  endpoint: Pick<Stripe.WebhookEndpoint, "enabled_events">,
) {
  if (endpoint.enabled_events.includes("*")) {
    return true;
  }

  return STRIPE_REQUIRED_WEBHOOK_EVENTS.every((eventType) =>
    endpoint.enabled_events.includes(eventType),
  );
}

export function mapStripeSubscriptionStatus(status: Stripe.Subscription.Status): BillingStatus {
  switch (status) {
    case "trialing":
      return "trialing";
    case "active":
      return "active";
    case "past_due":
      return "past_due";
    case "unpaid":
    case "incomplete":
    case "incomplete_expired":
      return "paused";
    case "paused":
      return "paused";
    case "canceled":
      return "canceled";
    default:
      return "paused";
  }
}

export function stripeTimestampToIso(value: number | null | undefined) {
  if (!value) {
    return null;
  }

  return new Date(value * 1000).toISOString();
}
