import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import {
  finalizeAppointmentPlanReservation,
  neutralizeMembershipPlanAppointment,
  resolveAppointmentPlanReservation,
  transferAppointmentPlanReservation,
} from "@/lib/appointmentPlanReservations";
import { resolveAuthenticatedCustomerContext } from "@/lib/appointmentReviews";
import type { Database } from "@/lib/database.types";
import { supabaseAnonKey, supabaseUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient> | any;
type CustomerClient = ReturnType<typeof createSupabaseClient<Database>>;

type CreateConfirmedCustomerAppointmentArgs = {
  accessToken: string;
  admin?: AdminClient | null;
  customerId: string;
  paymentPreference?: string | null;
  preferredStaffMemberId?: string | null;
  requestedDate: string;
  serviceId: string;
};

type CompleteCustomerAppointmentArgs = {
  accessToken: string;
  admin?: AdminClient | null;
  appointmentId: string;
  now?: Date;
};

type RescheduleCustomerAppointmentArgs = {
  accessToken: string;
  admin?: AdminClient | null;
  appointmentId: string;
  preferredStaffMemberId: string;
  requestedDate: string;
  serviceId: string;
};

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

function readString(value: unknown) {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function readJsonRecord(value: unknown) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }

  return null;
}

function isLegacyCreateAppointmentRoutineError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code =
    "code" in error && typeof error.code === "string" ? error.code : "";
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.trim().toLowerCase()
      : "";

  return (
    (code === "PGRST202" ||
      code === "42883" ||
      message.includes("schema cache")) &&
    message.includes("create_appointment")
  );
}

function normalizeCreateAppointmentError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message ?? "")
          .trim()
          .toLowerCase()
      : error instanceof Error
        ? error.message.trim().toLowerCase()
        : String(error ?? "")
            .trim()
            .toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code ?? "").trim()
      : "";

  if (code === "23P01" || message.includes("time_slot_unavailable")) {
    return "time_slot_unavailable";
  }

  if (message.includes("customer_has_active_appointment_on_selected_day")) {
    return "customer_has_active_appointment_on_selected_day";
  }

  if (message.includes("staff_member_not_available_for_service")) {
    return "staff_member_not_available_for_service";
  }

  if (message.includes("salon_closed_on_selected_day")) {
    return "salon_closed_on_selected_day";
  }

  if (message.includes("outside_business_hours")) {
    return "outside_business_hours";
  }

  if (message.includes("slot_step_mismatch")) {
    return "slot_step_mismatch";
  }

  if (message.includes("past_time_not_allowed")) {
    return "past_time_not_allowed";
  }

  if (message.includes("service_not_found")) {
    return "service_not_found";
  }

  if (message.includes("customer_not_linked")) {
    return "customer_not_linked";
  }

  if (message.includes("booking_policy_version_stale")) {
    return "booking_policy_version_stale";
  }

  if (message.includes("invalid_payment_preference")) {
    return "invalid_payment_preference";
  }

  if (message.includes("unauthenticated")) {
    return "unauthenticated";
  }

  return "appointment_create_unavailable";
}

function normalizeCompleteAppointmentError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message ?? "")
          .trim()
          .toLowerCase()
      : error instanceof Error
        ? error.message.trim().toLowerCase()
        : String(error ?? "")
            .trim()
            .toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code ?? "").trim()
      : "";

  if (message.includes("unauthenticated")) {
    return "unauthenticated";
  }

  if (
    message.includes("appointment_not_found") ||
    message.includes("appointment_already_completed") ||
    message.includes("cancelled_appointment_cannot_be_completed") ||
    message.includes("unauthorized")
  ) {
    return "appointment_completion_not_allowed";
  }

  if (message.includes("appointment_not_finished")) {
    return "appointment_completion_too_early";
  }

  if (code === "PGRST116" || code === "PGRST205") {
    return "appointment_completion_not_allowed";
  }

  return "appointment_complete_unavailable";
}

