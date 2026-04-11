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

export function getStripeSecretKey() {
  return readOptionalEnv("STRIPE_SECRET_KEY");
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

export function getWhatsAppPhoneNumberId() {
  return readOptionalEnv("WHATSAPP_PHONE_NUMBER_ID");
}

export function getWhatsAppBusinessAccountId() {
  return readOptionalEnv("WHATSAPP_BUSINESS_ACCOUNT_ID");
}

export function getMetaPermanentToken() {
  return readOptionalEnv("META_PERMANENT_TOKEN");
}

export function getMetaAppId() {
  return readOptionalEnv("META_APP_ID");
}

export function getMetaAppSecret() {
  return readOptionalEnv("META_APP_SECRET");
}

export function getWhatsAppVerifyToken() {
  return readOptionalEnv("WHATSAPP_VERIFY_TOKEN");
}

export function getWhatsAppDispatchSecret() {
  return readOptionalEnv(
    "WHATSAPP_DISPATCH_SECRET",
    "CRON_SECRET",
    "VERCEL_CRON_SECRET",
  );
}
