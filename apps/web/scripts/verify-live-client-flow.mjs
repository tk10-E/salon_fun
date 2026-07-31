import crypto from "node:crypto";
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

function assertValue(value, message) {
  if (!value) {
    throw new Error(message);
  }

  return value;
}

function createAdminClient(env) {
  return createClient(
    assertValue(env.NEXT_PUBLIC_SUPABASE_URL?.trim(), "Missing Supabase URL."),
    assertValue(
      env.SUPABASE_SERVICE_ROLE_KEY?.trim(),
      "Missing service role key.",
    ),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

function createPublicClient(env) {
  return createClient(
    assertValue(env.NEXT_PUBLIC_SUPABASE_URL?.trim(), "Missing Supabase URL."),
    assertValue(
      env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
        env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim(),
      "Missing public Supabase key.",
    ),
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}

function formatDateKey(date, timeZone) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatError(error) {
  if (!error) {
    return "Unknown error";
  }

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

function buildHeaders(accessToken) {
  return {
    authorization: `Bearer ${accessToken}`,
    "content-type": "application/json",
  };
}

function normalizeIso(value) {
  if (typeof value !== "string" || !value.trim()) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

async function expectJson(response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Invalid JSON response (${response.status}): ${text}`);
  }
}

async function apiPost(url, accessToken, body) {
  const response = await fetch(url, {
    method: "POST",
    headers: buildHeaders(accessToken),
    body: JSON.stringify(body),
  });
  const payload = await expectJson(response);

  if (!response.ok || payload.ok === false) {
    throw new Error(
      `HTTP ${response.status} on ${url}: ${payload.error ?? "unknown_error"}`,
    );
  }

  return payload;
}

async function apiGet(url, accessToken) {
  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${accessToken}`,
    },
  });
  const payload = await expectJson(response);

  if (!response.ok || payload.ok === false) {
    throw new Error(
      `HTTP ${response.status} on ${url}: ${payload.error ?? "unknown_error"}`,
    );
  }

  return payload;
}

async function waitForAppointmentDate(admin, appointmentId, expectedIso) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const result = await admin
      .from("appointments")
      .select("id, salon_id, customer_id, service_id, staff_member_id, date, status")
      .eq("id", appointmentId)
      .maybeSingle();

    if (!result.error && normalizeIso(result.data?.date) === expectedIso) {
      return result.data;
    }

    await new Promise((resolve) => setTimeout(resolve, 400));
  }

  return null;
}

async function fetchStudioBarberContext(admin, joinCode) {
  const { data: salon, error: salonError } = await admin
    .from("salons")
    .select("id, name, join_code, timezone")
    .eq("join_code", joinCode)
    .maybeSingle();

  if (salonError || !salon) {
    throw new Error(`Salon ${joinCode} unavailable: ${formatError(salonError)}`);
  }

  const { data: services, error: servicesError } = await admin
    .from("services")
    .select("id, name, price, duration")
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .order("price");

  if (servicesError || !(services ?? []).length) {
    throw new Error(
      `No active services for ${joinCode}: ${formatError(servicesError)}`,
    );
  }

  const { data: staffMembers, error: staffError } = await admin
    .from("staff_members")
    .select("id, name")
    .eq("salon_id", salon.id)
    .eq("is_active", true)
    .order("name");

  if (staffError || !(staffMembers ?? []).length) {
    throw new Error(
      `No active staff for ${joinCode}: ${formatError(staffError)}`,
    );
  }

  const service = services.find((entry) => entry.name === "corte masculino") ?? services[0];
  const staff =
    staffMembers.find((entry) => entry.name === "Equipe principal") ??
    staffMembers[0];

  return {
    joinCode,
    salon,
    service,
    staff,
  };
}

