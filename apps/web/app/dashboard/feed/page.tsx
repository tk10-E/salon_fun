import { FlashMessage } from "@/components/FlashMessage";
import { FeedPageContent } from "./_components";
import { loadFeedPageData } from "./_lib";

export type FeedPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function FeedPage({ searchParams: searchParamsPromise }: FeedPageProps) {
  const searchParams = await searchParamsPromise;
  const feedPageData = await loadFeedPageData();

  return (
    <div className="page-grid feed-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <FeedPageContent data={feedPageData} />
    </div>
  );
}
