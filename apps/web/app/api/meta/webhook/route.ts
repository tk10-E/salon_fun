import { createHmac, timingSafeEqual } from "node:crypto";

import { NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  getMetaAppSecret,
  getWhatsAppVerifyToken,
} from "@/lib/serverEnv";
import {
  sanitizePhone,
  sendSalonWhatsAppTextMessage,
} from "@/lib/whatsapp";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type MetaWebhookPayload = {
  entry?: Array<{
    changes?: Array<{
      field?: string;
      value?: MetaWebhookValue;
    }>;
    id?: string;
  }>;
  object?: string;
};

type MetaWebhookValue = {
  contacts?: Array<{
    profile?: {
      name?: string;
    };
    wa_id?: string;
  }>;
  messages?: MetaIncomingMessage[];
  metadata?: {
    display_phone_number?: string;
    phone_number_id?: string;
  };
  statuses?: MetaStatusUpdate[];
};

type MetaIncomingMessage = {
  button?: {
    payload?: string;
    text?: string;
  };
  context?: {
    from?: string;
    id?: string;
  };
  from?: string;
  id?: string;
  interactive?: {
    button_reply?: {
      id?: string;
      title?: string;
    };
    list_reply?: {
      description?: string;
      id?: string;
      title?: string;
    };
    type?: string;
  };
  text?: {
    body?: string;
  };
  timestamp?: string;
  type?: string;
};

type MetaStatusUpdate = {
  errors?: Array<{
    code?: number;
    message?: string;
    title?: string;
  }>;
  id?: string;
  recipient_id?: string;
  status?: string;
  timestamp?: string;
};

type WhatsAppCustomerContext = {
  appointment_date: string | null;
  appointment_id: string | null;
  appointment_status: string | null;
  customer_confirmation_requested_at: string | null;
  customer_id: string;
  customer_name: string;
  customer_presence_confirmed_at: string | null;
  salon_id: string;
  salon_name: string;
  service_name: string | null;
  staff_member_name: string | null;
};

type InboundIntent =
  | "confirm_appointment"
  | "cancel_appointment"
  | "request_reschedule"
  | "unknown";

const CONFIRM_KEYWORDS = [
  "sim",
  "ok",
  "confirmo",
  "confirmada",
  "confirmado",
  "presenca confirmada",
  "presenca",
  "vou sim",
  "estarei ai",
  "estarei ai sim",
];

const CANCEL_KEYWORDS = [
  "cancelar",
  "cancela",
  "cancelado",
  "desmarcar",
  "desmarca",
  "nao vou",
  "nao vou conseguir",
  "nao consigo ir",
  "não vou",
  "não vou conseguir",
  "não consigo ir",
];

const RESCHEDULE_KEYWORDS = [
  "reagendar",
  "reagenda",
  "remarcar",
  "remarca",
  "outro horario",
  "outro horário",
  "mudar horario",
  "mudar horário",
  "trocar horario",
  "trocar horário",
];

