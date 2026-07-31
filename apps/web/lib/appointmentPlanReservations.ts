import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveAuthenticatedCustomerContext } from "@/lib/appointmentReviews";
import { createConfirmedCustomerAppointment } from "@/lib/customerAppointments";

const PLAN_RESERVATION_TARGET_TYPE = "appointment_plan_reservation";
const PLAN_RESERVATION_EVENT_RESERVED = "appointment.plan_reserved";
const PLAN_RESERVATION_EVENT_CANCELLED =
  "appointment.plan_reservation_cancelled";
const PLAN_RESERVATION_EVENT_CONSUMED = "appointment.plan_reservation_consumed";
const PLAN_NEUTRALIZED_CONFIRMATION_LEAD_MINUTES = 5;

type ReservationState = "reserved" | "cancelled" | "consumed";
type AdminClient = ReturnType<typeof createAdminClient> | any;
type CustomerClient = ReturnType<typeof createSupabaseClient<Database>>;
type SalonTimezoneRow = {
  id: string;
  timezone: string | null;
};
type MembershipRow = {
  customer_id: string;
  expires_at: string;
  id: string;
  offer_id: string | null;
  price_snapshot: number | string | null;
  salon_id: string;
  service_id: string | null;
  service_name_snapshot: string | null;
  sessions_included: number | string;
  sessions_used: number | string;
  started_at: string | null;
  status: string | null;
  title: string;
};
type OfficialRedemptionRow = {
  appointment_id: string;
  customer_id: string;
  membership_id: string;
  redeemed_at: string;
  salon_id: string;
  service_id: string | null;
  customer_memberships:
    | {
        expires_at?: string | null;
        id?: string | null;
        service_id?: string | null;
        sessions_included?: number | string | null;
        started_at?: string | null;
        title?: string | null;
      }
    | Array<{
        expires_at?: string | null;
        id?: string | null;
        service_id?: string | null;
        sessions_included?: number | string | null;
        started_at?: string | null;
        title?: string | null;
      }>
    | null;
};
type SecurityAuditReservationRow = {
  created_at: string;
  event_type: string | null;
  metadata: Record<string, unknown> | null;
  salon_id: string | null;
  target_id: string | null;
  target_type: string | null;
};
type ReservationAuditSnapshot = ResolvedAppointmentPlanReservation & {
  createdAt: string;
  reservationState: ReservationState;
};
type ScheduleMembershipPlanAppointmentsArgs = {
  accessToken: string;
  membershipId?: string | null;
  preferredStaffMemberId: string;
  preferredStartAt: string;
  requestPath?: string | null;
  serviceId: string;
  userAgent?: string | null;
};
type CancelMembershipPlanAppointmentArgs = {
  accessToken: string;
  appointmentId: string;
  cancellationReason: string;
  requestPath?: string | null;
};
type ListResolvedAppointmentPlanReservationsArgs = {
  admin?: AdminClient | null;
  appointmentIds?: string[];
  customerId?: string;
  salonId?: string;
};
type ResolveAppointmentPlanReservationArgs = {
  admin?: AdminClient | null;
  appointmentId: string;
  customerId?: string;
  salonId?: string;
};
type FinalizeAppointmentPlanReservationArgs = {
  admin?: AdminClient | null;
  appointmentId: string;
  ownerSupabase: any;
  salonId: string;
};
type NeutralizeMembershipPlanAppointmentArgs = {
  admin?: AdminClient | null;
  appointmentId: string;
};
type CancelAppointmentPlanReservationByAdminArgs = {
  actorUserId?: string | null;
  admin?: AdminClient | null;
  appointmentId: string;
  requestPath?: string | null;
  salonId: string;
  userAgent?: string | null;
};
type TransferAppointmentPlanReservationArgs = {
  actorUserId?: string | null;
  admin?: AdminClient | null;
  nextAppointmentId: string;
  previousAppointmentId: string;
  requestPath?: string | null;
  salonId: string;
  userAgent?: string | null;
};
type AuditReservationEventArgs = {
  actorUserId?: string | null;
  admin: AdminClient;
  appointmentId: string;
  customerId: string;
  membership: MembershipRow;
  requestPath?: string | null;
  reservationState: ReservationState;
  salonId: string;
  serviceId: string;
  sessionIndex: number | null;
  sessionsIncluded: number;
  userAgent?: string | null;
};
type ScheduledAppointmentSummary = {
  appointmentId: string;
  membershipExpiresAt: string | null;
  membershipId: string;
  membershipTitle: string;
  sessionIndex: number | null;
  sessionsIncluded: number;
  startsAt: string;
  status: string;
  staffMemberId: string;
};
type FutureScheduledMembershipAppointment = {
  appointmentId: string;
  customerId: string;
  endsAt: string;
  localDayKey: string;
  localMinutesOfDay: number;
  serviceId: string;
  sessionIndex: number | null;
  staffMemberId: string;
  startsAt: string;
  status: string;
};
type ReconcileLegacyMembershipPlanSeriesArgs = {
  admin?: AdminClient | null;
  dryRun?: boolean;
  membershipId?: string | null;
  notifyPendingFirstSlot?: boolean;
  now?: Date;
  salonId?: string | null;
};
type ReconcileLegacyMembershipPlanSeriesMembershipResult =
  | "already_fixed"
  | "migrated"
  | "pending_first_slot"
  | "skipped";
export type ReconcileLegacyMembershipPlanSeriesReport = {
  alreadyFixedMemberships: number;
  changedAppointments: number;
  inspectedMemberships: number;
  memberships: Array<{
    changedAppointments: number;
    details: string;
    membershipId: string;
    result: ReconcileLegacyMembershipPlanSeriesMembershipResult;
    title: string;
  }>;
  migratedMemberships: number;
  pendingFirstSlotMemberships: number;
  queuedFirstSlotNotifications: number;
  skippedMemberships: number;
};

type ReprocessMembershipPlanSeriesByAdminArgs = {
  actorUserId?: string | null;
  admin?: AdminClient | null;
  appointmentId: string;
  ownerSupabase: any;
  requestPath?: string | null;
  salonId: string;
  userAgent?: string | null;
};

type ScheduleApprovedMembershipRequestSeriesByAdminArgs = {
  actorUserId?: string | null;
  admin?: AdminClient | null;
  membershipId: string;
  ownerSupabase: any;
  preferredStaffMemberId: string;
  preferredStartAt: string;
  requestPath?: string | null;
  salonId: string;
  userAgent?: string | null;
};

export type ResolvedAppointmentPlanReservation = {
  appointmentId: string;
  customerId: string;
  membershipExpiresAt: string | null;
  membershipId: string;
  membershipStartedAt: string | null;
  membershipTitle: string;
  reservationStatus: "scheduled" | "consumed";
  salonId: string;
  serviceId: string;
  sessionIndex: number | null;
  sessionsIncluded: number | null;
  source: "official" | "reservation";
};

export type ScheduledMembershipPlanResult = {
  createdAppointments: ScheduledAppointmentSummary[];
  membershipExpiresAt: string | null;
  membershipId: string;
  membershipTitle: string;
  scheduledCount: number;
  skippedCount: number;
  sessionsIncluded: number;
};

export type ReprocessedMembershipPlanSeriesResult = {
  createdAppointments: ScheduledAppointmentSummary[];
  membershipExpiresAt: string | null;
  membershipId: string;
  membershipTitle: string;
  scheduledCount: number;
  skippedCount: number;
  status: "already_fixed" | "needs_manual_review" | "reprocessed";
  sessionsIncluded: number;
};

type MembershipPlanSeriesSchedulingReport = {
  coveredAppointmentsCount: number;
  createdAppointments: ScheduledAppointmentSummary[];
  desiredAppointmentsCount: number;
  hasReservableMembership: boolean;
};

type QueueMembershipFirstSlotNotificationArgs = {
  admin?: AdminClient | null;
  customerId: string;
  expiresAt?: string | null;
  membershipId: string;
  membershipTitle: string;
  now?: Date;
  salonId: string;
  serviceId?: string | null;
  serviceName?: string | null;
};

const MEMBERSHIP_FIRST_SLOT_NOTIFICATION_TYPE =
  "membership_first_slot_required";
