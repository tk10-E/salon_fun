import { FlashMessage } from "@/components/FlashMessage";
import { FeedPageContent } from "./_components";
import { loadFeedPageData } from "./_lib";

export type FeedPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function FeedPage({ searchParams }: FeedPageProps) {
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
