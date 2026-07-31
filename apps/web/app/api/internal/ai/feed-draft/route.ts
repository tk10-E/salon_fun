import { NextResponse } from "next/server";
import { z } from "zod";

import { recordAiGenerationAudit } from "@/lib/ai/audit";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";
import {
  generateFeedDraftWithAi,
  isFeedDraftAiEnabled,
} from "@/lib/ai/feedDraft";
import {
  FEED_DRAFT_PROMPT_PROFILE,
  FEED_DRAFT_PROMPT_VERSION,
} from "@/lib/ai/prompts/feedDraftPrompt";
import { isFeedComposerPostType } from "@/lib/feedComposerConfig";
import { resolveRequestOriginFromRequest } from "@/lib/requestOrigin";
import { guardApiRequest } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const requestSchema = z.object({
  captionHint: z.string().max(500).optional(),
  notes: z.string().max(300).optional(),
  postType: z.string(),
  serviceId: z.string().uuid().optional().or(z.literal("")),
  staffMemberId: z.string().uuid().optional().or(z.literal("")),
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
    .select("id,name")
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
    actionName: "internal_feed_ai_draft",
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

  if (!isFeedDraftAiEnabled()) {
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

  if (!parsed.success || !isFeedComposerPostType(parsed.data.postType)) {
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
  const staffMemberId = parsed.data.staffMemberId?.trim() || null;

  let serviceName: string | null = null;
  let staffMemberName: string | null = null;
  let staffMemberRole: string | null = null;

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

  if (staffMemberId) {
    const { data: staffMember } = await supabase
      .from("staff_members")
      .select("name,role")
      .eq("id", staffMemberId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (!staffMember) {
      return NextResponse.json(
        {
          error: "invalid_staff_member",
          ok: false,
        },
        { status: 400 },
      );
    }

    staffMemberName = staffMember.name;
    staffMemberRole = staffMember.role;
  }

  try {
    const requestPath = new URL(request.url).pathname;
    const draft = await generateFeedDraftWithAi({
      captionHint: parsed.data.captionHint ?? null,
      notes: parsed.data.notes ?? null,
      postType: parsed.data.postType,
      requestOrigin: resolveRequestOriginFromRequest(request),
      salonName: salon.name,
      serviceName,
      staffMemberName,
      staffMemberRole,
      titleHint: parsed.data.titleHint ?? null,
    });

    console.info("[ai/feed-draft] request_succeeded", {
      post_type: parsed.data.postType,
      prompt_profile: FEED_DRAFT_PROMPT_PROFILE,
      prompt_version: FEED_DRAFT_PROMPT_VERSION,
      tenant_id: salon.id,
      used_fallback: draft.model.includes("(fallback)"),
    });
    await recordAiGenerationAudit({
      actorUserId: context.userId,
      feature: AI_FEATURE_REGISTRY.feedDraft.feature,
      metadata: {
        postType: parsed.data.postType,
        usedFallback: draft.model.includes("(fallback)"),
      },
      outcome: "generated",
      promptProfile: FEED_DRAFT_PROMPT_PROFILE,
      promptVersion: FEED_DRAFT_PROMPT_VERSION,
      requestPath,
      salonId: salon.id,
      targetId: staffMemberId ?? serviceId,
      targetType: staffMemberId ? "staff_member" : serviceId ? "service" : "feed_draft",
    });

    return NextResponse.json({
      draft,
      ok: true,
    });
  } catch (error) {
    console.error("[ai/feed-draft] generation_failed", {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "ai_generation_failed",
      prompt_profile: FEED_DRAFT_PROMPT_PROFILE,
      prompt_version: FEED_DRAFT_PROMPT_VERSION,
      tenant_id: salon.id,
    });
    await recordAiGenerationAudit({
      actorUserId: context.userId,
      feature: AI_FEATURE_REGISTRY.feedDraft.feature,
      metadata: {
        postType: parsed.data.postType,
      },
      outcome: "failed",
      promptProfile: FEED_DRAFT_PROMPT_PROFILE,
      promptVersion: FEED_DRAFT_PROMPT_VERSION,
      requestPath: new URL(request.url).pathname,
      salonId: salon.id,
      targetId: staffMemberId ?? serviceId,
      targetType: staffMemberId ? "staff_member" : serviceId ? "service" : "feed_draft",
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
