import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/appointments")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/gestao/agendamentos" });
  },
});
