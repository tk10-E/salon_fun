import {
  AI_DEFAULT_REQUEST_FEATURE,
  type OpenRouterFeature,
} from "@/lib/ai/registry";

const DEFAULT_OPENROUTER_MODEL = "google/gemma-4-31b-it:free";
const DEFAULT_OPENROUTER_APP_NAME = "Salon Fun";
const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_TIMEOUT_MS = 10_000;
const MIN_OPENROUTER_TIMEOUT_MS = 3_000;
const MAX_OPENROUTER_TIMEOUT_MS = 20_000;

export type OpenRouterChatMessage = {
  content: string;
  role: "assistant" | "system" | "user";
};

type OpenRouterChatCompletionArgs = {
  feature?: OpenRouterFeature;
  maxTokens?: number;
  messages: OpenRouterChatMessage[];
  model?: string;
  requestOrigin?: string | null;
  temperature?: number;
  timeoutMs?: number;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
          text?: string;
          type?: string;
        }>;
    };
  }>;
  error?: {
    message?: string;
  };
};

function readOpenRouterApiKey() {
  return process.env.OPENROUTER_API_KEY?.trim() ?? "";
}

export function isOpenRouterEnabled() {
  return readOpenRouterApiKey().length > 0;
}

export function getOpenRouterModel() {
  return process.env.OPENROUTER_MODEL?.trim() || DEFAULT_OPENROUTER_MODEL;
}

function getOpenRouterAppName() {
  return process.env.OPENROUTER_APP_NAME?.trim() || DEFAULT_OPENROUTER_APP_NAME;
}

function normalizeTimeoutMs(timeoutMs?: number) {
  if (typeof timeoutMs !== "number" || !Number.isFinite(timeoutMs)) {
    return DEFAULT_OPENROUTER_TIMEOUT_MS;
  }

  return Math.min(
    MAX_OPENROUTER_TIMEOUT_MS,
    Math.max(MIN_OPENROUTER_TIMEOUT_MS, Math.round(timeoutMs)),
  );
}

function normalizeOpenRouterError(error: unknown) {
  if (error instanceof Error) {
    if (error.name === "AbortError") {
      return "openrouter_timeout";
    }

    const message = error.message.trim();
    return message || "openrouter_request_failed";
  }

  return "openrouter_request_failed";
}

function extractChoiceText(payload: OpenRouterResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
  }

  return "";
}

export async function createOpenRouterChatCompletion(
  args: OpenRouterChatCompletionArgs,
) {
  const apiKey = readOpenRouterApiKey();

  if (!apiKey) {
    throw new Error("openrouter_not_configured");
  }

  const feature = args.feature?.trim() || AI_DEFAULT_REQUEST_FEATURE;
  const model = args.model ?? getOpenRouterModel();
  const timeoutMs = normalizeTimeoutMs(args.timeoutMs);
  const startedAt = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(OPENROUTER_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(args.requestOrigin?.trim()
          ? {
              "HTTP-Referer": args.requestOrigin.trim(),
            }
          : {}),
        "X-Title": getOpenRouterAppName(),
      },
      body: JSON.stringify({
        max_tokens: args.maxTokens ?? 220,
        messages: args.messages,
        model,
        temperature: args.temperature ?? 0.7,
      }),
      signal: controller.signal,
    });

    const payload = await response.json().catch(() => null) as OpenRouterResponse | null;

    if (!response.ok) {
      throw new Error(
        payload?.error?.message?.trim() ||
          `openrouter_request_failed:${response.status}`,
      );
    }

    const text = extractChoiceText(payload ?? {});

    if (!text) {
      throw new Error("openrouter_empty_response");
    }

    return {
      model,
      text,
    };
  } catch (error) {
    const normalizedError = normalizeOpenRouterError(error);

    console.error("[ai/openrouter] request_failed", {
      durationMs: Date.now() - startedAt,
      error: normalizedError,
      feature,
      model,
      timeoutMs,
    });

    throw new Error(normalizedError);
  } finally {
    clearTimeout(timeout);
  }
}
