import type {
  AssistantDecisionFrame,
  AssistantOperationalContext,
  AssistantPriority,
} from "@/lib/ai/skills/types";

export function buildOccupancyDecisionFrame(args: {
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
          href: "/dashboard/gestao/agendamentos",
          kind: "primary",
          label: "Ver agenda",
        },
        {
          href: "/dashboard/finance",
          kind: "secondary",
          label: "Ver faturamento",
        },
      ],
      impact:
        "Sem historico suficiente, a equipe pode reagir cedo demais ou ignorar uma queda real de movimento.",
      operationalContext: args.operationalContext,
      priority: args.priority ?? "low",
      problem: "Nao encontrei dados suficientes para afirmar isso.",
      recommendedAction:
        "Confirme agenda, historico e financeiro antes de tratar isso como tendencia.",
      suggestion:
        "Use uma acao leve e reversivel ate o painel acumular base melhor.",
    };
  }

  const weakWindow =
    args.summary.includes("abaixo do ritmo") ||
    args.summary.includes("vaga aberta") ||
    args.summary.includes("fraco");

  return {
    actions: [
      {
        href: "/dashboard/gestao/agendamentos",
        kind: "primary",
        label: "Ver agenda",
      },
      {
        href: "/dashboard/benefits/promotions?compose=1",
        kind: "secondary",
        label: "Criar campanha",
      },
      {
        href: "/dashboard/finance",
        kind: "secondary",
        label: "Ver faturamento",
      },
    ],
    impact: weakWindow
      ? "Janela ociosa pesa direto na ocupacao e deixa faturamento parado onde o salao costuma vender melhor."
      : "Entender a ocupacao cedo ajuda a distribuir equipe, confirmacoes e campanhas sem correr atras depois.",
    operationalContext: args.operationalContext,
    priority: args.priority ?? (weakWindow ? "high" : "medium"),
    problem: weakWindow
      ? "Existe uma faixa com pouca tracao pedindo acao rapida."
      : "O ritmo esta estavel, mas ainda vale acompanhar os proximos dias para agir antes de esfriar.",
    recommendedAction: weakWindow
      ? "Abra a agenda, valide essa janela e priorize uma acao curta para quem tem mais chance de encaixe."
      : "Continue acompanhando a ocupacao por dia e horario e reaja cedo se a agenda comecar a abrir demais.",
    suggestion: weakWindow
      ? "Comece por clientes com historico compativel e profissional certo, em vez de falar com a base inteira."
      : "Use essa leitura junto da agenda do dia para reforcar so os pontos que realmente precisam de atencao.",
  };
}
