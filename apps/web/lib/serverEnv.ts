type NonEmptyString = string & { __brand: "non-empty" };

function readOptionalEnv(...names: string[]) {
  for (const name of names) {
    const value = process.env[name]?.trim();

    if (value) {
      return value as NonEmptyString;
    }
  }

  return undefined;
}

export function getSupabaseServiceRoleKey() {
  return readOptionalEnv("SUPABASE_SERVICE_ROLE_KEY");
}

export function getCronSecret() {
  return readOptionalEnv("CRON_SECRET");
}

export function getStripeSecretKey() {
  return readOptionalEnv("STRIPE_SECRET_KEY");
}

export function getSaasBillingEnabledFlag() {
  const value = readOptionalEnv("ENABLE_SAAS_BILLING");
  return value === "true";
}

export function getStripeWebhookSecret() {
  return readOptionalEnv("STRIPE_WEBHOOK_SECRET");
}

export function getStripePriceEnvName(planId: string, billingInterval: "monthly" | "yearly") {
  return `STRIPE_PRICE_${planId.toUpperCase()}_${billingInterval.toUpperCase()}`;
}

export function getStripePriceId(planId: string, billingInterval: "monthly" | "yearly") {
  return readOptionalEnv(getStripePriceEnvName(planId, billingInterval));
}
