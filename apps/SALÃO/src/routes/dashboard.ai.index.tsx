import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/ai/")({
  component: () => <ModulePage moduleKey="dashboard.ai.index" title="IA" subtitle="Histórico e métricas do assistente" />,
});