const MEMBERSHIP_FIRST_SLOT_NOTIFICATION_COOLDOWN_MS = 3 * 24 * 60 * 60 * 1000;
const FIXED_MEMBERSHIP_SERIES_RECURRENCE_DAYS = 7;

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readOptionalString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function readJsonRecord(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isRecentEnoughToSkipNotification(createdAt: string | null, now: Date) {
  if (!createdAt) {
    return false;
  }

  const createdAtDate = new Date(createdAt);
  if (Number.isNaN(createdAtDate.getTime())) {
    return false;
  }

  return (
    now.getTime() - createdAtDate.getTime() <
    MEMBERSHIP_FIRST_SLOT_NOTIFICATION_COOLDOWN_MS
  );
}

function readPositiveInteger(value: unknown) {
  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : Number.NaN;

  if (!Number.isFinite(numeric)) {
    return null;
  }

  const normalized = Math.trunc(numeric);
  return normalized > 0 ? normalized : null;
}

function normalizeAppointmentIds(value: string[] | undefined) {
  const deduped = new Set<string>();

  for (const item of value ?? []) {
    const normalized = readString(item);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

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

function createCustomerSessionClient(accessToken: string) {
  return createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatLocalDateKey(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(value);
}

function parseLocalDateKey(dayKey: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function shiftDayKey(dayKey: string, offsetDays: number) {
  const cursor = parseLocalDateKey(dayKey);
  cursor.setUTCDate(cursor.getUTCDate() + offsetDays);
  return `${cursor.getUTCFullYear()}-${String(
    cursor.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(cursor.getUTCDate()).padStart(2, "0")}`;
}

function diffDayKeys(left: string, right: string) {
  const leftDate = parseLocalDateKey(left);
  const rightDate = parseLocalDateKey(right);
  return Math.round(
    (leftDate.getTime() - rightDate.getTime()) / (24 * 60 * 60 * 1000),
  );
}

function getLocalMinutesOfDay(value: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    hour: "2-digit",
    hour12: false,
    minute: "2-digit",
    timeZone,
  }).formatToParts(value);
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? "0",
  );
  return hour * 60 + minute;
}

function countInclusiveDayKeys(startDayKey: string, endDayKey: string) {
  return Math.max(1, diffDayKeys(endDayKey, startDayKey) + 1);
}

function readDayKeyWeekday(dayKey: string) {
  return parseLocalDateKey(dayKey).getUTCDay();
}

function nextRecurringDayKeyForWeekday(args: {
  preferredWeekday: number;
  startDayKey: string;
}) {
  const normalizedWeekday = ((Math.trunc(args.preferredWeekday) % 7) + 7) % 7;

  for (let offset = 0; offset < 7; offset += 1) {
    const candidateDayKey = shiftDayKey(args.startDayKey, offset);
    if (readDayKeyWeekday(candidateDayKey) === normalizedWeekday) {
      return candidateDayKey;
    }
  }

  return args.startDayKey;
}

function calculateMembershipRecurrenceDays(args: {
  membershipEndDayKey: string;
  membershipStartDayKey: string;
  sessionsIncluded: number;
}) {
  const validityDays = countInclusiveDayKeys(
    args.membershipStartDayKey,
    args.membershipEndDayKey,
  );

  if (validityDays <= 1 || args.sessionsIncluded <= 1) {
    return 1;
  }

  return FIXED_MEMBERSHIP_SERIES_RECURRENCE_DAYS;
}

function buildFixedRecurringDayKeys(args: {
  count: number;
  endDayKey: string;
  recurrenceDays: number;
  startDayKey: string;
}) {
  if (args.count <= 0) {
    return [] as string[];
  }

  const recurrenceDays = Math.max(1, args.recurrenceDays);
  const keys: string[] = [];

  for (let index = 0; index < args.count; index += 1) {
    const nextKey = shiftDayKey(args.startDayKey, recurrenceDays * index);

    if (diffDayKeys(nextKey, args.endDayKey) > 0) {
      break;
    }

    keys.push(nextKey);
  }

  return keys;
}

function buildWeeklyRecurringDayKeys(args: {
  count: number;
  endDayKey: string;
  preferredWeekday: number;
  startDayKey: string;
}) {
  const firstRecurringDayKey = nextRecurringDayKeyForWeekday({
    preferredWeekday: args.preferredWeekday,
    startDayKey: args.startDayKey,
  });

  if (diffDayKeys(firstRecurringDayKey, args.endDayKey) > 0) {
    return [] as string[];
  }

  return buildFixedRecurringDayKeys({
    count: args.count,
    endDayKey: args.endDayKey,
    recurrenceDays: FIXED_MEMBERSHIP_SERIES_RECURRENCE_DAYS,
    startDayKey: firstRecurringDayKey,
  });
}

function mapEventTypeToState(eventType: string | null) {
  switch (eventType) {
    case PLAN_RESERVATION_EVENT_RESERVED:
      return "reserved" as const;
    case PLAN_RESERVATION_EVENT_CANCELLED:
      return "cancelled" as const;
    case PLAN_RESERVATION_EVENT_CONSUMED:
      return "consumed" as const;
    default:
      return null;
  }
}

function toAuditReservationSnapshot(
  row: SecurityAuditReservationRow,
): ReservationAuditSnapshot | null {
  if (row.target_type !== PLAN_RESERVATION_TARGET_TYPE) {
    return null;
  }

  const reservationState = mapEventTypeToState(row.event_type);
  const metadata = row.metadata ?? {};
  const appointmentId =
    readString(row.target_id) ?? readString(metadata.appointmentId);
  const customerId = readString(metadata.customerId);
  const salonId = readString(row.salon_id) ?? readString(metadata.salonId);
  const serviceId = readString(metadata.serviceId);
  const membershipId = readString(metadata.membershipId);
  const membershipTitle = readString(metadata.membershipTitle);
  const sessionsIncluded = readPositiveInteger(metadata.sessionsIncluded);

  if (
    !reservationState ||
    !appointmentId ||
    !customerId ||
    !salonId ||
    !serviceId ||
    !membershipId ||
    !membershipTitle
  ) {
    return null;
  }

  return {
    appointmentId,
    createdAt: readString(row.created_at) ?? new Date(0).toISOString(),
    customerId,
    membershipExpiresAt: readOptionalString(metadata.membershipExpiresAt),
    membershipId,
    membershipStartedAt: readOptionalString(metadata.membershipStartedAt),
    membershipTitle,
    reservationState,
    reservationStatus:
      reservationState === "reserved" ? "scheduled" : "consumed",
    salonId,
    serviceId,
    sessionIndex: readPositiveInteger(metadata.sessionIndex),
    sessionsIncluded,
    source: "reservation",
  };
}

function toOfficialResolvedReservation(
  row: OfficialRedemptionRow,
): ResolvedAppointmentPlanReservation | null {
  const membership = firstRelation(row.customer_memberships);
  const appointmentId = readString(row.appointment_id);
  const customerId = readString(row.customer_id);
  const salonId = readString(row.salon_id);
  const serviceId =
    readString(row.service_id) ?? readString(membership?.service_id);
  const membershipId =
    readString(row.membership_id) ?? readString(membership?.id);
  const membershipTitle = readString(membership?.title);

  if (
    !appointmentId ||
    !customerId ||
    !salonId ||
    !serviceId ||
    !membershipId ||
    !membershipTitle
  ) {
    return null;
  }

  return {
    appointmentId,
    customerId,
    membershipExpiresAt: readOptionalString(membership?.expires_at),
    membershipId,
    membershipStartedAt: readOptionalString(membership?.started_at),
    membershipTitle,
    reservationStatus: "consumed",
    salonId,
    serviceId,
    sessionIndex: null,
    sessionsIncluded: readPositiveInteger(membership?.sessions_included),
    source: "official",
  };
}

async function fetchOfficialAppointmentPlanReservations(
  admin: AdminClient,
  args: {
    appointmentIds: string[];
    customerId?: string;
    salonId?: string;
  },
) {
  let query = admin
    .from("customer_membership_redemptions")
    .select(
      "appointment_id, customer_id, membership_id, redeemed_at, salon_id, service_id, customer_memberships(id, title, sessions_included, started_at, expires_at, service_id)",
    )
    .is("reversed_at", null)
    .order("redeemed_at", { ascending: false });

  if (args.appointmentIds.length) {
    query = query.in("appointment_id", args.appointmentIds);
  }

  if (args.customerId) {
    query = query.eq("customer_id", args.customerId);
  }

  if (args.salonId) {
    query = query.eq("salon_id", args.salonId);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  return ((data ?? []) as OfficialRedemptionRow[])
    .map((row) => toOfficialResolvedReservation(row))
    .filter((row): row is ResolvedAppointmentPlanReservation => row !== null);
}

async function fetchAuditAppointmentPlanReservations(
  admin: AdminClient,
  args: {
    appointmentIds: string[];
    customerId?: string;
    salonId?: string;
  },
) {
  let query = admin
    .from("security_audit_logs")
    .select(
      "created_at, event_type, metadata, salon_id, target_id, target_type",
    )
    .eq("target_type", PLAN_RESERVATION_TARGET_TYPE)
    .in("event_type", [
      PLAN_RESERVATION_EVENT_RESERVED,
      PLAN_RESERVATION_EVENT_CANCELLED,
      PLAN_RESERVATION_EVENT_CONSUMED,
    ])
    .order("created_at", { ascending: false });

  if (args.salonId) {
    query = query.eq("salon_id", args.salonId);
  }

  if (args.appointmentIds.length) {
    query = query.in("target_id", args.appointmentIds);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const latestByAppointmentId = new Map<string, ReservationAuditSnapshot>();

  for (const row of (data ?? []) as SecurityAuditReservationRow[]) {
    const snapshot = toAuditReservationSnapshot(row);
    if (!snapshot) {
      continue;
    }

    if (args.customerId && snapshot.customerId !== args.customerId) {
      continue;
    }

    if (!latestByAppointmentId.has(snapshot.appointmentId)) {
      latestByAppointmentId.set(snapshot.appointmentId, snapshot);
    }
  }

  return latestByAppointmentId;
}

async function fetchMembershipById(
  admin: AdminClient,
  membershipId: string,
  salonId: string,
) {
  const { data, error } = await admin
    .from("customer_memberships")
    .select(
      "id, customer_id, expires_at, offer_id, price_snapshot, salon_id, service_id, service_name_snapshot, sessions_included, sessions_used, started_at, status, title",
    )
    .eq("id", membershipId)
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as MembershipRow | null) ?? null;
}

async function fetchSchedulableMembershipSeries(
  admin: AdminClient,
  args: {
    anchorMembership: MembershipRow;
    customerId: string;
    salonId: string;
  },
) {
  const anchorMembership = args.anchorMembership;
  if (!anchorMembership.offer_id || !anchorMembership.service_id) {
    return [anchorMembership] as MembershipRow[];
  }

  const anchorStartedAt =
    readOptionalString(anchorMembership.started_at) ??
    anchorMembership.expires_at;
  const { data, error } = await admin
    .from("customer_memberships")
    .select(
      "id, customer_id, expires_at, offer_id, price_snapshot, salon_id, service_id, service_name_snapshot, sessions_included, sessions_used, started_at, status, title",
    )
    .eq("customer_id", args.customerId)
    .eq("salon_id", args.salonId)
    .eq("offer_id", anchorMembership.offer_id)
    .eq("service_id", anchorMembership.service_id)
    .neq("status", "cancelled")
    .neq("status", "completed")
    .gte("expires_at", anchorStartedAt)
    .order("started_at", { ascending: true })
    .order("expires_at", { ascending: true });

  if (error) {
    throw error;
  }

  const memberships = ((data ?? []) as MembershipRow[]).filter((membership) => {
    const startedAt =
      readOptionalString(membership.started_at) ?? membership.expires_at;
    return diffDayKeys(startedAt, anchorStartedAt) >= 0;
  });
  const anchorIndex = memberships.findIndex(
    (membership) => membership.id === anchorMembership.id,
  );

  if (anchorIndex < 0) {
    return [anchorMembership] as MembershipRow[];
  }

  return memberships.slice(anchorIndex);
}

async function fetchMatchingMembership(
  admin: AdminClient,
  args: {
    customerId: string;
    localDayKey: string;
    salonId: string;
    serviceId: string;
  },
) {
  const { data, error } = await admin
    .from("customer_memberships")
    .select(
      "id, customer_id, expires_at, offer_id, price_snapshot, salon_id, service_id, service_name_snapshot, sessions_included, sessions_used, started_at, status, title",
    )
    .eq("customer_id", args.customerId)
    .eq("salon_id", args.salonId)
    .eq("service_id", args.serviceId)
    .neq("status", "cancelled")
    .order("expires_at", { ascending: true })
    .order("started_at", { ascending: true });

  if (error) {
    throw error;
  }

  const matching = ((data ?? []) as MembershipRow[]).find((membership) =>
    isMembershipActiveOnDay(membership, args.localDayKey),
  );

  return matching ?? null;
}

async function fetchSalonTimezone(admin: AdminClient, salonId: string) {
  const { data, error } = await admin
    .from("salons")
    .select("id, timezone")
    .eq("id", salonId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return (data as SalonTimezoneRow | null) ?? null;
}

async function fetchMembershipScopedAppointments(
  admin: AdminClient,
  args: {
    customerId: string;
    membership: MembershipRow;
    salonId: string;
  },
) {
  const periodStart = args.membership.started_at
    ? new Date(args.membership.started_at)
    : new Date(`${args.membership.expires_at}T00:00:00.000Z`);
  const periodEnd = new Date(args.membership.expires_at);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

  const { data, error } = await admin
    .from("appointments")
    .select("id")
    .eq("customer_id", args.customerId)
    .eq("salon_id", args.salonId)
    .eq("service_id", args.membership.service_id)
    .gte("date", periodStart.toISOString())
    .lt("date", periodEnd.toISOString())
    .order("date", { ascending: true });

  if (error) {
    throw error;
  }

  return ((data ?? []) as Array<{ id: string | null }>)
    .map((row) => readString(row.id))
    .filter((row): row is string => row !== null);
}

function isMembershipActiveOnDay(
  membership: MembershipRow,
  localDayKey: string,
) {
  if (membership.status === "cancelled" || membership.status === "completed") {
    return false;
  }

  const startedAt = readOptionalString(membership.started_at);
  const startDayKey = startedAt
    ? formatLocalDateKey(new Date(startedAt), "UTC")
    : null;
  const endDayKey = formatLocalDateKey(
    new Date(`${membership.expires_at}T12:00:00.000Z`),
    "UTC",
  );

  if (startDayKey && diffDayKeys(localDayKey, startDayKey) < 0) {
    return false;
  }

  return diffDayKeys(localDayKey, endDayKey) <= 0;
}

function getMembershipDayBounds(
  membership: MembershipRow,
  preferredLocalDayKey: string,
  salonTimeZone: string,
) {
  const startedAt = readOptionalString(membership.started_at);
  const membershipStartDayKey = startedAt
    ? formatLocalDateKey(new Date(startedAt), salonTimeZone)
    : preferredLocalDayKey;
  const membershipEndDayKey = formatLocalDateKey(
    new Date(`${membership.expires_at}T12:00:00.000Z`),
    salonTimeZone,
  );

  return {
    endDayKey: membershipEndDayKey,
    membershipStartDayKey,
    startDayKey:
      diffDayKeys(preferredLocalDayKey, membershipStartDayKey) >= 0
        ? preferredLocalDayKey
        : membershipStartDayKey,
  };
}

function resolveRequestedMembershipSeriesStartDayKey(args: {
  membership: MembershipRow;
  requestedLocalDayKey: string;
  salonTimeZone: string;
}) {
  const { endDayKey, membershipStartDayKey } = getMembershipDayBounds(
    args.membership,
    args.requestedLocalDayKey,
    args.salonTimeZone,
  );

  const requestedWeekday = readDayKeyWeekday(args.requestedLocalDayKey);
  const resolvedDayKey =
    diffDayKeys(args.requestedLocalDayKey, membershipStartDayKey) >= 0
      ? args.requestedLocalDayKey
      : nextRecurringDayKeyForWeekday({
          preferredWeekday: requestedWeekday,
          startDayKey: membershipStartDayKey,
        });

  if (diffDayKeys(resolvedDayKey, endDayKey) > 0) {
    return null;
  }

  return resolvedDayKey;
}

function buildAvailableSessionIndices(
  membership: MembershipRow,
  reservations: ResolvedAppointmentPlanReservation[],
  desiredCount: number,
) {
  const sessionsIncluded =
    readPositiveInteger(membership.sessions_included) ?? 0;
  const sessionsUsed = readPositiveInteger(membership.sessions_used) ?? 0;
  const occupiedIndices = new Set<number>();

  for (const reservation of reservations) {
    if (reservation.membershipId !== membership.id) {
      continue;
    }

    if (
      reservation.sessionIndex &&
      reservation.sessionIndex >= 1 &&
      reservation.sessionIndex <= sessionsIncluded
    ) {
      occupiedIndices.add(reservation.sessionIndex);
    }
  }

  for (
    let fallbackIndex = 1;
    fallbackIndex <= sessionsIncluded && occupiedIndices.size < sessionsUsed;
    fallbackIndex += 1
  ) {
    occupiedIndices.add(fallbackIndex);
  }

  const available: number[] = [];
  for (
    let sessionIndex = 1;
    sessionIndex <= sessionsIncluded;
    sessionIndex += 1
  ) {
    if (occupiedIndices.has(sessionIndex)) {
      continue;
    }

    available.push(sessionIndex);

    if (available.length >= desiredCount) {
      break;
    }
  }

  return available;
}

async function listMembershipReservationsForScheduling(
  admin: AdminClient,
  args: {
    customerId: string;
    membership: MembershipRow;
    salonId: string;
  },
) {
  const appointmentIds = await fetchMembershipScopedAppointments(admin, args);
  if (!appointmentIds.length) {
    return [] as ResolvedAppointmentPlanReservation[];
  }

  return listResolvedAppointmentPlanReservations({
    admin,
    appointmentIds,
    customerId: args.customerId,
    salonId: args.salonId,
  });
}

async function fetchActiveCustomerAppointmentDayKeys(
  admin: AdminClient,
  args: {
    customerId: string;
    membership: MembershipRow;
    salonId: string;
    timeZone: string;
  },
) {
  const periodStart = args.membership.started_at
    ? new Date(args.membership.started_at)
    : new Date(`${args.membership.expires_at}T00:00:00.000Z`);
  const periodEnd = new Date(args.membership.expires_at);
  periodEnd.setUTCDate(periodEnd.getUTCDate() + 1);

  const { data, error } = await admin
    .from("appointments")
    .select("date")
    .eq("customer_id", args.customerId)
    .eq("salon_id", args.salonId)
    .in("status", ["pending", "confirmed"])
    .gte("date", periodStart.toISOString())
    .lt("date", periodEnd.toISOString());

  if (error) {
    throw error;
  }

  return new Set(
    ((data ?? []) as Array<{ date: string | null }>)
      .map((row) => readString(row.date))
      .filter((row): row is string => row !== null)
      .map((row) => formatLocalDateKey(new Date(row), args.timeZone)),
  );
}

async function fetchAvailableSlotsForDay(
  slotClient: Pick<CustomerClient, "rpc"> | AdminClient,
  args: {
    serviceId: string;
    targetDayKey: string;
  },
) {
  const { data, error } = await slotClient.rpc(
    "get_available_staff_slots_for_service",
    {
      service_uuid: args.serviceId,
      target_day: args.targetDayKey,
    },
  );

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      ends_at?: string | null;
      staff_member_id?: string | null;
      staff_member_name?: string | null;
      start_at?: string | null;
    }>
  ).flatMap((row) => {
    const startAt = readString(row.start_at);
    const endsAt = readString(row.ends_at);
    const staffMemberId = readString(row.staff_member_id);
    const staffMemberName = readString(row.staff_member_name);

    if (!startAt || !endsAt || !staffMemberId || !staffMemberName) {
      return [];
    }

    return [
      {
        endsAt,
        staffMemberId,
        staffMemberName,
        startAt,
      },
    ];
  });
}

function pickFixedRecurringSlot(args: {
  preferredMinutesOfDay: number;
  preferredStaffMemberId: string;
  slots: Array<{
    endsAt: string;
    staffMemberId: string;
    staffMemberName: string;
    startAt: string;
  }>;
  timeZone: string;
}) {
  const eligible = args.slots.filter(
    (slot) => slot.staffMemberId === args.preferredStaffMemberId,
  );

  if (!eligible.length) {
    return null;
  }

  return (
    eligible
      .filter(
        (slot) =>
          getLocalMinutesOfDay(new Date(slot.startAt), args.timeZone) ===
          args.preferredMinutesOfDay,
      )
      .sort((left, right) => left.startAt.localeCompare(right.startAt))[0] ??
    null
  );
}

function isRecurringSlotCovered(args: {
  appointments: FutureScheduledMembershipAppointment[];
  desiredDayKey: string;
  preferredMinutesOfDay: number;
  preferredStaffMemberId: string;
}) {
  return args.appointments.some(
    (appointment) =>
      appointment.localDayKey === args.desiredDayKey &&
      appointment.localMinutesOfDay === args.preferredMinutesOfDay &&
      appointment.staffMemberId === args.preferredStaffMemberId,
  );
}

async function createConfirmedManagementAppointment(args: {
  admin: AdminClient;
  customerId: string;
  ownerSupabase: any;
  requestedDate: string;
  salonId: string;
  serviceId: string;
  staffMemberId: string;
}) {
  const createResult = await args.ownerSupabase.rpc(
    "create_management_appointment",
    {
      customer_uuid: args.customerId,
      notes_input: null,
      payment_preference_input: null,
      requested_date: args.requestedDate,
      service_uuid: args.serviceId,
      staff_member_uuid: args.staffMemberId,
    },
  );

  if (createResult.error) {
    throw createResult.error;
  }

  const created = readJsonRecord(createResult.data);
  let appointmentId = readString(created?.id);
  let appointmentDate = readString(created?.date) ?? args.requestedDate;
  let appointmentStatus = readString(created?.status) ?? "confirmed";

  if (!appointmentId) {
    const lookupResult = await args.admin
      .from("appointments")
      .select("id, date, status")
      .eq("customer_id", args.customerId)
      .eq("date", args.requestedDate)
      .eq("salon_id", args.salonId)
      .eq("service_id", args.serviceId)
      .eq("staff_member_id", args.staffMemberId)
      .order("created_at", { ascending: false })
      .maybeSingle();

    if (lookupResult.error || !lookupResult.data?.id) {
      throw (
        lookupResult.error ??
        new Error("membership_plan_appointment_create_failed")
      );
    }

    appointmentId = readString(lookupResult.data.id);
    appointmentDate = readString(lookupResult.data.date) ?? appointmentDate;
    appointmentStatus =
      readString(lookupResult.data.status) ?? appointmentStatus;
  }

  if (!appointmentId) {
    throw new Error("membership_plan_appointment_create_failed");
  }

  if (appointmentStatus.toLowerCase() !== "confirmed") {
    const promoteResult = await args.admin
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("customer_id", args.customerId)
      .eq("id", appointmentId);

    if (promoteResult.error) {
      throw promoteResult.error;
    }

    appointmentStatus = "confirmed";
  }

  return {
    date: appointmentDate,
    id: appointmentId,
    status: appointmentStatus,
  };
}

function sortFutureMembershipAppointments(
  appointments: FutureScheduledMembershipAppointment[],
) {
  return [...appointments].sort((left, right) => {
    const leftRank = left.sessionIndex ?? Number.MAX_SAFE_INTEGER;
    const rightRank = right.sessionIndex ?? Number.MAX_SAFE_INTEGER;

    if (leftRank !== rightRank) {
      return leftRank - rightRank;
    }

    return left.startsAt.localeCompare(right.startsAt);
  });
}

function resolveRecurringOffset(args: {
  anchor: FutureScheduledMembershipAppointment;
  appointment: FutureScheduledMembershipAppointment;
  sortedIndex: number;
}) {
  if (
    args.anchor.sessionIndex &&
    args.appointment.sessionIndex &&
    args.appointment.sessionIndex >= args.anchor.sessionIndex
  ) {
    return args.appointment.sessionIndex - args.anchor.sessionIndex;
  }

  return args.sortedIndex;
}

function isFutureSeriesAlreadyFixed(args: {
  appointments: FutureScheduledMembershipAppointment[];
  membership: MembershipRow;
  timeZone: string;
}) {
  const sortedAppointments = sortFutureMembershipAppointments(
    args.appointments,
  );
  if (!sortedAppointments.length) {
    return true;
  }

  const anchor = sortedAppointments[0];
  const bounds = getMembershipDayBounds(
    args.membership,
    anchor.localDayKey,
    args.timeZone,
  );
  const remainingSessions = Math.max(
    0,
    (readPositiveInteger(args.membership.sessions_included) ?? 0) -
      (readPositiveInteger(args.membership.sessions_used) ?? 0),
  );
  const expectedDayKeys = buildWeeklyRecurringDayKeys({
    count: remainingSessions,
    endDayKey: bounds.endDayKey,
    preferredWeekday: readDayKeyWeekday(anchor.localDayKey),
    startDayKey: anchor.localDayKey,
  });

  if (sortedAppointments.length !== expectedDayKeys.length) {
    return false;
  }

  return sortedAppointments.every((appointment, sortedIndex) => {
    const expectedDayKey =
      expectedDayKeys[
        resolveRecurringOffset({
          anchor,
          appointment,
          sortedIndex,
        })
      ] ?? null;

    return (
      expectedDayKey !== null &&
      appointment.staffMemberId === anchor.staffMemberId &&
      appointment.localMinutesOfDay === anchor.localMinutesOfDay &&
      appointment.localDayKey === expectedDayKey
    );
  });
}

async function loadFutureScheduledMembershipAppointments(
  admin: AdminClient,
  args: {
    membership: MembershipRow;
    nowIso: string;
    timeZone: string;
  },
) {
  const scopedAppointmentIds = await fetchMembershipScopedAppointments(admin, {
    customerId: args.membership.customer_id,
    membership: args.membership,
    salonId: args.membership.salon_id,
  });

  if (!scopedAppointmentIds.length) {
    return [] as FutureScheduledMembershipAppointment[];
  }

  const reservations = await listResolvedAppointmentPlanReservations({
    admin,
    appointmentIds: scopedAppointmentIds,
    customerId: args.membership.customer_id,
    salonId: args.membership.salon_id,
  });
  const scheduledReservations = reservations.filter(
    (reservation) =>
      reservation.membershipId === args.membership.id &&
      reservation.reservationStatus === "scheduled",
  );

  if (!scheduledReservations.length) {
    return [] as FutureScheduledMembershipAppointment[];
  }

  const reservationByAppointmentId = new Map(
    scheduledReservations.map((reservation) => [
      reservation.appointmentId,
      reservation,
    ]),
  );
  const { data, error } = await admin
    .from("appointments")
    .select(
      "id, customer_id, service_id, staff_member_id, date, ends_at, status",
    )
    .in(
      "id",
      scheduledReservations.map((reservation) => reservation.appointmentId),
    )
    .in("status", ["pending", "confirmed"])
    .gte("date", args.nowIso)
    .order("date", { ascending: true });

  if (error) {
    throw error;
  }

  return (
    (data ?? []) as Array<{
      customer_id: string | null;
      date: string | null;
      ends_at: string | null;
      id: string | null;
      service_id: string | null;
      staff_member_id: string | null;
      status: string | null;
    }>
  ).flatMap((row) => {
    const appointmentId = readString(row.id);
    const customerId = readString(row.customer_id);
    const serviceId = readString(row.service_id);
    const staffMemberId = readString(row.staff_member_id);
    const startsAt = readString(row.date);
    const endsAt = readString(row.ends_at);
    const status = readString(row.status);
    const reservation = appointmentId
      ? reservationByAppointmentId.get(appointmentId)
      : null;

    if (
      !appointmentId ||
      !customerId ||
      !serviceId ||
      !staffMemberId ||
      !startsAt ||
      !endsAt ||
      !status ||
      !reservation
    ) {
      return [];
    }

    const startsAtDate = new Date(startsAt);

    return [
      {
        appointmentId,
        customerId,
        endsAt,
        localDayKey: formatLocalDateKey(startsAtDate, args.timeZone),
        localMinutesOfDay: getLocalMinutesOfDay(startsAtDate, args.timeZone),
        serviceId,
        sessionIndex: reservation.sessionIndex,
        staffMemberId,
        startsAt,
        status,
      } satisfies FutureScheduledMembershipAppointment,
    ];
  });
}

async function neutralizeMembershipAppointment(
  admin: AdminClient,
  appointmentId: string,
) {
  const { error } = await admin
    .from("appointments")
    .update({
      booking_policy_acknowledged_at: null,
      booking_policy_snapshot: null,
      booking_policy_version: null,
      customer_confirmation_requested_at: null,
      deposit_amount: 0,
      deposit_customer_reported_paid_at: null,
      deposit_customer_reported_paid_via: null,
      deposit_customer_reported_reference: null,
      deposit_notes: null,
      deposit_paid_at: null,
      deposit_payment_provider: null,
      deposit_payment_provider_charge_id: null,
      deposit_payment_provider_error: null,
      deposit_payment_provider_invoice_url: null,
      deposit_payment_provider_payload: null,
      deposit_payment_provider_status: null,
      deposit_status: "not_required",
      payment_preference: null,
      protection_auto_cancel_lead_minutes: 0,
      protection_auto_cancel_pending_deposit: false,
      protection_auto_cancel_unconfirmed: false,
      // Production keeps a minimum confirmation lead-time constraint even when
      // confirmation is disabled, so use the lowest valid neutral value.
      protection_confirmation_lead_minutes:
        PLAN_NEUTRALIZED_CONFIRMATION_LEAD_MINUTES,
      protection_confirmation_required: false,
      protection_deposit_reminder_lead_hours: 0,
    })
    .eq("id", appointmentId);

  if (error) {
    throw error;
  }
}

async function writePlanReservationEvent(args: AuditReservationEventArgs) {
  const eventType =
    args.reservationState === "reserved"
      ? PLAN_RESERVATION_EVENT_RESERVED
      : args.reservationState === "cancelled"
        ? PLAN_RESERVATION_EVENT_CANCELLED
        : PLAN_RESERVATION_EVENT_CONSUMED;
  const nowIso = new Date().toISOString();
  const { error } = await args.admin.from("security_audit_logs").insert({
    actor_user_id: args.actorUserId ?? null,
    event_type: eventType,
    metadata: {
      appointmentId: args.appointmentId,
      customerId: args.customerId,
      membershipExpiresAt: args.membership.expires_at,
      membershipId: args.membership.id,
      membershipStartedAt: args.membership.started_at,
      membershipTitle: args.membership.title,
      reservedAt: nowIso,
      reservationStatus:
        args.reservationState === "reserved" ? "scheduled" : "consumed",
      serviceId: args.serviceId,
      sessionIndex: args.sessionIndex,
      sessionsIncluded: args.sessionsIncluded,
    },
    request_path: args.requestPath ?? null,
    salon_id: args.salonId,
    severity: "info",
    target_id: args.appointmentId,
    target_type: PLAN_RESERVATION_TARGET_TYPE,
    user_agent: args.userAgent ?? null,
  });

  if (error) {
    throw error;
  }
}

async function cancelAppointmentCompensation(
  customerClient: Pick<CustomerClient, "rpc"> | AdminClient,
  appointmentId: string,
) {
  try {
    await customerClient.rpc("cancel_appointment", {
      appointment_uuid: appointmentId,
      cancellation_reason_input:
        "Programacao automatica do plano revertida pelo sistema.",
    });
  } catch {
    // best effort: avoid surfacing a second error path
  }
}

async function consumeMembershipReservation(
  args: FinalizeAppointmentPlanReservationArgs & {
    reservation: ResolvedAppointmentPlanReservation;
  },
) {
  const activeRedemption = await args.admin
    ?.from("customer_membership_redemptions")
    .select("id")
    .eq("appointment_id", args.appointmentId)
    .is("reversed_at", null)
    .maybeSingle();

  if (activeRedemption?.data?.id) {
    return;
  }

  const consumeResult = await args.ownerSupabase.rpc(
    "consume_customer_membership_package",
    {
      appointment_uuid: args.appointmentId,
      membership_uuid: args.reservation.membershipId,
      notes_input: "Atendimento de plano finalizado pelo painel.",
    },
  );

  if (
    consumeResult.error &&
    args.admin &&
    [
      "membership_expired",
      "membership_no_sessions_remaining",
      "membership_not_found",
    ].some((token) =>
      (consumeResult.error?.message ?? "").toLowerCase().includes(token),
    )
  ) {
    const membership = await fetchMembershipById(
      args.admin,
      args.reservation.membershipId,
      args.salonId,
    );

    if (!membership?.id) {
      throw consumeResult.error;
    }

    const { error: insertError } = await args.admin
      .from("customer_membership_redemptions")
      .insert({
        appointment_id: args.appointmentId,
        customer_id: args.reservation.customerId,
        membership_id: args.reservation.membershipId,
        notes: "Reserva programada automaticamente pelo plano.",
        quantity: 1,
        redemption_kind: "manual",
        salon_id: args.salonId,
        service_id: args.reservation.serviceId,
      });

    if (insertError) {
      throw consumeResult.error;
    }

    await args.admin.rpc("refresh_customer_membership_usage", {
      membership_uuid: args.reservation.membershipId,
    });
  } else if (consumeResult.error) {
    throw consumeResult.error;
  }

  const refreshedMembership =
    (await fetchMembershipById(
      args.admin,
      args.reservation.membershipId,
      args.salonId,
    )) ??
    ({
      id: args.reservation.membershipId,
      customer_id: args.reservation.customerId,
      expires_at: args.reservation.membershipExpiresAt ?? "",
      offer_id: null,
      price_snapshot: null,
      salon_id: args.salonId,
      service_id: args.reservation.serviceId,
      service_name_snapshot: null,
      sessions_included: args.reservation.sessionsIncluded ?? 0,
      sessions_used: args.reservation.sessionsIncluded ?? 0,
      started_at: args.reservation.membershipStartedAt,
      status: "completed",
      title: args.reservation.membershipTitle,
    } satisfies MembershipRow);

  await writePlanReservationEvent({
    actorUserId: null,
    admin: args.admin,
    appointmentId: args.appointmentId,
    customerId: args.reservation.customerId,
    membership: refreshedMembership,
    requestPath: null,
    reservationState: "consumed",
    salonId: args.salonId,
    serviceId: args.reservation.serviceId,
    sessionIndex: args.reservation.sessionIndex,
    sessionsIncluded: args.reservation.sessionsIncluded ?? 0,
    userAgent: null,
  });
}

export async function listResolvedAppointmentPlanReservations(
  args: ListResolvedAppointmentPlanReservationsArgs,
): Promise<ResolvedAppointmentPlanReservation[]> {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    return [];
  }

  const appointmentIds = normalizeAppointmentIds(args.appointmentIds);
  const [officialReservations, auditByAppointmentId] = await Promise.all([
    fetchOfficialAppointmentPlanReservations(admin, {
      appointmentIds,
      customerId: args.customerId,
      salonId: args.salonId,
    }),
    fetchAuditAppointmentPlanReservations(admin, {
      appointmentIds,
      customerId: args.customerId,
      salonId: args.salonId,
    }),
  ]);

  const mergedByAppointmentId = new Map<
    string,
    ResolvedAppointmentPlanReservation
  >();

  for (const reservation of officialReservations) {
    const audit = auditByAppointmentId.get(reservation.appointmentId);
    mergedByAppointmentId.set(reservation.appointmentId, {
      ...reservation,
      membershipExpiresAt:
        reservation.membershipExpiresAt ?? audit?.membershipExpiresAt ?? null,
      membershipStartedAt:
        reservation.membershipStartedAt ?? audit?.membershipStartedAt ?? null,
      membershipTitle:
        reservation.membershipTitle || audit?.membershipTitle || "Plano",
      sessionIndex: audit?.sessionIndex ?? reservation.sessionIndex,
      sessionsIncluded:
        reservation.sessionsIncluded ?? audit?.sessionsIncluded ?? null,
    });
  }

  for (const audit of auditByAppointmentId.values()) {
    if (
      audit.reservationState === "cancelled" ||
      mergedByAppointmentId.has(audit.appointmentId)
    ) {
      continue;
    }

    mergedByAppointmentId.set(audit.appointmentId, audit);
  }

  return [...mergedByAppointmentId.values()];
}

export async function resolveAppointmentPlanReservation(
  args: ResolveAppointmentPlanReservationArgs,
) {
  const reservations = await listResolvedAppointmentPlanReservations({
    admin: args.admin,
    appointmentIds: [args.appointmentId],
    customerId: args.customerId,
    salonId: args.salonId,
  });

  return reservations[0] ?? null;
}

async function scheduleMembershipPlanSeriesReservations(args: {
  actorUserId?: string | null;
  admin: AdminClient;
  anchorMembership: MembershipRow;
  createAppointmentAtSlot: (slot: {
    endsAt: string;
    staffMemberId: string;
    staffMemberName: string;
    startAt: string;
  }) => Promise<Record<string, unknown>>;
  customerId: string;
  preferredLocalDayKey: string;
  preferredMinutesOfDay: number;
  preferredStaffMemberId: string;
  requestPath?: string | null;
  salonId: string;
  salonTimeZone: string;
  serviceId: string;
  slotClient: Pick<CustomerClient, "rpc"> | AdminClient;
  userAgent?: string | null;
}): Promise<MembershipPlanSeriesSchedulingReport> {
  const membershipSeries = await fetchSchedulableMembershipSeries(args.admin, {
    anchorMembership: args.anchorMembership,
    customerId: args.customerId,
    salonId: args.salonId,
  });
  const preferredWeekday = readDayKeyWeekday(args.preferredLocalDayKey);
  const createdAppointments: ScheduledAppointmentSummary[] = [];
  let coveredAppointmentsCount = 0;
  let desiredAppointmentsCount = 0;
  let hasReservableMembership = false;

  for (const seriesMembership of membershipSeries) {
    const existingReservations = await listMembershipReservationsForScheduling(
      args.admin,
      {
        customerId: args.customerId,
        membership: seriesMembership,
        salonId: args.salonId,
      },
    );
    const sessionsIncluded =
      readPositiveInteger(seriesMembership.sessions_included) ?? 0;
    const sessionsUsed =
      readPositiveInteger(seriesMembership.sessions_used) ?? 0;
    const openSessionCount = sessionsIncluded - sessionsUsed;

    if (openSessionCount <= 0) {
      continue;
    }

    hasReservableMembership = true;
    const cycleReferenceDayKey =
      seriesMembership.id === args.anchorMembership.id
        ? args.preferredLocalDayKey
        : (readOptionalString(seriesMembership.started_at) ??
          args.preferredLocalDayKey);
    const { startDayKey, endDayKey, membershipStartDayKey } =
      getMembershipDayBounds(
        seriesMembership,
        cycleReferenceDayKey,
        args.salonTimeZone,
      );

    if (
      seriesMembership.id === args.anchorMembership.id &&
      (diffDayKeys(args.preferredLocalDayKey, startDayKey) < 0 ||
        diffDayKeys(args.preferredLocalDayKey, endDayKey) > 0)
    ) {
      throw new Error("membership_plan_outside_period");
    }

    const recurringStartDayKey =
      seriesMembership.id === args.anchorMembership.id
        ? args.preferredLocalDayKey
        : membershipStartDayKey;
    const desiredDayKeys = buildWeeklyRecurringDayKeys({
      count: openSessionCount,
      endDayKey,
      preferredWeekday,
      startDayKey: recurringStartDayKey,
    });
    desiredAppointmentsCount += desiredDayKeys.length;

    if (!desiredDayKeys.length) {
      continue;
    }

    const occupiedDayKeys = await fetchActiveCustomerAppointmentDayKeys(
      args.admin,
      {
        customerId: args.customerId,
        membership: seriesMembership,
        salonId: args.salonId,
        timeZone: args.salonTimeZone,
      },
    );
    const scheduledAppointments =
      await loadFutureScheduledMembershipAppointments(args.admin, {
        membership: seriesMembership,
        nowIso: parseLocalDateKey(
          seriesMembership.id === args.anchorMembership.id
            ? args.preferredLocalDayKey
            : recurringStartDayKey,
        ).toISOString(),
        timeZone: args.salonTimeZone,
      });
    const availableSessionIndices = buildAvailableSessionIndices(
      seriesMembership,
      existingReservations,
      desiredDayKeys.length,
    );
    const createdAppointmentsBeforeCycle = createdAppointments.length;

    for (let index = 0; index < desiredDayKeys.length; index += 1) {
      const targetDayKey = desiredDayKeys[index];
      if (occupiedDayKeys.has(targetDayKey)) {
        if (
          isRecurringSlotCovered({
            appointments: scheduledAppointments,
            desiredDayKey: targetDayKey,
            preferredMinutesOfDay: args.preferredMinutesOfDay,
            preferredStaffMemberId: args.preferredStaffMemberId,
          })
        ) {
          coveredAppointmentsCount += 1;
        }
        continue;
      }

      const slots = await fetchAvailableSlotsForDay(args.slotClient, {
        serviceId: args.serviceId,
        targetDayKey,
      });
      const preferredSlot = pickFixedRecurringSlot({
        preferredMinutesOfDay: args.preferredMinutesOfDay,
        preferredStaffMemberId: args.preferredStaffMemberId,
        slots,
        timeZone: args.salonTimeZone,
      });

      if (!preferredSlot) {
        continue;
      }

      let createdAppointment: Record<string, unknown>;
      try {
        createdAppointment = await args.createAppointmentAtSlot(preferredSlot);
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message.toLowerCase()
            : String(error).toLowerCase();
        if (
          message.includes("customer_has_active_appointment_on_selected_day") ||
          message.includes("time_slot_unavailable")
        ) {
          occupiedDayKeys.add(targetDayKey);
          continue;
        }

        throw error;
      }

      const appointmentId = readString(createdAppointment.id);
      const appointmentDate =
        readString(createdAppointment.date) ?? preferredSlot.startAt;
      const appointmentStatus =
        readString(createdAppointment.status) ?? "confirmed";

      if (!appointmentId) {
        throw new Error("membership_plan_appointment_create_failed");
      }

      try {
        await neutralizeMembershipAppointment(args.admin, appointmentId);
        const cycleCreatedIndex =
          createdAppointments.length - createdAppointmentsBeforeCycle;
        const sessionIndex = availableSessionIndices[cycleCreatedIndex] ?? null;
        await writePlanReservationEvent({
          actorUserId: args.actorUserId ?? null,
          admin: args.admin,
          appointmentId,
          customerId: args.customerId,
          membership: seriesMembership,
          requestPath: args.requestPath ?? null,
          reservationState: "reserved",
          salonId: args.salonId,
          serviceId: args.serviceId,
          sessionIndex,
          sessionsIncluded,
          userAgent: args.userAgent ?? null,
        });

        occupiedDayKeys.add(
          formatLocalDateKey(new Date(appointmentDate), args.salonTimeZone),
        );
        createdAppointments.push({
          appointmentId,
          membershipExpiresAt: seriesMembership.expires_at,
          membershipId: seriesMembership.id,
          membershipTitle: seriesMembership.title,
          sessionIndex,
          sessionsIncluded,
          staffMemberId: preferredSlot.staffMemberId,
          startsAt: appointmentDate,
          status: appointmentStatus,
        });
      } catch (error) {
        await cancelAppointmentCompensation(args.slotClient, appointmentId);
        throw error;
      }
    }
  }

  return {
    coveredAppointmentsCount,
    createdAppointments,
    desiredAppointmentsCount,
    hasReservableMembership,
  };
}

export async function scheduleMembershipPlanAppointments(
  args: ScheduleMembershipPlanAppointmentsArgs,
): Promise<ScheduledMembershipPlanResult> {
  const admin = resolveAdminClient();
  if (!admin) {
    throw new Error("membership_plan_unavailable");
  }

  const context = await resolveAuthenticatedCustomerContext(
    args.accessToken,
    admin,
  );
  const customerClient = createCustomerSessionClient(args.accessToken);
  const preferredStartAt = new Date(args.preferredStartAt);

  if (!Number.isFinite(preferredStartAt.getTime())) {
    throw new Error("membership_plan_invalid_slot");
  }

  const salon = await fetchSalonTimezone(admin, context.salonId);
  const salonTimeZone = salon?.timezone?.trim() || "America/Sao_Paulo";
  const preferredLocalDayKey = formatLocalDateKey(
    preferredStartAt,
    salonTimeZone,
  );
  const membership =
    (args.membershipId
      ? await fetchMembershipById(admin, args.membershipId, context.salonId)
      : await fetchMatchingMembership(admin, {
          customerId: context.customerId,
          localDayKey: preferredLocalDayKey,
          salonId: context.salonId,
          serviceId: args.serviceId,
        })) ?? null;

  if (!membership?.id || membership.customer_id !== context.customerId) {
    throw new Error("membership_plan_not_found");
  }

  if (
    membership.service_id !== args.serviceId ||
    !isMembershipActiveOnDay(membership, preferredLocalDayKey)
  ) {
    throw new Error("membership_plan_outside_period");
  }

  const scheduleReport = await scheduleMembershipPlanSeriesReservations({
    actorUserId: context.userId,
    admin,
    anchorMembership: membership,
    createAppointmentAtSlot: (preferredSlot) =>
      createConfirmedCustomerAppointment({
        accessToken: args.accessToken,
        admin,
        customerId: context.customerId,
        paymentPreference: null,
        preferredStaffMemberId: args.preferredStaffMemberId,
        requestedDate: preferredSlot.startAt,
        serviceId: args.serviceId,
      }),
    customerId: context.customerId,
    preferredLocalDayKey,
    preferredMinutesOfDay: getLocalMinutesOfDay(
      preferredStartAt,
      salonTimeZone,
    ),
    preferredStaffMemberId: args.preferredStaffMemberId,
    requestPath: args.requestPath ?? null,
    salonId: context.salonId,
    salonTimeZone,
    serviceId: args.serviceId,
    slotClient: customerClient,
    userAgent: args.userAgent ?? null,
  });

  if (!scheduleReport.hasReservableMembership) {
    throw new Error("membership_plan_no_sessions_remaining");
  }

  if (
    scheduleReport.createdAppointments.length === 0 &&
    scheduleReport.desiredAppointmentsCount > 0 &&
    scheduleReport.coveredAppointmentsCount ===
      scheduleReport.desiredAppointmentsCount
  ) {
    throw new Error("membership_plan_series_already_fixed");
  }

  return {
    createdAppointments: scheduleReport.createdAppointments,
    membershipExpiresAt: membership.expires_at,
    membershipId: membership.id,
    membershipTitle: membership.title,
    scheduledCount: scheduleReport.createdAppointments.length,
    sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
    skippedCount: Math.max(
      scheduleReport.desiredAppointmentsCount -
        scheduleReport.coveredAppointmentsCount -
        scheduleReport.createdAppointments.length,
      0,
    ),
  };
}

export async function scheduleApprovedMembershipRequestSeriesByAdmin(
  args: ScheduleApprovedMembershipRequestSeriesByAdminArgs,
): Promise<ReprocessedMembershipPlanSeriesResult> {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    throw new Error("membership_plan_unavailable");
  }

  const membershipId = readString(args.membershipId);
  const preferredStaffMemberId = readString(args.preferredStaffMemberId);
  const preferredStartAtIso = readString(args.preferredStartAt);
  if (!membershipId || !preferredStaffMemberId || !preferredStartAtIso) {
    throw new Error("membership_plan_invalid_slot");
  }

  const membership = await fetchMembershipById(
    admin,
    membershipId,
    args.salonId,
  );
  if (!membership?.id || !membership.service_id) {
    throw new Error("membership_plan_not_found");
  }

  const preferredStartAt = new Date(preferredStartAtIso);
  if (!Number.isFinite(preferredStartAt.getTime())) {
    throw new Error("membership_plan_invalid_slot");
  }

  const salon = await fetchSalonTimezone(admin, args.salonId);
  const salonTimeZone = salon?.timezone?.trim() || "America/Sao_Paulo";
  const requestedLocalDayKey = formatLocalDateKey(
    preferredStartAt,
    salonTimeZone,
  );
  const preferredLocalDayKey = resolveRequestedMembershipSeriesStartDayKey({
    membership,
    requestedLocalDayKey,
    salonTimeZone,
  });

  if (!preferredLocalDayKey) {
    return {
      createdAppointments: [],
      membershipExpiresAt: membership.expires_at,
      membershipId: membership.id,
      membershipTitle: membership.title,
      scheduledCount: 0,
      sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
      skippedCount: 0,
      status: "needs_manual_review",
    };
  }

  const scheduleReport = await scheduleMembershipPlanSeriesReservations({
    actorUserId: args.actorUserId ?? null,
    admin,
    anchorMembership: membership,
    createAppointmentAtSlot: (preferredSlot) =>
      createConfirmedManagementAppointment({
        admin,
        customerId: membership.customer_id,
        ownerSupabase: args.ownerSupabase,
        requestedDate: preferredSlot.startAt,
        salonId: args.salonId,
        serviceId: membership.service_id as string,
        staffMemberId: preferredStaffMemberId,
      }),
    customerId: membership.customer_id,
    preferredLocalDayKey,
    preferredMinutesOfDay: getLocalMinutesOfDay(
      preferredStartAt,
      salonTimeZone,
    ),
    preferredStaffMemberId,
    requestPath: args.requestPath ?? null,
    salonId: args.salonId,
    salonTimeZone,
    serviceId: membership.service_id,
    slotClient: admin,
    userAgent: args.userAgent ?? null,
  });
  const skippedCount = Math.max(
    scheduleReport.desiredAppointmentsCount -
      scheduleReport.coveredAppointmentsCount -
      scheduleReport.createdAppointments.length,
    0,
  );

  if (scheduleReport.createdAppointments.length > 0) {
    return {
      createdAppointments: scheduleReport.createdAppointments,
      membershipExpiresAt: membership.expires_at,
      membershipId: membership.id,
      membershipTitle: membership.title,
      scheduledCount: scheduleReport.createdAppointments.length,
      sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
      skippedCount,
      status: "reprocessed",
    };
  }

  if (
    scheduleReport.desiredAppointmentsCount > 0 &&
    scheduleReport.coveredAppointmentsCount ===
      scheduleReport.desiredAppointmentsCount
  ) {
    return {
      createdAppointments: [],
      membershipExpiresAt: membership.expires_at,
      membershipId: membership.id,
      membershipTitle: membership.title,
      scheduledCount: 0,
      sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
      skippedCount: 0,
      status: "already_fixed",
    };
  }

  return {
    createdAppointments: [],
    membershipExpiresAt: membership.expires_at,
    membershipId: membership.id,
    membershipTitle: membership.title,
    scheduledCount: 0,
    sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
    skippedCount,
    status: skippedCount > 0 ? "needs_manual_review" : "already_fixed",
  };
}

