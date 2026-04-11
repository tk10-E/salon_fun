import { redirect } from "next/navigation";

import {
  LEGACY_MANAGEMENT_ROUTES,
  buildLegacyManagementRedirectPath,
} from "@/lib/management-navigation";

type AppointmentsPageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function AppointmentsPage({
  searchParams,
}: AppointmentsPageProps) {
  redirect(
    buildLegacyManagementRedirectPath(
      LEGACY_MANAGEMENT_ROUTES.appointments,
      searchParams,
    ),
  );
}
