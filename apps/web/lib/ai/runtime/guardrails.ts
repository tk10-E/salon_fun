import { randomUUID } from "node:crypto";

export const AI_INSUFFICIENT_DATA_MESSAGE =
  "Nao encontrei dados suficientes para afirmar isso.";
export const PANEL_ASSISTANT_HISTORY_EVENT_TYPE = "panel.ai_query";
export const PANEL_ASSISTANT_HISTORY_TARGET_TYPE = "panel_ai_assistant";

export function cleanAiText(
  value: string | null | undefined,
  maxLength: number,
) {
  return (value ?? "")
    .replace(/\s+/g, " ")
    .replace(/^["'\s]+|["'\s]+$/g, "")
    .trim()
    .slice(0, maxLength);
}

export function normalizeAiConversationId(value: string | null | undefined) {
  const normalized = cleanAiText(value, 80);

  if (!normalized || !/^[a-zA-Z0-9:_-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

export function buildAiConversationKey(
  conversationId: string | null | undefined,
  salonId: string,
  userId?: string | null,
) {
  const normalized = normalizeAiConversationId(conversationId);

  if (normalized) {
    return normalized;
  }

  const ownerKey = cleanAiText(userId, 80) || "anonymous";
  return `oneshot:${salonId}:${ownerKey}:${randomUUID()}`;
}

export function relationIsMissing(
  error: { code?: string | null; message?: string | null } | null | undefined,
) {
  if (!error) {
    return false;
  }

  return (
    error.code === "42P01" ||
    error.code === "PGRST205" ||
    /does not exist/i.test(error.message ?? "") ||
    /could not find the table/i.test(error.message ?? "")
  );
}
