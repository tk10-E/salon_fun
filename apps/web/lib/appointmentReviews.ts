import { createAdminClient } from "@/lib/supabase/admin";

const FALLBACK_EVENT_TYPE = "appointment.review_saved";
const FALLBACK_TARGET_TYPE = "appointment_review";

type OfficialAppointmentReviewRow = {
  appointment_id: string;
  comment: string | null;
  created_at: string;
  customer_id?: string | null;
  rating: number;
  salon_id?: string | null;
  service_id?: string | null;
  staff_member_id: string;
  updated_at: string;
};

type SecurityAuditReviewRow = {
  actor_user_id: string | null;
  created_at: string;
  event_type: string | null;
  metadata: Record<string, unknown> | null;
  salon_id: string | null;
  target_id: string | null;
  target_type: string | null;
};

type AppointmentValidationRow = {
  customer_id: string;
  id: string;
  salon_id: string;
  service_id: string;
  staff_member_id: string | null;
  status: string;
};

export type AuthenticatedCustomerContext = {
  customerId: string;
  salonId: string;
  userId: string;
};

export type ResolvedAppointmentReview = {
  appointmentId: string;
  comment: string | null;
  createdAt: string;
  customerId: string;
  rating: number;
  salonId: string;
  serviceId: string;
  source: "official" | "fallback";
  staffMemberId: string;
  updatedAt: string;
};

type ListResolvedAppointmentReviewsArgs = {
  admin?: any;
  appointmentIds?: string[];
  customerId?: string;
  salonId?: string;
  staffMemberIds?: string[];
};

type SaveAppointmentReviewArgs = {
  accessToken: string;
  admin?: any;
  comment?: string | null;
  appointmentId: string;
  ipAddress?: string | null;
  rating: number;
  requestPath?: string | null;
  userAgent?: string | null;
};

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readNullableString(value: unknown) {
  return typeof value === "string" ? value.trim() || null : null;
}

function readRating(value: unknown) {
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
  return normalized >= 1 && normalized <= 5 ? normalized : null;
}

