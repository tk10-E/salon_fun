const LEGACY_STORY_TITLE_PATTERN = /^\[story\|(\d{1,2})h\]\s*/i;
const STORY_DURATION_OPTIONS = new Set([12, 24, 48]);

type StoryLikeRecord = {
  createdAt?: string | null;
  expiresAt?: string | null;
  postType?: string | null;
  title?: string | null;
};

function normalizeStoryDurationHours(value: number) {
  return STORY_DURATION_OPTIONS.has(value) ? value : 24;
}

function cleanTitle(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized ? normalized : "Story";
}

export function buildLegacyStoryTitle(title: string, durationHours: number) {
  return `[story|${normalizeStoryDurationHours(durationHours)}h] ${cleanTitle(title)}`;
}

export function parseLegacyStoryTitle(title: string | null | undefined) {
  const normalizedTitle = title?.trim();
  if (!normalizedTitle) {
    return null;
  }

  const match = normalizedTitle.match(LEGACY_STORY_TITLE_PATTERN);
  if (!match) {
    return null;
  }

  const parsedDuration = Number.parseInt(match[1] ?? "24", 10);
  const durationHours = normalizeStoryDurationHours(parsedDuration);
  const nextTitle = normalizedTitle
    .replace(LEGACY_STORY_TITLE_PATTERN, "")
    .trim();

  return {
    cleanTitle: nextTitle || "Story",
    durationHours,
  };
}

export function isLegacyStoryTitle(title: string | null | undefined) {
  return parseLegacyStoryTitle(title) != null;
}

export function stripLegacyStoryTitle(title: string | null | undefined) {
  return parseLegacyStoryTitle(title)?.cleanTitle ?? cleanTitle(title);
}

export function resolveFeedStoryRecord(record: StoryLikeRecord) {
  const normalizedPostType =
    record.postType?.trim().toLowerCase() ?? "standard";
  const legacyStory = parseLegacyStoryTitle(record.title);

  if (normalizedPostType === "story") {
    const expiresAt = record.expiresAt?.trim() || null;
    const parsedExpiresAt = expiresAt ? Date.parse(expiresAt) : Number.NaN;

    return {
      cleanTitle: legacyStory?.cleanTitle ?? cleanTitle(record.title),
      expiresAt,
      isActive: !Number.isNaN(parsedExpiresAt) && parsedExpiresAt > Date.now(),
      isStory: true,
      isVirtualStory: false,
    };
  }

  if (!legacyStory) {
    return {
      cleanTitle: cleanTitle(record.title),
      expiresAt: null,
      isActive: false,
      isStory: false,
      isVirtualStory: false,
    };
  }

  const parsedCreatedAt = record.createdAt
    ? Date.parse(record.createdAt)
    : Number.NaN;
  const expiresAt = Number.isNaN(parsedCreatedAt)
    ? null
    : new Date(
        parsedCreatedAt + legacyStory.durationHours * 60 * 60 * 1000,
      ).toISOString();
  const parsedExpiresAt = expiresAt ? Date.parse(expiresAt) : Number.NaN;

  return {
    cleanTitle: legacyStory.cleanTitle,
    expiresAt,
    isActive: !Number.isNaN(parsedExpiresAt) && parsedExpiresAt > Date.now(),
    isStory: true,
    isVirtualStory: true,
  };
}

export function isMissingFeedStorySchema(error: unknown) {
  const normalized = [
    error instanceof Error ? error.message : "",
    typeof error === "object" &&
    error != null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
      ? String((error as { message: string }).message)
      : "",
    typeof error === "object" &&
    error != null &&
    "details" in error &&
    typeof (error as { details?: unknown }).details === "string"
      ? String((error as { details: string }).details)
      : "",
    typeof error === "object" &&
    error != null &&
    "hint" in error &&
    typeof (error as { hint?: unknown }).hint === "string"
      ? String((error as { hint: string }).hint)
      : "",
    String(error ?? ""),
  ]
    .join(" ")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    (normalized.includes("expires_at") &&
      normalized.includes("salon_posts") &&
      (normalized.includes("does not exist") ||
        normalized.includes("schema cache"))) ||
    (normalized.includes("salon_posts_post_type_check") &&
      normalized.includes("story")) ||
    (normalized.includes("invalid input value") &&
      normalized.includes("story")) ||
    (normalized.includes("post_type") &&
      normalized.includes("schema cache") &&
      normalized.includes("story"))
  );
}