function normalizeRescheduleAppointmentError(error: unknown) {
  const message =
    error && typeof error === "object" && "message" in error
      ? String(error.message ?? "")
          .trim()
          .toLowerCase()
      : error instanceof Error
        ? error.message.trim().toLowerCase()
        : String(error ?? "")
            .trim()
            .toLowerCase();
  const code =
    error && typeof error === "object" && "code" in error
      ? String(error.code ?? "").trim()
      : "";

  if (
    code === "23P01" ||
    message.includes("time_slot_unavailable") ||
    message.includes("appointment_reschedule_time_slot_unavailable")
  ) {
    return "appointment_reschedule_time_slot_unavailable";
  }

  if (message.includes("customer_has_active_appointment_on_selected_day")) {
    return "customer_has_active_appointment_on_selected_day";
  }

  if (
    message.includes("appointment_reschedule_not_allowed") ||
    message.includes("appointment_not_found") ||
    message.includes("unauthorized") ||
    message.includes("appointment_already_cancelled") ||
    message.includes("appointment_already_completed") ||
    message.includes("past_appointment_cannot_be_rescheduled") ||
    message.includes("same_slot_selected")
  ) {
    return "appointment_reschedule_not_allowed";
  }

  if (message.includes("appointment_reschedule_service_mismatch")) {
    return "appointment_reschedule_service_mismatch";
  }

  if (message.includes("membership_plan_staff_locked")) {
    return "membership_plan_staff_locked";
  }

  if (message.includes("membership_plan_outside_period")) {
    return "membership_plan_outside_period";
  }

  if (message.includes("appointment_reschedule_invalid_slot")) {
    return "appointment_reschedule_invalid_slot";
  }

  if (
    message.includes("staff_member_not_available_for_service") ||
    message.includes("salon_closed_on_selected_day") ||
    message.includes("outside_business_hours") ||
    message.includes("slot_step_mismatch") ||
    message.includes("past_time_not_allowed")
  ) {
    return "appointment_reschedule_invalid_slot";
  }

  if (message.includes("service_not_found")) {
    return "service_not_found";
  }

  if (message.includes("unauthenticated")) {
    return "unauthenticated";
  }

  return "appointment_reschedule_unavailable";
}

function formatLocalDateKey(value: Date, timeZone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

function formatTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const entries = formatter.formatToParts(date);
  const partValue = (type: Intl.DateTimeFormatPartTypes) =>
    entries.find((entry) => entry.type === type)?.value ?? "00";

  return {
    day: Number(partValue("day")),
    hour: Number(partValue("hour")),
    minute: Number(partValue("minute")),
    month: Number(partValue("month")),
    second: Number(partValue("second")),
    year: Number(partValue("year")),
  };
}

function getTimeZoneOffset(date: Date, timeZone: string) {
  const parts = formatTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
  );
  return asUtc - date.getTime();
}

function combineDateAndTimeToUtc(
  date: string,
  time: string,
  timeZone: string,
) {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  const utcGuess = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const firstOffset = getTimeZoneOffset(utcGuess, timeZone);
  const corrected = new Date(utcGuess.getTime() - firstOffset);
  const secondOffset = getTimeZoneOffset(corrected, timeZone);

  if (secondOffset !== firstOffset) {
    return new Date(utcGuess.getTime() - secondOffset);
  }

  return corrected;
}

function getUtcRangeForLocalDate(dayKey: string, timeZone: string) {
  const [year, month, day] = dayKey.split("-").map(Number);
  const nextDay = new Date(Date.UTC(year, month - 1, day + 1));
  const nextDayKey = `${nextDay.getUTCFullYear()}-${String(
    nextDay.getUTCMonth() + 1,
  ).padStart(2, "0")}-${String(nextDay.getUTCDate()).padStart(2, "0")}`;

  return {
    end: combineDateAndTimeToUtc(nextDayKey, "00:00", timeZone),
    start: combineDateAndTimeToUtc(dayKey, "00:00", timeZone),
  };
}

function isDateWithinMembershipPlanWindow(args: {
  membershipExpiresAt?: string | null;
  membershipStartedAt?: string | null;
  scheduledAt: Date;
  timeZone: string;
}) {
  const scheduledDayKey = formatLocalDateKey(args.scheduledAt, args.timeZone);
  const startedDayKey = args.membershipStartedAt
    ? formatLocalDateKey(new Date(args.membershipStartedAt), args.timeZone)
    : null;
  const expiresDayKey = args.membershipExpiresAt
    ? formatLocalDateKey(new Date(args.membershipExpiresAt), args.timeZone)
    : null;

  if (startedDayKey && scheduledDayKey < startedDayKey) {
    return false;
  }

  if (expiresDayKey && scheduledDayKey > expiresDayKey) {
    return false;
  }

  return true;
}

