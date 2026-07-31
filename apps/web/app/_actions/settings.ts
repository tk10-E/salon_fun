import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import {
  fetchRemoteClientAppImage,
  generateClientAppImageVariants,
  getClientAppImageStoragePaths,
  type ClientAppImageAssetKey,
} from "@/lib/clientAppImageVariants";
import {
  normalizeClientAppCustomDomainInput,
  normalizeSalonClientAppConfig,
  serializeSalonClientAppConfig,
} from "@/lib/clientAppConfig";
import { getConfiguredAppOrigin } from "@/lib/requestOrigin";
import { normalizeCountryCodesInput } from "@/lib/panelSecurityPolicy";
import {
  SALON_TIMEZONE_OPTIONS,
  SLOT_STEP_OPTIONS,
  WEEKDAY_OPTIONS,
} from "@/lib/schedule";
import {
  CLIENT_APP_IMAGE_MAX_BYTES,
  SALON_LOGO_MAX_BYTES,
  SETTINGS_BRANDING_UPLOAD_LIMIT_MESSAGE,
  isSettingsBrandingUploadMimeTypeAllowed,
  type SettingsBrandingUploadField,
} from "@/lib/settingsBrandingUploads";
import { normalizeSalonBusinessSegment } from "@/lib/salonSegments";
import { getCronSecret } from "@/lib/serverEnv";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  SAFE_RASTER_IMAGE_MIME_TYPES,
  assertSafeImageUpload,
  optimizeSalonLogoImage,
} from "@/lib/uploadedImageOptimization";

import {
  buildClientAppRefreshNotification,
  buildRedirectNotice,
  queueCustomerNotification,
  truncateNotificationText,
} from "./shared";

const SETTINGS_PATH = "/dashboard/settings";
const DASHBOARD_PATH = "/dashboard";
const MANAGEMENT_APPOINTMENTS_PATH = "/dashboard/gestao/agendamentos";
const OPERATIONS_PATH = "/dashboard/operations";
const NOTIFICATIONS_PATH = "/dashboard/notifications";
const CLIENT_APP_CAMPAIGN_FIELD_PATTERN =
  /^clientAppCampaign(?:Id|IsActive|Priority|StartsAt|EndsAt|Audience|Eyebrow|Label|Title|Message|CtaLabel|CtaTarget)_(\d+)$/;

async function syncOperationsAutopilotRuntimeConfig() {
  const configuredOrigin = getConfiguredAppOrigin();
  const cronSecret = getCronSecret();

  if (!configuredOrigin || !cronSecret) {
    return;
  }

  try {
    const admin = createAdminClient() as any;
    const autopilotJobUrl = new URL(
      "/api/internal/operations/autopilot",
      `${configuredOrigin}/`,
    ).toString();

    const result = await admin
      .schema("private")
      .from("runtime_config")
      .upsert(
        [
          {
            key: "operations_autopilot_job_url",
            value: autopilotJobUrl,
          },
          {
            key: "operations_autopilot_job_secret",
            value: cronSecret,
          },
        ],
        {
          onConflict: "key",
        },
      );

    if (result.error) {
      console.error("[settings] operations_autopilot_runtime_sync_failed", {
        error: result.error.message,
      });
    }
  } catch (error) {
    console.error("[settings] operations_autopilot_runtime_sync_failed", {
      error:
        error instanceof Error && error.message.trim()
          ? error.message
          : "operations_autopilot_runtime_sync_failed",
    });
  }
}

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function normalizeOptionalTextInput(value: FormDataEntryValue | null) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeOptionalDomainInput(value: FormDataEntryValue | null) {
  return normalizeClientAppCustomDomainInput(
    normalizeOptionalTextInput(value),
  );
}

function normalizeOptionalHexColorInput(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalTextInput(value)?.toUpperCase() ?? null;
  if (!normalized) {
    return null;
  }

  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : null;
}

function normalizeOptionalUrlInput(
  value: FormDataEntryValue | null,
  protocols: readonly string[] = ["http:", "https:"],
) {
  const normalized = normalizeOptionalTextInput(value);
  if (!normalized) {
    return null;
  }

  try {
    const parsed = new URL(normalized);
    return protocols.includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function normalizeOptionalEmailInput(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalTextInput(value);
  if (!normalized) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/i.test(normalized) ? normalized : null;
}

function normalizeOptionalDateTimeInput(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalTextInput(value);
  if (!normalized) {
    return null;
  }

  return Number.isNaN(Date.parse(normalized)) ? null : normalized;
}

function normalizeOptionalNumberInput(value: FormDataEntryValue | null) {
  const normalized = normalizeOptionalTextInput(value);
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized.replace(",", "."));
  return Number.isNaN(parsed) ? null : parsed;
}

function normalizeOptionalIntegerInput(value: FormDataEntryValue | null) {
  const parsed = normalizeOptionalNumberInput(value);
  if (parsed === null || !Number.isInteger(parsed)) {
    return null;
  }

  return parsed;
}

function buildClientAppCampaignDrafts(formData: FormData) {
  const campaigns: Array<{
    id: string;
    isActive: boolean;
    priority: string;
    startsAt: string | null;
    endsAt: string | null;
    audience: string;
    eyebrow: string | null;
    title: string;
    message: string;
    campaignLabel: string | null;
    ctaLabel: string | null;
    ctaTarget: string;
  }> = [];

  const slots = [...new Set(
    Array.from(formData.keys())
      .map((key) => CLIENT_APP_CAMPAIGN_FIELD_PATTERN.exec(key)?.[1] ?? null)
      .filter((value): value is string => Boolean(value))
      .map((value) => Number.parseInt(value, 10))
      .filter((value) => Number.isInteger(value) && value > 0),
  )].sort((left, right) => left - right);

  for (const slot of slots) {
    const title = normalizeOptionalTextInput(
      formData.get(`clientAppCampaignTitle_${slot}`),
    );
    const message = normalizeOptionalTextInput(
      formData.get(`clientAppCampaignMessage_${slot}`),
    );

    if (!title || !message) {
      continue;
    }

    campaigns.push({
      id:
        normalizeOptionalTextInput(
          formData.get(`clientAppCampaignId_${slot}`),
        ) ?? `campaign-${slot}`,
      isActive: formData.get(`clientAppCampaignIsActive_${slot}`) === "on",
      priority:
        normalizeOptionalTextInput(
          formData.get(`clientAppCampaignPriority_${slot}`),
        ) ?? "medium",
      startsAt: normalizeOptionalDateTimeInput(
        formData.get(`clientAppCampaignStartsAt_${slot}`),
      ),
      endsAt: normalizeOptionalDateTimeInput(
        formData.get(`clientAppCampaignEndsAt_${slot}`),
      ),
      audience:
        normalizeOptionalTextInput(
          formData.get(`clientAppCampaignAudience_${slot}`),
        ) ?? "all",
      eyebrow: normalizeOptionalTextInput(
        formData.get(`clientAppCampaignEyebrow_${slot}`),
      ),
      title,
      message,
      campaignLabel: normalizeOptionalTextInput(
        formData.get(`clientAppCampaignLabel_${slot}`),
      ),
      ctaLabel: normalizeOptionalTextInput(
        formData.get(`clientAppCampaignCtaLabel_${slot}`),
      ),
      ctaTarget:
        normalizeOptionalTextInput(
          formData.get(`clientAppCampaignCtaTarget_${slot}`),
        ) ?? "explore",
    });
  }

  return campaigns;
}

function hasInvalidClientAppCampaignWindow(
  campaigns: ReadonlyArray<{ startsAt: string | null; endsAt: string | null }>,
) {
  return campaigns.some((campaign) => {
    if (!campaign.startsAt || !campaign.endsAt) {
      return false;
    }

    return Date.parse(campaign.endsAt) < Date.parse(campaign.startsAt);
  });
}

function buildBookingPolicyVersionTag(now = new Date()) {
  const iso = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "");
  return `booking-policy-${iso}`;
}

function buildBookingWebhookToken() {
  return `${randomUUID()}${randomUUID()}`.replace(/-/g, "");
}

function readRawConfigString(
  value: Record<string, unknown>,
  key: string,
): string | null {
  const entry = value[key];
  return typeof entry === "string" && entry.trim() ? entry.trim() : null;
}

