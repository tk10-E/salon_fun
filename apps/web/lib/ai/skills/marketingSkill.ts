import type {
  AssistantDecisionFrame,
  AssistantOperationalContext,
  AssistantPriority,
} from "@/lib/ai/skills/types";

export function buildMarketingDecisionFrame(args: {
  missingData?: string[];
  operationalContext: AssistantOperationalContext | null;
  priority?: AssistantPriority;
}): AssistantDecisionFrame {
  if ((args.missingData ?? []).length > 0) {
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
      ],
      impact:
        "Sem base suficiente, a campanha tende a sair generica e com menos chance de retorno real.",
      operationalContext: args.operationalContext,
      priority: args.priority ?? "low",
      problem: "Nao encontrei dados suficientes para afirmar isso.",
      recommendedAction:
        "Revise publico, agenda e servicos antes de montar a campanha.",
      suggestion:
        "Comece por uma oferta simples, revisavel e apoiada pelos dados mais confiaveis do painel.",
    };
  }

  return {
    actions: [
      {
        href: "/dashboard/benefits/promotions?compose=1",
        kind: "primary",
        label: "Criar campanha",
      },
      {
        href: "/dashboard/benefits/promotions?compose=1&channel=whatsapp",
        kind: "secondary",
        label: "Gerar mensagem WhatsApp",
      },
      {
        href: "/dashboard/gestao/clientes",
        kind: "secondary",
        label: "Ver clientes",
      },
    ],
    impact:
      "A campanha certa, no momento certo, ajuda a subir a ocupacao sem depender so de desconto amplo.",
    operationalContext: args.operationalContext,
    priority: args.priority ?? "medium",
    problem:
      "Existe uma oportunidade comercial para puxar agenda ou aumentar recorrencia.",
    recommendedAction:
      "Transforme a sugestao em promocao revisada e publique so depois de conferir publico e margem.",
    suggestion:
      "Use texto curto, urgencia leve e um CTA simples para agendar sem parecer spam.",
  };
}
