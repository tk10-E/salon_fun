import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingEntitlements } from "@/lib/billing";
import {
  FEED_STANDARD_MAX_IMAGES,
  isFeedComposerPostType,
  type FeedComposerPostType,
} from "@/lib/feedComposerConfig";
import {
  MEDIA_UPLOAD_PRESETS,
  formatPresetMegabytes,
} from "@/lib/mediaUploadPresets";
import {
  buildLegacyStoryTitle,
  isMissingFeedStorySchema,
} from "@/lib/feedStorySupport";
import { createClient } from "@/lib/supabase/server";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";
import {
  assertSafeVideoUpload,
  getSafeFeedVideoExtension,
} from "@/lib/uploadedVideoValidation";

import {
  buildFeedPostNotification,
  buildRedirectNotice,
  queueCustomerNotification,
} from "./shared";

const FEED_PATH = "/dashboard/feed";
const INSTAGRAM_PATH = "/dashboard/instagram";
const FEED_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
const FEED_IMAGE_PRESET = MEDIA_UPLOAD_PRESETS.feed;
const FEED_STORY_DURATION_OPTIONS = new Set([12, 24, 48]);

type DeleteSalonPostArgs = {
  postId: string;
  salonId: string;
  supabase: ReturnType<typeof createClient>;
};

function readUploadedFiles(formData: FormData, field: string) {
  return formData
    .getAll(field)
    .filter((entry): entry is File => entry instanceof File && entry.size > 0);
}

function readUploadedFile(formData: FormData, field: string) {
  const entry = formData.get(field);
  return entry instanceof File && entry.size > 0 ? entry : null;
}

function parseFeedPostType(value: string): FeedComposerPostType | null {
  return isFeedComposerPostType(value) ? value : null;
}

function parseStoryDurationHours(value: string) {
  const parsed = Number.parseInt(value, 10);
  return FEED_STORY_DURATION_OPTIONS.has(parsed) ? parsed : 24;
}

function buildFeedUploadPath(salonId: string, extension: string) {
  return `${salonId}/${randomUUID()}.${extension}`;
}

