import fs from "node:fs";
import path from "node:path";

import Stripe from "stripe";

const REQUIRED_WEBHOOK_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.paid",
  "invoice.payment_failed",
];

function parseEnvFile(filePath) {
  const env = {};
  const text = fs.readFileSync(filePath, "utf8");

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) {
      continue;
    }

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = line.slice(0, separatorIndex).trim();
    let value = line.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

function readEnv() {
  const envPath = path.join(process.cwd(), ".env.local");
  const fileEnv = fs.existsSync(envPath) ? parseEnvFile(envPath) : {};

  return {
    ...fileEnv,
    ...process.env,
  };
}

function normalizeOrigin(value) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  try {
    return new URL(normalized).origin.replace(/\/+$/, "");
  } catch {
    return null;
  }
}

function inferSecretMode(secretKey) {
  if (!secretKey) {
    return "missing";
  }

  if (secretKey.startsWith("sk_live_")) {
    return "live";
  }

  if (secretKey.startsWith("sk_test_")) {
    return "test";
  }

  return "unknown";
}

function boolLabel(value) {
  return value ? "ok" : "faltando";
}

async function main() {
  const env = readEnv();
  const secretKey = env.STRIPE_SECRET_KEY?.trim();
  const appOrigin = normalizeOrigin(env.APP_URL || env.NEXT_PUBLIC_APP_URL);
  const expectedWebhookUrl = appOrigin ? `${appOrigin}/api/stripe/webhook` : null;
  const expectedPortalReturnUrl = appOrigin ? `${appOrigin}/dashboard/billing` : null;
  const priceEnvNames = [
    "STRIPE_PRICE_STARTER_MONTHLY",
  ];

  const missing = [];

  if (!secretKey) {
    missing.push("STRIPE_SECRET_KEY");
  }

  if (!env.STRIPE_WEBHOOK_SECRET?.trim()) {
    missing.push("STRIPE_WEBHOOK_SECRET");
  }

  for (const name of priceEnvNames) {
    if (!env[name]?.trim()) {
      missing.push(name);
    }
  }

  if (!appOrigin) {
    missing.push("APP_URL");
  }

  console.log("Stripe go-live check");
  console.log(`- APP_URL: ${appOrigin ?? "invalido ou ausente"}`);
  console.log(`- Secret mode: ${inferSecretMode(secretKey)}`);
  console.log(`- Webhook secret: ${boolLabel(Boolean(env.STRIPE_WEBHOOK_SECRET?.trim()))}`);
  console.log(`- Preço ativo: ${priceEnvNames.every((name) => Boolean(env[name]?.trim())) ? "ok" : "faltando"}`);

  if (missing.length > 0) {
    console.log(`- Missing envs: ${missing.join(", ")}`);
  }

  if (!secretKey) {
    process.exitCode = 1;
    return;
  }

  const stripe = new Stripe(secretKey);
  const priceModes = new Set();
  let hasPriceErrors = false;

  for (const name of priceEnvNames) {
    const priceId = env[name];

    if (!priceId) {
      continue;
    }

    try {
      const price = await stripe.prices.retrieve(priceId);
      priceModes.add(price.livemode ? "live" : "test");
      console.log(
        `- ${name}: ok (${price.livemode ? "live" : "test"} ${price.currency} ${price.recurring?.interval ?? "none"} ${price.unit_amount ?? "n/a"})`,
      );
    } catch (error) {
      hasPriceErrors = true;
      console.log(`- ${name}: erro (${error instanceof Error ? error.message : String(error)})`);
    }
  }

  let portalConfigured = false;
  let activePortalConfigCount = 0;
  try {
    const portalConfigs = await stripe.billingPortal.configurations.list({ limit: 20 });
    const activeConfigs = portalConfigs.data.filter((config) => config.active);
    activePortalConfigCount = activeConfigs.length;
    portalConfigured = Boolean(
      expectedPortalReturnUrl &&
        activeConfigs.some((config) => config.default_return_url === expectedPortalReturnUrl),
    );
    console.log(
      `- Customer Portal: ${portalConfigured ? "ok" : "nao configurado"} (${activePortalConfigCount} config(s) ativa(s))`,
    );
  } catch (error) {
    console.log(`- Customer Portal: erro (${error instanceof Error ? error.message : String(error)})`);
  }

  let webhookConfigured = false;
  try {
    const endpoints = await stripe.webhookEndpoints.list({ limit: 20 });
    const matchingEndpoint = endpoints.data.find((endpoint) =>
      endpoint.url === expectedWebhookUrl &&
      endpoint.status === "enabled" &&
      (endpoint.enabled_events.includes("*") ||
        REQUIRED_WEBHOOK_EVENTS.every((eventType) =>
          endpoint.enabled_events.includes(eventType),
        ))
    );
    webhookConfigured = Boolean(expectedWebhookUrl && matchingEndpoint);
    console.log(
      `- Webhook: ${webhookConfigured ? "ok" : "nao configurado"} (${expectedWebhookUrl ?? "sem APP_URL"})`,
    );

    if (!webhookConfigured && expectedWebhookUrl) {
      const endpointWithMissingEvents = endpoints.data.find((endpoint) =>
        endpoint.url === expectedWebhookUrl && endpoint.status === "enabled"
      );

      if (endpointWithMissingEvents) {
        console.log(`- Webhook eventos: faltando (${REQUIRED_WEBHOOK_EVENTS.join(", ")})`);
      }
    }
  } catch (error) {
    console.log(`- Webhook: erro (${error instanceof Error ? error.message : String(error)})`);
  }

  const secretMode = inferSecretMode(secretKey);
  const priceMode = priceModes.size === 1 ? [...priceModes][0] : priceModes.size > 1 ? "mixed" : "unknown";

  const ready =
    missing.length === 0 &&
    !hasPriceErrors &&
    secretMode === "live" &&
    priceMode === "live" &&
    portalConfigured &&
    webhookConfigured;

  console.log(`- Resultado final: ${ready ? "PRONTO_PARA_VENDA" : "AINDA_NAO_PRONTO"}`);

  if (!ready) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