export async function reprocessMembershipPlanSeriesByAdmin(
  args: ReprocessMembershipPlanSeriesByAdminArgs,
): Promise<ReprocessedMembershipPlanSeriesResult> {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    throw new Error("membership_plan_unavailable");
  }

  const appointmentId = readString(args.appointmentId);
  if (!appointmentId) {
    throw new Error("membership_plan_reservation_not_found");
  }

  const reservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId,
    salonId: args.salonId,
  });

  if (!reservation) {
    throw new Error("membership_plan_reservation_not_found");
  }

  const membership = await fetchMembershipById(
    admin,
    reservation.membershipId,
    args.salonId,
  );

  if (!membership?.id || !membership.service_id) {
    throw new Error("membership_plan_not_found");
  }

  const appointmentResult = await admin
    .from("appointments")
    .select("id, customer_id, date, service_id, staff_member_id, status")
    .eq("id", appointmentId)
    .eq("salon_id", args.salonId)
    .maybeSingle();

  if (appointmentResult.error || !appointmentResult.data?.id) {
    throw (
      appointmentResult.error ??
      new Error("membership_plan_reservation_not_found")
    );
  }

  const preferredStartAtIso = readString(appointmentResult.data.date);
  const preferredStaffMemberId = readString(
    appointmentResult.data.staff_member_id,
  );
  if (!preferredStartAtIso || !preferredStaffMemberId) {
    throw new Error("membership_plan_invalid_slot");
  }

  const salon = await fetchSalonTimezone(admin, args.salonId);
  const salonTimeZone = salon?.timezone?.trim() || "America/Sao_Paulo";
  const preferredStartAt = new Date(preferredStartAtIso);
  const anchorLocalDayKey = formatLocalDateKey(preferredStartAt, salonTimeZone);
  const todayLocalDayKey = formatLocalDateKey(new Date(), salonTimeZone);
  const preferredLocalDayKey =
    reservation.reservationStatus === "consumed" &&
    diffDayKeys(todayLocalDayKey, anchorLocalDayKey) > 0
      ? todayLocalDayKey
      : anchorLocalDayKey;
  const scheduleReport = await scheduleMembershipPlanSeriesReservations({
    actorUserId: args.actorUserId ?? null,
    admin,
    anchorMembership: membership,
    createAppointmentAtSlot: (preferredSlot) =>
      createConfirmedManagementAppointment({
        admin,
        customerId: membership.customer_id,
        ownerSupabase: args.ownerSupabase,
        requestedDate: preferredSlot.startAt,
        salonId: args.salonId,
        serviceId: membership.service_id as string,
        staffMemberId: preferredStaffMemberId,
      }),
    customerId: membership.customer_id,
    preferredLocalDayKey,
    preferredMinutesOfDay: getLocalMinutesOfDay(
      preferredStartAt,
      salonTimeZone,
    ),
    preferredStaffMemberId,
    requestPath: args.requestPath ?? null,
    salonId: args.salonId,
    salonTimeZone,
    serviceId: membership.service_id,
    slotClient: admin,
    userAgent: args.userAgent ?? null,
  });
  const skippedCount = Math.max(
    scheduleReport.desiredAppointmentsCount -
      scheduleReport.coveredAppointmentsCount -
      scheduleReport.createdAppointments.length,
    0,
  );

  if (scheduleReport.createdAppointments.length > 0) {
    return {
      createdAppointments: scheduleReport.createdAppointments,
      membershipExpiresAt: membership.expires_at,
      membershipId: membership.id,
      membershipTitle: membership.title,
      scheduledCount: scheduleReport.createdAppointments.length,
      sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
      skippedCount,
      status: "reprocessed",
    };
  }

  if (skippedCount > 0) {
    return {
      createdAppointments: [],
      membershipExpiresAt: membership.expires_at,
      membershipId: membership.id,
      membershipTitle: membership.title,
      scheduledCount: 0,
      sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
      skippedCount,
      status: "needs_manual_review",
    };
  }

  return {
    createdAppointments: [],
    membershipExpiresAt: membership.expires_at,
    membershipId: membership.id,
    membershipTitle: membership.title,
    scheduledCount: 0,
    sessionsIncluded: readPositiveInteger(membership.sessions_included) ?? 0,
    skippedCount: 0,
    status: "already_fixed",
  };
}

