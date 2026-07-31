import type { PostgrestError } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

import {
  buildAiConversationKey,
  cleanAiText,
  relationIsMissing,
} from "./guardrails";
import type { PersistPanelAssistantRuntimeTurnArgs } from "./types";

type TableWriteError = Pick<PostgrestError, "code" | "message">;

function resolveAiRuntimeAdminClient(input?: any | null) {
  if (input) {
    return input;
  }

  try {
    return createAdminClient() as any;
  } catch {
    return null;
  }
}

function buildAssistantMessageContent(
  args: PersistPanelAssistantRuntimeTurnArgs["answer"],
) {
  return JSON.stringify({
    bullets: args.bullets,
    ctaHref: args.ctaHref,
    ctaLabel: args.ctaLabel,
    followUp: args.followUp,
    impact: args.impact,
    missingData: args.missingData,
    operationalContext: args.operationalContext,
    priority: args.priority,
    problem: args.problem,
    recommendedAction: args.recommendedAction,
    summary: args.summary,
    suggestion: args.suggestion,
    title: args.title,
  });
}

function buildActionRows(args: {
  answer: PersistPanelAssistantRuntimeTurnArgs["answer"];
  assistantMessageId: string;
  conversationId: string;
  createdAt: string;
  salonId: string;
  userId?: string | null;
}) {
  const rows: Array<{
    actor_user_id: string | null;
    conversation_id: string;
    created_at: string;
    label: string;
    message_id: string;
    payload: Record<string, unknown>;
    salon_id: string;
    status: "suggested";
    target_href: string | null;
    type:
      | "managerial_score"
      | "proactive_alert"
      | "quick_action"
      | "recommended_action";
  }> = args.answer.actions.map((action) => ({
    actor_user_id: args.userId ?? null,
    conversation_id: args.conversationId,
    created_at: args.createdAt,
    label: cleanAiText(action.label, 80),
    message_id: args.assistantMessageId,
    payload: {
      href: action.href,
      kind: action.kind,
    },
    salon_id: args.salonId,
    status: "suggested",
    target_href: cleanAiText(action.href, 220),
    type: "quick_action",
  }));

  if (args.answer.recommendedAction) {
    rows.unshift({
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      label: cleanAiText(args.answer.recommendedAction, 120),
      message_id: args.assistantMessageId,
      payload: {
        intent: args.answer.intent,
        priority: args.answer.priority,
      },
      salon_id: args.salonId,
      status: "suggested",
      target_href: args.answer.ctaHref ? cleanAiText(args.answer.ctaHref, 220) : null,
      type: "recommended_action",
    });
  }

  const managerialScore = args.answer.operationalContext?.managerialScore;

  if (managerialScore) {
    rows.push({
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      label: cleanAiText(
        `Score gerencial ${managerialScore.overall}/100`,
        120,
      ),
      message_id: args.assistantMessageId,
      payload: managerialScore as Record<string, unknown>,
      salon_id: args.salonId,
      status: "suggested",
      target_href: null,
      type: "managerial_score",
    });
  }

  for (const alert of args.answer.operationalContext?.proactiveAlerts ?? []) {
    rows.push({
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      label: cleanAiText(alert.headline, 120),
      message_id: args.assistantMessageId,
      payload: {
        code: alert.code,
        prompt: alert.prompt,
        severity: alert.severity,
        summary: alert.summary,
      },
      salon_id: args.salonId,
      status: "suggested",
      target_href: alert.actions[0]?.href
        ? cleanAiText(alert.actions[0].href, 220)
        : null,
      type: "proactive_alert",
    });
  }

  return rows;
}

function buildMemoryRows(args: {
  answer: PersistPanelAssistantRuntimeTurnArgs["answer"];
  conversationId: string;
  conversationKey: string;
  createdAt: string;
  question: string;
  salonId: string;
  userId?: string | null;
}) {
  const rows: Array<{
    actor_user_id: string | null;
    conversation_id: string;
    created_at: string;
    last_used_at: string;
    memory_key: string;
    memory_value: Record<string, unknown>;
    salon_id: string;
    scope: "short" | "long";
    source: string;
  }> = [
    {
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      last_used_at: args.createdAt,
      memory_key: `conversation:${args.conversationKey}`,
      memory_value: {
        intent: args.answer.intent,
        priority: args.answer.priority,
        question: cleanAiText(args.question, 400),
        summary: cleanAiText(args.answer.summary, 320),
      },
      salon_id: args.salonId,
      scope: "short",
      source: "panel_assistant_turn",
    },
    {
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      last_used_at: args.createdAt,
      memory_key: "last_intent",
      memory_value: {
        intent: args.answer.intent,
        question: cleanAiText(args.question, 400),
        title: cleanAiText(args.answer.title, 80),
      },
      salon_id: args.salonId,
      scope: "long",
      source: "panel_assistant_turn",
    },
    {
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      last_used_at: args.createdAt,
      memory_key: "last_manager_briefing",
      memory_value: {
        impact: cleanAiText(args.answer.impact, 180),
        problem: cleanAiText(args.answer.problem, 180),
        recommendedAction: cleanAiText(args.answer.recommendedAction, 180),
        suggestion: cleanAiText(args.answer.suggestion, 180),
        summary: cleanAiText(args.answer.summary, 320),
      },
      salon_id: args.salonId,
      scope: "long",
      source: "panel_assistant_turn",
    },
  ];

  if (args.answer.operationalContext) {
    rows.push({
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      last_used_at: args.createdAt,
      memory_key: "last_operational_context",
      memory_value: args.answer.operationalContext as Record<string, unknown>,
      salon_id: args.salonId,
      scope: "long",
      source: "panel_assistant_turn",
    });
  }

  if (
    args.answer.intent === "promotion_strategy" ||
    args.answer.intent === "recovery_campaign"
  ) {
    rows.push({
      actor_user_id: args.userId ?? null,
      conversation_id: args.conversationId,
      created_at: args.createdAt,
      last_used_at: args.createdAt,
      memory_key: "recent_campaigns",
      memory_value: {
        values: [
          cleanAiText(args.answer.title, 80),
          cleanAiText(args.answer.summary, 120),
        ].filter(Boolean),
      },
      salon_id: args.salonId,
      scope: "long",
      source: "campaign_inference",
    });
  }

  return rows;
}

