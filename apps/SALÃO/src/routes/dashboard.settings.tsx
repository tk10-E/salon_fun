import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/settings")({
  component: () => <ModulePage moduleKey="dashboard.settings" title="Ajustes" subtitle="Marca, regras e segurança" />,
});
