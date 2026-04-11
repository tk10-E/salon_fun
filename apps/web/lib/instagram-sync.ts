import { createHash } from "node:crypto";

import { decryptInstagramAccessToken } from "@/lib/instagram-crypto";
import {
  INSTAGRAM_META_GRAPH_VERSION,
  type InstagramMetaPageAccount,
} from "@/lib/instagram-oauth";

const graphApiBaseUrl =
  process.env.INSTAGRAM_GRAPH_API_BASE_URL?.trim() ||
  `https://graph.facebook.com/${INSTAGRAM_META_GRAPH_VERSION}`;
const defaultInstagramMediaFields =
  "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username";
const defaultFacebookPostFields =
  "id,message,story,permalink_url,created_time,from{id,name},full_picture,attachments{media,media_type,type,url,subattachments}";

type MetaPlatform = "instagram" | "facebook";
type MentionSourceType =
  | "owned_post"
  | "post_mention"
  | "story_mention"
  | "comment_mention";
type MentionMediaType = "image" | "video" | "carousel" | "story" | "unknown";

export type InstagramConnectionSyncRecord = {
  id: string;
  salon_id: string;
  instagram_user_id: string;
  instagram_username: string;
  profile_picture_url: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  facebook_page_access_token_ciphertext: string | null;
  access_token_ciphertext: string;
  require_mention_approval: boolean;
  import_story_mentions: boolean;
  auto_publish_owned_posts: boolean;
};

type GraphCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

type MetaMediaNode = {
  platform: MetaPlatform;
  id: string;
  caption: string | null;
  media_type: MentionMediaType;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  username: string | null;
};

export type InstagramMetaProfile = {
  id: string;
  username: string | null;
  profilePictureUrl: string | null;
};

type FacebookAttachmentMediaSummary = {
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: MentionMediaType;
};

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function extractMetaErrorMessage(value: unknown) {
  const rawMessage =
    value instanceof Error ? value.message : normalizeNonEmptyString(String(value));

  if (!rawMessage) {
    return "A Meta nao retornou detalhes do erro.";
  }

  try {
    const payload = JSON.parse(rawMessage) as {
      error?: {
        message?: unknown;
      };
    };
    const apiMessage = normalizeNonEmptyString(payload?.error?.message);

    if (apiMessage) {
      return apiMessage;
    }
  } catch {}

  return rawMessage.replace(/\s+/g, " ").trim();
}

