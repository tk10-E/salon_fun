import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";
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
  return measureServerRender("dashboard.client-app", async () => {
    const [searchParams, data] = await Promise.all([
      searchParamsPromise,
      loadClientAppHubData(),
    ]);

    return (
      <div className="page-grid client-app-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <ClientAppPageContent data={data} />
      </div>
    );
  });
}
