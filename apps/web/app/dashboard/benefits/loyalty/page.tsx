import { FlashMessage } from "@/components/FlashMessage";

import { loadLoyaltyPageData } from "../_lib";
import { LoyaltyPageContent } from "../_loyalty-components";

type LoyaltyPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function LoyaltyPage({ searchParams }: LoyaltyPageProps) {
  const data = await loadLoyaltyPageData();

  return (
    <div className="page-grid marketing-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <LoyaltyPageContent data={data} />
    </div>
  );
}