export async function cancelMembershipPlanAppointment(
  args: CancelMembershipPlanAppointmentArgs,
) {
  const admin = resolveAdminClient();
  if (!admin) {
    throw new Error("membership_plan_unavailable");
  }

  const context = await resolveAuthenticatedCustomerContext(
    args.accessToken,
    admin,
  );
  const customerClient = createCustomerSessionClient(args.accessToken);
  const reservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId: args.appointmentId,
    customerId: context.customerId,
    salonId: context.salonId,
  });

  if (!reservation || reservation.reservationStatus !== "scheduled") {
    throw new Error("membership_plan_reservation_not_found");
  }

  const membership = await fetchMembershipById(
    admin,
    reservation.membershipId,
    context.salonId,
  );

  if (!membership?.id) {
    throw new Error("membership_plan_not_found");
  }

  const cancelResult = await customerClient.rpc("cancel_appointment", {
    appointment_uuid: args.appointmentId,
    cancellation_reason_input: args.cancellationReason,
  });

  if (cancelResult.error) {
    throw cancelResult.error;
  }

  await writePlanReservationEvent({
    actorUserId: context.userId,
    admin,
    appointmentId: args.appointmentId,
    customerId: context.customerId,
    membership,
    requestPath: args.requestPath ?? null,
    reservationState: "cancelled",
    salonId: context.salonId,
    serviceId: reservation.serviceId,
    sessionIndex: reservation.sessionIndex,
    sessionsIncluded: reservation.sessionsIncluded ?? 0,
    userAgent: null,
  });
}

