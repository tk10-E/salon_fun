import { loadBenefitsOverviewSnapshot } from "@/app/dashboard/benefits/_lib";
import {
  getClientAppVisualStyleOption,
  getClientExperienceModelOption,
  getClientHomeEmphasisOption,
  normalizeSalonClientAppConfig,
} from "@/lib/clientAppConfig";
import { resolveFeedStoryRecord } from "@/lib/feedStorySupport";
import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import { getCategory, type NotificationRow } from "../notifications/shared";
import type { ClientAppHubData } from "./_lib";

type FeedPostPreviewRow = {
  id: string;
  title: string;
  caption: string | null;
  post_type: "standard" | "before_after" | "reel" | "story" | null;
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

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function buildPublicSalonHref(joinCode: string, customDomain: string | null) {
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  if (customDomain) {
    const normalizedDomain = customDomain
      .replace(/^https?:\/\//i, "")
      .replace(/\/+$/g, "");
    return `https://${normalizedDomain}`;
  }

  return `/s/${normalizedJoinCode}`;
}

export async function loadClientAppHubData(): Promise<ClientAppHubData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const recentWindowStart = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const [
    benefitsOverviewSnapshot,
    servicesCountResult,
    postsResult,
    recentNotificationsCountResult,
    activePushTokensCountResult,
    recentPushTokensResult,
    recentNotificationsResult,
    recentPostsResult,
  ] = await Promise.all([
    loadBenefitsOverviewSnapshot(),
    supabase
      .from("services")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_posts")
      .select("id,title,post_type,created_at")
      .eq("salon_id", salon.id),
    supabase
      .from("salon_customer_notifications")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .gte("created_at", recentWindowStart),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("customer_push_tokens")
      .select("id", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .gte("last_seen_at", recentWindowStart),
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
      .neq("post_type", "story")
      .order("created_at", { ascending: false })
      .limit(4),
  ]);

  const clientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );
  const benefitsOverview = benefitsOverviewSnapshot.data;
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
        : "Falta uma frase de apoio para contextualizar o salão.",
    },
    {
      label: "WhatsApp",
      ready: Boolean(salon.whatsapp_phone?.trim()),
      summary: salon.whatsapp_phone?.trim()
        ? "Canal oficial pronto para a cliente falar com o salão."
        : "Falta um WhatsApp do salão para a cliente pedir ajuda rápido.",
    },
    {
      label: "Hero",
      ready: Boolean(
        clientAppConfig.heroImageVariantUrl ?? clientAppConfig.heroImageUrl,
      ),
      summary:
        (clientAppConfig.heroImageVariantUrl ?? clientAppConfig.heroImageUrl)
          ? "Capa principal pronta para a home."
          : "Sem imagem hero para a primeira impressao do app.",
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

  const recentPosts = ((recentPostsResult.data ?? []) as FeedPostPreviewRow[])
    .filter((post) => {
      const storyState = resolveFeedStoryRecord({
        createdAt: post.created_at,
        postType: post.post_type,
        title: post.title,
      });
      return !storyState.isStory;
    })
    .map((post) => {
      const storyState = resolveFeedStoryRecord({
        createdAt: post.created_at,
        postType: post.post_type,
        title: post.title,
      });
      const service = firstRelation(post.services);
      const postType: "standard" | "before_after" | "reel" =
        post.post_type === "before_after" || post.post_type === "reel"
          ? post.post_type
          : "standard";

      return {
        id: post.id,
        title: storyState.cleanTitle,
        caption: post.caption,
        postType,
        serviceName: service?.name ?? null,
        createdAt: post.created_at,
        likesCount: post.salon_post_likes?.length ?? 0,
        commentsCount: post.salon_post_comments?.length ?? 0,
      };
    });

  const postsCount = (
    (postsResult.data ?? []) as Array<{
      created_at?: string | null;
      id: string;
      post_type?: string | null;
      title?: string | null;
    }>
  ).filter((post) => {
    const storyState = resolveFeedStoryRecord({
      createdAt: post.created_at ?? null,
      postType: post.post_type ?? null,
      title: post.title ?? null,
    });
    return !storyState.isStory;
  }).length;

  return {
    salonName: salon.name?.trim() || "Salao",
    publicSalonPath: buildPublicSalonHref(
      salon.join_code,
      clientAppConfig.customDomain,
    ),
    whiteLabelActive: clientAppConfig.whiteLabelActive,
    autoPilotEnabled: clientAppConfig.autoPilotEnabled,
    appDisplayName: clientAppConfig.appDisplayName,
    customDomain: clientAppConfig.customDomain,
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
    postsCount,
    activeOffersCount: benefitsOverview.activeOffersCount,
    activeMembershipsCount: benefitsOverview.activeMembershipsCount,
    recentNotificationsCount: recentNotificationsCountResult.count ?? 0,
    activePushTokensCount: activePushTokensCountResult.count ?? 0,
    recentPushTokensCount: recentPushTokensResult.count ?? 0,
    commercialDataHealth: benefitsOverviewSnapshot.diagnostics,
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
