import { createClient } from "npm:@supabase/supabase-js@2";
import { SignJWT, importPKCS8 } from "npm:jose@5.10.0";

const vacancyChannelId = "salon_vacancy_alerts";
const updatesChannelId = "salon_updates_v2";
const notificationIcon = "ic_stat_salon_fun";
const pushSendConcurrency = 10;
const maxPushSendAttempts = 3;
const initialPushRetryDelayMs = 400;

type VacancyAlertRow = {
  id: string;
  salon_id: string;
  appointment_id: string;
  headline: string;
  body: string;
  starts_at: string;
};

type CustomerNotificationRow = {
  id: string;
  salon_id: string;
  customer_id: string | null;
  audience: "salon_customers" | "single_customer";
  notification_type: string;
  title: string;
  body: string;
  payload: Record<string, unknown> | null;
};

type SalonBrandingRow = {
  name: string;
  logo_path: string | null;
};

type SalonBranding = {
  salonName: string | null;
  salonLogoUrl: string | null;
};

type PushTokenRow = {
  token: string;
  customer_id: string;
};

type WebhookPayload = {
  dispatch_id?: string;
  alert_id?: string;
  notification_id?: string;
  salon_id?: string;
};

type PushBatchResult = {
  sentCount: number;
  failedCount: number;
  deactivatedCount: number;
};

type SupabaseErrorLike = {
  message: string;
} | null;

type DispatchAttemptStatus =
  | "processing"
  | "delivered"
  | "partially_delivered"
  | "delivery_failed"
  | "skipped";

type NotificationPushPriority = "HIGH" | "NORMAL";

type FcmErrorResponse = {
  error?: {
    status?: string;
    details?: Array<{
      errorCode?: string;
    }>;
  };
};

const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return String(error);
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function maskToken(token: string): string {
  const normalized = token.trim();
  if (normalized.length <= 12) {
    return normalized;
  }

  return `${normalized.slice(0, 8)}...${normalized.slice(-4)}`;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function resolvePushPriority(
  _notification: CustomerNotificationRow,
): NotificationPushPriority {
  return "HIGH";
}

function isRetryablePushStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

async function updatePushDispatchAttempt(args: {
  supabase: ReturnType<typeof createClient> | null;
  dispatchId: string | null;
  status: DispatchAttemptStatus;
  responseStatus?: number;
  responsePayload?: Record<string, unknown>;
  sentCount?: number;
  failedCount?: number;
  deactivatedCount?: number;
  errorDetail?: string;
}): Promise<void> {
  const {
    supabase,
    dispatchId,
    status,
    responseStatus,
    responsePayload,
    sentCount,
    failedCount,
    deactivatedCount,
    errorDetail,
  } = args;

  if (!supabase || !dispatchId) {
    return;
  }

  try {
    await supabase.rpc("update_push_dispatch_attempt", {
      input_dispatch_id: dispatchId,
      status_input: status,
      response_status_input: responseStatus ?? null,
      response_payload_input: responsePayload ?? null,
      sent_count_input: sentCount ?? null,
      failed_count_input: failedCount ?? null,
      deactivated_count_input: deactivatedCount ?? null,
      error_detail_input: errorDetail ?? null,
    });
  } catch (error) {
    console.error(
      `Failed to update push dispatch ${dispatchId}: ${getErrorMessage(error)}`,
    );
  }
}

async function getGoogleAccessToken(
  serviceAccountJson: string,
): Promise<{ accessToken: string; projectId: string }> {
  const serviceAccount = JSON.parse(serviceAccountJson) as {
    client_email?: string;
    private_key?: string;
    project_id?: string;
    token_uri?: string;
  };

  if (
    !serviceAccount.client_email?.trim() ||
    !serviceAccount.private_key?.trim() ||
    !serviceAccount.project_id?.trim()
  ) {
    throw new Error("invalid_service_account_json");
  }

  const tokenUri = serviceAccount.token_uri ?? "https://oauth2.googleapis.com/token";
  const issuedAt = Math.floor(Date.now() / 1000);
  let privateKey: CryptoKey;

  try {
    privateKey = await importPKCS8(serviceAccount.private_key, "RS256") as CryptoKey;
  } catch (error) {
    throw new Error(`invalid_service_account_private_key:${getErrorMessage(error)}`);
  }

  const assertion = await new SignJWT({
    scope: "https://www.googleapis.com/auth/firebase.messaging",
  })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(serviceAccount.client_email)
    .setSubject(serviceAccount.client_email)
    .setAudience(tokenUri)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + 3600)
    .sign(privateKey);

  const response = await fetch(tokenUri, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`google_oauth_failed:${errorBody}`);
  }

  const tokenResponse = (await response.json()) as { access_token: string };
  return {
    accessToken: tokenResponse.access_token,
    projectId: serviceAccount.project_id,
  };
}

