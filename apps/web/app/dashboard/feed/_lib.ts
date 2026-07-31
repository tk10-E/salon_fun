export type FeedPageData = {
  hasPostsError: boolean;
  header: {
    postsCount: number;
    promotionsCount: number;
    reelsCount: number;
    storiesCount: number;
    transformationsCount: number;
  };
  posts: Array<{
    cleanCaption: string | null;
    comments: Array<{
      body: string;
      customerName: string;
      id: string;
    }>;
    commentsCount: number;
    createdAt: string;
    editorialNote: string;
    formatLabel: string;
    id: string;
    imageUrl: string;
    isInstagramSource: boolean;
    likesCount: number;
    serviceName: string | null;
    sourceBadgeLabel: string | null;
    staffMemberName: string | null;
    staffMemberRole: string | null;
    title: string;
    visualCategory: "portfolio" | "transformation" | "promotion";
    visualCategoryLabel: string;
  }>;
  stories: Array<{
    caption: string | null;
    createdAt: string;
    expiresAt: string;
    id: string;
    imageUrl: string;
    serviceName: string | null;
    staffMemberName: string | null;
    staffMemberRole: string | null;
    title: string;
  }>;
  services: Array<{
    id: string;
    name: string;
  }>;
  staffMembers: Array<{
    id: string;
    name: string;
    role: string | null;
  }>;
};

export { loadFeedPageData } from "./_loader";
