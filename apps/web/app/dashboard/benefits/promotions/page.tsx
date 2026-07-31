import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";

import {
  PromotionsPageContent,
  type PromotionComposerPrefill,
} from "../_promotions-components";
import { firstParam, loadPromotionsPageData, type OfferSearchParams } from "../_lib";

export type PromotionsPageProps = {
  searchParams?: Promise<OfferSearchParams>;
};

export default async function PromotionsPage({ searchParams: searchParamsPromise }: PromotionsPageProps) {
  return measureServerRender("dashboard.benefits.promotions", async () => {
    const searchParams = await searchParamsPromise;
    const data = await loadPromotionsPageData(searchParams);
    const aiEnabled = Boolean(process.env.OPENROUTER_API_KEY?.trim());
    const composeOpen = firstParam(searchParams?.compose) === "1";
    const offerQ = firstParam(searchParams?.offerQ);
    const offerKind = firstParam(searchParams?.offerKind);
    const offerState = firstParam(searchParams?.offerState);
    const composePrefill: PromotionComposerPrefill = {
      aiGoal: firstParam(searchParams?.aiGoal).trim(),
      aiNotes: firstParam(searchParams?.aiNotes).trim(),
      description: firstParam(searchParams?.prefillDescription).trim(),
      endsOn: firstParam(searchParams?.prefillEndsOn).trim(),
      highlight: firstParam(searchParams?.prefillHighlight).trim(),
      kind:
        firstParam(searchParams?.prefillKind) === "membership"
          ? "membership"
          : "promotion",
      price: firstParam(searchParams?.prefillPrice).trim(),
      serviceId: firstParam(searchParams?.prefillServiceId).trim(),
      sessionsIncluded: firstParam(searchParams?.prefillSessionsIncluded).trim(),
      startsOn: firstParam(searchParams?.prefillStartsOn).trim(),
      title: firstParam(searchParams?.prefillTitle).trim(),
      validityDays: firstParam(searchParams?.prefillValidityDays).trim(),
    };

    return (
      <div className="page-grid marketing-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <PromotionsPageContent
          aiEnabled={aiEnabled}
          composeOpen={composeOpen}
          composePrefill={composePrefill}
          data={data}
          offerKind={offerKind}
          offerQ={offerQ}
          offerState={offerState}
        />
      </div>
    );
  });
}
