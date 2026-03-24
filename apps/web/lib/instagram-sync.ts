import { createHash } from "node:crypto";

import { decryptInstagramAccessToken } from "@/lib/instagram-crypto";
import { INSTAGRAM_META_GRAPH_VERSION, type InstagramMetaPageAccount } from "@/lib/instagram-oauth";

const graphApiBaseUrl =
  process.env.INSTAGRAM_GRAPH_API_BASE_URL?.trim() ||
  `https://graph.facebook.com/${INSTAGRAM_META_GRAPH_VERSION}`;
const defaultMediaFields = "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username";

export type InstagramConnectionSyncRecord = {
  id: string;
  salon_id: string;
  instagram_user_id: string;
  instagram_username: string;
  access_token_ciphertext: string;
  require_mention_approval: boolean;
  import_story_mentions: boolean;
  auto_publish_owned_posts: boolean;
};

type InstagramMediaNode = {
  id: string;
  caption: string | null;
  media_type: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  permalink: string | null;
  timestamp: string | null;
  username: string | null;
};

type InstagramGraphCollectionResponse = {
  data?: Array<Record<string, unknown>>;
};

function isInstagramMediaNode(value: InstagramMediaNode | null): value is InstagramMediaNode {
  return value !== null;
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function sha256Hex(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function mapMediaType(rawType: string | null) {
  switch ((rawType ?? "").toUpperCase()) {
    case "IMAGE":
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
  sourceType: "owned_post" | "post_mention",
) {
  if (sourceType === "owned_post" && connection.auto_publish_owned_posts) {
    return "approved";
  }

  return connection.require_mention_approval ? "pending" : "approved";
}

function mapMediaNode(node: Record<string, unknown>): InstagramMediaNode | null {
  const id = normalizeNonEmptyString(node.id);

  if (!id) {
    return null;
  }

  return {
    id,
    caption: normalizeNonEmptyString(node.caption),
    media_type: normalizeNonEmptyString(node.media_type),
    media_url: normalizeNonEmptyString(node.media_url),
    thumbnail_url: normalizeNonEmptyString(node.thumbnail_url),
    permalink: normalizeNonEmptyString(node.permalink),
    timestamp: normalizeNonEmptyString(node.timestamp),
    username: normalizeNonEmptyString(node.username),
  };
}

async function fetchInstagramCollection(args: {
  path: string;
  accessToken: string;
  fields?: string;
  limit?: number;
}) {
  const url = new URL(`${graphApiBaseUrl}/${args.path.replace(/^\/+/, "")}`);
  url.searchParams.set("fields", args.fields ?? defaultMediaFields);
  url.searchParams.set("limit", String(args.limit ?? 12));
  url.searchParams.set("access_token", args.accessToken);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    throw new Error(await response.text());
  }

  const payload = (await response.json()) as InstagramGraphCollectionResponse;
  return Array.isArray(payload.data) ? payload.data : [];
}

async function upsertInstagramMedia(args: {
  supabase: any;
  connection: InstagramConnectionSyncRecord;
  items: InstagramMediaNode[];
  sourceType: "owned_post" | "post_mention";
}) {
  const rows = args.items.map((item) => ({
    salon_id: args.connection.salon_id,
    instagram_connection_id: args.connection.id,
    dedupe_key: sha256Hex(
      JSON.stringify({
        salonId: args.connection.salon_id,
        sourceType: args.sourceType,
        externalMediaId: item.id,
        permalink: item.permalink,
        authorUsername: item.username,
        mentionedAt: item.timestamp,
      }),
    ),
    external_media_id: item.id,
    source_type: args.sourceType,
    media_type: mapMediaType(item.media_type),
    author_username:
      item.username ?? (args.sourceType === "owned_post" ? args.connection.instagram_username : null),
    caption: item.caption,
    permalink: item.permalink,
    media_url: item.media_url,
    thumbnail_url: item.thumbnail_url,
    mentioned_at: item.timestamp,
    moderation_status: buildModerationStatus(args.connection, args.sourceType),
  }));

  if (!rows.length) {
    return 0;
  }

  const { error } = await args.supabase
    .from("instagram_mentions")
    .upsert(rows, { onConflict: "dedupe_key" });

  if (error) {
    throw error;
  }

  return rows.length;
}

export async function loadMetaAccounts(accessToken: string) {
  const rows = await fetchInstagramCollection({
    path: "me/accounts",
    accessToken,
    fields: "id,name,access_token,instagram_business_account{id,username}",
    limit: 25,
  });

  return rows as InstagramMetaPageAccount[];
}

export async function subscribeMetaPageToWebhook(args: {
  pageId: string;
  pageAccessToken: string;
}) {
  const url = new URL(`${graphApiBaseUrl}/${args.pageId}/subscribed_apps`);

  const requestBody = new URLSearchParams();
  requestBody.set("access_token", args.pageAccessToken);
  requestBody.set("subscribed_fields", "feed,mention,comments");

  let response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: requestBody,
  });

  if (!response.ok) {
    const fallbackBody = new URLSearchParams();
    fallbackBody.set("access_token", args.pageAccessToken);

    response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: fallbackBody,
    });
  }

  if (!response.ok) {
    throw new Error(await response.text());
  }
}

export async function syncInstagramActivity(args: {
  supabase: any;
  connection: InstagramConnectionSyncRecord;
}) {
  const accessToken = decryptInstagramAccessToken(args.connection.access_token_ciphertext);
  const warnings: string[] = [];

  const [ownedPostsResult, mentionsResult] = await Promise.allSettled([
    fetchInstagramCollection({
      path: `${args.connection.instagram_user_id}/media`,
      accessToken,
    }),
    fetchInstagramCollection({
      path: `${args.connection.instagram_user_id}/tags`,
      accessToken,
    }),
  ]);

  const ownedPosts =
    ownedPostsResult.status === "fulfilled"
      ? ownedPostsResult.value.map(mapMediaNode).filter(isInstagramMediaNode)
      : [];
  if (ownedPostsResult.status === "rejected") {
    warnings.push(
      `Nao foi possivel sincronizar os posts do salao: ${ownedPostsResult.reason instanceof Error ? ownedPostsResult.reason.message : String(ownedPostsResult.reason)}`,
    );
  }

  const mentions =
    mentionsResult.status === "fulfilled"
      ? mentionsResult.value.map(mapMediaNode).filter(isInstagramMediaNode)
      : [];
  if (mentionsResult.status === "rejected") {
    warnings.push(
      `Nao foi possivel sincronizar as marcacoes recentes: ${mentionsResult.reason instanceof Error ? mentionsResult.reason.message : String(mentionsResult.reason)}`,
    );
  }

  const ownedPostsUpserted = await upsertInstagramMedia({
    supabase: args.supabase,
    connection: args.connection,
    items: ownedPosts,
    sourceType: "owned_post",
  });
  const mentionsUpserted = await upsertInstagramMedia({
    supabase: args.supabase,
    connection: args.connection,
    items: mentions,
    sourceType: "post_mention",
  });

  return {
    ownedPostsUpserted,
    mentionsUpserted,
    warnings,
  };
}
