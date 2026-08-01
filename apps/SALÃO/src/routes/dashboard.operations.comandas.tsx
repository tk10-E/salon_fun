import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/operations/comandas")({
  component: () => <ModulePage moduleKey="dashboard.operations.comandas" title="Comandas" subtitle="Abertura, itens, pagamentos e fechamento" />,
});
