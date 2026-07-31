import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type NoticeTone = "success" | "error" | "info";
type CustomerNotificationAudience = "salon_customers" | "single_customer";
type CustomerNotificationPayload = Record<
  string,
  string | number | boolean | null | undefined
>;

export type CustomerNotificationDeliveryChannel =
  | "push_and_inbox"
  | "inbox_only";
export type CustomerNotificationPushPriority = "high" | "normal";
type CustomerNotificationNavigationDefaults = {
  ctaTarget?: string;
  openInbox?: boolean;
  targetTabIndex?: number;
};

export const COMMERCIAL_OVERVIEW_PATH = "/dashboard/benefits";
export const COMMERCIAL_PROMOTIONS_PATH = "/dashboard/benefits/promotions";
export const COMMERCIAL_LOYALTY_PATH = "/dashboard/benefits/loyalty";
export const COMMERCIAL_REFERRALS_PATH = "/dashboard/benefits/referrals";
export const COMMERCIAL_AUTOMATIONS_PATH = "/dashboard/benefits/automations";
export const OPERATIONS_PATH = "/dashboard/operations";
export const INVENTORY_PATH = "/dashboard/inventory";
export const SUBSCRIPTIONS_PATH = "/dashboard/subscriptions";
export const FINANCE_PATH = "/dashboard/finance";

export function buildRedirectNotice(path: string, message: string, tone: NoticeTone = "info") {
  const parsed = new URL(path, "https://dashboard.local");
  const params = parsed.searchParams;

  params.set("message", message);
  params.set("tone", tone);

  return `${parsed.pathname}?${params.toString()}${parsed.hash}`;
}

export function rethrowIfRedirectError(error: unknown) {
  if (
    error &&
    typeof error === "object" &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT")
  ) {
    throw error;
  }

  if (
    error instanceof Error &&
    (error.message.startsWith("NEXT_REDIRECT") ||
      error.message.startsWith("TEST_REDIRECT:"))
  ) {
    throw error;
  }
}

export function resolveDashboardReturnPath(
  formData: FormData,
  fallbackPath: string,
  allowedPaths: readonly string[],
) {
  const returnPath = String(formData.get("returnPath") ?? "").trim();

  if (!returnPath) {
    return fallbackPath;
  }

  if (!returnPath.startsWith("/")) {
    return fallbackPath;
  }

  let parsed: URL;

  try {
    parsed = new URL(returnPath, "https://dashboard.local");
  } catch {
    return fallbackPath;
  }

  if (!allowedPaths.includes(parsed.pathname)) {
    return fallbackPath;
  }

  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}

export function revalidateCommercialPaths(...paths: string[]) {
  for (const path of new Set([COMMERCIAL_OVERVIEW_PATH, ...paths])) {
    revalidatePath(path);
  }
}

export function formatAppointmentDateTimeLabel(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Sao_Paulo",
  }).format(new Date(value));
}

export function formatPercentLabel(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(value);
}

