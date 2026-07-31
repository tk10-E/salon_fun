export type InlineActionTone = "success" | "error" | "info";

export type InlineActionState = {
  ok: boolean;
  message: string;
  tone: InlineActionTone;
};

export const INLINE_ACTION_MODE_FIELD = "__actionMode";
export const INLINE_ACTION_MODE = "inline";

export function markInlineAction(formData: FormData) {
  formData.set(INLINE_ACTION_MODE_FIELD, INLINE_ACTION_MODE);
}

export function isInlineAction(formData: FormData) {
  return formData.get(INLINE_ACTION_MODE_FIELD) === INLINE_ACTION_MODE;
}

export function buildInlineActionState(
  message: string,
  tone: InlineActionTone,
): InlineActionState {
  return {
    ok: tone === "success" || tone === "info",
    message,
    tone,
  };
}
