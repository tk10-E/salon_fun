import {
  sendSalonManualWhatsAppAction,
  updateSalonWhatsAppSettingsAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { requireOwnerSalon } from "@/lib/auth";
import {
  getWhatsAppBusinessAccountId,
  getWhatsAppPhoneNumberId,
} from "@/lib/serverEnv";
import { createClient } from "@/lib/supabase/server";
import { AUTO_PILOT_NOTIFICATION_TYPES } from "@/lib/whatsappDispatch";
import {
  WhatsAppComposer,
  type WhatsAppQuickReplyOption,
  type WhatsAppQuickReplySection,
} from "./WhatsAppComposer";
import { formatNotificationType } from "../notifications/shared";

const NEW_CONVERSATION_KEY = "__new__";

type WhatsAppPageProps = {
  searchParams?: Promise<{
    lead?: string;
    message?: string;
    tone?: string;
  }>;
};

type CustomerRelation =
  | {
      name: string | null;
      phone: string | null;
      whatsapp_phone?: string | null;
    }
  | {
      name: string | null;
      phone: string | null;
      whatsapp_phone?: string | null;
    }[]
  | null;

type RecentDispatchRow = {
  body: string;
  created_at: string;
  customer_id: string | null;
  customers: CustomerRelation;
  id: string;
  notification_type: string;
  payload: Record<string, unknown> | null;
  title: string;
  whatsapp_delivery_status: string | null;
  whatsapp_error: string | null;
  whatsapp_status_at: string | null;
};

type InboundMessageRow = {
  created_at: string;
  customer_id: string | null;
  from_phone: string;
  handled_action: string | null;
  id: string;
  interpreted_intent: string | null;
  message_body: string | null;
  profile_name: string | null;
};

type RecentCustomerRow = {
  created_at: string;
  id: string;
  name: string;
  phone: string | null;
  whatsapp_phone: string | null;
};

type ConversationLead = {
  customerId: string | null;
  customerName: string;
  key: string;
  lastEventAt: string;
  lastEventBadge: string;
  lastEventPreview: string;
  phone: string;
  suggestedMessage: string;
  whatsappUrl: string;
};

type ConversationEvent =
  | {
      eventAt: string;
      id: string;
      kind: "dispatch";
      record: RecentDispatchRow;
    }
  | {
      eventAt: string;
      id: string;
      kind: "inbound";
      record: InboundMessageRow;
    };

type ConversationReplyPreset = {
  defaultMessage: string;
  quickReplies: WhatsAppQuickReplyOption[];
  quickRepliesLabel: string;
};

type SelectedCustomerProfile = {
  badges: string[];
  completedVisits: number;
  createdAt: string | null;
  hasAppointmentToday: boolean;
  isInactive: boolean;
  isNew: boolean;
  isVip: boolean;
  lastVisitAt: string | null;
  primaryKind: "today" | "vip" | "new" | "inactive" | "regular";
};

type CustomerAppointmentProfileRow = {
  completed_at: string | null;
  date: string;
  id: string;
  status: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function normalizePhone(value: string | null | undefined) {
  const digits = (value ?? "").replace(/\D/g, "");
  return digits || null;
}

function readConfiguredId(...values: Array<string | null | undefined>) {
  for (const value of values) {
    const normalized = value?.trim();

    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function formatWhatsAppPhone(value: string | null | undefined) {
  const digits = normalizePhone(value);
  if (!digits) {
    return "Não configurado";
  }

  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }

  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }

  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }

  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }

  return digits;
}

function buildWhatsAppUrl(value: string | null | undefined) {
  const digits = normalizePhone(value);
  if (!digits) {
    return null;
  }

  return `https://wa.me/${digits}`;
}

function formatCompactDateTime(
  value: string | null | undefined,
  timeZone: string,
) {
  const normalized = value?.trim();
  if (!normalized) {
    return "Agora";
  }

  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return normalized;
  }

  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(parsed);
}

function formatConversationTime(
  value: string | null | undefined,
  timeZone: string,
) {
  const parsed = new Date(value ?? "");
  if (Number.isNaN(parsed.getTime())) {
    return "Agora";
  }

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
  }).format(parsed);
}

function getTimestamp(value: string | null | undefined) {
  const parsed = new Date(value ?? "");
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function getDateKey(value: string | Date | null | undefined, timeZone: string) {
  const parsed =
    value instanceof Date ? value : new Date(typeof value === "string" ? value : "");
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone,
    year: "numeric",
  }).format(parsed);
}

function getDayDifferenceFromNow(
  value: string | null | undefined,
  timeZone: string,
) {
  const targetDateKey = getDateKey(value, timeZone);
  const todayKey = getDateKey(new Date(), timeZone);
  if (!targetDateKey || !todayKey) {
    return null;
  }

  const target = new Date(`${targetDateKey}T00:00:00Z`);
  const today = new Date(`${todayKey}T00:00:00Z`);

  return Math.floor((today.getTime() - target.getTime()) / (24 * 60 * 60 * 1000));
}

function compareDatesDesc(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  return getTimestamp(b) - getTimestamp(a);
}

function compareDatesAsc(
  a: string | null | undefined,
  b: string | null | undefined,
) {
  return getTimestamp(a) - getTimestamp(b);
}