async function removeSalonAssetsOrRedirect(
  supabase: ReturnType<typeof createClient>,
  paths: readonly (string | null | undefined)[],
  errorMessage: string,
) {
  const uniquePaths = [
    ...new Set(paths.filter((path): path is string => Boolean(path))),
  ];

  if (uniquePaths.length === 0) {
    return;
  }

  const { error } = await supabase.storage
    .from("salon-assets")
    .remove(uniquePaths);

  if (error) {
    redirect(buildRedirectNotice(SETTINGS_PATH, errorMessage, "error"));
  }
}

async function downloadSalonAssetOrRedirect(
  supabase: ReturnType<typeof createClient>,
  path: string,
  errorMessage: string,
) {
  const { data, error } = await supabase.storage
    .from("salon-assets")
    .download(path);

  if (error || !data) {
    redirect(buildRedirectNotice(SETTINGS_PATH, errorMessage, "error"));
  }

  return {
    buffer: Buffer.from(await data.arrayBuffer()),
    contentType: data.type || "application/octet-stream",
  };
}

async function uploadSalonAssetBytesOrRedirect(
  supabase: ReturnType<typeof createClient>,
  path: string,
  bytes: Buffer,
  contentType: string,
  errorMessage: string,
) {
  const { error } = await supabase.storage
    .from("salon-assets")
    .upload(path, bytes, {
      contentType,
      upsert: true,
    });

  if (error) {
    redirect(buildRedirectNotice(SETTINGS_PATH, errorMessage, "error"));
  }

  return supabase.storage.from("salon-assets").getPublicUrl(path).data
    .publicUrl;
}

type ResolvedClientAppImageAsset = {
  imageUrl: string | null;
  mobileVariantUrl: string | null;
  tabletVariantUrl: string | null;
  shareVariantUrl: string | null;
  imagePath: string | null;
  sourcePath: string | null;
  sourceUrl: string | null;
};

async function resolveClientAppImageAssetOrRedirect(params: {
  supabase: ReturnType<typeof createClient>;
  salonId: string;
  assetKey: ClientAppImageAssetKey;
  incomingUrl: string | null;
  incomingFile: File | null;
  shouldRemove: boolean;
  focusX: number;
  focusY: number;
  zoom: number;
  currentImageUrl: string | null;
  currentMobileVariantUrl: string | null;
  currentTabletVariantUrl: string | null;
  currentShareVariantUrl: string | null;
  currentImagePath: string | null;
  currentSourcePath: string | null;
  currentSourceUrl: string | null;
  currentFocusX: number;
  currentFocusY: number;
  currentZoom: number;
  removeErrorMessage: string;
  uploadErrorMessage: string;
  sourceErrorMessage: string;
}): Promise<ResolvedClientAppImageAsset> {
  const {
    supabase,
    salonId,
    assetKey,
    incomingUrl,
    incomingFile,
    shouldRemove,
    focusX,
    focusY,
    zoom,
    currentImageUrl,
    currentMobileVariantUrl,
    currentTabletVariantUrl,
    currentShareVariantUrl,
    currentImagePath,
    currentSourcePath,
    currentSourceUrl,
    currentFocusX,
    currentFocusY,
    currentZoom,
    removeErrorMessage,
    uploadErrorMessage,
    sourceErrorMessage,
  } = params;
  const currentSourceInputUrl = currentSourceUrl ?? currentImageUrl;
  const storagePaths = getClientAppImageStoragePaths(salonId, assetKey);
  const cropChanged =
    focusX !== currentFocusX ||
    focusY !== currentFocusY ||
    zoom !== currentZoom;
  const sourceChanged = incomingUrl !== currentSourceInputUrl;

  if (shouldRemove && !incomingFile && !incomingUrl) {
    await removeSalonAssetsOrRedirect(
      supabase,
      [
        currentImagePath,
        currentSourcePath,
        storagePaths.tabletVariantPath,
        storagePaths.shareVariantPath,
      ],
      removeErrorMessage,
    );

    return {
      imageUrl: null,
      mobileVariantUrl: null,
      tabletVariantUrl: null,
      shareVariantUrl: null,
      imagePath: null,
      sourcePath: null,
      sourceUrl: null,
    };
  }

  let sourceBuffer: Buffer | null = null;
  let sourceContentType: string | null = null;
  let nextSourceUrl = currentSourceUrl;

  if (incomingFile) {
    sourceBuffer = Buffer.from(await incomingFile.arrayBuffer());
    try {
      sourceContentType = assertSafeImageUpload({
        buffer: sourceBuffer,
        declaredMimeType: incomingFile.type,
        allowedMimeTypes: SAFE_RASTER_IMAGE_MIME_TYPES,
        maxBytes: CLIENT_APP_IMAGE_MAX_BYTES,
        contextLabel: "imagem premium do app",
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : sourceErrorMessage;
      redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }
    nextSourceUrl = null;
  } else if (sourceChanged) {
    if (!incomingUrl) {
      await removeSalonAssetsOrRedirect(
        supabase,
        [
          currentImagePath,
          currentSourcePath,
          storagePaths.tabletVariantPath,
          storagePaths.shareVariantPath,
        ],
        removeErrorMessage,
      );

      return {
        imageUrl: null,
        mobileVariantUrl: null,
        tabletVariantUrl: null,
        shareVariantUrl: null,
        imagePath: null,
        sourcePath: null,
        sourceUrl: null,
      };
    }

    try {
      const remoteAsset = await fetchRemoteClientAppImage(incomingUrl);
      sourceBuffer = remoteAsset.buffer;
      sourceContentType = remoteAsset.contentType;
      nextSourceUrl = incomingUrl;
    } catch (error) {
      const message =
        error instanceof Error && error.message.trim()
          ? error.message.trim()
          : sourceErrorMessage;
      redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }
  } else if (cropChanged) {
    if (currentSourcePath) {
      const downloadedAsset = await downloadSalonAssetOrRedirect(
        supabase,
        currentSourcePath,
        sourceErrorMessage,
      );
      sourceBuffer = downloadedAsset.buffer;
      sourceContentType = downloadedAsset.contentType;
    } else if (currentSourceInputUrl) {
      try {
        const remoteAsset = await fetchRemoteClientAppImage(
          currentSourceInputUrl,
        );
        sourceBuffer = remoteAsset.buffer;
        sourceContentType = remoteAsset.contentType;
      } catch (error) {
        const message =
          error instanceof Error && error.message.trim()
            ? error.message.trim()
            : sourceErrorMessage;
        redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
      }
    }
  }

  if (!sourceBuffer || !sourceContentType) {
    return {
      imageUrl: shouldRemove ? null : currentImageUrl,
      mobileVariantUrl: shouldRemove ? null : currentMobileVariantUrl,
      tabletVariantUrl: shouldRemove ? null : currentTabletVariantUrl,
      shareVariantUrl: shouldRemove ? null : currentShareVariantUrl,
      imagePath: shouldRemove ? null : currentImagePath,
      sourcePath: shouldRemove ? null : currentSourcePath,
      sourceUrl: shouldRemove ? null : currentSourceUrl,
    };
  }

  let processedAsset: Awaited<
    ReturnType<typeof generateClientAppImageVariants>
  >;

  try {
    processedAsset = await generateClientAppImageVariants({
      assetKey,
      sourceBuffer,
      focusX,
      focusY,
      zoom,
    });
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message.trim()
        : sourceErrorMessage;
    redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
  }

  const [sourceUrl, mobileVariantUrl, tabletVariantUrl, shareVariantUrl] =
    await Promise.all([
      uploadSalonAssetBytesOrRedirect(
        supabase,
        storagePaths.sourcePath,
        processedAsset.normalizedSource,
        sourceContentType,
        uploadErrorMessage,
      ),
      uploadSalonAssetBytesOrRedirect(
        supabase,
        storagePaths.variantPath,
        processedAsset.variants.mobile.buffer,
        processedAsset.variants.mobile.contentType,
        uploadErrorMessage,
      ),
      uploadSalonAssetBytesOrRedirect(
        supabase,
        storagePaths.tabletVariantPath,
        processedAsset.variants.tablet.buffer,
        processedAsset.variants.tablet.contentType,
        uploadErrorMessage,
      ),
      uploadSalonAssetBytesOrRedirect(
        supabase,
        storagePaths.shareVariantPath,
        processedAsset.variants.share.buffer,
        processedAsset.variants.share.contentType,
        uploadErrorMessage,
      ),
    ]);

  await removeSalonAssetsOrRedirect(
    supabase,
    [
      currentImagePath !== storagePaths.variantPath ? currentImagePath : null,
      currentSourcePath !== storagePaths.sourcePath ? currentSourcePath : null,
      currentImagePath !== storagePaths.legacyPath
        ? null
        : storagePaths.legacyPath,
    ],
    removeErrorMessage,
  );

  return {
    imageUrl: sourceUrl,
    mobileVariantUrl,
    tabletVariantUrl,
    shareVariantUrl,
    imagePath: storagePaths.variantPath,
    sourcePath: storagePaths.sourcePath,
    sourceUrl: nextSourceUrl,
  };
}

function normalizeBusinessTimeInput(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null;
  }

  const [hours, minutes] = value.split(":").map(Number);
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return `${value}:00`;
}

function stringifyComparison(value: unknown) {
  return JSON.stringify(value ?? null);
}

export async function regenerateSalonCodeActionImpl() {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const generated = await supabase.rpc("generate_join_code");

  if (generated.error || !generated.data) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível gerar um novo código.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("salons")
    .update({ join_code: generated.data })
    .eq("id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível atualizar o código.",
        "error",
      ),
    );
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/dashboard/client-app");
  revalidatePath(`/s/${salon.join_code}`);
  redirect(
    buildRedirectNotice(
      SETTINGS_PATH,
      "Novo código gerado com sucesso.",
      "success",
    ),
  );
}

