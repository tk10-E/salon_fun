import { createClient } from "npm:@supabase/supabase-js@2";

const jsonHeaders: HeadersInit = { "Content-Type": "application/json" };
const encoder = new TextEncoder();
const graphApiBaseUrl =
  Deno.env.get("INSTAGRAM_GRAPH_API_BASE_URL")?.trim() ||
  "https://graph.facebook.com/v23.0";
const importedFeedAssetMaxBytes = 25 * 1024 * 1024;

type SupabaseClient = ReturnType<typeof createClient>;

type InstagramConnectionRow = {
  id: string;
  salon_id: string;
  instagram_user_id: string;
  instagram_username: string;
  access_token_ciphertext: string;
  require_mention_approval: boolean;
  import_story_mentions: boolean;
  auto_publish_owned_posts: boolean;
};

type MentionSourceType =
  | "post_mention"
  | "story_mention"
  | "owned_post"
  | "comment_mention";

type MentionMediaType = "image" | "video" | "carousel" | "story" | "unknown";

type WebhookClassification = {
  handled: boolean;
  sourceType: MentionSourceType;
  eventType: string;
};

type MediaContext = {
  externalMediaId: string | null;
  authorUsername: string | null;
  caption: string | null;
  permalink: string | null;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
  mediaType: MentionMediaType;
  mentionedAt: string | null;
};

type InstagramMentionRow = {
  id: string;
  salon_id: string;
  source_type: MentionSourceType;
  media_type: MentionMediaType;
  author_username: string | null;
  caption: string | null;
  permalink: string | null;
  media_url: string | null;
  thumbnail_url: string | null;
  moderation_status: "pending" | "approved" | "rejected" | "published";
  published_post_id: string | null;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: jsonHeaders,
  });
}

function normalizeNonEmptyString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.trim();
  return normalized.length ? normalized : null;
}

function decodeBase64Url(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, "0")).join("");
}

function safeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) {
    return false;
  }

  let diff = 0;
  for (let index = 0; index < left.length; index += 1) {
    diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return diff === 0;
}

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return bytesToHex(new Uint8Array(digest));
}

async function verifyMetaSignature(rawBody: string, signature: string | null): Promise<boolean> {
  const appSecret = Deno.env.get("INSTAGRAM_WEBHOOK_SECRET")?.trim();

  if (!appSecret) {
    return true;
  }

  if (!signature?.startsWith("sha256=")) {
    return false;
  }

  const expectedKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(appSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signed = await crypto.subtle.sign("HMAC", expectedKey, encoder.encode(rawBody));
  const expectedSignature = `sha256=${bytesToHex(new Uint8Array(signed))}`;

  return safeEqual(expectedSignature, signature);
}

async function decryptInstagramAccessToken(ciphertext: string): Promise<string> {
  const secret = Deno.env.get("INSTAGRAM_CONNECTION_TOKEN_SECRET")?.trim();

  if (!secret) {
    throw new Error("missing_instagram_connection_token_secret");
  }

  const [ivPart, tagPart, payloadPart] = ciphertext.split(".", 3);
  if (!ivPart || !tagPart || !payloadPart) {
    throw new Error("invalid_instagram_token_ciphertext");
  }

  const iv = decodeBase64Url(ivPart);
  const tag = decodeBase64Url(tagPart);
  const payload = decodeBase64Url(payloadPart);
  const encrypted = new Uint8Array(payload.length + tag.length);
  encrypted.set(payload, 0);
  encrypted.set(tag, payload.length);

  const keyMaterial = await crypto.subtle.digest("SHA-256", encoder.encode(secret));
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, tagLength: 128 },
    key,
    encrypted,
  );

  return new TextDecoder().decode(decrypted);
}

function mapMediaType(rawType: string | null): MentionMediaType {
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

function buildImportedAssetPath(salonId: string, url: string, fallbackExtension: string, prefix = "instagram"): string {
  const pathname = new URL(url).pathname;
  const extension = pathname.includes(".")
    ? pathname.split(".").pop()?.toLowerCase() ?? fallbackExtension
    : fallbackExtension;

  return `${salonId}/${prefix}-${crypto.randomUUID()}.${extension}`;
}

function buildImportedPostTitle(mention: InstagramMentionRow): string {
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
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Não foi possível baixar a mídia do Instagram para o feed.");
  }

  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > importedFeedAssetMaxBytes) {
    throw new Error("A mídia do Instagram é grande demais para o feed do app.");
  }

  return {
    bytes,
    contentType: response.headers.get("content-type")?.trim() || fallbackContentType,
    sourceUrl: url,
  };
}

