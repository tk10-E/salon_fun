import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/benefits/referrals")({
  component: () => <ModulePage moduleKey="dashboard.benefits.referrals" title="Indicações" subtitle="Indicação e resgate de recompensa" />,
});
