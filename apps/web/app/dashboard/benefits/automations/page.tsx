import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";

import { loadGrowthAutomationPageData } from "../_lib";
import { AutomationsPageContent } from "../_automations-components";

type AutomationsPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function AutomationsPage({ searchParams: searchParamsPromise }: AutomationsPageProps) {
  return measureServerRender("dashboard.benefits.automations", async () => {
    const [searchParams, data] = await Promise.all([
      searchParamsPromise,
      loadGrowthAutomationPageData(),
    ]);

    return (
      <div className="page-grid marketing-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <AutomationsPageContent data={data} />
      </div>
    );
  });
}
