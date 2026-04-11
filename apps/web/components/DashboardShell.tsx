import Link from "next/link";
import type { ReactNode } from "react";

import { PanelResponseController } from "@/components/PanelResponseController";
import { SidebarNav } from "@/components/SidebarNav";
import { PanelSignOutButton } from "@/components/auth/PanelSignOutButton";
import { DashboardAccessGate } from "@/components/DashboardAccessGate";
import { type SalonBillingSnapshot } from "@/lib/billing";

type DashboardShellProps = {
  salonCode: string;
  salonName: string;
  ownerEmail?: string | null;
  billingSnapshot: SalonBillingSnapshot;
  children: ReactNode;
};

function toDisplayName(value?: string | null) {
  if (!value) {
    return "Gestão do salão";
  }

  const cleaned = value
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  if (!cleaned) {
    return "Gestão do salão";
  }

  return cleaned
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getInitials(name: string) {
  const parts = name.split(" ").filter(Boolean);

  if (parts.length === 0) {
    return "SF";
  }

  return parts
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join("");
}

function getBrandName(name: string) {
  const cleaned = name
    .trim()
    .replace(/^studio\s+/i, "")
    .trim();
  return cleaned || name;
}

export function DashboardShell({
  salonCode,
  salonName,
  ownerEmail,
  billingSnapshot,
  children,
}: DashboardShellProps) {
  const ownerName = toDisplayName(ownerEmail);
  const initials = getInitials(ownerName);
  const brandName = getBrandName(salonName);

  return (
    <div className="app-shell">
      <a href="#dashboard-main-content" className="skip-link">
        Pular para o conteúdo
      </a>

      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="sidebar-brand">
            <span className="sidebar-brand__mark" aria-hidden="true">
              <svg viewBox="0 0 32 32" aria-hidden="true">
                <path
                  d="M15.08 7.23c.38-1.44 2.46-1.44 2.84 0l.61 2.31a2 2 0 0 0 1.41 1.41l2.31.61c1.44.38 1.44 2.46 0 2.84l-2.31.61a2 2 0 0 0-1.41 1.41l-.61 2.31c-.38 1.44-2.46 1.44-2.84 0l-.61-2.31a2 2 0 0 0-1.41-1.41l-2.31-.61c-1.44-.38-1.44-2.46 0-2.84l2.31-.61a2 2 0 0 0 1.41-1.41l.61-2.31Z"
                  fill="currentColor"
                />
              </svg>
            </span>

            <div>
              <span className="eyebrow">Painel</span>
              <h1>{brandName}</h1>
              <small className="sidebar-brand__detail">
                Gestão central
              </small>
            </div>
          </div>
        </div>

        <SidebarNav
          isWorkspaceLocked={billingSnapshot.isLocked}
          allowedPathsWhenLocked={billingSnapshot.allowedPathsWhenLocked}
        />

        <div className="sidebar-footer">
          <div className="sidebar-code-card">
            <span className="eyebrow">Código de entrada</span>
            <strong>{salonCode}</strong>
            <p className="muted">
              Use no app para conectar novas clientes.
            </p>
            <div className="sidebar-code-card__actions">
              <Link
                href={`/s/${salonCode}`}
                className="sidebar-code-card__link"
              >
                Ver vitrine
              </Link>
              <Link
                href="/dashboard/settings"
                className="sidebar-code-card__link sidebar-code-card__link--ghost"
              >
                Ajustar app
              </Link>
            </div>
          </div>

          <PanelSignOutButton />
        </div>
      </aside>

      <div className="content-area">
        <PanelResponseController />

        <header className="page-header">
          <div className="page-header__actions">
            <div className="page-header__profile">
              <span className="page-header__avatar" aria-hidden="true">
                {initials}
              </span>

              <div className="page-header__profile-copy">
                <strong>{ownerName}</strong>
                <span>Gestão</span>
              </div>
            </div>

            <Link href="/dashboard/settings" className="secondary-button">
              Configurações
            </Link>
          </div>
        </header>

        <main
          id="dashboard-main-content"
          className="dashboard-main dashboard-main--simple"
          tabIndex={-1}
        >
          <div className="dashboard-main__surface">
            {children}
            <DashboardAccessGate
              isLocked={billingSnapshot.isLocked}
              allowedPaths={billingSnapshot.allowedPathsWhenLocked}
              title="Algumas áreas do painel estão indisponíveis"
              description="Use o início do painel e os ajustes do app enquanto o acesso operacional dessas áreas estiver pausado."
            />
          </div>
        </main>
      </div>
    </div>
  );
}
