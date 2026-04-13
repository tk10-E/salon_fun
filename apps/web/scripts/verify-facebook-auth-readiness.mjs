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

function normalizeUrl(value) {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }

  try {
    return new URL(value.trim()).toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

async function main() {
  const env = readEnv();
  const supabaseUrl = normalizeUrl(env.NEXT_PUBLIC_SUPABASE_URL);
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() || null;
  const appUrl = normalizeUrl(env.APP_URL);
  const metaAppId = env.META_APP_ID?.trim() || null;
  const metaAppSecret = env.META_APP_SECRET?.trim() || null;

  if (!supabaseUrl || !publishableKey || !appUrl) {
    console.error(
      "Faltam NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ou APP_URL para validar o login com Facebook.",
    );
    process.exitCode = 1;
    return;
  }

  const panelCallbackUrl = `${appUrl}/auth/callback?next=%2Fdashboard`;
  const supabaseProviderCallbackUrl = `${supabaseUrl}/auth/v1/callback`;
  const supabase = createClient(supabaseUrl, publishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "facebook",
    options: {
      redirectTo: panelCallbackUrl,
    },
  });

  const authorizeUrl = data?.url?.trim() || null;
  const authorizeReady =
    !error &&
    typeof authorizeUrl === "string" &&
    authorizeUrl.includes("/auth/v1/authorize?provider=facebook");

  console.log("Prontidão do login Facebook");
  console.log(`- Meta App ID presente: ${metaAppId ? "sim" : "nao"}`);
  console.log(`- Meta App Secret presente: ${metaAppSecret ? "sim" : "nao"}`);
  console.log(`- URL do painel: ${appUrl}`);
  console.log(`- Callback do painel: ${panelCallbackUrl}`);
  console.log(`- Callback para cadastrar na Meta/Supabase: ${supabaseProviderCallbackUrl}`);
  console.log(`- URL de OAuth do Supabase gerada: ${authorizeReady ? "sim" : "nao"}`);

  if (error) {
    console.log(`- Erro do Supabase ao preparar OAuth: ${error.message}`);
  } else if (authorizeUrl) {
    console.log(`- Authorize URL: ${authorizeUrl}`);
  }

  console.log("Checklist externo");
  console.log("- No Supabase Dashboard > Authentication > Providers, habilite Facebook.");
  console.log("- No Facebook Login da Meta app, adicione exatamente o callback do Supabase acima.");
  console.log("- Em Authentication > URL Configuration do Supabase, mantenha APP_URL e /auth/callback autorizados.");

  const readyForConfiguration =
    Boolean(metaAppId) &&
    Boolean(metaAppSecret) &&
    authorizeReady;

  console.log(
    `- Resultado: ${
      readyForConfiguration
        ? "PRONTO_PARA_CONFIGURAR_NO_DASHBOARD"
        : "FALTAM_DADOS_PARA_CONFIGURAR"
    }`,
  );

  if (!readyForConfiguration) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
