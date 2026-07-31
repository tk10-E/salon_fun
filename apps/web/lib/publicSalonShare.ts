import {
  normalizeSalonClientAppConfig,
  resolveClientAppVisualStyle,
  resolveClientExperienceModel,
  resolveClientHomeEmphasis,
} from "@/lib/clientAppConfig";
import {
  isMonthlyMembershipPlan,
  resolveMembershipOfferLabel,
} from "@/lib/membershipOffers";
import { listResolvedAppointmentReviews } from "@/lib/appointmentReviews";
import {
  isLegacyStoryTitle,
  resolveFeedStoryRecord,
} from "@/lib/feedStorySupport";
import { getSalonSegmentPreset } from "@/lib/salonSegments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PublicSalonPreviewRow = {
  id?: string;
  salon_id?: string;
  name?: string;
  tagline?: string | null;
  whatsapp_phone?: string | null;
  brand_color?: string | null;
  business_segment?: string | null;
  logo_path?: string | null;
  booking_policy_enabled?: boolean | null;
  booking_policy_title?: string | null;
  booking_policy_summary?: string | null;
  booking_policy_payment_mode?: string | null;
  booking_policy_pix_key?: string | null;
  booking_policy_pix_recipient_name?: string | null;
  booking_policy_pix_recipient_city?: string | null;
  booking_policy_external_checkout_url?: string | null;
  booking_policy_requires_deposit?: boolean | null;
  booking_policy_deposit_amount?: number | null;
  booking_policy_payment_instructions?: string | null;
  client_app_config?: unknown;
};

type PublicServiceRow = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  duration: number;
  price: number;
  image_path: string | null;
  is_active: boolean;
  sort_order: number | null;
};

type PublicServiceAppointmentRow = {
  service_id?: string | null;
  status?: string | null;
};

type PublicOfferRow = {
  id: string;
  kind: string;
  title: string;
  description: string | null;
  highlight_text: string | null;
  image_path: string | null;
  membership_service_id: string | null;
  membership_sessions_included: number | null;
  membership_validity_days: number | null;
  price: number | null;
  is_active: boolean;
  starts_on: string | null;
  ends_on: string | null;
  sort_order: number | null;
};

type PublicFeedPostRow = {
  id: string;
  title: string;
  caption: string | null;
  image_path: string | null;
  created_at: string;
  post_type: string | null;
  source_type: string | null;
  external_author_avatar_url: string | null;
  external_author_username: string | null;
  services?: { name?: string | null } | { name?: string | null }[] | null;
  staff_members?:
    | { name?: string | null; role?: string | null }
    | { name?: string | null; role?: string | null }[]
    | null;
  salon_post_images?:
    | { image_path?: string | null; sort_order?: number | null }[]
    | null;
  salon_post_likes?: { customer_id?: string | null }[] | null;
  salon_post_comments?: { id?: string | null }[] | null;
};

export type PublicSalonSharePreview = {
  salonId: string;
  joinCode: string;
  name: string;
  appDisplayName: string | null;
  tagline: string | null;
  brandColor: string;
  secondaryColor: string | null;
  accentColor: string | null;
  experienceModel: string;
  homeEmphasis: string;
  businessSegment: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  galleryCoverImageUrl: string | null;
  profileCoverImageUrl: string | null;
  shareImageUrl: string | null;
  heroHeadline: string | null;
  heroSupportLine: string | null;
  primaryCtaLabel: string | null;
  visualStyle: string;
  themeMode: string | null;
  buttonStyle: string | null;
  cardStyle: string | null;
  bannerStyle: string | null;
  welcomeHeadline: string | null;
  welcomeMessage: string | null;
  promotionHeadline: string | null;
  addressLabel: string | null;
  whatsappPhone: string | null;
  mapUrl: string | null;
  privacyPolicyUrl: string | null;
  termsOfUseUrl: string | null;
  supportUrl: string | null;
  supportEmail: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  bookingPolicyEnabled: boolean;
  bookingPolicyTitle: string | null;
  bookingPolicySummary: string | null;
  bookingPaymentMode: string | null;
  bookingRequiresDeposit: boolean;
  bookingDepositAmount: number | null;
  bookingPaymentInstructions: string | null;
  bookingPixKey: string | null;
  bookingPixRecipientName: string | null;
  bookingPixRecipientCity: string | null;
  bookingExternalCheckoutUrl: string | null;
  visibleHomeModules: string[];
  moduleLabels: string[];
  segmentLabel: string;
  segmentDescription: string;
};

