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

async function countRows(queryBuilder) {
  const { count, error } = await queryBuilder;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function loadSalonWhatsAppRows(supabase) {
  const { data, error } = await supabase
    .from("salons")
    .select(
      "id, whatsapp_phone, whatsapp_dispatch_enabled, whatsapp_meta_phone_number_id",
    );

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function readMetaPhoneRuntime(env) {
  const token = env.META_PERMANENT_TOKEN?.trim();
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID?.trim();

  if (!token || !phoneNumberId) {
    return null;
  }

  const response = await fetch(
    `https://graph.facebook.com/v18.0/${phoneNumberId}?fields=id,verified_name,display_phone_number,quality_rating,name_status,code_verification_status,platform_type,status`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  );

  if (!response.ok) {
    return {
      ok: false,
      detail: await response.text(),
    };
  }

  const data = await response.json();
  return {
    ok: true,
    displayPhoneNumber: data.display_phone_number ?? null,
    verifiedName: data.verified_name ?? null,
    codeVerificationStatus: data.code_verification_status ?? null,
    status: data.status ?? null,
  };
}

async function main() {
  const env = readEnv();
  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    console.error("Faltam NEXT_PUBLIC_SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY para validar o WhatsApp.");
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [salonRows, pendingNotifications, recentInboundMessages] =
    await Promise.all([
      loadSalonWhatsAppRows(supabase),
      countRows(
      supabase
        .from("salon_customer_notifications")
        .select("*", { count: "exact", head: true })
        .not("customer_id", "is", null)
        .is("whatsapp_sent_at", null),
    ),
      countRows(
      supabase
        .from("whatsapp_inbound_messages")
        .select("*", { count: "exact", head: true })
        .gte(
          "created_at",
          new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
        ),
    ),
    ]);

  const salonsWithPublicPhone = salonRows.filter((row) =>
    Boolean(row.whatsapp_phone?.trim()),
  ).length;
  const salonsWithDispatchEnabled = salonRows.filter(
    (row) => row.whatsapp_dispatch_enabled === true,
  ).length;
  const salonsWithDedicatedMetaPhoneId = salonRows.filter((row) =>
    Boolean(row.whatsapp_meta_phone_number_id?.trim()),
  ).length;

  const hasFallbackRuntime =
    Boolean(env.META_PERMANENT_TOKEN?.trim()) &&
    Boolean(env.WHATSAPP_PHONE_NUMBER_ID?.trim()) &&
    Boolean(env.WHATSAPP_VERIFY_TOKEN?.trim());
  const hasDispatchSecret = Boolean(
    env.WHATSAPP_DISPATCH_SECRET?.trim() || env.CRON_SECRET?.trim(),
  );
  const metaPhoneRuntime = await readMetaPhoneRuntime(env);
  const runtimePhoneReady =
    metaPhoneRuntime?.ok === true &&
    metaPhoneRuntime.status &&
    metaPhoneRuntime.status !== "PENDING" &&
    metaPhoneRuntime.codeVerificationStatus === "VERIFIED";

  const productionReady =
    hasFallbackRuntime &&
    hasDispatchSecret &&
    runtimePhoneReady &&
    salonsWithDispatchEnabled > 0;

  console.log("Prontidao do WhatsApp");
  console.log(`- Runtime fallback configurado: ${hasFallbackRuntime ? "sim" : "nao"}`);
  console.log(`- Segredo do dispatcher/cron: ${hasDispatchSecret ? "sim" : "nao"}`);
  if (metaPhoneRuntime?.ok === true) {
    console.log(
      `- Numero tecnico Meta: ${metaPhoneRuntime.displayPhoneNumber ?? "sem numero"} • status ${metaPhoneRuntime.status ?? "desconhecido"} • verificacao ${metaPhoneRuntime.codeVerificationStatus ?? "desconhecida"}`,
    );
  } else if (metaPhoneRuntime?.ok === false) {
    console.log(`- Numero tecnico Meta: erro ao consultar (${metaPhoneRuntime.detail})`);
  } else {
    console.log("- Numero tecnico Meta: nao consultado");
  }
  console.log(`- Saloes com WhatsApp publico: ${salonsWithPublicPhone}`);
  console.log(`- Saloes com dispatch habilitado: ${salonsWithDispatchEnabled}`);
  console.log(
    `- Saloes com numero proprio da Meta: ${salonsWithDedicatedMetaPhoneId}`,
  );
  console.log(`- Notificacoes pendentes de envio: ${pendingNotifications}`);
  console.log(`- Mensagens inbound nos ultimos 30 dias: ${recentInboundMessages}`);
  console.log(
    `- Resultado: ${
      productionReady ? "PRONTO_PARA_OPERACAO_FORMAL" : "PRECISA_AJUSTES_OPERACIONAIS"
    }`,
  );

  if (!productionReady) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(formatError(error));
  process.exitCode = 1;
});
