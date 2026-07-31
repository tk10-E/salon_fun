import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";
import { FeedPageContent, type FeedComposerPrefill } from "./_components";
import { loadFeedPageData } from "./_lib";

type SearchParamValue = string | string[] | undefined;

export type FeedPageProps = {
  searchParams?: Promise<{
    aiNotes?: SearchParamValue;
    message?: string;
    prefillCaption?: SearchParamValue;
    prefillPostType?: SearchParamValue;
    prefillServiceId?: SearchParamValue;
    prefillStaffMemberId?: SearchParamValue;
    prefillTitle?: SearchParamValue;
    tone?: string;
  }>;
};

function firstParam(value?: SearchParamValue) {
  return Array.isArray(value) ? (value[0] ?? "") : (value ?? "");
}

function resolvePrefillPostType(value: string): FeedComposerPrefill["postType"] {
  if (
    value === "standard" ||
    value === "before_after" ||
    value === "reel" ||
    value === "story"
  ) {
    return value;
  }

  return "standard";
}

export default async function FeedPage({ searchParams: searchParamsPromise }: FeedPageProps) {
  return measureServerRender("dashboard.feed", async () => {
    const [searchParams, feedPageData] = await Promise.all([
      searchParamsPromise,
      loadFeedPageData(),
    ]);
    const prefill: FeedComposerPrefill = {
      aiNotes: firstParam(searchParams?.aiNotes).trim(),
      caption: firstParam(searchParams?.prefillCaption).trim(),
      postType: resolvePrefillPostType(
        firstParam(searchParams?.prefillPostType).trim(),
      ),
      serviceId: firstParam(searchParams?.prefillServiceId).trim(),
      staffMemberId: firstParam(searchParams?.prefillStaffMemberId).trim(),
      title: firstParam(searchParams?.prefillTitle).trim(),
    };

    return (
      <div className="page-grid feed-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <FeedPageContent
          aiEnabled={Boolean(process.env.OPENROUTER_API_KEY?.trim())}
          data={feedPageData}
          prefill={prefill}
        />
      </div>
    );
  });
}