export type PublicSalonCampaign = {
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
};

export type PublicSalonServiceHighlight = {
  id: string;
  name: string;
  category: string | null;
  description: string | null;
  duration: number;
  price: number;
  imageUrl: string | null;
};

export type PublicSalonOfferHighlight = {
  id: string;
  kind: "promotion" | "membership";
  title: string;
  description: string | null;
  highlightText: string | null;
  imageUrl: string | null;
  bookingServiceId: string | null;
  bookingServiceName: string | null;
  actionKind: "open_agenda" | "book_service" | "request_membership";
  kindLabel: string;
  priceLabel: string | null;
  lifecycleLabel: string;
};

export type PublicSalonGalleryHighlight = {
  id: string;
  title: string;
  caption: string | null;
  imageUrl: string | null;
  badge: string | null;
  serviceName: string | null;
  staffLabel: string | null;
  authorAvatarUrl: string | null;
  sourceLabel: string | null;
};

export type PublicSalonReviewHighlight = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  serviceName: string | null;
  staffName: string | null;
  staffImageUrl: string | null;
};

export type PublicSalonLandingData = {
  preview: PublicSalonSharePreview;
  featuredServices: PublicSalonServiceHighlight[];
  activeOffers: PublicSalonOfferHighlight[];
  recentPosts: PublicSalonGalleryHighlight[];
  recentReviews: PublicSalonReviewHighlight[];
  centralCampaigns: PublicSalonCampaign[];
  stats: {
    servicesCount: number;
    activeOffersCount: number;
    recentPostsCount: number;
  };
};

export async function fetchPublicSalonSharePreview(
  joinCode: string,
): Promise<PublicSalonSharePreview | null> {
  const context = await resolvePublicSalonPreviewContext(joinCode);
  if (!context) {
    return null;
  }

  try {
    const reviewSnapshot = await loadPublicSalonReviewSnapshot(
      context.preview.salonId,
    );
    return applyReviewSnapshotToPreview(context.preview, reviewSnapshot);
  } catch {
    return context.preview;
  }
}

export async function fetchPublicSalonLandingData(
  joinCode: string,
): Promise<PublicSalonLandingData | null> {
  const rpcLanding = await loadPublicLandingFromRpc(joinCode);
  if (rpcLanding) {
    return enrichPublicLandingWithReviews(rpcLanding);
  }

  const previewLanding = await loadPublicLandingFromPreview(joinCode);
  if (!previewLanding) {
    return null;
  }

  return enrichPublicLandingWithReviews(previewLanding);
}

async function loadPublicLandingFromRpc(joinCode: string) {
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  if (!normalizedJoinCode) {
    return null;
  }

  try {
    const supabase = createClient();
    const payload = await supabase.rpc(
      "get_public_salon_landing_by_join_code",
      {
        input_join_code: normalizedJoinCode,
      },
    );
    const normalizedPayload = coerceLandingPayload(payload);
    if (!normalizedPayload) {
      return null;
    }

    const recentPosts = normalizedPayload.recentPosts
      .filter((post) => !isLegacyStoryTitle(post.title))
      .map((post) => ({
        ...post,
        title: post.title?.trim() || "Trabalho recente",
      }));

    return {
      ...normalizedPayload,
      recentPosts,
      stats: {
        ...normalizedPayload.stats,
        recentPostsCount: recentPosts.length,
      },
    };
  } catch (error) {
    console.error("Failed to load public landing from canonical RPC", {
      joinCode: normalizedJoinCode,
      error,
    });
    return null;
  }
}

async function loadPublicLandingFromPreview(
  joinCode: string,
): Promise<PublicSalonLandingData | null> {
  const context = await resolvePublicSalonPreviewContext(joinCode);
  if (!context) {
    return null;
  }

  const supabase = context.supabase as ReturnType<typeof createClient>;
  const [featuredServices, activeOffers, recentPosts] = await Promise.all([
    loadPublicServices(supabase, context.preview.salonId),
    loadPublicOffers(supabase, context.preview.salonId),
    loadPublicPosts(supabase, context.preview.salonId),
  ]);

  return {
    preview: context.preview,
    featuredServices: featuredServices.slice(0, 12),
    activeOffers: activeOffers.slice(0, 12),
    recentPosts: recentPosts.slice(0, 6),
    recentReviews: [],
    centralCampaigns: context.centralCampaigns,
    stats: {
      servicesCount: featuredServices.length,
      activeOffersCount: activeOffers.length,
      recentPostsCount: recentPosts.length,
    },
  };
}