export async function finalizeAppointmentPlanReservation(
  args: FinalizeAppointmentPlanReservationArgs,
) {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    return null;
  }

  const reservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId: args.appointmentId,
    salonId: args.salonId,
  });

  if (!reservation || reservation.reservationStatus !== "scheduled") {
    return reservation;
  }

  await consumeMembershipReservation({
    ...args,
    admin,
    reservation,
  });

  return reservation;
}

export async function transferAppointmentPlanReservation(
  args: TransferAppointmentPlanReservationArgs,
) {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    return null;
  }

  const previousReservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId: args.previousAppointmentId,
    salonId: args.salonId,
  });

  if (
    !previousReservation ||
    previousReservation.reservationStatus !== "scheduled" ||
    previousReservation.appointmentId === args.nextAppointmentId
  ) {
    return previousReservation;
  }

  const membership = await fetchMembershipById(
    admin,
    previousReservation.membershipId,
    args.salonId,
  );

  if (!membership?.id) {
    return previousReservation;
  }

  await writePlanReservationEvent({
    actorUserId: args.actorUserId ?? null,
    admin,
    appointmentId: args.previousAppointmentId,
    customerId: previousReservation.customerId,
    membership,
    requestPath: args.requestPath ?? null,
    reservationState: "cancelled",
    salonId: args.salonId,
    serviceId: previousReservation.serviceId,
    sessionIndex: previousReservation.sessionIndex,
    sessionsIncluded: previousReservation.sessionsIncluded ?? 0,
    userAgent: args.userAgent ?? null,
  });

  await neutralizeMembershipAppointment(admin, args.nextAppointmentId);

  await writePlanReservationEvent({
    actorUserId: args.actorUserId ?? null,
    admin,
    appointmentId: args.nextAppointmentId,
    customerId: previousReservation.customerId,
    membership,
    requestPath: args.requestPath ?? null,
    reservationState: "reserved",
    salonId: args.salonId,
    serviceId: previousReservation.serviceId,
    sessionIndex: previousReservation.sessionIndex,
    sessionsIncluded: previousReservation.sessionsIncluded ?? 0,
    userAgent: args.userAgent ?? null,
  });

  return previousReservation;
}

