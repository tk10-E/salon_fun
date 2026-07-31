"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { DashboardAccessGate } from "@/components/DashboardAccessGate";
import { DashboardIdentityAvatar } from "@/components/DashboardIdentityAvatar";

type DashboardContentChromeProps = {
  ownerName: string;
  ownerInitials: string;
  ownerAvatarUrl?: string | null;
  isBillingLocked: boolean;
  allowedPathsWhenLocked: readonly string[];
  children: ReactNode;
};

function resolveOwnerAvatarAlt(ownerName: string) {
  return `Foto de ${ownerName}`;
}

function isFocusedRoute(pathname: string) {
  return (
    pathname === "/dashboard/gestao/clientes" ||
    pathname === "/dashboard/gestao/servicos" ||
    pathname === "/dashboard/gestao/profissionais" ||
    pathname === "/dashboard/inventory"
  );
}

function shouldUseExpandedCanvas(pathname: string) {
  return pathname === "/dashboard" || isFocusedRoute(pathname);
}

export function DashboardContentChrome({
  ownerName,
  ownerInitials,
  ownerAvatarUrl,
  isBillingLocked,
  allowedPathsWhenLocked,
  children,
}: DashboardContentChromeProps) {
  const pathname = usePathname();
  const isFocusedWorkspace = isFocusedRoute(pathname);
  const isExpandedCanvas = shouldUseExpandedCanvas(pathname);

  return (
    <>
      {!isFocusedWorkspace ? (
        <header className="page-header">
          <div className="page-header__actions">
            <div className="page-header__profile">
              <DashboardIdentityAvatar
                imageUrl={ownerAvatarUrl}
                alt={resolveOwnerAvatarAlt(ownerName)}
                fallbackText={ownerInitials}
                className="page-header__avatar"
                imageClassName="page-header__avatar-image"
                fallbackClassName="page-header__avatar--fallback"
              />

              <div className="page-header__profile-copy">
                <strong>{ownerName}</strong>
                <span>Painel</span>
              </div>
            </div>
          </div>
        </header>
      ) : null}

      <main
        id="dashboard-main-content"
        className={`dashboard-main dashboard-main--simple${
          isExpandedCanvas ? " dashboard-main--wide" : ""
        }`}
        tabIndex={-1}
      >
        <div className="dashboard-main__surface">
          {children}
          <DashboardAccessGate
            isLocked={isBillingLocked}
            allowedPaths={allowedPathsWhenLocked}
            title="Ative a assinatura para liberar o painel"
            description="Agenda, clientes, caixa e campanhas sao liberados automaticamente depois da assinatura."
          />
        </div>
      </main>
    </>
  );
}