async function resolvePublicSalonPreviewContext(joinCode: string) {
  const normalizedJoinCode = joinCode.trim().toUpperCase();
  if (!normalizedJoinCode) {
    return null;
  }

  const adminSupabase = tryCreateAdminPublicSalonClient();
  const supabase = adminSupabase ?? createClient();
  const previewRow = adminSupabase
    ? await loadJoinPreviewFromAdminTable(adminSupabase, normalizedJoinCode)
    : ((await loadJoinPreviewFromRpc(supabase, normalizedJoinCode)) ??
      (await loadJoinPreviewFromTable(supabase, normalizedJoinCode)));

  if (!previewRow) {
    return null;
  }

  const salonId = String(previewRow.salon_id ?? previewRow.id ?? "").trim();
  if (!salonId) {
    return null;
  }

  const clientAppConfig = normalizeSalonClientAppConfig(
    previewRow.client_app_config as never,
  );
  const segmentPreset = getSalonSegmentPreset(previewRow.business_segment);
  const resolvedExperienceModel = resolveClientExperienceModel(
    clientAppConfig.experienceModel,
    segmentPreset.value,
  );
  const resolvedVisualStyle = resolveClientAppVisualStyle(
    clientAppConfig.visualStyle,
    segmentPreset.value,
    clientAppConfig.experienceModel,
  );
  const resolvedHomeEmphasis = resolveClientHomeEmphasis(
    clientAppConfig.homeEmphasis,
    segmentPreset.value,
    clientAppConfig.experienceModel,
  );
  const logoPath = normalizeText(previewRow.logo_path);
  const logoUrl = logoPath
    ? supabase.storage.from("salon-assets").getPublicUrl(logoPath).data
        .publicUrl
    : null;
  const resolvedHeroImageUrl =
    clientAppConfig.heroImageTabletVariantUrl ??
    clientAppConfig.heroImageVariantUrl ??
    clientAppConfig.heroImageUrl ??
    clientAppConfig.profileCoverImageTabletVariantUrl ??
    clientAppConfig.profileCoverImageVariantUrl ??
    clientAppConfig.profileCoverImageUrl ??
    logoUrl;
  const resolvedGalleryCoverImageUrl =
    clientAppConfig.galleryCoverImageTabletVariantUrl ??
    clientAppConfig.galleryCoverImageVariantUrl ??
    clientAppConfig.galleryCoverImageUrl ??
    resolvedHeroImageUrl;
  const resolvedProfileCoverImageUrl =
    clientAppConfig.profileCoverImageTabletVariantUrl ??
    clientAppConfig.profileCoverImageVariantUrl ??
    clientAppConfig.profileCoverImageUrl ??
    resolvedHeroImageUrl;

  const preview: PublicSalonSharePreview = {
    salonId,
    joinCode: normalizedJoinCode,
    name: normalizeText(previewRow.name) ?? "Salão",
    appDisplayName: clientAppConfig.appDisplayName,
    tagline: normalizeText(previewRow.tagline),
    brandColor:
      normalizeText(previewRow.brand_color) ??
      clientAppConfig.secondaryColor ??
      clientAppConfig.accentColor ??
      segmentPreset.suggestedBrandColor,
    secondaryColor: clientAppConfig.secondaryColor,
    accentColor: clientAppConfig.accentColor,
    experienceModel: resolvedExperienceModel,
    homeEmphasis: resolvedHomeEmphasis,
    businessSegment: normalizeText(previewRow.business_segment),
    logoUrl,
    heroImageUrl: resolvedHeroImageUrl,
    galleryCoverImageUrl: resolvedGalleryCoverImageUrl,
    profileCoverImageUrl: resolvedProfileCoverImageUrl,
    shareImageUrl: resolveSalonShareImage(clientAppConfig, logoUrl),
    heroHeadline: clientAppConfig.heroHeadline ?? segmentPreset.mobileHeadline,
    heroSupportLine:
      clientAppConfig.heroSupportLine ?? segmentPreset.mobileSupport,
    primaryCtaLabel: clientAppConfig.primaryCtaLabel,
    visualStyle: resolvedVisualStyle,
    themeMode: clientAppConfig.themeMode,
    buttonStyle: clientAppConfig.buttonStyle,
    cardStyle: clientAppConfig.cardStyle,
    bannerStyle: clientAppConfig.bannerStyle,
    welcomeHeadline:
      clientAppConfig.welcomeHeadline ??
      clientAppConfig.heroHeadline ??
      segmentPreset.mobileHeadline,
    welcomeMessage:
      clientAppConfig.welcomeMessage ??
      clientAppConfig.promotionHeadline ??
      segmentPreset.mobileSupport,
    promotionHeadline:
      clientAppConfig.promotionHeadline ?? segmentPreset.mobileSupport,
    addressLabel: clientAppConfig.addressLabel,
    whatsappPhone: normalizeText(previewRow.whatsapp_phone),
    mapUrl: clientAppConfig.mapUrl,
    privacyPolicyUrl: clientAppConfig.privacyPolicyUrl,
    termsOfUseUrl: clientAppConfig.termsOfUseUrl,
    supportUrl: clientAppConfig.supportUrl,
    supportEmail: clientAppConfig.supportEmail,
    ratingValue: clientAppConfig.ratingValue,
    ratingCount: clientAppConfig.ratingCount,
    bookingPolicyEnabled: previewRow.booking_policy_enabled === true,
    bookingPolicyTitle: normalizeText(previewRow.booking_policy_title),
    bookingPolicySummary: normalizeText(previewRow.booking_policy_summary),
    bookingPaymentMode: normalizeText(previewRow.booking_policy_payment_mode),
    bookingRequiresDeposit: previewRow.booking_policy_requires_deposit === true,
    bookingDepositAmount:
      previewRow.booking_policy_deposit_amount == null
        ? null
        : Number(previewRow.booking_policy_deposit_amount ?? 0),
    bookingPaymentInstructions: normalizeText(
      previewRow.booking_policy_payment_instructions,
    ),
    bookingPixKey: normalizeText(previewRow.booking_policy_pix_key),
    bookingPixRecipientName: normalizeText(
      previewRow.booking_policy_pix_recipient_name,
    ),
    bookingPixRecipientCity: normalizeText(
      previewRow.booking_policy_pix_recipient_city,
    ),
    bookingExternalCheckoutUrl: normalizeText(
      previewRow.booking_policy_external_checkout_url,
    ),
    visibleHomeModules: [...clientAppConfig.visibleHomeModules],
    moduleLabels:
      clientAppConfig.visibleHomeModules.length > 0
        ? clientAppConfig.visibleHomeModules.map(
            (module) => HOME_MODULE_LABELS[module] ?? module,
          )
        : [...segmentPreset.focusAreas],
    segmentLabel: segmentPreset.label,
    segmentDescription: segmentPreset.shortDescription,
  };

  return {
    preview,
    centralCampaigns: filterPublicCentralCampaigns(
      clientAppConfig.centralCampaigns,
    ),
    supabase,
  };
}

