import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";

import { BenefitsOverviewContent } from "./_overview-components";
import { loadBenefitsOverviewData } from "./_lib";

export type BenefitsPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function BenefitsPage({
  searchParams: searchParamsPromise,
}: BenefitsPageProps) {
  return measureServerRender("dashboard.benefits", async () => {
    const [searchParams, data] = await Promise.all([
      searchParamsPromise,
      loadBenefitsOverviewData(),
    ]);

    return (
      <div className="page-grid marketing-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <BenefitsOverviewContent data={data} />
      </div>
    );
  });
}