export async function createSalonPostActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient();
  const billing = await getSalonBillingEntitlements(salon.id);

  const rawTitle = String(formData.get("title") ?? "").trim();
  const rawCaption = String(formData.get("caption") ?? "").trim();
  const rawPostType = String(formData.get("postType") ?? "standard").trim();
  const rawStoryDurationHours = String(
    formData.get("storyDurationHours") ?? "24",
  ).trim();
  const rawServiceId = String(formData.get("serviceId") ?? "").trim();
  const rawStaffMemberId = String(formData.get("staffMemberId") ?? "").trim();
  const imageFiles = readUploadedFiles(formData, "images");
  const videoFile = readUploadedFile(formData, "video");
  const postType = parseFeedPostType(rawPostType);
  const storyDurationHours = parseStoryDurationHours(rawStoryDurationHours);

  if (!rawTitle) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Informe um título para a publicação.",
        "error",
      ),
    );
  }

  if (rawCaption.length > 500) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "A legenda pode ter no máximo 500 caracteres.",
        "error",
      ),
    );
  }

  if (!postType) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Selecione um formato válido para a publicação.",
        "error",
      ),
    );
  }

  if (postType === "reel" && !billing.includesFeedVideo) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        `Vídeos curtos no feed estão disponíveis a partir do plano Growth. O seu plano atual é ${billing.currentPlan.displayName}.`,
        "error",
      ),
    );
  }

  if (postType === "standard" && !imageFiles.length) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Selecione pelo menos uma imagem para publicar.",
        "error",
      ),
    );
  }

  if (postType === "standard" && imageFiles.length > FEED_STANDARD_MAX_IMAGES) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        `Envie no máximo ${FEED_STANDARD_MAX_IMAGES} imagens por publicação.`,
        "error",
      ),
    );
  }

  if (postType === "before_after" && imageFiles.length != 2) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Posts de antes e depois precisam de exatamente 2 imagens.",
        "error",
      ),
    );
  }

  if (postType === "story" && imageFiles.length != 1) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Story precisa de exatamente 1 imagem.",
        "error",
      ),
    );
  }

  if (postType === "reel" && imageFiles.length != 1) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Vídeos curtos precisam de 1 imagem de capa.",
        "error",
      ),
    );
  }

  if (postType !== "reel" && videoFile) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Vídeo só pode ser enviado no formato vídeo curto.",
        "error",
      ),
    );
  }

  if (postType === "reel" && !videoFile) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Envie um vídeo para publicar no formato vídeo curto.",
        "error",
      ),
    );
  }

  for (const imageFile of imageFiles) {
    if (!imageFile.type.startsWith("image/")) {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Envie apenas imagens válidas para o feed.",
          "error",
        ),
      );
    }

    if (imageFile.size > FEED_IMAGE_PRESET.maxInputBytes) {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          `Cada imagem deve ter no máximo ${formatPresetMegabytes(
            FEED_IMAGE_PRESET.maxInputBytes,
          )} MB.`,
          "error",
        ),
      );
    }
  }

  if (videoFile) {
    if (!videoFile.type.startsWith("video/")) {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Envie um vídeo válido para o feed.",
          "error",
        ),
      );
    }

    if (videoFile.size > FEED_VIDEO_MAX_BYTES) {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "O vídeo deve ter no máximo 25 MB.",
          "error",
        ),
      );
    }
  }

  let serviceId: string | null = null;
  let serviceName: string | null = null;
  let staffMemberId: string | null = null;
  let staffMemberName: string | null = null;

  if (rawServiceId) {
    const { data: service, error: serviceError } = await supabase
      .from("services")
      .select("id,name")
      .eq("id", rawServiceId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (serviceError || !service) {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Selecione um serviço válido para vincular ao post.",
          "error",
        ),
      );
    }

    serviceId = service.id;
    serviceName = service.name;
  }

  if (rawStaffMemberId) {
    const { data: staffMember, error: staffMemberError } = await supabase
      .from("staff_members")
      .select("id,name")
      .eq("id", rawStaffMemberId)
      .eq("salon_id", salon.id)
      .maybeSingle();

    if (staffMemberError || !staffMember) {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Selecione um profissional válido para destacar no post.",
          "error",
        ),
      );
    }

    staffMemberId = staffMember.id;
    staffMemberName = staffMember.name;
  }

  const uploadedImagePaths: string[] = [];
  const uploadedAssetPaths: string[] = [];
  let videoPath: string | null = null;

  for (const imageFile of imageFiles) {
    let optimizedImage;

    try {
      optimizedImage = await optimizeUploadedImage(
        imageFile,
        postType === "story" ? "story" : "feed",
      );
    } catch {
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Não foi possível processar uma das imagens do post.",
          "error",
        ),
      );
    }

    const uploadPath = buildFeedUploadPath(salon.id, optimizedImage.extension);
    const { error: uploadError } = await supabase.storage
      .from("salon-posts")
      .upload(uploadPath, optimizedImage.buffer, {
        contentType: optimizedImage.contentType,
        upsert: false,
      });

    if (uploadError) {
      if (uploadedAssetPaths.length) {
        await supabase.storage.from("salon-posts").remove(uploadedAssetPaths);
      }
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Não foi possível enviar as imagens do post.",
          "error",
        ),
      );
    }

    uploadedImagePaths.push(uploadPath);
    uploadedAssetPaths.push(uploadPath);
  }

  if (videoFile) {
    const bytes = Buffer.from(await videoFile.arrayBuffer());
    let videoContentType: ReturnType<typeof assertSafeVideoUpload>;

    try {
      videoContentType = assertSafeVideoUpload({
        buffer: bytes,
        declaredMimeType: videoFile.type,
        maxBytes: FEED_VIDEO_MAX_BYTES,
        contextLabel: "video do feed",
      });
    } catch {
      if (uploadedAssetPaths.length) {
        await supabase.storage.from("salon-posts").remove(uploadedAssetPaths);
      }

      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Não foi possível validar o vídeo do post.",
          "error",
        ),
      );
    }

    const uploadPath = buildFeedUploadPath(
      salon.id,
      getSafeFeedVideoExtension(videoContentType),
    );
    const { error: uploadError } = await supabase.storage
      .from("salon-posts")
      .upload(uploadPath, bytes, {
        contentType: videoContentType,
        upsert: false,
      });

    if (uploadError) {
      if (uploadedAssetPaths.length) {
        await supabase.storage.from("salon-posts").remove(uploadedAssetPaths);
      }
      redirect(
        buildRedirectNotice(
          FEED_PATH,
          "Não foi possível enviar o vídeo do post.",
          "error",
        ),
      );
    }

    videoPath = uploadPath;
    uploadedAssetPaths.push(uploadPath);
  }

  const expiresAt =
    postType === "story"
      ? new Date(Date.now() + storyDurationHours * 60 * 60 * 1000).toISOString()
      : null;

  const primaryInsertPayload = {
    salon_id: salon.id,
    title: rawTitle,
    caption: rawCaption || null,
    expires_at: expiresAt,
    image_path: uploadedImagePaths[0],
    post_type: postType,
    service_id: serviceId,
    staff_member_id: staffMemberId,
    video_path: videoPath,
    created_by_user_id: user.id,
  };
  const primaryInsert = await supabase
    .from("salon_posts")
    .insert(primaryInsertPayload)
    .select("id,created_at")
    .single();

  let createdPost = primaryInsert.data;
  let createdPostError = primaryInsert.error;

  if (
    postType === "story" &&
    (createdPostError || !createdPost) &&
    isMissingFeedStorySchema(createdPostError)
  ) {
    const fallbackInsert = await supabase
      .from("salon_posts")
      .insert({
        salon_id: salon.id,
        title: buildLegacyStoryTitle(rawTitle, storyDurationHours),
        caption: rawCaption || null,
        image_path: uploadedImagePaths[0],
        post_type: "standard",
        service_id: serviceId,
        staff_member_id: staffMemberId,
        video_path: null,
        created_by_user_id: user.id,
      })
      .select("id,created_at")
      .single();

    createdPost = fallbackInsert.data;
    createdPostError = fallbackInsert.error;
  }

  if (createdPostError || !createdPost) {
    await supabase.storage.from("salon-posts").remove(uploadedAssetPaths);
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Não foi possível criar a publicação.",
        "error",
      ),
    );
  }

  const galleryRows = uploadedImagePaths.map((path, index) => ({
    post_id: createdPost.id,
    image_path: path,
    sort_order: index,
  }));

  const { error: galleryError } = await supabase
    .from("salon_post_images")
    .insert(galleryRows);

  if (galleryError) {
    await supabase.from("salon_posts").delete().eq("id", createdPost.id);
    await supabase.storage.from("salon-posts").remove(uploadedAssetPaths);
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Não foi possível salvar a galeria do post.",
        "error",
      ),
    );
  }

  if (postType !== "story") {
    const postImageUrl = supabase.storage
      .from("salon-posts")
      .getPublicUrl(uploadedImagePaths[0]).data.publicUrl;
    const postVideoUrl = videoPath
      ? supabase.storage.from("salon-posts").getPublicUrl(videoPath).data
          .publicUrl
      : null;
    const feedNotification = buildFeedPostNotification({
      postId: createdPost.id,
      postTitle: rawTitle,
      postCaption: rawCaption,
      postImageUrl,
      postType,
      postVideoUrl,
      postPublishedAt: createdPost.created_at ?? new Date().toISOString(),
      serviceId,
      serviceName,
      staffMemberName,
    });

    await queueCustomerNotification({
      supabase,
      salonId: salon.id,
      notificationType: "feed_post_published",
      title: feedNotification.title,
      body: feedNotification.body,
      payload: feedNotification.payload,
    });
  }

  revalidatePath(FEED_PATH);
  redirect(
    buildRedirectNotice(
      FEED_PATH,
      postType === "story"
        ? "Story publicado com sucesso."
        : postType === "reel"
          ? "Vídeo curto publicado com sucesso."
          : postType === "before_after"
            ? "Antes e depois publicado com sucesso."
            : "Publicação criada com sucesso.",
      "success",
    ),
  );
}