function shortenText(value: string | null | undefined, maxLength = 140) {
  const normalized = value?.trim();
  if (!normalized) {
    return "Sem texto registrado.";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

function readPayloadText(
  payload: Record<string, unknown> | null | undefined,
  key: string,
) {
  const value = payload?.[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function buildSuggestedReply(params: {
  customerName: string;
  salonName: string;
  variant: "crm" | "reply";
}) {
  if (params.variant === "reply") {
    return `Oi ${params.customerName}, vi sua mensagem aqui no painel do salão ${params.salonName}. Posso te ajudar por aqui.`;
  }

  return `Oi ${params.customerName}, aqui é do salão ${params.salonName}. Quero te ajudar com seu próximo atendimento.`;
}

function buildDefaultMessage(salonName: string) {
  return `Oi, aqui é do salão ${salonName}. Como posso te ajudar hoje?`;
}

function dedupeQuickReplies(replies: WhatsAppQuickReplyOption[]) {
  const seen = new Set<string>();

  return replies.filter((reply) => {
    const key = reply.label.trim().toLowerCase();
    if (seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  });
}

function buildBaseReplyPreset(params: {
  conversation: ConversationEvent[];
  lead: ConversationLead;
  salonName: string;
}): ConversationReplyPreset {
  const { conversation, lead, salonName } = params;
  const lastInboundRecord = [...conversation]
    .reverse()
    .find((event) => event.kind === "inbound")?.record;
  const latestEvent = conversation[conversation.length - 1] ?? null;

  if (
    lastInboundRecord?.interpreted_intent === "confirm_appointment" ||
    lastInboundRecord?.handled_action === "appointment_confirmed"
  ) {
    return {
      defaultMessage: `Oi ${lead.customerName}, confirmado por aqui no salão ${salonName}. Qualquer coisa, estou à disposição.`,
      quickRepliesLabel: "Sugestões para confirmação",
      quickReplies: [
        {
          label: "Confirmado",
          message: `Oi ${lead.customerName}, confirmado por aqui no salão ${salonName}.`,
        },
        {
          label: "Te esperamos",
          message: `Perfeito, ${lead.customerName}. Te esperamos no horário combinado.`,
        },
        {
          label: "Localização",
          message: `Se precisar, ${lead.customerName}, eu te mando a localização e te ajudo a chegar.`,
        },
        {
          label: "Reagendar",
          message: `Se precisar ajustar o horário, ${lead.customerName}, me avisa que eu te ajudo com o reagendamento.`,
        },
      ],
    };
  }

  if (
    lastInboundRecord?.interpreted_intent === "reschedule_appointment" ||
    lastInboundRecord?.handled_action === "appointment_reschedule_requested"
  ) {
    return {
      defaultMessage: `Oi ${lead.customerName}, consigo te ajudar com o reagendamento. Me fala qual período fica melhor para você ou, se preferir, eu já te envio opções.`,
      quickRepliesLabel: "Sugestões para reagendamento",
      quickReplies: [
        {
          label: "Sugerir horários",
          message: `Oi ${lead.customerName}, consigo te ajudar com o reagendamento. Me fala qual período fica melhor para você ou, se preferir, eu já te envio opções.`,
        },
        {
          label: "Tenho hoje",
          message: `Oi ${lead.customerName}, ainda tenho alguns horários livres hoje. Se quiser, eu já te mando as opções.`,
        },
        {
          label: "Tenho amanhã",
          message: `Oi ${lead.customerName}, amanhã tenho algumas opções para te encaixar. Se quiser, eu já separo os horários para você.`,
        },
        {
          label: "Me diga o período",
          message: `Perfeito, ${lead.customerName}. Me fala se você prefere manhã, tarde ou noite que eu agilizo por aqui.`,
        },
      ],
    };
  }

  if (
    lastInboundRecord?.interpreted_intent === "cancel_appointment" ||
    lastInboundRecord?.handled_action === "appointment_cancelled"
  ) {
    return {
      defaultMessage: `Oi ${lead.customerName}, sem problema. Se quiser, eu posso te ajudar a encontrar um novo horário mais pra frente.`,
      quickRepliesLabel: "Sugestões para cancelamento",
      quickReplies: [
        {
          label: "Sem problema",
          message: `Oi ${lead.customerName}, sem problema. Qualquer coisa, fico à disposição para te ajudar.`,
        },
        {
          label: "Novo horário",
          message: `Se quiser, ${lead.customerName}, eu já posso te ajudar a encontrar um novo horário para outro dia.`,
        },
        {
          label: "Quando quiser",
          message: `Tudo certo, ${lead.customerName}. Quando quiser remarcar, me chama que eu agilizo para você.`,
        },
        {
          label: "Próxima semana",
          message: `Se fizer sentido para você, ${lead.customerName}, também posso te enviar opções para a próxima semana.`,
        },
      ],
    };
  }

  if (
    latestEvent?.kind === "dispatch" &&
    latestEvent.record.notification_type !== "manual_whatsapp_message"
  ) {
    return {
      defaultMessage: `Oi ${lead.customerName}, vi que você recebeu nossa mensagem. Posso te ajudar por aqui.`,
      quickRepliesLabel: "Sugestões para follow-up",
      quickReplies: [
        {
          label: "Posso ajudar",
          message: `Oi ${lead.customerName}, vi que você recebeu nossa mensagem. Posso te ajudar por aqui.`,
        },
        {
          label: "Quer agendar",
          message: `Oi ${lead.customerName}, se quiser, eu já posso te ajudar a marcar seu próximo atendimento.`,
        },
        {
          label: "Tirar dúvida",
          message: `Oi ${lead.customerName}, se ficou alguma dúvida, pode me falar por aqui que eu te ajudo.`,
        },
        {
          label: "Falar agora",
          message: `Oi ${lead.customerName}, estou online agora e consigo te responder rapidinho.`,
        },
      ],
    };
  }

  return {
    defaultMessage: lead.suggestedMessage,
    quickRepliesLabel: "Sugestões para resposta",
    quickReplies: [
      {
        label: "Responder agora",
        message: lead.suggestedMessage,
      },
      {
        label: "Confirmado",
        message: `Oi ${lead.customerName}, confirmado por aqui no salão ${salonName}.`,
      },
      {
        label: "Já vou ver",
        message: `Oi ${lead.customerName}, já estou verificando isso aqui e te respondo em seguida.`,
      },
      {
        label: "Reagendar",
        message: `Oi ${lead.customerName}, consigo te ajudar com o reagendamento. Me fala o melhor horário para você.`,
      },
    ],
  };
}

function buildCustomerProfileBadges(profile: SelectedCustomerProfile | null) {
  return profile?.badges ?? [];
}

function buildProfileReplyAdjustments(params: {
  lead: ConversationLead;
  profile: SelectedCustomerProfile | null;
  salonName: string;
}): {
  defaultMessage?: string;
  quickReplies: WhatsAppQuickReplyOption[];
  quickRepliesLabelSuffix?: string;
} {
  const { lead, profile, salonName } = params;

  if (!profile || profile.primaryKind === "regular") {
    return {
      quickReplies: [],
    };
  }

  switch (profile.primaryKind) {
    case "today":
      return {
        defaultMessage: `Oi ${lead.customerName}, vi sua agenda de hoje aqui no salão ${salonName}. Se precisar de qualquer ajuste antes do atendimento, me chama.`,
        quickRepliesLabelSuffix: "Agenda hoje",
        quickReplies: [
          {
            label: "Te esperamos hoje",
            message: `Perfeito, ${lead.customerName}. Te esperamos hoje no horário combinado.`,
          },
          {
            label: "Chegue 10 min antes",
            message: `Se puder, ${lead.customerName}, chegue uns 10 minutinhos antes para ficar mais confortável no atendimento.`,
          },
          {
            label: "Se atrasar avise",
            message: `Se acontecer qualquer atraso, ${lead.customerName}, me avisa por aqui que eu organizo com a equipe.`,
          },
        ],
      };
    case "vip":
      return {
        defaultMessage: `Oi ${lead.customerName}, vou te ajudar com prioridade por aqui no salão ${salonName}.`,
        quickRepliesLabelSuffix: "VIP",
        quickReplies: [
          {
            label: "Prioridade VIP",
            message: `Oi ${lead.customerName}, vou te ajudar com prioridade por aqui.`,
          },
          {
            label: "Melhor horário",
            message: `Oi ${lead.customerName}, posso separar as melhores opções de horário para você.`,
          },
          {
            label: "Atendimento especial",
            message: `Oi ${lead.customerName}, quero deixar seu atendimento o mais confortável possível. Me diz o que você precisa que eu agilizo.`,
          },
        ],
      };
    case "new":
      return {
        defaultMessage: `Oi ${lead.customerName}, seja muito bem-vinda ao salão ${salonName}. Posso te orientar por aqui para ficar tudo mais fácil.`,
        quickRepliesLabelSuffix: "Cliente nova",
        quickReplies: [
          {
            label: "Boas-vindas",
            message: `Oi ${lead.customerName}, seja muito bem-vinda ao salão ${salonName}.`,
          },
          {
            label: "Explico como funciona",
            message: `Se quiser, ${lead.customerName}, eu te explico rapidinho como funciona o atendimento e já te ajudo com o agendamento.`,
          },
          {
            label: "Escolher serviço",
            message: `Oi ${lead.customerName}, se você me disser o que está buscando, eu te ajudo a escolher o melhor serviço.`,
          },
        ],
      };
    case "inactive":
      return {
        defaultMessage: `Oi ${lead.customerName}, que bom falar com você de novo. Posso te ajudar a voltar para a agenda do salão ${salonName}.`,
        quickRepliesLabelSuffix: "Em retorno",
        quickReplies: [
          {
            label: "Que bom te ver",
            message: `Oi ${lead.customerName}, que bom falar com você de novo.`,
          },
          {
            label: "Quero te ajudar a voltar",
            message: `Oi ${lead.customerName}, posso te ajudar a voltar para a agenda com uma opção que faça sentido para você.`,
          },
          {
            label: "Tenho novidades",
            message: `Oi ${lead.customerName}, temos novidades e também posso te sugerir um próximo atendimento se quiser.`,
          },
        ],
      };
    default:
      return {
        quickReplies: [],
      };
  }
}

function buildSelectedLeadReplyPreset(params: {
  conversation: ConversationEvent[];
  lead: ConversationLead;
  profile: SelectedCustomerProfile | null;
  salonName: string;
}): ConversationReplyPreset {
  const { conversation, lead, profile, salonName } = params;
  const basePreset = buildBaseReplyPreset({
    conversation,
    lead,
    salonName,
  });
  const profileAdjustments = buildProfileReplyAdjustments({
    lead,
    profile,
    salonName,
  });

  return {
    defaultMessage: profileAdjustments.defaultMessage ?? basePreset.defaultMessage,
    quickRepliesLabel: profileAdjustments.quickRepliesLabelSuffix
      ? `${basePreset.quickRepliesLabel} • ${profileAdjustments.quickRepliesLabelSuffix}`
      : basePreset.quickRepliesLabel,
    quickReplies: dedupeQuickReplies([
      ...profileAdjustments.quickReplies,
      ...basePreset.quickReplies,
    ]),
  };
}

function buildConversationObjectiveQuickReplies(params: {
  lead: ConversationLead;
  profile: SelectedCustomerProfile | null;
  salonName: string;
}): WhatsAppQuickReplyOption[] {
  const { lead, profile, salonName } = params;

  return [
    {
      label: "Fechar agenda",
      message: profile?.hasAppointmentToday
        ? `Perfeito, ${lead.customerName}. Seu horário de hoje está alinhado por aqui. Se precisar, também deixo o próximo atendimento encaminhado para você.`
        : `Se quiser, ${lead.customerName}, eu já separo as melhores opções de horário para você e fechamos agora por aqui.`,
    },
    {
      label: "Recuperar cliente",
      message: profile?.isInactive
        ? `Oi ${lead.customerName}, quero te ajudar a voltar para a agenda do salão ${salonName} com uma opção que faça sentido para você.`
        : profile?.isNew
          ? `Oi ${lead.customerName}, quero deixar seu primeiro atendimento no salão ${salonName} simples e bem acompanhado por aqui.`
          : `Oi ${lead.customerName}, quero facilitar seu próximo passo com a agenda do salão ${salonName}.`,
    },
    {
      label: "Vender pacote",
      message: profile?.isVip
        ? `Oi ${lead.customerName}, também posso te mostrar uma combinação de serviços que costuma valer mais a pena para quem cuida da agenda com frequência.`
        : `Se você quiser, ${lead.customerName}, também posso te mostrar um pacote ou combo que vale mais a pena para esse atendimento.`,
    },
    {
      label: "Confirmar sem falta",
      message: profile?.hasAppointmentToday
        ? `Perfeito, ${lead.customerName}. Deixo seu horário confirmado por aqui. Se acontecer qualquer imprevisto, me avisa antes para eu organizar com a equipe.`
        : `Perfeito, ${lead.customerName}. Assim que você escolher o melhor horário, eu já deixo tudo confirmado por aqui.`,
    },
  ];
}

function buildSelectedLeadQuickReplySections(params: {
  lead: ConversationLead;
  preset: ConversationReplyPreset;
  profile: SelectedCustomerProfile | null;
  salonName: string;
}): WhatsAppQuickReplySection[] {
  const { lead, preset, profile, salonName } = params;

  return [
    {
      label: preset.quickRepliesLabel,
      replies: preset.quickReplies,
    },
    {
      label: "Objetivos da conversa",
      replies: buildConversationObjectiveQuickReplies({
        lead,
        profile,
        salonName,
      }),
    },
  ].filter((section) => section.replies.length);
}

function buildNewConversationQuickReplies(
  salonName: string,
): WhatsAppQuickReplyOption[] {
  return [
    {
      label: "Primeiro contato",
      message: `Oi, aqui é do salão ${salonName}. Vi seu contato e estou por aqui para te ajudar.`,
    },
    {
      label: "Agendamento",
      message: `Oi, aqui é do salão ${salonName}. Me conta qual serviço e horário você procura para eu te ajudar mais rápido.`,
    },
    {
      label: "Retorno",
      message: `Oi, aqui é do salão ${salonName}. Passei para saber se posso te ajudar com seu próximo atendimento.`,
    },
  ];
}

function buildNewConversationObjectiveQuickReplies(
  salonName: string,
): WhatsAppQuickReplyOption[] {
  return [
    {
      label: "Fechar agenda",
      message: `Se quiser, me diga o melhor dia ou período que eu já separo opções e deixamos seu horário no salão ${salonName} confirmado por aqui.`,
    },
    {
      label: "Recuperar cliente",
      message: `Se fazia um tempo que você não vinha, posso te ajudar a voltar para a agenda do salão ${salonName} com uma opção prática para sua rotina.`,
    },
    {
      label: "Vender pacote",
      message: `Se quiser, também posso te mostrar um pacote ou combo do salão ${salonName} que pode valer mais a pena para esse atendimento.`,
    },
    {
      label: "Confirmar sem falta",
      message: `Assim que você me passar o melhor horário, eu deixo tudo confirmado por aqui para você.`,
    },
  ];
}

function buildNewConversationQuickReplySections(
  salonName: string,
): WhatsAppQuickReplySection[] {
  return [
    {
      label: "Respostas para começar",
      replies: buildNewConversationQuickReplies(salonName),
    },
    {
      label: "Objetivos da conversa",
      replies: buildNewConversationObjectiveQuickReplies(salonName),
    },
  ].filter((section) => section.replies.length);
}

function buildLeadKey(customerId: string | null, phone: string | null) {
  return customerId || phone || null;
}

function buildLeadSelectionPath(leadKey: string) {
  return `/dashboard/whatsapp?lead=${encodeURIComponent(leadKey)}`;
}

function upsertLead(
  leads: Map<string, ConversationLead>,
  candidate: {
    customerId: string | null;
    customerName: string | null;
    lastEventAt: string;
    lastEventBadge: string;
    lastEventPreview: string;
    phone: string | null;
    salonName: string;
    variant: "crm" | "reply";
  },
) {
  const phone = normalizePhone(candidate.phone);
  const key = buildLeadKey(candidate.customerId, phone);
  if (!key || !phone) {
    return;
  }

  const customerName = candidate.customerName?.trim() || "Cliente";
  const nextLead: ConversationLead = {
    customerId: candidate.customerId,
    customerName,
    key,
    lastEventAt: candidate.lastEventAt,
    lastEventBadge: candidate.lastEventBadge,
    lastEventPreview: candidate.lastEventPreview,
    phone,
    suggestedMessage: buildSuggestedReply({
      customerName,
      salonName: candidate.salonName,
      variant: candidate.variant,
    }),
    whatsappUrl: buildWhatsAppUrl(phone) ?? "#",
  };

  const current = leads.get(key);
  if (!current) {
    leads.set(key, nextLead);
    return;
  }

  if (getTimestamp(current.lastEventAt) >= getTimestamp(nextLead.lastEventAt)) {
    leads.set(key, {
      ...current,
      customerId: current.customerId ?? nextLead.customerId,
      customerName:
        current.customerName === "Cliente"
          ? nextLead.customerName
          : current.customerName,
      phone: current.phone || nextLead.phone,
    });
    return;
  }

  leads.set(key, {
    ...nextLead,
    customerId: nextLead.customerId ?? current.customerId,
    customerName:
      nextLead.customerName === "Cliente"
        ? current.customerName
        : nextLead.customerName,
  });
}

function formatDeliveryStatusLabel(value: string | null | undefined) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "sent":
      return "Enviado";
    case "delivered":
      return "Entregue";
    case "read":
      return "Lido";
    case "failed":
      return "Falhou";
    default:
      return "Sem status";
  }
}

function formatLeadBadge(value: string) {
  switch (value) {
    case "Cliente respondeu":
      return "Respondeu agora";
    case "Painel enviou":
      return "Você respondeu";
    case "Automação enviou":
      return "Automação";
    case "Cliente do app":
      return "Contato do salão";
    default:
      return value;
  }
}

function formatDispatchSourceLabel(notificationType: string) {
  return notificationType === "manual_whatsapp_message" ? "Você" : "Automação";
}

function formatWhatsAppError(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return null;
  }

  if (normalized === "missing_config") {
    return "Canal oficial ainda precisa de configuração.";
  }

  if (normalized === "missing_phone") {
    return "Cliente sem número válido para WhatsApp.";
  }

  if (normalized === "missing_template") {
    return "Essa automação ainda depende de ajuste no modelo de mensagem.";
  }

  if (
    normalized.includes("131030") ||
    normalized.includes("phone number not registered")
  ) {
    return "O número oficial ainda não está pronto para envio real.";
  }

  return "Entrega não concluída. Revise o canal e tente novamente.";
}

function formatInboundIntent(value: string | null | undefined) {
  switch ((value ?? "").trim().toLowerCase()) {
    case "confirm_appointment":
      return "Confirmação";
    case "cancel_appointment":
      return "Cancelamento";
    case "reschedule_appointment":
      return "Reagendamento";
    default:
      return "Mensagem livre";
  }
}

function formatHandledAction(value: string | null | undefined) {
  const normalized = (value ?? "").trim().toLowerCase();
  if (!normalized) {
    return "Mensagem recebida no painel";
  }

  if (normalized === "appointment_confirmed") {
    return "Confirmação refletida na agenda";
  }

  if (normalized === "appointment_cancelled") {
    return "Cancelamento refletido na agenda";
  }

  if (normalized === "appointment_reschedule_requested") {
    return "Pedido de reagendamento recebido";
  }

  if (normalized.includes("help")) {
    return "Mensagem orientada pelo assistente";
  }

  return value ?? "Fluxo tratado";
}

function getDispatchIdentity(record: RecentDispatchRow) {
  const customer = firstRelation(record.customers);
  return {
    customerId: record.customer_id,
    phone: normalizePhone(
      customer?.whatsapp_phone ??
        customer?.phone ??
        readPayloadText(record.payload, "customerPhone"),
    ),
  };
}

function getInboundIdentity(record: InboundMessageRow) {
  return {
    customerId: record.customer_id,
    phone: normalizePhone(record.from_phone),
  };
}

function eventMatchesLead(event: ConversationEvent, lead: ConversationLead) {
  const identity =
    event.kind === "dispatch"
      ? getDispatchIdentity(event.record)
      : getInboundIdentity(event.record);

  if (
    lead.customerId &&
    identity.customerId &&
    lead.customerId === identity.customerId
  ) {
    return true;
  }

  return Boolean(lead.phone && identity.phone && lead.phone === identity.phone);
}

function buildDispatchFooter(record: RecentDispatchRow) {
  const deliveryLabel = formatDeliveryStatusLabel(
    record.whatsapp_delivery_status,
  );
  const errorLabel = formatWhatsAppError(record.whatsapp_error);

  if (record.notification_type === "manual_whatsapp_message") {
    return errorLabel ? `${deliveryLabel} • ${errorLabel}` : deliveryLabel;
  }

  const automationLabel = formatNotificationType(record.notification_type);
  return errorLabel
    ? `${automationLabel} • ${errorLabel}`
    : `${automationLabel} • ${deliveryLabel}`;
}

export default async function WhatsAppPage({
  searchParams: searchParamsPromise,
}: WhatsAppPageProps) {
  const searchParams = await searchParamsPromise;
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const recentWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    deliveredResult,
    errorResult,
    inboundCountResult,
    manualCountResult,
    latestInboundResult,
    recentDispatchesResult,
    recentInboundMessagesResult,
    recentCustomersResult,
  ] = await Promise.all([
    supabase
      .from("salon_customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("whatsapp_status_at", recentWindowStart)
      .in("whatsapp_delivery_status", ["delivered", "read"]),
    supabase
      .from("salon_customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart)
      .not("whatsapp_error", "is", null),
    supabase
      .from("whatsapp_inbound_messages")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart),
    supabase
      .from("salon_customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart)
      .eq("notification_type", "manual_whatsapp_message"),
    supabase
      .from("whatsapp_inbound_messages")
      .select(
        "id, created_at, customer_id, from_phone, profile_name, message_body, interpreted_intent, handled_action",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("salon_customer_notifications")
      .select(
        "id, customer_id, title, body, notification_type, payload, created_at, whatsapp_delivery_status, whatsapp_error, whatsapp_status_at, customers(name, phone, whatsapp_phone)",
      )
      .eq("salon_id", salon.id)
      .not("whatsapp_status_at", "is", null)
      .in("notification_type", [
        "manual_whatsapp_message",
        ...AUTO_PILOT_NOTIFICATION_TYPES,
      ])
      .order("whatsapp_status_at", { ascending: false })
      .limit(16),
    supabase
      .from("whatsapp_inbound_messages")
      .select(
        "id, created_at, customer_id, from_phone, profile_name, message_body, interpreted_intent, handled_action",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(16),
    supabase
      .from("customers")
      .select("id, name, phone, whatsapp_phone, created_at")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(16),
  ]);

  const whatsappPublicPhone = salon.whatsapp_phone?.trim() || null;
  const whatsappDispatchEnabled = salon.whatsapp_dispatch_enabled === true;
  const salonWhatsAppPhoneNumberId = readConfiguredId(
    salon.whatsapp_meta_phone_number_id,
  );
  const salonWhatsAppBusinessAccountId = readConfiguredId(
    salon.whatsapp_meta_business_account_id,
  );
  const effectiveWhatsAppPhoneNumberId = readConfiguredId(
    salonWhatsAppPhoneNumberId,
    getWhatsAppPhoneNumberId(),
  );
  const effectiveWhatsAppBusinessAccountId = readConfiguredId(
    salonWhatsAppBusinessAccountId,
    getWhatsAppBusinessAccountId(),
  );
  const whatsappIntegrationReady =
    Boolean(effectiveWhatsAppPhoneNumberId) &&
    Boolean(effectiveWhatsAppBusinessAccountId);
  const whatsappIntegrationMessage = whatsappIntegrationReady
    ? salonWhatsAppPhoneNumberId && salonWhatsAppBusinessAccountId
      ? "Conectada pela equipe técnica. Você não precisa preencher nenhum campo avançado aqui."
      : "Conectada pelo canal padrão do painel. Os IDs técnicos globais já estão ativos para esse envio."
    : "Se o envio ainda não estiver pronto, a equipe técnica conclui a conexão sem expor configurações complexas para o salão.";
  const deliveredCount = deliveredResult.count ?? 0;
  const errorCount = errorResult.count ?? 0;
  const inboundMessagesCount = inboundCountResult.count ?? 0;
  const manualMessagesCount = manualCountResult.count ?? 0;
  const latestInboundMessage =
    latestInboundResult.data && typeof latestInboundResult.data === "object"
      ? (latestInboundResult.data as InboundMessageRow)
      : null;
  const recentDispatches = (recentDispatchesResult.data ??
    []) as RecentDispatchRow[];
  const recentInboundMessages = (recentInboundMessagesResult.data ??
    []) as InboundMessageRow[];
  const recentCustomers = (recentCustomersResult.data ??
    []) as RecentCustomerRow[];

  const conversationLeadsMap = new Map<string, ConversationLead>();

  for (const message of recentInboundMessages) {
    upsertLead(conversationLeadsMap, {
      customerId: message.customer_id,
      customerName: message.profile_name?.trim() || null,
      lastEventAt: message.created_at,
      lastEventBadge: "Cliente respondeu",
      lastEventPreview: shortenText(message.message_body),
      phone: message.from_phone,
      salonName: salon.name,
      variant: "reply",
    });
  }

  for (const dispatch of recentDispatches) {
    const customer = firstRelation(dispatch.customers);
    upsertLead(conversationLeadsMap, {
      customerId: dispatch.customer_id,
      customerName:
        customer?.name?.trim() ||
        readPayloadText(dispatch.payload, "customerName"),
      lastEventAt: dispatch.whatsapp_status_at ?? dispatch.created_at,
      lastEventBadge:
        dispatch.notification_type === "manual_whatsapp_message"
          ? "Painel enviou"
          : "Automação enviou",
      lastEventPreview: shortenText(dispatch.body),
      phone:
        customer?.whatsapp_phone ??
        customer?.phone ??
        readPayloadText(dispatch.payload, "customerPhone"),
      salonName: salon.name,
      variant: "reply",
    });
  }

  for (const customer of recentCustomers) {
    upsertLead(conversationLeadsMap, {
      customerId: customer.id,
      customerName: customer.name,
      lastEventAt: customer.created_at,
      lastEventBadge: "Cliente do app",
      lastEventPreview:
        "Pronto para iniciar conversa manual a partir do painel.",
      phone: customer.whatsapp_phone ?? customer.phone,
      salonName: salon.name,
      variant: "crm",
    });
  }

  const conversationLeads = [...conversationLeadsMap.values()]
    .sort((left, right) =>
      compareDatesDesc(left.lastEventAt, right.lastEventAt),
    )
    .slice(0, 8);

  const conversationTimeline = [
    ...recentDispatches.map(
      (record) =>
        ({
          eventAt: record.whatsapp_status_at ?? record.created_at,
          id: `dispatch-${record.id}`,
          kind: "dispatch",
          record,
        }) satisfies ConversationEvent,
    ),
    ...recentInboundMessages.map(
      (record) =>
        ({
          eventAt: record.created_at,
          id: `inbound-${record.id}`,
          kind: "inbound",
          record,
        }) satisfies ConversationEvent,
    ),
  ].sort((left, right) => compareDatesDesc(left.eventAt, right.eventAt));

  const requestedLeadKey = searchParams?.lead?.trim() || "";
  const isNewConversationSelected =
    requestedLeadKey === NEW_CONVERSATION_KEY ||
    (!requestedLeadKey && conversationLeads.length === 0);
  const selectedLead = isNewConversationSelected
    ? null
    : conversationLeads.find((lead) => lead.key === requestedLeadKey) ??
      conversationLeads[0] ??
      null;

  const selectedConversation = selectedLead
    ? conversationTimeline
        .filter((event) => eventMatchesLead(event, selectedLead))
        .sort((left, right) => compareDatesAsc(left.eventAt, right.eventAt))
    : [];
  let selectedCustomerProfile: SelectedCustomerProfile | null = null;

  if (selectedLead?.customerId) {
    const [selectedCustomerResult, completedVisitsResult, appointmentHistoryResult] =
      await Promise.all([
        supabase
          .from("customers")
          .select("id, created_at")
          .eq("salon_id", salon.id)
          .eq("id", selectedLead.customerId)
          .maybeSingle(),
        supabase
          .from("appointments")
          .select("id", { count: "exact", head: true })
          .eq("salon_id", salon.id)
          .eq("customer_id", selectedLead.customerId)
          .eq("status", "completed"),
        supabase
          .from("appointments")
          .select("id, date, status, completed_at")
          .eq("salon_id", salon.id)
          .eq("customer_id", selectedLead.customerId)
          .order("date", { ascending: false })
          .limit(40),
      ]);

    const selectedCustomer =
      selectedCustomerResult.data && typeof selectedCustomerResult.data === "object"
        ? (selectedCustomerResult.data as { created_at: string | null; id: string })
        : null;
    const appointmentHistory = (appointmentHistoryResult.data ??
      []) as CustomerAppointmentProfileRow[];
    const completedVisits = completedVisitsResult.count ?? 0;
    const todayDateKey = getDateKey(new Date(), timeZone);
    const lastVisitAt = appointmentHistory
      .filter(
        (appointment) =>
          (appointment.status ?? "").trim().toLowerCase() === "completed" ||
          Boolean(appointment.completed_at),
      )
      .sort((left, right) =>
        compareDatesDesc(
          left.completed_at ?? left.date,
          right.completed_at ?? right.date,
        ),
      )[0];
    const hasAppointmentToday = appointmentHistory.some((appointment) => {
      const normalizedStatus = (appointment.status ?? "").trim().toLowerCase();
      if (normalizedStatus === "cancelled") {
        return false;
      }

      return getDateKey(appointment.date, timeZone) === todayDateKey;
    });
    const daysSinceLastVisit = getDayDifferenceFromNow(
      lastVisitAt?.completed_at ?? lastVisitAt?.date ?? null,
      timeZone,
    );
    const daysSinceCreated = getDayDifferenceFromNow(
      selectedCustomer?.created_at ?? null,
      timeZone,
    );
    const isVip = completedVisits >= 10;
    const isNew =
      daysSinceCreated !== null && daysSinceCreated <= 30 && completedVisits <= 1;
    const isInactive =
      !hasAppointmentToday &&
      daysSinceLastVisit !== null &&
      daysSinceLastVisit >= 45;
    const badges = [
      hasAppointmentToday ? "Agenda hoje" : null,
      isVip ? "VIP" : null,
      isNew ? "Nova" : null,
      isInactive ? "Em retorno" : null,
    ].filter((value): value is string => Boolean(value));

    selectedCustomerProfile = {
      badges,
      completedVisits,
      createdAt: selectedCustomer?.created_at ?? null,
      hasAppointmentToday,
      isInactive,
      isNew,
      isVip,
      lastVisitAt: lastVisitAt?.completed_at ?? lastVisitAt?.date ?? null,
      primaryKind: hasAppointmentToday
        ? "today"
        : isVip
          ? "vip"
          : isNew
            ? "new"
            : isInactive
              ? "inactive"
              : "regular",
    };
  }

  const selectedReplyPreset = selectedLead
    ? buildSelectedLeadReplyPreset({
        conversation: selectedConversation,
        lead: selectedLead,
        profile: selectedCustomerProfile,
        salonName: salon.name,
      })
    : null;
  const selectedQuickReplySections =
    selectedLead && selectedReplyPreset
      ? buildSelectedLeadQuickReplySections({
          lead: selectedLead,
          preset: selectedReplyPreset,
          profile: selectedCustomerProfile,
          salonName: salon.name,
        })
      : [];
  const selectedReturnPath = selectedLead
    ? buildLeadSelectionPath(selectedLead.key)
    : buildLeadSelectionPath(NEW_CONVERSATION_KEY);
  const latestResponseNote = latestInboundMessage
    ? `${latestInboundMessage.profile_name?.trim() || "Cliente"} respondeu em ${formatCompactDateTime(latestInboundMessage.created_at, timeZone)}.`
    : "Quando a cliente responder, a conversa aparece aqui para a equipe agir rápido.";

  return (
    <div className="page-grid workspace-page whatsapp-page">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        eyebrow="Atendimento"
        title="WhatsApp do salão, organizado como conversa"
        description="Sua equipe acompanha clientes, responde pelo painel e mantém o número oficial do salão sem lidar com campos técnicos."
        highlight={{
          label: "Situação do canal",
          value: whatsappDispatchEnabled
            ? "Pronto para responder clientes pelo painel"
            : "Ative o canal para enviar mensagens por aqui",
          note: latestResponseNote,
        }}
        signals={[
          {
            label: "Número oficial",
            value: formatWhatsAppPhone(whatsappPublicPhone),
            tone: whatsappPublicPhone ? "success" : "soft",
          },
          {
            label: "Conversas prontas",
            value: conversationLeads.length,
            tone: conversationLeads.length ? "accent" : "soft",
          },
          {
            label: "Clientes que responderam",
            value: inboundMessagesCount,
            tone: inboundMessagesCount ? "accent" : "soft",
          },
        ]}
        stats={[
          {
            label: "Envios manuais",
            value: manualMessagesCount,
            note: manualMessagesCount
              ? "A equipe já usou o painel para responder clientes."
              : "Ainda não houve resposta manual recente.",
            tone: manualMessagesCount ? "accent" : "soft",
          },
          {
            label: "Mensagens entregues",
            value: deliveredCount,
            note: deliveredCount
              ? "O canal está entregando mensagens normalmente."
              : "Assim que houver envios, a entrega aparece aqui.",
            tone: deliveredCount ? "success" : "soft",
          },
          {
            label: "Ajustes necessários",
            value: errorCount,
            note: errorCount
              ? "Há mensagens pedindo revisão no histórico."
              : "Nenhum envio recente precisa de revisão.",
            tone: errorCount ? "danger" : "soft",
          },
        ]}
        actions={
          <div className="inline-actions" style={{ flexWrap: "wrap" }}>
            <a href="#conversas-whatsapp" className="secondary-button">
              Abrir conversas
            </a>
            <a href="#canal-whatsapp" className="secondary-button">
              Ajustar canal
            </a>
            <a
              href="/dashboard/gestao/agendamentos"
              className="secondary-button"
            >
              Agenda
            </a>
          </div>
        }
        aside={
          <div className="simple-list">
            <article className="simple-row">
              <h3>1. Escolha a conversa</h3>
              <p className="muted">
                As clientes com resposta recente, automação ou cadastro no CRM
                ficam na lista lateral.
              </p>
            </article>

            <article className="simple-row">
              <h3>2. Responda como no WhatsApp</h3>
              <p className="muted">
                O histórico fica no centro e a mensagem sai pelo mesmo número
                oficial do salão.
              </p>
            </article>

            <article className="simple-row">
              <h3>3. Mantenha a agenda alinhada</h3>
              <p className="muted">
                Confirmações, cancelamentos e pedidos de reagendamento voltam
                para o painel.
              </p>
            </article>
          </div>
        }
      />

      <section id="conversas-whatsapp" className="whatsapp-workspace">
        <aside className="card content-card whatsapp-sidebar">
          <div className="whatsapp-sidebar__header">
            <div className="section-heading">
              <div>
                <h2>Conversas</h2>
                <p className="muted">
                  Selecione um contato para abrir o histórico e responder.
                </p>
              </div>
            </div>
            <span className="whatsapp-sidebar__count">
              {conversationLeads.length
                ? `${conversationLeads.length} contato${conversationLeads.length === 1 ? "" : "s"} pronto${conversationLeads.length === 1 ? "" : "s"} para atendimento`
                : "Nenhuma conversa recente ainda"}
            </span>
          </div>

          <div className="whatsapp-sidebar__list">
            <a
              href={buildLeadSelectionPath(NEW_CONVERSATION_KEY)}
              className={[
                "whatsapp-conversation-link",
                isNewConversationSelected
                  ? "whatsapp-conversation-link--active"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              <div className="whatsapp-conversation-link__top">
                <strong>Nova conversa</strong>
                <span className="whatsapp-conversation-link__badge">
                  Manual
                </span>
              </div>
              <p>
                Digite nome, número e envie a primeira mensagem pelo painel.
              </p>
            </a>

            {conversationLeads.map((lead) => (
              <a
                key={lead.key}
                href={buildLeadSelectionPath(lead.key)}
                className={[
                  "whatsapp-conversation-link",
                  selectedLead?.key === lead.key
                    ? "whatsapp-conversation-link--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")}
              >
                <div className="whatsapp-conversation-link__top">
                  <strong>{lead.customerName}</strong>
                  <span className="whatsapp-conversation-link__time">
                    {formatCompactDateTime(lead.lastEventAt, timeZone)}
                  </span>
                </div>
                <span className="whatsapp-conversation-link__badge">
                  {formatLeadBadge(lead.lastEventBadge)}
                </span>
                <p>{lead.lastEventPreview}</p>
              </a>
            ))}
          </div>
        </aside>

        <article className="card content-card whatsapp-chat">
          <div className="whatsapp-chat__header">
            <div>
              <span className="eyebrow">
                {selectedLead ? "Conversa ativa" : "Nova conversa"}
              </span>
              <h2>
                {selectedLead ? selectedLead.customerName : "Envie a primeira mensagem"}
              </h2>
              {selectedLead && buildCustomerProfileBadges(selectedCustomerProfile).length ? (
                <div
                  className="inline-actions"
                  style={{ marginTop: 10, flexWrap: "wrap" }}
                >
                  {buildCustomerProfileBadges(selectedCustomerProfile).map((badge) => (
                    <span key={badge} className="badge badge--soft">
                      {badge}
                    </span>
                  ))}
                </div>
              ) : null}
              <p className="muted">
                {selectedLead
                  ? `${formatWhatsAppPhone(selectedLead.phone)} • ${formatLeadBadge(selectedLead.lastEventBadge)} em ${formatCompactDateTime(selectedLead.lastEventAt, timeZone)}`
                  : "Preencha somente o nome, o número e a mensagem. O restante fica por conta do painel."}
              </p>
            </div>

            {selectedLead ? (
              <div className="simple-row__actions">
                <a href={selectedLead.whatsappUrl} className="secondary-button">
                  Abrir no WhatsApp
                </a>
              </div>
            ) : null}
          </div>

          <div className="whatsapp-chat__canvas">
            {selectedLead ? (
              selectedConversation.length ? (
                <div className="whatsapp-chat__stack">
                  {selectedConversation.map((event) => {
                    if (event.kind === "dispatch") {
                      return (
                        <article
                          key={event.id}
                          className="whatsapp-bubble whatsapp-bubble--outgoing"
                        >
                          <div className="whatsapp-bubble__meta">
                            <span>
                              {formatDispatchSourceLabel(
                                event.record.notification_type,
                              )}
                            </span>
                            <span>
                              {formatConversationTime(event.eventAt, timeZone)}
                            </span>
                          </div>
                          <p>{event.record.body}</p>
                          <small>{buildDispatchFooter(event.record)}</small>
                        </article>
                      );
                    }

                    return (
                      <article
                        key={event.id}
                        className="whatsapp-bubble whatsapp-bubble--incoming"
                      >
                        <div className="whatsapp-bubble__meta">
                          <span>
                            {event.record.profile_name?.trim() || "Cliente"}
                          </span>
                          <span>
                            {formatConversationTime(event.eventAt, timeZone)}
                          </span>
                        </div>
                        <p>
                          {event.record.message_body?.trim() ||
                            "Sem texto registrado."}
                        </p>
                        <small>
                          {formatInboundIntent(event.record.interpreted_intent)}{" "}
                          • {formatHandledAction(event.record.handled_action)}
                        </small>
                      </article>
                    );
                  })}
                </div>
              ) : (
                <div className="whatsapp-chat__empty">
                  <strong>Esse contato ainda não tem histórico no painel</strong>
                  <p className="muted">
                    Use a caixa abaixo para iniciar a conversa pelo número
                    oficial do salão.
                  </p>
                </div>
              )
            ) : (
              <div className="whatsapp-chat__empty">
                <strong>Comece uma nova conversa</strong>
                <p className="muted">
                  Assim que a primeira mensagem for enviada, o histórico passa
                  a aparecer aqui como em uma conversa do WhatsApp.
                </p>
              </div>
            )}
          </div>

          <div className="whatsapp-chat__composer">
            {whatsappDispatchEnabled ? (
              selectedLead ? (
                <form
                  action={sendSalonManualWhatsAppAction}
                  className="simple-form"
                >
                  <input
                    type="hidden"
                    name="returnPath"
                    value={selectedReturnPath}
                  />
                  <input
                    type="hidden"
                    name="customerId"
                    value={selectedLead.customerId ?? ""}
                  />
                  <input
                    type="hidden"
                    name="customerName"
                    value={selectedLead.customerName}
                  />
                  <input
                    type="hidden"
                    name="customerPhone"
                    value={selectedLead.phone}
                  />
                  <WhatsAppComposer
                    autoFocus
                    textareaId="selected-whatsapp-message"
                    defaultValue={
                      selectedReplyPreset?.defaultMessage ??
                      selectedLead.suggestedMessage
                    }
                    placeholder={
                      selectedReplyPreset?.defaultMessage ??
                      selectedLead.suggestedMessage
                    }
                    quickReplySections={
                      selectedQuickReplySections.length
                        ? selectedQuickReplySections
                        : [
                            {
                              label: "Sugestões para resposta",
                              replies: [
                                {
                                  label: "Responder agora",
                                  message: selectedLead.suggestedMessage,
                                },
                              ],
                            },
                          ]
                    }
                    hint="A mensagem sai pelo número oficial do salão e volta para o histórico desta conversa."
                  />
                </form>
              ) : (
                <form
                  action={sendSalonManualWhatsAppAction}
                  className="simple-form"
                >
                  <input
                    type="hidden"
                    name="returnPath"
                    value={selectedReturnPath}
                  />

                  <div className="simple-form split-grid">
                    <div className="field">
                      <label htmlFor="manual-whatsapp-customer-name">
                        Cliente
                      </label>
                      <input
                        id="manual-whatsapp-customer-name"
                        name="customerName"
                        placeholder="Ex.: Ana Paula"
                      />
                    </div>

                    <div className="field">
                      <label htmlFor="manual-whatsapp-customer-phone">
                        Número de WhatsApp
                      </label>
                      <input
                        id="manual-whatsapp-customer-phone"
                        name="customerPhone"
                        placeholder="5511999999999"
                      />
                    </div>
                  </div>

                  <WhatsAppComposer
                    autoFocus
                    textareaId="manual-whatsapp-message"
                    defaultValue={buildDefaultMessage(salon.name)}
                    placeholder={buildDefaultMessage(salon.name)}
                    quickReplySections={buildNewConversationQuickReplySections(salon.name)}
                    hint="Use DDD e código do país, se necessário. O histórico desta nova conversa começa assim que a mensagem for enviada."
                  />
                </form>
              )
            ) : (
              <EmptyStateCard
                eyebrow="Canal desativado"
                title="Ative o envio do WhatsApp para responder pelo painel"
                description="Depois de ativar, a equipe pode conversar daqui mesmo sem sair da rotina do salão."
              />
            )}
          </div>
        </article>
      </section>

      <section
        id="canal-whatsapp"
        className="management-grid management-grid--two"
      >
        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Canal do salão</h2>
              <p className="muted">
                Só o que importa para a equipe: número oficial e liberação do
                envio pelo painel.
              </p>
            </div>
          </div>

          <form
            action={updateSalonWhatsAppSettingsAction}
            className="simple-form"
          >
            <div className="field">
              <label htmlFor="whatsapp-phone">Número oficial do salão</label>
              <input
                id="whatsapp-phone"
                name="whatsappPhone"
                defaultValue={salon.whatsapp_phone ?? ""}
                placeholder="5511999999999"
              />
              <small className="muted">
                Esse é o número que a cliente vê no app, na vitrine e nesta
                tela de conversa.
              </small>
            </div>

            <label className="checkbox-field">
              <input
                type="checkbox"
                name="whatsappDispatchEnabled"
                defaultChecked={whatsappDispatchEnabled}
              />
              Permitir mensagens pelo painel e pelas automações
            </label>

            <div className="simple-list">
              <article className="simple-row">
                <h3>Integração oficial</h3>
                <p className="muted">{whatsappIntegrationMessage}</p>
              </article>

              <article className="simple-row">
                <h3>Última resposta registrada</h3>
                <p className="muted">{latestResponseNote}</p>
              </article>
            </div>

            <div className="inline-actions">
              <button type="submit" className="primary-button">
                Salvar WhatsApp
              </button>
            </div>
          </form>
        </article>

        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Como a equipe usa essa tela</h2>
              <p className="muted">
                Uma operação mais simples e objetiva para quem atende na ponta.
              </p>
            </div>
          </div>

          <div className="simple-list">
            <article className="simple-row">
              <h3>Responder clientes em um lugar só</h3>
              <p className="muted">
                A lista lateral reúne quem respondeu, quem recebeu automação e
                quem já está no CRM com WhatsApp válido.
              </p>
            </article>

            <article className="simple-row">
              <h3>Confirmar horários e organizar retorno</h3>
              <p className="muted">
                Quando a cliente confirma, cancela ou pede reagendamento, o
                painel registra isso junto da agenda.
              </p>
              <div className="simple-row__actions">
                <a
                  href="/dashboard/gestao/agendamentos"
                  className="secondary-button"
                >
                  Ir para agenda
                </a>
              </div>
            </article>

            <article className="simple-row">
              <h3>Trazer clientes de volta</h3>
              <p className="muted">
                O mesmo canal é usado para recuperação, campanhas e contatos do
                dia a dia sem misturar termos técnicos.
              </p>
              <div className="simple-row__actions">
                <a href="/dashboard/operations" className="secondary-button">
                  Ver operações
                </a>
              </div>
            </article>
          </div>
        </article>
      </section>
    </div>
  );
}