export async function queueMembershipFirstSlotNotification(
  args: QueueMembershipFirstSlotNotificationArgs,
) {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    return "unavailable" as const;
  }

  const now = args.now ?? new Date();
  const notificationCandidates = await admin
    .from("salon_customer_notifications")
    .select("created_at, payload")
    .eq("salon_id", args.salonId)
    .eq("customer_id", args.customerId)
    .eq("audience", "single_customer")
    .eq("notification_type", MEMBERSHIP_FIRST_SLOT_NOTIFICATION_TYPE)
    .order("created_at", { ascending: false })
    .limit(10);

  if (notificationCandidates.error) {
    throw notificationCandidates.error;
  }

  const candidateRows = (notificationCandidates.data ?? []) as Array<{
    created_at?: string | null;
    payload?: Record<string, unknown> | null;
  }>;
  const hasRecentDuplicate = candidateRows.some((row) => {
    const membershipId = readString(row.payload?.membershipId);
    const createdAt = readOptionalString(row.created_at);
    return (
      membershipId === args.membershipId &&
      isRecentEnoughToSkipNotification(createdAt, now)
    );
  });

  if (hasRecentDuplicate) {
    return "skipped_existing" as const;
  }

  const serviceName = readOptionalString(args.serviceName);
  const title = "Seu plano ja pode fixar os horarios";
  const body = serviceName
    ? `${args.membershipTitle} ja esta ativo. Abra a Agenda, escolha o primeiro horario de ${serviceName} e o app fixa as proximas sessoes automaticamente.`
    : `${args.membershipTitle} ja esta ativo. Abra a Agenda, escolha o primeiro horario do plano e o app fixa as proximas sessoes automaticamente.`;

  const insertResult = await admin.from("salon_customer_notifications").insert({
    salon_id: args.salonId,
    customer_id: args.customerId,
    audience: "single_customer",
    notification_type: MEMBERSHIP_FIRST_SLOT_NOTIFICATION_TYPE,
    title,
    body,
    payload: {
      type: MEMBERSHIP_FIRST_SLOT_NOTIFICATION_TYPE,
      ctaTarget: "appointments",
      membershipId: args.membershipId,
      membershipTitle: args.membershipTitle,
      serviceId: args.serviceId ?? null,
      serviceName,
      expiresAt: args.expiresAt ?? null,
      targetTabIndex: 1,
    },
  });

  if (insertResult.error) {
    throw insertResult.error;
  }

  return "queued" as const;
}

