import { FlashMessage } from "@/components/FlashMessage";
import { InventoryPageContent } from "./_components";
import { loadInventoryPageData } from "./_lib";

export type InventoryPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function InventoryPage({ searchParams: searchParamsPromise }: InventoryPageProps) {
  const searchParams = await searchParamsPromise;
  const inventoryPageData = await loadInventoryPageData();

  return (
    <div className="page-grid workspace-page inventory-page inventory-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <InventoryPageContent data={inventoryPageData} />
    </div>
  );
}
