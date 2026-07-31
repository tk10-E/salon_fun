import fs from "node:fs";
import path from "node:path";

import { createClient } from "@supabase/supabase-js";

const EVENT_TYPE = "finance.pending_settlement_ignored";

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

function assertValue(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function parseArgs(argv) {
  const args = {
    completedBefore: new Date().toISOString(),
    requestPath: "/scripts/baseline-legacy-pending-settlements",
    salonId: null,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--salon" && argv[index + 1]) {
      args.salonId = argv[index + 1];
      index += 1;
      continue;
    }
    if (item === "--completed-before" && argv[index + 1]) {
      args.completedBefore = argv[index + 1];
      index += 1;
      continue;
    }
  }

  return args;
}

async function main() {
  const env = readEnv();
  const args = parseArgs(process.argv.slice(2));
  const supabase = createClient(
    assertValue(env.NEXT_PUBLIC_SUPABASE_URL?.trim(), "Missing Supabase URL."),
    assertValue(
      env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      "Missing service role key.",
    ),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );

  let appointmentsQuery = supabase
    .from("appointments")
    .select(
      "id, salon_id, customer_id, date, completed_at, service_price_snapshot, services(price)",
    )
    .eq("status", "completed")
    .not("completed_at", "is", null)
    .lt("completed_at", args.completedBefore)
    .order("completed_at", { ascending: false });

  if (args.salonId?.trim()) {
    appointmentsQuery = appointmentsQuery.eq("salon_id", args.salonId.trim());
  }

  const appointmentsResult = await appointmentsQuery;
  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  const appointments = appointmentsResult.data ?? [];
  const appointmentIds = appointments.map((item) => item.id);

  if (!appointmentIds.length) {
    console.log(
      JSON.stringify(
        { ok: true, created: 0, ignoredAlready: 0, candidates: 0 },
        null,
        2,
      ),
    );
    return;
  }

  const [paymentsResult, redemptionsResult, ignoredResult] = await Promise.all([
    supabase
      .from("appointment_payments")
      .select("appointment_id")
      .in("appointment_id", appointmentIds),
    supabase
      .from("customer_membership_redemptions")
      .select("appointment_id")
      .in("appointment_id", appointmentIds),
    supabase
      .from("security_audit_logs")
      .select("target_id")
      .eq("event_type", EVENT_TYPE)
      .eq("target_type", "appointment")
      .in("target_id", appointmentIds),
  ]);

  if (paymentsResult.error) {
    throw paymentsResult.error;
  }
  if (redemptionsResult.error) {
    throw redemptionsResult.error;
  }
  if (ignoredResult.error) {
    throw ignoredResult.error;
  }

  const paidIds = new Set(
    (paymentsResult.data ?? []).map((item) => item.appointment_id),
  );
  const planIds = new Set(
    (redemptionsResult.data ?? []).map((item) => item.appointment_id),
  );
  const ignoredIds = new Set(
    (ignoredResult.data ?? []).map((item) => item.target_id),
  );

  const pendingCandidates = appointments.filter((appointment) => {
    return !paidIds.has(appointment.id) && !planIds.has(appointment.id);
  });
  const missingCandidates = pendingCandidates.filter((appointment) => {
    return !ignoredIds.has(appointment.id);
  });

  if (!missingCandidates.length) {
    console.log(
      JSON.stringify(
        {
          ok: true,
          created: 0,
          ignoredAlready: pendingCandidates.length,
          candidates: pendingCandidates.length,
        },
        null,
        2,
      ),
    );
    return;
  }

  const createdAt = new Date().toISOString();
  const payload = missingCandidates.map((appointment) => {
    return {
      actor_user_id: null,
      created_at: createdAt,
      event_type: EVENT_TYPE,
      metadata: {
        appointmentId: appointment.id,
        baselineAt: createdAt,
        baselineReason: "legacy_financial_go_live",
        completedAt: appointment.completed_at,
        originalDate: appointment.date,
        source: "codex_baseline_2026_05_12",
      },
      request_path: args.requestPath,
      salon_id: appointment.salon_id,
      severity: "info",
      target_id: appointment.id,
      target_type: "appointment",
      user_agent: null,
    };
  });

  const insertResult = await supabase.from("security_audit_logs").insert(payload);
  if (insertResult.error) {
    throw insertResult.error;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        created: missingCandidates.length,
        ignoredAlready: pendingCandidates.length - missingCandidates.length,
        candidates: pendingCandidates.length,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
