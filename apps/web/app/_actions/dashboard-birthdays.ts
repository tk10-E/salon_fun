"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import {
  buildInlineActionState,
  isInlineAction,
  type InlineActionState,
} from "@/lib/inline-action-state";
import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
} from "@/lib/mediaUploadPresets";
import { createClient } from "@/lib/supabase/server";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";
import {
  assertSafeVideoUpload,
  getSafeFeedVideoExtension,
} from "@/lib/uploadedVideoValidation";

import {
  buildRedirectNotice,
  rethrowIfRedirectError,
  resolveDashboardReturnPath,
} from "./shared";

const DASHBOARD_PATH = "/dashboard";
const BIRTHDAYS_DASHBOARD_PATH = "/dashboard/birthdays";
const BIRTHDAY_MEDIA_BUCKET = "salon-posts";
const BIRTHDAY_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.feed;
const BIRTHDAY_VIDEO_MAX_BYTES = 25 * 1024 * 1024;

type BirthdayCampaignRow = {
  id: string;
  image_path: string | null;
  is_active: boolean;
  media_kind: "image" | "video" | null;
  message: string;
  salon_id: string;
  title: string;
  video_path: string | null;
};

function normalizeOptionalText(
  value: FormDataEntryValue | null,
  maxLength: number,
) {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.slice(0, maxLength);
}

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function respond(
  formData: FormData,
  returnPath: string,
  message: string,
  tone: "success" | "error" | "info",
): InlineActionState | never {
  if (isInlineAction(formData)) {
    return buildInlineActionState(message, tone);
  }

  redirect(buildRedirectNotice(returnPath, message, tone));
}

function buildBirthdayMediaPath(salonId: string, extension: string) {
  return `${salonId}/birthdays/${randomUUID()}.${extension}`;
}

async function loadExistingBirthdayCampaign(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
) {
  const { data, error } = await (supabase as any)
    .from("salon_birthday_campaigns")
    .select(
      "id, salon_id, is_active, title, message, media_kind, image_path, video_path",
    )
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error) {
    throw new Error(
      "Não foi possível carregar a campanha de aniversário atual.",
    );
  }

  return (data ?? null) as BirthdayCampaignRow | null;
}

