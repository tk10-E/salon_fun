import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

const IMPORTED_FEED_ASSET_MAX_BYTES = 25 * 1024 * 1024;

type InstagramMentionMediaType = "image" | "video" | "carousel" | "story" | "unknown";

export type InstagramFeedImportMention = {
  id: string;
  salon_id: string;
  source_type: "post_mention" | "story_mention" | "owned_post" | "comment_mention";
  media_type: InstagramMentionMediaType;
  author_username: string | null;
  caption: string | null;
  permalink: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  moderation_status: "pending" | "approved" | "rejected" | "published";
  published_post_id: string | null;
};

type ImportedAsset = {
  contentType: string;
  bytes: Buffer;
  sourceUrl: string;
};

function buildImportedAssetPath(salonId: string, url: string, fallbackExtension: string, prefix = "instagram") {
  const pathname = new URL(url).pathname;
  const extension = pathname.includes(".")
    ? pathname.split(".").pop()?.toLowerCase() ?? fallbackExtension
    : fallbackExtension;

  return `${salonId}/${prefix}-${randomUUID()}.${extension}`;
}

function buildImportedPostTitle(mention: InstagramFeedImportMention) {
  if (mention.source_type === "owned_post") {
    return mention.author_username
      ? `Instagram do salão • @${mention.author_username}`
      : "Instagram do salão";
  }

  if (mention.source_type === "story_mention") {
    return mention.author_username
      ? `Story marcando o salão • @${mention.author_username}`
      : "Story marcando o salão";
  }

  return mention.author_username
    ? `Cliente marcou o salão • @${mention.author_username}`
    : "Cliente marcou o salão";
}

async function downloadImportedAsset(url: string, fallbackContentType: string) {
  const assetResponse = await fetch(url);
  if (!assetResponse.ok) {
    throw new Error("Não foi possível baixar a mídia da publicação marcada.");
  }

  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  if (bytes.byteLength > IMPORTED_FEED_ASSET_MAX_BYTES) {
    throw new Error("A mídia marcada no Instagram é grande demais para importar no feed.");
  }

  return {
    bytes,
    contentType: assetResponse.headers.get("content-type")?.trim() || fallbackContentType,
    sourceUrl: url,
  } satisfies ImportedAsset;
}

