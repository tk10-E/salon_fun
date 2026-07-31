import type { ReferralProgramRow } from "./_shared-lib";

type SearchParamValue = string | string[] | undefined;

export type NoticeSearchParams = {
  message?: string;
  tone?: string;
};

export type OfferSearchParams = NoticeSearchParams & {
  aiGoal?: SearchParamValue;
  aiNotes?: SearchParamValue;
  compose?: SearchParamValue;
  offerKind?: SearchParamValue;
  offerQ?: SearchParamValue;
  offerState?: SearchParamValue;
  prefillDescription?: SearchParamValue;
  prefillEndsOn?: SearchParamValue;
  prefillHighlight?: SearchParamValue;
  prefillKind?: SearchParamValue;
  prefillPrice?: SearchParamValue;
  prefillServiceId?: SearchParamValue;
  prefillSessionsIncluded?: SearchParamValue;
  prefillStartsOn?: SearchParamValue;
  prefillTitle?: SearchParamValue;
  prefillValidityDays?: SearchParamValue;
};

export type ReferralSearchParams = NoticeSearchParams & {
  referralFrom?: SearchParamValue;
  referralStatus?: SearchParamValue;
  referralTo?: SearchParamValue;
};

export type OfferRow = {
  id: string;
  kind: "promotion" | "membership";
  title: string;
  description: string | null;
  highlight_text: string | null;
  membership_service_id: string | null;
  membership_sessions_included: number | null;
  membership_validity_days: number | null;
  price: number | string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  sort_order: number;
};

export type LoyaltyTierSnapshot = {
  label: string;
  min_visits: number;
  discount_percent: number | string;
  is_vip: boolean;
};

export type LoyaltyProgramRow = {
  title: string;
  description: string | null;
  points_per_visit: number;
  cashback_percent: number | string;
  tier_one_name: string;
  tier_one_min_visits: number;
  tier_one_discount_percent: number | string;
  tier_two_name: string;
  tier_two_min_visits: number;
  tier_two_discount_percent: number | string;
  vip_tier_name: string;
  vip_min_visits: number;
  vip_discount_percent: number | string;
  vip_reward_service_id?: string | null;
  vip_reward_service_name?: string | null;
  is_active: boolean;
  tiers: LoyaltyTierSnapshot[];
};

export type LoyaltyOverview = {
  ranked_customers: number;
  vip_customers: number;
  total_completed_visits: number;
  total_points_earned: number;
  total_cashback_earned: number | string;
};

export type LoyaltyLeaderboardItem = {
  customer_id: string;
  customer_name: string;
  rank_position: number;
  points_balance: number;
  total_points_earned: number;
  cashback_balance: number | string;
  total_cashback_earned: number | string;
  completed_visits: number;
  current_tier: LoyaltyTierSnapshot | null;
  last_reward_at: string | null;
};

export type GrowthAutomationSettings = {
  is_active: boolean;
  winback_inactive_days: number;
  winback_discount_percent: number;
  winback_title: string;
  winback_body_template: string;
  smart_rebook_is_active: boolean;
  smart_rebook_window_days: number;
  smart_rebook_title: string;
  smart_rebook_body_template: string;
  updated_at: string | null;
};

export type GrowthAutomationOverview = {
  at_risk_customers: number;
  due_now_customers: number;
  smart_rebook_due_customers: number;
  winbacks_sent_last_30d: number;
  smart_rebooks_sent_last_30d: number;
  recovered_customers_last_30d: number;
};

export type GrowthAutomationRecentRun = {
  id: string;
  automation_type: "winback_offer" | "smart_rebook_prompt";
  customer_id: string;
  customer_name: string;
  notification_id: string | null;
  sent_at: string;
  inactive_days: number;
  discount_percent: number;
  service_name: string;
  target_weekday: string | null;
  target_period: string | null;
  title: string | null;
  body: string | null;
  recovered: boolean;
  recovered_appointment_at: string | null;
};

export type MarketingLoyaltyTier = {
  customer_count: number;
  is_vip: boolean;
  label: string;
  min_visits: number;
};

export type MarketingBirthdayCustomer = {
  birth_date: string;
  birth_day: number;
  customer_id: string;
  name: string;
  phone: string | null;
};

export type MarketingInactiveCustomer = {
  customer_id: string;
  inactive_days: number;
  last_service_name: string | null;
  last_visit_at: string;
  name: string;
  phone: string | null;
};

export type MarketingIdea = {
  href: string;
  id: string;
  label: string;
  note: string;
  title: string;
  tone: "warm" | "soft" | "accent" | "success" | "danger";
};

export type BenefitsWalletSnapshot = {
  activeMembershipCustomers: number;
  activeMemberships: number;
  availableReferralRewards: number;
  cashbackCustomers: number;
  cashbackGenerated: number | string;
  expiringMemberships: number;
  redeemedReferralRewards: number;
  sessionsRemaining: number;
};

