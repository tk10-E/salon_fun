import type { User } from "@supabase/supabase-js";

import type {
  AssistantOperationalContext,
  AssistantPriority,
  AssistantQuickAction,
  AssistantRuntimeMetadata,
  PanelAssistantIntent,
} from "@/lib/ai/skills/types";
import type { Tables } from "@/lib/database.types";

export type PanelAssistantSalonContext = Pick<
  Tables<"salons">,
  "id" | "name" | "slot_step_minutes" | "timezone"
>;

export type AuthenticatedPanelAssistantContext = {
  permissions: string[];
  salon: PanelAssistantSalonContext;
  supabase: any;
  user: Pick<User, "app_metadata" | "email" | "id" | "user_metadata">;
  userId: string;
};

export type AiToolId =
  | "getAgenda"
  | "getCancelamentos"
  | "getCustomerSummary"
  | "getClientesInativos"
  | "getFaturamento"
  | "getHorariosVagos"
  | "getProfissionaisDisponiveis"
  | "criarCampanha"
  | "sugerirEncaixes";

export type AiToolDefinition = {
  description: string;
  id: AiToolId;
  kind: "read" | "write";
  label: string;
  quickAction: AssistantQuickAction;
  requiredPermission: string;
};

export type AiTenantSnapshot = {
  activeProfessionalsCount: number | null;
  activeServicesCount: number | null;
  availableTools: AiToolDefinition[];
  businessHoursConfigured: boolean | null;
  customerCount: number | null;
  pendingAppointmentsCount: number | null;
  permissions: string[];
  planId: string | null;
  planLabel: string | null;
  salonId: string;
  salonName: string;
  slotStepMinutes: number | null;
  subscriptionStatus: string | null;
  timezone: string;
  todayAppointmentsCount: number | null;
};

export type AiLongMemorySnapshot = {
  businessGoals: string[];
  idealCustomerProfile: string | null;
  preferredTone: string | null;
  priorityProfessionals: string[];
  recentCampaigns: string[];
  recentFocuses: string[];
  summary: string | null;
  topServices: string[];
};

export type AiLongMemorySettingsInput = Partial<{
  businessGoals: string[];
  idealCustomerProfile: string | null;
  preferredTone: string | null;
  priorityProfessionals: string[];
  recentCampaigns: string[];
  topServices: string[];
}>;

export type PanelAssistantPersistedAnswer = {
  actions: AssistantQuickAction[];
  bullets: string[];
  ctaHref: string | null;
  ctaLabel: string | null;
  followUp: string | null;
  impact: string | null;
  intent: PanelAssistantIntent;
  missingData: string[];
  model: string;
  operationalContext: AssistantOperationalContext | null;
  priority: AssistantPriority;
  problem: string | null;
  recommendedAction: string | null;
  runtime: AssistantRuntimeMetadata;
  suggestion: string | null;
  summary: string;
  title: string;
};

export type PersistPanelAssistantRuntimeTurnArgs = {
  admin?: any | null;
  answer: PanelAssistantPersistedAnswer;
  auditLogId?: string | null;
  conversationId?: string | null;
  createdAt: string;
  question: string;
  requestOrigin?: string | null;
  salonId: string;
  supabase?: any;
  userId?: string | null;
};
