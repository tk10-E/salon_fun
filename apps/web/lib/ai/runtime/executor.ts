import { createAdminClient } from "@/lib/supabase/admin";
import { resolveBookedAppointmentAmount } from "@/lib/financialMetrics";
import { getUtcRangeForLocalDate } from "@/lib/management";

import { generateRecoveryCampaign } from "../recoveryCampaign";

import { cleanAiText, relationIsMissing } from "./guardrails";
import { getPanelAssistantToolDefinition } from "./tools";
import type { AiToolId, PanelAssistantSalonContext } from "./types";

type StaffMemberRow = {
  id: string;
  is_active: boolean | null;
  name: string;
};

type ServiceRow = {
  category: string | null;
  duration: number | null;
  id: string;
  name: string;
  price: number | string | null;
};

type AgendaAppointmentRow = {
  customer_id: string | null;
  date: string;
  ends_at: string;
  staff_member_id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type FinanceAppointmentRow = {
  completed_at: string | null;
  customer_id: string | null;
  date: string;
  service_id: string | null;
  service_price_snapshot: number | string | null;
  staff_member_id: string | null;
  services:
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }[]
    | null;
};

type AppointmentPaymentRow = {
  amount: number | string;
  paid_at: string;
};

type CustomerRow = {
  created_at: string;
  email: string | null;
  id: string;
  name: string;
  phone: string | null;
};

