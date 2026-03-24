"use server";

import { Buffer } from "node:buffer";
import { randomUUID } from "node:crypto";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { decryptInstagramAccessToken, encryptInstagramAccessToken } from "@/lib/instagram-crypto";
import { syncInstagramActivity, type InstagramConnectionSyncRecord } from "@/lib/instagram-sync";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

const INSTAGRAM_PATH = "/dashboard/instagram";
const FEED_PATH = "/dashboard/feed";
const IMPORTED_FEED_ASSET_MAX_BYTES = 8 * 1024 * 1024;

type InstagramMentionRecord = {
  id: string;
  salon_id: string;
  source_type: "post_mention" | "story_mention" | "owned_post" | "comment_mention";
  media_type: "image" | "video" | "carousel" | "story" | "unknown";
  author_username: string | null;
  caption: string | null;
  permalink: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  moderation_status: "pending" | "approved" | "rejected" | "published";
  published_post_id: string | null;
};

function normalizeNonEmptyString(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function buildImportedAssetPath(salonId: string, url: string, fallbackExtension: string) {
  const pathname = new URL(url).pathname;
  const extension = pathname.includes(".")
    ? pathname.split(".").pop()?.toLowerCase() ?? fallbackExtension
    : fallbackExtension;

  return `${salonId}/instagram-${randomUUID()}.${extension}`;
}

function buildImportedPostTitle(mention: InstagramMentionRecord) {
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

async function loadMentionForOwner(salonId: string, mentionId: string) {
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from("instagram_mentions")
    .select(
      "id,salon_id,source_type,media_type,author_username,caption,permalink,media_url,thumbnail_url,moderation_status,published_post_id",
    )
    .eq("id", mentionId)
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error || !data) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível localizar essa menção.", "error"));
  }

  return data as InstagramMentionRecord;
}

async function loadInstagramConnectionForOwner(salonId: string) {
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from("instagram_connections")
    .select(
      "id,salon_id,instagram_user_id,instagram_username,access_token_ciphertext,require_mention_approval,import_story_mentions,auto_publish_owned_posts",
    )
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error || !data) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Conecte o Instagram do salao antes de sincronizar.", "error"));
  }

  return data as InstagramConnectionSyncRecord;
}

export async function saveInstagramConnectionActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  const instagramUserId = normalizeNonEmptyString(formData.get("instagramUserId"));
  const instagramUsername = normalizeNonEmptyString(formData.get("instagramUsername"));
  const facebookPageId = normalizeNonEmptyString(formData.get("facebookPageId"));
  const accessToken = normalizeNonEmptyString(formData.get("accessToken"));
  const autoPublishOwnedPosts = formData.get("autoPublishOwnedPosts") === "on";
  const requireMentionApproval = formData.get("requireMentionApproval") === "on";
  const importStoryMentions = formData.get("importStoryMentions") === "on";

  const { data: existingConnection } = await supabase
    .from("instagram_connections")
    .select("id, access_token_ciphertext")
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (!instagramUserId || !instagramUsername) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Informe o ID da conta profissional e o usuário do Instagram.", "error"));
  }

  if (!accessToken && !existingConnection?.access_token_ciphertext) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Informe um access token da conta para receber menções via API.", "error"));
  }

  const accessTokenCiphertext = accessToken
    ? encryptInstagramAccessToken(accessToken)
    : existingConnection.access_token_ciphertext;

  const { error } = await supabase
    .from("instagram_connections")
    .upsert(
      {
        salon_id: salon.id,
        instagram_user_id: instagramUserId,
        instagram_username: instagramUsername.replace(/^@/, ""),
        facebook_page_id: facebookPageId,
        access_token_ciphertext: accessTokenCiphertext,
        connection_status: "active",
        auto_publish_owned_posts: autoPublishOwnedPosts,
        require_mention_approval: requireMentionApproval,
        import_story_mentions: importStoryMentions,
        last_error: null,
      },
      { onConflict: "salon_id" },
    );

  if (error) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível salvar a conexão do Instagram.", "error"));
  }

  revalidatePath(INSTAGRAM_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Conexão do Instagram atualizada com sucesso.", "success"));
}

