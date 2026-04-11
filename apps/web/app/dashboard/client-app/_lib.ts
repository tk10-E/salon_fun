import type {
  BenefitsOverviewData,
  BenefitsOverviewDiagnostics,
} from "@/app/dashboard/benefits/_lib";
import type {
  NotificationCategory,
  NotificationRow,
} from "../notifications/shared";

type BrandSignal = {
  label: string;
  ready: boolean;
  summary: string;
};

export type ClientAppHubData = {
  salonName: string;
  publicSalonPath: string;
  whiteLabelActive: boolean;
  autoPilotEnabled: boolean;
  appDisplayName: string | null;
  customDomain: string | null;
  experienceModelLabel: string;
  visualStyleLabel: string;
  homeEmphasisLabel: string;
  welcomeHeadline: string | null;
  heroHeadline: string | null;
  primaryCtaLabel: string | null;
  promotionHeadline: string | null;
  brandCoverageCount: number;
  brandSignals: BrandSignal[];
  centralCampaigns: Array<{
    id: string;
    isActive: boolean;
    priority: "high" | "medium" | "low";
    startsAt: string | null;
    endsAt: string | null;
    audience:
      | "all"
      | "with_upcoming_appointment"
      | "without_upcoming_appointment"
      | "with_active_benefits"
      | "without_active_benefits";
    eyebrow: string | null;
    title: string;
    message: string;
    campaignLabel: string | null;
    ctaLabel: string | null;
    ctaTarget:
      | "explore"
      | "appointments"
      | "feed"
      | "profile"
      | "notifications"
      | "support";
  }>;
  servicesCount: number;
  postsCount: number;
  activeOffersCount: number;
  activeMembershipsCount: number;
  recentNotificationsCount: number;
  activePushTokensCount: number;
  recentPushTokensCount: number;
  instagramConnectionCount: number;
  commercialDataHealth: BenefitsOverviewDiagnostics;
  growthAutomationSettings: BenefitsOverviewData["growthAutomationSettings"];
  growthAutomationOverview: BenefitsOverviewData["growthAutomationOverview"];
  loyaltyOverview: BenefitsOverviewData["loyaltyOverview"];
  referralProgramActive: boolean;
  referralProgramTitle: string | null;
  qualifiedReferralsCount: number;
  pendingReferralsCount: number;
  recentNotifications: Array<{
    id: string;
    title: string;
    body: string;
    notificationType: string;
    category: NotificationCategory;
    audience: NotificationRow["audience"];
    createdAt: string;
  }>;
  recentPosts: Array<{
    id: string;
    title: string;
    caption: string | null;
    postType: "standard" | "before_after" | "reel";
    serviceName: string | null;
    createdAt: string;
    likesCount: number;
    commentsCount: number;
  }>;
};

export { loadClientAppHubData } from "./_loader";