export async function neutralizeMembershipPlanAppointment(
  args: NeutralizeMembershipPlanAppointmentArgs,
) {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    return;
  }

  await neutralizeMembershipAppointment(admin, args.appointmentId);
}

export async function reconcileLegacyMembershipPlanSeries(
  args: ReconcileLegacyMembershipPlanSeriesArgs = {},
): Promise<ReconcileLegacyMembershipPlanSeriesReport> {
  const admin = resolveAdminClient(args.admin);
  const now = args.now ?? new Date();
  const nowIso = now.toISOString();
  const todayIso = nowIso.slice(0, 10);

  if (!admin) {
    return {
      alreadyFixedMemberships: 0,
      changedAppointments: 0,
      inspectedMemberships: 0,
      memberships: [],
      migratedMemberships: 0,
      pendingFirstSlotMemberships: 0,
      queuedFirstSlotNotifications: 0,
      skippedMemberships: 0,
    };
  }

  let membershipsQuery = admin
    .from("customer_memberships")
    .select(
      "id, customer_id, expires_at, offer_id, price_snapshot, salon_id, service_id, service_name_snapshot, sessions_included, sessions_used, started_at, status, title",
    )
    .eq("status", "active")
    .gte("expires_at", todayIso)
    .order("expires_at", { ascending: true })
    .order("created_at", { ascending: true });

  const scopedMembershipId = readString(args.membershipId);
  const scopedSalonId = readString(args.salonId);

  if (scopedMembershipId) {
    membershipsQuery = membershipsQuery.eq("id", scopedMembershipId);
  }

  if (scopedSalonId) {
    membershipsQuery = membershipsQuery.eq("salon_id", scopedSalonId);
  }

  const membershipsResult = await membershipsQuery;

  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  const memberships = (membershipsResult.data ?? []) as MembershipRow[];
  const report: ReconcileLegacyMembershipPlanSeriesReport = {
    alreadyFixedMemberships: 0,
    changedAppointments: 0,
    inspectedMemberships: memberships.length,
    memberships: [],
    migratedMemberships: 0,
    pendingFirstSlotMemberships: 0,
    queuedFirstSlotNotifications: 0,
    skippedMemberships: 0,
  };

  for (const membership of memberships) {
    if (!membership.service_id) {
      report.skippedMemberships += 1;
      report.memberships.push({
        changedAppointments: 0,
        details: "Plano sem serviço operacional vinculado.",
        membershipId: membership.id,
        result: "skipped",
        title: membership.title,
      });
      continue;
    }

    const salon = await fetchSalonTimezone(admin, membership.salon_id);
    const salonTimeZone = salon?.timezone?.trim() || "America/Sao_Paulo";
    const futureAppointments = await loadFutureScheduledMembershipAppointments(
      admin,
      {
        membership,
        nowIso,
        timeZone: salonTimeZone,
      },
    );
    const sessionsIncluded =
      readPositiveInteger(membership.sessions_included) ?? 0;
    const sessionsUsed = readPositiveInteger(membership.sessions_used) ?? 0;
    const remainingSessions = Math.max(0, sessionsIncluded - sessionsUsed);

    if (!futureAppointments.length) {
      if (
        remainingSessions > 0 &&
        args.notifyPendingFirstSlot &&
        !args.dryRun
      ) {
        const notificationResult = await queueMembershipFirstSlotNotification({
          admin,
          customerId: membership.customer_id,
          expiresAt: membership.expires_at,
          membershipId: membership.id,
          membershipTitle: membership.title,
          now,
          salonId: membership.salon_id,
          serviceId: membership.service_id,
          serviceName: membership.service_name_snapshot,
        });

        if (notificationResult === "queued") {
          report.queuedFirstSlotNotifications += 1;
        }
      }

      report.pendingFirstSlotMemberships += 1;
      report.memberships.push({
        changedAppointments: 0,
        details:
          remainingSessions > 0
            ? "Plano ativo sem série futura. A cliente ainda precisa escolher o primeiro horário fixo."
            : "Plano sem sessões futuras reservadas.",
        membershipId: membership.id,
        result: "pending_first_slot",
        title: membership.title,
      });
      continue;
    }

    if (
      isFutureSeriesAlreadyFixed({
        appointments: futureAppointments,
        membership,
        timeZone: salonTimeZone,
      })
    ) {
      report.alreadyFixedMemberships += 1;
      report.memberships.push({
        changedAppointments: 0,
        details:
          "A série futura já está fixa com o profissional e horário-base.",
        membershipId: membership.id,
        result: "already_fixed",
        title: membership.title,
      });
      continue;
    }

    const sortedAppointments =
      sortFutureMembershipAppointments(futureAppointments);
    const anchor = sortedAppointments[0];
    const bounds = getMembershipDayBounds(
      membership,
      anchor.localDayKey,
      salonTimeZone,
    );
    const recurrenceDays = calculateMembershipRecurrenceDays({
      membershipEndDayKey: bounds.endDayKey,
      membershipStartDayKey: bounds.membershipStartDayKey,
      sessionsIncluded,
    });
    let changedAppointments = 0;
    let skippedAppointments = 0;

    for (let index = 0; index < sortedAppointments.length; index += 1) {
      const appointment = sortedAppointments[index];
      const targetDayKey = shiftDayKey(
        anchor.localDayKey,
        recurrenceDays *
          resolveRecurringOffset({
            anchor,
            appointment,
            sortedIndex: index,
          }),
      );

      if (diffDayKeys(targetDayKey, bounds.endDayKey) > 0) {
        skippedAppointments += 1;
        continue;
      }

      if (
        appointment.staffMemberId === anchor.staffMemberId &&
        appointment.localMinutesOfDay === anchor.localMinutesOfDay &&
        appointment.localDayKey === targetDayKey
      ) {
        continue;
      }

      const targetSlots = await fetchAvailableSlotsForDay(admin, {
        serviceId: membership.service_id,
        targetDayKey,
      });
      const targetSlot = pickFixedRecurringSlot({
        preferredMinutesOfDay: anchor.localMinutesOfDay,
        preferredStaffMemberId: anchor.staffMemberId,
        slots: targetSlots,
        timeZone: salonTimeZone,
      });

      if (!targetSlot) {
        skippedAppointments += 1;
        continue;
      }

      if (args.dryRun) {
        changedAppointments += 1;
        continue;
      }

      const updateResult = await admin
        .from("appointments")
        .update({
          date: targetSlot.startAt,
          ends_at: targetSlot.endsAt,
          staff_member_id: targetSlot.staffMemberId,
          status: "confirmed",
        })
        .eq("id", appointment.appointmentId)
        .eq("customer_id", appointment.customerId);

      if (updateResult.error) {
        throw updateResult.error;
      }

      await neutralizeMembershipAppointment(admin, appointment.appointmentId);
      changedAppointments += 1;
    }

    if (changedAppointments > 0) {
      report.changedAppointments += changedAppointments;
      report.migratedMemberships += 1;
      report.memberships.push({
        changedAppointments,
        details:
          skippedAppointments > 0
            ? `${changedAppointments} sessão(ões) futuras reposicionadas. ${skippedAppointments} ficaram sem encaixe no mesmo horário-base.`
            : `${changedAppointments} sessão(ões) futuras reposicionadas para a série fixa.`,
        membershipId: membership.id,
        result: "migrated",
        title: membership.title,
      });
      continue;
    }

    report.skippedMemberships += 1;
    report.memberships.push({
      changedAppointments: 0,
      details:
        skippedAppointments > 0
          ? "A série futura existe, mas não houve slot seguro para reposicionar automaticamente."
          : "Nenhuma alteração necessária.",
      membershipId: membership.id,
      result: "skipped",
      title: membership.title,
    });
  }

  return report;
}