export async function disconnectInstagramConnectionActionImpl() {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;

  await supabase.from("instagram_connections").delete().eq("salon_id", salon.id);

  revalidatePath(INSTAGRAM_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Conexão do Instagram removida.", "success"));
}

export async function syncInstagramActivityActionImpl() {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const connection = await loadInstagramConnectionForOwner(salon.id);
  let noticeMessage = "";
  let noticeTone: "success" | "info" = "success";

  try {
    const result = await syncInstagramActivity({
      supabase,
      connection,
    });

    await supabase
      .from("instagram_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: result.warnings.length ? result.warnings.join(" | ").slice(0, 600) : null,
      })
      .eq("id", connection.id);

    revalidatePath(INSTAGRAM_PATH);

    const importedItems = result.mentionsUpserted + result.ownedPostsUpserted;
    if (result.warnings.length) {
      noticeMessage = `Sincronizacao concluida com alertas. ${importedItems} item(ns) atualizados.`;
      noticeTone = "info";
    } else {
      noticeMessage =
        importedItems > 0
          ? `Sincronizacao concluida. ${importedItems} item(ns) do Instagram foram atualizados.`
          : "Sincronizacao concluida. Nenhum conteudo novo foi encontrado agora.";
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : "Nao foi possivel sincronizar o Instagram agora.";
    await supabase
      .from("instagram_connections")
      .update({
        last_error: detail.slice(0, 600),
      })
      .eq("id", connection.id);

    redirect(buildRedirectNotice(INSTAGRAM_PATH, detail, "error"));
  }

  redirect(buildRedirectNotice(INSTAGRAM_PATH, noticeMessage, noticeTone));
}

export async function approveInstagramMentionActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const mentionId = normalizeNonEmptyString(formData.get("mentionId"));

  if (!mentionId) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Menção inválida.", "error"));
  }

  const { error } = await supabase
    .from("instagram_mentions")
    .update({
      moderation_status: "approved",
      approved_by_user_id: user.id,
      approved_at: new Date().toISOString(),
      moderation_note: null,
    })
    .eq("id", mentionId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível aprovar essa menção.", "error"));
  }

  revalidatePath(INSTAGRAM_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Menção aprovada. Agora ela já pode ser publicada no feed.", "success"));
}

export async function rejectInstagramMentionActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const mentionId = normalizeNonEmptyString(formData.get("mentionId"));

  if (!mentionId) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Menção inválida.", "error"));
  }

  const { error } = await supabase
    .from("instagram_mentions")
    .update({
      moderation_status: "rejected",
      moderation_note: "Rejeitada manualmente pelo painel.",
    })
    .eq("id", mentionId)
    .eq("salon_id", salon.id);

  if (error) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível rejeitar essa menção.", "error"));
  }

  revalidatePath(INSTAGRAM_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Menção rejeitada com sucesso.", "success"));
}

export async function publishInstagramMentionActionImpl(formData: FormData) {
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const mentionId = normalizeNonEmptyString(formData.get("mentionId"));

  if (!mentionId) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Menção inválida.", "error"));
  }

  const mention = await loadMentionForOwner(salon.id, mentionId);

  if (mention.published_post_id) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Essa menção já foi publicada no feed do app.", "info"));
  }

  if (mention.moderation_status === "rejected") {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Essa menção foi rejeitada e precisa ser aprovada antes de publicar.", "error"));
  }

  const assetUrl = mention.media_url ?? mention.thumbnail_url;
  if (!assetUrl) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "A menção não trouxe uma mídia válida para publicar no app.", "error"));
  }

  const assetResponse = await fetch(assetUrl);
  if (!assetResponse.ok) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível baixar a mídia da publicação marcada.", "error"));
  }

  const bytes = Buffer.from(await assetResponse.arrayBuffer());
  if (bytes.byteLength > IMPORTED_FEED_ASSET_MAX_BYTES) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "A mídia marcada no Instagram é grande demais para importar no feed.", "error"));
  }

  const contentType = assetResponse.headers.get("content-type")?.trim() || "image/jpeg";
  const uploadPath = buildImportedAssetPath(
    salon.id,
    assetUrl,
    contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg",
  );

  const { error: uploadError } = await supabase.storage
    .from("salon-posts")
    .upload(uploadPath, bytes, {
      contentType,
      upsert: false,
    });

  if (uploadError) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível importar a mídia para o storage do app.", "error"));
  }

  const postTitle = buildImportedPostTitle(mention);
  const postCaption = mention.caption?.trim() || mention.permalink || null;
  const sourceType = mention.source_type === "owned_post" ? "instagram_owned_post" : "instagram_mention";

  const { data: createdPost, error: postError } = await supabase
    .from("salon_posts")
    .insert({
      salon_id: salon.id,
      title: postTitle,
      caption: postCaption,
      image_path: uploadPath,
      post_type: "standard",
      created_by_user_id: user.id,
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
    await supabase.storage.from("salon-posts").remove([uploadPath]);
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível transformar a menção em post do feed.", "error"));
  }

  const { error: galleryError } = await supabase.from("salon_post_images").insert([
    {
      post_id: createdPost.id,
      image_path: uploadPath,
      sort_order: 0,
    },
  ]);

  if (galleryError) {
    await supabase.from("salon_posts").delete().eq("id", createdPost.id);
    await supabase.storage.from("salon-posts").remove([uploadPath]);
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Não foi possível salvar a mídia importada no feed.", "error"));
  }

  const { error: mentionUpdateError } = await supabase
    .from("instagram_mentions")
    .update({
      moderation_status: "published",
      approved_by_user_id: user.id,
      approved_at: new Date().toISOString(),
      published_post_id: createdPost.id,
      published_at: new Date().toISOString(),
      moderation_note: "Publicada no feed do app.",
    })
    .eq("id", mention.id)
    .eq("salon_id", salon.id);

  if (mentionUpdateError) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "A menção virou post, mas o status não pôde ser sincronizado. Revise o painel.", "error"));
  }

  revalidatePath(INSTAGRAM_PATH);
  revalidatePath(FEED_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Menção publicada no feed do app com sucesso.", "success"));
}

