import { FlashMessage } from "@/components/FlashMessage";

import { loadReferralsPageData, type ReferralSearchParams } from "../_lib";
import { ReferralsPageContent } from "../_referrals-components";

export type ReferralsPageProps = {
  searchParams?: ReferralSearchParams;
};

export default async function ReferralsPage({
  searchParams,
}: ReferralsPageProps) {
  const data = await loadReferralsPageData(searchParams);

  return (
    <div className="page-grid marketing-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <ReferralsPageContent data={data} />
    </div>
  );
}
