import { FlashMessage } from "@/components/FlashMessage";
import { FinancePageContent } from "./_components";
import { loadFinancePageData } from "./_lib";

export type FinancePageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function FinancePage({
  searchParams: searchParamsPromise,
}: FinancePageProps) {
  const searchParams = await searchParamsPromise;
  const financePageData = await loadFinancePageData();

  return (
    <div className="page-grid finance-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <FinancePageContent data={financePageData} />
    </div>
  );
}
