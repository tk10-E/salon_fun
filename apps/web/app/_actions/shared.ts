import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type NoticeTone = "success" | "error" | "info";
type CustomerNotificationAudience = "salon_customers" | "single_customer";

export const COMMERCIAL_OVERVIEW_PATH = "/dashboard/benefits";
export const COMMERCIAL_PROMOTIONS_PATH = "/dashboard/benefits/promotions";
export const COMMERCIAL_LOYALTY_PATH = "/dashboard/benefits/loyalty";
export const COMMERCIAL_REFERRALS_PATH = "/dashboard/benefits/referrals";
export const COMMERCIAL_AUTOMATIONS_PATH = "/dashboard/benefits/automations";
export const OPERATIONS_PATH = "/dashboard/operations";

export function buildRedirectNotice(path: string, message: string, tone: NoticeTone = "info") {
  const [pathname, currentQuery = ""] = path.split("?", 2);
  const params = new URLSearchParams(currentQuery);

  params.set("message", message);
  params.set("tone", tone);

  return `${pathname}?${params.toString()}`;
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

export async function queueCustomerNotification(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  notificationType: string;
  title: string;
  body: string;
  audience?: CustomerNotificationAudience;
  customerId?: string | null;
  payload?: Record<string, string | number | boolean | null | undefined>;
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

  const cleanPayload = Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined),
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
