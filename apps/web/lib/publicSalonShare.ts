import { normalizeSalonClientAppConfig } from "@/lib/clientAppConfig";
import { getSalonSegmentPreset } from "@/lib/salonSegments";
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
  sort_order: number | null;
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
  services?: { name?: string | null } | { name?: string | null }[] | null;
  staff_members?:
    | { name?: string | null; role?: string | null }
    | { name?: string | null; role?: string | null }[]
    | null;
  salon_post_images?:
    | { image_path?: string | null; sort_order?: number | null }[]
    | null;
};

export type PublicSalonSharePreview = {
  salonId: string;
  joinCode: string;
  name: string;
  tagline: string | null;
  brandColor: string;
  businessSegment: string | null;
  whatsappPhone: string | null;
  logoUrl: string | null;
  heroImageUrl: string | null;
  shareImageUrl: string | null;
  welcomeHeadline: string | null;
  welcomeMessage: string | null;
  promotionHeadline: string | null;
  instagramUrl: string | null;
  addressLabel: string | null;
  mapUrl: string | null;
  ratingValue: number | null;
  ratingCount: number | null;
  moduleLabels: string[];
  segmentLabel: string;
  segmentDescription: string;
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
};

export type PublicSalonLandingData = {
  preview: PublicSalonSharePreview;
  featuredServices: PublicSalonServiceHighlight[];
  activeOffers: PublicSalonOfferHighlight[];
  recentPosts: PublicSalonGalleryHighlight[];
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

  const supabase = createClient();
  const previewRow =
    (await loadJoinPreviewFromRpc(supabase, normalizedJoinCode)) ??
    (await loadJoinPreviewFromTable(supabase, normalizedJoinCode));

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
  const logoPath = normalizeText(previewRow.logo_path);
  const logoUrl = logoPath
    ? supabase.storage.from("salon-assets").getPublicUrl(logoPath).data.publicUrl
    : null;

  const preview: PublicSalonSharePreview = {
    salonId,
    joinCode: normalizedJoinCode,
    name: normalizeText(previewRow.name) ?? "Salão",
    tagline: normalizeText(previewRow.tagline),
    brandColor:
      normalizeText(previewRow.brand_color) ??
      clientAppConfig.secondaryColor ??
      clientAppConfig.accentColor ??
      segmentPreset.suggestedBrandColor,
    businessSegment: normalizeText(previewRow.business_segment),
    whatsappPhone: normalizeText(previewRow.whatsapp_phone),
    logoUrl,
    heroImageUrl:
      clientAppConfig.heroImageTabletVariantUrl ??
      clientAppConfig.heroImageVariantUrl ??
      clientAppConfig.heroImageUrl ??
      clientAppConfig.profileCoverImageTabletVariantUrl ??
      clientAppConfig.profileCoverImageVariantUrl ??
      clientAppConfig.profileCoverImageUrl ??
      logoUrl,
    shareImageUrl: resolveSalonShareImage(clientAppConfig, logoUrl),
    welcomeHeadline: clientAppConfig.welcomeHeadline,
    welcomeMessage: clientAppConfig.welcomeMessage,
    promotionHeadline: clientAppConfig.promotionHeadline,
    instagramUrl: clientAppConfig.instagramUrl,
    addressLabel: clientAppConfig.addressLabel,
    mapUrl: clientAppConfig.mapUrl,
    ratingValue: clientAppConfig.ratingValue,
    ratingCount: clientAppConfig.ratingCount,
    moduleLabels:
      clientAppConfig.visibleHomeModules.length > 0
        ? clientAppConfig.visibleHomeModules.map((module) =>
            HOME_MODULE_LABELS[module] ?? module,
          )
        : [...segmentPreset.focusAreas],
    segmentLabel: segmentPreset.label,
    segmentDescription: segmentPreset.shortDescription,
  };

  return {
    preview,
    supabase,
  };
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
  } catch {
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
      "id, name, tagline, brand_color, business_segment, whatsapp_phone, logo_path, client_app_config",
    )
    .eq("join_code", joinCode)
    .maybeSingle();

  if (error || !data) {
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
        "id, name, category, description, duration, price, image_path, sort_order",
      )
      .eq("salon_id", salonId)
      .order("sort_order")
      .order("name")
      .limit(6);

    if (error) {
      return [];
    }

    return ((data ?? []) as PublicServiceRow[]).map((service) => ({
      id: service.id,
      name: service.name,
      category: normalizeText(service.category),
      description: normalizeText(service.description),
      duration: Number(service.duration ?? 0),
      price: Number(service.price ?? 0),
      imageUrl: service.image_path
        ? supabase.storage
            .from("salon-assets")
            .getPublicUrl(service.image_path).data.publicUrl
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
        "id, title, caption, image_path, created_at, post_type, services(name), staff_members(name, role), salon_post_images(image_path, sort_order)",
      )
      .eq("salon_id", salonId)
      .order("created_at", { ascending: false })
      .limit(4);

    if (error) {
      return [];
    }

    return ((data ?? []) as PublicFeedPostRow[]).map((post) => {
      const gallerySource = post.salon_post_images?.length
        ? [...post.salon_post_images].sort(
            (left, right) => (left.sort_order ?? 0) - (right.sort_order ?? 0),
          )
        : [{ image_path: post.image_path, sort_order: 0 }];
      const coverPath = normalizeText(gallerySource[0]?.image_path);
      const service = firstRelation(post.services);
      const staff = firstRelation(post.staff_members);

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
      };
    });
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