async function fetchSalonTimeZone(admin: AdminClient, salonId: string) {
  const result = await admin
    .from("salons")
    .select("timezone")
    .eq("id", salonId)
    .maybeSingle();

  if (result.error) {
    throw result.error;
  }

  return readString(result.data?.timezone) ?? "America/Sao_Paulo";
}

async function resolveRequestedAvailabilitySlot(args: {
  customerClient: CustomerClient;
  preferredStaffMemberId: string;
  requestedDate: string;
  serviceId: string;
  targetDayKey: string;
}) {
  const availabilityResult = await args.customerClient.rpc(
    "get_day_availability",
    {
      service_uuid: args.serviceId,
      target_day: args.targetDayKey,
    },
  );

  if (availabilityResult.error) {
    throw new Error(
      normalizeRescheduleAppointmentError(availabilityResult.error),
    );
  }

  const availability = readJsonRecord(availabilityResult.data);
  const rawSlots = Array.isArray(availability?.available_slots)
    ? availability.available_slots
    : [];
  const normalizedRequestedDate = readString(args.requestedDate);
  const requestedAtIso = normalizedRequestedDate
    ? new Date(normalizedRequestedDate).toISOString()
    : null;

  for (const rawSlot of rawSlots) {
    const slot = readJsonRecord(rawSlot);
    const slotStaffMemberId = readString(slot?.staff_member_id);
    const slotStartAt = readString(slot?.start_at);
    const slotEndsAt = readString(slot?.ends_at);

    if (
      slotStaffMemberId &&
      slotStartAt &&
      slotEndsAt &&
      slotStaffMemberId === args.preferredStaffMemberId &&
      requestedAtIso &&
      new Date(slotStartAt).toISOString() === requestedAtIso
    ) {
      return {
        endsAt: new Date(slotEndsAt).toISOString(),
        staffMemberId: slotStaffMemberId,
        startsAt: new Date(slotStartAt).toISOString(),
      };
    }
  }

  throw new Error("appointment_reschedule_invalid_slot");
}

async function clearAppointmentVacancyAlerts(args: {
  admin: AdminClient;
  appointmentId: string;
  salonId: string;
}) {
  const { error } = await args.admin
    .from("salon_vacancy_alerts")
    .delete()
    .eq("salon_id", args.salonId)
    .eq("appointment_id", args.appointmentId);

  if (error) {
    throw error;
  }
}

async function invokeCreateAppointmentRpc(
  customerClient: CustomerClient,
  args: Omit<CreateConfirmedCustomerAppointmentArgs, "admin" | "customerId">,
) {
  try {
    const result = await customerClient.rpc("create_appointment", {
      payment_preference_input: args.paymentPreference?.trim() || undefined,
      preferred_staff_member_uuid:
        args.preferredStaffMemberId?.trim() || undefined,
      requested_date: args.requestedDate,
      service_uuid: args.serviceId,
    });

    if (result.error) {
      throw result.error;
    }

    return result.data;
  } catch (error) {
    if (!isLegacyCreateAppointmentRoutineError(error)) {
      throw new Error(normalizeCreateAppointmentError(error));
    }

    const legacyResult = await customerClient.rpc("create_appointment", {
      preferred_staff_member_uuid:
        args.preferredStaffMemberId?.trim() || undefined,
      requested_date: args.requestedDate,
      service_uuid: args.serviceId,
    });

    if (legacyResult.error) {
      throw new Error(normalizeCreateAppointmentError(legacyResult.error));
    }

    return legacyResult.data;
  }
}

