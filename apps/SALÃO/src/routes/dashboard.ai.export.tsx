import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/ai/export")({
  component: () => <ModulePage moduleKey="dashboard.ai.export" title="Exportar dados de IA" subtitle="Baixe o histórico de uso" />,
});