async function findAvailableSlot({
  publicClient,
  preferredStaffMemberId,
  serviceId,
  startOffsetDays = 1,
  timeZone,
}) {
  for (let offset = startOffsetDays; offset < startOffsetDays + 30; offset += 1) {
    const targetDay = addDays(new Date(), offset);
    const dayKey = formatDateKey(targetDay, timeZone);
    const { data, error } = await publicClient.rpc("get_day_availability", {
      service_uuid: serviceId,
      target_day: dayKey,
    });

    if (error) {
      throw new Error(
        `Availability failed for ${dayKey}: ${formatError(error)}`,
      );
    }

    const slots = Array.isArray(data?.available_slots) ? data.available_slots : [];
    const matchingSlot = slots.find(
      (slot) =>
        typeof slot?.staff_member_id === "string" &&
        slot.staff_member_id === preferredStaffMemberId &&
        typeof slot?.start_at === "string" &&
        typeof slot?.ends_at === "string",
    );

    if (matchingSlot) {
      return {
        dayKey,
        endsAt: matchingSlot.ends_at,
        staffMemberId: matchingSlot.staff_member_id,
        startsAt: matchingSlot.start_at,
      };
    }
  }

  throw new Error("No availability found for smoke test.");
}

async function createTemporaryCustomer(admin, publicClient, salon, suffix) {
  const email = `smoke.${suffix}@salonfun.local`;
  const password = `Smoke!${suffix.slice(0, 10)}aA1`;
  const phone = `55${String(Date.now()).slice(-11)}`;
  const name = `Smoke ${suffix.slice(0, 6)}`;

  const createdUser = await admin.auth.admin.createUser({
    email,
    email_confirm: true,
    password,
  });

  if (createdUser.error || !createdUser.data.user) {
    throw new Error(`Auth user create failed: ${formatError(createdUser.error)}`);
  }

  const authUserId = createdUser.data.user.id;
  const insertedCustomer = await admin.from("customers").insert({
    auth_user_id: authUserId,
    consent_status: "not_required",
    email,
    name,
    phone,
    salon_id: salon.id,
  }).select("id, salon_id, auth_user_id, email, name, phone").maybeSingle();

  if (insertedCustomer.error || !insertedCustomer.data) {
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(
      `Customer row create failed: ${formatError(insertedCustomer.error)}`,
    );
  }

  const signInResult = await publicClient.auth.signInWithPassword({
    email,
    password,
  });

  if (signInResult.error || !signInResult.data.session?.access_token) {
    await admin.from("customers").delete().eq("id", insertedCustomer.data.id);
    await admin.auth.admin.deleteUser(authUserId);
    throw new Error(`Customer sign-in failed: ${formatError(signInResult.error)}`);
  }

  return {
    accessToken: signInResult.data.session.access_token,
    authUserId,
    customer: insertedCustomer.data,
    email,
  };
}

async function cleanupTemporaryArtifacts({
  admin,
  appointmentIds,
  authUserId,
  customerId,
  membershipId,
}) {
  const uniqueAppointmentIds = [...new Set(appointmentIds.filter(Boolean))];

  if (uniqueAppointmentIds.length) {
    await admin.from("appointment_payments").delete().in("appointment_id", uniqueAppointmentIds);
    await admin
      .from("customer_membership_redemptions")
      .delete()
      .in("appointment_id", uniqueAppointmentIds);
    await admin
      .from("salon_customer_notifications")
      .delete()
      .in("appointment_id", uniqueAppointmentIds);
    await admin
      .from("salon_vacancy_alerts")
      .delete()
      .in("appointment_id", uniqueAppointmentIds);
    await admin.from("appointments").delete().in("id", uniqueAppointmentIds);
  }

  if (membershipId) {
    await admin
      .from("customer_membership_redemptions")
      .delete()
      .eq("membership_id", membershipId);
    await admin.from("customer_memberships").delete().eq("id", membershipId);
  }

  if (customerId) {
    await admin
      .from("salon_customer_notifications")
      .delete()
      .eq("customer_id", customerId);
    await admin.from("customers").delete().eq("id", customerId);
  }

  if (authUserId) {
    await admin.auth.admin.deleteUser(authUserId);
  }
}

