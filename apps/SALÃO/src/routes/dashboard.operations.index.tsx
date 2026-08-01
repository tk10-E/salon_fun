import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/operations/")({
  component: () => <ModulePage moduleKey="dashboard.operations.index" title="Operações" subtitle="Hub operacional complementar e metas" />,
});
