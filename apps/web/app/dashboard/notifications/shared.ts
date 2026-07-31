export type NotificationRow = {
  id: string;
  audience: "salon_customers" | "single_customer";
  notification_type: string;
  title: string;
  body: string;
  created_at: string;
  customer_id: string | null;
  customers: { name: string } | { name: string }[] | null;
};

export type NotificationDispatchSnapshot = {
  notification_id: string;
  status:
    | "queued"
    | "processing"
    | "delivered"
    | "partially_delivered"
    | "delivery_failed"
    | "enqueue_failed"
    | "skipped";
  response_status: number | null;
  sent_count: number | null;
  failed_count: number | null;
  deactivated_count: number | null;
  error_detail: string | null;
  updated_at: string;
};

export type NotificationCategory =
  | "promotion"
  | "growth"
  | "appointment"
  | "referral"
  | "service"
  | "feed"
  | "other";

export const CATEGORY_NOTIFICATION_TYPES = {
  promotion: [
    "promotion_published",
    "promotion_updated",
    "membership_published",
    "membership_updated",
    "membership_request_approved",
    "membership_request_paid",
    "membership_request_rejected",
    "birthday_campaign",
    "loyalty_program_updated",
    "loyalty_tier_unlocked",
    "loyalty_vip_unlocked",
  ],
  growth: [
    "winback_offer",
    "smart_rebook_prompt",
    "haircut_rebook_reminder",
    "membership_renewal_reminder",
    "manual_reactivation",
  ],
  appointment: [
    "appointment_confirmed",
    "appointment_deposit_required",
    "appointment_reminder_24h",
    "appointment_reminder_3h",
    "appointment_reminder_1h",
    "appointment_reminder_15m",
    "appointment_confirmation_required",
    "appointment_auto_cancelled_deposit_pending",
    "appointment_auto_cancelled_unconfirmed",
    "appointment_cancelled",
    "appointment_rescheduled",
    "appointment_no_show",
    "appointment_completed",
    "vacancy_alert",
  ],
  referral: [
    "referral_program_updated",
    "referral_qualified",
    "referral_reward_unlocked",
  ],
  service: ["service_published", "service_updated"],
  feed: ["feed_post_published"],
} as const;

export const KNOWN_NOTIFICATION_TYPES = Object.values(
  CATEGORY_NOTIFICATION_TYPES,
).flat();

export function firstParam(value?: string | string[]) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

export function getCategory(type: string): NotificationCategory {
  if (
    CATEGORY_NOTIFICATION_TYPES.promotion.includes(
      type as (typeof CATEGORY_NOTIFICATION_TYPES.promotion)[number],
    )
  ) {
    return "promotion";
  }

  if (
    CATEGORY_NOTIFICATION_TYPES.growth.includes(
      type as (typeof CATEGORY_NOTIFICATION_TYPES.growth)[number],
    )
  ) {
    return "growth";
  }

  if (
    CATEGORY_NOTIFICATION_TYPES.appointment.includes(
      type as (typeof CATEGORY_NOTIFICATION_TYPES.appointment)[number],
    )
  ) {
    return "appointment";
  }

  if (
    CATEGORY_NOTIFICATION_TYPES.referral.includes(
      type as (typeof CATEGORY_NOTIFICATION_TYPES.referral)[number],
    )
  ) {
    return "referral";
  }

  if (
    CATEGORY_NOTIFICATION_TYPES.service.includes(
      type as (typeof CATEGORY_NOTIFICATION_TYPES.service)[number],
    )
  ) {
    return "service";
  }

  if (
    CATEGORY_NOTIFICATION_TYPES.feed.includes(
      type as (typeof CATEGORY_NOTIFICATION_TYPES.feed)[number],
    )
  ) {
    return "feed";
  }

  return "other";
}

export function getTypesForCategory(category: NotificationCategory) {
  if (category === "other") {
    return [];
  }

  return CATEGORY_NOTIFICATION_TYPES[category];
}

export function formatCategoryLabel(category: NotificationCategory) {
  switch (category) {
    case "promotion":
      return "Promoções";
    case "growth":
      return "Recuperação";
    case "appointment":
      return "Agendamentos";
    case "referral":
      return "Indicações";
    case "service":
      return "Serviços";
    case "feed":
      return "Feed";
    default:
      return "Outros avisos";
  }
}

export function badgeClassForCategory(category: NotificationCategory) {
  switch (category) {
    case "promotion":
      return "badge badge--confirmed";
    case "growth":
      return "badge badge--completed";
    case "appointment":
      return "badge badge--pending";
    case "referral":
      return "badge badge--soft";
    case "service":
      return "badge badge--confirmed";
    case "feed":
      return "badge badge--pending";
    default:
      return "badge badge--soft";
  }
}

