import {
  loadBenefitsOverviewData,
  type BenefitsOverviewData,
} from "@/app/dashboard/benefits/_lib";
import {
  getClientAppVisualStyleOption,
  getClientExperienceModelOption,
  getClientHomeEmphasisOption,
  normalizeSalonClientAppConfig,
} from "@/lib/clientAppConfig";
import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import {
  getCategory,
  type NotificationCategory,
  type NotificationRow,
} from "../notifications/shared";

type FeedPostPreviewRow = {
  id: string;
  title: string;
  caption: string | null;
  post_type: "standard" | "before_after" | "reel" | null;
  created_at: string;
  services:
    | {
        name: string;
      }
    | {
        name: string;
      }[]
    | null;
  salon_post_likes: { customer_id: string }[] | null;
  salon_post_comments: { id: string }[] | null;
};

type BrandSignal = {
  label: string;
  ready: boolean;
  summary: string;
};

export type ClientAppHubData = {
  salonName: string;
  publicSalonPath: string;
  experienceModelLabel: string;
  visualStyleLabel: string;
  homeEmphasisLabel: string;
  welcomeHeadline: string | null;
  heroHeadline: string | null;
  primaryCtaLabel: string | null;
  promotionHeadline: string | null;
  brandCoverageCount: number;
  brandSignals: BrandSignal[];
  centralCampaigns: Array<{
    id: string;
    isActive: boolean;
    priority: "high" | "medium" | "low";
    startsAt: string | null;
    endsAt: string | null;
    audience:
      | "all"
      | "with_upcoming_appointment"
      | "without_upcoming_appointment"
      | "with_active_benefits"
      | "without_active_benefits";
    eyebrow: string | null;
    title: string;
    message: string;
    campaignLabel: string | null;
    ctaLabel: string | null;
    ctaTarget:
      | "explore"
      | "appointments"
      | "feed"
      | "profile"
      | "notifications"
      | "support";
  }>;
  servicesCount: number;
  postsCount: number;
  activeOffersCount: number;
  activeMembershipsCount: number;
  recentNotificationsCount: number;
  activePushTokensCount: number;
  recentPushTokensCount: number;
  instagramConnectionCount: number;
  growthAutomationSettings: BenefitsOverviewData["growthAutomationSettings"];
  growthAutomationOverview: BenefitsOverviewData["growthAutomationOverview"];
  loyaltyOverview: BenefitsOverviewData["loyaltyOverview"];
  referralProgramActive: boolean;
  referralProgramTitle: string | null;
  qualifiedReferralsCount: number;
  pendingReferralsCount: number;
  recentNotifications: Array<{
    id: string;
    title: string;
    body: string;
    notificationType: string;
    category: NotificationCategory;
    audience: NotificationRow["audience"];
    createdAt: string;
  }>;
  recentPosts: Array<{
    id: string;
    title: string;
    caption: string | null;
    postType: "standard" | "before_after" | "reel";
    serviceName: string | null;
    createdAt: string;
    likesCount: number;
    commentsCount: number;
  }>;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function loadClientAppHubData(): Promise<ClientAppHubData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const recentWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    benefitsOverview,
    servicesCountResult,
    postsCountResult,
    recentNotificationsCountResult,
    activePushTokensCountResult,
    recentPushTokensResult,
    instagramConnectionCountResult,
    recentNotificationsResult,
    recentPostsResult,
  ] = await Promise.all([
    loadBenefitsOverviewData(),
    supabase
      .from("services")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_posts")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_customer_notifications")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart),
    supabase
      .from("customer_push_tokens")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("customer_push_tokens")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .gte("last_seen_at", recentWindowStart),
    supabase
      .from("instagram_connections")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_customer_notifications")
      .select("id, audience, notification_type, title, body, created_at")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(6),
    supabase
      .from("salon_posts")
      .select(
        "id,title,caption,post_type,created_at,services(name),salon_post_likes(customer_id),salon_post_comments(id)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const clientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );
  const experienceModelLabel = getClientExperienceModelOption(
    clientAppConfig.experienceModel,
  ).label;
  const visualStyleLabel = getClientAppVisualStyleOption(
    clientAppConfig.visualStyle,
  ).label;
  const homeEmphasisLabel = getClientHomeEmphasisOption(
    clientAppConfig.homeEmphasis,
  ).label;

  const brandSignals: BrandSignal[] = [
    {
      label: "Logo",
      ready: Boolean(salon.logo_path),
      summary: salon.logo_path
        ? "Identidade principal publicada."
        : "O app ainda precisa de um logo para parecer marca viva.",
    },
    {
      label: "Tagline",
      ready: Boolean(salon.tagline?.trim()),
      summary: salon.tagline?.trim()
        ? "Mensagem curta de marca configurada."
        : "Falta uma tagline para contextualizar o salão.",
    },
    {
      label: "WhatsApp",
      ready: Boolean(salon.whatsapp_phone?.trim()),
      summary: salon.whatsapp_phone?.trim()
        ? "Canal oficial liberado no app."
        : "Falta o contato direto para suporte rápido.",
    },
    {
      label: "Hero",
      ready: Boolean(
        clientAppConfig.heroImageVariantUrl ?? clientAppConfig.heroImageUrl,
      ),
      summary:
        (clientAppConfig.heroImageVariantUrl ?? clientAppConfig.heroImageUrl)
          ? "Capa principal pronta para a home."
          : "Sem imagem hero para a primeira impressão do app.",
    },
    {
      label: "Galeria",
      ready: Boolean(
        clientAppConfig.galleryCoverImageVariantUrl ??
        clientAppConfig.galleryCoverImageUrl,
      ),
      summary:
        (clientAppConfig.galleryCoverImageVariantUrl ??
        clientAppConfig.galleryCoverImageUrl)
          ? "Capa da central visual configurada."
          : "A central visual ainda não tem capa própria.",
    },
    {
      label: "Perfil",
      ready: Boolean(
        clientAppConfig.profileCoverImageVariantUrl ??
        clientAppConfig.profileCoverImageUrl,
      ),
      summary:
        (clientAppConfig.profileCoverImageVariantUrl ??
        clientAppConfig.profileCoverImageUrl)
          ? "Área de perfil do salão com acabamento visual."
          : "Falta capa para a área de perfil e benefícios.",
    },
  ];

  const recentNotifications = (
    (recentNotificationsResult.data ?? []) as Array<
      Pick<
        NotificationRow,
        | "id"
        | "audience"
        | "notification_type"
        | "title"
        | "body"
        | "created_at"
      >
    >
  ).map((notification) => ({
    id: notification.id,
    title: notification.title,
    body: notification.body,
    notificationType: notification.notification_type,
    category: getCategory(notification.notification_type),
    audience: notification.audience,
    createdAt: notification.created_at,
  }));

  const recentPosts = (
    (recentPostsResult.data ?? []) as FeedPostPreviewRow[]
  ).map((post) => {
    const service = firstRelation(post.services);

    return {
      id: post.id,
      title: post.title,
      caption: post.caption,
      postType: post.post_type ?? "standard",
      serviceName: service?.name ?? null,
      createdAt: post.created_at,
      likesCount: post.salon_post_likes?.length ?? 0,
      commentsCount: post.salon_post_comments?.length ?? 0,
    };
  });

  return {
    salonName: salon.name?.trim() || "Salão",
    publicSalonPath: `/s/${salon.join_code}`,
    experienceModelLabel,
    visualStyleLabel,
    homeEmphasisLabel,
    welcomeHeadline: clientAppConfig.welcomeHeadline,
    heroHeadline: clientAppConfig.heroHeadline,
    primaryCtaLabel: clientAppConfig.primaryCtaLabel,
    promotionHeadline: clientAppConfig.promotionHeadline,
    brandCoverageCount: brandSignals.filter((signal) => signal.ready).length,
    brandSignals,
    centralCampaigns: clientAppConfig.centralCampaigns,
    servicesCount: servicesCountResult.count ?? 0,
    postsCount: postsCountResult.count ?? 0,
    activeOffersCount: benefitsOverview.activeOffersCount,
    activeMembershipsCount: benefitsOverview.activeMembershipsCount,
    recentNotificationsCount: recentNotificationsCountResult.count ?? 0,
    activePushTokensCount: activePushTokensCountResult.count ?? 0,
    recentPushTokensCount: recentPushTokensResult.count ?? 0,
    instagramConnectionCount: instagramConnectionCountResult.count ?? 0,
    growthAutomationSettings: benefitsOverview.growthAutomationSettings,
    growthAutomationOverview: benefitsOverview.growthAutomationOverview,
    loyaltyOverview: benefitsOverview.loyaltyOverview,
    referralProgramActive: Boolean(benefitsOverview.referralProgram?.is_active),
    referralProgramTitle: benefitsOverview.referralProgram?.title ?? null,
    qualifiedReferralsCount: benefitsOverview.qualifiedReferralsCount,
    pendingReferralsCount: benefitsOverview.pendingReferralsCount,
    recentNotifications,
    recentPosts,
  };
}
