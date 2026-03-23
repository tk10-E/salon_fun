import type { ReactNode } from "react";

import { signOutAction } from "@/app/actions";
import { SidebarNav } from "@/components/SidebarNav";

type DashboardShellProps = {
  salonCode: string;
  salonName: string;
  children: ReactNode;
};

export function DashboardShell({ salonCode, salonName, children }: DashboardShellProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <span className="eyebrow">Salon Fun</span>
          <h1>{salonName}</h1>
          <p className="muted">Organize atendimentos, serviços e clientes com mais clareza.</p>
        </div>

        <div className="sidebar-code-card">
          <span className="eyebrow">Código para clientes</span>
          <strong>{salonCode}</strong>
          <p className="muted">Compartilhe este código para liberar o app do seu salão.</p>
        </div>

        <SidebarNav />
      </aside>

      <div className="content-area">
        <header className="page-header">
          <div>
            <span className="eyebrow">Central do salão</span>
            <p className="muted">Tudo o que você precisa para acompanhar a agenda do dia.</p>
          </div>

          <form action={signOutAction}>
            <button type="submit" className="secondary-button">
              Sair
            </button>
          </form>
        </header>

        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
