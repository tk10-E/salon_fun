import { FlashMessage } from "@/components/FlashMessage";
import { measureServerRender } from "@/lib/serverPerformance";
import { NotificationsPageContent } from "./_components";
import {
  loadNotificationsPageData,
  type NotificationsPageSearchParams,
} from "./_lib";

export type NotificationsPageProps = {
  searchParams?: Promise<NotificationsPageSearchParams>;
};

export default async function NotificationsPage({
  searchParams: searchParamsPromise,
}: NotificationsPageProps) {
  return measureServerRender("dashboard.notifications", async () => {
    const searchParams = await searchParamsPromise;
    const notificationsPageData = await loadNotificationsPageData(searchParams);

    return (
      <div className="page-grid notifications-simple">
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}
        <NotificationsPageContent data={notificationsPageData} />
      </div>
    );
  });
}
