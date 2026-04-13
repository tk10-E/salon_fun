import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type CustomersPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CustomersPage({ searchParams: searchParamsPromise }: CustomersPageProps) {
  const searchParams = await searchParamsPromise;
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.customers,
      searchParams,
    ),
  );
}
