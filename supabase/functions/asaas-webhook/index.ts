import { createClient } from "npm:@supabase/supabase-js@2";

type SalonRow = {
  id: string;
};

type AppointmentRow = {
  id: string;
  salon_id: string;
  deposit_status: string | null;
  deposit_paid_at: string | null;
  deposit_payment_provider_payload: string | null;
  deposit_payment_provider_invoice_url: string | null;
};

type WebhookEventRow = {
  processing_status: string;
};

type AsaasWebhookPayload = {
  id?: unknown;
  event?: unknown;
  payment?: {
    id?: unknown;
    status?: unknown;
    externalReference?: unknown;
    invoiceUrl?: unknown;
    clientPaymentDate?: unknown;
    paymentDate?: unknown;
    confirmedDate?: unknown;
  };
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return String(error);
}

function toIsoTimestamp(value: unknown): string | null {
  const normalized = normalizeString(value);
  if (!normalized) {
    return null;
  }

  if (normalized.includes("T")) {
    const parsed = new Date(normalized);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return `${normalized}T12:00:00.000Z`;
  }

  const parsed = new Date(normalized.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function resolveLocalDepositStatus(
  providerStatus: string | null,
  currentStatus: string | null,
) {
  switch ((providerStatus ?? "").toUpperCase()) {
    case "CONFIRMED":
    case "RECEIVED":
      return "received";
    case "REFUNDED":
      return "refunded";
    default:
      return currentStatus === "received" ||
          currentStatus === "refunded" ||
          currentStatus === "waived"
        ? currentStatus
        : "pending";
  }
}

async function markWebhookEvent(params: {
  supabase: ReturnType<typeof createClient>;
  eventId: string;
  appointmentId?: string | null;
  processingStatus: "processed" | "ignored" | "failed";
  errorDetail?: string | null;
}) {
  const { supabase, eventId, appointmentId, processingStatus, errorDetail } = params;

  await supabase
    .from("asaas_webhook_events")
    .update({
      appointment_id: appointmentId ?? null,
      processing_status: processingStatus,
      error_detail: errorDetail ?? null,
      processed_at: new Date().toISOString(),
    })
    .eq("event_id", eventId);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_server_secrets" }, 500);
  }

  const accessToken = normalizeString(
    request.headers.get("asaas-access-token"),
  );

  if (!accessToken) {
    return jsonResponse({ error: "missing_asaas_access_token" }, 401);
  }

  const rawBody = await request.text();
  let payload: AsaasWebhookPayload;

  try {
    payload = JSON.parse(rawBody) as AsaasWebhookPayload;
  } catch {
    return jsonResponse({ error: "invalid_json_body" }, 400);
  }

  const eventId =
    normalizeString(payload.id) ??
    `${normalizeString(payload.event) ?? "asaas"}:${normalizeString(payload.payment?.id) ?? "unknown"}`;
  const eventType = normalizeString(payload.event) ?? "PAYMENT_UPDATED";
  const providerChargeId = normalizeString(payload.payment?.id);
  const appointmentExternalReference = normalizeString(
    payload.payment?.externalReference,
  );
  const providerStatus = normalizeString(payload.payment?.status);
  const providerInvoiceUrl = normalizeString(payload.payment?.invoiceUrl);

  if (!providerChargeId) {
    return jsonResponse({ error: "missing_payment_id" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: salon, error: salonError } = await supabase
    .from("salons")
    .select("id")
    .eq("booking_policy_asaas_webhook_token", accessToken)
    .maybeSingle<SalonRow>();

  if (salonError || !salon) {
    return jsonResponse({ error: "invalid_webhook_token" }, 401);
  }

  const { data: existingEvent } = await supabase
    .from("asaas_webhook_events")
    .select("processing_status")
    .eq("event_id", eventId)
    .maybeSingle<WebhookEventRow>();

  if (
    existingEvent?.processing_status === "processed" ||
    existingEvent?.processing_status === "ignored"
  ) {
    return jsonResponse({ ok: true, duplicate: true });
  }

  await supabase.from("asaas_webhook_events").upsert({
    event_id: eventId,
    salon_id: salon.id,
    event_type: eventType,
    payload,
    processing_status: "received",
    error_detail: null,
    processed_at: null,
  }, {
    onConflict: "event_id",
  });

  const selectAppointmentFields =
    "id, salon_id, deposit_status, deposit_paid_at, deposit_payment_provider_payload, deposit_payment_provider_invoice_url";

  const appointmentByReference = appointmentExternalReference
    ? await supabase
      .from("appointments")
      .select(selectAppointmentFields)
      .eq("salon_id", salon.id)
      .eq("id", appointmentExternalReference)
      .maybeSingle<AppointmentRow>()
    : null;

  const appointmentQuery = appointmentByReference?.data
    ? appointmentByReference
    : await supabase
      .from("appointments")
      .select(selectAppointmentFields)
      .eq("salon_id", salon.id)
      .eq("deposit_payment_provider_charge_id", providerChargeId)
      .maybeSingle<AppointmentRow>();

  if (appointmentQuery.error || !appointmentQuery.data) {
    await markWebhookEvent({
      supabase,
      eventId,
      processingStatus: "ignored",
      errorDetail: appointmentQuery.error?.message ?? "appointment_not_found",
    });
    return jsonResponse({ ok: true, ignored: "appointment_not_found" });
  }

  const appointment = appointmentQuery.data;
  const nextDepositStatus = resolveLocalDepositStatus(
    providerStatus,
    appointment.deposit_status,
  );

  try {
    const { error } = await supabase
      .from("appointments")
      .update({
        deposit_payment_provider: "asaas",
        deposit_payment_provider_charge_id: providerChargeId,
        deposit_payment_provider_status: providerStatus,
        deposit_payment_provider_invoice_url:
          providerInvoiceUrl ?? appointment.deposit_payment_provider_invoice_url,
        deposit_payment_provider_payload:
          appointment.deposit_payment_provider_payload,
        deposit_payment_provider_last_synced_at: new Date().toISOString(),
        deposit_payment_provider_error: null,
        deposit_status: nextDepositStatus,
        deposit_paid_at: nextDepositStatus === "received"
          ? toIsoTimestamp(
            payload.payment?.clientPaymentDate ??
              payload.payment?.paymentDate ??
              payload.payment?.confirmedDate,
          ) ?? appointment.deposit_paid_at ?? new Date().toISOString()
          : appointment.deposit_paid_at,
      })
      .eq("id", appointment.id)
      .eq("salon_id", salon.id);

    if (error) {
      throw new Error(error.message);
    }

    await markWebhookEvent({
      supabase,
      eventId,
      appointmentId: appointment.id,
      processingStatus: "processed",
    });

    return jsonResponse({
      ok: true,
      appointment_id: appointment.id,
      provider_status: providerStatus,
      deposit_status: nextDepositStatus,
    });
  } catch (error) {
    await markWebhookEvent({
      supabase,
      eventId,
      appointmentId: appointment.id,
      processingStatus: "failed",
      errorDetail: getErrorMessage(error).slice(0, 500),
    });

    return jsonResponse({
      error: "asaas_webhook_processing_failed",
      detail: getErrorMessage(error),
    }, 500);
  }
});
