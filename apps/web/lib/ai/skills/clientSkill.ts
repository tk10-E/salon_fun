import type {
  AssistantDecisionFrame,
  AssistantOperationalContext,
  AssistantPriority,
} from "@/lib/ai/skills/types";

export function buildClientDecisionFrame(args: {
  clientId: string | null;
  missingData?: string[];
  operationalContext: AssistantOperationalContext | null;
  priority?: AssistantPriority;
}): AssistantDecisionFrame {
  if ((args.missingData ?? []).length > 0) {
    return {
      actions: [
        {
          href: "/dashboard/gestao/clientes",
          kind: "primary",
          label: "Ver clientes",
        },
        {
          href: "/dashboard/benefits/promotions?compose=1",
          kind: "secondary",
          label: "Criar campanha",
        },
      ],
      impact:
        "Sem historico suficiente da cliente, qualquer abordagem fica generica e menos confiavel.",
      operationalContext: args.operationalContext,
      priority: args.priority ?? "low",
      problem: "Nao encontrei dados suficientes para afirmar isso.",
      recommendedAction:
        "Abra a lista de clientes, confirme o cadastro certo e revise o historico antes do contato.",
      suggestion:
        "Use uma abordagem conservadora ate validar ultima visita, servico e agenda futura.",
    };
  }

  return {
    actions: [
      {
        href: args.clientId
          ? `/dashboard/gestao/clientes?clientId=${args.clientId}`
          : "/dashboard/gestao/clientes",
        kind: "primary",
        label: "Ver clientes",
      },
      {
        href: "/dashboard/benefits/promotions?compose=1&channel=whatsapp",
        kind: "secondary",
        label: "Gerar mensagem WhatsApp",
      },
      {
        href: "/dashboard/gestao/agendamentos",
        kind: "secondary",
        label: "Ver agenda",
      },
    ],
    impact:
      "Quando o historico mostra retorno, servico favorito e ticket medio, fica mais facil abordar a cliente certa sem insistencia generica.",
    operationalContext: args.operationalContext,
    priority: args.priority ?? "medium",
    problem:
      "O cadastro ja tem sinais uteis, mas eles precisam virar leitura pratica para a proxima abordagem.",
    recommendedAction:
      "Abra o cadastro da cliente e use esse resumo para definir se o melhor caminho e retorno, manutencao ou upsell.",
    suggestion:
      "Fale com contexto. Puxe pela ultima visita, pelo servico com mais recorrencia e pelo momento certo de voltar.",
  };
}
