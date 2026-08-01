import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/billing")({
  component: () => <ModulePage moduleKey="dashboard.billing" title="Billing" subtitle="Assinatura do sistema do salão" />,
});