export async function deleteSalonPostActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const postId = String(formData.get("postId") ?? "");

  if (!postId) {
    redirect(buildRedirectNotice(FEED_PATH, "Publicação inválida.", "error"));
  }

  try {
    await deleteSalonPostForSalon({
      postId,
      salonId: salon.id,
      supabase,
    });
  } catch (error) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        error instanceof Error
          ? error.message
          : "Não foi possível excluir a publicação.",
        "error",
      ),
    );
  }

  revalidatePath(FEED_PATH);
  redirect(
    buildRedirectNotice(
      FEED_PATH,
      "Publicação removida com sucesso.",
      "success",
    ),
  );
}

export async function deleteSalonPostForSalon(args: DeleteSalonPostArgs) {
  const { data: post, error: loadError } = await args.supabase
    .from("salon_posts")
    .select(
      "id, image_path, video_path, instagram_mention_id, salon_post_images(image_path)",
    )
    .eq("id", args.postId)
    .eq("salon_id", args.salonId)
    .maybeSingle();

  if (loadError || !post) {
    throw new Error("Não foi possível localizar a publicação.");
  }

  const { error } = await args.supabase
    .from("salon_posts")
    .delete()
    .eq("id", args.postId)
    .eq("salon_id", args.salonId);

  if (error) {
    throw new Error("Não foi possível excluir a publicação.");
  }

  const imagePaths = Array.from(
    new Set(
      [
        post.image_path,
        post.video_path,
        ...(
          (post.salon_post_images as { image_path: string }[] | null) ?? []
        ).map((image) => image.image_path),
      ].filter(Boolean),
    ),
  );

  if (imagePaths.length) {
    await args.supabase.storage.from("salon-posts").remove(imagePaths);
  }

  if (post.instagram_mention_id) {
    await args.supabase
      .from("instagram_mentions")
      .update({
        moderation_note: "Removida do feed pelo painel.",
        moderation_status: "rejected",
        published_at: null,
        published_post_id: null,
      })
      .eq("id", post.instagram_mention_id)
      .eq("salon_id", args.salonId);

    revalidatePath(INSTAGRAM_PATH);
  }
}

export async function deleteSalonPostCommentActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const commentId = String(formData.get("commentId") ?? "");

  if (!commentId) {
    redirect(buildRedirectNotice(FEED_PATH, "Comentário inválido.", "error"));
  }

  const { data: comment, error: loadError } = await supabase
    .from("salon_post_comments")
    .select("id, post_id, salon_posts!inner(salon_id)")
    .eq("id", commentId)
    .eq("salon_posts.salon_id", salon.id)
    .maybeSingle();

  if (loadError || !comment) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Não foi possível localizar o comentário.",
        "error",
      ),
    );
  }

  const { error } = await supabase
    .from("salon_post_comments")
    .delete()
    .eq("id", commentId);

  if (error) {
    redirect(
      buildRedirectNotice(
        FEED_PATH,
        "Não foi possível excluir o comentário.",
        "error",
      ),
    );
  }

  revalidatePath(FEED_PATH);
  redirect(
    buildRedirectNotice(
      FEED_PATH,
      "Comentario removido com sucesso.",
      "success",
    ),
  );
}
