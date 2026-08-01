import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Maison Lumière — Painel de gestão para salões" },
      {
        name: "description",
        content:
          "Painel completo para salões: agenda, clientes, caixa, equipe, campanhas e app do cliente personalizável.",
      },
      { property: "og:title", content: "Maison Lumière — Painel de gestão para salões" },
      {
        property: "og:description",
        content: "Agenda, clientes, caixa, equipe e app do cliente totalmente personalizável.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  return (
    <div className="grid min-h-screen place-items-center bg-background px-6">
      <div className="max-w-xl text-center">
        <span className="mx-auto mb-6 grid size-12 place-items-center rounded-full bg-primary font-medium text-primary-foreground">
          ML
        </span>
        <h1 className="font-display text-5xl tracking-tight">Maison Lumière</h1>
        <p className="mt-3 text-muted-foreground">
          Gestão completa do seu salão: agenda, clientes, caixa, equipe, campanhas e um app do
          cliente que você personaliza do jeito que quiser.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/dashboard"
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Entrar no painel
          </Link>
          <Link
            to="/dashboard/client-app"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium"
          >
            Personalizar app do cliente
          </Link>
        </div>
      </div>
    </div>
  );
}