async function writeRuntimeTurn(
  args: PersistPanelAssistantRuntimeTurnArgs,
) {
  const admin = resolveAiRuntimeAdminClient(args.admin ?? args.supabase ?? null);

  if (!admin) {
    return;
  }

  const conversationKey = buildAiConversationKey(
    args.conversationId,
    args.salonId,
    args.userId,
  );
  const conversationUpsert = await admin
    .from("ai_conversations")
    .upsert(
      {
        actor_user_id: args.userId ?? null,
        channel: "panel_assistant",
        conversation_key: conversationKey,
        last_message_at: args.createdAt,
        metadata: {
          auditLogId: args.auditLogId ?? null,
          feature: "panel_assistant",
          requestOrigin: cleanAiText(args.requestOrigin, 220) || null,
        },
        salon_id: args.salonId,
        status: "active",
        summary: cleanAiText(args.answer.summary, 320) || null,
        title: cleanAiText(args.answer.title, 120) || null,
        updated_at: args.createdAt,
      },
      { onConflict: "salon_id,conversation_key" },
    )
    .select("id")
    .single();

  if (conversationUpsert.error) {
    throw conversationUpsert.error;
  }

  const conversationRow = conversationUpsert.data as { id: string } | null;

  if (!conversationRow?.id) {
    throw new Error("ai_conversation_not_persisted");
  }

  const questionInsert = await admin
    .from("ai_messages")
    .insert({
      actor_user_id: args.userId ?? null,
      content: cleanAiText(args.question, 2000),
      conversation_id: conversationRow.id,
      created_at: args.createdAt,
      metadata: {
        auditLogId: args.auditLogId ?? null,
      },
      role: "user",
      salon_id: args.salonId,
    })
    .select("id")
    .single();

  if (questionInsert.error) {
    throw questionInsert.error;
  }

  const assistantInsert = await admin
    .from("ai_messages")
    .insert({
      actor_user_id: args.userId ?? null,
      content: buildAssistantMessageContent(args.answer),
      conversation_id: conversationRow.id,
      created_at: args.createdAt,
      intent: args.answer.intent,
      metadata: {
        auditLogId: args.auditLogId ?? null,
        model: args.answer.model,
        runtime: args.answer.runtime,
      },
      model: cleanAiText(args.answer.model, 120) || null,
      prompt_profile: cleanAiText(args.answer.runtime.skillLabel, 80) || null,
      role: "assistant",
      salon_id: args.salonId,
    })
    .select("id")
    .single();

  if (assistantInsert.error) {
    throw assistantInsert.error;
  }

  const assistantMessage = assistantInsert.data as { id: string } | null;

  if (!assistantMessage?.id) {
    throw new Error("ai_assistant_message_not_persisted");
  }

  const actionRows = buildActionRows({
    answer: args.answer,
    assistantMessageId: assistantMessage.id,
    conversationId: conversationRow.id,
    createdAt: args.createdAt,
    salonId: args.salonId,
    userId: args.userId,
  });

  if (actionRows.length) {
    const actionInsert = await admin.from("ai_actions").insert(actionRows);

    if (actionInsert.error) {
      throw actionInsert.error;
    }
  }

  const memoryRows = buildMemoryRows({
    answer: args.answer,
    conversationId: conversationRow.id,
    conversationKey,
    createdAt: args.createdAt,
    question: args.question,
    salonId: args.salonId,
    userId: args.userId,
  });
  const memoryUpsert = await admin
    .from("ai_memory")
    .upsert(memoryRows, { onConflict: "salon_id,scope,memory_key" });

  if (memoryUpsert.error) {
    throw memoryUpsert.error;
  }
}

export async function persistPanelAssistantRuntimeTurn(
  args: PersistPanelAssistantRuntimeTurnArgs,
) {
  try {
    await writeRuntimeTurn(args);
  } catch (error) {
    const tableError = error as TableWriteError | null;

    if (relationIsMissing(tableError)) {
      return;
    }
  }
}
