import type {
  AssistantSkillDefinition,
  PanelAssistantIntent,
} from "@/lib/ai/skills/types";
import { AI_FEATURE_REGISTRY } from "@/lib/ai/registry";

export const PANEL_ASSISTANT_POLICY_VERSION =
  AI_FEATURE_REGISTRY.panelAssistant.policyVersion;

const PANEL_ASSISTANT_SKILL_ORDER: PanelAssistantIntent[] = [
  "recovery_campaign",
  "promotion_strategy",
  "vacancy_strategy",
  "movement_forecast",
  "finance_analysis",
  "customer_summary",
  "panel_help",
  "schedule_availability",
];

const PANEL_ASSISTANT_FOLLOW_UP_PREFIXES = [
  "e ",
  "amanhã",
  "hoje",
  "semana que vem",
  "proxima semana",
  "na sexta",
  "sexta feira",
  "sexta",
  "quinta feira",
  "quinta",
  "quarta feira",
  "quarta",
  "terça feira",
  "terça",
  "segunda feira",
  "segunda",
] as const;

const PANEL_ASSISTANT_SKILLS = {
  schedule_availability: {
    decisionSections: [
      { field: "problem", label: "Leitura do dia", tone: "problem" },
      { field: "impact", label: "O que isso muda", tone: "impact" },
      { field: "suggestion", label: "Melhor caminho", tone: "suggestion" },
      { field: "recommendedAction", label: "Próximo passo", tone: "action" },
    ],
    guardrails: [
      "Nunca invente disponibilidade.",
      "Nunca confirme horário sem leitura real da agenda.",
      "Se faltar dado, responda com cautela e oriente a abrir a agenda.",
    ],
    intent: "schedule_availability",
    label: "Agenda",
    objective:
      "Ler disponibilidade real, profissional mais livre e melhor encaixe sem prometer o que a agenda não comporta.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "A sexta ainda tem espaço no fim da tarde.",
            "A profissional mais livre segura melhor os encaixes desse período.",
          ],
          followUp:
            "Se quiser, eu monto uma ação curta só para essa faixa.",
          impact:
            "Se essa janela continuar aberta, o salão perde faturamento justamente no horário mais valioso do dia.",
          problem:
            "A agenda não está crítica, mas ainda sobra espaço em uma faixa que costuma vender bem.",
          recommendedAction:
            "Abra a agenda de sexta e trabalhe primeiro o fim da tarde com a profissional mais livre.",
          suggestion:
            "Priorize confirmações pendentes e encaixes rápidos antes de pensar em desconto.",
          summary:
            "A sexta ainda tem espaço útil, principalmente no fim da tarde, então vale atuar primeiro na agenda antes de abrir campanha.",
          title: "Sexta ainda tem espaço útil",
        },
        question: "Como está sexta?",
      },
    ],
    routingTerms: [
      "agenda",
      "agendamento",
      "horario",
      "horarios",
      "horario vago",
      "horarios vagos",
      "disponivel",
      "mais livre",
      "profissional livre",
      "profissional mais livre",
      "livre hoje",
      "livre amanha",
    ],
    suggestedQuestions: [
      "Qual profissional tem mais horários livres hoje?",
      "E amanhã?",
      "Como está sexta?",
    ],
    summary:
      "Ajuda a recepção a responder rápido sobre horários, encaixes e distribuição da equipe.",
    writingDirectives: [
      "Soe como uma recepção experiente que responde com clareza e segurança.",
      "Priorize resposta curta, direta e específica sobre horário, profissional e chance de encaixe.",
      "Se houver espaço, termine apontando a melhor alternativa imediata.",
    ],
  },
  vacancy_strategy: {
    decisionSections: [
      { field: "problem", label: "Vaga aberta", tone: "problem" },
      { field: "impact", label: "Oportunidade", tone: "impact" },
      {
        field: "suggestion",
        label: "Quem faz mais sentido",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Próximo passo", tone: "action" },
    ],
    guardrails: [
      "Priorize encaixe com horário real e profissional compatível.",
      "Não trate cancelamento como venda perdida sem olhar lista de espera e histórico.",
      "Se a vaga não for clara, recomende revisão humana na agenda.",
    ],
    intent: "vacancy_strategy",
    label: "Reencaixe",
    objective:
      "Transformar vaga aberta em oportunidade de encaixe com cliente e profissional certos.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "A vaga abriu em um horário com boa chance de reação.",
            "As melhores clientes são as que já fizeram esse serviço e estão há mais tempo sem voltar.",
          ],
          followUp:
            "Se quiser, eu já deixo a mensagem pronta para as três melhores clientes.",
          impact:
            "Preencher essa janela rápido evita ociosidade e protege o faturamento sem desorganizar o restante da agenda.",
          problem:
            "Existe uma vaga aberta que pode ser recuperada, mas ela pede um contato mais certeiro do que um disparo genérico.",
          recommendedAction:
            "Abra a agenda, valide a janela e chame primeiro quem tem histórico compatível com o serviço e a profissional.",
          suggestion:
            "Comece por clientes com maior aderência ao serviço e tempo de retorno mais maduro.",
          summary:
            "Essa vaga tem boa chance de reencaixe se o contato for cirúrgico e rápido, focado nas clientes certas.",
          title: "Vaga boa para reencaixe",
        },
        question: "Quem posso chamar para uma vaga aberta hoje?",
      },
    ],
    routingTerms: [
      "vaga aberta",
      "lista de espera",
      "encaixe",
      "reencaixe",
      "reencaixar",
      "quem chamar",
      "clientes para chamar",
      "cancelou",
      "cancelamento",
      "cancelamentos",
      "buraco na agenda",
    ],
    suggestedQuestions: [
      "Quem posso chamar para uma vaga aberta?",
      "Quem encaixa melhor nesse cancelamento de hoje?",
    ],
    summary:
      "Ajuda a preencher espaços abertos sem gerar conflito na operação.",
    writingDirectives: [
      "Fale como quem quer preencher a vaga certa, e não apenas disparar mensagens.",
      "Mostre por que a cliente ou profissional sugeridos fazem sentido.",
      "Evite respostas frias ou genéricas.",
    ],
  },
  movement_forecast: {
    decisionSections: [
      { field: "problem", label: "Leitura de ritmo", tone: "problem" },
      {
        field: "impact",
        label: "Por que olhar isso agora",
        tone: "impact",
      },
      {
        field: "suggestion",
        label: "Ajuste recomendado",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Próxima ação", tone: "action" },
    ],
    guardrails: [
      "Use leitura de tendência, não promessa de faturamento futuro.",
      "Se a base estiver fraca, deixe isso explícito.",
      "Priorize ação simples: campanha curta, ajuste de equipe ou confirmação.",
    ],
    intent: "movement_forecast",
    label: "Previsão",
    objective:
      "Detectar dias e faixas com baixo ritmo antes que a agenda esfrie demais.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "A quarta-feira está puxando menos movimento do que o restante da semana.",
            "O fim da manhã é a faixa que mais abre espaço no histórico recente.",
          ],
          followUp:
            "Se quiser, eu transformo essa leitura em campanha ou ajuste de agenda.",
          impact:
            "Agir cedo nesse ponto evita que a queda apareça depois no caixa e na ocupação da equipe.",
          problem:
            "A semana não está ruim, mas existe um ponto claro de perda de ritmo que merece atenção antes de virar problema maior.",
          recommendedAction:
            "Trabalhe primeiro a quarta no fim da manhã, com confirmação ativa ou ação comercial leve.",
          suggestion:
            "Ataque a faixa mais fraca com medida curta, em vez de mexer na semana inteira.",
          summary:
            "A quarta-feira está abaixo do restante da semana e já vale um ajuste simples antes que a agenda esfrie mais.",
          title: "Quarta pede reação leve",
        },
        question: "Qual dia está mais fraco nesta semana?",
      },
    ],
    routingTerms: [
      "baixo movimento",
      "queda de movimento",
      "movimento fraco",
      "fraco",
      "baixo fluxo",
      "sazonal",
      "previs",
      "dia fraco",
      "semana fraca",
      "score gerencial",
      "diagnostico operacional",
      "alertas",
      "oportunidades",
      "operacao do salao",
      "como esta a operacao",
      "como esta meu salao",
      "resumo da operacao",
      "leitura geral do salao",
      "como esta o desempenho",
      "diagnostico do salao",
    ],
    suggestedQuestions: [
      "Qual dia da semana está mais fraco?",
      "Como está sexta?",
    ],
    summary:
      "Ajuda a agir antes da queda de ocupação ficar visível no caixa.",
    writingDirectives: [
      "Soe como leitura executiva de operação, sem drama e sem exagero.",
      "Traga um recado claro: onde o ritmo caiu e o que vale fazer primeiro.",
      "Evite parecer previsão vaga ou chute de mercado.",
    ],
  },
  recovery_campaign: {
    decisionSections: [
      { field: "problem", label: "Janela para recuperar", tone: "problem" },
      {
        field: "impact",
        label: "Potencial de retorno",
        tone: "impact",
      },
      {
        field: "suggestion",
        label: "Estratégia sugerida",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Como avançar", tone: "action" },
    ],
    guardrails: [
      "Não dispare campanha automaticamente.",
      "Sempre considere margem, horário vago real e público com chance de retorno.",
      "Se não houver sinal forte, prefira não sugerir disparo.",
    ],
    intent: "recovery_campaign",
    label: "Campanha IA",
    objective:
      "Montar ação de recuperação para preencher horários vazios com público de maior chance.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "Amanhã existe uma janela com espaço real e profissional disponível.",
            "O público sugerido já tem histórico compatível e chance concreta de retorno.",
          ],
          followUp:
            "Se quiser, eu deixo o rascunho pronto para revisão antes do envio.",
          impact:
            "Essa campanha pode recuperar agenda sem espalhar desconto para a base inteira.",
          problem:
            "Há uma janela ociosa com boa chance de reação, mas ela precisa de uma oferta bem posicionada.",
          recommendedAction:
            "Revise a campanha, valide desconto e mensagem e publique só depois da sua confirmação.",
          suggestion:
            "Comece pelas clientes com melhor encaixe de serviço, timing e profissional.",
          summary:
            "Amanhã existe uma oportunidade boa de recuperar a agenda com campanha curta e público mais provável de voltar.",
          title: "Campanha com boa chance de retorno",
        },
        question: "Qual campanha ajuda a preencher os horários vagos de amanhã?",
      },
    ],
    routingTerms: [
      "preencher agenda",
      "campanha inteligente",
      "horario vazio",
      "horarios vazios",
      "profissional ocioso",
      "reativar agenda",
      "retencao",
      "reativacao",
      "clientes sumidos",
    ],
    suggestedQuestions: [
      "Preencher agenda com IA amanhã",
      "Qual campanha ajuda a recuperar os horários vagos de amanhã?",
    ],
    summary:
      "Transforma leitura de ociosidade em campanha revisável antes do envio.",
    writingDirectives: [
      "Escreva como um estrategista comercial pragmático.",
      "Mostre por que a campanha faz sentido agora, sem parecer propaganda vazia.",
      "Mantenha o foco em agenda, público e retorno provável.",
    ],
  },
  customer_summary: {
    decisionSections: [
      { field: "problem", label: "Leitura da cliente", tone: "problem" },
      { field: "impact", label: "Oportunidade", tone: "impact" },
      {
        field: "suggestion",
        label: "Abordagem sugerida",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Próximo contato", tone: "action" },
    ],
    guardrails: [
      "Fale só do cliente pedido e com base em histórico real.",
      "Não exponha dado sensível além do necessário.",
      "Se houver ambiguidade no nome, oriente a abrir a lista de clientes.",
    ],
    intent: "customer_summary",
    label: "Clientes",
    objective:
      "Resumir retorno, serviço favorito, ticket e oportunidade de relacionamento para a cliente certa.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "A cliente já tem histórico suficiente para abordagem personalizada.",
            "O serviço com mais recorrência ajuda a puxar o retorno com naturalidade.",
          ],
          followUp:
            "Se quiser, eu preparo a mensagem de retorno e um upsell coerente com o histórico.",
          impact:
            "Uma abordagem com contexto aumenta a chance de retorno e evita contato genérico.",
          problem:
            "A cliente já deixou sinais claros no histórico, mas eles ainda precisam virar ação prática.",
          recommendedAction:
            "Abra o cadastro e puxe o contato pelo último ciclo de retorno e pelo serviço com mais recorrência.",
          suggestion:
            "Fale de forma pessoal, lembrando o momento certo de voltar e uma oferta complementar discreta.",
          summary:
            "Essa cliente já tem histórico suficiente para uma abordagem mais certeira, usando retorno e preferência real de serviço.",
          title: "Cliente com boa leitura de retorno",
        },
        question: "Qual foi a última visita da cliente Ana?",
      },
    ],
    routingTerms: [
      "cliente",
      "ultima visita",
      "última visita",
      "ticket medio",
      "ticket médio",
      "historico da cliente",
    ],
    suggestedQuestions: [
      "Cliente Ana",
      "Qual foi a última visita da cliente Ana?",
    ],
    summary:
      "Ajuda a recepção e a dona a agir com contexto real do relacionamento.",
    writingDirectives: [
      "Fale de forma pessoal e profissional, sem soar invasivo.",
      "Mostre leitura de retorno, preferência e oportunidade de relacionamento em linguagem simples.",
      "Evite frases genéricas de CRM.",
    ],
  },
  finance_analysis: {
    decisionSections: [
      { field: "problem", label: "Leitura financeira", tone: "problem" },
      { field: "impact", label: "O que pesa no caixa", tone: "impact" },
      {
        field: "suggestion",
        label: "Ajuste recomendado",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Próxima ação", tone: "action" },
    ],
    guardrails: [
      "Não recalcule o financeiro oficial fora das regras do backend.",
      "Não trate tendência como verdade fechada sem citar a base comparada.",
      "Conecte leitura financeira com agenda, campanha e recebimento.",
    ],
    intent: "finance_analysis",
    label: "Financeiro",
    objective:
      "Interpretar faturamento, ticket e ritmo de caixa para orientar a próxima ação do salão.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "O caixa perdeu ritmo no comparativo recente.",
            "A categoria que mais caiu é o melhor ponto para reação imediata.",
          ],
          followUp:
            "Se quiser, eu cruzo a categoria mais fraca com agenda e campanha para indicar a melhor alavanca.",
          impact:
            "Quando o faturamento desacelera, a pressão aparece no caixa, na ocupação e na margem.",
          problem:
            "O financeiro ainda está sob controle, mas existe uma queda clara que pede ajuste objetivo, não desconto espalhado.",
          recommendedAction:
            "Abra o financeiro e ataque primeiro a categoria que perdeu ritmo, cruzando com a agenda mais vazia.",
          suggestion:
            "Reaja com ação focada na maior queda antes de ampliar promoção para o resto do salão.",
          summary:
            "O faturamento perdeu força no comparativo recente, então a melhor resposta agora é agir na categoria que mais caiu.",
          title: "Queda concentrada no financeiro",
        },
        question: "Meu faturamento caiu este mês?",
      },
    ],
    routingTerms: [
      "faturamento",
      "financeir",
      "receita",
      "ticket",
      "caiu",
      "cresceu",
      "caixa",
      "servicos em queda",
      "servico em queda",
      "queda de servicos",
    ],
    suggestedQuestions: [
      "Meu faturamento caiu este mês?",
      "Como está o caixa desta semana?",
    ],
    summary:
      "Lê a saúde financeira e conecta a resposta com agenda, campanha e margem.",
    writingDirectives: [
      "Soe como dona ou gestor olhando caixa com maturidade.",
      "Seja firme, claro e específico sobre o que caiu, subiu ou travou.",
      "Mostre a melhor alavanca prática em vez de teoria financeira.",
    ],
  },
  promotion_strategy: {
    decisionSections: [
      { field: "problem", label: "Leitura comercial", tone: "problem" },
      { field: "impact", label: "Onde a oferta ajuda", tone: "impact" },
      {
        field: "suggestion",
        label: "Oferta mais alinhada",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Como testar", tone: "action" },
    ],
    guardrails: [
      "Não espalhe desconto sem alvo claro.",
      "Priorize oferta simples, margem protegida e público compatível.",
      "Toda promoção precisa de revisão humana antes de publicar.",
    ],
    intent: "promotion_strategy",
    label: "Promoções",
    objective:
      "Criar estratégia comercial enxuta para puxar ocupação ou recorrência sem degradar a margem.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "A sexta tem espaço suficiente para testar uma oferta enxuta.",
            "O serviço foco precisa ser fácil de comunicar e rápido de converter.",
          ],
          followUp:
            "Se quiser, eu deixo a promoção pronta no painel para você só revisar.",
          impact:
            "Uma oferta bem recortada pode puxar ocupação sem virar desconto generalizado.",
          problem:
            "Existe espaço comercial para agir, mas a oferta precisa vir alinhada ao dia fraco e ao serviço certo.",
          recommendedAction:
            "Monte a promoção para a sexta, valide preço e período e publique só depois da revisão.",
          suggestion:
            "Use uma oferta simples, com urgência curta e serviço que o salão já vende bem.",
          summary:
            "A sexta comporta uma promoção enxuta, desde que ela seja focada no serviço certo e com preço bem controlado.",
          title: "Oferta enxuta para sexta",
        },
        question: "Crie uma promoção para sexta com baixo movimento.",
      },
    ],
    routingTerms: [
      "promoc",
      "oferta",
      "campanha",
      "desconto",
      "acao comercial",
      "whatsapp",
      "mensagem whatsapp",
      "mensagem promocional",
    ],
    suggestedQuestions: [
      "Crie promoção para sexta com baixo movimento.",
      "Que oferta faz sentido para esta semana?",
    ],
    summary:
      "Ajuda a transformar baixa ocupação em ação comercial revisável.",
    writingDirectives: [
      "Escreva com inteligência comercial, sem exagerar promessa.",
      "Faça a oferta soar pensada e coerente com o momento do salão.",
      "Evite frases de marketing genérico.",
    ],
  },
  panel_help: {
    decisionSections: [
      { field: "problem", label: "O que você quer fazer", tone: "problem" },
      { field: "impact", label: "Por que isso importa", tone: "impact" },
      {
        field: "suggestion",
        label: "Caminho mais seguro",
        tone: "suggestion",
      },
      { field: "recommendedAction", label: "Próximo passo", tone: "action" },
    ],
    guardrails: [
      "Explique o caminho certo do painel sem inventar tela.",
      "Prefira passo a passo curto e objetivo.",
      "Se a ação depender de regra sensível, oriente a revisar o módulo correto.",
    ],
    intent: "panel_help",
    label: "Ajuda",
    objective:
      "Ensinar a equipe a operar o painel com menos erro e menos dependência de suporte.",
    responseExamples: [
      {
        answer: {
          bullets: [
            "A configuração fica no módulo certo do painel.",
            "O caminho precisa ser curto o bastante para a equipe executar sem dúvida.",
          ],
          followUp:
            "Se quiser, eu explico o próximo passo depois que você abrir a tela certa.",
          impact:
            "Quando a equipe aprende o caminho certo, o painel deixa de travar a operação por dúvida simples.",
          problem:
            "A tarefa é simples, mas se a equipe entrar no módulo errado perde tempo e pode configurar algo fora do lugar.",
          recommendedAction:
            "Abra o módulo indicado, revise os campos principais e salve só depois de conferir a regra.",
          suggestion:
            "Explique o passo a passo em ordem curta, sem termos técnicos e sem pular tela.",
          summary:
            "O melhor caminho é orientar a equipe com passo a passo curto e direto, evitando tela errada e retrabalho.",
          title: "Passo a passo mais seguro",
        },
        question: "Como cadastro comissão?",
      },
    ],
    routingTerms: [
      "como cadastrar",
      "como configurar",
      "como faco",
      "como faço",
      "onde fica",
      "onde encontro",
      "passo a passo",
      "comissao",
      "comissão",
    ],
    suggestedQuestions: [
      "Como cadastrar comissão?",
      "Onde configuro os serviços?",
    ],
    summary:
      "Responde dúvidas operacionais do painel com caminho prático e seguro.",
    writingDirectives: [
      "Explique como um operador sênior treinando a equipe.",
      "Seja didático sem parecer suporte frio.",
      "Deixe a próxima ação muito clara.",
    ],
  },
} satisfies Record<PanelAssistantIntent, AssistantSkillDefinition>;

export function getPanelAssistantIntentLabel(intent: PanelAssistantIntent) {
  return PANEL_ASSISTANT_SKILLS[intent].label;
}

export function getPanelAssistantSkill(intent: PanelAssistantIntent) {
  return PANEL_ASSISTANT_SKILLS[intent];
}

export function getPanelAssistantSkillOrder() {
  return [...PANEL_ASSISTANT_SKILL_ORDER];
}

export function getPanelAssistantSuggestedQuestions() {
  return [
    "Qual profissional tem mais horarios livres hoje?",
    "Quem posso chamar para uma vaga aberta hoje?",
    "Qual dia esta mais fraco nesta semana?",
    "Meu faturamento caiu este mes?",
    "Qual campanha ajuda a preencher os horarios vagos de amanha?",
    "Qual foi a ultima visita da cliente Ana?",
  ];
}

export function isPanelAssistantFollowUp(normalizedQuestion: string) {
  return PANEL_ASSISTANT_FOLLOW_UP_PREFIXES.some((prefix) =>
    normalizedQuestion === prefix ||
    normalizedQuestion.startsWith(prefix.endsWith(" ") ? prefix : `${prefix} `),
  );
}
