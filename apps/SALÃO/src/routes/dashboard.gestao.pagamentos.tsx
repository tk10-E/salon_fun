import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/gestao/pagamentos")({
  component: () => <ModulePage moduleKey="dashboard.gestao.pagamentos" title="Pagamentos" subtitle="Filtre, registre e confira recebimentos" />,
});
