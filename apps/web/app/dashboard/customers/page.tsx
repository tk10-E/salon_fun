import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type CustomersPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function CustomersPage({ searchParams }: CustomersPageProps) {
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.customers,
      searchParams,
    ),
  );
}
