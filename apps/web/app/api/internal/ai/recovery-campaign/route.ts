import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAiGenerationAudit } from "@/lib/ai/audit";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import { generateRecoveryCampaign } from "@/lib/ai/recoveryCampaign";
import {
  RECOVERY_CAMPAIGN_PROMPT_PROFILE,
  RECOVERY_CAMPAIGN_PROMPT_VERSION,
} from "@/lib/ai/prompts/recoveryCampaignPrompt";
import { resolveRequestOriginFromRequest } from "@/lib/requestOrigin";
import { guardApiRequest } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  question: z.string().max(220).optional(),
});

async function getAuthenticatedSalonContext() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let activeUserId = user?.id ?? null;

  if (!activeUserId) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    activeUserId = session?.user?.id ?? null;
  }

  if (!activeUserId) {
    return null;
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("id,name,slot_step_minutes,timezone")
    .eq("owner_user_id", activeUserId)
    .maybeSingle();

  if (!salon) {
    return null;
  }

  return {
    salon,
    supabase,
    userId: activeUserId,
  };
}

export async function POST(request: Request) {
  const guardResponse = await guardApiRequest(request, {
    actionName: "internal_recovery_campaign_ai",
    blockSeconds: 300,
    limit: 12,
    windowSeconds: 300,
  });

  if (guardResponse) {
    return guardResponse;
  }

  const context = await getAuthenticatedSalonContext();

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
    const requestPath = new URL(request.url).pathname;
    const recovery = await generateRecoveryCampaign({
      question: parsed.data.question ?? "Preencher agenda de amanha",
      requestOrigin: resolveRequestOriginFromRequest(request),
      salon: context.salon,
      supabase: context.supabase,
    });

    console.info("[ai/recovery-campaign] request_succeeded", {
      available: recovery.available,
      candidate_count: recovery.candidates.length,
      prompt_profile: RECOVERY_CAMPAIGN_PROMPT_PROFILE,
      prompt_version: RECOVERY_CAMPAIGN_PROMPT_VERSION,
      tenant_id: context.salon.id,
      used_fallback: recovery.draft?.model.includes("(fallback)") ?? true,
    });
    await recordAiGenerationAudit({
      actorUserId: context.userId,
      feature: AI_FEATURE_REGISTRY.recoveryCampaign.feature,
      metadata: {
        available: recovery.available,
        candidateCount: recovery.candidates.length,
        usedFallback: recovery.draft?.model.includes("(fallback)") ?? true,
      },
      outcome: "generated",
      promptProfile: RECOVERY_CAMPAIGN_PROMPT_PROFILE,
      promptVersion: RECOVERY_CAMPAIGN_PROMPT_VERSION,
      requestPath,
      salonId: context.salon.id,
      targetId: recovery.snapshot.serviceName,
      targetType: "recovery_campaign",
    });

    return NextResponse.json({
      ok: true,
      recovery,
    });
  } catch (error) {
    console.error("[ai/recovery-campaign] generation_failed", {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "recovery_campaign_failed",
      prompt_profile: RECOVERY_CAMPAIGN_PROMPT_PROFILE,
      prompt_version: RECOVERY_CAMPAIGN_PROMPT_VERSION,
      tenant_id: context.salon.id,
    });
    await recordAiGenerationAudit({
      actorUserId: context.userId,
      feature: AI_FEATURE_REGISTRY.recoveryCampaign.feature,
      outcome: "failed",
      promptProfile: RECOVERY_CAMPAIGN_PROMPT_PROFILE,
      promptVersion: RECOVERY_CAMPAIGN_PROMPT_VERSION,
      requestPath: new URL(request.url).pathname,
      salonId: context.salon.id,
      targetId: parsed.data.question ?? null,
      targetType: "recovery_campaign",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "recovery_campaign_failed",
        ok: false,
      },
      { status: 502 },
    );
  }
}
