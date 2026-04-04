import Link from "next/link";
import type { ReactNode } from "react";

import { DashboardAccessGate } from "@/components/DashboardAccessGate";
import { SidebarNav } from "@/components/SidebarNav";
import { PanelSignOutButton } from "@/components/auth/PanelSignOutButton";
import type { SalonBillingSnapshot } from "@/lib/billing";

type DashboardShellProps = {
  salonCode: string;
  salonName: string;
  ownerEmail?: string | null;
  billingSnapshot: SalonBillingSnapshot;
  children: ReactNode;
};

function toDisplayName(value?: string | null) {
  if (!value) {
    return "Gestao do salao";
  }

  const cleaned = value
    .split("@")[0]
    .replace(/[._-]+/g, " ")
    .trim();

  if (!cleaned) {
    return "Gestao do salao";
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

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M10.5 4.75a5.75 5.75 0 1 0 0 11.5a5.75 5.75 0 0 0 0-11.5Zm0-1.5a7.25 7.25 0 1 1 0 14.5a7.25 7.25 0 0 1 0-14.5Zm10.03 15.72l-4.18-4.18l1.06-1.06l4.18 4.18l-1.06 1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M7.72 9.47a.75.75 0 0 1 1.06 0L12 12.69l3.22-3.22a.75.75 0 1 1 1.06 1.06l-3.75 3.75a.75.75 0 0 1-1.06 0l-3.75-3.75a.75.75 0 0 1 0-1.06Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getBrandName(name: string) {
  const cleaned = name.trim().replace(/^studio\s+/i, "").trim();
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
              <span className="eyebrow">Studio</span>
              <h1>{brandName}</h1>
              <small className="sidebar-brand__detail">Painel executivo do salão</small>
            </div>
          </div>
        </div>

        <SidebarNav
          isWorkspaceLocked={billingSnapshot.isLocked}
          allowedPathsWhenLocked={billingSnapshot.allowedPathsWhenLocked}
        />

        <div className="sidebar-footer">
          <div className="sidebar-code-card">
            <span className="eyebrow">Código do salão</span>
            <strong>{salonCode}</strong>
            <p className="muted">Compartilhe esse código com novos clientes para liberar o app.</p>
            <div className="sidebar-code-card__actions">
              <Link href={`/s/${salonCode}`} className="sidebar-code-card__link">
                Ver vitrine pública
              </Link>
              <Link href="/dashboard/settings" className="sidebar-code-card__link sidebar-code-card__link--ghost">
                Ajustar app do cliente
              </Link>
            </div>
          </div>

          <div className="sidebar-billing-card">
            <span className="eyebrow">Assinatura</span>
            <strong>
              {billingSnapshot.currentPlan.displayName}
              {" "}
              <small>{billingSnapshot.statusLabel}</small>
            </strong>
            <p className="muted">{billingSnapshot.statusDetail}</p>
            <Link href="/dashboard/billing" className="sidebar-code-card__link">
              Gerenciar cobrança
            </Link>
          </div>

          <PanelSignOutButton />
        </div>
      </aside>

      <div className="content-area">
        <header className="page-header">
          <form action="/dashboard/appointments" className="dashboard-search" role="search">
            <span className="dashboard-search__icon">
              <SearchIcon />
            </span>
            <input
              type="search"
              name="q"
              placeholder="Buscar cliente, serviço, profissional ou campanha"
              aria-label="Pesquisar no painel"
            />
          </form>

          <div className="page-header__actions">
            <div className="page-header__status" aria-label="Status do painel">
              <span className="page-header__status-dot" aria-hidden="true" />
              <div className="page-header__status-copy">
                <strong>Ao vivo</strong>
                <span>Dados de produção</span>
              </div>
            </div>

            <div className="page-header__profile">
              <span className="page-header__avatar" aria-hidden="true">
                {initials}
              </span>

              <div className="page-header__profile-copy">
                <strong>{ownerName}</strong>
                <span>Gerente</span>
              </div>
            </div>

            <Link href="/dashboard/settings" className="header-circle-button" aria-label="Abrir ajustes do painel">
              <ChevronIcon />
            </Link>
          </div>
        </header>

        <main id="dashboard-main-content" className="dashboard-main" tabIndex={-1}>
          {billingSnapshot.shouldShowBanner && billingSnapshot.bannerTitle && billingSnapshot.bannerMessage ? (
            <section
              className={`dashboard-billing-banner dashboard-billing-banner--${billingSnapshot.bannerTone}`}
              aria-label="Status da assinatura"
            >
              <div className="dashboard-billing-banner__copy">
                <strong>{billingSnapshot.bannerTitle}</strong>
                <p>{billingSnapshot.bannerMessage}</p>
              </div>
              <Link href="/dashboard/billing" className="secondary-button">
                Abrir billing
              </Link>
            </section>
          ) : null}

          <div className="dashboard-main__surface">
            {children}
            <DashboardAccessGate
              isLocked={billingSnapshot.isLocked}
              allowedPaths={billingSnapshot.allowedPathsWhenLocked}
              title="Regularize sua assinatura para continuar operando"
              description="O painel continua disponível para cobrança e ajustes, mas as áreas operacionais ficam bloqueadas até a assinatura voltar para ativa."
            />
          </div>
        </main>
      </div>
    </div>
  );
}
