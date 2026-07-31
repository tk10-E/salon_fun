import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

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
      (value.startsWith('"') && value.endsWith('"')) ||
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

function inferStripeMode(secretKey) {
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

function metricStatus(value) {
  return value > 0 ? "ok" : "ajustar";
}

function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return String(error);
  }
}

const LEGACY_STORY_TITLE_PATTERN = /^\[story\|(\d{1,2})h\]\s*/i;
const STORY_DURATION_OPTIONS = new Set([12, 24, 48]);

function normalizeStoryDurationHours(value) {
  return STORY_DURATION_OPTIONS.has(value) ? value : 24;
}

function classifyStoryRecord(record) {
  const postType = String(record.post_type ?? "")
    .trim()
    .toLowerCase();
  if (postType === "story") {
    const expiresAt = String(record.expires_at ?? "").trim();
    const parsedExpiresAt = Date.parse(expiresAt);
    return {
      isActive: !Number.isNaN(parsedExpiresAt) && parsedExpiresAt > Date.now(),
      isStory: true,
    };
  }

  const title = String(record.title ?? "").trim();
  const match = title.match(LEGACY_STORY_TITLE_PATTERN);
  if (!match) {
    return {
      isActive: false,
      isStory: false,
    };
  }

  const durationHours = normalizeStoryDurationHours(
    Number.parseInt(match[1] ?? "24", 10),
  );
  const createdAt = String(record.created_at ?? "").trim();
  const parsedCreatedAt = Date.parse(createdAt);
  const isActive =
    !Number.isNaN(parsedCreatedAt) &&
    parsedCreatedAt + durationHours * 60 * 60 * 1000 > Date.now();

  return {
    isActive,
    isStory: true,
  };
}

function isMissingFeedStorySchema(error) {
  const normalized = [
    error instanceof Error ? error.message : "",
    typeof error?.message === "string" ? error.message : "",
    typeof error?.details === "string" ? error.details : "",
    typeof error?.hint === "string" ? error.hint : "",
    String(error ?? ""),
  ]
    .join(" ")
    .trim()
    .toLowerCase();

  return (
    (normalized.includes("expires_at") &&
      normalized.includes("salon_posts") &&
      (normalized.includes("does not exist") ||
        normalized.includes("schema cache"))) ||
    (normalized.includes("salon_posts_post_type_check") &&
      normalized.includes("story"))
  );
}

async function loadFeedRowsForReadiness(supabase) {
  const primary = await supabase
    .from("salon_posts")
    .select("id,title,post_type,created_at,expires_at");

  if (!primary.error || !isMissingFeedStorySchema(primary.error)) {
    return primary;
  }

  return supabase.from("salon_posts").select("id,title,post_type,created_at");
}

async function countRows(label, queryBuilder) {
  const { count, error } = await queryBuilder;

  if (error) {
    console.error(`- Falha em ${label}: ${formatError(error)}`);
    throw error;
  }

  return count ?? 0;
}

