import {
  type SecurityAuditSeverity,
  recordSecurityAuditEvent,
} from "@/lib/security";
import {
  buildAiGenerationEventType,
  type AiGenerationAuditOutcome,
  type AiPromptedFeature,
} from "@/lib/ai/registry";

type RecordAiGenerationAuditArgs = {
  actorUserId?: string | null;
  feature: AiPromptedFeature;
  metadata?: Record<string, unknown>;
  outcome: AiGenerationAuditOutcome;
  promptProfile: string;
  promptVersion: string;
  requestPath?: string | null;
  salonId: string;
  severity?: SecurityAuditSeverity;
  targetId?: string | null;
  targetType?: string | null;
};

export async function recordAiGenerationAudit(
  args: RecordAiGenerationAuditArgs,
) {
  await recordSecurityAuditEvent({
    actorUserId: args.actorUserId ?? null,
    eventType: buildAiGenerationEventType(args.feature, args.outcome),
    metadata: {
      promptProfile: args.promptProfile,
      promptVersion: args.promptVersion,
      ...(args.metadata ?? {}),
    },
    requestPath: args.requestPath ?? null,
    salonId: args.salonId,
    severity:
      args.severity ?? (args.outcome === "failed" ? "warn" : "info"),
    targetId: args.targetId ?? null,
    targetType: args.targetType ?? null,
  });
}
