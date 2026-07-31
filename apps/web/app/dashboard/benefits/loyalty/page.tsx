import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";

import { loadLoyaltyPageData } from "../_lib";
import { LoyaltyPageContent } from "../_loyalty-components";

type LoyaltyPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function LoyaltyPage({ searchParams: searchParamsPromise }: LoyaltyPageProps) {
  return measureServerRender("dashboard.benefits.loyalty", async () => {
    const [searchParams, data] = await Promise.all([
      searchParamsPromise,
      loadLoyaltyPageData(),
    ]);

    return (
      <div className="page-grid marketing-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <LoyaltyPageContent data={data} />
      </div>
    );
  });
}
