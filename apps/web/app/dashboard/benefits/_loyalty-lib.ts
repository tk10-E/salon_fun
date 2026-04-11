import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type {
  LoyaltyPageData,
  ReferralServiceOption,
} from "./_lib";
import {
  defaultLoyaltyDashboard,
  mapServiceOptions,
} from "./_shared-lib";

export async function loadLoyaltyPageData(): Promise<LoyaltyPageData> {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const [loyaltyDashboardResult, serviceOptionsResult] = await Promise.all([
    supabase.rpc("get_salon_loyalty_dashboard"),
    supabase
      .from("services")
      .select("id, name, category")
      .eq("salon_id", salon.id)
      .order("category")
      .order("name"),
  ]);

  const loyaltyDashboard = loyaltyDashboardResult.data ?? defaultLoyaltyDashboard();

  return {
    loyaltyLeaderboard: loyaltyDashboard.leaderboard,
    loyaltyOverview: loyaltyDashboard.overview,
    loyaltyProgram: loyaltyDashboard.program,
    serviceOptions: mapServiceOptions(
      (serviceOptionsResult.data ?? []) as ReferralServiceOption[],
    ),
  };
}
