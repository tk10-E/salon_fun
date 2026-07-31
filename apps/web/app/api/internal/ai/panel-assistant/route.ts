import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedPanelAssistantContext } from "@/lib/ai/runtime/context";
import { getPanelAssistantAiMetadata } from "@/lib/ai/registry";
import {
  answerPanelAssistantPrompt,
  savePanelAssistantHistory,
} from "@/lib/ai/panelAssistant";
import { resolveRequestOriginFromRequest } from "@/lib/requestOrigin";
import { guardApiRequest } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  conversationId: z
    .string()
    .trim()
    .min(8)
    .max(80)
    .regex(/^[a-zA-Z0-9:_-]+$/)
    .optional(),
  question: z.string().min(6).max(400),
});

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "internal_panel_ai_assistant",
    blockSeconds: 300,
    limit: 30,
    windowSeconds: 300,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const context = await getAuthenticatedPanelAssistantContext();

  if (!context) {
    return NextResponse.json(
      {
        error: "unauthenticated",
        ok: false,
      },
      { status: 401 },
    );
  }

  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_request",
        ok: false,
      },
      { status: 400 },
    );
  }

  try {
    const panelAssistantAiMetadata = getPanelAssistantAiMetadata();
    const requestOrigin = resolveRequestOriginFromRequest(request);
    const requestPath = new URL(request.url).pathname;
    const answer = await answerPanelAssistantPrompt({
      conversationId: parsed.data.conversationId,
      permissions: context.permissions,
      question: parsed.data.question,
      requestOrigin,
      salon: context.salon,
      supabase: context.supabase,
      userId: context.userId,
    });
    const historyItem = await savePanelAssistantHistory({
      answer,
      conversationId: parsed.data.conversationId,
      question: parsed.data.question,
      requestPath,
      requestOrigin,
      runtimeSupabase: context.supabase,
      salonId: context.salon.id,
      userId: context.userId,
      userAgent: request.headers.get("user-agent"),
    });

    console.info("[ai/panel-assistant] request_succeeded", {
      actions: answer.actions.map((item) => item.label),
      conversation_id: parsed.data.conversationId ?? null,
      intent: answer.intent,
      policy_version: panelAssistantAiMetadata.policyVersion,
      prompt_profile: panelAssistantAiMetadata.promptProfile,
      prompt_version: panelAssistantAiMetadata.promptVersion,
      skillId: answer.runtime?.skillId ?? answer.intent,
      tenant_id: context.salon.id,
    });

    return NextResponse.json({
      answer,
      historyItem,
      ok: true,
    });
  } catch (error) {
    const panelAssistantAiMetadata = getPanelAssistantAiMetadata();
    console.error("[ai/panel-assistant] answer_failed", {
      conversation_id: parsed.data.conversationId ?? null,
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "assistant_failed",
      policy_version: panelAssistantAiMetadata.policyVersion,
      prompt_profile: panelAssistantAiMetadata.promptProfile,
      prompt_version: panelAssistantAiMetadata.promptVersion,
      questionLength: parsed.data.question.length,
      tenant_id: context.salon.id,
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "assistant_failed",
        ok: false,
      },
      { status: 502 },
    );
  }
}