function formatAppointmentLabel(value: string | null) {
  if (!value) {
    return "seu horario";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

function normalizeIntentText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function matchesIntent(
  normalizedText: string,
  keywords: readonly string[],
) {
  return keywords.some((keyword) => {
    const normalizedKeyword = normalizeIntentText(keyword);
    return (
      normalizedText === normalizedKeyword ||
      normalizedText.startsWith(`${normalizedKeyword} `) ||
      normalizedText.includes(` ${normalizedKeyword}`) ||
      normalizedText.includes(normalizedKeyword)
    );
  });
}

function detectInboundIntent(messageBody: string): InboundIntent {
  const normalized = normalizeIntentText(messageBody);

  if (!normalized) {
    return "unknown";
  }

  if (matchesIntent(normalized, CANCEL_KEYWORDS)) {
    return "cancel_appointment";
  }

  if (matchesIntent(normalized, RESCHEDULE_KEYWORDS)) {
    return "request_reschedule";
  }

  if (matchesIntent(normalized, CONFIRM_KEYWORDS)) {
    return "confirm_appointment";
  }

  return "unknown";
}

function extractMessageBody(message: MetaIncomingMessage) {
  if (message.type === "text") {
    return message.text?.body?.trim() ?? "";
  }

  if (message.type === "button") {
    return message.button?.text?.trim() || message.button?.payload?.trim() || "";
  }

  if (message.type === "interactive") {
    const buttonReply = message.interactive?.button_reply;
    if (buttonReply?.title?.trim()) {
      return buttonReply.title.trim();
    }

    if (buttonReply?.id?.trim()) {
      return buttonReply.id.trim();
    }

    const listReply = message.interactive?.list_reply;
    if (listReply?.title?.trim()) {
      return listReply.title.trim();
    }

    if (listReply?.description?.trim()) {
      return listReply.description.trim();
    }

    if (listReply?.id?.trim()) {
      return listReply.id.trim();
    }
  }

  return "";
}

function verifyMetaSignature(rawBody: string, signatureHeader: string | null) {
  const appSecret = getMetaAppSecret();

  if (!appSecret) {
    return true;
  }

  if (!signatureHeader?.startsWith("sha256=")) {
    return false;
  }

  const expectedSignature = createHmac("sha256", appSecret)
    .update(rawBody)
    .digest("hex");
  const receivedSignature = signatureHeader.slice("sha256=".length);
  const expectedBuffer = Buffer.from(expectedSignature, "utf8");
  const receivedBuffer = Buffer.from(receivedSignature, "utf8");

  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
}

async function resolveCustomerContext(
  fromPhone: string,
  phoneNumberId?: string | null,
) {
  const admin = createAdminClient();
  const phoneDigits = sanitizePhone(fromPhone);

  if (!phoneDigits) {
    return null;
  }

  let scopedSalonId: string | null = null;

  if (phoneNumberId?.trim()) {
    const { data: salonRow } = await admin
      .from("salons")
      .select("id")
      .eq("whatsapp_dispatch_enabled", true)
      .eq("whatsapp_meta_phone_number_id", phoneNumberId.trim())
      .maybeSingle();

    scopedSalonId = salonRow?.id ?? null;
  }

  const result = scopedSalonId
    ? await admin.rpc("find_whatsapp_customer_context_for_salon", {
        phone_input: phoneDigits,
        salon_id_input: scopedSalonId,
      })
    : await admin.rpc("find_whatsapp_customer_context", {
        phone_input: phoneDigits,
      });

  if (result.error) {
    console.error("meta-webhook context lookup failed", result.error.message);
    return null;
  }

  const rows = (result.data ?? []) as WhatsAppCustomerContext[];
  return rows[0] ?? null;
}

async function persistInboundMessage(params: {
  appointmentId?: string | null;
  context: WhatsAppCustomerContext | null;
  fromPhone: string;
  handledAction: string | null;
  interpretedIntent: InboundIntent;
  message: MetaIncomingMessage;
  messageBody: string;
  profileName: string | null;
  rawPayload: MetaWebhookPayload;
  resolvedSalonId?: string | null;
}) {
  const {
    appointmentId = null,
    context,
    fromPhone,
    handledAction,
    interpretedIntent,
    message,
    messageBody,
    profileName,
    rawPayload,
    resolvedSalonId = null,
  } = params;
  const admin = createAdminClient();

  if (!message.id) {
    return;
  }

  await admin.from("whatsapp_inbound_messages").upsert(
    {
      appointment_id: appointmentId ?? context?.appointment_id ?? null,
      customer_id: context?.customer_id ?? null,
      from_phone: sanitizePhone(fromPhone) ?? fromPhone,
      handled_action: handledAction,
      interpreted_intent: interpretedIntent,
      message_body: messageBody || null,
      message_id: message.id,
      message_type: message.type ?? "unknown",
      payload: rawPayload,
      profile_name: profileName,
      salon_id: context?.salon_id ?? resolvedSalonId,
    },
    {
      onConflict: "message_id",
      ignoreDuplicates: false,
    },
  );
}

async function updateNotificationDeliveryStatus(status: MetaStatusUpdate) {
  if (!status.id) {
    return;
  }

  const admin = createAdminClient();
  const statusAt = status.timestamp
    ? new Date(Number(status.timestamp) * 1000).toISOString()
    : new Date().toISOString();
  const normalizedStatus = status.status?.trim() || "unknown";
  const errorDetail = status.errors?.[0]
    ? `${status.errors[0].title ?? "erro"}${status.errors[0].message ? `: ${status.errors[0].message}` : ""}`
    : null;

  await admin
    .from("salon_customer_notifications")
    .update({
      whatsapp_delivered_at:
        normalizedStatus === "delivered" ? statusAt : undefined,
      whatsapp_delivery_status: normalizedStatus,
      whatsapp_error: errorDetail,
      whatsapp_read_at: normalizedStatus === "read" ? statusAt : undefined,
      whatsapp_status_at: statusAt,
    })
    .eq("whatsapp_message_id", status.id);
}

function buildConfirmationReply(context: WhatsAppCustomerContext) {
  const serviceName = context.service_name?.trim() || "atendimento";
  const staffName = context.staff_member_name?.trim();
  const appointmentLabel = formatAppointmentLabel(context.appointment_date);

  return staffName
    ? `Perfeito, ${context.customer_name.split(" ")[0]}! Sua presença para ${serviceName} em ${appointmentLabel} com ${staffName} já ficou confirmada.`
    : `Perfeito, ${context.customer_name.split(" ")[0]}! Sua presença para ${serviceName} em ${appointmentLabel} já ficou confirmada.`;
}

function buildCancellationReply(context: WhatsAppCustomerContext) {
  const appointmentLabel = formatAppointmentLabel(context.appointment_date);
  return `Tudo certo. Cancelamos seu horario de ${appointmentLabel}. Quando quiser, responda REMARCAR que a equipe organiza um novo encaixe.`;
}

function buildRescheduleReply(context: WhatsAppCustomerContext | null) {
  if (!context?.appointment_id) {
    return "Recebemos seu pedido para remarcar. A equipe vai continuar com voce por aqui.";
  }

  return `Recebemos seu pedido para remarcar ${formatAppointmentLabel(context.appointment_date)}. A equipe do ${context.salon_name} vai te mandar novas opcoes por aqui.`;
}

function buildMissingContextReply(intent: InboundIntent) {
  if (intent === "confirm_appointment") {
    return "Recebemos sua confirmacao. Se for sobre um horario do salao, a equipe vai validar e continuar por aqui.";
  }

  if (intent === "cancel_appointment") {
    return "Recebemos seu pedido de cancelamento. A equipe vai conferir o horario certo e responder por aqui.";
  }

  return "Recebemos seu pedido para remarcar. A equipe vai continuar com voce por aqui.";
}

function buildFallbackReply(context: WhatsAppCustomerContext | null) {
  if (!context?.appointment_id) {
    return "Recebemos sua mensagem. Se quiser ajuda rapida, responda SIM, REMARCAR ou CANCELAR.";
  }

  return `Recebemos sua mensagem sobre ${formatAppointmentLabel(context.appointment_date)}. Responda SIM para confirmar, REMARCAR para trocar o horario ou CANCELAR para desistir.`;
}

async function handleIncomingIntent(params: {
  context: WhatsAppCustomerContext | null;
  intent: InboundIntent;
  messageBody: string;
}) {
  const { context, intent, messageBody } = params;
  const admin = createAdminClient();
  const nowIso = new Date().toISOString();

  if (!context?.appointment_id) {
    return {
      handledAction:
        intent === "unknown" ? "no_context_help_sent" : "no_context_detected",
      replyBody:
        intent === "unknown"
          ? buildFallbackReply(context)
          : buildMissingContextReply(intent),
    };
  }

  if (intent === "confirm_appointment") {
    if (context.appointment_status !== "confirmed") {
      return {
        handledAction: "appointment_not_ready_for_confirmation",
        replyBody:
          "Recebi sua confirmacao, mas esse horario ainda esta em ajuste pelo salao. A equipe te confirma por aqui em instantes.",
      };
    }

    if (context.customer_presence_confirmed_at) {
      return {
        handledAction: "appointment_already_confirmed",
        replyBody:
          "Sua presenca ja estava confirmada por aqui. Qualquer mudanca, responda REMARCAR ou CANCELAR.",
      };
    }

    const updateResult = await admin
      .from("appointments")
      .update({
        customer_confirmation_requested_at:
          context.customer_confirmation_requested_at ?? nowIso,
        customer_presence_confirmed_at: nowIso,
      })
      .eq("id", context.appointment_id)
      .eq("salon_id", context.salon_id);

    if (updateResult.error) {
      console.error(
        "meta-webhook confirm update failed",
        updateResult.error.message,
      );
      return {
        handledAction: "appointment_confirmation_failed",
        replyBody:
          "Recebemos sua confirmacao, mas nao conseguimos refletir isso no sistema agora. A equipe foi avisada.",
      };
    }

    return {
      handledAction: "appointment_confirmed",
      replyBody: buildConfirmationReply(context),
    };
  }

  if (intent === "cancel_appointment") {
    if (
      context.appointment_status === "cancelled" ||
      context.appointment_status === "completed"
    ) {
      return {
        handledAction: "appointment_already_closed",
        replyBody:
          "Esse horario ja nao esta mais ativo por aqui. Se quiser, podemos abrir um novo encaixe para voce.",
      };
    }

    const updateResult = await admin
      .from("appointments")
      .update({
        cancelled_at: nowIso,
        cancelled_by: "customer",
        cancellation_reason:
          messageBody.trim() || "Cancelado via WhatsApp pela cliente.",
        completed_at: null,
        customer_presence_confirmed_at: null,
        status: "cancelled",
      })
      .eq("id", context.appointment_id)
      .eq("salon_id", context.salon_id);

    if (updateResult.error) {
      console.error(
        "meta-webhook cancel update failed",
        updateResult.error.message,
      );
      return {
        handledAction: "appointment_cancellation_failed",
        replyBody:
          "Recebemos seu pedido de cancelamento, mas a equipe precisa finalizar isso manualmente. Vamos seguir por aqui.",
      };
    }

    return {
      handledAction: "appointment_cancelled",
      replyBody: buildCancellationReply(context),
    };
  }

  if (intent === "request_reschedule") {
    return {
      handledAction: "appointment_reschedule_requested",
      replyBody: buildRescheduleReply(context),
    };
  }

  return {
    handledAction: "inbound_help_sent",
    replyBody: buildFallbackReply(context),
  };
}

async function processIncomingMessage(params: {
  payload: MetaWebhookPayload;
  phoneNumberId?: string | null;
  profileName: string | null;
  message: MetaIncomingMessage;
}) {
  const { payload, phoneNumberId, profileName, message } = params;
  const fromPhone = sanitizePhone(message.from ?? null);

  if (!message.id || !fromPhone) {
    return;
  }

  const context = await resolveCustomerContext(fromPhone, phoneNumberId);
  const resolvedSalonId = context?.salon_id ?? null;
  const messageBody = extractMessageBody(message);

  if (!messageBody && message.type !== "text") {
    await persistInboundMessage({
      context,
      fromPhone,
      handledAction: "unsupported_message_type",
      interpretedIntent: "unknown",
      message,
      messageBody,
      profileName,
      rawPayload: payload,
      resolvedSalonId,
    });
    return;
  }

  const intent = detectInboundIntent(messageBody);
  const { handledAction, replyBody } = await handleIncomingIntent({
    context,
    intent,
    messageBody,
  });

  await persistInboundMessage({
    context,
    fromPhone,
    handledAction,
    interpretedIntent: intent,
      message,
      messageBody,
      profileName,
      rawPayload: payload,
      resolvedSalonId,
    });

  if (replyBody) {
    const sendResult = await sendSalonWhatsAppTextMessage(
      resolvedSalonId,
      fromPhone,
      replyBody,
    );

    if (!sendResult.ok) {
      console.error("meta-webhook reply failed", {
        reason: sendResult.reason,
        detail: sendResult.detail,
        messageId: message.id,
      });
    }
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = getWhatsAppVerifyToken();

  if (mode === "subscribe" && token && verifyToken && token === verifyToken) {
    return new Response(challenge ?? "", {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  return NextResponse.json({ error: "invalid_verify_token" }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-hub-signature-256");

  if (!verifyMetaSignature(rawBody, signature)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let payload: MetaWebhookPayload = {};

  try {
    payload = JSON.parse(rawBody) as MetaWebhookPayload;
  } catch (error) {
    console.error("meta-webhook parse error", error);
    return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  }

  try {
    for (const entry of payload.entry ?? []) {
      for (const change of entry.changes ?? []) {
        if (change.field !== "messages") {
          continue;
        }

        const value = change.value ?? {};
        const profileName =
          value.contacts?.[0]?.profile?.name?.trim() || null;
        const phoneNumberId = value.metadata?.phone_number_id?.trim() || null;

        for (const status of value.statuses ?? []) {
          await updateNotificationDeliveryStatus(status);
        }

        for (const message of value.messages ?? []) {
          await processIncomingMessage({
            payload,
            phoneNumberId,
            profileName,
            message,
          });
        }
      }
    }
  } catch (error) {
    console.error("meta-webhook processing error", error);
  }

  return NextResponse.json({ received: true });
}
