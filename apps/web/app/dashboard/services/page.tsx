import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type ServicesPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function ServicesPage({ searchParams: searchParamsPromise }: ServicesPageProps) {
  const searchParams = await searchParamsPromise;
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.services,
      searchParams,
    ),
  );
}