export async function updateSalonBrandingActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const rawName = String(formData.get("name") ?? "").trim();
  const rawTagline = String(formData.get("tagline") ?? "").trim();
  const rawBrandColor = String(formData.get("brandColor") ?? "")
    .trim()
    .toUpperCase();
  const businessSegment = normalizeSalonBusinessSegment(
    String(formData.get("businessSegment") ?? ""),
  );
  const currentClientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );
  const currentRawConfig = currentClientAppConfig.rawConfig as Record<
    string,
    unknown
  >;
  const secondaryColorInput = String(
    formData.get("clientAppSecondaryColor") ?? "",
  )
    .trim()
    .toUpperCase();
  const accentColorInput = String(formData.get("clientAppAccentColor") ?? "")
    .trim()
    .toUpperCase();
  const ratingValueInput = String(
    formData.get("clientAppRatingValue") ?? "",
  ).trim();
  const ratingCountInput = String(
    formData.get("clientAppRatingCount") ?? "",
  ).trim();
  const heroImageFocusXInput = String(
    formData.get("clientAppHeroImageFocusX") ?? "",
  ).trim();
  const heroImageFocusYInput = String(
    formData.get("clientAppHeroImageFocusY") ?? "",
  ).trim();
  const galleryCoverImageFocusXInput = String(
    formData.get("clientAppGalleryCoverImageFocusX") ?? "",
  ).trim();
  const galleryCoverImageFocusYInput = String(
    formData.get("clientAppGalleryCoverImageFocusY") ?? "",
  ).trim();
  const profileCoverImageFocusXInput = String(
    formData.get("clientAppProfileCoverImageFocusX") ?? "",
  ).trim();
  const profileCoverImageFocusYInput = String(
    formData.get("clientAppProfileCoverImageFocusY") ?? "",
  ).trim();
  const heroImageZoomInput = String(
    formData.get("clientAppHeroImageZoom") ?? "",
  ).trim();
  const galleryCoverImageZoomInput = String(
    formData.get("clientAppGalleryCoverImageZoom") ?? "",
  ).trim();
  const profileCoverImageZoomInput = String(
    formData.get("clientAppProfileCoverImageZoom") ?? "",
  ).trim();
  const secondaryColor = normalizeOptionalHexColorInput(
    formData.get("clientAppSecondaryColor"),
  );
  const accentColor = normalizeOptionalHexColorInput(
    formData.get("clientAppAccentColor"),
  );
  const ratingValue = normalizeOptionalNumberInput(
    formData.get("clientAppRatingValue"),
  );
  const ratingCount = normalizeOptionalIntegerInput(
    formData.get("clientAppRatingCount"),
  );
  const heroImageFocusX =
    normalizeOptionalIntegerInput(formData.get("clientAppHeroImageFocusX")) ??
    50;
  const heroImageFocusY =
    normalizeOptionalIntegerInput(formData.get("clientAppHeroImageFocusY")) ??
    50;
  const galleryCoverImageFocusX =
    normalizeOptionalIntegerInput(
      formData.get("clientAppGalleryCoverImageFocusX"),
    ) ?? 50;
  const galleryCoverImageFocusY =
    normalizeOptionalIntegerInput(
      formData.get("clientAppGalleryCoverImageFocusY"),
    ) ?? 50;
  const profileCoverImageFocusX =
    normalizeOptionalIntegerInput(
      formData.get("clientAppProfileCoverImageFocusX"),
    ) ?? 50;
  const profileCoverImageFocusY =
    normalizeOptionalIntegerInput(
      formData.get("clientAppProfileCoverImageFocusY"),
    ) ?? 50;
  const heroImageZoom =
    normalizeOptionalNumberInput(formData.get("clientAppHeroImageZoom")) ?? 1;
  const galleryCoverImageZoom =
    normalizeOptionalNumberInput(
      formData.get("clientAppGalleryCoverImageZoom"),
    ) ?? 1;
  const profileCoverImageZoom =
    normalizeOptionalNumberInput(
      formData.get("clientAppProfileCoverImageZoom"),
    ) ?? 1;
  const heroImageUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppHeroImageUrl"),
  );
  const galleryCoverImageUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppGalleryCoverImageUrl"),
  );
  const profileCoverImageUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppProfileCoverImageUrl"),
  );
  const shouldRemoveHeroImage =
    formData.get("removeClientAppHeroImage") === "on";
  const shouldRemoveGalleryCoverImage =
    formData.get("removeClientAppGalleryCoverImage") === "on";
  const shouldRemoveProfileCoverImage =
    formData.get("removeClientAppProfileCoverImage") === "on";
  const heroImageFile = readUploadedFile(formData, "clientAppHeroImageFile");
  const galleryCoverImageFile = readUploadedFile(
    formData,
    "clientAppGalleryCoverImageFile",
  );
  const profileCoverImageFile = readUploadedFile(
    formData,
    "clientAppProfileCoverImageFile",
  );
  const currentHeroImagePath = readRawConfigString(
    currentRawConfig,
    "heroImagePath",
  );
  const currentHeroImageSourcePath = readRawConfigString(
    currentRawConfig,
    "heroImageSourcePath",
  );
  const currentHeroImageSourceUrl = readRawConfigString(
    currentRawConfig,
    "heroImageSourceUrl",
  );
  const currentGalleryCoverImagePath = readRawConfigString(
    currentRawConfig,
    "galleryCoverImagePath",
  );
  const currentGalleryCoverImageSourcePath = readRawConfigString(
    currentRawConfig,
    "galleryCoverImageSourcePath",
  );
  const currentGalleryCoverImageSourceUrl = readRawConfigString(
    currentRawConfig,
    "galleryCoverImageSourceUrl",
  );
  const currentProfileCoverImagePath = readRawConfigString(
    currentRawConfig,
    "profileCoverImagePath",
  );
  const currentProfileCoverImageSourcePath = readRawConfigString(
    currentRawConfig,
    "profileCoverImageSourcePath",
  );
  const currentProfileCoverImageSourceUrl = readRawConfigString(
    currentRawConfig,
    "profileCoverImageSourceUrl",
  );

  if (secondaryColorInput && !secondaryColor) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Use uma cor secundária válida no formato #RRGGBB.",
        "error",
      ),
    );
  }

  if (accentColorInput && !accentColor) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Use uma cor de destaque válida no formato #RRGGBB.",
        "error",
      ),
    );
  }

  if (
    ratingValueInput &&
    (ratingValue === null || ratingValue < 0 || ratingValue > 5)
  ) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "A avaliação do salão deve ficar entre 0 e 5.",
        "error",
      ),
    );
  }

  if (ratingCountInput && (ratingCount === null || ratingCount < 0)) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Informe uma quantidade válida de avaliações.",
        "error",
      ),
    );
  }

  for (const [value, input, message] of [
    [
      heroImageFocusX,
      heroImageFocusXInput,
      "O foco horizontal do hero deve ficar entre 0 e 100.",
    ] as const,
    [
      heroImageFocusY,
      heroImageFocusYInput,
      "O foco vertical do hero deve ficar entre 0 e 100.",
    ] as const,
    [
      galleryCoverImageFocusX,
      galleryCoverImageFocusXInput,
      "O foco horizontal da galeria deve ficar entre 0 e 100.",
    ] as const,
    [
      galleryCoverImageFocusY,
      galleryCoverImageFocusYInput,
      "O foco vertical da galeria deve ficar entre 0 e 100.",
    ] as const,
    [
      profileCoverImageFocusX,
      profileCoverImageFocusXInput,
      "O foco horizontal da capa institucional deve ficar entre 0 e 100.",
    ] as const,
    [
      profileCoverImageFocusY,
      profileCoverImageFocusYInput,
      "O foco vertical da capa institucional deve ficar entre 0 e 100.",
    ] as const,
  ]) {
    if (input && (value < 0 || value > 100)) {
      redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }
  }

  for (const [value, input, message] of [
    [
      heroImageZoom,
      heroImageZoomInput,
      "O zoom do hero deve ficar entre 1 e 1.8.",
    ] as const,
    [
      galleryCoverImageZoom,
      galleryCoverImageZoomInput,
      "O zoom da galeria deve ficar entre 1 e 1.8.",
    ] as const,
    [
      profileCoverImageZoom,
      profileCoverImageZoomInput,
      "O zoom da capa institucional deve ficar entre 1 e 1.8.",
    ] as const,
  ]) {
    if (input && (value < 1 || value > 1.8)) {
      redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }
  }

  const heroImageAsset = await resolveClientAppImageAssetOrRedirect({
    supabase,
    salonId: salon.id,
    assetKey: "hero",
    incomingUrl: shouldRemoveHeroImage ? null : heroImageUrlInput,
    incomingFile: heroImageFile,
    shouldRemove: shouldRemoveHeroImage,
    focusX: heroImageFocusX,
    focusY: heroImageFocusY,
    zoom: heroImageZoom,
    currentImageUrl: currentClientAppConfig.heroImageUrl,
    currentMobileVariantUrl: currentClientAppConfig.heroImageVariantUrl,
    currentTabletVariantUrl: currentClientAppConfig.heroImageTabletVariantUrl,
    currentShareVariantUrl: currentClientAppConfig.heroImageShareVariantUrl,
    currentImagePath: currentHeroImagePath,
    currentSourcePath: currentHeroImageSourcePath,
    currentSourceUrl: currentHeroImageSourceUrl,
    currentFocusX: currentClientAppConfig.heroImageFocusX ?? 50,
    currentFocusY: currentClientAppConfig.heroImageFocusY ?? 50,
    currentZoom: currentClientAppConfig.heroImageZoom ?? 1,
    removeErrorMessage: "Não foi possível atualizar a imagem hero do app.",
    uploadErrorMessage: "Não foi possível enviar a imagem hero do app.",
    sourceErrorMessage: "Não foi possível processar a imagem hero do app.",
  });
  const galleryCoverImageAsset = await resolveClientAppImageAssetOrRedirect({
    supabase,
    salonId: salon.id,
    assetKey: "galleryCover",
    incomingUrl: shouldRemoveGalleryCoverImage
      ? null
      : galleryCoverImageUrlInput,
    incomingFile: galleryCoverImageFile,
    shouldRemove: shouldRemoveGalleryCoverImage,
    focusX: galleryCoverImageFocusX,
    focusY: galleryCoverImageFocusY,
    zoom: galleryCoverImageZoom,
    currentImageUrl: currentClientAppConfig.galleryCoverImageUrl,
    currentMobileVariantUrl: currentClientAppConfig.galleryCoverImageVariantUrl,
    currentTabletVariantUrl:
      currentClientAppConfig.galleryCoverImageTabletVariantUrl,
    currentShareVariantUrl:
      currentClientAppConfig.galleryCoverImageShareVariantUrl,
    currentImagePath: currentGalleryCoverImagePath,
    currentSourcePath: currentGalleryCoverImageSourcePath,
    currentSourceUrl: currentGalleryCoverImageSourceUrl,
    currentFocusX: currentClientAppConfig.galleryCoverImageFocusX ?? 50,
    currentFocusY: currentClientAppConfig.galleryCoverImageFocusY ?? 50,
    currentZoom: currentClientAppConfig.galleryCoverImageZoom ?? 1,
    removeErrorMessage: "Não foi possível atualizar a capa da galeria do app.",
    uploadErrorMessage: "Não foi possível enviar a capa da galeria do app.",
    sourceErrorMessage: "Não foi possível processar a capa da galeria do app.",
  });
  const profileCoverImageAsset = await resolveClientAppImageAssetOrRedirect({
    supabase,
    salonId: salon.id,
    assetKey: "profileCover",
    incomingUrl: shouldRemoveProfileCoverImage
      ? null
      : profileCoverImageUrlInput,
    incomingFile: profileCoverImageFile,
    shouldRemove: shouldRemoveProfileCoverImage,
    focusX: profileCoverImageFocusX,
    focusY: profileCoverImageFocusY,
    zoom: profileCoverImageZoom,
    currentImageUrl: currentClientAppConfig.profileCoverImageUrl,
    currentMobileVariantUrl: currentClientAppConfig.profileCoverImageVariantUrl,
    currentTabletVariantUrl:
      currentClientAppConfig.profileCoverImageTabletVariantUrl,
    currentShareVariantUrl:
      currentClientAppConfig.profileCoverImageShareVariantUrl,
    currentImagePath: currentProfileCoverImagePath,
    currentSourcePath: currentProfileCoverImageSourcePath,
    currentSourceUrl: currentProfileCoverImageSourceUrl,
    currentFocusX: currentClientAppConfig.profileCoverImageFocusX ?? 50,
    currentFocusY: currentClientAppConfig.profileCoverImageFocusY ?? 50,
    currentZoom: currentClientAppConfig.profileCoverImageZoom ?? 1,
    removeErrorMessage:
      "Não foi possível atualizar a capa institucional do perfil do salão.",
    uploadErrorMessage:
      "Não foi possível enviar a capa institucional do perfil do salão.",
    sourceErrorMessage:
      "Não foi possível processar a capa institucional do perfil do salão.",
  });
  const centralCampaigns = buildClientAppCampaignDrafts(formData);
  if (hasInvalidClientAppCampaignWindow(centralCampaigns)) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "A data final das campanhas do app precisa ser igual ou posterior à inicial.",
        "error",
      ),
    );
  }
  const appDisplayName = normalizeOptionalTextInput(
    formData.get("clientAppAppDisplayName"),
  );
  const customDomainInput = String(
    formData.get("clientAppCustomDomain") ?? "",
  ).trim();
  const customDomain = normalizeOptionalDomainInput(
    formData.get("clientAppCustomDomain"),
  );
  const mapUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppMapUrl"),
  );
  const mapUrl = normalizeOptionalUrlInput(formData.get("clientAppMapUrl"));
  const privacyPolicyUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppPrivacyPolicyUrl"),
  );
  const privacyPolicyUrl = normalizeOptionalUrlInput(
    formData.get("clientAppPrivacyPolicyUrl"),
  );
  const termsOfUseUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppTermsOfUseUrl"),
  );
  const termsOfUseUrl = normalizeOptionalUrlInput(
    formData.get("clientAppTermsOfUseUrl"),
  );
  const supportUrlInput = normalizeOptionalTextInput(
    formData.get("clientAppSupportUrl"),
  );
  const supportUrl = normalizeOptionalUrlInput(
    formData.get("clientAppSupportUrl"),
  );
  const supportEmailInput = normalizeOptionalTextInput(
    formData.get("clientAppSupportEmail"),
  );
  const supportEmail = normalizeOptionalEmailInput(
    formData.get("clientAppSupportEmail"),
  );
  const whiteLabelActive = formData.has("clientAppWhiteLabelActive")
    ? formData.get("clientAppWhiteLabelActive") === "on"
    : currentClientAppConfig.whiteLabelActive;
  const autoPilotEnabled = formData.has("clientAppAutoPilotEnabled")
    ? formData.get("clientAppAutoPilotEnabled") === "on"
    : currentClientAppConfig.autoPilotEnabled;

  if (customDomainInput && !customDomain) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Informe um endereço válido para o app do salão, sem caminho extra.",
        "error",
      ),
    );
  }

  for (const [input, value, message] of [
    [
      mapUrlInput,
      mapUrl,
      "Use uma URL válida de mapa com http ou https.",
    ] as const,
    [
      privacyPolicyUrlInput,
      privacyPolicyUrl,
      "Use uma URL válida para a política de privacidade com http ou https.",
    ] as const,
    [
      termsOfUseUrlInput,
      termsOfUseUrl,
      "Use uma URL válida para os termos de uso com http ou https.",
    ] as const,
    [
      supportUrlInput,
      supportUrl,
      "Use uma URL válida para o suporte com http ou https.",
    ] as const,
  ]) {
    if (input && !value) {
      redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }
  }

  if (supportEmailInput && !supportEmail) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Use um e-mail de suporte válido para o app do cliente.",
        "error",
      ),
    );
  }

  const clientAppConfigDraft = {
    rawConfig: currentClientAppConfig.rawConfig,
    experienceModel: String(
      formData.get("clientAppExperienceModel") ??
        currentClientAppConfig.experienceModel,
    ),
    visualStyle: String(
      formData.get("clientAppVisualStyle") ??
        currentClientAppConfig.visualStyle,
    ),
    homeEmphasis: String(
      formData.get("clientAppHomeEmphasis") ??
        currentClientAppConfig.homeEmphasis,
    ),
    heroHeadline:
      String(formData.get("clientAppHeroHeadline") ?? "").trim() || null,
    heroSupportLine:
      String(formData.get("clientAppHeroSupportLine") ?? "").trim() || null,
    primaryCtaLabel:
      String(formData.get("clientAppPrimaryCtaLabel") ?? "").trim() || null,
    themeMode: normalizeOptionalTextInput(formData.get("clientAppThemeMode")),
    buttonStyle: normalizeOptionalTextInput(
      formData.get("clientAppButtonStyle"),
    ),
    cardStyle: normalizeOptionalTextInput(formData.get("clientAppCardStyle")),
    bannerStyle: normalizeOptionalTextInput(
      formData.get("clientAppBannerStyle"),
    ),
    secondaryColor,
    accentColor,
    welcomeHeadline: normalizeOptionalTextInput(
      formData.get("clientAppWelcomeHeadline"),
    ),
    welcomeMessage: normalizeOptionalTextInput(
      formData.get("clientAppWelcomeMessage"),
    ),
    promotionHeadline: normalizeOptionalTextInput(
      formData.get("clientAppPromotionHeadline"),
    ),
    heroImageUrl: heroImageAsset.imageUrl,
    heroImageVariantUrl: heroImageAsset.mobileVariantUrl,
    heroImageTabletVariantUrl: heroImageAsset.tabletVariantUrl,
    heroImageShareVariantUrl: heroImageAsset.shareVariantUrl,
    heroImagePath: heroImageAsset.imagePath,
    heroImageSourcePath: heroImageAsset.sourcePath,
    heroImageSourceUrl: heroImageAsset.sourceUrl,
    galleryCoverImageUrl: galleryCoverImageAsset.imageUrl,
    galleryCoverImageVariantUrl: galleryCoverImageAsset.mobileVariantUrl,
    galleryCoverImageTabletVariantUrl: galleryCoverImageAsset.tabletVariantUrl,
    galleryCoverImageShareVariantUrl: galleryCoverImageAsset.shareVariantUrl,
    galleryCoverImagePath: galleryCoverImageAsset.imagePath,
    galleryCoverImageSourcePath: galleryCoverImageAsset.sourcePath,
    galleryCoverImageSourceUrl: galleryCoverImageAsset.sourceUrl,
    profileCoverImageUrl: profileCoverImageAsset.imageUrl,
    profileCoverImageVariantUrl: profileCoverImageAsset.mobileVariantUrl,
    profileCoverImageTabletVariantUrl: profileCoverImageAsset.tabletVariantUrl,
    profileCoverImageShareVariantUrl: profileCoverImageAsset.shareVariantUrl,
    profileCoverImagePath: profileCoverImageAsset.imagePath,
    profileCoverImageSourcePath: profileCoverImageAsset.sourcePath,
    profileCoverImageSourceUrl: profileCoverImageAsset.sourceUrl,
    heroImageFocusX,
    heroImageFocusY,
    heroImageZoom,
    galleryCoverImageFocusX,
    galleryCoverImageFocusY,
    galleryCoverImageZoom,
    profileCoverImageFocusX,
    profileCoverImageFocusY,
    profileCoverImageZoom,
    addressLabel: normalizeOptionalTextInput(
      formData.get("clientAppAddressLabel"),
    ),
    mapUrl,
    privacyPolicyUrl,
    termsOfUseUrl,
    supportUrl,
    supportEmail,
    appDisplayName,
    customDomain,
    whiteLabelActive,
    autoPilotEnabled,
    ratingValue,
    ratingCount,
    centralCampaigns,
    visibleHomeModules: formData
      .getAll("clientAppVisibleHomeModules")
      .map((value) => String(value).trim())
      .filter(Boolean),
  };
  const clientAppConfig = normalizeSalonClientAppConfig(clientAppConfigDraft);
  const shouldRemoveLogo = formData.get("removeLogo") === "on";
  const logoInput = formData.get("logo");
  const logoFile =
    logoInput instanceof File && logoInput.size > 0 ? logoInput : null;
  const uploadedBrandingCandidates: Array<
    [SettingsBrandingUploadField, File | null]
  > = [
    ["logo", logoFile],
    ["clientAppHeroImageFile", heroImageFile],
    ["clientAppGalleryCoverImageFile", galleryCoverImageFile],
    ["clientAppProfileCoverImageFile", profileCoverImageFile],
  ];
  const uploadedBrandingFiles = uploadedBrandingCandidates.filter(
    (entry): entry is [SettingsBrandingUploadField, File] => Boolean(entry[1]),
  );

  if (uploadedBrandingFiles.length > 1) {
    return redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        SETTINGS_BRANDING_UPLOAD_LIMIT_MESSAGE,
        "error",
      ),
    );
  }

  for (const [field, file] of uploadedBrandingFiles) {
    if (!isSettingsBrandingUploadMimeTypeAllowed(field, file.type)) {
      const message =
        field === "logo"
          ? "Envie uma imagem válida para a logo."
          : field === "clientAppHeroImageFile"
            ? "Envie uma imagem válida para o hero principal do app."
            : field === "clientAppGalleryCoverImageFile"
              ? "Envie uma imagem válida para a capa da galeria do app."
              : "Envie uma imagem válida para a capa institucional do perfil do salão.";
      return redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }

    if (field === "logo" && file.size > SALON_LOGO_MAX_BYTES) {
      return redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "A logo deve ter no máximo 2 MB.",
          "error",
        ),
      );
    }

    if (field !== "logo" && file.size > CLIENT_APP_IMAGE_MAX_BYTES) {
      const message =
        field === "clientAppHeroImageFile"
          ? "A imagem principal do app deve ter no máximo 3 MB."
          : field === "clientAppGalleryCoverImageFile"
            ? "A capa da galeria do app deve ter no máximo 3 MB."
            : "A capa do perfil do salão deve ter no máximo 3 MB.";
      return redirect(buildRedirectNotice(SETTINGS_PATH, message, "error"));
    }
  }

  if (!rawName) {
    redirect(
      buildRedirectNotice(SETTINGS_PATH, "Informe o nome do salão.", "error"),
    );
  }

  const brandColor = /^#[0-9A-F]{6}$/.test(rawBrandColor)
    ? rawBrandColor
    : "#C56B43";
  let logoPath = shouldRemoveLogo ? null : (salon.logo_path ?? null);

  if (shouldRemoveLogo && salon.logo_path && !logoFile) {
    const { error: removeError } = await supabase.storage
      .from("salon-assets")
      .remove([salon.logo_path]);

    if (removeError) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Não foi possível remover a logo atual.",
          "error",
        ),
      );
    }
  }

  if (logoFile) {
    let optimizedLogo;

    try {
      optimizedLogo = await optimizeSalonLogoImage(logoFile);
    } catch {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Não foi possível processar a logo do salão.",
          "error",
        ),
      );
    }

    const uploadPath = `${salon.id}/logo/${randomUUID()}.${optimizedLogo.extension}`;

    const { error: uploadError } = await supabase.storage
      .from("salon-assets")
      .upload(uploadPath, optimizedLogo.buffer, {
        contentType: optimizedLogo.contentType,
        upsert: true,
      });

    if (uploadError) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Não foi possível enviar a logo do salão.",
          "error",
        ),
      );
    }

    if (salon.logo_path && salon.logo_path !== uploadPath) {
      await supabase.storage.from("salon-assets").remove([salon.logo_path]);
    }

    logoPath = uploadPath;
  }

  const currentIdentitySnapshot = {
    name: salon.name ?? null,
    tagline: salon.tagline ?? null,
    brandColor: salon.brand_color ?? null,
    businessSegment: salon.business_segment ?? null,
  };
  const nextIdentitySnapshot = {
    name: rawName,
    tagline: rawTagline || null,
    brandColor,
    businessSegment,
  };
  const identityChanged =
    stringifyComparison(currentIdentitySnapshot) !==
      stringifyComparison(nextIdentitySnapshot) ||
    Boolean(logoFile) ||
    (salon.logo_path ?? null) !== logoPath;

  const currentExperienceSnapshot = {
    experienceModel: currentClientAppConfig.experienceModel,
    visualStyle: currentClientAppConfig.visualStyle,
    homeEmphasis: currentClientAppConfig.homeEmphasis,
    heroHeadline: currentClientAppConfig.heroHeadline,
    heroSupportLine: currentClientAppConfig.heroSupportLine,
    primaryCtaLabel: currentClientAppConfig.primaryCtaLabel,
    themeMode: currentClientAppConfig.themeMode,
    buttonStyle: currentClientAppConfig.buttonStyle,
    cardStyle: currentClientAppConfig.cardStyle,
    bannerStyle: currentClientAppConfig.bannerStyle,
    secondaryColor: currentClientAppConfig.secondaryColor,
    accentColor: currentClientAppConfig.accentColor,
    welcomeHeadline: currentClientAppConfig.welcomeHeadline,
    welcomeMessage: currentClientAppConfig.welcomeMessage,
    promotionHeadline: currentClientAppConfig.promotionHeadline,
    heroImageUrl: currentClientAppConfig.heroImageUrl,
    galleryCoverImageUrl: currentClientAppConfig.galleryCoverImageUrl,
    profileCoverImageUrl: currentClientAppConfig.profileCoverImageUrl,
    visibleHomeModules: currentClientAppConfig.visibleHomeModules,
  };
  const nextExperienceSnapshot = {
    experienceModel: clientAppConfig.experienceModel,
    visualStyle: clientAppConfig.visualStyle,
    homeEmphasis: clientAppConfig.homeEmphasis,
    heroHeadline: clientAppConfig.heroHeadline,
    heroSupportLine: clientAppConfig.heroSupportLine,
    primaryCtaLabel: clientAppConfig.primaryCtaLabel,
    themeMode: clientAppConfig.themeMode,
    buttonStyle: clientAppConfig.buttonStyle,
    cardStyle: clientAppConfig.cardStyle,
    bannerStyle: clientAppConfig.bannerStyle,
    secondaryColor: clientAppConfig.secondaryColor,
    accentColor: clientAppConfig.accentColor,
    welcomeHeadline: clientAppConfig.welcomeHeadline,
    welcomeMessage: clientAppConfig.welcomeMessage,
    promotionHeadline: clientAppConfig.promotionHeadline,
    heroImageUrl: clientAppConfig.heroImageUrl,
    galleryCoverImageUrl: clientAppConfig.galleryCoverImageUrl,
    profileCoverImageUrl: clientAppConfig.profileCoverImageUrl,
    visibleHomeModules: clientAppConfig.visibleHomeModules,
  };
  const vitrineChanged =
    stringifyComparison(currentExperienceSnapshot) !==
      stringifyComparison(nextExperienceSnapshot) ||
    Boolean(heroImageFile) ||
    Boolean(galleryCoverImageFile) ||
    Boolean(profileCoverImageFile) ||
    shouldRemoveHeroImage ||
    shouldRemoveGalleryCoverImage ||
    shouldRemoveProfileCoverImage;

  const campaignsChanged =
    stringifyComparison(currentClientAppConfig.centralCampaigns) !==
    stringifyComparison(clientAppConfig.centralCampaigns);

  const currentInformationSnapshot = {
    addressLabel: currentClientAppConfig.addressLabel,
    mapUrl: currentClientAppConfig.mapUrl,
    supportUrl: currentClientAppConfig.supportUrl,
    supportEmail: currentClientAppConfig.supportEmail,
    privacyPolicyUrl: currentClientAppConfig.privacyPolicyUrl,
    termsOfUseUrl: currentClientAppConfig.termsOfUseUrl,
    appDisplayName: currentClientAppConfig.appDisplayName,
    ratingValue: currentClientAppConfig.ratingValue,
    ratingCount: currentClientAppConfig.ratingCount,
  };
  const nextInformationSnapshot = {
    addressLabel: clientAppConfig.addressLabel,
    mapUrl: clientAppConfig.mapUrl,
    supportUrl: clientAppConfig.supportUrl,
    supportEmail: clientAppConfig.supportEmail,
    privacyPolicyUrl: clientAppConfig.privacyPolicyUrl,
    termsOfUseUrl: clientAppConfig.termsOfUseUrl,
    appDisplayName: clientAppConfig.appDisplayName,
    ratingValue: clientAppConfig.ratingValue,
    ratingCount: clientAppConfig.ratingCount,
  };
  const informationChanged =
    stringifyComparison(currentInformationSnapshot) !==
    stringifyComparison(nextInformationSnapshot);

  const changedAreas = [
    identityChanged ? "identidade" : null,
    vitrineChanged ? "vitrine" : null,
    campaignsChanged ? "campanhas" : null,
    informationChanged ? "informacoes" : null,
  ].filter((value): value is string => Boolean(value));

  const { error } = await supabase
    .from("salons")
    .update({
      name: rawName,
      tagline: rawTagline || null,
      brand_color: brandColor,
      business_segment: businessSegment,
      client_app_config: serializeSalonClientAppConfig(clientAppConfig),
      logo_path: logoPath,
    })
    .eq("id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível atualizar a identidade do salão.",
        "error",
      ),
    );
  }

  if (changedAreas.length) {
    const notification = buildClientAppRefreshNotification({
      changedAreas,
    });
    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: notification.type,
      title: notification.title,
      body: notification.body,
      payload: notification.payload,
    });
  }

  await syncOperationsAutopilotRuntimeConfig();
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  revalidatePath("/dashboard/client-app");
  revalidatePath(`/s/${salon.join_code}`);
  redirect(
    buildRedirectNotice(
      SETTINGS_PATH,
      "Identidade do salão atualizada com sucesso.",
      "success",
    ),
  );
}

