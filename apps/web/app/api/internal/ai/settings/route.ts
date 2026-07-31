import { NextResponse } from "next/server";
import { z } from "zod";

import { getAuthenticatedPanelAssistantContext } from "@/lib/ai/runtime/context";
import {
  buildAiLongMemorySnapshot,
  saveAiLongMemorySettings,
} from "@/lib/ai/runtime/preferences";
import { guardApiRequest } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const settingsSchema = z.object({
  businessGoals: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
  idealCustomerProfile: z.string().trim().max(220).nullable().optional(),
  preferredTone: z.string().trim().max(120).nullable().optional(),
  priorityProfessionals: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
  recentCampaigns: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
  topServices: z.array(z.string().trim().min(2).max(80)).max(6).optional(),
});

export async function GET(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "internal_ai_settings_read",
    blockSeconds: 120,
    limit: 60,
    windowSeconds: 300,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const context = await getAuthenticatedPanelAssistantContext();

  if (!context) {
    return NextResponse.json({ error: "unauthenticated", ok: false }, { status: 401 });
  }

  const snapshot = await buildAiLongMemorySnapshot({
    salonId: context.salon.id,
    supabase: context.supabase,
  });

  return NextResponse.json({
    ok: true,
    snapshot,
  });
}

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "internal_ai_settings_write",
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
  const parsed = settingsSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_request", ok: false }, { status: 400 });
  }

  await saveAiLongMemorySettings({
    salonId: context.salon.id,
    supabase: context.supabase,
    userId: context.userId,
    values: parsed.data,
  });

  const snapshot = await buildAiLongMemorySnapshot({
    salonId: context.salon.id,
    supabase: context.supabase,
  });

  return NextResponse.json({
    ok: true,
    snapshot,
  });
}
