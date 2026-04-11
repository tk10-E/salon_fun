import { FlashMessage } from "@/components/FlashMessage";
import { NotificationsPageContent } from "./_components";
import {
  loadNotificationsPageData,
  type NotificationsPageSearchParams,
} from "./_lib";

export type NotificationsPageProps = {
  searchParams?: NotificationsPageSearchParams;
};

export default async function NotificationsPage({
  searchParams,
}: NotificationsPageProps) {
  const notificationsPageData = await loadNotificationsPageData(searchParams);

  return (
    <div className="page-grid notifications-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}
      <NotificationsPageContent data={notificationsPageData} />
    </div>
  );
}