async function uploadImportedAsset(args: {
  supabase: SupabaseClient;
  salonId: string;
  asset: Awaited<ReturnType<typeof downloadImportedAsset>>;
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

  const { error } = await args.supabase.storage
    .from("salon-posts")
    .upload(uploadPath, args.asset.bytes, {
      contentType: args.asset.contentType,
      upsert: false,
    });

  if (error) {
    throw new Error("Não foi possível importar a mídia do Instagram para o storage.");
  }

  return uploadPath;
}

async function removeImportedAssets(supabase: SupabaseClient, uploadedPaths: string[]) {
  if (!uploadedPaths.length) {
    return;
  }

  await supabase.storage.from("salon-posts").remove(uploadedPaths);
}

async function loadSalonOwnerUserId(
  supabase: SupabaseClient,
  cache: Map<string, string | null>,
  salonId: string,
) {
  if (!cache.has(salonId)) {
    const { data, error } = await supabase
      .from("salons")
      .select("owner_user_id")
      .eq("id", salonId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    cache.set(salonId, normalizeNonEmptyString(data?.owner_user_id) ?? null);
  }

  const ownerUserId = cache.get(salonId) ?? null;
  if (!ownerUserId) {
    throw new Error("Não foi possível localizar o responsável pelo salão para publicar no feed.");
  }

  return ownerUserId;
}

async function importMentionIntoFeed(args: {
  supabase: SupabaseClient;
  mention: InstagramMentionRow;
  ownerUserId: string;
}) {
  const { mention, ownerUserId, supabase } = args;

  if (mention.published_post_id || mention.moderation_status === "rejected") {
    return { created: false };
  }

  const uploadedPaths: string[] = [];

  try {
    if (mention.media_type === "video" && !mention.thumbnail_url) {
      throw new Error("O vídeo do Instagram não trouxe uma capa válida para o feed.");
    }

    const coverAssetUrl = mention.thumbnail_url ?? mention.media_url;
    if (!coverAssetUrl) {
      throw new Error("A publicação do Instagram não trouxe uma mídia válida para o feed.");
    }

    const coverAsset = await downloadImportedAsset(coverAssetUrl, "image/jpeg");
    const coverPath = await uploadImportedAsset({
      supabase,
      salonId: mention.salon_id,
      asset: coverAsset,
      prefix: "instagram-cover",
    });
    uploadedPaths.push(coverPath);

    let postType: "standard" | "reel" = "standard";
    let videoPath: string | null = null;

    if (mention.media_type === "video" && mention.media_url) {
      const videoAsset = await downloadImportedAsset(mention.media_url, "video/mp4");
      videoPath = await uploadImportedAsset({
        supabase,
        salonId: mention.salon_id,
        asset: videoAsset,
        prefix: "instagram-video",
      });
      uploadedPaths.push(videoPath);
      postType = "reel";
    }

    const sourceType = mention.source_type === "owned_post" ? "instagram_owned_post" : "instagram_mention";
    const { data: createdPost, error: postError } = await supabase
      .from("salon_posts")
      .insert({
        salon_id: mention.salon_id,
        title: buildImportedPostTitle(mention),
        caption: mention.caption?.trim() || mention.permalink || null,
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
      throw new Error("Não foi possível transformar a mídia do Instagram em post do feed.");
    }

    const { error: imageError } = await supabase.from("salon_post_images").insert([
      {
        post_id: createdPost.id,
        image_path: coverPath,
        sort_order: 0,
      },
    ]);

    if (imageError) {
      await supabase.from("salon_posts").delete().eq("id", createdPost.id);
      throw new Error("Não foi possível salvar a capa da publicação importada.");
    }

    const now = new Date().toISOString();
    const { error: mentionError } = await supabase
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
      .eq("salon_id", mention.salon_id);

    if (mentionError) {
      throw new Error("A mídia foi importada, mas o status da menção não pôde ser atualizado.");
    }

    return { created: true };
  } catch (error) {
    await removeImportedAssets(supabase, uploadedPaths);
    throw error;
  }
}

function classifyWebhookChange(
  field: string | null,
  value: Record<string, unknown>,
  connection: InstagramConnectionRow,
): WebhookClassification {
  const normalizedField = (field ?? "").toLowerCase();
  const mediaProductType = normalizeNonEmptyString(value.media_product_type)?.toLowerCase();
  const authorUsername = normalizeNonEmptyString(value.username)?.toLowerCase();

  if (normalizedField.includes("story")) {
    return {
      handled: connection.import_story_mentions,
      sourceType: "story_mention",
      eventType: "story_mention",
    };
  }

  if (normalizedField.includes("mention")) {
    return {
      handled: true,
      sourceType: normalizedField.includes("comment") ? "comment_mention" : "post_mention",
      eventType: normalizedField.includes("comment") ? "comment_mention" : "mention",
    };
  }

  if (
    normalizedField === "media" ||
    normalizedField === "feed" ||
    (mediaProductType === "feed" && authorUsername === connection.instagram_username.toLowerCase())
  ) {
    return {
      handled: true,
      sourceType: "owned_post",
      eventType: "owned_post",
    };
  }

  return {
    handled: false,
    sourceType: "post_mention",
    eventType: normalizedField || "unknown",
  };
}

async function fetchInstagramMediaContext(args: {
  mediaId: string;
  accessToken: string;
}): Promise<Partial<MediaContext>> {
  const url = new URL(`${graphApiBaseUrl}/${args.mediaId}`);
  url.searchParams.set(
    "fields",
    "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,username",
  );
  url.searchParams.set("access_token", args.accessToken);

  const response = await fetch(url, { method: "GET" });
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`instagram_graph_lookup_failed:${detail}`);
  }

  const payload = await response.json() as Record<string, unknown>;
  return {
    externalMediaId: normalizeNonEmptyString(payload.id),
    authorUsername: normalizeNonEmptyString(payload.username),
    caption: normalizeNonEmptyString(payload.caption),
    permalink: normalizeNonEmptyString(payload.permalink),
    mediaUrl: normalizeNonEmptyString(payload.media_url),
    thumbnailUrl: normalizeNonEmptyString(payload.thumbnail_url),
    mediaType: mapMediaType(normalizeNonEmptyString(payload.media_type)),
    mentionedAt: normalizeNonEmptyString(payload.timestamp),
  };
}

async function resolveMediaContext(args: {
  change: Record<string, unknown>;
  classification: WebhookClassification;
  connection: InstagramConnectionRow;
}): Promise<MediaContext> {
  const value = (args.change.value ?? {}) as Record<string, unknown>;
  const externalMediaId =
    normalizeNonEmptyString(value.media_id) ||
    normalizeNonEmptyString(value.id) ||
    normalizeNonEmptyString((value.media as Record<string, unknown> | undefined)?.id) ||
    null;

  const directContext: MediaContext = {
    externalMediaId,
    authorUsername:
      normalizeNonEmptyString(value.username) ||
      normalizeNonEmptyString((value.from as Record<string, unknown> | undefined)?.username) ||
      null,
    caption:
      normalizeNonEmptyString(value.caption) ||
      normalizeNonEmptyString(value.text) ||
      normalizeNonEmptyString(value.message) ||
      null,
    permalink: normalizeNonEmptyString(value.permalink),
    mediaUrl:
      normalizeNonEmptyString(value.media_url) ||
      normalizeNonEmptyString((value.media as Record<string, unknown> | undefined)?.media_url) ||
      null,
    thumbnailUrl:
      normalizeNonEmptyString(value.thumbnail_url) ||
      normalizeNonEmptyString((value.media as Record<string, unknown> | undefined)?.thumbnail_url) ||
      null,
    mediaType: mapMediaType(
      normalizeNonEmptyString(value.media_type) ||
        normalizeNonEmptyString(value.media_product_type),
    ),
    mentionedAt:
      normalizeNonEmptyString(value.timestamp) ||
      normalizeNonEmptyString(value.created_time) ||
      new Date().toISOString(),
  };

  if (
    !directContext.externalMediaId ||
    (directContext.mediaUrl && directContext.permalink && directContext.mediaType !== "unknown")
  ) {
    return directContext;
  }

  try {
    const accessToken = await decryptInstagramAccessToken(
      args.connection.access_token_ciphertext,
    );
    const fetchedContext = await fetchInstagramMediaContext({
      mediaId: directContext.externalMediaId,
      accessToken,
    });

    return {
      ...directContext,
      ...fetchedContext,
      mediaType: fetchedContext.mediaType ?? directContext.mediaType,
    };
  } catch (error) {
    console.error("instagram media lookup failed", {
      mediaId: directContext.externalMediaId,
      detail: error instanceof Error ? error.message : String(error),
    });
    return directContext;
  }
}

async function upsertWebhookEvent(args: {
  supabase: SupabaseClient;
  salonId: string;
  connectionId: string;
  eventKey: string;
  eventType: string;
  payload: Record<string, unknown>;
  processingStatus?: "received" | "processed" | "ignored" | "failed";
  lastError?: string | null;
}): Promise<void> {
  await args.supabase
    .from("instagram_webhook_events")
    .upsert(
      {
        salon_id: args.salonId,
        instagram_connection_id: args.connectionId,
        event_key: args.eventKey,
        event_type: args.eventType,
        payload: args.payload,
        processing_status: args.processingStatus ?? "received",
        processed_at:
          args.processingStatus && args.processingStatus !== "received"
            ? new Date().toISOString()
            : null,
        last_error: args.lastError ?? null,
      },
      { onConflict: "event_key" },
    );
}

async function processWebhookPayload(
  supabase: SupabaseClient,
  payload: Record<string, unknown>,
): Promise<{ received: number; ignored: number; mentionsUpserted: number; postsPublished: number }> {
  const entries = Array.isArray(payload.entry)
    ? payload.entry
    : Array.isArray(payload.entries)
    ? payload.entries
    : [];

  const connectionCache = new Map<string, InstagramConnectionRow | null>();
  const salonOwnerCache = new Map<string, string | null>();
  let received = 0;
  let ignored = 0;
  let mentionsUpserted = 0;
  let postsPublished = 0;

  for (const entry of entries) {
    const row = (entry ?? {}) as Record<string, unknown>;
    const instagramUserId =
      normalizeNonEmptyString(row.id) ||
      normalizeNonEmptyString(row.instagram_user_id) ||
      normalizeNonEmptyString((row.value as Record<string, unknown> | undefined)?.instagram_user_id);

    if (!instagramUserId) {
      ignored += 1;
      continue;
    }

    if (!connectionCache.has(instagramUserId)) {
      const { data } = await supabase
        .from("instagram_connections")
        .select(
          "id,salon_id,instagram_user_id,instagram_username,access_token_ciphertext,require_mention_approval,import_story_mentions,auto_publish_owned_posts",
        )
        .eq("instagram_user_id", instagramUserId)
        .eq("connection_status", "active")
        .maybeSingle();

      connectionCache.set(instagramUserId, (data ?? null) as InstagramConnectionRow | null);
    }

    const connection = connectionCache.get(instagramUserId);
    if (!connection) {
      ignored += 1;
      continue;
    }

    await supabase
      .from("instagram_connections")
      .update({
        last_webhook_at: new Date().toISOString(),
        last_error: null,
      })
      .eq("id", connection.id);

    const changes = Array.isArray(row.changes) ? row.changes : [];
    if (!changes.length) {
      ignored += 1;
      continue;
    }

    for (const rawChange of changes) {
      received += 1;
      const change = (rawChange ?? {}) as Record<string, unknown>;
      const value = (change.value ?? {}) as Record<string, unknown>;
      const field = normalizeNonEmptyString(change.field);
      const classification = classifyWebhookChange(field, value, connection);
      const eventKey = await sha256Hex(
        JSON.stringify({
          salonId: connection.salon_id,
          instagramUserId,
          field,
          value,
          entryTime: row.time ?? null,
        }),
      );

      if (!classification.handled) {
        ignored += 1;
        await upsertWebhookEvent({
          supabase,
          salonId: connection.salon_id,
          connectionId: connection.id,
          eventKey,
          eventType: classification.eventType,
          payload: { entry: row, change },
          processingStatus: "ignored",
        });
        continue;
      }

      try {
        const mediaContext = await resolveMediaContext({
          change,
          classification,
          connection,
        });
        const dedupeKey = await sha256Hex(
          JSON.stringify({
            salonId: connection.salon_id,
            sourceType: classification.sourceType,
            externalMediaId: mediaContext.externalMediaId,
            permalink: mediaContext.permalink,
            authorUsername: mediaContext.authorUsername,
            mentionedAt: mediaContext.mentionedAt,
          }),
        );
        const moderationStatus =
          classification.sourceType === "owned_post" && connection.auto_publish_owned_posts
            ? "approved"
            : connection.require_mention_approval
            ? "pending"
            : "approved";

        const { data: mentionRow, error: mentionError } = await supabase
          .from("instagram_mentions")
          .upsert(
            {
              salon_id: connection.salon_id,
              instagram_connection_id: connection.id,
              dedupe_key: dedupeKey,
              external_media_id: mediaContext.externalMediaId,
              source_type: classification.sourceType,
              media_type: mediaContext.mediaType,
              author_username: mediaContext.authorUsername,
              caption: mediaContext.caption,
              permalink: mediaContext.permalink,
              media_url: mediaContext.mediaUrl,
              thumbnail_url: mediaContext.thumbnailUrl,
              mentioned_at: mediaContext.mentionedAt,
              moderation_status: moderationStatus,
            },
            { onConflict: "dedupe_key" },
          )
          .select(
            "id,salon_id,source_type,media_type,author_username,caption,permalink,media_url,thumbnail_url,moderation_status,published_post_id",
          )
          .single();

        if (mentionError || !mentionRow) {
          throw mentionError ?? new Error("Não foi possível salvar a mídia do Instagram recebida no webhook.");
        }

        mentionsUpserted += 1;

        const ownerUserId = await loadSalonOwnerUserId(supabase, salonOwnerCache, connection.salon_id);
        const importResult = await importMentionIntoFeed({
          supabase,
          mention: mentionRow as InstagramMentionRow,
          ownerUserId,
        });

        if (importResult.created) {
          postsPublished += 1;
        }

        await upsertWebhookEvent({
          supabase,
          salonId: connection.salon_id,
          connectionId: connection.id,
          eventKey,
          eventType: classification.eventType,
          payload: { entry: row, change },
          processingStatus: "processed",
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : String(error);
        await upsertWebhookEvent({
          supabase,
          salonId: connection.salon_id,
          connectionId: connection.id,
          eventKey,
          eventType: classification.eventType,
          payload: { entry: row, change },
          processingStatus: "failed",
          lastError: detail,
        });
        await supabase
          .from("instagram_connections")
          .update({ last_error: detail })
          .eq("id", connection.id);
      }
    }
  }

  return { received, ignored, mentionsUpserted, postsPublished };
}

Deno.serve(async (request: Request) => {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim();
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim();

  if (!supabaseUrl || !serviceRoleKey) {
    return jsonResponse({ error: "missing_supabase_env" }, 500);
  }

  if (request.method === "GET") {
    const url = new URL(request.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");
    const expectedToken = Deno.env.get("INSTAGRAM_WEBHOOK_VERIFY_TOKEN")?.trim();

    if (mode === "subscribe" && challenge && expectedToken && token === expectedToken) {
      return new Response(challenge, { status: 200 });
    }

    return jsonResponse({ error: "invalid_webhook_verification" }, 403);
  }

  if (request.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const rawBody = await request.text();
  const isSignatureValid = await verifyMetaSignature(
    rawBody,
    request.headers.get("x-hub-signature-256"),
  );

  if (!isSignatureValid) {
    return jsonResponse({ error: "invalid_webhook_signature" }, 401);
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch (_) {
    return jsonResponse({ error: "invalid_json_body" }, 400);
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const result = await processWebhookPayload(supabase, payload);
    return jsonResponse({
      ok: true,
      received: result.received,
      ignored: result.ignored,
      mentions_upserted: result.mentionsUpserted,
      posts_published: result.postsPublished,
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("instagram-webhook failed", detail);
    return jsonResponse({ error: "instagram_webhook_failed", detail }, 500);
  }
});
