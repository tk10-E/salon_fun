import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  ReferralEntry,
  ReferralSearchParams,
  ReferralServiceOption,
  ReferralsPageData,
} from "./_lib";
import {
  buildRewardUnlockEntries,
  endOfDayExclusiveIso,
  firstParam,
  mapServiceOptions,
  startOfDayIso,
  type CustomerRow,
  type ReferralEventRow,
  type ReferralProgramRow,
  type RewardUnlockRelationRow,
} from "./_shared-lib";

export async function loadReferralsPageData(
  searchParams?: ReferralSearchParams,
): Promise<ReferralsPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const referralStatusFilter = firstParam(searchParams?.referralStatus).trim();
  const referralFrom = firstParam(searchParams?.referralFrom).trim();
  const referralTo = firstParam(searchParams?.referralTo).trim();
  const hasReferralFilters = Boolean(
    referralStatusFilter || referralFrom || referralTo,
  );

  const referralEventsQuery = (() => {
    let query = supabase
      .from("salon_referral_events")
      .select(
        "id, referrer_customer_id, invited_customer_id, status, qualified_at, created_at",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false });

    if (referralFrom) {
      query = query.gte("created_at", startOfDayIso(referralFrom));
    }

    if (referralTo) {
      query = query.lt("created_at", endOfDayExclusiveIso(referralTo));
    }

    return query;
  })();

  const [
    referralProgramResult,
    referralEventsResult,
    referralRewardUnlocksResult,
    rewardUnlocksCountResult,
    availableRewardUnlocksCountResult,
    servicesResult,
  ] = await Promise.all([
    supabase
      .from("salon_referral_programs")
      .select("*")
      .eq("salon_id", salon.id)
      .maybeSingle(),
    referralEventsQuery,
    (supabase as any)
      .from("salon_referral_reward_unlocks")
      .select(
        "id, referrer_customer_id, reward_description, reward_service_name, threshold_reached, required_qualified_referrals, unlocked_at, redeemed_at, status, customers(name)",
      )
      .eq("salon_id", salon.id)
      .order("unlocked_at", { ascending: false })
      .limit(12),
    supabase
      .from("salon_referral_reward_unlocks")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id),
    supabase
      .from("salon_referral_reward_unlocks")
      .select("*", { count: "exact", head: true })
      .eq("salon_id", salon.id)
      .eq("status", "available"),
    supabase
      .from("services")
      .select("id, name, category")
      .eq("salon_id", salon.id)
      .order("category")
      .order("name"),
  ]);

  const referralEventsBase = (referralEventsResult.data ??
    []) as ReferralEventRow[];
  const filteredEvents = referralStatusFilter
    ? referralEventsBase.filter(
        (event) => event.status === referralStatusFilter,
      )
    : referralEventsBase;

  const periodQualifiedCount = referralEventsBase.filter((event) => {
    if (!event.qualified_at) {
      return false;
    }

    if (referralFrom && event.qualified_at < startOfDayIso(referralFrom)) {
      return false;
    }

    if (referralTo && event.qualified_at >= endOfDayExclusiveIso(referralTo)) {
      return false;
    }

    return true;
  }).length;

  const customerIds = [
    ...new Set(
      filteredEvents
        .map((event) => event.referrer_customer_id)
        .concat(filteredEvents.map((event) => event.invited_customer_id)),
    ),
  ];
  const customerResult = customerIds.length
    ? await supabase
        .from("customers")
        .select("id, name, referral_code")
        .in("id", customerIds)
    : { data: [] as CustomerRow[] };
  const customerMap = new Map(
    (customerResult.data ?? []).map((customer) => [
      customer.id,
      customer as CustomerRow,
    ]),
  );

  const referralEvents = filteredEvents.map((event) => {
    const referrer = customerMap.get(event.referrer_customer_id);
    const invited = customerMap.get(event.invited_customer_id);

    return {
      id: event.id,
      created_at: event.created_at,
      invited_name: invited?.name ?? "Cliente indicado",
      qualified_at: event.qualified_at,
      referrer_name: referrer?.name ?? "Cliente do salão",
      status: event.status,
      used_referral_code: referrer?.referral_code ?? "Não identificado",
    } satisfies ReferralEntry;
  });

  const serviceOptions = mapServiceOptions(
    (servicesResult.data ?? []) as ReferralServiceOption[],
  );
  const rewardServiceMap = new Map(
    serviceOptions.map((service) => [service.id, service.name]),
  );
  const rawReferralProgram = (referralProgramResult.data ??
    null) as ReferralProgramRow | null;
  const referralProgram = rawReferralProgram
    ? {
        ...rawReferralProgram,
        reward_service_name:
          rawReferralProgram.reward_service_name ??
          (rawReferralProgram.reward_service_id
            ? rewardServiceMap.get(rawReferralProgram.reward_service_id) ?? null
            : null),
      }
    : null;
  const rewardUnlocks = buildRewardUnlockEntries(
    (referralRewardUnlocksResult.data ?? []) as RewardUnlockRelationRow[],
  );

  return {
    availableRewardUnlocksCount: availableRewardUnlocksCountResult.count ?? 0,
    hasReferralFilters,
    pendingCountInPeriod: referralEventsBase.filter(
      (event) => event.status === "pending",
    ).length,
    periodQualifiedCount,
    referralEvents,
    referralEventsBaseCount: referralEventsBase.length,
    referralFrom,
    referralProgram,
    rewardUnlocks,
    rewardUnlocksCount: rewardUnlocksCountResult.count ?? 0,
    referralStatusFilter,
    referralTo,
    serviceOptions,
  };
}