export type BenefitWalletHighlight = {
  activeMembershipExpiresAt: string | null;
  activeMembershipTitle: string | null;
  availableReferralRewards: number;
  cashbackBalance: number | string;
  completedVisits: number;
  customerId: string;
  membershipSessionsRemaining: number;
  name: string;
  pointsBalance: number;
  referralCode: string | null;
  tierLabel: string | null;
};

export type BenefitMembershipAlert = {
  customerId: string;
  customerName: string;
  expiresAt: string;
  membershipId: string;
  sessionsRemaining: number;
  title: string;
};

export type BenefitReferralRewardUnlock = {
  customerId: string;
  customerName: string;
  id: string;
  redeemedAt: string | null;
  requiredQualifiedReferrals: number;
  rewardDescription: string;
  rewardServiceName: string | null;
  status: "available" | "redeemed";
  thresholdReached: number;
  unlockedAt: string;
};

export type OfferLifecycle = "active" | "scheduled" | "expired" | "paused";

export type BenefitsOverviewData = {
  activeOffersCount: number;
  activeMembershipsCount: number;
  availableReferralRewardUnlocksCount: number;
  birthdayCustomers: MarketingBirthdayCustomer[];
  birthdaysThisMonth: number;
  customersWithBirthDate: number;
  expiringMemberships: BenefitMembershipAlert[];
  qualifiedReferralsCount: number;
  pendingReferralsCount: number;
  inactiveCustomers: MarketingInactiveCustomer[];
  inactiveThresholdDays: number;
  inactiveTotal: number;
  loyaltyTierDistribution: MarketingLoyaltyTier[];
  marketingIdeas: MarketingIdea[];
  loyaltyProgram: LoyaltyProgramRow | null;
  loyaltyOverview: LoyaltyOverview;
  growthAutomationSettings: GrowthAutomationSettings;
  growthAutomationOverview: GrowthAutomationOverview;
  referralProgram: ReferralProgramRow | null;
  redeemedReferralRewardUnlocksCount: number;
  rewardUnlocks: BenefitReferralRewardUnlock[];
  walletHighlights: BenefitWalletHighlight[];
  walletSnapshot: BenefitsWalletSnapshot;
};

export type PromotionsPageData = {
  activeOffersCount: number;
  activeMembershipsCount: number;
  featuredOffer: OfferRow | null;
  groupedOffers: Record<string, OfferRow[]>;
  hasOfferFilters: boolean;
  lifecycleCounts: Record<OfferLifecycle, number>;
  offerKindFilter: string;
  offerQuery: string;
  offerStateFilter: string;
  offers: OfferRow[];
  scheduledOffers: OfferRow[];
  serviceOptions: ReferralServiceOption[];
  today: string;
};

export type ReferralEntry = {
  id: string;
  created_at: string;
  invited_name: string;
  qualified_at: string | null;
  referrer_name: string;
  status: "pending" | "qualified";
  used_referral_code: string;
};

export type ReferralServiceOption = {
  id: string;
  name: string;
  category: string | null;
};

export type ReferralsPageData = {
  availableRewardUnlocksCount: number;
  hasReferralFilters: boolean;
  pendingCountInPeriod: number;
  periodQualifiedCount: number;
  referralEvents: ReferralEntry[];
  referralEventsBaseCount: number;
  referralFrom: string;
  referralProgram: ReferralProgramRow | null;
  rewardUnlocks: BenefitReferralRewardUnlock[];
  rewardUnlocksCount: number;
  referralStatusFilter: string;
  referralTo: string;
  serviceOptions: ReferralServiceOption[];
};

export type LoyaltyPageData = {
  loyaltyLeaderboard: LoyaltyLeaderboardItem[];
  loyaltyOverview: LoyaltyOverview;
  loyaltyProgram: LoyaltyProgramRow | null;
  serviceOptions: ReferralServiceOption[];
};

export type GrowthAutomationPageData = {
  growthAutomationOverview: GrowthAutomationOverview;
  growthAutomationRecentRuns: GrowthAutomationRecentRun[];
  growthAutomationSettings: GrowthAutomationSettings;
};

export {
  loadBenefitsOverviewData,
  loadBenefitsOverviewSnapshot,
  type BenefitsOverviewDiagnostics,
} from "./_overview-lib";
export { firstParam } from "./_shared-lib";
export {
  badgeClassForLifecycle,
  formatLifecycleLabel,
  formatOfferKind,
  formatOfferOperationalSummary,
  formatOfferPeriod,
  formatPercent,
  getOfferLifecycle,
  lifecycleHint,
  loadPromotionsPageData,
} from "./_promotions-lib";
export { loadReferralsPageData } from "./_referrals-lib";
export { loadLoyaltyPageData } from "./_loyalty-lib";
export { loadGrowthAutomationPageData } from "./_automations-lib";