async function enrichPublicLandingWithReviews(
  landing: PublicSalonLandingData,
): Promise<PublicSalonLandingData> {
  let reviewSnapshot: {
    ratingCount: number;
    ratingValue: number | null;
    recentReviews: PublicSalonReviewHighlight[];
  };

  try {
    reviewSnapshot = await loadPublicSalonReviewSnapshot(
      landing.preview.salonId,
    );
  } catch {
    return landing;
  }

  return {
    ...landing,
    preview: applyReviewSnapshotToPreview(landing.preview, reviewSnapshot),
    recentReviews: reviewSnapshot.recentReviews,
  };
}

function applyReviewSnapshotToPreview(
  preview: PublicSalonSharePreview,
  snapshot: {
    ratingCount: number;
    ratingValue: number | null;
  },
): PublicSalonSharePreview {
  if (!snapshot.ratingCount || snapshot.ratingValue == null) {
    return preview;
  }

  return {
    ...preview,
    ratingCount: snapshot.ratingCount,
    ratingValue: snapshot.ratingValue,
  };
}

async function loadPublicSalonReviewSnapshot(salonId: string): Promise<{
  ratingCount: number;
  ratingValue: number | null;
  recentReviews: PublicSalonReviewHighlight[];
}> {
  const reviews = await listResolvedAppointmentReviews({ salonId });
  if (!reviews.length) {
    return {
      ratingCount: 0,
      ratingValue: null,
      recentReviews: [],
    };
  }

  const serviceIds = [
    ...new Set(
      reviews
        .map((review) => review.serviceId.trim())
        .filter((value) => value.length > 0),
    ),
  ];
  const staffMemberIds = [
    ...new Set(
      reviews
        .map((review) => review.staffMemberId.trim())
        .filter((value) => value.length > 0),
    ),
  ];
  const admin = createAdminClient();
  const [servicesResult, staffMembersResult] = await Promise.all([
    serviceIds.length
      ? admin.from("services").select("id, name").in("id", serviceIds)
      : Promise.resolve({ data: [], error: null }),
    loadPublicReviewStaffMembers(admin, staffMemberIds),
  ]);
  const serviceNameById = new Map<string, string>();
  const staffNameById = new Map<string, string>();
  const staffImageUrlById = new Map<string, string>();

  for (const service of (servicesResult.data ?? []) as Array<{
    id: string;
    name: string | null;
  }>) {
    if (service.id && service.name) {
      serviceNameById.set(service.id, service.name);
    }
  }

  for (const staffMember of (staffMembersResult.data ?? []) as Array<{
    id: string;
    name: string | null;
    image_path?: string | null;
  }>) {
    if (staffMember.id && staffMember.name) {
      staffNameById.set(staffMember.id, staffMember.name);
    }
    const imagePath = normalizeText(staffMember.image_path);
    if (staffMember.id && imagePath) {
      staffImageUrlById.set(
        staffMember.id,
        admin.storage.from("salon-assets").getPublicUrl(imagePath).data
          .publicUrl,
      );
    }
  }

  const ratingSum = reviews.reduce((sum, review) => sum + review.rating, 0);

  return {
    ratingCount: reviews.length,
    ratingValue: Number((ratingSum / reviews.length).toFixed(1)),
    recentReviews: reviews
      .filter((review) => review.comment?.trim().length)
      .slice(0, 6)
      .map((review) => ({
        id: review.appointmentId,
        rating: review.rating,
        comment: review.comment,
        createdAt: review.createdAt,
        serviceName: serviceNameById.get(review.serviceId) ?? null,
        staffName: staffNameById.get(review.staffMemberId) ?? null,
        staffImageUrl: staffImageUrlById.get(review.staffMemberId) ?? null,
      })),
  };
}

