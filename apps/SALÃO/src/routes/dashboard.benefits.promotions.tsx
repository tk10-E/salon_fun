import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/benefits/promotions")({
  component: () => <ModulePage moduleKey="dashboard.benefits.promotions" title="Campanhas" subtitle="Ofertas, disparos e retorno" />,
});
