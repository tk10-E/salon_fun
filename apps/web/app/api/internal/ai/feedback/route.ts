import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedPanelAssistantContext } from "@/lib/ai/runtime/context";
import { guardApiRequest } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  comment: z.string().trim().max(400).nullable().optional(),
  conversationId: z.string().uuid().nullable().optional(),
  messageId: z.string().uuid().nullable().optional(),
  rating: z.number().int().min(1).max(5).nullable().optional(),
  sentiment: z.enum(["positive", "neutral", "negative"]).nullable().optional(),
});

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "internal_ai_feedback_write",
    blockSeconds: 300,
    limit: 20,
    windowSeconds: 300,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const context = await getAuthenticatedPanelAssistantContext();

  if (!context) {
    return NextResponse.json({ error: "unauthenticated", ok: false }, { status: 401 });
  }

  const json = await request.json().catch(() => null);
  const parsed = feedbackSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", ok: false }, { status: 400 });
  }

  const insertResult = await context.supabase.from("ai_feedback").insert({
    actor_user_id: context.userId,
    comment: parsed.data.comment ?? null,
    conversation_id: parsed.data.conversationId ?? null,
    message_id: parsed.data.messageId ?? null,
    metadata: {
      source: "dashboard_panel_ai",
    },
    rating: parsed.data.rating ?? null,
    salon_id: context.salon.id,
    sentiment: parsed.data.sentiment ?? null,
  });

  if (insertResult.error) {
    return NextResponse.json(
      {
        error: insertResult.error.message || "feedback_insert_failed",
        ok: false,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
