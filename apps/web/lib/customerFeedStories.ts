import { randomUUID } from "node:crypto";

import { resolveAuthenticatedCustomerContext } from "@/lib/appointmentReviews";
import { createAdminClient } from "@/lib/supabase/admin";
import { buildLegacyStoryTitle, isMissingFeedStorySchema } from "@/lib/feedStorySupport";
import { optimizeUploadedImage } from "@/lib/uploadedImageOptimization";

type AdminClient = ReturnType<typeof createAdminClient> | any;

type CreateCustomerFeedStoryArgs = {
  accessToken: string;
  admin?: AdminClient | null;
  caption?: string | null;
  imageFile: File;
  now?: Date;
};

const CUSTOMER_PROFILE_BUCKET = "customer-profiles";
const SALON_POST_BUCKET = "salon-posts";
const CUSTOMER_STORY_SOURCE_TYPE = "customer_story";
const LEGACY_PERSISTED_STORY_SOURCE_TYPE = "native";
const CUSTOMER_STORY_OWNER_KEY_PREFIX = "customer-story://";
const CUSTOMER_STORY_DURATION_HOURS = 24;

function normalizeCaption(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : null;
}

function buildCustomerStoryOwnerKey(customerId: string) {
  return `${CUSTOMER_STORY_OWNER_KEY_PREFIX}${customerId}`;
}

function buildCustomerStoryTitle(customerName: string | null | undefined) {
  const normalizedName = customerName?.trim();
  if (!normalizedName) {
    return "Seu story";
  }

  const [firstName] = normalizedName.split(/\s+/);
  const resolvedFirstName = (firstName ?? normalizedName).trim();
  return resolvedFirstName.length === 0 ? "Seu story" : resolvedFirstName;
}

function buildCustomerStoryUploadPath(args: {
  customerId: string;
  extension: string;
  salonId: string;
}) {
  return `${args.salonId}/customer-stories/${args.customerId}/${randomUUID()}.${args.extension}`;
}

async function removeCustomerStoryAssets(args: {
  admin: AdminClient;
  paths: string[];
}) {
  const uniquePaths = [...new Set(args.paths.filter(Boolean))];
  if (!uniquePaths.length) {
    return;
  }

  await args.admin.storage.from(SALON_POST_BUCKET).remove(uniquePaths);
}

async function replacePreviousCustomerStories(args: {
  admin: AdminClient;
  customerId: string;
  salonId: string;
}) {
  const ownerKey = buildCustomerStoryOwnerKey(args.customerId);
  const { data, error } = await args.admin
    .from("salon_posts")
    .select("id, image_path, salon_post_images(image_path)")
    .eq("salon_id", args.salonId)
    .eq("external_permalink", ownerKey);

  if (error) {
    throw error;
  }

  const stories = (data ?? []) as Array<{
    id?: string | null;
    image_path?: string | null;
    salon_post_images?: Array<{ image_path?: string | null }> | null;
  }>;

  if (!stories.length) {
    return;
  }

  const storyIds = stories
    .map((story) => String(story.id ?? "").trim())
    .filter((storyId) => storyId.length > 0);
  const storagePaths = stories.flatMap((story) => [
    String(story.image_path ?? "").trim(),
    ...((story.salon_post_images ?? []).map((image) =>
      String(image.image_path ?? "").trim(),
    )),
  ]);

  if (storyIds.length) {
    const { error: deleteError } = await args.admin
      .from("salon_posts")
      .delete()
      .in("id", storyIds);

    if (deleteError) {
      throw deleteError;
    }
  }

  await removeCustomerStoryAssets({
    admin: args.admin,
    paths: storagePaths,
  });
}

function normalizeCustomerStoryError(error: unknown) {
  const message =
    error instanceof Error
      ? error.message.trim().toLowerCase()
      : String(error ?? "").trim().toLowerCase();

  switch (message) {
    case "unauthenticated":
    case "customer_story_image_required":
    case "customer_story_invalid_image":
      return message;
    default:
      return "customer_story_upload_unavailable";
  }
}

