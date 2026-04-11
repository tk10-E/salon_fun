import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type TeamPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function TeamPage({ searchParams }: TeamPageProps) {
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.team,
      searchParams,
    ),
  );
}