async function loadPublicReviewStaffMembers(
  admin: any,
  staffMemberIds: string[],
) {
  if (!staffMemberIds.length) {
    return { data: [], error: null };
  }

  const response = await admin
    .from("staff_members")
    .select("id, name, image_path")
    .in("id", staffMemberIds);
  if (
    response.error &&
    response.error.message?.toLowerCase().includes("image_path")
  ) {
    return admin
      .from("staff_members")
      .select("id, name")
      .in("id", staffMemberIds);
  }

  return response;
}

const PUBLIC_CAMPAIGN_PRIORITY_RANK: Record<
  PublicSalonCampaign["priority"],
  number
> = {
  high: 0,
  medium: 1,
  low: 2,
};

function filterPublicCentralCampaigns(
  campaigns: readonly PublicSalonCampaign[],
) {
  const now = Date.now();

  return [...campaigns]
    .filter((campaign) => isPublicCampaignLive(campaign, now))
    .sort((left, right) => {
      const priorityDelta =
        (PUBLIC_CAMPAIGN_PRIORITY_RANK[left.priority] ?? 99) -
        (PUBLIC_CAMPAIGN_PRIORITY_RANK[right.priority] ?? 99);
      if (priorityDelta !== 0) {
        return priorityDelta;
      }

      const leftStartsAt = parsePublicCampaignTimestamp(left.startsAt);
      const rightStartsAt = parsePublicCampaignTimestamp(right.startsAt);
      if (leftStartsAt !== rightStartsAt) {
        if (leftStartsAt === null) {
          return -1;
        }
        if (rightStartsAt === null) {
          return 1;
        }
        return leftStartsAt - rightStartsAt;
      }

      return left.title.localeCompare(right.title, "pt-BR");
    });
}

function isPublicCampaignLive(campaign: PublicSalonCampaign, now: number) {
  if (!campaign.isActive) {
    return false;
  }

  const startsAt = parsePublicCampaignTimestamp(campaign.startsAt);
  if (startsAt !== null && startsAt > now) {
    return false;
  }

  const endsAt = parsePublicCampaignTimestamp(campaign.endsAt);
  if (endsAt !== null && endsAt < now) {
    return false;
  }

  return true;
}

function parsePublicCampaignTimestamp(value: string | null) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
}

function tryCreateAdminPublicSalonClient() {
  try {
    return createAdminClient();
  } catch {
    return null;
  }
}