export async function createConfirmedCustomerAppointment(
  args: CreateConfirmedCustomerAppointmentArgs,
) {
  const admin = args.admin ?? (createAdminClient() as any);
  const customerClient = createCustomerSessionClient(args.accessToken);
  const created = readJsonRecord(
    await invokeCreateAppointmentRpc(customerClient, {
      accessToken: args.accessToken,
      paymentPreference: args.paymentPreference,
      preferredStaffMemberId: args.preferredStaffMemberId,
      requestedDate: args.requestedDate,
      serviceId: args.serviceId,
    }),
  );

  if (!created) {
    throw new Error("appointment_create_unavailable");
  }

  const appointmentId = readString(created.id);
  if (!appointmentId) {
    throw new Error("appointment_create_unavailable");
  }

  const currentStatus = readString(created.status)?.toLowerCase();

  if (currentStatus !== "confirmed") {
    const { error } = await admin
      .from("appointments")
      .update({ status: "confirmed" })
      .eq("id", appointmentId)
      .eq("customer_id", args.customerId);

    if (error) {
      throw new Error("appointment_confirm_promotion_failed");
    }
  }

  return {
    ...created,
    status: "confirmed",
  };
}

export async function completeCustomerAppointment(
  args: CompleteCustomerAppointmentArgs,
) {
  const admin = args.admin ?? (createAdminClient() as any);
  const context = await resolveAuthenticatedCustomerContext(
    args.accessToken,
    admin,
  );
  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select("id, customer_id, salon_id, date, ends_at, status")
    .eq("id", args.appointmentId)
    .eq("customer_id", context.customerId)
    .eq("salon_id", context.salonId)
    .maybeSingle();

  if (appointmentError) {
    throw appointmentError;
  }

  const appointmentId = readString(appointment?.id);
  const appointmentStatus = readString(appointment?.status)?.toLowerCase();
  const endsAtIso =
    readString(appointment?.ends_at) ?? readString(appointment?.date);
  const endedAtMs = endsAtIso
    ? Date.parse(endsAtIso)
    : Number.NaN;

  if (
    !appointmentId ||
    !appointmentStatus ||
    (appointmentStatus !== "pending" && appointmentStatus !== "confirmed")
  ) {
    throw new Error("appointment_completion_not_allowed");
  }

  const completionReleaseAtMs = endedAtMs + 3 * 60 * 1000;
  const now = args.now ?? new Date();
  if (
    !Number.isFinite(endedAtMs) ||
    !Number.isFinite(completionReleaseAtMs) ||
    completionReleaseAtMs > now.getTime()
  ) {
    throw new Error("appointment_completion_too_early");
  }

  const completedAt = now.toISOString();
  const { error: updateError } = await admin
    .from("appointments")
    .update({
      status: "completed",
      completed_at: completedAt,
      cancelled_at: null,
      cancelled_by: null,
      cancellation_reason: null,
    })
    .eq("id", appointmentId)
    .eq("customer_id", context.customerId)
    .eq("salon_id", context.salonId);

  if (updateError) {
    throw new Error(normalizeCompleteAppointmentError(updateError));
  }

  await clearAppointmentVacancyAlerts({
    admin,
    appointmentId,
    salonId: context.salonId,
  });

  const planReservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId,
    customerId: context.customerId,
    salonId: context.salonId,
  });

  if (planReservation) {
    await finalizeAppointmentPlanReservation({
      admin,
      appointmentId,
      ownerSupabase: admin,
      salonId: context.salonId,
    });
  }

  return {
    completedAt,
    id: appointmentId,
    status: "completed" as const,
  };
}