export async function validateInstagramConnectionTokenActionImpl(formData: FormData) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient() as any;
  const { data: connection } = await supabase
    .from("instagram_connections")
    .select("id, access_token_ciphertext, facebook_page_id, instagram_user_id, instagram_username")
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (!connection?.access_token_ciphertext) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Salve a conexão antes de validar o token do Instagram.", "error"));
  }

  try {
    const token = decryptInstagramAccessToken(connection.access_token_ciphertext);
    const validationUrl = connection.facebook_page_id
      ? `https://graph.facebook.com/v23.0/${encodeURIComponent(connection.facebook_page_id)}?fields=instagram_business_account{id,username}&access_token=${encodeURIComponent(token)}`
      : `https://graph.facebook.com/v23.0/me/accounts?fields=id&access_token=${encodeURIComponent(token)}`;
    const response = await fetch(validationUrl);

    if (!response.ok) {
      const detail = await response.text();
      await supabase
        .from("instagram_connections")
        .update({
          connection_status: "error",
          last_error: detail.slice(0, 600),
        })
        .eq("id", connection.id);

      return redirect(buildRedirectNotice(INSTAGRAM_PATH, "O token não pôde ser validado na API da Meta.", "error"));
    }

    const payload = await response.json();

    if (connection.facebook_page_id) {
      const connectedInstagramAccount = payload?.instagram_business_account;

      if (!connectedInstagramAccount?.id) {
        await supabase
          .from("instagram_connections")
          .update({
            connection_status: "error",
            last_error: "A página conectada não retornou uma conta profissional do Instagram.",
          })
          .eq("id", connection.id);

        return redirect(
          buildRedirectNotice(
            INSTAGRAM_PATH,
            "A página conectada não retornou uma conta profissional do Instagram válida.",
            "error",
          ),
        );
      }

      if (
        connection.instagram_user_id &&
        String(connectedInstagramAccount.id) !== String(connection.instagram_user_id)
      ) {
        await supabase
          .from("instagram_connections")
          .update({
            connection_status: "error",
            last_error: "O Instagram retornado pela página não corresponde ao ID salvo no painel.",
          })
          .eq("id", connection.id);

        return redirect(
          buildRedirectNotice(
            INSTAGRAM_PATH,
            "A página conectada retornou um Instagram diferente do configurado no painel.",
            "error",
          ),
        );
      }

      if (
        connection.instagram_username &&
        connectedInstagramAccount.username &&
        connectedInstagramAccount.username.toLowerCase() !== connection.instagram_username.toLowerCase()
      ) {
        await supabase
          .from("instagram_connections")
          .update({
            connection_status: "error",
            last_error: "O nome de usuário retornado pela Meta não corresponde ao configurado no painel.",
          })
          .eq("id", connection.id);

        return redirect(
          buildRedirectNotice(
            INSTAGRAM_PATH,
            "O usuário retornado pela Meta não corresponde ao configurado no painel.",
            "error",
          ),
        );
      }
    } else {
      const connectedPages = Array.isArray(payload?.data) ? payload.data : [];

      if (connectedPages.length === 0) {
        await supabase
          .from("instagram_connections")
          .update({
            connection_status: "error",
            last_error: "O token foi aceito, mas não encontrou páginas disponíveis para essa conta.",
          })
          .eq("id", connection.id);

        return redirect(
          buildRedirectNotice(
            INSTAGRAM_PATH,
            "O token foi aceito, mas nenhuma página foi encontrada para essa conta.",
            "error",
          ),
        );
      }
    }

    await supabase
      .from("instagram_connections")
      .update({
        connection_status: "active",
        last_sync_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", connection.id);
  } catch (error) {
    return redirect(
      buildRedirectNotice(
        INSTAGRAM_PATH,
        error instanceof Error ? error.message : "Não foi possível validar o token do Instagram.",
        "error",
      ),
    );
  }

  revalidatePath(INSTAGRAM_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Token validado com sucesso na API da Meta.", "success"));
}
