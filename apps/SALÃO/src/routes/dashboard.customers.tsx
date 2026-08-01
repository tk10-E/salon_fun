import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/customers")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/gestao/clientes" });
  },
});
