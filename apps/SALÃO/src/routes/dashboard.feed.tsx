import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/feed")({
  component: () => <ModulePage moduleKey="dashboard.feed" title="Feed" subtitle="Posts e stories do salão" />,
});
