import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/dashboard/team")({
  beforeLoad: () => {
    throw redirect({ to: "/dashboard/gestao/profissionais" });
  },
});
