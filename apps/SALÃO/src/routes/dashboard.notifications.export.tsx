import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/notifications/export")({
  component: () => <ModulePage moduleKey="dashboard.notifications.export" title="Exportar notificações" subtitle="Baixe o histórico em CSV" />,
});
