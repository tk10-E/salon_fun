import { FlashMessage } from "@/components/FlashMessage";

import { loadGrowthAutomationPageData } from "../_lib";
import { AutomationsPageContent } from "../_automations-components";

type AutomationsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function AutomationsPage({ searchParams }: AutomationsPageProps) {
  const data = await loadGrowthAutomationPageData();

  return (
    <div className="page-grid marketing-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <AutomationsPageContent data={data} />
    </div>
  );
}
