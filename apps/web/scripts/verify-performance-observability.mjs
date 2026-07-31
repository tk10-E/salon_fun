import fs from "node:fs";
import path from "node:path";

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

function normalizeBaseUrl(value) {
  const normalized = String(value ?? "").trim();
  if (!normalized) {
    return "";
  }
  return normalized.endsWith("/")
    ? normalized.slice(0, normalized.length - 1)
    : normalized;
}

async function parseJsonSafe(response) {
  const text = await response.text();
  if (!text) {
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function buildSampleEvent() {
  return {
    cacheStatus: "network_miss",
    durationMs: 1234,
    operation: "verify.performance.observability",
    outcome: "ok",
    platform: "verify-script",
    route: "/health/performance",
    source: "mobile",
    surface: "verify",
  };
}

async function verifyLogin(baseUrl) {
  const response = await fetch(`${baseUrl}/login`, {
    headers: {
      Accept: "text/html",
      "Cache-Control": "no-cache",
    },
  });

  if (response.status !== 200) {
    throw new Error(`login health check failed with status ${response.status}`);
  }

  const cacheHeader = response.headers.get("x-vercel-cache");
  console.log(`- /login status: ${response.status}`);
  if (cacheHeader) {
    console.log(`- /login x-vercel-cache: ${cacheHeader}`);
  }
}

async function verifyPerformanceEndpoint(baseUrl) {
  const endpoint = `${baseUrl}/api/public/observability/performance`;
  const sampleEvent = buildSampleEvent();

  const validResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(sampleEvent),
  });

  if (validResponse.status !== 204) {
    const payload = await parseJsonSafe(validResponse);
    throw new Error(
      `valid performance event rejected with status ${validResponse.status}: ${JSON.stringify(payload)}`,
    );
  }

  const cacheControl = validResponse.headers.get("cache-control");
  console.log(`- observability endpoint valid event: ${validResponse.status}`);
  if (cacheControl) {
    console.log(`- observability endpoint cache-control: ${cacheControl}`);
  }

  const invalidResponse = await fetch(endpoint, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      source: "mobile",
      surface: "verify",
    }),
  });

  if (invalidResponse.status !== 400) {
    const payload = await parseJsonSafe(invalidResponse);
    throw new Error(
      `invalid performance event should fail with 400, got ${invalidResponse.status}: ${JSON.stringify(payload)}`,
    );
  }

  console.log(`- observability endpoint invalid payload: ${invalidResponse.status}`);
}

async function main() {
  const env = readEnv();
  const baseUrl = normalizeBaseUrl(
    env.APP_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      env.PUBLIC_WEB_BASE_URL ||
      "https://painel.jc7desenvovimento.online",
  );

  if (!baseUrl) {
    throw new Error("Missing APP_URL or NEXT_PUBLIC_APP_URL for verify:perf.");
  }

  console.log("Performance observability verification");
  console.log(`- base url: ${baseUrl}`);

  await verifyLogin(baseUrl);
  await verifyPerformanceEndpoint(baseUrl);

  console.log("- result: OK");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`- result: FAIL (${message})`);
  process.exitCode = 1;
});
