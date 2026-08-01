import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/benefits/automations")({
  component: () => <ModulePage moduleKey="dashboard.benefits.automations" title="Automações" subtitle="Crescimento e retorno automáticos" />,
});
