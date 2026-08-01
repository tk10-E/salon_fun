import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/subscriptions")({
  component: () => <ModulePage moduleKey="dashboard.subscriptions" title="Assinaturas" subtitle="Planos, pedidos e carteira ativa" />,
});