type CustomerHistoryRow = {
  completed_at: string | null;
  customer_id: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type CustomerSummaryAppointmentRow = {
  completed_at: string | null;
  date: string;
  service_price_snapshot: number | string | null;
  services:
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }
    | {
        category?: string | null;
        name: string;
        price?: number | string | null;
      }[]
    | null;
  staff_members:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type CancellationRow = {
  cancelled_at: string | null;
  customer_id: string | null;
  date: string;
  id: string;
  status: "pending" | "confirmed" | "completed" | "cancelled" | "no_show";
};

type AvailableStaffSlot = {
  ends_at: string;
  staff_member_id: string;
  staff_member_name: string;
  start_at: string;
};

export type PanelAssistantToolInputMap = {
  criarCampanha: {
    question?: string | null;
  };
  getAgenda: {
    dayKey?: string | null;
    includeAppointments?: boolean;
    includeServices?: boolean;
  };
  getCancelamentos: {
    limit?: number;
    periodEnd: string;
    periodStart: string;
  };
  getCustomerSummary: {
    customerId?: string | null;
    searchTerm: string;
  };
  getClientesInativos: {
    inactiveDays?: number;
    limit?: number;
  };
  getFaturamento: {
    periodEnd: string;
    periodStart: string;
    previousPeriodEnd?: string | null;
    previousPeriodStart?: string | null;
  };
  getHorariosVagos: {
    dayKey: string;
    serviceId?: string | null;
  };
  getProfissionaisDisponiveis: {
    onlyActive?: boolean;
  };
  sugerirEncaixes: {
    question?: string | null;
  };
};

export type PanelAssistantToolResultMap = {
  criarCampanha: Awaited<ReturnType<typeof generateRecoveryCampaign>>;
  getAgenda: {
    appointments: AgendaAppointmentRow[];
    dayKey: string | null;
    services: ServiceRow[];
    staffMembers: StaffMemberRow[];
  };
  getCancelamentos: {
    cancellations: CancellationRow[];
  };
  getCustomerSummary: {
    appointments: CustomerSummaryAppointmentRow[];
    customer: CustomerRow | null;
    customers: CustomerRow[];
    searchTerm: string;
  };
  getClientesInativos: {
    customers: Array<
      CustomerRow & {
        completedVisits: number;
        daysSinceLastVisit: number | null;
        lastVisitAt: string | null;
        totalSpent: number;
      }
    >;
  };
  getFaturamento: {
    appointments: FinanceAppointmentRow[];
    payments: AppointmentPaymentRow[];
  };
  getHorariosVagos: {
    dayKey: string;
    slots: AvailableStaffSlot[];
  };
  getProfissionaisDisponiveis: {
    staffMembers: StaffMemberRow[];
  };
  sugerirEncaixes: Awaited<ReturnType<typeof generateRecoveryCampaign>>;
};

type ExecutePanelAssistantToolBaseArgs = {
  actorUserId?: string | null;
  conversationId?: string | null;
  permissions?: string[];
  requestOrigin?: string | null;
  salon: PanelAssistantSalonContext;
  supabase: any;
};

export type ExecutePanelAssistantToolArgs<TToolId extends AiToolId> =
  ExecutePanelAssistantToolBaseArgs & {
    input: PanelAssistantToolInputMap[TToolId];
    toolId: TToolId;
  };

const OWNER_PERMISSION_TOKENS = new Set([
  "panel_owner",
  "platform_admin",
  "super_admin",
  "superadmin",
  "owner",
]);

function resolveAiToolAdminClient(input?: any | null) {
  if (input) {
    return input;
  }

  try {
    return createAdminClient() as any;
  } catch {
    return null;
  }
}

function hasToolPermission(
  permissions: string[] | null | undefined,
  requiredPermission: string,
) {
  if (!permissions?.length) {
    return true;
  }

  const normalized = permissions.map((permission) => permission.trim().toLowerCase());

  return normalized.some((permission) => {
    if (OWNER_PERMISSION_TOKENS.has(permission)) {
      return true;
    }

    if (permission === "*" || permission === "ai.tools.*") {
      return true;
    }

    if (permission === requiredPermission.toLowerCase()) {
      return true;
    }

    const [domain] = requiredPermission.toLowerCase().split(".");

    return permission === `${domain}.*`;
  });
}

function normalizeSearchText(value: string | null | undefined) {
  return cleanAiText(value, 400)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function recordAiToolExecution(args: {
  actorUserId?: string | null;
  client?: any | null;
  conversationId?: string | null;
  durationMs: number;
  errorDetail?: string | null;
  inputPayload: Record<string, unknown>;
  outputPayload?: Record<string, unknown> | null;
  salonId: string;
  status: "blocked" | "failed" | "succeeded";
  toolId: AiToolId;
  toolLabel: string;
}) {
  const admin = resolveAiToolAdminClient(args.client ?? null);

  if (!admin) {
    return;
  }

  try {
    const insertResult = await admin.from("ai_tool_logs").insert({
      actor_user_id: args.actorUserId ?? null,
      created_at: new Date().toISOString(),
      error_detail: cleanAiText(args.errorDetail, 2000) || null,
      input_payload: {
        ...args.inputPayload,
        conversationKey: cleanAiText(args.conversationId, 80) || null,
      },
      output_payload: args.outputPayload ?? null,
      salon_id: args.salonId,
      status: args.status,
      tool_id: args.toolId,
      tool_label: args.toolLabel,
      duration_ms: Math.max(0, Math.round(args.durationMs)),
    });

    if (insertResult.error) {
      throw insertResult.error;
    }
  } catch (error) {
    if (!relationIsMissing(error as { code?: string | null; message?: string | null })) {
      return;
    }
  }
}

async function executeGetAgendaTool(
  args: ExecutePanelAssistantToolArgs<"getAgenda">,
): Promise<PanelAssistantToolResultMap["getAgenda"]> {
  const timeZone = args.salon.timezone ?? "America/Sao_Paulo";
  const appointmentRange = args.input.dayKey
    ? getUtcRangeForLocalDate(args.input.dayKey, timeZone)
    : null;
  const [staffResult, servicesResult, appointmentsResult] = await Promise.all([
    args.supabase
      .from("staff_members")
      .select("id,name,is_active")
      .eq("salon_id", args.salon.id)
      .eq("is_active", true)
      .order("name", { ascending: true }),
    args.input.includeServices === false
      ? Promise.resolve({ data: [], error: null })
      : args.supabase
          .from("services")
          .select("id,name,price,duration,category")
          .eq("salon_id", args.salon.id)
          .eq("is_active", true)
          .order("name", { ascending: true }),
    args.input.includeAppointments && appointmentRange
      ? args.supabase
          .from("appointments")
          .select("customer_id,date,ends_at,staff_member_id,status")
          .eq("salon_id", args.salon.id)
          .gte("date", appointmentRange.start.toISOString())
          .lt("date", appointmentRange.end.toISOString())
          .in("status", ["pending", "confirmed"])
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (staffResult.error) {
    throw staffResult.error;
  }
  if (servicesResult.error) {
    throw servicesResult.error;
  }
  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  return {
    appointments: (appointmentsResult.data ?? []) as AgendaAppointmentRow[],
    dayKey: args.input.dayKey ?? null,
    services: (servicesResult.data ?? []) as ServiceRow[],
    staffMembers: (staffResult.data ?? []) as StaffMemberRow[],
  };
}

async function executeGetProfissionaisDisponiveisTool(
  args: ExecutePanelAssistantToolArgs<"getProfissionaisDisponiveis">,
): Promise<PanelAssistantToolResultMap["getProfissionaisDisponiveis"]> {
  const query = args.supabase
    .from("staff_members")
    .select("id,name,is_active")
    .eq("salon_id", args.salon.id)
    .order("name", { ascending: true });

  const result = args.input.onlyActive === false
    ? await query
    : await query.eq("is_active", true);

  if (result.error) {
    throw result.error;
  }

  return {
    staffMembers: (result.data ?? []) as StaffMemberRow[],
  };
}

async function executeGetFaturamentoTool(
  args: ExecutePanelAssistantToolArgs<"getFaturamento">,
): Promise<PanelAssistantToolResultMap["getFaturamento"]> {
  const periodStart = args.input.previousPeriodStart ?? args.input.periodStart;
  const [appointmentsResult, paymentsResult] = await Promise.all([
    args.supabase
      .from("appointments")
      .select(
        "date,completed_at,customer_id,service_id,staff_member_id,service_price_snapshot,services(name,category,price)",
      )
      .eq("salon_id", args.salon.id)
      .eq("status", "completed")
      .gte("completed_at", periodStart)
      .lt("completed_at", args.input.periodEnd)
      .order("completed_at", { ascending: false })
      .limit(2000),
    args.supabase
      .from("appointment_payments")
      .select("amount,paid_at")
      .eq("salon_id", args.salon.id)
      .gte("paid_at", periodStart)
      .lt("paid_at", args.input.periodEnd)
      .order("paid_at", { ascending: false })
      .limit(2000),
  ]);

  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }
  if (paymentsResult.error) {
    throw paymentsResult.error;
  }

  return {
    appointments: (appointmentsResult.data ?? []) as FinanceAppointmentRow[],
    payments: (paymentsResult.data ?? []) as AppointmentPaymentRow[],
  };
}

async function executeGetClientesInativosTool(
  args: ExecutePanelAssistantToolArgs<"getClientesInativos">,
): Promise<PanelAssistantToolResultMap["getClientesInativos"]> {
  const inactiveDays = Math.max(args.input.inactiveDays ?? 60, 15);
  const limit = Math.min(Math.max(args.input.limit ?? 20, 1), 100);
  const lookbackStart = new Date(
    Date.now() - Math.max(inactiveDays + 120, 180) * 24 * 60 * 60 * 1000,
  );
  const [customersResult, appointmentsResult] = await Promise.all([
    args.supabase
      .from("customers")
      .select("id,name,phone,email,created_at")
      .eq("salon_id", args.salon.id)
      .order("name", { ascending: true }),
    args.supabase
      .from("appointments")
      .select("customer_id,date,completed_at,status,service_price_snapshot")
      .eq("salon_id", args.salon.id)
      .eq("status", "completed")
      .gte("date", lookbackStart.toISOString())
      .order("date", { ascending: false })
      .limit(3000),
  ]);

  if (customersResult.error) {
    throw customersResult.error;
  }
  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  const historyByCustomerId = new Map<
    string,
    {
      completedVisits: number;
      lastVisitAt: string | null;
      totalSpent: number;
    }
  >();

  for (const appointment of (appointmentsResult.data ?? []) as CustomerHistoryRow[]) {
    if (!appointment.customer_id) {
      continue;
    }

    const current = historyByCustomerId.get(appointment.customer_id) ?? {
      completedVisits: 0,
      lastVisitAt: null,
      totalSpent: 0,
    };
    current.completedVisits += 1;
    current.lastVisitAt = current.lastVisitAt ?? appointment.completed_at ?? appointment.date;
    current.totalSpent += resolveBookedAppointmentAmount({
      servicePrice: null,
      servicePriceSnapshot: appointment.service_price_snapshot,
    });
    historyByCustomerId.set(appointment.customer_id, current);
  }

  const customers = ((customersResult.data ?? []) as CustomerRow[])
    .map((customer) => {
      const history = historyByCustomerId.get(customer.id) ?? {
        completedVisits: 0,
        lastVisitAt: null,
        totalSpent: 0,
      };
      const daysSinceLastVisit = history.lastVisitAt
        ? Math.max(
            0,
            Math.round(
              (Date.now() - new Date(history.lastVisitAt).getTime()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;

      return {
        ...customer,
        completedVisits: history.completedVisits,
        daysSinceLastVisit,
        lastVisitAt: history.lastVisitAt,
        totalSpent: history.totalSpent,
      };
    })
    .filter((customer) => customer.daysSinceLastVisit == null || customer.daysSinceLastVisit >= inactiveDays)
    .sort((left, right) => {
      const leftDays = left.daysSinceLastVisit ?? Number.MAX_SAFE_INTEGER;
      const rightDays = right.daysSinceLastVisit ?? Number.MAX_SAFE_INTEGER;

      if (rightDays !== leftDays) {
        return rightDays - leftDays;
      }

      return right.completedVisits - left.completedVisits;
    })
    .slice(0, limit);

  return {
    customers,
  };
}

async function executeGetCancelamentosTool(
  args: ExecutePanelAssistantToolArgs<"getCancelamentos">,
): Promise<PanelAssistantToolResultMap["getCancelamentos"]> {
  const result = await args.supabase
    .from("appointments")
    .select("id,date,cancelled_at,customer_id,status")
    .eq("salon_id", args.salon.id)
    .eq("status", "cancelled")
    .gte("cancelled_at", args.input.periodStart)
    .lt("cancelled_at", args.input.periodEnd)
    .order("cancelled_at", { ascending: false })
    .limit(Math.min(Math.max(args.input.limit ?? 50, 1), 200));

  if (result.error) {
    throw result.error;
  }

  return {
    cancellations: (result.data ?? []) as CancellationRow[],
  };
}

async function executeGetCustomerSummaryTool(
  args: ExecutePanelAssistantToolArgs<"getCustomerSummary">,
): Promise<PanelAssistantToolResultMap["getCustomerSummary"]> {
  const normalizedSearch = normalizeSearchText(args.input.searchTerm);

  if (!normalizedSearch) {
    return {
      appointments: [],
      customer: null,
      customers: [],
      searchTerm: args.input.searchTerm,
    };
  }

  let customer: CustomerRow | null = null;
  let customers: CustomerRow[] = [];

  if (args.input.customerId) {
    const customerResult = await args.supabase
      .from("customers")
      .select("id,name,phone,email,created_at")
      .eq("salon_id", args.salon.id)
      .eq("id", args.input.customerId)
      .limit(1);

    if (customerResult.error) {
      throw customerResult.error;
    }

    customers = (customerResult.data ?? []) as CustomerRow[];
    customer = customers[0] ?? null;
  } else {
    const customerResult = await args.supabase
      .from("customers")
      .select("id,name,phone,email,created_at")
      .eq("salon_id", args.salon.id)
      .ilike("name", `%${args.input.searchTerm}%`)
      .order("name", { ascending: true })
      .limit(5);

    if (customerResult.error) {
      throw customerResult.error;
    }

    customers = (customerResult.data ?? []) as CustomerRow[];
    customer =
      customers.find(
        (item) => normalizeSearchText(item.name) === normalizedSearch,
      ) ??
      customers.find((item) =>
        normalizeSearchText(item.name).startsWith(normalizedSearch),
      ) ??
      customers[0] ??
      null;
  }

  if (!customer) {
    return {
      appointments: [],
      customer: null,
      customers,
      searchTerm: args.input.searchTerm,
    };
  }

  const appointmentsResult = await args.supabase
    .from("appointments")
    .select(
      "date,completed_at,status,service_price_snapshot,services(name,category,price),staff_members(name)",
    )
    .eq("salon_id", args.salon.id)
    .eq("customer_id", customer.id)
    .order("date", { ascending: false })
    .limit(120);

  if (appointmentsResult.error) {
    throw appointmentsResult.error;
  }

  return {
    appointments: (appointmentsResult.data ?? []) as CustomerSummaryAppointmentRow[],
    customer,
    customers,
    searchTerm: args.input.searchTerm,
  };
}

async function executeGetHorariosVagosTool(
  args: ExecutePanelAssistantToolArgs<"getHorariosVagos">,
): Promise<PanelAssistantToolResultMap["getHorariosVagos"]> {
  if (!args.input.serviceId) {
    return {
      dayKey: args.input.dayKey,
      slots: [],
    };
  }

  const result = await args.supabase.rpc("get_available_staff_slots_for_service", {
    service_uuid: args.input.serviceId,
    target_day: args.input.dayKey,
  });

  if (result.error) {
    throw new Error("availability_lookup_failed");
  }

  return {
    dayKey: args.input.dayKey,
    slots: (result.data ?? []) as AvailableStaffSlot[],
  };
}

async function executeSugerirEncaixesTool(
  args: ExecutePanelAssistantToolArgs<"sugerirEncaixes">,
): Promise<PanelAssistantToolResultMap["sugerirEncaixes"]> {
  return generateRecoveryCampaign({
    question: args.input.question,
    requestOrigin: args.requestOrigin,
    salon: args.salon,
    supabase: args.supabase,
  });
}

async function executeCriarCampanhaTool(
  args: ExecutePanelAssistantToolArgs<"criarCampanha">,
): Promise<PanelAssistantToolResultMap["criarCampanha"]> {
  return generateRecoveryCampaign({
    question: args.input.question ?? "Preencher agenda com IA amanha",
    requestOrigin: args.requestOrigin,
    salon: args.salon,
    supabase: args.supabase,
  });
}

export async function executePanelAssistantTool<TToolId extends AiToolId>(
  args: ExecutePanelAssistantToolArgs<TToolId>,
): Promise<PanelAssistantToolResultMap[TToolId]> {
  const definition = getPanelAssistantToolDefinition(args.toolId);
  const startedAt = Date.now();

  if (!hasToolPermission(args.permissions, definition.requiredPermission)) {
    await recordAiToolExecution({
      actorUserId: args.actorUserId,
      client: args.supabase ?? null,
      conversationId: args.conversationId,
      durationMs: Date.now() - startedAt,
      errorDetail: `missing_permission:${definition.requiredPermission}`,
      inputPayload: args.input as Record<string, unknown>,
      outputPayload: null,
      salonId: args.salon.id,
      status: "blocked",
      toolId: args.toolId,
      toolLabel: definition.label,
    });
    throw new Error("ai_tool_forbidden");
  }

  try {
    let result: PanelAssistantToolResultMap[TToolId];

    switch (args.toolId) {
      case "getAgenda":
        result = await executeGetAgendaTool(
          args as ExecutePanelAssistantToolArgs<"getAgenda">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "getProfissionaisDisponiveis":
        result = await executeGetProfissionaisDisponiveisTool(
          args as ExecutePanelAssistantToolArgs<"getProfissionaisDisponiveis">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "getFaturamento":
        result = await executeGetFaturamentoTool(
          args as ExecutePanelAssistantToolArgs<"getFaturamento">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "getClientesInativos":
        result = await executeGetClientesInativosTool(
          args as ExecutePanelAssistantToolArgs<"getClientesInativos">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "getCancelamentos":
        result = await executeGetCancelamentosTool(
          args as ExecutePanelAssistantToolArgs<"getCancelamentos">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "getCustomerSummary":
        result = await executeGetCustomerSummaryTool(
          args as ExecutePanelAssistantToolArgs<"getCustomerSummary">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "getHorariosVagos":
        result = await executeGetHorariosVagosTool(
          args as ExecutePanelAssistantToolArgs<"getHorariosVagos">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "sugerirEncaixes":
        result = await executeSugerirEncaixesTool(
          args as ExecutePanelAssistantToolArgs<"sugerirEncaixes">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      case "criarCampanha":
        result = await executeCriarCampanhaTool(
          args as ExecutePanelAssistantToolArgs<"criarCampanha">,
        ) as PanelAssistantToolResultMap[TToolId];
        break;
      default:
        throw new Error("unsupported_ai_tool");
    }

    await recordAiToolExecution({
      actorUserId: args.actorUserId,
      client: args.supabase ?? null,
      conversationId: args.conversationId,
      durationMs: Date.now() - startedAt,
      inputPayload: args.input as Record<string, unknown>,
      outputPayload:
        result && typeof result === "object"
          ? {
              keys: Object.keys(result as Record<string, unknown>).slice(0, 12),
            }
          : null,
      salonId: args.salon.id,
      status: "succeeded",
      toolId: args.toolId,
      toolLabel: definition.label,
    });

    return result;
  } catch (error) {
    await recordAiToolExecution({
      actorUserId: args.actorUserId,
      client: args.supabase ?? null,
      conversationId: args.conversationId,
      durationMs: Date.now() - startedAt,
      errorDetail:
        error instanceof Error && error.message.trim()
          ? error.message
          : "ai_tool_failed",
      inputPayload: args.input as Record<string, unknown>,
      outputPayload: null,
      salonId: args.salon.id,
      status: "failed",
      toolId: args.toolId,
      toolLabel: definition.label,
    });
    throw error;
  }
}