export async function updateSalonBirthdayCampaignAction(
  formData: FormData,
): Promise<InlineActionState | void> {
  const returnPath = resolveDashboardReturnPath(
    formData,
    BIRTHDAYS_DASHBOARD_PATH,
    [DASHBOARD_PATH, BIRTHDAYS_DASHBOARD_PATH],
  );
  const title =
    normalizeOptionalText(formData.get("birthdayCampaignTitle"), 80) ??
    "Feliz aniversário!";
  const message = normalizeOptionalText(
    formData.get("birthdayCampaignMessage"),
    800,
  );
  const mediaFile = readUploadedFile(formData, "birthdayCampaignMedia");
  const removeMedia = formData.get("removeBirthdayCampaignMedia") === "on";
  const isActive = formData.get("birthdayCampaignIsActive") === "on";

  if (!message) {
    return respond(
      formData,
      returnPath,
      "Escreva a mensagem que vai aparecer no app no aniversário da cliente.",
      "error",
    );
  }

  if (
    mediaFile &&
    !mediaFile.type.startsWith("image/") &&
    !mediaFile.type.startsWith("video/")
  ) {
    return respond(
      formData,
      returnPath,
      "Envie uma imagem ou um vídeo válido para a campanha de aniversário.",
      "error",
    );
  }

  if (
    mediaFile &&
    mediaFile.type.startsWith("video/") &&
    mediaFile.size > BIRTHDAY_VIDEO_MAX_BYTES
  ) {
    return respond(
      formData,
      returnPath,
      "O vídeo de aniversário deve ter no máximo 25 MB.",
      "error",
    );
  }

  if (
    mediaFile &&
    mediaFile.type.startsWith("image/") &&
    mediaFile.size > BIRTHDAY_IMAGE_PRESET.maxInputBytes
  ) {
    return respond(
      formData,
      returnPath,
      `A imagem de aniversário deve ter no máximo ${formatPresetMegabytes(
        BIRTHDAY_IMAGE_PRESET.maxInputBytes,
      )} MB.`,
      "error",
    );
  }

  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  let uploadedPath: string | null = null;

  try {
    const existingCampaign = await loadExistingBirthdayCampaign(
      supabase,
      salon.id,
    );

    let mediaKind = existingCampaign?.media_kind ?? null;
    let imagePath = existingCampaign?.image_path ?? null;
    let videoPath = existingCampaign?.video_path ?? null;

    if (mediaFile) {
      if (mediaFile.type.startsWith("image/")) {
        const optimizedImage = await optimizeUploadedImage(mediaFile, "feed");
        uploadedPath = buildBirthdayMediaPath(
          salon.id,
          optimizedImage.extension,
        );
        const { error: uploadError } = await supabase.storage
          .from(BIRTHDAY_MEDIA_BUCKET)
          .upload(uploadedPath, optimizedImage.buffer, {
            contentType: optimizedImage.contentType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Não foi possível enviar a imagem de aniversário.");
        }

        mediaKind = "image";
        imagePath = uploadedPath;
        videoPath = null;
      } else {
        const bytes = Buffer.from(await mediaFile.arrayBuffer());
        const contentType = assertSafeVideoUpload({
          buffer: bytes,
          declaredMimeType: mediaFile.type,
          maxBytes: BIRTHDAY_VIDEO_MAX_BYTES,
          contextLabel: "video de aniversario",
        });
        uploadedPath = buildBirthdayMediaPath(
          salon.id,
          getSafeFeedVideoExtension(contentType),
        );
        const { error: uploadError } = await supabase.storage
          .from(BIRTHDAY_MEDIA_BUCKET)
          .upload(uploadedPath, bytes, {
            contentType,
            upsert: false,
          });

        if (uploadError) {
          throw new Error("Não foi possível enviar o vídeo de aniversário.");
        }

        mediaKind = "video";
        imagePath = null;
        videoPath = uploadedPath;
      }
    } else if (removeMedia) {
      mediaKind = null;
      imagePath = null;
      videoPath = null;
    }

    const { error: upsertError } = await (supabase as any)
      .from("salon_birthday_campaigns")
      .upsert(
        {
          salon_id: salon.id,
          is_active: isActive,
          title,
          message,
          media_kind: mediaKind,
          image_path: imagePath,
          video_path: videoPath,
        },
        { onConflict: "salon_id" },
      );

    if (upsertError) {
      throw new Error("Não foi possível salvar a mensagem de aniversário.");
    }

    const stalePaths = [
      existingCampaign?.image_path,
      existingCampaign?.video_path,
    ].filter(
      (path): path is string =>
        Boolean(path) && path !== imagePath && path !== videoPath,
    );

    if (stalePaths.length > 0) {
      await supabase.storage
        .from(BIRTHDAY_MEDIA_BUCKET)
        .remove(stalePaths)
        .catch(() => undefined);
    }

    revalidatePath(DASHBOARD_PATH);
    revalidatePath(BIRTHDAYS_DASHBOARD_PATH);

    return respond(
      formData,
      returnPath,
      isActive
        ? "Mensagem de aniversário atualizada e pronta para aparecer no app."
        : "Mensagem de aniversário salva e pausada no app.",
      "success",
    );
  } catch (error) {
    rethrowIfRedirectError(error);

    if (uploadedPath) {
      await supabase.storage
        .from(BIRTHDAY_MEDIA_BUCKET)
        .remove([uploadedPath])
        .catch(() => undefined);
    }

    return respond(
      formData,
      returnPath,
      error instanceof Error
        ? error.message
        : "Não foi possível atualizar a mensagem de aniversário agora.",
      "error",
    );
  }
}

export async function deleteSalonBirthdayCampaignAction(
  formData: FormData,
): Promise<InlineActionState | void> {
  const returnPath = resolveDashboardReturnPath(
    formData,
    BIRTHDAYS_DASHBOARD_PATH,
    [DASHBOARD_PATH, BIRTHDAYS_DASHBOARD_PATH],
  );
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  try {
    const existingCampaign = await loadExistingBirthdayCampaign(
      supabase,
      salon.id,
    );

    if (!existingCampaign) {
      return respond(
        formData,
        returnPath,
        "Não existe mensagem de aniversário salva para excluir.",
        "info",
      );
    }

    const mediaPaths = [
      existingCampaign.image_path,
      existingCampaign.video_path,
    ].filter((path): path is string => Boolean(path));

    const { error: deleteError } = await (supabase as any)
      .from("salon_birthday_campaigns")
      .delete()
      .eq("salon_id", salon.id);

    if (deleteError) {
      throw new Error("Não foi possível excluir a mensagem de aniversário.");
    }

    if (mediaPaths.length > 0) {
      await supabase.storage
        .from(BIRTHDAY_MEDIA_BUCKET)
        .remove(mediaPaths)
        .catch(() => undefined);
    }

    revalidatePath(DASHBOARD_PATH);
    revalidatePath(BIRTHDAYS_DASHBOARD_PATH);

    return respond(
      formData,
      returnPath,
      "Mensagem de aniversário excluída do painel e do app.",
      "success",
    );
  } catch (error) {
    rethrowIfRedirectError(error);

    return respond(
      formData,
      returnPath,
      error instanceof Error
        ? error.message
        : "Não foi possível excluir a mensagem de aniversário agora.",
      "error",
    );
  }
}
