import { Link, Outlet, useRouterState } from "@tanstack/react-router";
import { Menu, Plus, Search, Bell } from "lucide-react";
import { useState } from "react";
import { navGroups } from "./nav-config";
import { useSalon } from "@/lib/salon-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { NewAppointmentDialog } from "./NewAppointmentDialog";

export function DashboardShell() {
  const { settings } = useSalon();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);
  const [newApt, setNewApt] = useState(false);

  const dateLabel = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 flex w-64 flex-col gap-7 overflow-y-auto border-r border-border bg-sidebar p-6 transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <Link to="/dashboard" className="flex items-center gap-3 px-2">
          <span className="grid size-8 place-items-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
            {settings.logoText}
          </span>
          <span className="font-display text-2xl tracking-tight">{settings.name}</span>
        </Link>

        {navGroups.map((group) => (
          <div key={group.title} className="flex flex-col gap-1">
            <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
              {group.title}
            </p>
            {group.items.map((item) => {
              const active =
                item.to === "/dashboard" ? pathname === "/dashboard" : pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setOpen(false)}
                  className={cn(
                    "rounded-lg px-3 py-2 text-sm transition-colors",
                    active
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        ))}

        <div className="mt-auto rounded-xl bg-foreground p-4 text-background">
          <p className="text-xs opacity-60">Plano Profissional</p>
          <p className="mb-3 font-medium">Renova em 12 dias</p>
          <Link
            to="/dashboard/billing"
            className="block w-full rounded-lg bg-primary py-2 text-center text-xs font-bold uppercase tracking-wider text-primary-foreground"
          >
            Gerenciar
          </Link>
        </div>
      </aside>

      {open && (
        <button
          aria-label="Fechar menu"
          className="fixed inset-0 z-30 bg-foreground/20 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/90 px-6 backdrop-blur">
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setOpen(true)} aria-label="Abrir menu">
              <Menu className="size-5" />
            </button>
            <div className="hidden sm:block">
              <p className="text-sm font-medium capitalize">{dateLabel}</p>
              <p className="text-xs text-muted-foreground">{settings.segment}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 rounded-full border border-border px-3 py-2 md:flex">
              <Search className="size-3.5 text-muted-foreground" />
              <input
                placeholder="Buscar cliente, serviço..."
                className="w-48 bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              />
            </div>
            <Link
              to="/dashboard/notifications"
              className="grid size-9 place-items-center rounded-full border border-border"
            >
              <Bell className="size-4" />
            </Link>
            <Button className="rounded-full" onClick={() => setNewApt(true)}>
              <Plus className="size-4" /> Novo agendamento
            </Button>
          </div>
        </header>

        <main className="flex-1 p-6 lg:p-10">
          <Outlet />
        </main>
      </div>

      <NewAppointmentDialog open={newApt} onOpenChange={setNewApt} />
    </div>
  );
}