function buildFacebookFeedWarning(value: unknown) {
  const detail = extractMetaErrorMessage(value);
  const normalizedDetail = detail.toLowerCase();

  if (
    normalizedDetail.includes("pages_read_engagement") ||
    normalizedDetail.includes("page public content access")
  ) {
    return "O Instagram segue funcionando normalmente. So a leitura das publicacoes da pagina do salao esta limitada neste momento.";
  }

  return "Nao foi possivel atualizar as publicacoes da pagina do salao agora.";
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function mapMediaType(rawType: string | null): MentionMediaType {
  switch ((rawType ?? "").toUpperCase()) {
    case "IMAGE":
    case "PHOTO":
      return "image";
    case "VIDEO":
    case "REEL":
      return "video";
    case "CAROUSEL_ALBUM":
      return "carousel";
    case "STORY":
      return "story";
    default:
      return "unknown";
  }
}

function buildModerationStatus(
  connection: InstagramConnectionSyncRecord,
  sourceType: MentionSourceType,
) {
  if (sourceType === "owned_post" && connection.auto_publish_owned_posts) {
    return "approved";
  }

  return connection.require_mention_approval ? "pending" : "approved";
}

function isMetaMediaNode(value: MetaMediaNode | null): value is MetaMediaNode {
  return value !== null;
}

function collectFacebookAttachmentNodes(
  value: unknown,
): Array<Record<string, unknown>> {
  if (!value || typeof value !== "object") {
    return [];
  }

  const attachment = value as Record<string, unknown>;
  const directNodes = Array.isArray(attachment.data)
    ? attachment.data.filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
    : [];

  const nestedNodes = directNodes.flatMap((node) =>
    collectFacebookAttachmentNodes(node.subattachments),
  );

  return [...directNodes, ...nestedNodes];
}

function summarizeFacebookAttachments(
  value: unknown,
): FacebookAttachmentMediaSummary {
  const attachmentNodes = collectFacebookAttachmentNodes(value);
  let fallbackImageUrl: string | null = null;
  let fallbackThumbnailUrl: string | null = null;

  for (const node of attachmentNodes) {
    const media = (node.media ?? {}) as Record<string, unknown>;
    const imageNode = (media.image ?? {}) as Record<string, unknown>;
    const imageUrl =
      normalizeNonEmptyString(imageNode.src) ||
      normalizeNonEmptyString(node.url) ||
      normalizeNonEmptyString(media.source);
    const sourceUrl = normalizeNonEmptyString(media.source);
    const rawType =
      normalizeNonEmptyString(node.media_type) ||
      normalizeNonEmptyString(node.type);
    const normalizedType = mapMediaType(rawType);

    fallbackImageUrl ??= imageUrl;
    fallbackThumbnailUrl ??= imageUrl;

    if (normalizedType === "video" && sourceUrl) {
      return {
        mediaUrl: sourceUrl,
        thumbnailUrl: imageUrl ?? sourceUrl,
        mediaType: "video",
      };
    }

    if (imageUrl) {
      return {
        mediaUrl: imageUrl,
        thumbnailUrl: imageUrl,
        mediaType: normalizedType === "unknown" ? "image" : normalizedType,
      };
    }
  }

  if (fallbackImageUrl) {
    return {
      mediaUrl: fallbackImageUrl,
      thumbnailUrl: fallbackThumbnailUrl ?? fallbackImageUrl,
      mediaType: "image",
    };
  }

  return {
    mediaUrl: null,
    thumbnailUrl: null,
    mediaType: "unknown",
  };
}

function mapInstagramMediaNode(
  node: Record<string, unknown>,
): MetaMediaNode | null {
  const id = normalizeNonEmptyString(node.id);

  if (!id) {
    return null;
  }

  return {
    platform: "instagram",
    id,
    caption: normalizeNonEmptyString(node.caption),
    media_type: mapMediaType(normalizeNonEmptyString(node.media_type)),
    media_url: normalizeNonEmptyString(node.media_url),
    thumbnail_url: normalizeNonEmptyString(node.thumbnail_url),
    permalink: normalizeNonEmptyString(node.permalink),
    timestamp: normalizeNonEmptyString(node.timestamp),
    username: normalizeNonEmptyString(node.username),
  };
}

function mapFacebookPostNode(
  node: Record<string, unknown>,
): MetaMediaNode | null {
  const id = normalizeNonEmptyString(node.id);

  if (!id) {
    return null;
  }

  const fromNode = (node.from ?? {}) as Record<string, unknown>;
  const attachmentSummary = summarizeFacebookAttachments(node.attachments);
  const fallbackPreview = normalizeNonEmptyString(node.full_picture);
  const mediaUrl = attachmentSummary.mediaUrl ?? fallbackPreview;
  const thumbnailUrl =
    attachmentSummary.thumbnailUrl ?? fallbackPreview ?? mediaUrl;

  return {
    platform: "facebook",
    id,
    caption:
      normalizeNonEmptyString(node.message) ||
      normalizeNonEmptyString(node.story),
    media_type:
      attachmentSummary.mediaType === "unknown" && mediaUrl
        ? "image"
        : attachmentSummary.mediaType,
    media_url: mediaUrl,
    thumbnail_url: thumbnailUrl,
    permalink: normalizeNonEmptyString(node.permalink_url),
    timestamp: normalizeNonEmptyString(node.created_time),
    username:
      normalizeNonEmptyString(fromNode.name) ||
      normalizeNonEmptyString(fromNode.id),
  };
}

function isFacebookMentionNode(node: Record<string, unknown>, pageId: string) {
  const fromNode = (node.from ?? {}) as Record<string, unknown>;
  const authorId = normalizeNonEmptyString(fromNode.id);

  return Boolean(authorId && authorId !== pageId);
}

async function fetchGraphCollection(args: {
  path: string;
  accessToken: string;
  fields: string;
  limit?: number;
}) {
  const url = new URL(`${graphApiBaseUrl}/${args.path.replace(/^\/+/, "")}`);
  url.searchParams.set("fields", args.fields);
  url.searchParams.set("limit", String(args.limit ?? 12));
  url.searchParams.set("access_token", args.accessToken);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as GraphCollectionResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchInstagramCollection(args: {
  path: string;
  accessToken: string;
  limit?: number;
}) {
  return fetchGraphCollection({
    path: args.path,
    accessToken: args.accessToken,
    fields: defaultInstagramMediaFields,
    limit: args.limit,
  });
}

async function fetchFacebookCollection(args: {
  path: string;
  accessToken: string;
  limit?: number;
}) {
  return fetchGraphCollection({
    path: args.path,
    accessToken: args.accessToken,
    fields: defaultFacebookPostFields,
    limit: args.limit,
  });
}

async function upsertMetaMedia(args: {
  supabase: any;
  connection: InstagramConnectionSyncRecord;
  items: MetaMediaNode[];
  sourceType: MentionSourceType;
}) {
  const baseRows = args.items.map((item) => ({
    salon_id: args.connection.salon_id,
    instagram_connection_id: args.connection.id,
    dedupe_key: sha256Hex(
      JSON.stringify({
        salonId: args.connection.salon_id,
        platform: item.platform,
        sourceType: args.sourceType,
        externalMediaId: item.id,
        permalink: item.permalink,
        authorUsername: item.username,
        mentionedAt: item.timestamp,
      }),
    ),
    platform: item.platform,
    external_media_id: item.id,
    source_type: args.sourceType,
    media_type: item.media_type,
    author_username:
      item.username ??
      (item.platform === "instagram"
        ? args.connection.instagram_username
        : args.connection.facebook_page_name),
    author_profile_picture_url:
      item.platform === "instagram" && args.sourceType === "owned_post"
        ? args.connection.profile_picture_url
        : null,
    caption: item.caption,
    permalink: item.permalink,
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url,
    mentioned_at: item.timestamp,
    moderation_status: buildModerationStatus(args.connection, args.sourceType),
  }));

  if (!baseRows.length) {
    return 0;
  }

  const dedupeKeys = baseRows.map((row) => row.dedupe_key);
  const { data: existingMentions, error: existingMentionsError } =
    await args.supabase
      .from("instagram_mentions")
      .select("dedupe_key,moderation_status,published_post_id")
      .eq("salon_id", args.connection.salon_id)
      .in("dedupe_key", dedupeKeys);

  if (existingMentionsError) {
    throw existingMentionsError;
  }

  const existingMentionsByKey = new Map(
    (
      (existingMentions ?? []) as Array<{
        dedupe_key: string;
        moderation_status: "pending" | "approved" | "rejected" | "published";
        published_post_id: string | null;
      }>
    ).map((mention) => [mention.dedupe_key, mention]),
  );

  const rows = baseRows.map((row) => {
    const existingMention = existingMentionsByKey.get(row.dedupe_key);

    if (!existingMention) {
      return row;
    }

    return {
      ...row,
      moderation_status: existingMention.published_post_id
        ? "published"
        : existingMention.moderation_status,
    };
  });

  const { error } = await args.supabase
    .from("instagram_mentions")
    .upsert(rows, { onConflict: "dedupe_key" });

  if (error) {
    throw error;
  }

  return rows.length;
}

export async function loadMetaAccounts(accessToken: string) {
  const rows = await fetchGraphCollection({
    path: "me/accounts",
    accessToken,
    fields:
      "id,name,access_token,instagram_business_account{id,username,profile_picture_url}",
    limit: 25,
  });

  return rows as InstagramMetaPageAccount[];
}

export async function loadMetaInstagramProfile(args: {
  accessToken: string;
  instagramUserId: string;
}) {
  const url = new URL(
    `${graphApiBaseUrl}/${args.instagramUserId.replace(/^\/+/, "")}`,
  );
  url.searchParams.set("fields", "id,username,profile_picture_url");
  url.searchParams.set("access_token", args.accessToken);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as Record<string, unknown>;
  const id = normalizeNonEmptyString(payload.id);

  if (!id) {
    throw new Error("A Meta nao retornou um perfil valido do Instagram.");
  }

  return {
    id,
    username: normalizeNonEmptyString(payload.username),
    profilePictureUrl: normalizeNonEmptyString(payload.profile_picture_url),
  } satisfies InstagramMetaProfile;
}

export async function loadMetaPageAccessToken(args: {
  userAccessToken: string;
  pageId: string;
}) {
  const rows = await loadMetaAccounts(args.userAccessToken);
  const matchingPage = rows.find(
    (row) => normalizeNonEmptyString(row.id) === args.pageId,
  );

  return normalizeNonEmptyString(matchingPage?.access_token);
}

export async function subscribeMetaPageToWebhook(args: {
  pageId: string;
  pageAccessToken: string;
}) {
  const url = new URL(`${graphApiBaseUrl}/${args.pageId}/subscribed_apps`);

  const requestBody = new URLSearchParams();
  requestBody.set("access_token", args.pageAccessToken);
  requestBody.set("subscribed_fields", "feed");

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
  });

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function syncInstagramActivity(args: {
  supabase: any;
  connection: InstagramConnectionSyncRecord;
}) {
  const accessToken = decryptInstagramAccessToken(
    args.connection.access_token_ciphertext,
  );
  let connection = args.connection;
  const facebookAccessToken = args.connection
    .facebook_page_access_token_ciphertext
    ? decryptInstagramAccessToken(
        args.connection.facebook_page_access_token_ciphertext,
      )
    : accessToken;
  const warnings: string[] = [];
  let resolvedProfilePictureUrl = normalizeNonEmptyString(
    connection.profile_picture_url,
  );

  if ((connection.profile_picture_url ?? "").trim().length === 0) {
    try {
      const instagramProfile = await loadMetaInstagramProfile({
        accessToken,
        instagramUserId: connection.instagram_user_id,
      });
      const resolvedUsername =
        instagramProfile.username?.replace(/^@/, "") ??
        connection.instagram_username;
      resolvedProfilePictureUrl = instagramProfile.profilePictureUrl;

      if (
        resolvedUsername !== connection.instagram_username ||
        resolvedProfilePictureUrl !== connection.profile_picture_url
      ) {
        await args.supabase
          .from("instagram_connections")
          .update({
            instagram_username: resolvedUsername,
            profile_picture_url: resolvedProfilePictureUrl,
            last_error: null,
          })
          .eq("id", connection.id);

        connection = {
          ...connection,
          instagram_username: resolvedUsername,
          profile_picture_url: resolvedProfilePictureUrl,
        };
      }
    } catch (error) {
      warnings.push(
        `Nao foi possivel atualizar a foto do perfil do Instagram: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  if ((resolvedProfilePictureUrl ?? "").trim().length > 0) {
    await args.supabase
      .from("instagram_mentions")
      .update({
        author_profile_picture_url: resolvedProfilePictureUrl,
      })
      .eq("instagram_connection_id", connection.id)
      .eq("source_type", "owned_post");

    await args.supabase
      .from("salon_posts")
      .update({
        external_author_avatar_url: resolvedProfilePictureUrl,
      })
      .eq("salon_id", connection.salon_id)
      .eq("source_type", "instagram_owned_post")
      .eq("external_platform", "instagram");
  }

  const [
    ownedPostsResult,
    mentionsResult,
    facebookOwnedPostsResult,
    facebookTaggedPostsResult,
  ] = await Promise.allSettled([
    fetchInstagramCollection({
      path: `${args.connection.instagram_user_id}/media`,
      accessToken,
    }),
    fetchInstagramCollection({
      path: `${args.connection.instagram_user_id}/tags`,
      accessToken,
    }),
    args.connection.facebook_page_id
      ? fetchFacebookCollection({
          path: `${args.connection.facebook_page_id}/posts`,
          accessToken: facebookAccessToken,
        })
      : Promise.resolve([]),
    args.connection.facebook_page_id
      ? fetchFacebookCollection({
          path: `${args.connection.facebook_page_id}/feed`,
          accessToken: facebookAccessToken,
        })
      : Promise.resolve([]),
  ]);

  const instagramOwnedPosts =
    ownedPostsResult.status === "fulfilled"
      ? ownedPostsResult.value
          .map(mapInstagramMediaNode)
          .filter(isMetaMediaNode)
      : [];
  if (ownedPostsResult.status === "rejected") {
    warnings.push("Nao foi possivel atualizar os posts do Instagram agora.");
  }

  const instagramMentions =
    mentionsResult.status === "fulfilled"
      ? mentionsResult.value.map(mapInstagramMediaNode).filter(isMetaMediaNode)
      : [];
  if (mentionsResult.status === "rejected") {
    warnings.push("Nao foi possivel atualizar as marcacoes recentes do Instagram agora.");
  }

  const facebookOwnedPosts =
    facebookOwnedPostsResult.status === "fulfilled"
      ? facebookOwnedPostsResult.value
          .map(mapFacebookPostNode)
          .filter(isMetaMediaNode)
      : [];
  if (facebookOwnedPostsResult.status === "rejected") {
    warnings.push("Nao foi possivel atualizar as publicacoes da pagina do salao agora.");
  }

  const facebookMentions =
    facebookTaggedPostsResult.status === "fulfilled"
      ? facebookTaggedPostsResult.value
          .filter((item) =>
            isFacebookMentionNode(item, args.connection.facebook_page_id ?? ""),
          )
          .map(mapFacebookPostNode)
          .filter(isMetaMediaNode)
      : [];
  if (facebookTaggedPostsResult.status === "rejected") {
    warnings.push(buildFacebookFeedWarning(facebookTaggedPostsResult.reason));
  }

  const ownedPostsUpserted =
    (await upsertMetaMedia({
      supabase: args.supabase,
      connection,
      items: instagramOwnedPosts,
      sourceType: "owned_post",
    })) +
    (await upsertMetaMedia({
      supabase: args.supabase,
      connection,
      items: facebookOwnedPosts,
      sourceType: "owned_post",
    }));

  const mentionsUpserted =
    (await upsertMetaMedia({
      supabase: args.supabase,
      connection,
      items: instagramMentions,
      sourceType: "post_mention",
    })) +
    (await upsertMetaMedia({
      supabase: args.supabase,
      connection,
      items: facebookMentions,
      sourceType: "post_mention",
    }));

  return {
    ownedPostsUpserted,
    mentionsUpserted,
    warnings,
  };
}
