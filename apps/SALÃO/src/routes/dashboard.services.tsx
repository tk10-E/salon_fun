import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/services")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/gestao/servicos" });
  },
});
