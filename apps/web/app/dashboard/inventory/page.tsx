import { FlashMessage } from "@/components/FlashMessage";
import { InventoryPageContent } from "./page-content";
import { loadInventoryPageData } from "./_lib";

export type InventoryPageProps = {
  searchParams?: Promise<{
    brand?: string;
    category?: string;
    compose?: string;
    message?: string;
    q?: string;
    sort?: string;
    status?: string;
    tone?: string;
  }>;
};

export default async function InventoryPage({ searchParams: searchParamsPromise }: InventoryPageProps) {
  const [searchParams, inventoryPageData] = await Promise.all([
    searchParamsPromise,
    loadInventoryPageData(),
  ]);

  return (
    <div className="page-grid workspace-page inventory-page inventory-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <InventoryPageContent data={inventoryPageData} searchParams={searchParams} />
    </div>
  );
}
