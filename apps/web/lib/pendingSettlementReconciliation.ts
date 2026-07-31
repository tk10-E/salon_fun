import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient> | any;

export const PENDING_SETTLEMENT_IGNORED_EVENT_TYPE =
  "finance.pending_settlement_ignored";

function resolveAdminClient(input?: AdminClient | null) {
  if (input) {
    return input;
  }

  try {
    return createAdminClient() as any;
  } catch {
    return null;
  }
}

function normalizeAppointmentIds(value: Array<string | null | undefined>) {
  const deduped = new Set<string>();

  for (const item of value) {
    const normalized = item?.trim();
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

export async function listIgnoredPendingSettlementAppointmentIds(args: {
  admin?: AdminClient | null;
  appointmentIds: Array<string | null | undefined>;
  salonId?: string | null;
}) {
  const admin = resolveAdminClient(args.admin);
  const appointmentIds = normalizeAppointmentIds(args.appointmentIds);

  if (!admin || !appointmentIds.length) {
    return new Set<string>();
  }

  let query = admin
    .from("security_audit_logs")
    .select("target_id")
    .eq("event_type", PENDING_SETTLEMENT_IGNORED_EVENT_TYPE)
    .eq("target_type", "appointment")
    .in("target_id", appointmentIds);

  if (args.salonId?.trim()) {
    query = query.eq("salon_id", args.salonId.trim());
  }

  const result = await query;
  if (result.error) {
    throw result.error;
  }

  return new Set<string>(
    ((result.data ?? []) as Array<{ target_id: string | null }>).flatMap(
      (item) => {
        const targetId = item.target_id?.trim();
        return targetId ? [targetId] : [];
      },
    ),
  );
}

export async function recordIgnoredPendingSettlementAppointments(args: {
  actorUserId?: string | null;
  admin?: AdminClient | null;
  appointmentIds: Array<string | null | undefined>;
  metadata?: Record<string, unknown>;
  requestPath?: string | null;
  salonId: string;
}) {
  const admin = resolveAdminClient(args.admin);
  const appointmentIds = normalizeAppointmentIds(args.appointmentIds);

  if (!admin || !appointmentIds.length) {
    return 0;
  }

  const existing = await listIgnoredPendingSettlementAppointmentIds({
    admin,
    appointmentIds,
    salonId: args.salonId,
  });
  const missingIds = appointmentIds.filter((appointmentId) => {
    return !existing.has(appointmentId);
  });

  if (!missingIds.length) {
    return 0;
  }

  const createdAt = new Date().toISOString();
  const payload = missingIds.map((appointmentId) => ({
    actor_user_id: args.actorUserId ?? null,
    created_at: createdAt,
    event_type: PENDING_SETTLEMENT_IGNORED_EVENT_TYPE,
    metadata: {
      appointmentId,
      createdAt,
      source: "legacy_financial_baseline",
      ...(args.metadata ?? {}),
    },
    request_path: args.requestPath ?? null,
    salon_id: args.salonId,
    severity: "info",
    target_id: appointmentId,
    target_type: "appointment",
    user_agent: null,
  }));

  const insertResult = await admin.from("security_audit_logs").insert(payload);
  if (insertResult.error) {
    throw insertResult.error;
  }

  return missingIds.length;
}
