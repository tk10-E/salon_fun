import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";
import { OperationsPageContent } from "./_components";
import { loadOperationsPageData } from "./_lib";

export type OperationsPageProps = {
  searchParams?: Promise<{
    message?: string;
    orderState?: string;
    tone?: string;
  }>;
};
export default async function OperationsPage({
  searchParams: searchParamsPromise,
}: OperationsPageProps) {
  return measureServerRender("dashboard.operations", async () => {
    const [searchParams, operationsPageData] = await Promise.all([
      searchParamsPromise,
      loadOperationsPageData(),
    ]);

    return (
      <div className="page-grid operations-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <OperationsPageContent data={operationsPageData} searchParams={searchParams} />
      </div>
    );
  });
}
