import { measureServerRender } from "@/lib/serverPerformance";

import { DashboardBirthdaysPageContent } from "../_components";
import { loadDashboardBirthdaysData } from "../_lib";

type BirthdayCampaignPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function BirthdayCampaignPage({
  searchParams: searchParamsPromise,
}: BirthdayCampaignPageProps) {
  return measureServerRender("dashboard.birthdays", async () => {
    const [searchParams, birthdays] = await Promise.all([
      searchParamsPromise,
      loadDashboardBirthdaysData(),
    ]);

    return (
      <div className="page-grid">
        <DashboardBirthdaysPageContent
          birthdays={birthdays}
          initialMessage={searchParams?.message}
          initialTone={searchParams?.tone}
        />
      </div>
    );
  });
}
