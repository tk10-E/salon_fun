import { requireOwnerSalon } from "@/lib/auth";
import {
  cleanFeedCaption,
  getFeedPostEditorialNote,
  getFeedPostTypeLabel,
  getFeedSourceBadgeLabel,
  getFeedVisualCategory,
  getFeedVisualCategoryLabel,
  isInstagramFeedSource,
} from "@/lib/feedPresentation";
import {
  isMissingFeedStorySchema,
  resolveFeedStoryRecord,
} from "@/lib/feedStorySupport";
import { createClient } from "@/lib/supabase/server";

import type { FeedPageData } from "./_lib";

type FeedPostRecord = {
  caption: string | null;
  created_at: string;
  expires_at: string | null;
  id: string;
  image_path: string;
  post_type: "standard" | "before_after" | "reel" | "story" | null;
  salon_post_comments:
    | {
        body: string;
        created_at: string;
        customer_name: string;
        id: string;
      }[]
    | null;
  salon_post_images:
    | {
        id: string;
        image_path: string;
        sort_order: number;
      }[]
    | null;
  salon_post_likes: { customer_id: string }[] | null;
  services:
    | {
        id: string;
        name: string;
      }
    | {
        id: string;
        name: string;
      }[]
    | null;
  source_type: string | null;
  staff_members:
    | {
        id: string;
        name: string;
        role: string | null;
      }
    | {
        id: string;
        name: string;
        role: string | null;
      }[]
    | null;
  title: string;
  video_path: string | null;
};

type FeedStaffMember = {
  id: string;
  name: string;
  role: string | null;
};

type FeedService = {
  id: string;
  name: string;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

export async function loadFeedPageData(): Promise<FeedPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [{ data, error }, { data: services }, { data: staffMembers }] =
    await Promise.all([
      loadFeedPostRecords(supabase, salon.id),
      supabase
        .from("services")
        .select("id, name")
        .eq("salon_id", salon.id)
        .order("name"),
      supabase
        .from("staff_members")
        .select("id, name, role")
        .eq("salon_id", salon.id)
        .eq("is_active", true)
        .order("name"),
    ]);

  const stories: FeedPageData["stories"] = [];
  const posts: FeedPageData["posts"] = [];
  let reelsCount = 0;

  for (const post of (data ?? []) as FeedPostRecord[]) {
    const service = firstRelation(post.services);
    const staffMember = firstRelation(post.staff_members);
    const storyState = resolveFeedStoryRecord({
      createdAt: post.created_at,
      expiresAt: post.expires_at,
      postType: post.post_type,
      title: post.title,
    });
    const rawPostType = post.post_type ?? "standard";
    const postType: "standard" | "before_after" | "reel" =
      rawPostType === "before_after" || rawPostType === "reel"
        ? rawPostType
        : "standard";
    const gallerySource = post.salon_post_images?.length
      ? [...(post.salon_post_images ?? [])].sort(
          (left, right) => left.sort_order - right.sort_order,
        )
      : [
          {
            id: `${post.id}-cover`,
            image_path: post.image_path,
            sort_order: 0,
          },
        ];
    const primaryImage = gallerySource[0];
    const imageUrl = supabase.storage
      .from("salon-posts")
      .getPublicUrl(primaryImage.image_path).data.publicUrl;

    if (storyState.isStory) {
      if (!storyState.isActive || !storyState.expiresAt) {
        continue;
      }

      stories.push({
        id: post.id,
        title: storyState.cleanTitle,
        caption: cleanFeedCaption(post.caption),
        createdAt: post.created_at,
        expiresAt: storyState.expiresAt,
        imageUrl,
        serviceName: service?.name ?? null,
        staffMemberName: staffMember?.name ?? null,
        staffMemberRole: staffMember?.role ?? null,
      });
      continue;
    }

    const visualCategory = getFeedVisualCategory({
      title: post.title,
      caption: post.caption,
      postType,
      serviceName: service?.name ?? null,
    });
    if (postType === "reel") {
      reelsCount += 1;
    }

    posts.push({
      id: post.id,
      title: storyState.cleanTitle,
      cleanCaption: cleanFeedCaption(post.caption),
      comments: [...(post.salon_post_comments ?? [])]
        .sort((left, right) => right.created_at.localeCompare(left.created_at))
        .map((comment) => ({
          id: comment.id,
          customerName: comment.customer_name,
          body: comment.body,
        })),
      commentsCount: post.salon_post_comments?.length ?? 0,
      createdAt: post.created_at,
      editorialNote: getFeedPostEditorialNote({
        title: post.title,
        caption: post.caption,
        postType,
        serviceName: service?.name ?? null,
        sourceType: post.source_type,
        visualCategory,
      }),
      formatLabel: getFeedPostTypeLabel(postType),
      imageUrl,
      isInstagramSource: isInstagramFeedSource(post.source_type),
      likesCount: post.salon_post_likes?.length ?? 0,
      serviceName: service?.name ?? null,
      sourceBadgeLabel: getFeedSourceBadgeLabel(post.source_type),
      staffMemberName: staffMember?.name ?? null,
      staffMemberRole: staffMember?.role ?? null,
      visualCategory,
      visualCategoryLabel: getFeedVisualCategoryLabel(visualCategory),
    });
  }

  const safeServices = (services ?? []) as FeedService[];
  const safeStaffMembers = (staffMembers ?? []) as FeedStaffMember[];

  return {
    hasPostsError: Boolean(error),
    header: {
      postsCount: posts.length,
      transformationsCount: posts.filter(
        (post) => post.visualCategory === "transformation",
      ).length,
      promotionsCount: posts.filter(
        (post) => post.visualCategory === "promotion",
      ).length,
      reelsCount,
      storiesCount: stories.length,
    },
    posts,
    stories,
    services: safeServices.map((service) => ({
      id: service.id,
      name: service.name,
    })),
    staffMembers: safeStaffMembers.map((staffMember) => ({
      id: staffMember.id,
      name: staffMember.name,
      role: staffMember.role,
    })),
  };
}

async function loadFeedPostRecords(
  supabase: ReturnType<typeof createClient>,
  salonId: string,
) {
  const selectWithStories =
    "id,title,caption,image_path,post_type,source_type,video_path,created_at,expires_at,services(id,name),staff_members(id,name,role),salon_post_images(id,image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_name,body,created_at)";
  const selectWithoutStories =
    "id,title,caption,image_path,post_type,source_type,video_path,created_at,services(id,name),staff_members(id,name,role),salon_post_images(id,image_path,sort_order),salon_post_likes(customer_id),salon_post_comments(id,customer_name,body,created_at)";

  const primaryResult = await supabase
    .from("salon_posts")
    .select(selectWithStories)
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false });

  if (!primaryResult.error || !isMissingFeedStorySchema(primaryResult.error)) {
    return primaryResult;
  }

  return supabase
    .from("salon_posts")
    .select(selectWithoutStories)
    .eq("salon_id", salonId)
    .order("created_at", { ascending: false });
}
