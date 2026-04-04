import { createClient } from "npm:@supabase/supabase-js@2";

type ManagedChargeRequest = {
  appointment_id?: unknown;
  force_refresh?: unknown;
};

type CustomerRow = {
  id: string;
  salon_id: string;
  name: string;
  phone: string | null;
  asaas_customer_id: string | null;
};

type SalonRow = {
  id: string;
  name: string;
  timezone: string | null;
  booking_policy_payment_mode: string | null;
  booking_policy_asaas_environment: string | null;
  booking_policy_asaas_api_key: string | null;
  booking_policy_asaas_webhook_token: string | null;
};

type AppointmentRow = {
  id: string;
  salon_id: string;
  customer_id: string;
  date: string;
  status: string;
  deposit_amount: number | null;
  deposit_status: string | null;
  deposit_paid_at: string | null;
  deposit_payment_provider: string | null;
  deposit_payment_provider_charge_id: string | null;
  deposit_payment_provider_status: string | null;
  deposit_payment_provider_payload: string | null;
  deposit_payment_provider_invoice_url: string | null;
};

type AsaasCustomerResponse = {
  id?: string;
};

type AsaasPaymentResponse = {
  id?: string;
  status?: string;
  invoiceUrl?: string | null;
  externalReference?: string | null;
  clientPaymentDate?: string | null;
  paymentDate?: string | null;
  confirmedDate?: string | null;
};

type AsaasPixQrCodeResponse = {
  payload?: string | null;
  encodedImage?: string | null;
  expirationDate?: string | null;
};

const corsAllowedHeaders =
  "authorization, x-client-info, apikey, content-type";

function corsHeaders(request: Request): HeadersInit {
  const origin = request.headers.get("origin")?.trim();

  return {
    "Access-Control-Allow-Origin": origin && origin.length > 0 ? origin : "*",
    "Access-Control-Allow-Headers": corsAllowedHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

function jsonResponse(
  request: Request,
  body: Record<string, unknown>,
  status = 200,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...corsHeaders(request),
    },
  });
}

function normalizeString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function normalizeDigits(value: string | null) {
  if (value == null) {
    return null;
  }

  const digits = value.replace(/\D+/g, "");
  return digits.length >= 10 ? digits : null;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.trim();
  }

  return String(error);
}

function asaasBaseUrl(environment: string | null) {
  return environment === "production"
    ? "https://api.asaas.com/v3"
    : "https://api-sandbox.asaas.com/v3";
}

function extractAsaasError(payload: unknown) {
  if (payload && typeof payload === "object") {
    const payloadRecord = payload as Record<string, unknown>;
    const errors = Array.isArray(payloadRecord.errors)
      ? payloadRecord.errors
      : [];

    for (const entry of errors) {
      if (entry && typeof entry === "object") {
        const description = normalizeString(
          (entry as Record<string, unknown>).description,
        );

        if (description) {
          return description;
        }
      }
    }

    const message = normalizeString(payloadRecord.message);
    if (message) {
      return message;
    }

    const error = normalizeString(payloadRecord.error);
    if (error) {
      return error;
    }
  }

  return null;
}

async function parseAsaasResponse(response: Response) {
  const rawBody = await response.text();
  const parsed = rawBody.length > 0 ? JSON.parse(rawBody) : null;

  if (!response.ok) {
    const detail =
      extractAsaasError(parsed) ?? (rawBody || response.statusText);
    throw new Error(`asaas_request_failed:${response.status}:${detail}`);
  }

  return parsed;
}

async function asaasRequest<T>({
  apiKey,
  environment,
  path,
  method = "GET",
  body,
}: {
  apiKey: string;
  environment: string | null;
  path: string;
  method?: string;
  body?: Record<string, unknown>;
}): Promise<T> {
  const response = await fetch(`${asaasBaseUrl(environment)}${path}`, {
    method,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      access_token: apiKey,
    },
    body: body == null ? undefined : JSON.stringify(body),
  });

  return await parseAsaasResponse(response) as T;
}