export const __appointmentPlanReservationInternals = {
  buildFixedRecurringDayKeys,
  buildWeeklyRecurringDayKeys,
  calculateMembershipRecurrenceDays,
  isRecurringSlotCovered,
  isFutureSeriesAlreadyFixed,
  PLAN_NEUTRALIZED_CONFIRMATION_LEAD_MINUTES,
  resolveRequestedMembershipSeriesStartDayKey,
};

export async function cancelAppointmentPlanReservationByAdmin(
  args: CancelAppointmentPlanReservationByAdminArgs,
) {
  const admin = resolveAdminClient(args.admin);
  if (!admin) {
    return null;
  }

  const reservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId: args.appointmentId,
    salonId: args.salonId,
  });

  if (!reservation || reservation.reservationStatus !== "scheduled") {
    return reservation;
  }

  const membership = await fetchMembershipById(
    admin,
    reservation.membershipId,
    args.salonId,
  );

  if (!membership?.id) {
    return reservation;
  }

  await writePlanReservationEvent({
    actorUserId: args.actorUserId ?? null,
    admin,
    appointmentId: args.appointmentId,
    customerId: reservation.customerId,
    membership,
    requestPath: args.requestPath ?? null,
    reservationState: "cancelled",
    salonId: args.salonId,
    serviceId: reservation.serviceId,
    sessionIndex: reservation.sessionIndex,
    sessionsIncluded: reservation.sessionsIncluded ?? 0,
    userAgent: args.userAgent ?? null,
  });

  return reservation;
}
