import { FlashMessage } from "@/components/FlashMessage";
import { OperationsPageContent } from "./_components";
import { loadOperationsPageData } from "./_lib";

export type OperationsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};
export default async function OperationsPage({
  searchParams,
}: OperationsPageProps) {
  const operationsPageData = await loadOperationsPageData();

  return (
    <div className="page-grid operations-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <OperationsPageContent data={operationsPageData} />
    </div>
  );
}
