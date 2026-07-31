import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAiGenerationAudit } from "@/lib/ai/audit";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  generatePromotionDraftWithAi,
  isPromotionDraftAiEnabled,
} from "@/lib/ai/promotionDraft";
import {
  PROMOTION_DRAFT_PROMPT_PROFILE,
  PROMOTION_DRAFT_PROMPT_VERSION,
} from "@/lib/ai/prompts/promotionDraftPrompt";
import { resolveRequestOriginFromRequest } from "@/lib/requestOrigin";
import { guardApiRequest } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  descriptionHint: z.string().max(500).optional(),
  goal: z.string().max(120).optional(),
  highlightHint: z.string().max(160).optional(),
  kind: z.enum(["membership", "promotion"]),
  notes: z.string().max(300).optional(),
  priceHint: z.number().nonnegative().optional().nullable(),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  serviceOptions: z
    .array(
      z.object({
        id: z.string().uuid(),
        label: z.string().max(120),
      }),
    )
    .max(40)
    .optional(),
  titleHint: z.string().max(100).optional(),
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
    .select("id,name,timezone")
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
    actionName: "internal_promotion_ai_draft",
    blockSeconds: 300,
    limit: 20,
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

  if (!isPromotionDraftAiEnabled()) {
    return NextResponse.json(
      {
        error: "ai_not_configured",
        ok: false,
      },
      { status: 503 },
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

  const { salon, supabase } = context;
  const serviceId = parsed.data.serviceId?.trim() || null;
  let serviceName: string | null = null;

  if (serviceId) {
    const { data: service } = await supabase
      .from("services")
      .select("name")
      .eq("id", serviceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (!service) {
      return NextResponse.json(
        {
          error: "invalid_service",
          ok: false,
        },
        { status: 400 },
      );
    }

    serviceName = service.name;
  }

  try {
    const requestPath = new URL(request.url).pathname;
    const draft = await generatePromotionDraftWithAi({
      descriptionHint: parsed.data.descriptionHint ?? null,
      goal: parsed.data.goal ?? null,
      highlightHint: parsed.data.highlightHint ?? null,
      kind: parsed.data.kind,
      notes: parsed.data.notes ?? null,
      priceHint: parsed.data.priceHint ?? null,
      requestOrigin: resolveRequestOriginFromRequest(request),
      serviceId,
      salonName: salon.name,
      serviceName,
      serviceOptions: parsed.data.serviceOptions ?? [],
      timeZone: salon.timezone ?? null,
      titleHint: parsed.data.titleHint ?? null,
    });

    console.info("[ai/promotion-draft] request_succeeded", {
      offer_kind: parsed.data.kind,
      prompt_profile: PROMOTION_DRAFT_PROMPT_PROFILE,
      prompt_version: PROMOTION_DRAFT_PROMPT_VERSION,
      tenant_id: salon.id,
      used_fallback: draft.model.includes("(fallback)"),
    });
    await recordAiGenerationAudit({
      actorUserId: context.userId,
      feature: AI_FEATURE_REGISTRY.promotionDraft.feature,
      metadata: {
        offerKind: parsed.data.kind,
        usedFallback: draft.model.includes("(fallback)"),
      },
      outcome: "generated",
      promptProfile: PROMOTION_DRAFT_PROMPT_PROFILE,
      promptVersion: PROMOTION_DRAFT_PROMPT_VERSION,
      requestPath,
      salonId: salon.id,
      targetId: serviceId,
      targetType: "service",
    });

    return NextResponse.json({
      draft,
      ok: true,
    });
  } catch (error) {
    console.error("[ai/promotion-draft] generation_failed", {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "ai_generation_failed",
      prompt_profile: PROMOTION_DRAFT_PROMPT_PROFILE,
      prompt_version: PROMOTION_DRAFT_PROMPT_VERSION,
      tenant_id: salon.id,
    });
    await recordAiGenerationAudit({
      actorUserId: context.userId,
      feature: AI_FEATURE_REGISTRY.promotionDraft.feature,
      metadata: {
        offerKind: parsed.data.kind,
      },
      outcome: "failed",
      promptProfile: PROMOTION_DRAFT_PROMPT_PROFILE,
      promptVersion: PROMOTION_DRAFT_PROMPT_VERSION,
      requestPath: new URL(request.url).pathname,
      salonId: salon.id,
      targetId: serviceId,
      targetType: "service",
    });

    return NextResponse.json(
      {
        error:
          error instanceof Error && error.message.trim()
            ? error.message
            : "ai_generation_failed",
        ok: false,
      },
      { status: 502 },
    );
  }
}
