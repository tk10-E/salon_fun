import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { SalonProvider } from "@/lib/salon-store";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/dashboard")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Painel — Maison Lumière" },
      { name: "description", content: "Painel de gestão do salão: agenda, clientes e caixa." },
      { property: "og:title", content: "Painel — Maison Lumière" },
      { property: "og:description", content: "Gestão completa do salão em um só lugar." },
    ],
  }),
  component: () => (
    <SalonProvider>
      <DashboardShell />
      <Toaster position="top-right" />
    </SalonProvider>
  ),
});