export async function updateSalonScheduleActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const timezone = String(formData.get("timezone") ?? "").trim();
  const slotStepMinutes = Number(formData.get("slotStepMinutes"));

  if (!SALON_TIMEZONE_OPTIONS.some((option) => option.value === timezone)) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Selecione um fuso horário válido para o salão.",
        "error",
      ),
    );
  }

  if (!SLOT_STEP_OPTIONS.some((option) => option.value === slotStepMinutes)) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Escolha um intervalo válido para a agenda online.",
        "error",
      ),
    );
  }

  const businessHours = WEEKDAY_OPTIONS.map((weekday) => {
    const isOpen = formData.get(`isOpen_${weekday.value}`) === "on";
    const opensAt = String(
      formData.get(`opensAt_${weekday.value}`) ?? "",
    ).trim();
    const closesAt = String(
      formData.get(`closesAt_${weekday.value}`) ?? "",
    ).trim();

    if (!isOpen) {
      return {
        salon_id: salon.id,
        weekday: weekday.value,
        is_open: false,
        opens_at: null,
        closes_at: null,
      };
    }

    const normalizedOpen = normalizeBusinessTimeInput(opensAt);
    const normalizedClose = normalizeBusinessTimeInput(closesAt);

    if (!normalizedOpen || !normalizedClose) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          `Preencha um horário válido para ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    if (normalizedOpen >= normalizedClose) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          `O horário de abertura precisa ser antes do fechamento em ${weekday.label.toLowerCase()}.`,
          "error",
        ),
      );
    }

    return {
      salon_id: salon.id,
      weekday: weekday.value,
      is_open: true,
      opens_at: normalizedOpen,
      closes_at: normalizedClose,
    };
  });

  const { error: salonError } = await supabase
    .from("salons")
    .update({
      timezone,
      slot_step_minutes: slotStepMinutes,
    })
    .eq("id", salon.id);

  if (salonError) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível atualizar os dados da agenda.",
        "error",
      ),
    );
  }

  const { error: businessHoursError } = await supabase
    .from("salon_business_hours")
    .upsert(businessHours, {
      onConflict: "salon_id,weekday",
    });

  if (businessHoursError) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível salvar os horários do salão.",
        "error",
      ),
    );
  }

  await syncOperationsAutopilotRuntimeConfig();
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  redirect(
    buildRedirectNotice(
      SETTINGS_PATH,
      "Agenda online atualizada com sucesso.",
      "success",
    ),
  );
}

export async function updateSalonBookingPolicyActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const currentClientAppConfig = normalizeSalonClientAppConfig(
    salon.client_app_config,
  );

  const bookingPolicyEnabled = formData.get("bookingPolicyEnabled") === "on";
  const autoPilotEnabled = formData.has("clientAppAutoPilotEnabled")
    ? formData.get("clientAppAutoPilotEnabled") === "on"
    : currentClientAppConfig.autoPilotEnabled;
  const bookingPolicyAutoConfirmNewAppointments =
    formData.get("bookingPolicyAutoConfirmNewAppointments") === "on";
  const bookingPolicyRequiresDeposit =
    formData.get("bookingPolicyRequiresDeposit") === "on";
  const bookingPolicyTitle =
    normalizeOptionalTextInput(formData.get("bookingPolicyTitle")) ??
    "Reserva protegida";
  const bookingPolicySummary = normalizeOptionalTextInput(
    formData.get("bookingPolicySummary"),
  );
  const bookingPolicyPaymentInstructions = normalizeOptionalTextInput(
    formData.get("bookingPolicyPaymentInstructions"),
  );
  const bookingPolicyConfirmationRequired =
    formData.get("bookingPolicyConfirmationRequired") === "on";
  const bookingPolicyConfirmationLeadMinutes =
    normalizeOptionalIntegerInput(
      formData.get("bookingPolicyConfirmationLeadMinutes"),
    ) ?? 30;
  const bookingPolicyAutoCancelUnconfirmed =
    formData.get("bookingPolicyAutoCancelUnconfirmed") === "on";
  const bookingPolicyAutoCancelLeadMinutes =
    normalizeOptionalIntegerInput(
      formData.get("bookingPolicyAutoCancelLeadMinutes"),
    ) ?? 10;
  const bookingPolicyAutoCancelPendingDeposit =
    formData.get("bookingPolicyAutoCancelPendingDeposit") === "on";
  const bookingPolicyDepositReminderLeadHours =
    normalizeOptionalIntegerInput(
      formData.get("bookingPolicyDepositReminderLeadHours"),
    ) ?? 6;
  const bookingPolicyPaymentModeInput = String(
    formData.get("bookingPolicyPaymentMode") ?? "manual",
  ).trim();
  const bookingPolicyPaymentMode =
    bookingPolicyPaymentModeInput === "pix" ||
    bookingPolicyPaymentModeInput === "external_checkout" ||
    bookingPolicyPaymentModeInput === "asaas_pix"
      ? bookingPolicyPaymentModeInput
      : "manual";
  const bookingPolicyAsaasEnvironmentInput = String(
    formData.has("bookingPolicyAsaasEnvironment")
      ? formData.get("bookingPolicyAsaasEnvironment")
      : (salon.booking_policy_asaas_environment ?? "sandbox"),
  ).trim();
  const bookingPolicyAsaasEnvironment =
    bookingPolicyAsaasEnvironmentInput === "production"
      ? "production"
      : "sandbox";
  const bookingPolicyAsaasApiKey = formData.has("bookingPolicyAsaasApiKey")
    ? normalizeOptionalTextInput(formData.get("bookingPolicyAsaasApiKey"))
    : (salon.booking_policy_asaas_api_key ?? null);
  const bookingPolicyAsaasWebhookTokenInput = formData.has(
    "bookingPolicyAsaasWebhookToken",
  )
    ? normalizeOptionalTextInput(formData.get("bookingPolicyAsaasWebhookToken"))
    : (salon.booking_policy_asaas_webhook_token ?? null);
  const bookingPolicyPixKey = normalizeOptionalTextInput(
    formData.get("bookingPolicyPixKey"),
  );
  const bookingPolicyPixRecipientName = normalizeOptionalTextInput(
    formData.get("bookingPolicyPixRecipientName"),
  );
  const bookingPolicyPixRecipientCity = normalizeOptionalTextInput(
    formData.get("bookingPolicyPixRecipientCity"),
  );
  const bookingPolicyExternalCheckoutUrl = normalizeOptionalTextInput(
    formData.get("bookingPolicyExternalCheckoutUrl"),
  );
  const bookingPolicyCancellationWindowHours =
    normalizeOptionalIntegerInput(
      formData.get("bookingPolicyCancellationWindowHours"),
    ) ?? 24;
  const bookingPolicyDepositAmount = normalizeOptionalNumberInput(
    formData.get("bookingPolicyDepositAmount"),
  );

  if (
    bookingPolicyCancellationWindowHours < 0 ||
    bookingPolicyCancellationWindowHours > 168
  ) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Defina uma janela de cancelamento entre 0 e 168 horas.",
        "error",
      ),
    );
  }

  if (
    bookingPolicyConfirmationLeadMinutes < 5 ||
    bookingPolicyConfirmationLeadMinutes > 180
  ) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Defina a confirmação entre 5 e 180 minutos antes do horário.",
        "error",
      ),
    );
  }

  if (
    bookingPolicyAutoCancelLeadMinutes < 0 ||
    bookingPolicyAutoCancelLeadMinutes > 60
  ) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Defina o cancelamento automático entre 0 e 60 minutos antes do horário.",
        "error",
      ),
    );
  }

  if (
    bookingPolicyDepositReminderLeadHours < 0 ||
    bookingPolicyDepositReminderLeadHours > 72
  ) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Defina o lembrete de sinal entre 0 e 72 horas antes do horário.",
        "error",
      ),
    );
  }

  if (
    bookingPolicyEnabled &&
    bookingPolicyRequiresDeposit &&
    (bookingPolicyDepositAmount === null || bookingPolicyDepositAmount <= 0)
  ) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Informe um valor de sinal maior que zero para ativar a reserva protegida.",
        "error",
      ),
    );
  }

  const effectiveRequiresDeposit = bookingPolicyEnabled
    ? bookingPolicyRequiresDeposit
    : false;
  const effectiveDepositAmount = effectiveRequiresDeposit
    ? bookingPolicyDepositAmount
    : null;
  const effectivePaymentMode = effectiveRequiresDeposit
    ? bookingPolicyPaymentMode
    : bookingPolicyPaymentMode;
  const bookingPolicyAsaasWebhookToken =
    bookingPolicyAsaasWebhookTokenInput ??
    salon.booking_policy_asaas_webhook_token ??
    (effectivePaymentMode === "asaas_pix" ? buildBookingWebhookToken() : null);
  const effectiveAutoCancelUnconfirmed = bookingPolicyConfirmationRequired
    ? bookingPolicyAutoCancelUnconfirmed
    : false;
  const effectiveAutoCancelPendingDeposit = effectiveRequiresDeposit
    ? bookingPolicyAutoCancelPendingDeposit
    : false;

  if (effectiveRequiresDeposit && effectivePaymentMode === "pix") {
    if (
      !bookingPolicyPixKey ||
      !bookingPolicyPixRecipientName ||
      !bookingPolicyPixRecipientCity
    ) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Preencha chave Pix, favorecido e cidade para cobrar o sinal direto no app.",
          "error",
        ),
      );
    }
  }

  if (
    effectiveRequiresDeposit &&
    effectivePaymentMode === "external_checkout"
  ) {
    if (!bookingPolicyExternalCheckoutUrl) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Informe a URL do checkout externo para cobrar o sinal.",
          "error",
        ),
      );
    }

    try {
      const parsedUrl = new URL(bookingPolicyExternalCheckoutUrl);
      if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
        throw new Error("invalid_protocol");
      }
    } catch {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
        "Use uma URL válida de checkout externo com http ou https.",
          "error",
        ),
      );
    }
  }

  if (effectiveRequiresDeposit && effectivePaymentMode === "asaas_pix") {
    if (!bookingPolicyAsaasApiKey) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "O Pix automático precisa ser ativado pela equipe de suporte antes do uso.",
          "error",
        ),
      );
    }

    if (!bookingPolicyAsaasWebhookToken) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "O Pix automático ainda está sendo preparado para este salão.",
          "error",
        ),
      );
    }
  }

  const hasPolicyChanged =
    (salon.booking_policy_enabled ?? false) !== bookingPolicyEnabled ||
    (salon.booking_policy_auto_confirm_new_appointments ?? false) !==
      bookingPolicyAutoConfirmNewAppointments ||
    (salon.booking_policy_title ?? "Reserva protegida") !==
      bookingPolicyTitle ||
    (salon.booking_policy_summary ?? null) !== bookingPolicySummary ||
    (salon.booking_policy_cancellation_window_hours ?? 24) !==
      bookingPolicyCancellationWindowHours ||
    (salon.booking_policy_confirmation_required ?? true) !==
      bookingPolicyConfirmationRequired ||
    (salon.booking_policy_confirmation_lead_minutes ?? 30) !==
      bookingPolicyConfirmationLeadMinutes ||
    (salon.booking_policy_auto_cancel_unconfirmed ?? true) !==
      effectiveAutoCancelUnconfirmed ||
    (salon.booking_policy_auto_cancel_lead_minutes ?? 10) !==
      bookingPolicyAutoCancelLeadMinutes ||
    (salon.booking_policy_auto_cancel_pending_deposit ?? false) !==
      effectiveAutoCancelPendingDeposit ||
    (salon.booking_policy_deposit_reminder_lead_hours ?? 6) !==
      bookingPolicyDepositReminderLeadHours ||
    (salon.booking_policy_payment_mode ?? "manual") !== effectivePaymentMode ||
    (salon.booking_policy_asaas_environment ?? "sandbox") !==
      bookingPolicyAsaasEnvironment ||
    (salon.booking_policy_asaas_api_key ?? null) !== bookingPolicyAsaasApiKey ||
    (salon.booking_policy_asaas_webhook_token ?? null) !==
      bookingPolicyAsaasWebhookToken ||
    (salon.booking_policy_pix_key ?? null) !== bookingPolicyPixKey ||
    (salon.booking_policy_pix_recipient_name ?? null) !==
      bookingPolicyPixRecipientName ||
    (salon.booking_policy_pix_recipient_city ?? null) !==
      bookingPolicyPixRecipientCity ||
    (salon.booking_policy_external_checkout_url ?? null) !==
      bookingPolicyExternalCheckoutUrl ||
    (salon.booking_policy_requires_deposit ?? false) !==
      effectiveRequiresDeposit ||
    Number(salon.booking_policy_deposit_amount ?? 0) !==
      Number(effectiveDepositAmount ?? 0) ||
    (salon.booking_policy_payment_instructions ?? null) !==
      bookingPolicyPaymentInstructions;

  const bookingPolicyVersion = hasPolicyChanged
    ? buildBookingPolicyVersionTag()
    : (salon.booking_policy_version ?? "2026-04-booking-policy-v1");
  const clientAppConfig = serializeSalonClientAppConfig({
    ...currentClientAppConfig,
    autoPilotEnabled,
  });

  const { error } = await supabase
    .from("salons")
    .update({
      client_app_config: clientAppConfig,
      booking_policy_enabled: bookingPolicyEnabled,
      booking_policy_auto_confirm_new_appointments:
        bookingPolicyAutoConfirmNewAppointments,
      booking_policy_title: bookingPolicyTitle,
      booking_policy_summary: bookingPolicySummary,
      booking_policy_cancellation_window_hours:
        bookingPolicyCancellationWindowHours,
      booking_policy_confirmation_required: bookingPolicyConfirmationRequired,
      booking_policy_confirmation_lead_minutes:
        bookingPolicyConfirmationLeadMinutes,
      booking_policy_auto_cancel_unconfirmed: effectiveAutoCancelUnconfirmed,
      booking_policy_auto_cancel_lead_minutes:
        bookingPolicyAutoCancelLeadMinutes,
      booking_policy_auto_cancel_pending_deposit:
        effectiveAutoCancelPendingDeposit,
      booking_policy_deposit_reminder_lead_hours:
        bookingPolicyDepositReminderLeadHours,
      booking_policy_payment_mode: effectivePaymentMode,
      booking_policy_asaas_environment: bookingPolicyAsaasEnvironment,
      booking_policy_asaas_api_key: bookingPolicyAsaasApiKey,
      booking_policy_asaas_webhook_token: bookingPolicyAsaasWebhookToken,
      booking_policy_pix_key: bookingPolicyPixKey,
      booking_policy_pix_recipient_name: bookingPolicyPixRecipientName,
      booking_policy_pix_recipient_city: bookingPolicyPixRecipientCity,
      booking_policy_external_checkout_url: bookingPolicyExternalCheckoutUrl,
      booking_policy_requires_deposit: effectiveRequiresDeposit,
      booking_policy_deposit_amount: effectiveDepositAmount,
      booking_policy_payment_instructions: bookingPolicyPaymentInstructions,
      booking_policy_version: bookingPolicyVersion,
    })
    .eq("id", salon.id);

  if (error) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível salvar a política de reserva protegida.",
        "error",
      ),
    );
  }

  await syncOperationsAutopilotRuntimeConfig();
  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  redirect(
    buildRedirectNotice(
      SETTINGS_PATH,
      "Política de reserva protegida atualizada com sucesso.",
      "success",
    ),
  );
}

export async function updateSalonSecurityPolicyActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const mfaTotpEnabled = formData.get("mfaTotpEnabled") === "on";
  const geoAllowlistEnabled = formData.get("geoAllowlistEnabled") === "on";
  const rawAllowedCountryCodes = formData.get("allowedCountryCodes");
  const allowedCountryCodes = normalizeCountryCodesInput(
    rawAllowedCountryCodes instanceof File ? null : rawAllowedCountryCodes,
  );

  if (geoAllowlistEnabled && allowedCountryCodes.length === 0) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Informe pelo menos um país com código ISO-3166 alpha-2, como BR ou US.",
        "error",
      ),
    );
  }

  if (mfaTotpEnabled) {
    const admin = createAdminClient() as any;
    const { data, error } = await admin.auth.admin.mfa.listFactors({
      userId: user.id,
    });

    if (error) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Não foi possível validar o autenticador antes de ligar o MFA.",
          "error",
        ),
      );
    }

    const hasVerifiedTotpFactor = (data?.factors ?? []).some(
      (factor: { factor_type?: string | null; status?: string | null }) =>
        factor.factor_type === "totp" && factor.status === "verified",
    );

    if (!hasVerifiedTotpFactor) {
      redirect(
        buildRedirectNotice(
          SETTINGS_PATH,
          "Conecte e confirme um autenticador TOTP antes de exigir MFA no painel.",
          "error",
        ),
      );
    }
  }

  const { error } = await supabase.from("salon_security_settings").upsert(
    {
      salon_id: salon.id,
      mfa_totp_enabled: mfaTotpEnabled,
      geo_allowlist_enabled: geoAllowlistEnabled,
      allowed_country_codes: allowedCountryCodes,
    },
    {
      onConflict: "salon_id",
    },
  );

  if (error) {
    redirect(
      buildRedirectNotice(
        SETTINGS_PATH,
        "Não foi possível salvar a política de segurança do painel.",
        "error",
      ),
    );
  }

  revalidatePath(DASHBOARD_PATH);
  revalidatePath(SETTINGS_PATH);
  redirect(
    buildRedirectNotice(
      SETTINGS_PATH,
      "Política de segurança do painel atualizada com sucesso.",
      "success",
    ),
  );
}
