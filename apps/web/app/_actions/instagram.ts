"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { requireOwnerSalon } from "@/lib/auth";
import { autoPublishInstagramMentions, importInstagramMentionIntoFeed } from "@/lib/instagram-feed-import";
import { decryptInstagramAccessToken, encryptInstagramAccessToken } from "@/lib/instagram-crypto";
import {
  loadMetaPageAccessToken,
  syncInstagramActivity,
  type InstagramConnectionSyncRecord,
} from "@/lib/instagram-sync";
import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

const INSTAGRAM_PATH = "/dashboard/instagram";
const FEED_PATH = "/dashboard/feed";

type InstagramMentionRecord = {
  id: string;
  salon_id: string;
  platform: "instagram" | "facebook";
  source_type: "post_mention" | "story_mention" | "owned_post" | "comment_mention";
  media_type: "image" | "video" | "carousel" | "story" | "unknown";
  author_profile_picture_url: string | null;
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

async function loadMentionForOwner(salonId: string, mentionId: string) {
  const supabase = createClient() as any;
  const { data, error } = await supabase
    .from("instagram_mentions")
    .select(
      "id,salon_id,platform,source_type,media_type,author_profile_picture_url,author_username,caption,permalink,media_url,thumbnail_url,moderation_status,published_post_id",
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
      "id,salon_id,instagram_user_id,instagram_username,profile_picture_url,facebook_page_id,facebook_page_name,facebook_page_access_token_ciphertext,access_token_ciphertext,require_mention_approval,import_story_mentions,auto_publish_owned_posts",
    )
    .eq("salon_id", salonId)
    .maybeSingle();

  if (error || !data) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Conecte o Instagram do salao antes de atualizar.", "error"));
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
    .select("id, access_token_ciphertext, facebook_page_name, facebook_page_access_token_ciphertext, profile_picture_url")
    .eq("salon_id", salon.id)
    .maybeSingle();

  if (!instagramUserId || !instagramUsername) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Informe o ID da conta profissional e o usuário do Instagram.", "error"));
  }

  if (!accessToken && !existingConnection?.access_token_ciphertext) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Conclua a conexao do Instagram para comecar a receber marcacoes.", "error"));
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
        facebook_page_name: existingConnection?.facebook_page_name ?? null,
        facebook_page_access_token_ciphertext:
          existingConnection?.facebook_page_access_token_ciphertext ?? null,
        profile_picture_url: existingConnection?.profile_picture_url ?? null,
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
  const { salon, user } = await requireOwnerSalon();
  const supabase = createClient() as any;
  let connection = await loadInstagramConnectionForOwner(salon.id);
  let noticeMessage = "";
  let noticeTone: "success" | "info" = "success";

  try {
    if (!connection.facebook_page_access_token_ciphertext && connection.facebook_page_id) {
      const userAccessToken = decryptInstagramAccessToken(connection.access_token_ciphertext);
      const refreshedPageAccessToken = await loadMetaPageAccessToken({
        userAccessToken,
        pageId: connection.facebook_page_id,
      });

      if (refreshedPageAccessToken) {
        const refreshedCiphertext = encryptInstagramAccessToken(refreshedPageAccessToken);

        await supabase
          .from("instagram_connections")
          .update({
            facebook_page_access_token_ciphertext: refreshedCiphertext,
            last_error: null,
          })
          .eq("id", connection.id);

        connection = {
          ...connection,
          facebook_page_access_token_ciphertext: refreshedCiphertext,
        };
      }
    }

    const result = await syncInstagramActivity({
      supabase,
      connection,
    });
    const combinedWarnings = [...result.warnings];

    await supabase
      .from("instagram_connections")
      .update({
        last_sync_at: new Date().toISOString(),
        last_error: result.warnings.length ? result.warnings.join(" | ").slice(0, 600) : null,
      })
      .eq("id", connection.id);

    revalidatePath(INSTAGRAM_PATH);

    const importedItems = result.mentionsUpserted + result.ownedPostsUpserted;
    const autoPublishResult = await autoPublishInstagramMentions({
      supabase,
      salonId: salon.id,
      ownerUserId: user.id,
    });

    if (autoPublishResult.warnings.length) {
      combinedWarnings.push(...autoPublishResult.warnings);
      await supabase
        .from("instagram_connections")
        .update({
          last_error: combinedWarnings.join(" | ").slice(0, 600),
        })
        .eq("id", connection.id);
    }

    if (autoPublishResult.publishedCount > 0) {
      revalidatePath(FEED_PATH);
    }

    if (combinedWarnings.length) {
      noticeMessage = `Atualizacao concluida com avisos. ${importedItems} item(ns) atualizados e ${autoPublishResult.publishedCount} publicado(s) no feed.`;
      noticeTone = "info";
    } else {
      noticeMessage =
        importedItems > 0
          ? `Atualizacao concluida. ${importedItems} item(ns) foram atualizados e ${autoPublishResult.publishedCount} publicado(s) no feed.`
          : "Atualizacao concluida. Nenhum conteudo novo foi encontrado agora.";
    }
  } catch (error) {
    const detail = "Nao foi possivel atualizar o Instagram agora.";
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

  const mention = await loadMentionForOwner(salon.id, mentionId);

  if (mention.published_post_id) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Essa menção já foi publicada no feed do app.", "info"));
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

  const mention = await loadMentionForOwner(salon.id, mentionId);

  if (mention.published_post_id) {
    redirect(buildRedirectNotice(INSTAGRAM_PATH, "Essa menção já foi publicada no feed do app.", "info"));
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

  try {
    await importInstagramMentionIntoFeed({
      supabase,
      salonId: salon.id,
      ownerUserId: user.id,
      mention,
    });
  } catch (error) {
    redirect(
      buildRedirectNotice(
        INSTAGRAM_PATH,
        error instanceof Error ? error.message : "Não foi possível transformar a menção em post do feed.",
        "error",
      ),
    );
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

      return redirect(buildRedirectNotice(INSTAGRAM_PATH, "Nao foi possivel confirmar a conexao do Instagram.", "error"));
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
        "Nao foi possivel confirmar a conexao do Instagram.",
        "error",
      ),
    );
  }

  revalidatePath(INSTAGRAM_PATH);
  redirect(buildRedirectNotice(INSTAGRAM_PATH, "Conexao verificada com sucesso.", "success"));
}
