import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/benefits/")({
  component: () => <ModulePage moduleKey="dashboard.benefits.index" title="Benefícios" subtitle="Visão geral comercial" />,
});