async function uploadImportedAsset(args: {
  supabase: any;
  salonId: string;
  asset: ImportedAsset;
  prefix: string;
}) {
  const fallbackExtension = args.asset.contentType.includes("png")
    ? "png"
    : args.asset.contentType.includes("webp")
    ? "webp"
    : args.asset.contentType.includes("mp4")
    ? "mp4"
    : args.asset.contentType.includes("quicktime")
    ? "mov"
    : "jpg";
  const uploadPath = buildImportedAssetPath(args.salonId, args.asset.sourceUrl, fallbackExtension, args.prefix);

  const { error: uploadError } = await args.supabase.storage
    .from("salon-posts")
    .upload(uploadPath, args.asset.bytes, {
      contentType: args.asset.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error("Não foi possível importar a mídia para o storage do app.");
  }

  return uploadPath;
}

async function removeUploadedAssets(supabase: any, uploadedPaths: string[]) {
  if (!uploadedPaths.length) {
    return;
  }

  await supabase.storage.from("salon-posts").remove(uploadedPaths);
}

export async function importInstagramMentionIntoFeed(args: {
  supabase: any;
  salonId: string;
  ownerUserId: string;
  mention: InstagramFeedImportMention;
}) {
  const { mention, salonId, supabase, ownerUserId } = args;

  if (mention.published_post_id) {
    return {
      postId: mention.published_post_id,
      created: false,
    };
  }

  const isVideo = mention.media_type === "video";
  const uploadedPaths: string[] = [];

  try {
    if (isVideo && !mention.thumbnail_url) {
      throw new Error("O vídeo do Instagram não trouxe uma capa válida para o feed.");
    }

    const coverAssetUrl = mention.thumbnail_url ?? mention.media_url;
    if (!coverAssetUrl) {
      throw new Error("A menção não trouxe uma mídia válida para publicar no app.");
    }

    const coverAsset = await downloadImportedAsset(coverAssetUrl, "image/jpeg");
    const coverPath = await uploadImportedAsset({
      supabase,
      salonId,
      asset: coverAsset,
      prefix: "instagram-cover",
    });
    uploadedPaths.push(coverPath);

    let postType: "standard" | "reel" = "standard";
    let videoPath: string | null = null;

    if (isVideo && mention.media_url) {
      const videoAsset = await downloadImportedAsset(mention.media_url, "video/mp4");
      videoPath = await uploadImportedAsset({
        supabase,
        salonId,
        asset: videoAsset,
        prefix: "instagram-video",
      });
      uploadedPaths.push(videoPath);
      postType = "reel";
    }

    const postTitle = buildImportedPostTitle(mention);
    const postCaption = mention.caption?.trim() || mention.permalink || null;
    const sourceType = mention.source_type === "owned_post" ? "instagram_owned_post" : "instagram_mention";

    const { data: createdPost, error: postError } = await supabase
      .from("salon_posts")
      .insert({
        salon_id: salonId,
        title: postTitle,
        caption: postCaption,
        image_path: coverPath,
        post_type: postType,
        video_path: videoPath,
        created_by_user_id: ownerUserId,
        source_type: sourceType,
        instagram_mention_id: mention.id,
        external_permalink: mention.permalink,
        external_author_username: mention.author_username,
        external_media_url: mention.media_url,
        external_thumbnail_url: mention.thumbnail_url,
      })
      .select("id")
      .single();

    if (postError || !createdPost) {
      throw new Error("Não foi possível transformar a menção em post do feed.");
    }

    const { error: galleryError } = await supabase.from("salon_post_images").insert([
      {
        post_id: createdPost.id,
        image_path: coverPath,
        sort_order: 0,
      },
    ]);

    if (galleryError) {
      await supabase.from("salon_posts").delete().eq("id", createdPost.id);
      throw new Error("Não foi possível salvar a mídia importada no feed.");
    }

    const now = new Date().toISOString();
    const { error: mentionUpdateError } = await supabase
      .from("instagram_mentions")
      .update({
        moderation_status: "published",
        approved_by_user_id: ownerUserId,
        approved_at: now,
        published_post_id: createdPost.id,
        published_at: now,
        moderation_note: "Publicada automaticamente no feed do app.",
      })
      .eq("id", mention.id)
      .eq("salon_id", salonId);

    if (mentionUpdateError) {
      throw new Error("A menção virou post, mas o status não pôde ser sincronizado. Revise o painel.");
    }

    return {
      postId: createdPost.id,
      created: true,
    };
  } catch (error) {
    await removeUploadedAssets(supabase, uploadedPaths);
    throw error;
  }
}

export async function autoPublishInstagramMentions(args: {
  supabase: any;
  salonId: string;
  ownerUserId: string;
}) {
  const { data, error } = await args.supabase
    .from("instagram_mentions")
    .select(
      "id,salon_id,source_type,media_type,author_username,caption,permalink,media_url,thumbnail_url,moderation_status,published_post_id",
    )
    .eq("salon_id", args.salonId)
    .is("published_post_id", null)
    .order("mentioned_at", { ascending: false, nullsFirst: false })
    .limit(24);

  if (error) {
    throw error;
  }

  const mentions = ((data ?? []) as InstagramFeedImportMention[]).filter(
    (mention) => mention.moderation_status !== "rejected",
  );
  let publishedCount = 0;
  const warnings: string[] = [];

  for (const mention of mentions) {
    try {
      const result = await importInstagramMentionIntoFeed({
        supabase: args.supabase,
        salonId: args.salonId,
        ownerUserId: args.ownerUserId,
        mention,
      });

      if (result.created) {
        publishedCount += 1;
      }
    } catch (error) {
      warnings.push(error instanceof Error ? error.message : String(error));
    }
  }

  return {
    publishedCount,
    warnings,
  };
}