export function truncateNotificationText(value: string, maxLength = 160) {
  const normalized = value.replace(/\s+/g, " ").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1).trimEnd()}…`;
}

export function resolveCustomerNotificationDeliveryPolicy(
  _notificationType: string,
) {
  return {
    deliveryChannel: "push_and_inbox" as CustomerNotificationDeliveryChannel,
    pushPriority: "high" as CustomerNotificationPushPriority,
  };
}

export function resolveCustomerNotificationNavigationDefaults(
  notificationType: string,
): CustomerNotificationNavigationDefaults {
  const normalizedType = notificationType.trim().toLowerCase();

  if (
    normalizedType.includes("appointment") ||
    normalizedType.includes("agenda") ||
    normalizedType.includes("booking") ||
    normalizedType.includes("rebook") ||
    normalizedType.includes("reminder") ||
    normalizedType.includes("vacancy")
  ) {
    return {
      ctaTarget: "appointments",
      targetTabIndex: 1,
    };
  }

  if (
    normalizedType.includes("service") ||
    normalizedType.includes("staff") ||
    normalizedType.includes("team")
  ) {
    return {
      ctaTarget: "appointments",
      targetTabIndex: 1,
    };
  }

  if (
    normalizedType.includes("store") ||
    normalizedType.includes("product") ||
    normalizedType.includes("vitrine")
  ) {
    return {
      ctaTarget: "store",
      targetTabIndex: 2,
    };
  }

  if (
    normalizedType.includes("feed") ||
    normalizedType.includes("post")
  ) {
    return {
      ctaTarget: "feed",
      targetTabIndex: 3,
    };
  }

  if (
    normalizedType.includes("loyalty") ||
    normalizedType.includes("referral") ||
    normalizedType.includes("membership")
  ) {
    return {
      ctaTarget: "profile",
      targetTabIndex: 4,
    };
  }

  if (normalizedType.includes("notification") || normalizedType.includes("inbox")) {
    return {
      ctaTarget: "notifications",
      openInbox: true,
      targetTabIndex: 0,
    };
  }

  return {
    ctaTarget: "home",
    targetTabIndex: 0,
  };
}

export function prepareCustomerNotificationPayload(
  notificationType: string,
  payload: CustomerNotificationPayload = {},
) {
  const policy = resolveCustomerNotificationDeliveryPolicy(notificationType);
  const navigationDefaults =
    resolveCustomerNotificationNavigationDefaults(notificationType);

  return Object.fromEntries(
    Object.entries({
      ...payload,
      deliveryChannel: policy.deliveryChannel,
      pushPriority:
        payload["pushPriority"] ?? policy.pushPriority,
      ctaTarget: payload["ctaTarget"] ?? navigationDefaults.ctaTarget,
      openInbox: payload["openInbox"] ?? navigationDefaults.openInbox,
      targetTabIndex:
        payload["targetTabIndex"] ?? navigationDefaults.targetTabIndex,
    }).filter(([, value]) => value !== undefined),
  ) as Record<string, string | number | boolean | null>;
}

export async function queueCustomerNotification(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  notificationType: string;
  title: string;
  body: string;
  audience?: CustomerNotificationAudience;
  customerId?: string | null;
  payload?: CustomerNotificationPayload;
}) {
  const {
    supabase,
    salonId,
    notificationType,
    title,
    body,
    audience = "salon_customers",
    customerId = null,
    payload = {},
  } = params;

  const cleanPayload = prepareCustomerNotificationPayload(
    notificationType,
    payload,
  );

  const { error } = await supabase.from("salon_customer_notifications").insert({
    salon_id: salonId,
    customer_id: audience === "single_customer" ? customerId : null,
    audience,
    notification_type: notificationType,
    title,
    body,
    payload: cleanPayload,
  });

  if (error) {
    console.error("Failed to queue customer notification", {
      salonId,
      notificationType,
      audience,
      customerId,
      detail: error.message,
    });
  }
}

export function buildFeedPostNotification(args: {
  postId: string;
  postTitle: string;
  postCaption: string;
  postImageUrl: string;
  postType: "standard" | "before_after" | "reel";
  postVideoUrl?: string | null;
  postPublishedAt: string;
  serviceId: string | null;
  serviceName: string | null;
  staffMemberName?: string | null;
}) {
  const formatLabel =
    args.postType === "reel" ? "vídeo curto" : args.postType === "before_after" ? "antes e depois" : "foto";
  const highlightSubject = args.serviceName ?? args.staffMemberName ?? args.postTitle;
  const notificationTitle = args.postType === "reel"
    ? `Novo vídeo de ${highlightSubject} no feed`
    : args.postType === "before_after"
      ? `Novo antes e depois de ${highlightSubject}`
      : args.serviceName
        ? `Nova foto de ${args.serviceName} no feed`
        : `Nova foto no feed: ${args.postTitle}`;
  const fallbackBody =
    args.serviceName || args.staffMemberName
      ? `${args.postTitle} acabou de entrar no feed como ${formatLabel} em ${highlightSubject}. Confira no app.`
      : `${args.postTitle} acabou de entrar no feed do salão como ${formatLabel}. Confira no app.`;

  return {
    title: notificationTitle,
    body: truncateNotificationText(args.postCaption || fallbackBody),
    payload: {
      type: "feed_post_published",
      postId: args.postId,
      postTitle: args.postTitle,
      postCaption: args.postCaption || null,
      postImageUrl: args.postImageUrl,
      postType: args.postType,
      postVideoUrl: args.postVideoUrl ?? null,
      postPublishedAt: args.postPublishedAt,
      serviceId: args.serviceId,
      serviceName: args.serviceName,
      staffMemberName: args.staffMemberName ?? null,
    },
  };
}

export function buildStaffAvailabilityNotification(args: {
  action: "created" | "reactivated";
  staffMemberName: string;
  staffRole?: string | null;
}) {
  const roleLabel = args.staffRole?.trim() || null;
  const title =
    args.action === "created"
      ? "Novo profissional no salão"
      : "Equipe atualizada no salão";
  const body =
    args.action === "created"
      ? roleLabel
        ? `${args.staffMemberName} entrou para a equipe como ${roleLabel} e já pode aparecer nos agendamentos do app.`
        : `${args.staffMemberName} entrou para a equipe e já pode aparecer nos agendamentos do app.`
      : roleLabel
        ? `${args.staffMemberName} voltou para a agenda do salão como ${roleLabel}. Confira os horários no app.`
        : `${args.staffMemberName} voltou para a agenda do salão. Confira os horários no app.`;
  const type =
    args.action === "created" ? "staff_published" : "staff_reactivated";

  return {
    title,
    body,
    type,
    payload: {
      type,
      ctaTarget: "appointments",
      staffMemberName: args.staffMemberName,
      staffRole: roleLabel,
    },
  };
}

export function buildServiceCatalogNotification(args: {
  action: "published" | "updated";
  serviceName: string;
  category?: string | null;
  serviceId?: string | null;
}) {
  const categoryLabel = args.category?.trim() || null;
  const type =
    args.action === "published" ? "service_published" : "service_updated";

  return {
    title:
      args.action === "published"
        ? "Novo serviço disponível no app"
        : "Serviço atualizado no app",
    body:
      args.action === "published"
        ? categoryLabel
          ? `${args.serviceName} entrou no catálogo de ${categoryLabel} e já pode ser agendado pelo app.`
          : `${args.serviceName} entrou no catálogo e já pode ser agendado pelo app.`
        : categoryLabel
          ? `${args.serviceName} foi atualizado em ${categoryLabel}. Confira preço, duração e detalhes no app.`
          : `${args.serviceName} foi atualizado. Confira preço, duração e detalhes no app.`,
    type,
    payload: {
      type,
      ctaTarget: "appointments",
      serviceId: args.serviceId ?? null,
      serviceName: args.serviceName,
      category: categoryLabel,
    },
  };
}

export function buildStoreProductNotification(args: {
  action: "published" | "updated";
  productName: string;
  brand?: string | null;
}) {
  const brandLabel = args.brand?.trim() || null;
  const type =
    args.action === "published"
      ? "store_product_published"
      : "store_product_updated";

  return {
    title:
      args.action === "published"
        ? "Novo produto na loja do salão"
        : "Loja do salão atualizada",
    body:
      args.action === "published"
        ? brandLabel
          ? `${args.productName} da ${brandLabel} já está disponível na vitrine do app.`
          : `${args.productName} já está disponível na vitrine do app.`
        : brandLabel
          ? `${args.productName} da ${brandLabel} recebeu novidades na loja do salão.`
          : `${args.productName} recebeu novidades na loja do salão.`,
    type,
    payload: {
      type,
      ctaTarget: "store",
      productName: args.productName,
      brand: brandLabel,
    },
  };
}

export function buildAppointmentRescheduledNotification(args: {
  appointmentId: string;
  nextServiceName: string;
  nextStaffMemberName?: string | null;
  nextStartsAt: string;
  previousStartsAt: string;
  previousStaffMemberName?: string | null;
  previousServiceName?: string | null;
}) {
  const previousServiceName = args.previousServiceName?.trim() || args.nextServiceName;
  const previousStaffMemberName = args.previousStaffMemberName?.trim() || null;
  const nextStaffMemberName = args.nextStaffMemberName?.trim() || null;
  const previousLabel = formatAppointmentDateTimeLabel(args.previousStartsAt);
  const nextLabel = formatAppointmentDateTimeLabel(args.nextStartsAt);

  const bodyParts = [
    previousServiceName !== args.nextServiceName
      ? `${previousServiceName} foi reajustado para ${args.nextServiceName}.`
      : `${args.nextServiceName} foi remarcado pelo salão.`,
    `Antes: ${previousLabel}${previousStaffMemberName ? ` com ${previousStaffMemberName}` : ""}.`,
    `Agora: ${nextLabel}${nextStaffMemberName ? ` com ${nextStaffMemberName}` : ""}.`,
    "Abra o app para revisar os detalhes.",
  ];

  return {
    title: "Seu horário mudou no salão",
    body: bodyParts.join(" "),
    type: "appointment_rescheduled",
    payload: {
      type: "appointment_rescheduled",
      appointmentId: args.appointmentId,
      appointmentStartsAt: args.nextStartsAt,
      previousAppointmentStartsAt: args.previousStartsAt,
      ctaTarget: "appointments",
      openInbox: true,
      serviceName: args.nextServiceName,
      previousServiceName,
      staffMemberName: nextStaffMemberName,
      previousStaffMemberName,
      targetTabIndex: 1,
    },
  };
}

export function buildAppointmentNoShowNotification(args: {
  appointmentId: string;
  serviceName: string;
  startsAt: string;
  staffMemberName?: string | null;
}) {
  const staffLabel = args.staffMemberName?.trim() || null;
  const appointmentLabel = formatAppointmentDateTimeLabel(args.startsAt);

  return {
    title: "Seu horário foi marcado como falta",
    body: staffLabel
      ? `${args.serviceName} em ${appointmentLabel} com ${staffLabel} foi marcado como falta pelo salão. Se algo estiver errado, fale com a equipe no app.`
      : `${args.serviceName} em ${appointmentLabel} foi marcado como falta pelo salão. Se algo estiver errado, fale com a equipe no app.`,
    type: "appointment_no_show",
    payload: {
      type: "appointment_no_show",
      appointmentId: args.appointmentId,
      appointmentStartsAt: args.startsAt,
      ctaTarget: "appointments",
      openInbox: true,
      serviceName: args.serviceName,
      staffMemberName: staffLabel,
      targetTabIndex: 1,
    },
  };
}

function buildStoreOrderItemsLabel(args: {
  firstItemName?: string | null;
  totalItems?: number | null;
}) {
  const firstItemName = args.firstItemName?.trim() || null;
  const totalItems = Number(args.totalItems ?? 0);

  if (!firstItemName) {
    return null;
  }

  if (totalItems > 1) {
    return `${firstItemName} e mais ${totalItems - 1} item(ns)`;
  }

  return firstItemName;
}

export function buildStoreOrderStatusNotification(args: {
  status: "confirmed" | "ready" | "completed" | "cancelled";
  orderId: string;
  orderNumber?: number | null;
  firstItemName?: string | null;
  totalItems?: number | null;
  cancellationReason?: string | null;
}) {
  const type = `store_order_${args.status}`;
  const orderLabel = args.orderNumber
    ? `Pedido #${args.orderNumber}`
    : "Seu pedido da loja";
  const itemsLabel = buildStoreOrderItemsLabel({
    firstItemName: args.firstItemName,
    totalItems: args.totalItems,
  });
  const orderContext = itemsLabel
    ? `${orderLabel} com ${itemsLabel}`
    : orderLabel;
  const cancellationReason = args.cancellationReason?.trim() || null;

  const copyByStatus = {
    confirmed: {
      title: "Seu pedido da loja foi confirmado",
      body: `${orderContext} foi confirmado pelo salão e já aparece atualizado no app.`,
    },
    ready: {
      title: "Seu pedido da loja está pronto",
      body: `${orderContext} foi separado e está pronto para a próxima etapa.`,
    },
    completed: {
      title: "Pedido da loja concluído",
      body: `${orderContext} foi marcado como concluído pelo salão.`,
    },
    cancelled: {
      title: "Seu pedido da loja foi cancelado",
      body: cancellationReason
        ? `${orderContext} foi cancelado. Motivo: ${cancellationReason}.`
        : `${orderContext} foi cancelado pelo salão.`,
    },
  } as const;

  const copy = copyByStatus[args.status];

  return {
    title: copy.title,
    body: copy.body,
    type,
    payload: {
      type,
      ctaTarget: "store",
      orderId: args.orderId,
      orderNumber: args.orderNumber ?? null,
      orderStatus: args.status,
      productName: args.firstItemName?.trim() || null,
      totalItems: args.totalItems ?? null,
      cancellationReason,
      openInbox: true,
      targetTabIndex: 2,
    },
  };
}

export function buildClientAppRefreshNotification(args: {
  changedAreas: string[];
}) {
  const normalizedAreas = [...new Set(args.changedAreas.filter(Boolean))];
  const type = "client_app_updated";
  const labelByArea = new Map<string, string>([
    ["identidade", "identidade visual"],
    ["vitrine", "vitrine do app"],
    ["campanhas", "campanhas e destaques"],
    ["informacoes", "informações do salão"],
  ]);
  const areaLabels = normalizedAreas.map((area) => labelByArea.get(area) ?? area);

  const body =
    areaLabels.length <= 1
      ? `O salão atualizou ${areaLabels[0] ?? "o app"}. Confira as novidades no app.`
      : `O salão atualizou ${areaLabels.slice(0, -1).join(", ")} e ${areaLabels.at(-1)}. Confira as novidades no app.`;
  const ctaTarget =
    normalizedAreas.length == 1 && normalizedAreas[0] === "vitrine"
      ? "store"
      : "home";

  return {
    title: "Novidades no app do salão",
    body,
    type,
    payload: {
      type,
      ctaTarget,
      changedAreas: normalizedAreas.join(","),
    },
  };
}
