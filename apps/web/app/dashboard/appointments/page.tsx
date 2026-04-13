import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type AppointmentsPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function AppointmentsPage({
  searchParams: searchParamsPromise,
}: AppointmentsPageProps) {
  const searchParams = await searchParamsPromise;
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.appointments,
      searchParams,
    ),
  );
}