async function loadJoinPreviewFromAdminTable(
  supabase: ReturnType<typeof createAdminClient>,
  joinCode: string,
) {
  const { data, error } = await supabase
    .from("salons")
    .select(
      "id, name, tagline, whatsapp_phone, brand_color, business_segment, logo_path, booking_policy_enabled, booking_policy_title, booking_policy_summary, booking_policy_payment_mode, booking_policy_pix_key, booking_policy_pix_recipient_name, booking_policy_pix_recipient_city, booking_policy_external_checkout_url, booking_policy_requires_deposit, booking_policy_deposit_amount, booking_policy_payment_instructions, client_app_config",
    )
    .eq("join_code", joinCode)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Failed to load public join preview from admin table", {
        joinCode,
        error,
      });
    }
    return null;
  }

  return data as PublicSalonPreviewRow;
}

async function loadJoinPreviewFromRpc(
  supabase: ReturnType<typeof createClient>,
  joinCode: string,
) {
  try {
    const data = await supabase.rpc("get_public_salon_by_join_code", {
      input_join_code: joinCode,
    });

    const normalized = coercePreviewRow(data);
    if (normalized) {
      return normalized;
    }

    const legacyData = await supabase.rpc("get_salon_join_preview", {
      input_join_code: joinCode,
    });
    return coercePreviewRow(legacyData);
  } catch (error) {
    console.error("Failed to load public join preview from RPC", {
      joinCode,
      error,
    });
    return null;
  }
}

async function loadJoinPreviewFromTable(
  supabase: ReturnType<typeof createClient>,
  joinCode: string,
) {
  const { data, error } = await supabase
    .from("salons")
    .select(
      "id, name, tagline, whatsapp_phone, brand_color, business_segment, logo_path, booking_policy_enabled, booking_policy_title, booking_policy_summary, booking_policy_payment_mode, booking_policy_pix_key, booking_policy_pix_recipient_name, booking_policy_pix_recipient_city, booking_policy_external_checkout_url, booking_policy_requires_deposit, booking_policy_deposit_amount, booking_policy_payment_instructions, client_app_config",
    )
    .eq("join_code", joinCode)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error("Failed to load public join preview from table", {
        joinCode,
        error,
      });
    }
    return null;
  }

  return data as PublicSalonPreviewRow;
}