export async function rescheduleCustomerAppointment(
  args: RescheduleCustomerAppointmentArgs,
) {
  const admin = args.admin ?? (createAdminClient() as any);
  const context = await resolveAuthenticatedCustomerContext(
    args.accessToken,
    admin,
  );
  const appointmentId = readString(args.appointmentId);
  const preferredStaffMemberId = readString(args.preferredStaffMemberId);
  const serviceId = readString(args.serviceId);
  const normalizedRequestedDate = readString(args.requestedDate);
  const requestedAt = normalizedRequestedDate
    ? new Date(normalizedRequestedDate)
    : null;

  if (
    !appointmentId ||
    !preferredStaffMemberId ||
    !serviceId ||
    !normalizedRequestedDate ||
    !requestedAt ||
    Number.isNaN(requestedAt.getTime())
  ) {
    throw new Error("appointment_reschedule_invalid_slot");
  }

  const { data: appointment, error: appointmentError } = await admin
    .from("appointments")
    .select(
      "id, customer_id, salon_id, service_id, staff_member_id, date, ends_at, status, payment_preference",
    )
    .eq("id", appointmentId)
    .eq("customer_id", context.customerId)
    .eq("salon_id", context.salonId)
    .maybeSingle();

  if (appointmentError) {
    throw new Error(normalizeRescheduleAppointmentError(appointmentError));
  }

  const appointmentStatus = readString(appointment?.status)?.toLowerCase();
  const currentServiceId = readString(appointment?.service_id);
  const currentStaffMemberId = readString(appointment?.staff_member_id);
  const currentStartsAt = readString(appointment?.date);
  const currentEndsAt = readString(appointment?.ends_at);

  if (
    !readString(appointment?.id) ||
    !appointmentStatus ||
    (appointmentStatus !== "pending" && appointmentStatus !== "confirmed") ||
    !currentServiceId
  ) {
    throw new Error("appointment_reschedule_not_allowed");
  }

  if (serviceId !== currentServiceId) {
    throw new Error("appointment_reschedule_service_mismatch");
  }

  const salonTimeZone = await fetchSalonTimeZone(admin, context.salonId);
  const customerClient = createCustomerSessionClient(args.accessToken);
  const planReservation = await resolveAppointmentPlanReservation({
    admin,
    appointmentId,
    customerId: context.customerId,
    salonId: context.salonId,
  });

  if (
    planReservation &&
    currentStaffMemberId &&
    preferredStaffMemberId !== currentStaffMemberId
  ) {
    throw new Error("membership_plan_staff_locked");
  }

  if (
    planReservation &&
    !isDateWithinMembershipPlanWindow({
      membershipExpiresAt: planReservation.membershipExpiresAt,
      membershipStartedAt: planReservation.membershipStartedAt,
      scheduledAt: requestedAt,
      timeZone: salonTimeZone,
    })
  ) {
    throw new Error("membership_plan_outside_period");
  }

  const normalizedCurrentStartsAt = currentStartsAt
    ? new Date(currentStartsAt).toISOString()
    : null;
  const normalizedRequestedStartsAt = requestedAt.toISOString();
  if (
    normalizedCurrentStartsAt === normalizedRequestedStartsAt &&
    currentStaffMemberId === preferredStaffMemberId
  ) {
    return {
      date: normalizedCurrentStartsAt,
      endsAt: currentEndsAt,
      id: appointmentId,
      staffMemberId: currentStaffMemberId,
      status: appointmentStatus,
    };
  }

  let rescheduled: Record<string, unknown> | null = null;

  try {
    const result = await (customerClient as any).rpc("reschedule_appointment", {
      appointment_uuid: appointmentId,
      booking_policy_version_input: null,
      preferred_staff_member_uuid: preferredStaffMemberId,
      requested_date: normalizedRequestedDate,
    });

    if (result.error) {
      throw result.error;
    }

    rescheduled = readJsonRecord(result.data);
  } catch (error) {
    throw new Error(normalizeRescheduleAppointmentError(error));
  }

  const nextAppointmentId = readString(rescheduled?.id);
  const nextStartsAt = readString(rescheduled?.date);
  const nextEndsAt = readString(rescheduled?.ends_at);
  const nextStaffMemberId = readString(rescheduled?.staff_member_id);
  const nextStatus = readString(rescheduled?.status)?.toLowerCase();

  if (
    !nextAppointmentId ||
    !nextStartsAt ||
    !nextEndsAt ||
    !nextStaffMemberId ||
    !nextStatus
  ) {
    throw new Error("appointment_reschedule_unavailable");
  }

  if (planReservation && nextAppointmentId !== appointmentId) {
    await transferAppointmentPlanReservation({
      admin,
      nextAppointmentId,
      previousAppointmentId: appointmentId,
      salonId: context.salonId,
    });
  } else if (planReservation) {
    await neutralizeMembershipPlanAppointment({
      admin,
      appointmentId,
    });
  }

  return {
    date: nextStartsAt,
    endsAt: nextEndsAt,
    id: nextAppointmentId,
    staffMemberId: nextStaffMemberId,
    status: nextStatus,
  };
}
