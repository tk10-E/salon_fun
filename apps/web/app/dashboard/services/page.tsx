import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type ServicesPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function ServicesPage({ searchParams }: ServicesPageProps) {
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.services,
      searchParams,
    ),
  );
}