async function main() {
  const env = readEnv();
  const joinCode = env.SMOKE_SALON_JOIN_CODE?.trim() || "D1E438";
  const baseUrl = assertValue(env.APP_URL?.trim(), "Missing APP_URL.");
  const admin = createAdminClient(env);
  const publicClient = createPublicClient(env);
  const suffix = crypto.randomUUID().replace(/-/g, "");
  const appointmentIds = [];
  let authUserId = null;
  let customerId = null;
  let membershipId = null;

  const results = {
    joinCode,
    created: {},
    steps: {},
  };

  try {
    const context = await fetchStudioBarberContext(admin, joinCode);
    const tempCustomer = await createTemporaryCustomer(
      admin,
      publicClient,
      context.salon,
      suffix,
    );
    authUserId = tempCustomer.authUserId;
    customerId = tempCustomer.customer.id;

    results.created.customer = tempCustomer.customer;
    results.created.service = context.service;
    results.created.staff = context.staff;

    const firstSlot = await findAvailableSlot({
      preferredStaffMemberId: context.staff.id,
      publicClient,
      serviceId: context.service.id,
      startOffsetDays: 1,
      timeZone: context.salon.timezone || "America/Sao_Paulo",
    });

    const createPayload = await apiPost(
      `${baseUrl}/api/public/customer-appointments`,
      tempCustomer.accessToken,
      {
        paymentPreference: "pix",
        preferredStaffMemberId: firstSlot.staffMemberId,
        requestedDate: firstSlot.startsAt,
        serviceId: context.service.id,
      },
    );
    const createdAppointment = createPayload.appointment;
    appointmentIds.push(createdAppointment.id);

    const appointmentAfterCreate = await admin
      .from("appointments")
      .select("id, salon_id, customer_id, service_id, staff_member_id, date, status, payment_preference")
      .eq("id", createdAppointment.id)
      .maybeSingle();

    if (
      appointmentAfterCreate.error ||
      appointmentAfterCreate.data?.status !== "confirmed" ||
      appointmentAfterCreate.data?.salon_id !== context.salon.id ||
      appointmentAfterCreate.data?.customer_id !== tempCustomer.customer.id
    ) {
      throw new Error("Normal appointment was not persisted correctly.");
    }

    results.steps.createAppointment = appointmentAfterCreate.data;

    const rescheduleSlot = await findAvailableSlot({
      preferredStaffMemberId: context.staff.id,
      publicClient,
      serviceId: context.service.id,
      startOffsetDays: 2,
      timeZone: context.salon.timezone || "America/Sao_Paulo",
    });

    const reschedulePayload = await apiPost(
      `${baseUrl}/api/public/customer-appointments/reschedule`,
      tempCustomer.accessToken,
      {
        appointmentId: createdAppointment.id,
        preferredStaffMemberId: rescheduleSlot.staffMemberId,
        requestedDate: rescheduleSlot.startsAt,
        serviceId: context.service.id,
      },
    );

    const expectedRescheduledIso = normalizeIso(reschedulePayload.appointment?.date);
    const appointmentAfterReschedule = await waitForAppointmentDate(
      admin,
      createdAppointment.id,
      expectedRescheduledIso,
    );

    if (!appointmentAfterReschedule || !expectedRescheduledIso) {
      throw new Error("Rescheduled appointment did not persist.");
    }

    results.steps.rescheduleAppointment = appointmentAfterReschedule;

    const cancelResult = await publicClient.rpc("cancel_appointment", {
      appointment_uuid: createdAppointment.id,
      cancellation_reason_input: "smoke_test_customer_cancel",
    });

    if (cancelResult.error) {
      throw new Error(`Cancel RPC failed: ${formatError(cancelResult.error)}`);
    }

    const appointmentAfterCancel = await admin
      .from("appointments")
      .select("id, status, cancelled_by, cancellation_reason")
      .eq("id", createdAppointment.id)
      .maybeSingle();

    if (
      appointmentAfterCancel.error ||
      appointmentAfterCancel.data?.status !== "cancelled" ||
      appointmentAfterCancel.data?.cancelled_by !== "customer"
    ) {
      throw new Error("Customer cancellation did not persist.");
    }

    results.steps.cancelAppointment = appointmentAfterCancel.data;

    const completeSlot = await findAvailableSlot({
      preferredStaffMemberId: context.staff.id,
      publicClient,
      serviceId: context.service.id,
      startOffsetDays: 3,
      timeZone: context.salon.timezone || "America/Sao_Paulo",
    });

    const completeCreatePayload = await apiPost(
      `${baseUrl}/api/public/customer-appointments`,
      tempCustomer.accessToken,
      {
        paymentPreference: "pix",
        preferredStaffMemberId: completeSlot.staffMemberId,
        requestedDate: completeSlot.startsAt,
        serviceId: context.service.id,
      },
    );
    const completeAppointmentId = completeCreatePayload.appointment.id;
    appointmentIds.push(completeAppointmentId);

    const pastStartAt = new Date(Date.now() - 10 * 60 * 1000);
    const pastEndsAt = new Date(Date.now() - 5 * 60 * 1000);
    const pastMutation = await admin
      .from("appointments")
      .update({
        date: pastStartAt.toISOString(),
        ends_at: pastEndsAt.toISOString(),
        status: "confirmed",
      })
      .eq("id", completeAppointmentId);

    if (pastMutation.error) {
      throw new Error(`Past mutation failed: ${formatError(pastMutation.error)}`);
    }

    const completePayload = await apiPost(
      `${baseUrl}/api/public/customer-appointments/status`,
      tempCustomer.accessToken,
      { appointmentId: completeAppointmentId },
    );

    const appointmentAfterComplete = await admin
      .from("appointments")
      .select("id, status, completed_at")
      .eq("id", completeAppointmentId)
      .maybeSingle();

    if (
      appointmentAfterComplete.error ||
      appointmentAfterComplete.data?.status !== "completed" ||
      !appointmentAfterComplete.data?.completed_at
    ) {
      throw new Error("Customer completion did not persist.");
    }

    results.steps.completeAppointment = {
      api: completePayload.appointment,
      db: appointmentAfterComplete.data,
    };

    const planSlot = await findAvailableSlot({
      preferredStaffMemberId: context.staff.id,
      publicClient,
      serviceId: context.service.id,
      startOffsetDays: 7,
      timeZone: context.salon.timezone || "America/Sao_Paulo",
    });

    const planStartDate = planSlot.startsAt.slice(0, 10);
    const planExpiresDate = addDays(new Date(`${planStartDate}T12:00:00Z`), 28)
      .toISOString()
      .slice(0, 10);

    const insertedMembership = await admin
      .from("customer_memberships")
      .insert({
        customer_id: tempCustomer.customer.id,
        expires_at: planExpiresDate,
        notes: "smoke test membership",
        offer_id: "b3e41cb3-421f-43e1-b663-65cdab55072c",
        price_snapshot: 149,
        salon_id: context.salon.id,
        service_id: context.service.id,
        service_name_snapshot: context.service.name,
        sessions_included: 3,
        sessions_used: 0,
        started_at: planStartDate,
        status: "active",
        title: "Smoke Plan",
      })
      .select("id, started_at, expires_at, sessions_included, sessions_used, status")
      .maybeSingle();

    if (insertedMembership.error || !insertedMembership.data) {
      throw new Error(
        `Temporary membership create failed: ${formatError(insertedMembership.error)}`,
      );
    }

    membershipId = insertedMembership.data.id;

    const planSchedulePayload = await apiPost(
      `${baseUrl}/api/public/appointment-plan-reservations`,
      tempCustomer.accessToken,
      {
        action: "schedule_membership_plan",
        membershipId,
        preferredStaffMemberId: context.staff.id,
        preferredStartAt: planSlot.startsAt,
        serviceId: context.service.id,
      },
    );

    const planResult = planSchedulePayload.result;
    const createdPlanAppointments = Array.isArray(planResult.createdAppointments)
      ? planResult.createdAppointments
      : [];

    appointmentIds.push(...createdPlanAppointments.map((entry) => entry.appointmentId));

    if (planResult.scheduledCount < 1 || !createdPlanAppointments.length) {
      throw new Error("Membership plan did not create appointments.");
    }

    const planAppointmentsInDb = await admin
      .from("appointments")
      .select("id, salon_id, customer_id, service_id, staff_member_id, status, date")
      .in(
        "id",
        createdPlanAppointments.map((entry) => entry.appointmentId),
      );

    if (
      planAppointmentsInDb.error ||
      (planAppointmentsInDb.data ?? []).length !== createdPlanAppointments.length
    ) {
      throw new Error("Plan appointments were not persisted correctly.");
    }

    const planReservationsPayload = await apiGet(
      `${baseUrl}/api/public/appointment-plan-reservations?appointment_ids=${createdPlanAppointments
        .map((entry) => entry.appointmentId)
        .join(",")}`,
      tempCustomer.accessToken,
    );

    const reservations = Array.isArray(planReservationsPayload.reservations)
      ? planReservationsPayload.reservations
      : [];

    if (!reservations.length) {
      throw new Error("Plan reservations were not readable from public API.");
    }

    const cancelPlanPayload = await apiPost(
      `${baseUrl}/api/public/appointment-plan-reservations`,
      tempCustomer.accessToken,
      {
        action: "cancel_membership_plan_appointment",
        appointmentId: createdPlanAppointments[0].appointmentId,
        cancellationReason: "smoke_test_plan_cancel",
      },
    );

    const canceledPlanAppointment = await admin
      .from("appointments")
      .select("id, status, cancelled_by, cancellation_reason")
      .eq("id", createdPlanAppointments[0].appointmentId)
      .maybeSingle();
    const membershipAfterPlanCancel = await admin
      .from("customer_memberships")
      .select("id, sessions_used")
      .eq("id", membershipId)
      .maybeSingle();

    if (
      canceledPlanAppointment.error ||
      canceledPlanAppointment.data?.status !== "cancelled" ||
      membershipAfterPlanCancel.error ||
      membershipAfterPlanCancel.data?.sessions_used !== 0
    ) {
      throw new Error("Plan cancellation did not preserve membership integrity.");
    }

    const monthWindowStart = `${planStartDate.slice(0, 7)}-01T00:00:00.000Z`;
    const monthWindowEnd = `${planStartDate.slice(0, 7)}-31T23:59:59.999Z`;
    const panelMonthAppointments = await admin
      .from("appointments")
      .select("id, status, customer_id, staff_member_id, date")
      .eq("salon_id", context.salon.id)
      .eq("customer_id", tempCustomer.customer.id)
      .gte("date", monthWindowStart)
      .lte("date", monthWindowEnd);

    results.steps.membershipPlan = {
      cancelApi: cancelPlanPayload.result ?? null,
      dbAppointments: planAppointmentsInDb.data,
      membershipAfterCancel: membershipAfterPlanCancel.data,
      panelMonthAppointmentsCount: (panelMonthAppointments.data ?? []).length,
      publicReservations: reservations,
      scheduleResult: planResult,
    };

    console.log(JSON.stringify({ ok: true, results }, null, 2));
  } finally {
    await cleanupTemporaryArtifacts({
      admin,
      appointmentIds,
      authUserId,
      customerId,
      membershipId,
    });
  }
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: formatError(error) }, null, 2));
  process.exitCode = 1;
});
