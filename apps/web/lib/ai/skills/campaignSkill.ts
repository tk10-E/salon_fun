import type {
  AssistantDecisionFrame,
  AssistantOperationalContext,
  AssistantPriority,
} from "@/lib/ai/skills/types";

export function buildCampaignDecisionFrame(args: {
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
          href: "/dashboard/benefits/promotions?compose=1",
          kind: "secondary",
          label: "Criar campanha",
        },
      ],
      impact:
        "Sem janela ociosa ou publico confiavel, a campanha corre o risco de sair ampla demais e vender pouco.",
      operationalContext: args.operationalContext,
      priority: args.priority ?? "low",
      problem: "Nao encontrei dados suficientes para afirmar isso.",
      recommendedAction:
        "Confirme horarios vagos, servico foco e publico antes de gerar a campanha.",
      suggestion:
        "Deixe a IA so como rascunho e valide manualmente o disparo.",
    };
  }

  const available =
    !args.summary.includes("Ainda nao existe") &&
    !args.summary.includes("Sem campanha");

  return {
    actions: [
      {
        href: "/dashboard/benefits/promotions?compose=1",
        kind: "primary",
        label: "Criar campanha",
      },
      {
        href: "/dashboard/gestao/clientes",
        kind: "secondary",
        label: "Ver clientes",
      },
      {
        href: "/dashboard/benefits/promotions?compose=1&channel=whatsapp",
        kind: "secondary",
        label: "Gerar mensagem WhatsApp",
      },
    ],
    impact: available
      ? "Essa campanha pode recuperar uma janela especifica sem mexer no restante da semana."
      : "Sem uma oportunidade clara, a campanha tende a sair generica e perder forca.",
    operationalContext: args.operationalContext,
    priority: args.priority ?? (available ? "high" : "low"),
    problem: available
      ? "Existe uma combinacao boa entre horario vazio e publico com chance real de retorno."
      : "Ainda nao apareceu um cenario forte o bastante para justificar disparo agora.",
    recommendedAction: available
      ? "Revise o rascunho, ajuste desconto e mensagem e publique so depois da confirmacao humana."
      : "Segure o disparo por enquanto e acompanhe a agenda ate aparecer uma janela mais promissora.",
    suggestion: available
      ? "Comece pelas clientes com melhor aderencia ao servico e motivo claro para voltar."
      : "Enquanto isso, fortaleca historico, segmentacao e conteudo para a proxima campanha sair mais precisa.",
  };
}