function isInvalidTokenError(errorText: string): boolean {
  try {
    const parsed = JSON.parse(errorText) as FcmErrorResponse;
    const errorCodes = new Set<string>();

    const status = parsed.error?.status?.toUpperCase();
    if (status) {
      errorCodes.add(status);
    }

    for (const detail of parsed.error?.details ?? []) {
      const errorCode = detail.errorCode?.toUpperCase();
      if (errorCode) {
        errorCodes.add(errorCode);
      }
    }

    return (
      errorCodes.has("UNREGISTERED") ||
      errorCodes.has("REGISTRATION_TOKEN_NOT_REGISTERED")
    );
  } catch (_) {
    return (
      errorText.includes("UNREGISTERED") ||
      errorText.includes("registration-token-not-registered")
    );
  }
}

function stringifyPayloadValue(value: unknown): string | null {
  if (value == null) {
    return null;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  return JSON.stringify(value);
}

function buildDataPayload(
  base: Record<string, string>,
  payload: Record<string, unknown> | null,
): Record<string, string> {
  const data = { ...base };

  for (const [key, value] of Object.entries(payload ?? {})) {
    const normalized = stringifyPayloadValue(value);
    if (normalized != null) {
      data[key] = normalized;
    }
  }

  return data;
}

async function resolveSalonLogoUrl(args: {
  supabase: ReturnType<typeof createClient> | null;
  salonId: string | null | undefined;
}): Promise<SalonBranding> {
  const salonId = normalizeNonEmptyString(args.salonId);
  if (!salonId || !args.supabase) {
    return {
      salonName: null,
      salonLogoUrl: null,
    };
  }

  const response = await args.supabase
    .from("salons")
    .select("name, logo_path")
    .eq("id", salonId)
    .maybeSingle();
  const salon = response.data as SalonBrandingRow | null;
  const error = response.error as SupabaseErrorLike;

  if (error) {
    console.warn("Failed to load salon logo for push", {
      salonId,
      detail: error.message,
    });
    return {
      salonName: null,
      salonLogoUrl: null,
    };
  }

  const salonName = normalizeNonEmptyString(salon?.name);
  const logoPath = normalizeNonEmptyString(salon?.logo_path);
  return {
    salonName,
    salonLogoUrl: logoPath
      ? args.supabase.storage.from("salon-assets").getPublicUrl(logoPath).data.publicUrl
      : null,
  };
}

function buildDisplayedPushTitle(args: {
  semanticTitle: string;
  salonName: string | null;
  notificationType?: string | null;
}): string {
  const type = normalizeNonEmptyString(args.notificationType)?.toLowerCase() ?? "";

  if (type === "appointment_confirmation_required") {
    return "Confirme sua presença";
  }

  if (type === "appointment_reminder_24h") {
    return "Lembrete do seu horário";
  }

  if (type === "appointment_reminder_3h") {
    return "Faltam 3 horas para o seu horário";
  }

  if (type === "appointment_reminder_1h") {
    return "Seu horário está chegando";
  }

  if (type === "appointment_reminder_15m") {
    return "Seu horário começa em 15 minutos";
  }

  if (type === "appointment_rescheduled") {
    return "Seu horário mudou";
  }

  if (type === "appointment_no_show") {
    return "Seu atendimento foi marcado como falta";
  }

  if (type === "haircut_rebook_reminder" || type === "smart_rebook_prompt") {
    return "Hora de voltar ao salão";
  }

  if (
    type === "loyalty_balance_reminder" ||
    type.includes("loyalty") ||
    type.includes("referral") ||
    type.includes("membership") ||
    type.includes("benefit")
  ) {
    return "Benefício do salão";
  }

  if (type === "service_published" || type === "staff_published") {
    return "Novidade do salão";
  }

  if (
    type === "service_updated" ||
    type === "client_app_updated" ||
    type === "staff_reactivated" ||
    type.includes("updated")
  ) {
    return "Atualização do salão";
  }

  if (type === "vacancy_alert") {
    return "Horário disponível";
  }

  const semanticTitle = normalizeNonEmptyString(args.semanticTitle);
  if (semanticTitle) {
    return uppercaseFirstCharacter(semanticTitle);
  }

  const formattedSalonName = formatSalonPushName(args.salonName);
  return formattedSalonName ?? "Atualização do salão";
}

function buildDisplayedPushBody(args: {
  semanticTitle: string;
  semanticBody: string;
  salonName: string | null;
  notificationType?: string | null;
  payload?: Record<string, unknown> | null;
}): string {
  const semanticTitle = normalizeNonEmptyString(args.semanticTitle);
  const semanticBody = normalizeNonEmptyString(args.semanticBody);
  const formattedSalonName = formatSalonPushName(args.salonName);
  const type = normalizeNonEmptyString(args.notificationType)?.toLowerCase() ?? "";
  const payload = args.payload ?? null;

  const resolvedBody =
    buildTypedPushBody({
      type,
      payload,
      fallbackTitle: semanticTitle,
      fallbackBody: semanticBody,
    }) ??
    semanticBody ??
    semanticTitle ??
    "Abra o app para conferir a atualização.";

  return formattedSalonName
    ? `${formattedSalonName}\n${uppercaseFirstCharacter(resolvedBody)}`
    : uppercaseFirstCharacter(resolvedBody);
}

function buildTypedPushBody(args: {
  type: string;
  payload: Record<string, unknown> | null;
  fallbackTitle: string | null;
  fallbackBody: string | null;
}): string | null {
  const { type, payload, fallbackTitle, fallbackBody } = args;

  const serviceName = formatEntityName(
    normalizeNonEmptyString(payload?.serviceName) ??
      normalizeNonEmptyString(payload?.recommendedServiceName),
  );
  const category = normalizeNonEmptyString(payload?.category);
  const staffName = formatEntityName(
    normalizeNonEmptyString(payload?.staffMemberName),
  );

  if (type === "service_updated" && serviceName) {
    return category
      ? `O serviço ${serviceName} foi atualizado em ${category}. Confira preço, duração e detalhes no app.`
      : `O serviço ${serviceName} foi atualizado. Confira preço, duração e detalhes no app.`;
  }

  if (type === "service_published" && serviceName) {
    return category
      ? `${serviceName} entrou no catálogo de ${category} e já pode ser agendado pelo app.`
      : `${serviceName} entrou no catálogo e já pode ser agendado pelo app.`;
  }

  if (type === "appointment_reminder_1h") {
    return fallbackBody ??
      "Seu atendimento está próximo. Vale sair com calma para chegar no horário.";
  }

  if (type === "appointment_reminder_24h") {
    return fallbackBody ??
      "Seu horário está confirmado. Se precisar ajustar algo, faça isso com antecedência no app.";
  }

  if (type === "appointment_reminder_3h") {
    return fallbackBody ??
      "Seu atendimento se aproxima. Vale se organizar para chegar sem correria.";
  }

  if (type === "appointment_confirmation_required") {
    return fallbackBody ??
      "Seu atendimento está perto. Confirme no app para manter esse horário reservado.";
  }

  if (type === "appointment_reminder_15m") {
    return fallbackBody ??
      "Seu atendimento começa em instantes. Aproveite para se preparar sem pressa.";
  }

  if (type === "haircut_rebook_reminder") {
    return fallbackBody ??
      "Seu retorno já pode ser planejado. Abra o app e reserve o próximo horário.";
  }

  if (type === "appointment_rescheduled") {
    return fallbackBody ??
      "O salão ajustou o seu horário. Abra o app para revisar data, profissional e detalhes.";
  }

  if (type === "appointment_no_show") {
    return fallbackBody ??
      "O salão marcou esse horário como falta. Se precisar revisar, fale com a equipe pelo app.";
  }

  if (type === "staff_published" && staffName) {
    return fallbackBody ??
      `${staffName} já está disponível no app para novos agendamentos.`;
  }

  if (type === "staff_reactivated" && staffName) {
    return fallbackBody ??
      `${staffName} voltou para a agenda do salão. Confira os horários no app.`;
  }

  return fallbackBody ?? fallbackTitle;
}

function formatSalonPushName(salonName: string | null): string | null {
  const normalized = normalizeNonEmptyString(salonName);
  if (!normalized) {
    return null;
  }

  if (normalized === normalized.toLowerCase() || normalized === normalized.toUpperCase()) {
    return normalized
      .split(/\s+/)
      .map((part) => {
        if (!part) {
          return part;
        }

        if (part.length <= 3 && part === part.toUpperCase()) {
          return part;
        }

        return uppercaseFirstCharacter(part.toLowerCase());
      })
      .join(" ");
  }

  return normalized;
}

function formatEntityName(value: string | null): string | null {
  const normalized = normalizeNonEmptyString(value);
  if (!normalized) {
    return null;
  }

  return uppercaseFirstCharacter(normalized);
}

function uppercaseFirstCharacter(value: string): string {
  const normalized = value.trim();
  if (!normalized) {
    return normalized;
  }

  return `${normalized[0]!.toUpperCase()}${normalized.slice(1)}`;
}

async function deactivateInvalidTokens(
  supabase: ReturnType<typeof createClient>,
  tokens: Set<string>,
): Promise<void> {
  if (tokens.size === 0) {
    return;
  }

  await supabase
    .from("customer_push_tokens")
    .update({
      is_active: false,
      updated_at: new Date().toISOString(),
    })
    .in("token", [...tokens]);
}

function dedupePushTokens(tokens: PushTokenRow[]): PushTokenRow[] {
  const uniqueTokens = new Map<string, PushTokenRow>();

  for (const tokenRow of tokens) {
    const normalizedToken = tokenRow.token?.trim();
    if (!normalizedToken) {
      continue;
    }

    if (!uniqueTokens.has(normalizedToken)) {
      uniqueTokens.set(normalizedToken, {
        ...tokenRow,
        token: normalizedToken,
      });
    }
  }

  return [...uniqueTokens.values()];
}

async function sendPushMessage(args: {
  accessToken: string;
  projectId: string;
  token: string;
  title: string;
  body: string;
  channelId: string;
  priority: NotificationPushPriority;
  data: Record<string, string>;
}): Promise<{ ok: true } | { ok: false; invalidToken: boolean }> {
  const { accessToken, projectId, token, title, body, channelId, priority, data } = args;
  const maskedToken = maskToken(token);

  for (let attempt = 1; attempt <= maxPushSendAttempts; attempt += 1) {
    try {
      const response = await fetch(
        `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message: {
              token,
              notification: {
                title,
                body,
              },
              data,
              android: {
                priority,
                notification: {
                  channel_id: channelId,
                  sound: "default",
                  icon: notificationIcon,
                  click_action: "FLUTTER_NOTIFICATION_CLICK",
                  default_vibrate_timings: true,
                },
              },
            },
          }),
        },
      );

      if (response.ok) {
        return { ok: true };
      }

      const errorText = await response.text();
      const retryable = isRetryablePushStatus(response.status);

      if (retryable && attempt < maxPushSendAttempts) {
        console.warn(
          `Push attempt ${attempt}/${maxPushSendAttempts} failed for token ${maskedToken} with status ${response.status}. Retrying.`,
        );
        await delay(initialPushRetryDelayMs * 2 ** (attempt - 1));
        continue;
      }

      console.error(
        `Push failed for token ${maskedToken} with status ${response.status}: ${errorText}`,
      );

      return {
        ok: false,
        invalidToken: isInvalidTokenError(errorText),
      };
    } catch (error) {
      const detail = getErrorMessage(error);

      if (attempt < maxPushSendAttempts) {
        console.warn(
          `Push attempt ${attempt}/${maxPushSendAttempts} errored for token ${maskedToken}: ${detail}. Retrying.`,
        );
        await delay(initialPushRetryDelayMs * 2 ** (attempt - 1));
        continue;
      }

      console.error(`Push errored for token ${maskedToken}: ${detail}`);
      return {
        ok: false,
        invalidToken: false,
      };
    }
  }

  return {
    ok: false,
    invalidToken: false,
  };
}

async function sendPushBatch(args: {
  supabase: ReturnType<typeof createClient>;
  accessToken: string;
  projectId: string;
  tokens: PushTokenRow[];
  title: string;
  body: string;
  channelId: string;
  priority: NotificationPushPriority;
  data: Record<string, string>;
}): Promise<PushBatchResult> {
  const {
    supabase,
    accessToken,
    projectId,
    tokens,
    title,
    body,
    channelId,
    priority,
    data,
  } = args;
  const uniqueTokens = dedupePushTokens(tokens);
  const invalidTokens = new Set<string>();
  let sentCount = 0;
  let failedCount = 0;

  for (let index = 0; index < uniqueTokens.length; index += pushSendConcurrency) {
    const batch = uniqueTokens.slice(index, index + pushSendConcurrency);
    const results = await Promise.all(
      batch.map((tokenRow: PushTokenRow) =>
        sendPushMessage({
          accessToken,
          projectId,
          token: tokenRow.token,
          title,
          body,
          channelId,
          priority,
          data,
        }).then((result) => ({ token: tokenRow.token, result })),
      ),
    );

    for (const { token, result } of results) {
      if (result.ok) {
        sentCount += 1;
        continue;
      }

      failedCount += 1;
      if (result.invalidToken) {
        invalidTokens.add(token);
      }
    }
  }

  await deactivateInvalidTokens(supabase, invalidTokens);

  return {
    sentCount,
    failedCount,
    deactivatedCount: invalidTokens.size,
  };
}

Deno.serve(async (request: Request) => {
  let supabase: ReturnType<typeof createClient> | null = null;
  let dispatchId: string | null = null;

  try {
    if (request.method.toUpperCase() !== "POST") {
      return jsonResponse({
        error: "method_not_allowed",
        method: request.method,
      }, 405);
    }

    const expectedSecret = Deno.env.get("VACANCY_PUSH_WEBHOOK_SECRET");
    const receivedSecret = request.headers.get("x-vacancy-webhook-secret");

    if (!expectedSecret || expectedSecret !== receivedSecret) {
      return jsonResponse({ error: "unauthorized" }, 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_JSON");

    if (supabaseUrl && serviceRoleKey) {
      supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    }

    const payload = (await request.json().catch(() => null)) as WebhookPayload | null;
    dispatchId = payload?.dispatch_id?.trim() ?? null;

    if (!supabaseUrl || !serviceRoleKey || !serviceAccountJson) {
      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: "delivery_failed",
        responseStatus: 500,
        responsePayload: { error: "missing_server_secrets" },
        errorDetail: "missing_server_secrets",
      });
      return jsonResponse({ error: "missing_server_secrets" }, 500);
    }

    if (!payload?.salon_id || (!payload.alert_id && !payload.notification_id)) {
      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: "delivery_failed",
        responseStatus: 400,
        responsePayload: { error: "invalid_payload" },
        errorDetail: "invalid_payload",
      });
      return jsonResponse({ error: "invalid_payload" }, 400);
    }

    await updatePushDispatchAttempt({
      supabase,
      dispatchId,
      status: "processing",
    });

    const { accessToken, projectId } = await getGoogleAccessToken(serviceAccountJson);
    const salonBranding = await resolveSalonLogoUrl({
      supabase,
      salonId: payload.salon_id,
    });
    const salonName = salonBranding.salonName;
    const salonLogoUrl = salonBranding.salonLogoUrl;

    if (payload.alert_id) {
      const alertResponse = await supabase
        .from("salon_vacancy_alerts")
        .select("id, salon_id, appointment_id, headline, body, starts_at")
        .eq("id", payload.alert_id)
        .eq("salon_id", payload.salon_id)
        .maybeSingle();
      const alert = alertResponse.data as VacancyAlertRow | null;
      const alertError = alertResponse.error as SupabaseErrorLike;

      if (alertError) {
        await updatePushDispatchAttempt({
          supabase,
          dispatchId,
          status: "delivery_failed",
          responseStatus: 500,
          responsePayload: {
            error: "alert_lookup_failed",
            detail: alertError.message,
          },
          errorDetail: alertError.message,
        });
        return jsonResponse({ error: "alert_lookup_failed", detail: alertError.message }, 500);
      }

      if (!alert) {
        const responseBody = { ok: true, sent: 0, skipped: "alert_not_found" };
        await updatePushDispatchAttempt({
          supabase,
          dispatchId,
          status: "skipped",
          responseStatus: 200,
          responsePayload: responseBody,
        });
        return jsonResponse(responseBody);
      }

      const appointmentResponse = await supabase
        .from("appointments")
        .select("customer_id")
        .eq("id", alert.appointment_id)
        .maybeSingle();
      const appointment = appointmentResponse.data as { customer_id: string } | null;

      const excludedCustomerId = appointment?.customer_id ?? null;

      const tokensResponse = await supabase
        .from("customer_push_tokens")
        .select("token, customer_id")
        .eq("salon_id", alert.salon_id)
        .eq("is_active", true)
        .returns();
      const tokens = tokensResponse.data as PushTokenRow[] | null;
      const tokensError = tokensResponse.error as SupabaseErrorLike;

      if (tokensError) {
        await updatePushDispatchAttempt({
          supabase,
          dispatchId,
          status: "delivery_failed",
          responseStatus: 500,
          responsePayload: {
            error: "token_lookup_failed",
            detail: tokensError.message,
          },
          errorDetail: tokensError.message,
        });
        return jsonResponse({ error: "token_lookup_failed", detail: tokensError.message }, 500);
      }

      const activeTokens: PushTokenRow[] = (tokens ?? []).filter((tokenRow: PushTokenRow) => {
        if (!tokenRow.token?.trim()) {
          return false;
        }

        return excludedCustomerId == null || tokenRow.customer_id !== excludedCustomerId;
      });

      if (activeTokens.length === 0) {
        const responseBody = { ok: true, sent: 0, skipped: "no_active_tokens" };
        await updatePushDispatchAttempt({
          supabase,
          dispatchId,
          status: "skipped",
          responseStatus: 200,
          responsePayload: responseBody,
        });
        return jsonResponse(responseBody);
      }

      const result = await sendPushBatch({
        supabase,
        accessToken,
        projectId,
        tokens: activeTokens,
        title: buildDisplayedPushTitle({
          semanticTitle: alert.headline,
          salonName,
          notificationType: "vacancy_alert",
        }),
        body: buildDisplayedPushBody({
          semanticTitle: alert.headline,
          semanticBody: alert.body,
          salonName,
          notificationType: "vacancy_alert",
        }),
        channelId: vacancyChannelId,
        priority: "HIGH",
        data: {
          type: "vacancy_alert",
          alertId: alert.id,
          salonId: alert.salon_id,
          startsAt: alert.starts_at,
          ...(salonName ? { salonName } : {}),
          title: alert.headline,
          body: alert.body,
          ...(salonLogoUrl ? { salonLogoUrl } : {}),
        },
      });

      const responseBody = {
        ok: result.failedCount === 0,
        sent: result.sentCount,
        failed: result.failedCount,
        deactivated: result.deactivatedCount,
      };
      const responseStatus = result.sentCount === 0 && result.failedCount > 0
        ? 502
        : 200;
      const dispatchStatus: DispatchAttemptStatus = result.failedCount === 0
        ? "delivered"
        : result.sentCount === 0
        ? "delivery_failed"
        : "partially_delivered";

      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: dispatchStatus,
        responseStatus,
        responsePayload: responseBody,
        sentCount: result.sentCount,
        failedCount: result.failedCount,
        deactivatedCount: result.deactivatedCount,
      });

      return jsonResponse(responseBody, responseStatus);
    }

    const notificationResponse = await supabase
      .from("salon_customer_notifications")
      .select("id, salon_id, customer_id, audience, notification_type, title, body, payload")
      .eq("id", payload.notification_id!)
      .eq("salon_id", payload.salon_id)
      .maybeSingle();
    const notification = notificationResponse.data as CustomerNotificationRow | null;
    const notificationError = notificationResponse.error as SupabaseErrorLike;

    if (notificationError) {
      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: "delivery_failed",
        responseStatus: 500,
        responsePayload: {
          error: "notification_lookup_failed",
          detail: notificationError.message,
        },
        errorDetail: notificationError.message,
      });
      return jsonResponse({
        error: "notification_lookup_failed",
        detail: notificationError.message,
      }, 500);
    }

    if (!notification) {
      const responseBody = { ok: true, sent: 0, skipped: "notification_not_found" };
      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: "skipped",
        responseStatus: 200,
        responsePayload: responseBody,
      });
      return jsonResponse(responseBody);
    }

    let tokensQuery = supabase
      .from("customer_push_tokens")
      .select("token, customer_id")
      .eq("salon_id", notification.salon_id)
      .eq("is_active", true);

    if (notification.audience === "single_customer" && notification.customer_id) {
      tokensQuery = tokensQuery.eq("customer_id", notification.customer_id);
    }

    const tokensResponse = await tokensQuery.returns();
    const tokens = tokensResponse.data as PushTokenRow[] | null;
    const tokensError = tokensResponse.error as SupabaseErrorLike;

    if (tokensError) {
      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: "delivery_failed",
        responseStatus: 500,
        responsePayload: {
          error: "token_lookup_failed",
          detail: tokensError.message,
        },
        errorDetail: tokensError.message,
      });
      return jsonResponse({ error: "token_lookup_failed", detail: tokensError.message }, 500);
    }

    const activeTokens: PushTokenRow[] = (tokens ?? []).filter(
      (tokenRow: PushTokenRow) => Boolean(tokenRow.token?.trim()),
    );

    if (activeTokens.length === 0) {
      const responseBody = { ok: true, sent: 0, skipped: "no_active_tokens" };
      await updatePushDispatchAttempt({
        supabase,
        dispatchId,
        status: "skipped",
        responseStatus: 200,
        responsePayload: responseBody,
      });
      return jsonResponse(responseBody);
    }

    const result = await sendPushBatch({
      supabase,
      accessToken,
      projectId,
      tokens: activeTokens,
      title: buildDisplayedPushTitle({
        semanticTitle: notification.title,
        salonName,
        notificationType: notification.notification_type,
      }),
      body: buildDisplayedPushBody({
        semanticTitle: notification.title,
        semanticBody: notification.body,
        salonName,
        notificationType: notification.notification_type,
        payload: notification.payload,
      }),
      channelId: updatesChannelId,
      priority: resolvePushPriority(notification),
      data: buildDataPayload(
        {
          type: notification.notification_type,
          notificationId: notification.id,
          salonId: notification.salon_id,
          ...(salonName ? { salonName } : {}),
          title: notification.title,
          body: notification.body,
          ...(salonLogoUrl ? { salonLogoUrl } : {}),
        },
        notification.payload,
      ),
    });

    const responseBody = {
      ok: result.failedCount === 0,
      sent: result.sentCount,
      failed: result.failedCount,
      deactivated: result.deactivatedCount,
    };
    const responseStatus = result.sentCount === 0 && result.failedCount > 0
      ? 502
      : 200;
    const dispatchStatus: DispatchAttemptStatus = result.failedCount === 0
      ? "delivered"
      : result.sentCount === 0
      ? "delivery_failed"
      : "partially_delivered";

    await updatePushDispatchAttempt({
      supabase,
      dispatchId,
      status: dispatchStatus,
      responseStatus,
      responsePayload: responseBody,
      sentCount: result.sentCount,
      failedCount: result.failedCount,
      deactivatedCount: result.deactivatedCount,
    });

    return jsonResponse(responseBody, responseStatus);
  } catch (error) {
    const detail = getErrorMessage(error);
    console.error("send-vacancy-push failed", detail);
    await updatePushDispatchAttempt({
      supabase,
      dispatchId,
      status: "delivery_failed",
      responseStatus: 500,
      responsePayload: {
        error: "internal_error",
        detail,
      },
      errorDetail: detail,
    });
    return jsonResponse({ error: "internal_error", detail }, 500);
  }
});
