import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type TeamPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamPage({ searchParams: searchParamsPromise }: TeamPageProps) {
  const searchParams = await searchParamsPromise;
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.team,
      searchParams,
    ),
  );
}