async function main() {
  const env = readEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY para validar a operação.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const salonsCount = await countRows(
    "salons",
    supabase.from("salons").select("*", { count: "exact", head: true }),
  );
  const servicesCount = await countRows(
    "services",
    supabase.from("services").select("*", { count: "exact", head: true }),
  );
  const activeStaffCount = await countRows(
    "staff_members",
    supabase
      .from("staff_members")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
  );
  const customersCount = await countRows(
    "customers",
    supabase.from("customers").select("*", { count: "exact", head: true }),
  );
  const recentAppointmentsCount = await countRows(
    "appointments_recent",
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .gte("date", thirtyDaysAgo),
  );
  const completedAppointmentsCount = await countRows(
    "appointments_completed_recent",
    supabase
      .from("appointments")
      .select("*", { count: "exact", head: true })
      .eq("status", "completed")
      .gte("date", thirtyDaysAgo),
  );
  const offersCount = await countRows(
    "salon_offers",
    supabase.from("salon_offers").select("*", { count: "exact", head: true }),
  );
  const postsResult = await loadFeedRowsForReadiness(supabase);
  if (postsResult.error) {
    console.error(`- Falha em salon_posts: ${formatError(postsResult.error)}`);
    throw postsResult.error;
  }
  const postsSnapshot = (postsResult.data ?? []).reduce(
    (accumulator, post) => {
      const storyState = classifyStoryRecord(post);
      if (storyState.isStory) {
        if (storyState.isActive) {
          accumulator.activeStoriesCount += 1;
        }
      } else {
        accumulator.postsCount += 1;
      }
      return accumulator;
    },
    { activeStoriesCount: 0, postsCount: 0 },
  );
  const postsCount = postsSnapshot.postsCount;
  const activeStoriesCount = postsSnapshot.activeStoriesCount;
  const activePushTokensCount = await countRows(
    "customer_push_tokens",
    supabase
      .from("customer_push_tokens")
      .select("*", { count: "exact", head: true })
      .eq("is_active", true),
  );
  const recentNotificationsCount = await countRows(
    "salon_customer_notifications",
    supabase
      .from("salon_customer_notifications")
      .select("*", { count: "exact", head: true })
      .gte("created_at", thirtyDaysAgo),
  );
  const subscriptionRows = await supabase
    .from("salon_subscriptions")
    .select("status");

  if (subscriptionRows.error) {
    console.error(
      `- Falha em salon_subscriptions: ${formatError(subscriptionRows.error)}`,
    );
    throw subscriptionRows.error;
  }

  const subscriptionStatusSummary = (subscriptionRows.data ?? []).reduce(
    (accumulator, row) => {
      const status = row.status ?? "unknown";
      accumulator[status] = (accumulator[status] ?? 0) + 1;
      return accumulator;
    },
    {},
  );

  const hasPilotCore =
    servicesCount > 0 &&
    activeStaffCount > 0 &&
    customersCount > 0 &&
    recentAppointmentsCount > 0 &&
    activePushTokensCount > 0;

  const stripeMode = inferStripeMode(env.STRIPE_SECRET_KEY?.trim());
  const hasCommercialBilling = stripeMode === "live";

  const pilotResult = hasPilotCore
    ? "PRONTO_PARA_PILOTO"
    : "PRECISA_AJUSTAR_PILOTO";
  const salesResult =
    hasPilotCore && hasCommercialBilling
      ? "PRONTO_PARA_VENDA_ABERTA"
      : "OPERACAO_CONTROLADA";

  console.log("Saude operacional do sistema");
  console.log(
    `- Saloes cadastrados: ${salonsCount} (${metricStatus(salonsCount)})`,
  );
  console.log(
    `- Servicos ativos: ${servicesCount} (${metricStatus(servicesCount)})`,
  );
  console.log(
    `- Profissionais ativos: ${activeStaffCount} (${metricStatus(activeStaffCount)})`,
  );
  console.log(
    `- Clientes na base: ${customersCount} (${metricStatus(customersCount)})`,
  );
  console.log(
    `- Agendamentos nos ultimos 30 dias: ${recentAppointmentsCount} (${metricStatus(recentAppointmentsCount)})`,
  );
  console.log(
    `- Agendamentos concluidos nos ultimos 30 dias: ${completedAppointmentsCount} (${metricStatus(completedAppointmentsCount)})`,
  );
  console.log(
    `- Ofertas comerciais: ${offersCount} (${metricStatus(offersCount)})`,
  );
  console.log(
    `- Posts/feed publicados: ${postsCount} (${metricStatus(postsCount)})`,
  );
  console.log(
    `- Stories ativos: ${activeStoriesCount} (${metricStatus(activeStoriesCount)})`,
  );
  console.log(
    `- Push tokens ativos: ${activePushTokensCount} (${metricStatus(activePushTokensCount)})`,
  );
  console.log(
    `- Notificacoes recentes: ${recentNotificationsCount} (${metricStatus(recentNotificationsCount)})`,
  );
  console.log(`- Billing mode: ${stripeMode}`);
  console.log(
    `- Assinaturas por status: ${JSON.stringify(subscriptionStatusSummary)}`,
  );
  console.log(`- Resultado piloto: ${pilotResult}`);
  console.log(`- Resultado comercial: ${salesResult}`);

  if (!hasPilotCore) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
