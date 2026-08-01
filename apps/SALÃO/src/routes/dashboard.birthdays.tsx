import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/birthdays")({
  component: () => <ModulePage moduleKey="dashboard.birthdays" title="Aniversários" subtitle="Clientes do mês e mensagens" />,
});
