import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";
import { DashboardHomeContent } from "./_components";
import { loadDashboardHomeData } from "./_lib";

export type DashboardPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function DashboardPage({
  searchParams: searchParamsPromise,
}: DashboardPageProps) {
  return measureServerRender("dashboard.home", async () => {
    const [searchParams, dashboardHomeData] = await Promise.all([
      searchParamsPromise,
      loadDashboardHomeData(),
    ]);

    return (
      <div className="page-grid dashboard-home dashboard-home--simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <DashboardHomeContent data={dashboardHomeData} />
      </div>
    );
  });
}
