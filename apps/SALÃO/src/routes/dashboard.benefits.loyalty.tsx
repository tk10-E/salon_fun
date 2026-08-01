import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/benefits/loyalty")({
  component: () => <ModulePage moduleKey="dashboard.benefits.loyalty" title="Fidelidade" subtitle="Programa de pontos e recompensas" />,
});