export function formatAudienceLabel(audience: NotificationRow["audience"]) {
  return audience === "single_customer"
    ? "Cliente específico"
    : "Todos os clientes";
}

export function formatNotificationType(type: string) {
  switch (type) {
    case "promotion_published":
      return "Promoção publicada";
    case "promotion_updated":
      return "Promoção atualizada";
    case "membership_published":
      return "Plano mensal publicado";
    case "membership_updated":
      return "Plano mensal atualizado";
    case "birthday_campaign":
      return "Campanha de aniversário";
    case "loyalty_program_updated":
      return "Programa de fidelidade atualizado";
    case "loyalty_tier_unlocked":
      return "Novo nível de fidelidade";
    case "loyalty_vip_unlocked":
      return "Cliente VIP desbloqueado";
    case "winback_offer":
      return "Recuperação de cliente";
    case "smart_rebook_prompt":
      return "Reagendamento inteligente";
    case "haircut_rebook_reminder":
      return "Lembrete de retorno para corte";
    case "membership_renewal_reminder":
      return "Lembrete de renovação do plano";
    case "membership_request_approved":
      return "Pedido de plano aprovado";
    case "membership_request_paid":
      return "Plano ativado para cliente";
    case "membership_request_rejected":
      return "Pedido de plano recusado";
    case "manual_reactivation":
      return "Reativação manual";
    case "referral_program_updated":
      return "Programa de indicação atualizado";
    case "referral_qualified":
      return "Indicação validada";
    case "referral_reward_unlocked":
      return "Recompensa de indicação liberada";
    case "service_published":
      return "Serviço publicado";
    case "service_updated":
      return "Serviço atualizado";
    case "staff_published":
      return "Novo profissional";
    case "staff_reactivated":
      return "Profissional reativado";
    case "store_product_published":
      return "Produto publicado na loja";
    case "store_product_updated":
      return "Produto atualizado na loja";
    case "client_app_updated":
      return "App do salão atualizado";
    case "feed_post_published":
      return "Publicação no feed";
    case "appointment_confirmed":
      return "Agendamento confirmado";
    case "appointment_deposit_required":
      return "Sinal da reserva pendente";
    case "appointment_reminder_1h":
      return "Lembrete de 1 hora";
    case "appointment_reminder_24h":
      return "Lembrete de 24 horas";
    case "appointment_reminder_3h":
      return "Lembrete de 3 horas";
    case "appointment_reminder_15m":
      return "Lembrete de 15 minutos";
    case "appointment_confirmation_required":
      return "Confirmação de presença solicitada";
    case "appointment_auto_cancelled_deposit_pending":
      return "Horário liberado por sinal pendente";
    case "appointment_auto_cancelled_unconfirmed":
      return "Horário liberado por falta de confirmação";
    case "appointment_cancelled":
      return "Agendamento cancelado";
    case "appointment_rescheduled":
      return "Agendamento reagendado";
    case "appointment_no_show":
      return "Cliente marcado como falta";
    case "appointment_completed":
      return "Atendimento concluído";
    case "vacancy_alert":
      return "Horário liberado";
    default:
      return "Aviso do salão";
  }
}

export function formatDispatchStatus(
  status?: NotificationDispatchSnapshot["status"] | null,
) {
  switch (status) {
    case "queued":
      return "Na fila";
    case "processing":
      return "Processando";
    case "delivered":
      return "Entregue";
    case "partially_delivered":
      return "Entrega parcial";
    case "delivery_failed":
      return "Falha na entrega";
    case "enqueue_failed":
      return "Falha ao enfileirar";
    case "skipped":
      return "Sem envio";
    default:
      return "Sem auditoria";
  }
}

export function badgeClassForDispatchStatus(
  status?: NotificationDispatchSnapshot["status"] | null,
) {
  switch (status) {
    case "delivered":
      return "badge badge--confirmed";
    case "partially_delivered":
      return "badge badge--pending";
    case "queued":
    case "processing":
      return "badge badge--soft";
    case "delivery_failed":
    case "enqueue_failed":
      return "badge badge--cancelled";
    case "skipped":
      return "badge badge--completed";
    default:
      return "badge badge--soft";
  }
}

export function parsePage(value?: string | string[]) {
  const raw = Number(firstParam(value));

  if (!Number.isFinite(raw) || raw < 1) {
    return 1;
  }

  return Math.floor(raw);
}

export function parseDateStart(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function parseDateEnd(value: string) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59.999`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function toCsvRow(values: string[]) {
  return values
    .map((value) => `"${String(value ?? "").replaceAll('"', '""')}"`)
    .join(",");
}
