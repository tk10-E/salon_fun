import { FlashMessage } from "@/components/FlashMessage";
import { ClientAppPageContent } from "./_components";
import { loadClientAppHubData } from "./_lib";

export type ClientAppPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function ClientAppPage({
  searchParams,
}: ClientAppPageProps) {
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
