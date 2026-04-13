import { FlashMessage } from "@/components/FlashMessage";
import { ClientAppPageContent } from "./_components";
import { loadClientAppHubData } from "./_lib";

export type ClientAppPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function ClientAppPage({
  searchParams: searchParamsPromise,
}: ClientAppPageProps) {
  const searchParams = await searchParamsPromise;
  const data = await loadClientAppHubData();

  return (
    <div className="page-grid client-app-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <ClientAppPageContent data={data} />
    </div>
  );
}
