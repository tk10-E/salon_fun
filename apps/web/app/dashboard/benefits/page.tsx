import { FlashMessage } from "@/components/FlashMessage";

import { BenefitsOverviewContent } from "./_overview-components";
import { loadBenefitsOverviewData } from "./_lib";

export type BenefitsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function BenefitsPage({
  searchParams,
}: BenefitsPageProps) {
  const data = await loadBenefitsOverviewData();

  return (
    <div className="page-grid marketing-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <BenefitsOverviewContent data={data} />
    </div>
  );
}
