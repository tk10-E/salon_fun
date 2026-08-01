import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/notifications/")({
  component: () => <ModulePage moduleKey="dashboard.notifications.index" title="Notificações" subtitle="Central de avisos do painel" />,
});
