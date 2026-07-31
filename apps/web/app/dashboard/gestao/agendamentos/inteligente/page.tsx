import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";

import { AgendaIntelligencePageContent } from "./_components";
import { loadAgendaIntelligencePageData } from "./_lib";

type AgendaIntelligencePageProps = {
  searchParams?: Promise<{
    day?: string;
    message?: string;
    tone?: string;
  }>;
};

export default async function AgendaIntelligencePage({
  searchParams: searchParamsPromise,
}: AgendaIntelligencePageProps) {
  return measureServerRender("dashboard.management.smart-agenda", async () => {
    const searchParams = await searchParamsPromise;
    const data = await loadAgendaIntelligencePageData({
      day: searchParams?.day,
    });

    return (
      <div className="page-grid">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <AgendaIntelligencePageContent data={data} />
      </div>
    );
  });
}
