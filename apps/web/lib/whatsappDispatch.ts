import {
  sanitizePhone,
  sendSalonWhatsAppTextMessage,
  type WhatsAppSendResult,
} from "@/lib/whatsapp";

export const AUTO_PILOT_NOTIFICATION_TYPES = [
  "appointment_reminder_1h",
  "appointment_confirmation_required",
  "winback_offer",
  "smart_rebook_prompt",
  "birthday_campaign",
  "manual_reactivation",
] as const;

type NotificationCustomerRelation =
  | {
      name: string | null;
      phone: string | null;
      whatsapp_phone?: string | null;
    }
  | {
      name: string | null;
      phone: string | null;
      whatsapp_phone?: string | null;
    }[]
  | null;

type PendingNotificationRecord = {
  body: string;
  created_at: string;
  customer_id: string | null;
  customers: NotificationCustomerRelation;
  id: string;
  notification_type: string;
  salon_id: string;
  title: string;
};

type DispatchFailureReason =
  | "pending_lookup_failed"
  | "missing_config"
  | "request_failed";

export type PendingWhatsAppDispatchSummary =
  | {
      ok: true;
      failed: number;
      missingConfigSalons: string[];
      missingPhone: number;
      processed: number;
      sent: number;
    }
  | {
      ok: false;
      error: string;
      reason: DispatchFailureReason;
    };

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildNotificationWhatsAppBody(notification: PendingNotificationRecord) {
  const title = notification.title.trim();
  const body = notification.body.trim();

  if (!title) {
    return body;
  }

  if (!body || title === body) {
    return title;
  }

  return `${title}\n${body}`;
}

function describeDispatchFailure(result: Extract<WhatsAppSendResult, { ok: false }>) {
  if (result.reason === "missing_config") {
    return "missing_config";
  }

  return result.detail ?? "request_failed";
}

export async function dispatchPendingWhatsAppNotifications(options?: {
  limit?: number;
  salonId?: string | null;
}) {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const runAt = new Date().toISOString();
  const limit = Math.max(1, Math.min(options?.limit ?? 25, 250));

  let query = admin
    .from("salon_customer_notifications")
    .select(
      "id, salon_id, title, body, notification_type, customer_id, created_at, customers(name, phone)",
    )
    .not("customer_id", "is", null)
    .is("whatsapp_sent_at", null)
    .in("notification_type", [...AUTO_PILOT_NOTIFICATION_TYPES])
    .order("created_at", { ascending: true })
    .limit(limit);

  if (options?.salonId) {
    query = query.eq("salon_id", options.salonId);
  }

  const { data, error } = await query;

  if (error) {
    return {
      ok: false as const,
      error: error.message,
      reason: "pending_lookup_failed" as const,
    };
  }

  const notifications = (data ?? []) as PendingNotificationRecord[];
  let sent = 0;
  let missingPhone = 0;
  let failed = 0;
  const missingConfigSalons = new Set<string>();

  for (const notification of notifications) {
    const customer = firstRelation(notification.customers);
    const sanitizedPhone = sanitizePhone(
      customer?.whatsapp_phone ?? customer?.phone ?? null,
    );

    if (!sanitizedPhone) {
      missingPhone += 1;
      await admin
        .from("salon_customer_notifications")
        .update({
          whatsapp_error: "missing_phone",
        })
        .eq("id", notification.id)
        .eq("salon_id", notification.salon_id);
      continue;
    }

    const sendResult = await sendSalonWhatsAppTextMessage(
      notification.salon_id,
      sanitizedPhone,
      buildNotificationWhatsAppBody(notification),
    );

    if (!sendResult.ok) {
      failed += 1;

      if (sendResult.reason === "missing_config") {
        missingConfigSalons.add(notification.salon_id);
      }

      await admin
        .from("salon_customer_notifications")
        .update({
          whatsapp_error: describeDispatchFailure(sendResult),
        })
        .eq("id", notification.id)
        .eq("salon_id", notification.salon_id);
      continue;
    }

    sent += 1;
    await admin
      .from("salon_customer_notifications")
      .update({
        whatsapp_delivery_status: "sent",
        whatsapp_error: null,
        whatsapp_message_id: sendResult.id,
        whatsapp_sent_at: runAt,
        whatsapp_status_at: runAt,
      })
      .eq("id", notification.id)
      .eq("salon_id", notification.salon_id);
  }

  return {
    ok: true as const,
    failed,
    missingConfigSalons: [...missingConfigSalons],
    missingPhone,
    processed: notifications.length,
    sent,
  };
}
