import { getMetaPermanentToken, getWhatsAppPhoneNumberId } from "./serverEnv";

export type WhatsAppSendResult =
  | { ok: true; id: string }
  | { ok: false; reason: "missing_config" | "request_failed"; detail?: string };

const GRAPH_BASE = "https://graph.facebook.com/v18.0";

type WhatsAppDispatchConfig = {
  phoneId: string;
  token: string;
};

function getGlobalConfig() {
  const token = getMetaPermanentToken();
  const phoneId = getWhatsAppPhoneNumberId();
  if (!token || !phoneId) return null;
  return { token, phoneId };
}

async function resolveDispatchConfig(
  salonId?: string | null,
): Promise<WhatsAppDispatchConfig | null> {
  const globalConfig = getGlobalConfig();

  if (!salonId) {
    return globalConfig;
  }

  try {
    const { createAdminClient } = await import("@/lib/supabase/admin");
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("salons")
      .select(
        "whatsapp_dispatch_enabled, whatsapp_meta_phone_number_id",
      )
      .eq("id", salonId)
      .maybeSingle();

    if (error) {
      return null;
    }

    if (!data?.whatsapp_dispatch_enabled) {
      return null;
    }

    if (
      data.whatsapp_meta_phone_number_id?.trim() &&
      globalConfig?.token
    ) {
      return {
        phoneId: data.whatsapp_meta_phone_number_id.trim(),
        token: globalConfig.token,
      };
    }
  } catch {
    return null;
  }

  return globalConfig;
}

export async function sendSalonWhatsAppTextMessage(
  salonId: string | null | undefined,
  toNumber: string,
  body: string,
): Promise<WhatsAppSendResult> {
  const config = await resolveDispatchConfig(salonId);

  if (!config) return { ok: false, reason: "missing_config" };

  try {
    const response = await fetch(`${GRAPH_BASE}/${config.phoneId}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: toNumber,
        type: "text",
        text: { body },
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      return { ok: false, reason: "request_failed", detail };
    }

    const json = (await response.json()) as { messages?: Array<{ id: string }> };
    const messageId = json.messages?.[0]?.id ?? "sent";
    return { ok: true, id: messageId };
  } catch (error) {
    return { ok: false, reason: "request_failed", detail: error instanceof Error ? error.message : "unknown_error" };
  }
}

export function sanitizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D+/g, "");
  return digits.length ? digits : null;
}
