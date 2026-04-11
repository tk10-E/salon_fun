import { FlashMessage } from "@/components/FlashMessage";

import { PromotionsPageContent } from "../_promotions-components";
import { firstParam, loadPromotionsPageData, type OfferSearchParams } from "../_lib";

export type PromotionsPageProps = {
  searchParams?: OfferSearchParams;
};

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const data = await loadPromotionsPageData(searchParams);
  const offerQ = firstParam(searchParams?.offerQ);
  const offerKind = firstParam(searchParams?.offerKind);
  const offerState = firstParam(searchParams?.offerState);

  return (
    <div className="page-grid marketing-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <PromotionsPageContent
        data={data}
        offerKind={offerKind}
        offerQ={offerQ}
        offerState={offerState}
      />
    </div>
  );
}
