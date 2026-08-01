import { createFileRoute } from "@tanstack/react-router";
import ModulePage from "@/components/dashboard/ModulePage";

export const Route = createFileRoute("/dashboard/inventory")({
  component: () => <ModulePage moduleKey="dashboard.inventory" title="Loja & Estoque" subtitle="Produtos, estoque e pedidos" />,
});
