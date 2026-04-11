import { requireOwnerSalon } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

import type { GrowthAutomationPageData } from "./_lib";
import { defaultGrowthAutomationDashboard } from "./_shared-lib";

export async function loadGrowthAutomationPageData(): Promise<GrowthAutomationPageData> {
  await requireOwnerSalon();
  const supabase = createClient();
  const growthAutomationDashboard = ((
    await supabase.rpc("get_salon_growth_automation_dashboard")
  ).data ?? defaultGrowthAutomationDashboard());

  return {
    growthAutomationOverview: growthAutomationDashboard.overview,
    growthAutomationRecentRuns: growthAutomationDashboard.recent_runs,
    growthAutomationSettings: growthAutomationDashboard.settings,
  };
}
