import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/gestao/comissoes")({
  component: () => <ModulePage moduleKey="dashboard.gestao.comissoes" title="Comissões" subtitle="Cálculo por período e ranking da equipe" />,
});
