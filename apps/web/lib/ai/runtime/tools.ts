import type { AssistantQuickAction } from "@/lib/ai/skills/types";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

import type { AiToolDefinition, AiToolId } from "./types";

function buildQuickAction(
  href: string,
  label: string,
  kind: AssistantQuickAction["kind"] = "primary",
) {
  return {
    href,
    kind,
    label,
  } satisfies AssistantQuickAction;
}

const PANEL_ASSISTANT_TOOL_REGISTRY: Record<AiToolId, AiToolDefinition> = {
  getAgenda: {
    description:
      "Consulta a agenda operacional do tenant por data, profissional e status.",
    id: "getAgenda",
    kind: "read",
    label: "Agenda",
    quickAction: buildQuickAction(MANAGEMENT_ROUTES.appointments, "Ver agenda"),
    requiredPermission: "agenda.read",
  },
  getCancelamentos: {
    description:
      "Lê cancelamentos recentes para orientar reencaixe e contenção de perda.",
    id: "getCancelamentos",
    kind: "read",
    label: "Cancelamentos",
    quickAction: buildQuickAction(
      `${MANAGEMENT_ROUTES.appointments}?status=cancelled`,
      "Ver cancelamentos",
      "secondary",
    ),
    requiredPermission: "appointments.read",
  },
  getCustomerSummary: {
    description:
      "Busca a cliente certa e consolida histórico operacional para CRM e retenção.",
    id: "getCustomerSummary",
    kind: "read",
    label: "Resumo da cliente",
    quickAction: buildQuickAction(
      `${MANAGEMENT_ROUTES.clients}`,
      "Ver cliente",
      "secondary",
    ),
    requiredPermission: "customers.read",
  },
  getClientesInativos: {
    description:
      "Lista clientes sem retorno recente para retenção e campanha segmentada.",
    id: "getClientesInativos",
    kind: "read",
    label: "Clientes inativos",
    quickAction: buildQuickAction(
      `${MANAGEMENT_ROUTES.clients}?segment=inactive`,
      "Ver clientes inativos",
      "secondary",
    ),
    requiredPermission: "customers.read",
  },
  getFaturamento: {
    description:
      "Consolida faturamento do período com base em atendimentos concluídos e pagamentos.",
    id: "getFaturamento",
    kind: "read",
    label: "Faturamento",
    quickAction: buildQuickAction("/dashboard/finance", "Ver faturamento"),
    requiredPermission: "finance.read",
  },
  getHorariosVagos: {
    description:
      "Lê a ociosidade real da agenda para detectar janelas com chance de encaixe.",
    id: "getHorariosVagos",
    kind: "read",
    label: "Horarios vagos",
    quickAction: buildQuickAction(
      `${MANAGEMENT_ROUTES.smartAgenda}?focus=vacancies`,
      "Ver horarios vagos",
      "secondary",
    ),
    requiredPermission: "agenda.read",
  },
  getProfissionaisDisponiveis: {
    description:
      "Mostra profissionais ativos com maior folga operacional no período analisado.",
    id: "getProfissionaisDisponiveis",
    kind: "read",
    label: "Profissionais",
    quickAction: buildQuickAction(
      MANAGEMENT_ROUTES.professionals,
      "Ver profissionais",
      "secondary",
    ),
    requiredPermission: "staff.read",
  },
  criarCampanha: {
    description:
      "Prepara rascunho de campanha comercial para revisão humana antes de publicar.",
    id: "criarCampanha",
    kind: "write",
    label: "Criar campanha",
    quickAction: buildQuickAction(
      "/dashboard/benefits/promotions?compose=1",
      "Criar campanha",
    ),
    requiredPermission: "campaigns.write",
  },
  sugerirEncaixes: {
    description:
      "Cruza vaga aberta, histórico recente e fit operacional para sugerir encaixes.",
    id: "sugerirEncaixes",
    kind: "read",
    label: "Sugerir encaixes",
    quickAction: buildQuickAction(
      `${MANAGEMENT_ROUTES.smartAgenda}?focus=fit`,
      "Sugerir encaixes",
      "secondary",
    ),
    requiredPermission: "agenda.read",
  },
};

const PANEL_ASSISTANT_TOOL_ORDER: AiToolId[] = [
  "getAgenda",
  "getClientesInativos",
  "criarCampanha",
  "getHorariosVagos",
  "getFaturamento",
  "getProfissionaisDisponiveis",
  "getCancelamentos",
  "sugerirEncaixes",
];

export function getPanelAssistantToolCatalog() {
  return PANEL_ASSISTANT_TOOL_ORDER.map(
    (toolId) => PANEL_ASSISTANT_TOOL_REGISTRY[toolId],
  );
}

export function getPanelAssistantToolDefinition(toolId: AiToolId) {
  return PANEL_ASSISTANT_TOOL_REGISTRY[toolId];
}
