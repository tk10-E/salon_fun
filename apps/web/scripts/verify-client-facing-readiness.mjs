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

function isStoryRecord(record) {
  const postType = String(record.post_type ?? "")
    .trim()
    .toLowerCase();
  if (postType === "story") {
    return true;
  }

  const title = String(record.title ?? "").trim();
  const match = title.match(LEGACY_STORY_TITLE_PATTERN);
  return Boolean(match);
}

async function countRows(queryBuilder) {
  const { count, error } = await queryBuilder;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

function classifySalon(snapshot) {
  const hasAnyClientContent =
    snapshot.services > 0 ||
    snapshot.offers > 0 ||
    snapshot.posts > 0 ||
    snapshot.customers > 0;

  if (!hasAnyClientContent) {
    return {
      status: "SEM_CONTEUDO_CLIENTE",
      notes: ["Sem catálogo, campanhas, feed e base de clientes no momento."],
    };
  }

  const hasCoreShowcase =
    snapshot.services > 0 && snapshot.offers > 0 && snapshot.posts > 0;
  const notes = [];

  if (snapshot.services === 0) {
    notes.push(
      "Publique pelo menos um serviço para a agenda e o catálogo fazerem sentido no app.",
    );
  }

  if (snapshot.offers === 0) {
    notes.push(
      "Ative pelo menos uma oferta ou membership para dar argumento comercial ao cliente.",
    );
  }

  if (snapshot.posts === 0) {
    notes.push(
      "Publique pelo menos um post no feed para reforçar prova visual e identidade.",
    );
  }

  if (snapshot.customers > 0 && snapshot.push === 0) {
    notes.push("Há clientes na base, mas nenhum device ativo para push.");
  }

  if (
    snapshot.customers > 0 &&
    snapshot.offers > 0 &&
    snapshot.notifications === 0
  ) {
    notes.push("Há oferta ativa sem notificação registrada para o cliente.");
  }

  if (notes.length > 0) {
    return {
      status: "AJUSTAR_EXPERIENCIA_CLIENTE",
      notes,
    };
  }

  if (hasCoreShowcase && snapshot.customers === 0) {
    return {
      status: "PRONTO_PARA_CAPTACAO",
      notes: [
        "Catálogo, oferta e feed estão prontos para atrair a primeira cliente pelo app e pela vitrine pública.",
      ],
    };
  }

  return {
    status: "PRONTO_PARA_CLIENTE",
    notes: [
      "Catálogo, conteúdo e comunicação estão coerentes para uso no app cliente.",
    ],
  };
}

async function main() {
  const env = readEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY para validar a jornada cliente.",
    );
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: salons, error: salonsError } = await supabase
    .from("salons")
    .select("id, name, join_code, business_segment")
    .order("created_at");

  if (salonsError) {
    throw salonsError;
  }

  console.log("Prontidao cliente-facing por salao");

  let hasActionableGap = false;

  for (const salon of salons ?? []) {
    const [services, offers, postsResult, customers, push, notifications] =
      await Promise.all([
        countRows(
          supabase
            .from("services")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id),
        ),
        countRows(
          supabase
            .from("salon_offers")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id)
            .eq("is_active", true),
        ),
        supabase
          .from("salon_posts")
          .select("id,title,post_type,created_at")
          .eq("salon_id", salon.id),
        countRows(
          supabase
            .from("customers")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id),
        ),
        countRows(
          supabase
            .from("customer_push_tokens")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id)
            .eq("is_active", true),
        ),
        countRows(
          supabase
            .from("salon_customer_notifications")
            .select("*", { count: "exact", head: true })
            .eq("salon_id", salon.id),
        ),
      ]);

    if (postsResult.error) {
      throw postsResult.error;
    }

    const postsCount = (postsResult.data ?? []).filter(
      (post) => !isStoryRecord(post),
    ).length;

    const snapshot = {
      services,
      offers,
      posts: postsCount,
      customers,
      push,
      notifications,
    };

    const result = classifySalon(snapshot);
    if (result.status === "AJUSTAR_EXPERIENCIA_CLIENTE") {
      hasActionableGap = true;
    }

    console.log(
      `- ${salon.name} (${salon.join_code}) [${salon.business_segment}]: ${result.status}`,
    );
    console.log(
      `  servicos=${services}, ofertas=${offers}, posts=${postsCount}, clientes=${customers}, push=${push}, notificacoes=${notifications}`,
    );
    for (const note of result.notes) {
      console.log(`  -> ${note}`);
    }
  }

  if (hasActionableGap) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