function normalizeComment(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function normalizeAppointmentIdList(value: string[] | undefined) {
  const deduped = new Set<string>();

  for (const item of value ?? []) {
    const normalized = readString(item);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

function normalizeStaffMemberIdList(value: string[] | undefined) {
  const deduped = new Set<string>();

  for (const item of value ?? []) {
    const normalized = readString(item);
    if (normalized) {
      deduped.add(normalized);
    }
  }

  return [...deduped];
}

function resolveReviewTimestamp(review: Pick<ResolvedAppointmentReview, "createdAt" | "updatedAt">) {
  const updatedAt = Date.parse(review.updatedAt);
  if (Number.isFinite(updatedAt)) {
    return updatedAt;
  }

  const createdAt = Date.parse(review.createdAt);
  return Number.isFinite(createdAt) ? createdAt : 0;
}

function toResolvedOfficialReview(
  row: OfficialAppointmentReviewRow,
): ResolvedAppointmentReview | null {
  const appointmentId = readString(row.appointment_id);
  const customerId = readString(row.customer_id);
  const salonId = readString(row.salon_id);
  const serviceId = readString(row.service_id);
  const staffMemberId = readString(row.staff_member_id);
  const rating = readRating(row.rating);
  const createdAt = readString(row.created_at);
  const updatedAt = readString(row.updated_at) ?? createdAt;

  if (
    !appointmentId ||
    !customerId ||
    !salonId ||
    !serviceId ||
    !staffMemberId ||
    rating == null ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    appointmentId,
    comment: readNullableString(row.comment),
    createdAt,
    customerId,
    rating,
    salonId,
    serviceId,
    source: "official",
    staffMemberId,
    updatedAt,
  };
}

function toResolvedFallbackReview(
  row: SecurityAuditReviewRow,
): ResolvedAppointmentReview | null {
  if (
    row.event_type !== FALLBACK_EVENT_TYPE ||
    row.target_type !== FALLBACK_TARGET_TYPE
  ) {
    return null;
  }

  const metadata = row.metadata ?? {};
  const appointmentId =
    readString(row.target_id) ?? readString(metadata.appointmentId);
  const customerId = readString(metadata.customerId);
  const salonId = readString(row.salon_id) ?? readString(metadata.salonId);
  const serviceId = readString(metadata.serviceId);
  const staffMemberId = readString(metadata.staffMemberId);
  const rating = readRating(metadata.rating);
  const createdAt = readString(metadata.createdAt) ?? readString(row.created_at);
  const updatedAt = readString(metadata.updatedAt) ?? createdAt;

  if (
    !appointmentId ||
    !customerId ||
    !salonId ||
    !serviceId ||
    !staffMemberId ||
    rating == null ||
    !createdAt ||
    !updatedAt
  ) {
    return null;
  }

  return {
    appointmentId,
    comment: normalizeComment(metadata.comment),
    createdAt,
    customerId,
    rating,
    salonId,
    serviceId,
    source: "fallback",
    staffMemberId,
    updatedAt,
  };
}

function preferReview(
  current: ResolvedAppointmentReview | undefined,
  candidate: ResolvedAppointmentReview,
) {
  if (!current) {
    return candidate;
  }

  if (candidate.source === "official" && current.source !== "official") {
    return candidate;
  }

  if (candidate.source !== "official" && current.source === "official") {
    return current;
  }

  return resolveReviewTimestamp(candidate) >= resolveReviewTimestamp(current)
    ? candidate
    : current;
}

function isMissingAppointmentReviewResourceError(error: unknown) {
  const code =
    typeof error === "object" &&
    error &&
    "code" in error &&
    typeof (error as { code?: unknown }).code === "string"
      ? (error as { code: string }).code
      : null;
  const message =
    typeof error === "object" &&
    error &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? (error as { message: string }).message.toLowerCase()
      : "";
  const details =
    typeof error === "object" &&
    error &&
    "details" in error &&
    typeof (error as { details?: unknown }).details === "string"
      ? (error as { details: string }).details.toLowerCase()
      : "";

  if (code === "PGRST205" || code === "42P01") {
    return message.includes("appointment_reviews");
  }

  if (code === "PGRST202" || code === "42883") {
    return (
      message.includes("submit_appointment_review") ||
      details.includes("submit_appointment_review")
    );
  }

  return (
    (message.includes("appointment_reviews") ||
      details.includes("appointment_reviews")) &&
    (message.includes("schema cache") ||
      message.includes("does not exist") ||
      details.includes("schema cache") ||
      details.includes("does not exist"))
  );
}

async function fetchOfficialAppointmentReviews(
  admin: any,
  args: ListResolvedAppointmentReviewsArgs,
) {
  const appointmentIds = normalizeAppointmentIdList(args.appointmentIds);
  const staffMemberIds = normalizeStaffMemberIdList(args.staffMemberIds);
  let query = admin
    .from("appointment_reviews")
    .select(
      "appointment_id, comment, created_at, customer_id, rating, salon_id, service_id, staff_member_id, updated_at",
    )
    .order("created_at", { ascending: false });

  if (appointmentIds.length) {
    query = query.in("appointment_id", appointmentIds);
  }

  if (args.customerId) {
    query = query.eq("customer_id", args.customerId);
  }

  if (args.salonId) {
    query = query.eq("salon_id", args.salonId);
  }

  if (staffMemberIds.length) {
    query = query.in("staff_member_id", staffMemberIds);
  }

  const { data, error } = await query;

  if (error) {
    if (isMissingAppointmentReviewResourceError(error)) {
      return [] as ResolvedAppointmentReview[];
    }

    throw error;
  }

  return ((data ?? []) as OfficialAppointmentReviewRow[])
    .map((row) => toResolvedOfficialReview(row))
    .filter((row): row is ResolvedAppointmentReview => row !== null);
}

async function fetchFallbackAppointmentReviews(
  admin: any,
  args: ListResolvedAppointmentReviewsArgs,
) {
  const appointmentIds = normalizeAppointmentIdList(args.appointmentIds);
  const staffMemberIds = normalizeStaffMemberIdList(args.staffMemberIds);
  let query = admin
    .from("security_audit_logs")
    .select(
      "actor_user_id, created_at, event_type, metadata, salon_id, target_id, target_type",
    )
    .eq("event_type", FALLBACK_EVENT_TYPE)
    .eq("target_type", FALLBACK_TARGET_TYPE)
    .order("created_at", { ascending: false });

  if (args.salonId) {
    query = query.eq("salon_id", args.salonId);
  }

  if (appointmentIds.length) {
    query = query.in("target_id", appointmentIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as SecurityAuditReviewRow[])
    .map((row) => toResolvedFallbackReview(row))
    .filter((row): row is ResolvedAppointmentReview => row !== null)
    .filter((row) => (args.customerId ? row.customerId === args.customerId : true))
    .filter((row) => (staffMemberIds.length
      ? staffMemberIds.includes(row.staffMemberId)
      : true));
}

function mergeResolvedReviews(reviews: ResolvedAppointmentReview[]) {
  const merged = new Map<string, ResolvedAppointmentReview>();

  for (const review of reviews) {
    merged.set(
      review.appointmentId,
      preferReview(merged.get(review.appointmentId), review),
    );
  }

  return [...merged.values()].sort(
    (left, right) =>
      resolveReviewTimestamp(right) - resolveReviewTimestamp(left),
  );
}

export async function resolveAuthenticatedCustomerContext(
  accessToken: string,
  adminInput?: any,
): Promise<AuthenticatedCustomerContext> {
  const admin = adminInput ?? (createAdminClient() as any);
  const {
    data: { user },
    error: userError,
  } = await admin.auth.getUser(accessToken);

  if (userError || !user) {
    throw new Error("unauthenticated");
  }

  const { data: customer, error: customerError } = await admin
    .from("customers")
    .select("id, salon_id")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (customerError || !customer?.id || !customer.salon_id) {
    throw new Error("unauthenticated");
  }

  return {
    customerId: customer.id,
    salonId: customer.salon_id,
    userId: user.id,
  };
}

export async function listResolvedAppointmentReviews(
  args: ListResolvedAppointmentReviewsArgs,
) {
  const admin = args.admin ?? (createAdminClient() as any);
  const [officialReviews, fallbackReviews] = await Promise.all([
    fetchOfficialAppointmentReviews(admin, args),
    fetchFallbackAppointmentReviews(admin, args),
  ]);

  return mergeResolvedReviews([...fallbackReviews, ...officialReviews]);
}

export async function saveAppointmentReview(args: SaveAppointmentReviewArgs) {
  const admin = args.admin ?? (createAdminClient() as any);
  const context = await resolveAuthenticatedCustomerContext(
    args.accessToken,
    admin,
  );
  const normalizedComment = normalizeComment(args.comment);

  if (!Number.isInteger(args.rating) || args.rating < 1 || args.rating > 5) {
    throw new Error("invalid_review_rating");
  }

  if (normalizedComment && normalizedComment.length > 600) {
    throw new Error("review_comment_too_long");
  }

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("customer_id, id, salon_id, service_id, staff_member_id, status")
    .eq("id", args.appointmentId)
    .maybeSingle();

  if (appointmentError) {
    throw appointmentError;
  }

  const resolvedAppointment = appointment as AppointmentValidationRow | null;

  if (
    !resolvedAppointment?.id ||
    resolvedAppointment.customer_id !== context.customerId ||
    resolvedAppointment.salon_id !== context.salonId ||
    resolvedAppointment.status !== "completed"
  ) {
    throw new Error("appointment_review_not_allowed");
  }

  if (!resolvedAppointment.staff_member_id) {
    throw new Error("appointment_review_staff_required");
  }

  const { data: officialReview, error: officialError } = await admin
    .from("appointment_reviews")
    .upsert(
      {
        appointment_id: resolvedAppointment.id,
        comment: normalizedComment,
        customer_id: context.customerId,
        rating: args.rating,
        salon_id: resolvedAppointment.salon_id,
        service_id: resolvedAppointment.service_id,
        staff_member_id: resolvedAppointment.staff_member_id,
      },
      {
        onConflict: "appointment_id",
      },
    )
    .select(
      "appointment_id, comment, created_at, customer_id, rating, salon_id, service_id, staff_member_id, updated_at",
    )
    .single();

  if (!officialError) {
    const resolved = toResolvedOfficialReview(
      officialReview as OfficialAppointmentReviewRow,
    );

    if (!resolved) {
      throw new Error("appointment_review_persist_failed");
    }

    return resolved;
  }

  if (!isMissingAppointmentReviewResourceError(officialError)) {
    throw officialError;
  }

  const existingFallbackReview = (
    await fetchFallbackAppointmentReviews(admin, {
      appointmentIds: [resolvedAppointment.id],
      customerId: context.customerId,
      salonId: context.salonId,
    })
  )[0];
  const nowIso = new Date().toISOString();
  const createdAt = existingFallbackReview?.createdAt ?? nowIso;
  const updatedAt = nowIso;
  const { error: fallbackError } = await admin
    .from("security_audit_logs")
    .insert({
      actor_user_id: context.userId,
      event_type: FALLBACK_EVENT_TYPE,
      ip_address: args.ipAddress ?? null,
      metadata: {
        appointmentId: resolvedAppointment.id,
        comment: normalizedComment,
        createdAt,
        customerId: context.customerId,
        rating: args.rating,
        salonId: resolvedAppointment.salon_id,
        serviceId: resolvedAppointment.service_id,
        staffMemberId: resolvedAppointment.staff_member_id,
        updatedAt,
      },
      request_path: args.requestPath ?? null,
      salon_id: resolvedAppointment.salon_id,
      severity: "info",
      target_id: resolvedAppointment.id,
      target_type: FALLBACK_TARGET_TYPE,
      user_agent: args.userAgent ?? null,
    });

  if (fallbackError) {
    throw fallbackError;
  }

  return {
    appointmentId: resolvedAppointment.id,
    comment: normalizedComment,
    createdAt,
    customerId: context.customerId,
    rating: args.rating,
    salonId: resolvedAppointment.salon_id,
    serviceId: resolvedAppointment.service_id,
    source: "fallback",
    staffMemberId: resolvedAppointment.staff_member_id,
    updatedAt,
  } satisfies ResolvedAppointmentReview;
}
