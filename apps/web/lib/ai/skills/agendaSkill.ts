import type {
  AssistantDecisionFrame,
  AssistantOperationalContext,
  AssistantPriority,
  AssistantQuickAction,
} from "@/lib/ai/skills/types";

function buildAgendaActions(href: string | null): AssistantQuickAction[] {
  const agendaHref = href || "/dashboard/gestao/agendamentos";

  return [
    {
      href: agendaHref,
      kind: "primary",
      label: "Ver agenda",
    },
    {
      href: agendaHref,
      kind: "secondary",
      label: "Ver horarios vagos",
    },
    {
      href: "/dashboard/gestao/clientes",
      kind: "secondary",
      label: "Ver clientes",
    },
  ];
}

export function buildAgendaDecisionFrame(args: {
  ctaHref: string | null;
  missingData?: string[];
  operationalContext: AssistantOperationalContext | null;
  priority?: AssistantPriority;
  summary: string;
}): AssistantDecisionFrame {
  const missingData = args.missingData ?? [];

  if (missingData.length > 0) {
    return {
      actions: buildAgendaActions(args.ctaHref),
      impact:
        "Sem leitura suficiente da agenda, o risco agora e prometer um encaixe que o sistema nao confirmou.",
      operationalContext: args.operationalContext,
      priority: args.priority ?? "low",
      problem: "Nao encontrei dados suficientes para afirmar isso.",
      recommendedAction:
        "Abra a agenda do dia e confirme equipe, horarios e servicos antes de responder ao cliente.",
      suggestion:
        "Use a agenda real como fonte final para qualquer horario ou profissional prometido.",
    };
  }

  const noSlots =
    args.summary.includes("nao encontrei") ||
    args.summary.includes("sem espaco livre") ||
    args.summary.includes("agenda bem ocupada");

  return {
    actions: buildAgendaActions(args.ctaHref),
    impact: noSlots
      ? "Sem um encaixe claro, a equipe corre o risco de perder a venda ou prometer um horario ruim."
      : "Quando o painel mostra quem esta mais livre, fica mais facil fechar o horario certo sem criar conflito.",
    operationalContext: args.operationalContext,
    priority: args.priority ?? (noSlots ? "medium" : "low"),
    problem: noSlots
      ? "Hoje a agenda esta mais apertada para esse pedido."
      : "Ja existe espaco para encaixe, mas vale usar a leitura certa da agenda.",
    recommendedAction: noSlots
      ? "Abra a agenda, confirme os intervalos reais e so depois ofereca uma alternativa."
      : "Abra a agenda do dia e priorize o profissional com mais espaco para fechar esse atendimento.",
    suggestion: noSlots
      ? "Se nao houver encaixe bom, ofereca outro dia ou outra profissional com disponibilidade proxima."
      : "Use essa leitura para confirmar rapido, reduzir espera e aproveitar melhor a equipe.",
  };
}