function formatDateInTimezone(dateIso: string, timezone: string | null) {
  const date = new Date(dateIso);
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone && timezone.trim().length > 0
      ? timezone
      : "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

  return formatter.format(date);
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

function buildAppointmentProviderUpdate(params: {
  appointment: AppointmentRow;
  payment: AsaasPaymentResponse;
  pixQrCode: AsaasPixQrCodeResponse | null;
}) {
  const { appointment, payment, pixQrCode } = params;
  const providerStatus = normalizeString(payment.status);
  const nextDepositStatus = resolveLocalDepositStatus(
    providerStatus,
    appointment.deposit_status,
  );
  const paidAt = toIsoTimestamp(
    payment.clientPaymentDate ?? payment.paymentDate ?? payment.confirmedDate,
  );

  return {
    deposit_payment_provider: "asaas",
    deposit_payment_provider_charge_id:
      normalizeString(payment.id) ?? appointment.deposit_payment_provider_charge_id,
    deposit_payment_provider_status:
      providerStatus ?? appointment.deposit_payment_provider_status,
    deposit_payment_provider_payload:
      normalizeString(pixQrCode?.payload) ??
      appointment.deposit_payment_provider_payload,
    deposit_payment_provider_invoice_url:
      normalizeString(payment.invoiceUrl) ??
      appointment.deposit_payment_provider_invoice_url,
    deposit_payment_provider_last_synced_at: new Date().toISOString(),
    deposit_payment_provider_error: null,
    deposit_status: nextDepositStatus,
    deposit_paid_at: nextDepositStatus === "received"
      ? paidAt ?? appointment.deposit_paid_at ?? new Date().toISOString()
      : nextDepositStatus === "refunded"
      ? appointment.deposit_paid_at
      : appointment.deposit_paid_at,
  };
}

async function syncAppointmentCharge(params: {
  supabase: ReturnType<typeof createClient>;
  appointment: AppointmentRow;
  salon: SalonRow;
  payment: AsaasPaymentResponse;
  fetchPixQrCode: boolean;
}) {
  const { supabase, appointment, salon, payment, fetchPixQrCode } = params;
  const apiKey = normalizeString(salon.booking_policy_asaas_api_key);
  const paymentId = normalizeString(payment.id);

  if (!apiKey || !paymentId) {
    throw new Error("missing_asaas_api_key");
  }

  const pixQrCode = fetchPixQrCode
    ? await asaasRequest<AsaasPixQrCodeResponse>({
      apiKey,
      environment: salon.booking_policy_asaas_environment,
      path: `/payments/${encodeURIComponent(paymentId)}/pixQrCode`,
    }).catch((error) => {
      throw new Error(`asaas_pix_qr_failed:${getErrorMessage(error)}`);
    })
    : null;

  const update = buildAppointmentProviderUpdate({
    appointment,
    payment,
    pixQrCode,
  });

  const { data, error } = await supabase
    .from("appointments")
    .update(update)
    .eq("id", appointment.id)
    .eq("salon_id", appointment.salon_id)
    .select(
      "id, deposit_status, deposit_paid_at, deposit_payment_provider, deposit_payment_provider_charge_id, deposit_payment_provider_status, deposit_payment_provider_payload, deposit_payment_provider_invoice_url, deposit_payment_provider_last_synced_at, deposit_payment_provider_error",
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(error?.message ?? "appointment_sync_failed");
  }

  return {
    appointment_id: appointment.id,
    deposit_status: data.deposit_status,
    deposit_paid_at: data.deposit_paid_at,
    provider: {
      name: data.deposit_payment_provider,
      charge_id: data.deposit_payment_provider_charge_id,
      status: data.deposit_payment_provider_status,
      payload: data.deposit_payment_provider_payload,
      invoice_url: data.deposit_payment_provider_invoice_url,
      last_synced_at: data.deposit_payment_provider_last_synced_at,
      error: data.deposit_payment_provider_error,
    },
  };
}

async function createAsaasCustomer(params: {
  apiKey: string;
  environment: string | null;
  customer: CustomerRow;
}) {
  const { apiKey, environment, customer } = params;
  const phone = normalizeDigits(customer.phone);
  const payload: Record<string, unknown> = {
    name: customer.name,
    externalReference: customer.id,
    notificationDisabled: true,
  };

  if (phone) {
    payload.mobilePhone = phone;
  }

  return await asaasRequest<AsaasCustomerResponse>({
    apiKey,
    environment,
    path: "/customers",
    method: "POST",
    body: payload,
  });
}

async function ensureAsaasCustomerId(params: {
  supabase: ReturnType<typeof createClient>;
  salon: SalonRow;
  customer: CustomerRow;
}) {
  const { supabase, salon, customer } = params;
  const apiKey = normalizeString(salon.booking_policy_asaas_api_key);

  if (!apiKey) {
    throw new Error("missing_asaas_api_key");
  }

  if (customer.asaas_customer_id) {
    return customer.asaas_customer_id;
  }

  const createdCustomer = await createAsaasCustomer({
    apiKey,
    environment: salon.booking_policy_asaas_environment,
    customer,
  }).catch((error) => {
    throw new Error(`asaas_customer_create_failed:${getErrorMessage(error)}`);
  });
  const asaasCustomerId = normalizeString(createdCustomer.id);

  if (!asaasCustomerId) {
    throw new Error("asaas_customer_missing_id");
  }

  const { error } = await supabase
    .from("customers")
    .update({
      asaas_customer_id: asaasCustomerId,
      asaas_customer_synced_at: new Date().toISOString(),
    })
    .eq("id", customer.id)
    .eq("salon_id", customer.salon_id);

  if (error) {
    throw new Error(error.message);
  }

  return asaasCustomerId;
}

async function createAsaasPayment(params: {
  supabase: ReturnType<typeof createClient>;
  salon: SalonRow;
  customer: CustomerRow;
  appointment: AppointmentRow;
}) {
  const { supabase, salon, customer, appointment } = params;
  const apiKey = normalizeString(salon.booking_policy_asaas_api_key);

  if (!apiKey) {
    throw new Error("missing_asaas_api_key");
  }

  const dueDate = formatDateInTimezone(appointment.date, salon.timezone);
  const asaasCustomerId = await ensureAsaasCustomerId({
    supabase,
    salon,
    customer,
  });

  try {
    return await asaasRequest<AsaasPaymentResponse>({
      apiKey,
      environment: salon.booking_policy_asaas_environment,
      path: "/payments",
      method: "POST",
      body: {
        customer: asaasCustomerId,
        billingType: "PIX",
        value: Number(appointment.deposit_amount ?? 0),
        dueDate,
        description: `Sinal ${salon.name}`,
        externalReference: appointment.id,
      },
    });
  } catch (error) {
    const detail = getErrorMessage(error).toLowerCase();

    if (
      !detail.includes("customer") ||
      !detail.includes("not") ||
      !detail.includes("found")
    ) {
      throw error;
    }

    const recreatedCustomer = await createAsaasCustomer({
      apiKey,
      environment: salon.booking_policy_asaas_environment,
      customer,
    }).catch((recreateError) => {
      throw new Error(
        `asaas_customer_recreate_failed:${getErrorMessage(recreateError)}`,
      );
    });
    const recreatedCustomerId = normalizeString(recreatedCustomer.id);

    if (!recreatedCustomerId) {
      throw new Error("asaas_customer_missing_id");
    }

    const { error: updateError } = await supabase
      .from("customers")
      .update({
        asaas_customer_id: recreatedCustomerId,
        asaas_customer_synced_at: new Date().toISOString(),
      })
      .eq("id", customer.id)
      .eq("salon_id", customer.salon_id);

    if (updateError) {
      throw new Error(updateError.message);
    }

    return await asaasRequest<AsaasPaymentResponse>({
      apiKey,
      environment: salon.booking_policy_asaas_environment,
      path: "/payments",
      method: "POST",
      body: {
        customer: recreatedCustomerId,
        billingType: "PIX",
        value: Number(appointment.deposit_amount ?? 0),
        dueDate,
        description: `Sinal ${salon.name}`,
        externalReference: appointment.id,
      },
    });
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders(request) });
  }

  if (request.method !== "POST") {
    return jsonResponse(request, { error: "method_not_allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();
  const anonKey =
    Deno.env.get("SUPABASE_ANON_KEY")?.trim() ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY")?.trim();
  const authorization = request.headers.get("authorization")?.trim();

  if (!supabaseUrl || !serviceRoleKey || !anonKey) {
    return jsonResponse(request, { error: "missing_server_secrets" }, 500);
  }

  if (!authorization) {
    return jsonResponse(request, { error: "missing_authorization" }, 401);
  }

  const authClient = createClient(supabaseUrl, anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authorization } },
  });
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const {
    data: { user },
    error: userError,
  } = await authClient.auth.getUser();

  if (userError || !user) {
    return jsonResponse(request, { error: "unauthenticated" }, 401);
  }

  const payload = await request.json().catch(() => null) as ManagedChargeRequest | null;
  const appointmentId = normalizeString(payload?.appointment_id);
  const forceRefresh = payload?.force_refresh === true;

  if (!appointmentId) {
    return jsonResponse(request, { error: "appointment_id_required" }, 400);
  }

  const { data: customer, error: customerError } = await supabase
    .from("customers")
    .select("id, salon_id, name, phone, asaas_customer_id")
    .eq("auth_user_id", user.id)
    .maybeSingle<CustomerRow>();

  if (customerError || !customer) {
    return jsonResponse(request, { error: "customer_not_found" }, 404);
  }

  const { data: appointment, error: appointmentError } = await supabase
    .from("appointments")
    .select(
      "id, salon_id, customer_id, date, status, deposit_amount, deposit_status, deposit_paid_at, deposit_payment_provider, deposit_payment_provider_charge_id, deposit_payment_provider_status, deposit_payment_provider_payload, deposit_payment_provider_invoice_url",
    )
    .eq("id", appointmentId)
    .eq("customer_id", customer.id)
    .maybeSingle<AppointmentRow>();

  if (appointmentError || !appointment) {
    return jsonResponse(request, { error: "appointment_not_found" }, 404);
  }

  if (appointment.salon_id !== customer.salon_id) {
    return jsonResponse(request, { error: "unauthorized" }, 403);
  }

  if (appointment.status !== "pending" && appointment.status !== "confirmed") {
    return jsonResponse(
      request,
      { error: "appointment_not_collectable" },
      409,
    );
  }

  if (Number(appointment.deposit_amount ?? 0) <= 0) {
    return jsonResponse(request, { error: "deposit_not_required" }, 409);
  }

  if (
    appointment.deposit_status !== "pending" &&
    !appointment.deposit_payment_provider_charge_id
  ) {
    return jsonResponse(request, { error: "deposit_not_pending" }, 409);
  }

  const { data: salon, error: salonError } = await supabase
    .from("salons")
    .select(
      "id, name, timezone, booking_policy_payment_mode, booking_policy_asaas_environment, booking_policy_asaas_api_key, booking_policy_asaas_webhook_token",
    )
    .eq("id", appointment.salon_id)
    .maybeSingle<SalonRow>();

  if (salonError || !salon) {
    return jsonResponse(request, { error: "salon_not_found" }, 404);
  }

  if (salon.booking_policy_payment_mode !== "asaas_pix") {
    return jsonResponse(request, { error: "managed_pix_not_enabled" }, 409);
  }

  if (!normalizeString(salon.booking_policy_asaas_api_key)) {
    return jsonResponse(request, { error: "missing_asaas_api_key" }, 409);
  }

  if (!normalizeString(salon.booking_policy_asaas_webhook_token)) {
    return jsonResponse(request, { error: "missing_asaas_webhook_token" }, 409);
  }

  try {
    if (
      appointment.deposit_payment_provider === "asaas" &&
      appointment.deposit_payment_provider_charge_id
    ) {
      const existingPayment = await asaasRequest<AsaasPaymentResponse>({
        apiKey: salon.booking_policy_asaas_api_key!,
        environment: salon.booking_policy_asaas_environment,
        path: `/payments/${encodeURIComponent(appointment.deposit_payment_provider_charge_id)}`,
      }).catch((error) => {
        const message = getErrorMessage(error);
        if (message.includes(":404:")) {
          return null;
        }

        throw error;
      });

      if (existingPayment != null) {
        const response = await syncAppointmentCharge({
          supabase,
          appointment,
          salon,
          payment: existingPayment,
          fetchPixQrCode:
            forceRefresh || appointment.deposit_status !== "received",
        });

        return jsonResponse(request, { ok: true, ...response });
      }
    }

    const payment = await createAsaasPayment({
      supabase,
      salon,
      customer,
      appointment,
    }).catch(async (error) => {
      const detail = getErrorMessage(error);
      await supabase
        .from("appointments")
        .update({
          deposit_payment_provider: "asaas",
          deposit_payment_provider_error: detail.slice(0, 500),
          deposit_payment_provider_last_synced_at: new Date().toISOString(),
        })
        .eq("id", appointment.id)
        .eq("salon_id", appointment.salon_id);

      throw error;
    });

    const response = await syncAppointmentCharge({
      supabase,
      appointment,
      salon,
      payment,
      fetchPixQrCode: true,
    });

    return jsonResponse(request, { ok: true, ...response });
  } catch (error) {
    return jsonResponse(request, {
      error: "managed_charge_sync_failed",
      detail: getErrorMessage(error),
    }, 500);
  }
});
