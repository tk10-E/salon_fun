import type {
  AssistantDecisionFrame,
  AssistantOperationalContext,
  AssistantPriority,
} from "@/lib/ai/skills/types";

export function buildFinanceDecisionFrame(args: {
  missingData?: string[];
  operationalContext: AssistantOperationalContext | null;
  priority?: AssistantPriority;
  summary: string;
}): AssistantDecisionFrame {
  const missingData = args.missingData ?? [];

  if (missingData.length > 0) {
    return {
      actions: [
        {
          href: "/dashboard/finance",
          kind: "primary",
          label: "Ver faturamento",
        },
        {
          href: "/dashboard/gestao/agendamentos",
          kind: "secondary",
          label: "Ver agenda",
        },
      ],
      impact:
        "Sem base financeira suficiente, qualquer leitura de queda ou alta vira chute e pode levar a uma decisao ruim.",
      operationalContext: args.operationalContext,
      priority: args.priority ?? "low",
      problem: "Nao encontrei dados suficientes para afirmar isso.",
      recommendedAction:
        "Abra o financeiro e confirme o periodo, os recebimentos e os atendimentos concluidos antes de agir.",
      suggestion:
        "Cruze faturamento com agenda e servicos antes de abrir campanha ou desconto.",
    };
  }

  const falling =
    args.summary.includes("caiu") || args.summary.includes("abaixo");

  return {
    actions: [
      {
        href: "/dashboard/finance",
        kind: "primary",
        label: "Ver faturamento",
      },
      {
        href: "/dashboard/benefits/promotions?compose=1",
        kind: "secondary",
        label: "Criar campanha",
      },
      {
        href: "/dashboard/gestao/agendamentos",
        kind: "secondary",
        label: "Ver agenda",
      },
    ],
    impact: falling
      ? "Quando o faturamento perde ritmo, o impacto aparece no caixa, na comissao e na ocupacao da equipe."
      : "Uma leitura financeira clara ajuda a decidir onde acelerar venda e onde proteger margem.",
    operationalContext: args.operationalContext,
    priority: args.priority ?? (falling ? "high" : "medium"),
    problem: falling
      ? "O faturamento perdeu forca no comparativo recente."
      : "O financeiro esta sob controle, mas ainda pede atencao para manter margem e ocupacao saudaveis.",
    recommendedAction: falling
      ? "Abra o financeiro, veja onde a queda apareceu e monte uma acao enxuta para a janela mais vazia."
      : "Cruze financeiro, agenda e marketing antes de decidir a proxima campanha.",
    suggestion: falling
      ? "Ataque primeiro o servico ou a categoria que caiu, sem espalhar desconto para tudo."
      : "Mantenha o foco em ticket, recebimento e recorrencia antes de ampliar promocao.",
  };
}