async function loadPublicServices(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
) {
  try {
    const { data, error } = await supabase
      .from("services")
      .select(
        "id, name, category, description, duration, price, image_path, is_active, sort_order",
      )
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("sort_order")
      .order("name");

    if (error) {
      return [];
    }

    const services = (data ?? []) as PublicServiceRow[];
    const serviceIds = services.map((service) => service.id);
    const appointmentCounts = new Map<string, number>();

    if (serviceIds.length > 0) {
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select("service_id, status")
        .eq("salon_id", salonId)
        .in("service_id", serviceIds);

      for (const appointment of (appointmentsData ??
        []) as PublicServiceAppointmentRow[]) {
        const serviceId = normalizeText(appointment.service_id);
        const status = normalizeText(appointment.status);
        if (!serviceId || status === "cancelled" || status === "no_show") {
          continue;
        }
        appointmentCounts.set(
          serviceId,
          (appointmentCounts.get(serviceId) ?? 0) + 1,
        );
      }
    }

    services.sort((left, right) => {
      const countDelta =
        (appointmentCounts.get(right.id) ?? 0) -
        (appointmentCounts.get(left.id) ?? 0);
      if (countDelta !== 0) {
        return countDelta;
      }

      const sortDelta = (left.sort_order ?? 0) - (right.sort_order ?? 0);
      if (sortDelta !== 0) {
        return sortDelta;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    });

    return services.map((service) => ({
      id: service.id,
      name: service.name,
      category: normalizeText(service.category),
      description: normalizeText(service.description),
      duration: Number(service.duration ?? 0),
      price: Number(service.price ?? 0),
      imageUrl: service.image_path
        ? supabase.storage.from("salon-assets").getPublicUrl(service.image_path)
            .data.publicUrl
        : null,
    }));
  } catch {
    return [];
  }
}

async function loadPublicOffers(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
) {
  try {
    const today = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Sao_Paulo",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());
    const { data, error } = await supabase
      .from("salon_offers")
      .select(
        "id, kind, title, description, highlight_text, image_path, membership_service_id, membership_sessions_included, membership_validity_days, price, is_active, starts_on, ends_on, sort_order",
      )
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("sort_order");

    if (error) {
      return [];
    }

    const rawOffers = (data ?? []) as PublicOfferRow[];
    const serviceIds = rawOffers
      .map((offer) => normalizeText(offer.membership_service_id))
      .filter((serviceId): serviceId is string => Boolean(serviceId));
    const serviceMetaById = new Map<
      string,
      { imagePath: string | null; name: string | null }
    >();

    if (serviceIds.length > 0) {
      const { data: servicesData } = await supabase
        .from("services")
        .select("id, image_path, name, is_active")
        .in("id", serviceIds);

      for (const service of (servicesData ?? []) as {
        id?: string | null;
        image_path?: string | null;
        name?: string | null;
        is_active?: boolean | null;
      }[]) {
        const serviceId = normalizeText(service.id);
        if (!serviceId || service.is_active === false) {
          continue;
        }

        serviceMetaById.set(serviceId, {
          imagePath: normalizeText(service.image_path),
          name: normalizeText(service.name),
        });
      }
    }

    const offers = rawOffers.filter((offer) => {
      const startsOn = normalizeText(offer.starts_on);
      const endsOn = normalizeText(offer.ends_on);
      const isMembershipPlan =
        offer.kind === "membership" &&
        isMonthlyMembershipPlan(offer.membership_validity_days);
      const insideWindow = isMembershipPlan
        ? !endsOn || endsOn >= today
        : (!startsOn || startsOn <= today) && (!endsOn || endsOn >= today);

      if (!insideWindow) {
        return false;
      }

      if (offer.kind !== "membership") {
        return true;
      }

      const membershipServiceId = normalizeText(offer.membership_service_id);
      return Boolean(
        membershipServiceId &&
        serviceMetaById.has(membershipServiceId) &&
        offer.membership_sessions_included != null &&
        offer.membership_sessions_included > 0 &&
        offer.membership_validity_days != null &&
        offer.membership_validity_days > 0,
      );
    });

    return offers.map((offer) => {
      const kind: PublicSalonOfferHighlight["kind"] =
        offer.kind === "membership" ? "membership" : "promotion";
      const bookingServiceId = normalizeText(offer.membership_service_id);
      const bookingService = bookingServiceId
        ? (serviceMetaById.get(bookingServiceId) ?? null)
        : null;
      const imagePath =
        normalizeText(offer.image_path) ?? bookingService?.imagePath;
      const actionKind: PublicSalonOfferHighlight["actionKind"] =
        kind === "membership"
          ? "request_membership"
          : bookingServiceId
            ? "book_service"
            : "open_agenda";

      return {
        id: offer.id,
        kind,
        title: offer.title,
        description: normalizeText(offer.description),
        highlightText: normalizeText(offer.highlight_text),
        imageUrl: imagePath
          ? supabase.storage.from("salon-assets").getPublicUrl(imagePath).data
              .publicUrl
          : null,
        bookingServiceId,
        bookingServiceName: bookingService?.name ?? null,
        actionKind,
        kindLabel:
          kind === "membership"
            ? resolveMembershipOfferLabel(offer.membership_validity_days)
            : "Oferta ativa",
        priceLabel:
          offer.price == null ? null : formatCurrency(Number(offer.price ?? 0)),
        lifecycleLabel: resolveOfferLifecycleLabel(offer, today),
      };
    });
  } catch {
    return [];
  }
}

async function loadPublicPosts(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
) {
  try {
    const { data, error } = await supabase
      .from("salon_posts")
      .select(
        "id, title, caption, image_path, created_at, post_type, source_type, external_author_avatar_url, external_author_username, services(name), staff_members(name, role), salon_post_images(image_path, sort_order), salon_post_likes(customer_id), salon_post_comments(id)",
      )
      .eq("salon_id", salonId)
      .neq("post_type", "story")
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return [];
    }

    return ((data ?? []) as PublicFeedPostRow[])
      .map((post) => {
        const storyState = resolveFeedStoryRecord({
          createdAt: post.created_at,
          postType: post.post_type,
          title: post.title,
        });
        const gallerySource = post.salon_post_images?.length
          ? [...post.salon_post_images].sort(
              (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
            )
          : [{ image_path: post.image_path, sort_order: 0 }];
        const coverPath = normalizeText(gallerySource[0]?.image_path);
        const service = firstRelation(post.services);
        const staff = firstRelation(post.staff_members);
        const likesCount = post.salon_post_likes?.length ?? 0;
        const commentsCount = post.salon_post_comments?.length ?? 0;
        const publishedAt = new Date(post.created_at);
        const ageInHours = Math.max(
          1,
          (Date.now() - publishedAt.getTime()) / (1000 * 60 * 60),
        );

        return {
          id: post.id,
          title: storyState.cleanTitle,
          caption: normalizeText(post.caption),
          imageUrl: coverPath
            ? supabase.storage.from("salon-posts").getPublicUrl(coverPath).data
                .publicUrl
            : null,
          badge: resolvePostBadge(post.post_type),
          serviceName: normalizeText(service?.name),
          staffLabel: normalizeText(staff?.role)
            ? `${normalizeText(staff?.name) ?? "Profissional"} • ${normalizeText(staff?.role)}`
            : normalizeText(staff?.name),
          authorAvatarUrl: normalizeText(post.external_author_avatar_url),
          sourceLabel: resolvePublicPostSourceLabel({
            sourceType: post.source_type,
            authorUsername: post.external_author_username,
          }),
          engagementScore:
            likesCount * 3 +
            commentsCount * 2 +
            (post.post_type === "before_after" ? 4 : 0) +
            (post.post_type === "reel" ? 3 : 0) +
            (coverPath != null ? 1 : 0) +
            48 / ageInHours,
          createdAt: post.created_at,
          isStory: storyState.isStory,
        };
      })
      .filter((post) => !post.isStory)
      .sort((left, right) => {
        if (right.engagementScore !== left.engagementScore) {
          return right.engagementScore - left.engagementScore;
        }
        return right.createdAt.localeCompare(left.createdAt);
      })
      .slice(0, 6)
      .map(
        ({
          engagementScore: _engagementScore,
          createdAt: _createdAt,
          isStory: _isStory,
          ...post
        }) => post,
      );
  } catch {
    return [];
  }
}

function coercePreviewRow(value: unknown): PublicSalonPreviewRow | null {
  if (Array.isArray(value)) {
    return value.length > 0 ? coercePreviewRow(value[0]) : null;
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  return value as PublicSalonPreviewRow;
}

function coerceLandingPayload(value: unknown): PublicSalonLandingData | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<PublicSalonLandingData>;
  if (!candidate.preview || !candidate.stats) {
    return null;
  }

  return candidate as PublicSalonLandingData;
}

function normalizeText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function resolveSalonShareImage(
  clientAppConfig: ReturnType<typeof normalizeSalonClientAppConfig>,
  fallbackLogoUrl: string | null,
) {
  return (
    clientAppConfig.profileCoverImageShareVariantUrl ??
    clientAppConfig.heroImageShareVariantUrl ??
    clientAppConfig.galleryCoverImageShareVariantUrl ??
    clientAppConfig.profileCoverImageTabletVariantUrl ??
    clientAppConfig.heroImageTabletVariantUrl ??
    clientAppConfig.galleryCoverImageTabletVariantUrl ??
    clientAppConfig.profileCoverImageVariantUrl ??
    clientAppConfig.heroImageVariantUrl ??
    clientAppConfig.galleryCoverImageVariantUrl ??
    clientAppConfig.profileCoverImageUrl ??
    clientAppConfig.heroImageUrl ??
    clientAppConfig.galleryCoverImageUrl ??
    fallbackLogoUrl
  );
}

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function resolveOfferLifecycleLabel(offer: PublicOfferRow, today: string) {
  const isMembershipPlan =
    offer.kind === "membership" &&
    isMonthlyMembershipPlan(offer.membership_validity_days);

  if (isMembershipPlan && offer.starts_on && offer.starts_on > today) {
    return "Pedido disponível";
  }

  if (offer.starts_on && offer.ends_on) {
    return `${formatDateShort(offer.starts_on)} até ${formatDateShort(offer.ends_on)}`;
  }

  if (offer.starts_on) {
    return `Ativo desde ${formatDateShort(offer.starts_on)}`;
  }

  if (offer.ends_on) {
    return `Válido até ${formatDateShort(offer.ends_on)}`;
  }

  return "Ativo agora";
}

function resolvePostBadge(postType: string | null) {
  switch (postType) {
    case "before_after":
      return "Antes e depois";
    case "reel":
      return "Vídeo";
    default:
      return null;
  }
}

function resolvePublicPostSourceLabel(args: {
  sourceType: string | null;
  authorUsername: string | null;
}) {
  void args.sourceType;
  void args.authorUsername;
  return null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

function formatDateShort(value: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
  }).format(new Date(value));
}

const HOME_MODULE_LABELS: Record<string, string> = {
  shortcuts: "Atalhos premium",
  nextBooking: "Próximo agendamento",
  professionals: "Profissionais",
  gallery: "Galeria",
  promotions: "Promoções",
  products: "Produtos",
  loyalty: "Fidelidade",
};