export async function createCustomerFeedStory(
  args: CreateCustomerFeedStoryArgs,
) {
  const admin = args.admin ?? (createAdminClient() as any);
  const context = await resolveAuthenticatedCustomerContext(
    args.accessToken,
    admin,
  );
  const normalizedCaption = normalizeCaption(args.caption);
  if (!(args.imageFile instanceof File) || args.imageFile.size <= 0) {
    throw new Error("customer_story_image_required");
  }

  let optimizedImage;
  try {
    optimizedImage = await optimizeUploadedImage(args.imageFile, "story");
  } catch {
    throw new Error("customer_story_invalid_image");
  }

  const [{ data: customer, error: customerError }, { data: salon, error: salonError }] =
    await Promise.all([
      admin
        .from("customers")
        .select("id, salon_id, name, profile_image_path")
        .eq("id", context.customerId)
        .eq("salon_id", context.salonId)
        .maybeSingle(),
      admin
        .from("salons")
        .select("id, owner_user_id")
        .eq("id", context.salonId)
        .maybeSingle(),
    ]);

  if (customerError || !customer?.id || !customer.salon_id) {
    throw new Error("unauthenticated");
  }

  if (salonError || !salon?.owner_user_id) {
    throw new Error("customer_story_upload_unavailable");
  }

  await replacePreviousCustomerStories({
    admin,
    customerId: context.customerId,
    salonId: context.salonId,
  });

  const uploadPath = buildCustomerStoryUploadPath({
    customerId: context.customerId,
    extension: optimizedImage.extension,
    salonId: context.salonId,
  });

  const { error: uploadError } = await admin.storage
    .from(SALON_POST_BUCKET)
    .upload(uploadPath, optimizedImage.buffer, {
      contentType: optimizedImage.contentType,
      upsert: false,
    });

  if (uploadError) {
    throw new Error("customer_story_upload_unavailable");
  }

  const ownerKey = buildCustomerStoryOwnerKey(context.customerId);
  const customerProfileImagePath =
    typeof customer.profile_image_path === "string" &&
    customer.profile_image_path.trim().length > 0
      ? customer.profile_image_path.trim()
      : null;
  const customerAvatarUrl = customerProfileImagePath
    ? admin.storage
        .from(CUSTOMER_PROFILE_BUCKET)
        .getPublicUrl(customerProfileImagePath).data.publicUrl
    : null;
  const title = buildCustomerStoryTitle(customer.name);
  const now = args.now ?? new Date();
  const expiresAt = new Date(
    now.getTime() + CUSTOMER_STORY_DURATION_HOURS * 60 * 60 * 1000,
  ).toISOString();

  const primaryInsertPayload = {
    caption: normalizedCaption,
    created_by_user_id: salon.owner_user_id,
    expires_at: expiresAt,
    external_author_avatar_url: customerAvatarUrl,
    external_author_username:
      typeof customer.name === "string" && customer.name.trim().length > 0
        ? customer.name.trim()
        : "Cliente",
    external_permalink: ownerKey,
    image_path: uploadPath,
    post_type: "story",
    salon_id: context.salonId,
    // The production schema still validates customer-owned stories as native
    // posts. We keep the customer marker in external_permalink and normalize
    // it back to customer_story in the mobile feed reader.
    source_type: LEGACY_PERSISTED_STORY_SOURCE_TYPE,
    title,
    video_path: null,
  };

  const primaryInsert = await admin
    .from("salon_posts")
    .insert(primaryInsertPayload)
    .select("id, created_at")
    .single();

  let createdPost = primaryInsert.data;
  let createdPostError = primaryInsert.error;

  if (
    (createdPostError || !createdPost) &&
    isMissingFeedStorySchema(createdPostError)
  ) {
    const fallbackInsert = await admin
      .from("salon_posts")
      .insert({
        caption: normalizedCaption,
        created_by_user_id: salon.owner_user_id,
        external_author_avatar_url: customerAvatarUrl,
        external_author_username:
          typeof customer.name === "string" && customer.name.trim().length > 0
            ? customer.name.trim()
            : "Cliente",
        external_permalink: ownerKey,
        image_path: uploadPath,
        post_type: "standard",
        salon_id: context.salonId,
        source_type: LEGACY_PERSISTED_STORY_SOURCE_TYPE,
        title: buildLegacyStoryTitle(title, CUSTOMER_STORY_DURATION_HOURS),
        video_path: null,
      })
      .select("id, created_at")
      .single();

    createdPost = fallbackInsert.data;
    createdPostError = fallbackInsert.error;
  }

  if (createdPostError || !createdPost?.id) {
    await removeCustomerStoryAssets({
      admin,
      paths: [uploadPath],
    });
    throw new Error("customer_story_upload_unavailable");
  }

  const { error: galleryError } = await admin
    .from("salon_post_images")
    .insert({
      image_path: uploadPath,
      post_id: createdPost.id,
      sort_order: 0,
    });

  if (galleryError) {
    await admin.from("salon_posts").delete().eq("id", createdPost.id);
    await removeCustomerStoryAssets({
      admin,
      paths: [uploadPath],
    });
    throw new Error("customer_story_upload_unavailable");
  }

  return {
    authorAvatarUrl: customerAvatarUrl,
    authorUsername:
      typeof customer.name === "string" && customer.name.trim().length > 0
        ? customer.name.trim()
        : "Cliente",
    createdAt: createdPost.created_at ?? now.toISOString(),
    expiresAt,
    id: createdPost.id,
    imageUrl: admin.storage.from(SALON_POST_BUCKET).getPublicUrl(uploadPath).data
      .publicUrl,
    ownerCustomerId: context.customerId,
    sourceType: CUSTOMER_STORY_SOURCE_TYPE,
    title,
  };
}

export function normalizeCustomerFeedStoryRouteError(error: unknown) {
  return normalizeCustomerStoryError(error);
}
