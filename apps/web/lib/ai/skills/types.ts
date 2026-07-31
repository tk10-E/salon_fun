export type PanelAssistantIntent =
  | "schedule_availability"
  | "vacancy_strategy"
  | "movement_forecast"
  | "recovery_campaign"
  | "customer_summary"
  | "finance_analysis"
  | "promotion_strategy"
  | "panel_help";

export type AssistantPriority = "high" | "medium" | "low";

export type AssistantProvider = "deterministic" | "openrouter";

export type AssistantDecisionMode = "guided_generation" | "safe_fallback";

export type AssistantDecisionField =
  | "problem"
  | "impact"
  | "suggestion"
  | "recommendedAction";

export type AssistantDecisionTone =
  | "action"
  | "impact"
  | "problem"
  | "suggestion";

export type AssistantQuickAction = {
  href: string;
  kind: "primary" | "secondary";
  label: string;
};

export type AssistantManagementScore = {
  cancellations: number | null;
  occupancy: number | null;
  overall: number;
  productivity: number | null;
  recurringCustomers: number | null;
  revenue: number | null;
  statusLabel: string;
  vacancies: number | null;
};

export type AssistantOperationalDiagnosis = {
  actions: AssistantQuickAction[];
  code:
    | "high_cancellations"
    | "high_vacancy_load"
    | "idle_professionals"
    | "inactive_customers"
    | "low_demand_services"
    | "low_occupancy"
    | "revenue_drop";
  impact: string;
  metricLabel: string;
  problem: string;
  recommendedAction: string;
  severity: "critical" | "warning";
  suggestion: string;
  title: string;
};

export type AssistantOperationalOpportunity = {
  actions: AssistantQuickAction[];
  code:
    | "campaign_for_vacancies"
    | "combo_offer"
    | "fill_focus"
    | "professional_recovery"
    | "reactivation"
    | "smart_fit";
  headline: string;
  prompt: string | null;
  recommendedAction: string;
  summary: string;
};

export type AssistantProactiveAlert = {
  actions: AssistantQuickAction[];
  code:
    | "campaign_candidates"
    | "idle_professional"
    | "low_occupancy_tomorrow"
    | "revenue_drop_recent"
    | "vacancies_today";
  headline: string;
  prompt: string | null;
  severity: "high" | "medium" | "low";
  summary: string;
};

export type AssistantOperationalContext = {
  cancellationsLast7d: number;
  diagnoses?: AssistantOperationalDiagnosis[];
  fitChanceLabel: string;
  managerialScore?: AssistantManagementScore | null;
  monthRevenueLabel: string;
  operationalRiskLabel: string;
  opportunities?: AssistantOperationalOpportunity[];
  pendingAppointmentsCount: number;
  proactiveAlerts?: AssistantProactiveAlert[];
  summary: string;
  todayAppointmentsCount: number;
  tomorrowOccupancyLabel: string;
  tomorrowOccupancyPercent: number | null;
  tomorrowOpenSlotsCount: number;
};

export type AssistantDecisionFrame = {
  actions: AssistantQuickAction[];
  impact: string | null;
  operationalContext: AssistantOperationalContext | null;
  priority: AssistantPriority;
  problem: string | null;
  recommendedAction: string | null;
  suggestion: string | null;
};

export type AssistantRuntimeMetadata = {
  decisionMode: AssistantDecisionMode;
  memoryUsed?: boolean;
  policyVersion: string;
  provider: AssistantProvider;
  skillId: PanelAssistantIntent;
  skillLabel: string;
};

export type AssistantSkillExample = {
  answer: {
    bullets: string[];
    followUp: string | null;
    impact: string;
    problem: string;
    recommendedAction: string;
    suggestion: string;
    summary: string;
    title: string;
  };
  question: string;
};

export type AssistantSkillDefinition = {
  decisionSections: Array<{
    field: AssistantDecisionField;
    label: string;
    tone: AssistantDecisionTone;
  }>;
  guardrails: string[];
  intent: PanelAssistantIntent;
  label: string;
  objective: string;
  responseExamples: AssistantSkillExample[];
  routingTerms: string[];
  writingDirectives: string[];
  suggestedQuestions: string[];
  summary: string;
};
