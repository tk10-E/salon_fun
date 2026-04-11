import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { BenefitsOverviewData } from "./_lib";
import {
  buildLoyaltyTierDistribution,
  buildMarketingIdeas,
  buildRewardUnlockEntries,
  buildWalletHighlights,
  defaultGrowthAutomationDashboard,
  defaultLoyaltyDashboard,
  defaultMarketingDashboard,
  firstRelation,
  isMembershipOperationallyActive,
  membershipSessionsRemaining,
  type CustomerDirectoryResponse,
  type MembershipRelationRow,
  type ReferralProgramRow,
  type RewardUnlockRelationRow,
} from "./_shared-lib";

export type BenefitsOverviewDiagnostics = {
  loyaltyDashboardReady: boolean;
  growthAutomationDashboardReady: boolean;
  marketingDashboardReady: boolean;
  hasFallbackData: boolean;
  warnings: string[];
};

export type BenefitsOverviewSnapshot = {
  data: BenefitsOverviewData;
  diagnostics: BenefitsOverviewDiagnostics;
};

export async function loadBenefitsOverviewSnapshot(): Promise<BenefitsOverviewSnapshot> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);
  const expiringMembershipLimit = new Date(`${today}T00:00:00.000Z`);
  expiringMembershipLimit.setUTCDate(expiringMembershipLimit.getUTCDate() + 7);
  const expiringMembershipCutoff = expiringMembershipLimit
    .toISOString()
    .slice(0, 10);

  const [
    referralProgramResult,
    loyaltyDashboardResult,
    growthAutomationDashboardResult,
    marketingDashboardResult,
    customerDirectoryResult,
    activeMembershipsResult,
    rewardUnlocksResult,
    activeOffersCountResult,
    activeMembershipsCountResult,
    availableRewardUnlocksCountResult,
    redeemedRewardUnlocksCountResult,
    qualifiedReferralsCountResult,
    pendingReferralsCountResult,
  ] = await Promise.all([
    supabase
      .from("salon_referral_programs")
      .select("*")
      .eq("salon_id", salon.id)
      .maybeSingle(),
    supabase.rpc("get_salon_loyalty_dashboard"),
    supabase.rpc("get_salon_growth_automation_dashboard"),
    supabase.rpc("get_salon_marketing_dashboard"),
    supabase.rpc("get_owner_customer_directory", {
      page_input: 1,
      page_size_input: 6,
      search_input: "",
      segment_input: "all",
      sort_input: "loyalty",
    }),
    (supabase as any)
      .from("customer_memberships")
      .select(
        "id, customer_id, title, expires_at, sessions_included, sessions_used, status, customers(name)",
      )
      .eq("salon_id", salon.id)
      .order("expires_at", { ascending: true }),
    (supabase as any)
      .from("salon_referral_reward_unlocks")
      .select(
        "id, referrer_customer_id, reward_description, reward_service_name, threshold_reached, required_qualified_referrals, unlocked_at, redeemed_at, status, customers(name)",
      )
      .eq("salon_id", salon.id)
      .order("unlocked_at", { ascending: false })
      .limit(8),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true),
    supabase
      .from("salon_offers")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("is_active", true)
      .eq("kind", "membership"),
    supabase
      .from("salon_referral_reward_unlocks")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "available"),
    supabase
      .from("salon_referral_reward_unlocks")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "redeemed"),
    supabase
      .from("salon_referral_events")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "qualified"),
    supabase
      .from("salon_referral_events")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "pending"),
  ]);

  const loyaltyDashboardReady =
    !loyaltyDashboardResult.error && loyaltyDashboardResult.data != null;
  const growthAutomationDashboardReady =
    !growthAutomationDashboardResult.error &&
    growthAutomationDashboardResult.data != null;
  const marketingDashboardReady =
    !marketingDashboardResult.error && marketingDashboardResult.data != null;
  const warnings: string[] = [];

  if (!loyaltyDashboardReady) {
    warnings.push(
      "Fidelizacao do app indisponivel agora. O painel nao esta tratando isso como zero real.",
    );
  }

  if (!growthAutomationDashboardReady) {
    warnings.push(
      "Automacoes do app nao responderam agora. Revise o bloco de automacoes antes de confiar nos numeros.",
    );
  }

  if (!marketingDashboardReady) {
    warnings.push(
      "Painel comercial do app sem resposta agora. Ideias e sinais de marketing nao estao vindo do dado real.",
    );
  }

  const loyaltyDashboard =
    loyaltyDashboardResult.data ?? defaultLoyaltyDashboard();
  const growthAutomationDashboard =
    growthAutomationDashboardResult.data ?? defaultGrowthAutomationDashboard();
  const marketingDashboard =
    marketingDashboardResult.data ?? defaultMarketingDashboard();
  const referralProgram =
    (referralProgramResult.data ?? null) as ReferralProgramRow | null;
  const loyaltyTierDistribution = buildLoyaltyTierDistribution(
    loyaltyDashboard.program,
    marketingDashboard,
  );
  const birthdaysThisMonth = marketingDashboard.birthdays_this_month ?? 0;
  const customersWithBirthDate =
    marketingDashboard.customers_with_birth_date ?? 0;
  const inactiveThresholdDays =
    marketingDashboard.inactive_threshold_days ?? 30;
  const inactiveTotal = marketingDashboard.inactive_total ?? 0;
  const customerDirectory = (customerDirectoryResult.data ?? {
    overview: { cashback_customers: 0 },
    items: [],
  }) as CustomerDirectoryResponse;
  const rewardUnlockEntries = buildRewardUnlockEntries(
    (rewardUnlocksResult.data ?? []) as RewardUnlockRelationRow[],
  );
  const activeMemberships = (
    (activeMembershipsResult.data ?? []) as MembershipRelationRow[]
  ).filter((membership) => isMembershipOperationallyActive(membership, today));
  const expiringMemberships = activeMemberships
    .filter((membership) => membership.expires_at <= expiringMembershipCutoff)
    .slice(0, 5)
    .map((membership) => ({
      customerId: membership.customer_id,
      customerName:
        firstRelation(membership.customers)?.name ?? "Cliente do salão",
      expiresAt: membership.expires_at,
      membershipId: membership.id,
      sessionsRemaining: membershipSessionsRemaining(membership),
      title: membership.title,
    }));

  return {
    data: {
      activeOffersCount: activeOffersCountResult.count ?? 0,
      activeMembershipsCount: activeMembershipsCountResult.count ?? 0,
      availableReferralRewardUnlocksCount:
        availableRewardUnlocksCountResult.count ?? 0,
      birthdayCustomers: marketingDashboard.birthday_customers ?? [],
      birthdaysThisMonth,
      customersWithBirthDate,
      expiringMemberships,
      qualifiedReferralsCount: qualifiedReferralsCountResult.count ?? 0,
      pendingReferralsCount: pendingReferralsCountResult.count ?? 0,
      inactiveCustomers: marketingDashboard.inactive_customers ?? [],
      inactiveThresholdDays,
      inactiveTotal,
      loyaltyTierDistribution,
      marketingIdeas: buildMarketingIdeas({
        activeMembershipsCount: activeMembershipsCountResult.count ?? 0,
        activeOffersCount: activeOffersCountResult.count ?? 0,
        birthdaysThisMonth,
        customersWithBirthDate,
        inactiveThresholdDays,
        inactiveTotal,
        loyaltyOverview: loyaltyDashboard.overview,
        pendingReferralsCount: pendingReferralsCountResult.count ?? 0,
        qualifiedReferralsCount: qualifiedReferralsCountResult.count ?? 0,
        referralProgram,
      }),
      loyaltyProgram: loyaltyDashboard.program,
      loyaltyOverview: loyaltyDashboard.overview,
      growthAutomationSettings: growthAutomationDashboard.settings,
      growthAutomationOverview: growthAutomationDashboard.overview,
      referralProgram,
      redeemedReferralRewardUnlocksCount:
        redeemedRewardUnlocksCountResult.count ?? 0,
      rewardUnlocks: rewardUnlockEntries.filter(
        (rewardUnlock) => rewardUnlock.status === "available",
      ),
      walletHighlights: buildWalletHighlights({
        activeMemberships,
        directoryItems: customerDirectory.items ?? [],
        rewardUnlocks: rewardUnlockEntries,
      }),
      walletSnapshot: {
        activeMembershipCustomers: new Set(
          activeMemberships.map((membership) => membership.customer_id),
        ).size,
        activeMemberships: activeMemberships.length,
        availableReferralRewards: availableRewardUnlocksCountResult.count ?? 0,
        cashbackCustomers: customerDirectory.overview?.cashback_customers ?? 0,
        cashbackGenerated: loyaltyDashboard.overview.total_cashback_earned ?? 0,
        expiringMemberships: expiringMemberships.length,
        redeemedReferralRewards: redeemedRewardUnlocksCountResult.count ?? 0,
        sessionsRemaining: activeMemberships.reduce(
          (total, membership) => total + membershipSessionsRemaining(membership),
          0,
        ),
      },
    },
    diagnostics: {
      loyaltyDashboardReady,
      growthAutomationDashboardReady,
      marketingDashboardReady,
      hasFallbackData:
        !loyaltyDashboardReady ||
        !growthAutomationDashboardReady ||
        !marketingDashboardReady,
      warnings,
    },
  };
}

export async function loadBenefitsOverviewData(): Promise<BenefitsOverviewData> {
  const snapshot = await loadBenefitsOverviewSnapshot();
  return snapshot.data;
}
