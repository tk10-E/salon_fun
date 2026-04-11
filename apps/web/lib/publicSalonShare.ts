import {
  normalizeSalonClientAppConfig,
  resolveClientAppVisualStyle,
  resolveClientExperienceModel,
  resolveClientHomeEmphasis,
} from "@/lib/clientAppConfig";
import { getSalonSegmentPreset } from "@/lib/salonSegments";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type PublicSalonPreviewRow = {
  id?: string;
  salon_id?: string;
  name?: string;
  tagline?: string | null;
  brand_color?: string | null;
  business_segment?: string | null;
  whatsapp_phone?: string | null;
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
  whatsappPhone: string | null;
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
  instagramUrl: string | null;
  instagramProfileImageUrl: string | null;
  addressLabel: string | null;
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
  title: string;
  description: string | null;
  highlightText: string | null;
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

export type PublicSalonLandingData = {
  preview: PublicSalonSharePreview;
  featuredServices: PublicSalonServiceHighlight[];
  activeOffers: PublicSalonOfferHighlight[];
  recentPosts: PublicSalonGalleryHighlight[];
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
  return context?.preview ?? null;
}

export async function fetchPublicSalonLandingData(
  joinCode: string,
): Promise<PublicSalonLandingData | null> {
  const context = await resolvePublicSalonPreviewContext(joinCode);
  if (!context) {
    return null;
  }

  const [featuredServices, activeOffers, recentPosts] = await Promise.all([
    loadPublicServices(context.supabase, context.preview.salonId),
    loadPublicOffers(context.supabase, context.preview.salonId),
    loadPublicPosts(context.supabase, context.preview.salonId),
  ]);

  return {
    preview: context.preview,
    featuredServices,
    activeOffers,
    recentPosts,
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
  const { data: instagramConnection } = await supabase
    .from("instagram_connections")
    .select("profile_picture_url")
    .eq("salon_id", salonId)
    .maybeSingle();
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
    whatsappPhone: normalizeText(previewRow.whatsapp_phone),
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
    instagramUrl: clientAppConfig.instagramUrl,
    instagramProfileImageUrl: normalizeText(
      (instagramConnection as { profile_picture_url?: string | null } | null)
        ?.profile_picture_url,
    ),
    addressLabel: clientAppConfig.addressLabel,
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
    centralCampaigns: clientAppConfig.centralCampaigns,
    supabase,
  };
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
      "id, name, tagline, brand_color, business_segment, whatsapp_phone, logo_path, booking_policy_enabled, booking_policy_title, booking_policy_summary, booking_policy_payment_mode, booking_policy_pix_key, booking_policy_pix_recipient_name, booking_policy_pix_recipient_city, booking_policy_external_checkout_url, booking_policy_requires_deposit, booking_policy_deposit_amount, booking_policy_payment_instructions, client_app_config",
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
    const data = await supabase.rpc("get_salon_join_preview", {
      input_join_code: joinCode,
    });

    return coercePreviewRow(data);
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
      "id, name, tagline, brand_color, business_segment, whatsapp_phone, logo_path, booking_policy_enabled, booking_policy_title, booking_policy_summary, booking_policy_payment_mode, booking_policy_pix_key, booking_policy_pix_recipient_name, booking_policy_pix_recipient_city, booking_policy_external_checkout_url, booking_policy_requires_deposit, booking_policy_deposit_amount, booking_policy_payment_instructions, client_app_config",
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
    const { data, error } = await supabase
      .from("salon_offers")
      .select(
        "id, kind, title, description, highlight_text, price, is_active, starts_on, ends_on, sort_order",
      )
      .eq("salon_id", salonId)
      .eq("is_active", true)
      .order("sort_order")
      .limit(3);

    if (error) {
      return [];
    }

    return ((data ?? []) as PublicOfferRow[]).map((offer) => ({
      id: offer.id,
      title: offer.title,
      description: normalizeText(offer.description),
      highlightText: normalizeText(offer.highlight_text),
      kindLabel: offer.kind === "membership" ? "Clube" : "Oferta ativa",
      priceLabel:
        offer.price == null ? null : formatCurrency(Number(offer.price ?? 0)),
      lifecycleLabel: resolveOfferLifecycleLabel(offer),
    }));
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
      .order("created_at", { ascending: false })
      .limit(12);

    if (error) {
      return [];
    }

    return ((data ?? []) as PublicFeedPostRow[])
      .map((post) => {
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
          title: normalizeText(post.title) ?? "Trabalho recente",
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
        };
      })
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

function resolveOfferLifecycleLabel(offer: PublicOfferRow) {
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
  const authorUsername = normalizeText(args.authorUsername);

  if (
    args.sourceType === "instagram_mention" ||
    args.sourceType === "instagram_owned_post"
  ) {
    return authorUsername
      ? `Instagram • @${authorUsername.replace(/^@+/, "")}`
      : "Instagram";
  }

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
