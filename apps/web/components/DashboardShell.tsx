"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";

import { DashboardContentChrome } from "@/components/DashboardContentChrome";
import { DashboardIdentityAvatar } from "@/components/DashboardIdentityAvatar";
import { DashboardLiveSync } from "@/components/DashboardLiveSync";
import { PanelResponseController } from "@/components/PanelResponseController";
import { SidebarNav } from "@/components/SidebarNav";
import { PanelSignOutButton } from "@/components/auth/PanelSignOutButton";
import { type SalonBillingSnapshot } from "@/lib/billing";

type DashboardShellProps = {
  salonId: string;
  salonCode: string;
  salonName: string;
  ownerEmail?: string | null;
  ownerDisplayName?: string | null;
  salonLogoUrl?: string | null;
  ownerAvatarUrl?: string | null;
  billingSnapshot: SalonBillingSnapshot;
  children: ReactNode;
};

function normalizeText(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();
  return normalized.length > 0 ? normalized : null;
}

function toDisplayName(value?: string | null) {
  const normalizedValue = normalizeText(value);

  if (!normalizedValue) {
    return "Gestão do salão";
  }

  if (!normalizedValue.includes("@")) {
    return normalizedValue;
  }

  const cleaned = normalizedValue
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

function resolveOwnerAvatarAlt(ownerName: string) {
  return `Foto de ${ownerName}`;
}

function resolveSidebarBrandAlt(
  ownerName: string,
  brandName: string,
  ownerAvatarUrl?: string | null,
  salonLogoUrl?: string | null,
) {
  if (normalizeText(ownerAvatarUrl)) {
    return resolveOwnerAvatarAlt(ownerName);
  }

  return normalizeText(salonLogoUrl)
    ? `Marca do ${brandName}`
    : `Perfil de ${ownerName}`;
}

export function DashboardShell({
  salonId,
  salonCode,
  salonName,
  ownerEmail,
  ownerDisplayName,
  salonLogoUrl,
  ownerAvatarUrl,
  billingSnapshot,
  children,
}: DashboardShellProps) {
  const pathname = usePathname();
  const mobileNavigationId = useId();
  const ownerName = toDisplayName(ownerDisplayName ?? ownerEmail);
  const ownerInitials = getInitials(ownerName);
  const brandName = getBrandName(salonName);
  const isBillingLocked = billingSnapshot.isLocked;
  const [isMobileNavigationOpen, setIsMobileNavigationOpen] = useState(false);

  useEffect(() => {
    setIsMobileNavigationOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const desktopMediaQuery = window.matchMedia("(min-width: 961px)");
    const handleDesktopLayout = (event: MediaQueryListEvent) => {
      if (event.matches) {
        setIsMobileNavigationOpen(false);
      }
    };

    desktopMediaQuery.addEventListener("change", handleDesktopLayout);
    return () => {
      desktopMediaQuery.removeEventListener("change", handleDesktopLayout);
    };
  }, []);

  useEffect(() => {
    if (!isMobileNavigationOpen || typeof document === "undefined") {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isMobileNavigationOpen]);

  useEffect(() => {
    if (!isMobileNavigationOpen || typeof window === "undefined") {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMobileNavigationOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMobileNavigationOpen]);

  return (
    <div
      className={
        isMobileNavigationOpen
          ? "app-shell app-shell--mobile-nav-open"
          : "app-shell"
      }
    >
      <a href="#dashboard-main-content" className="skip-link">
        Pular para o conteúdo
      </a>
      <DashboardLiveSync salonId={salonId} />

      <div className="dashboard-mobile-bar">
        <button
          type="button"
          className="dashboard-mobile-bar__toggle"
          aria-expanded={isMobileNavigationOpen}
          aria-controls={mobileNavigationId}
          aria-label={
            isMobileNavigationOpen
              ? "Fechar menu do painel"
              : "Abrir menu do painel"
          }
          onClick={() =>
            setIsMobileNavigationOpen((currentValue) => !currentValue)
          }
        >
          <span className="dashboard-mobile-bar__toggle-lines" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        </button>

        <Link
          href="/dashboard"
          className="dashboard-mobile-bar__brand"
          onClick={() => setIsMobileNavigationOpen(false)}
        >
          <DashboardIdentityAvatar
            imageUrl={ownerAvatarUrl}
            fallbackImageUrl={salonLogoUrl}
            alt={resolveSidebarBrandAlt(
              ownerName,
              brandName,
              ownerAvatarUrl,
              salonLogoUrl,
            )}
            fallbackImageAlt={`Marca do ${brandName}`}
            fallbackText={ownerInitials}
            className="dashboard-mobile-bar__avatar"
            imageClassName="dashboard-mobile-bar__avatar-image"
            fallbackClassName="dashboard-mobile-bar__avatar--fallback"
          />

          <span className="dashboard-mobile-bar__brand-copy">
            <strong>{brandName}</strong>
            <span>{ownerName}</span>
          </span>
        </Link>

        <Link
          href="/dashboard/settings"
          className="dashboard-mobile-bar__shortcut"
          onClick={() => setIsMobileNavigationOpen(false)}
        >
          Ajustes
        </Link>
      </div>

      <button
        type="button"
        className="dashboard-mobile-backdrop"
        aria-hidden={!isMobileNavigationOpen}
        tabIndex={isMobileNavigationOpen ? 0 : -1}
        onClick={() => setIsMobileNavigationOpen(false)}
      />

      <aside
        id={mobileNavigationId}
        className="sidebar"
        aria-label="Menu principal do painel"
      >
        <div className="sidebar-mobile-toolbar">
          <span className="sidebar-mobile-toolbar__label">Menu do painel</span>
          <button
            type="button"
            className="sidebar-mobile-toolbar__close"
            onClick={() => setIsMobileNavigationOpen(false)}
          >
            Fechar
          </button>
        </div>

        <div className="sidebar-top">
          <div className="sidebar-brand">
            <DashboardIdentityAvatar
              imageUrl={ownerAvatarUrl}
              fallbackImageUrl={salonLogoUrl}
              alt={resolveSidebarBrandAlt(
                ownerName,
                brandName,
                ownerAvatarUrl,
                salonLogoUrl,
              )}
              fallbackImageAlt={`Marca do ${brandName}`}
              fallbackText={ownerInitials}
              className="sidebar-brand__mark"
              imageClassName="sidebar-brand__mark-image"
              fallbackClassName="sidebar-brand__mark--fallback"
            />

            <div className="sidebar-brand__content">
              <span className="eyebrow">Painel</span>
              <h1>{ownerName}</h1>
              <small className="sidebar-brand__detail">{brandName}</small>
            </div>
          </div>
        </div>

        <SidebarNav
          isWorkspaceLocked={billingSnapshot.isLocked}
          allowedPathsWhenLocked={billingSnapshot.allowedPathsWhenLocked}
          onNavigate={() => setIsMobileNavigationOpen(false)}
        />

        <div className="sidebar-footer">
          {isBillingLocked ? (
            <div className="sidebar-code-card">
              <span className="eyebrow">Ativação pendente</span>
              <strong>Liberar painel</strong>
              <p className="muted">
                Escolha um plano para liberar o uso completo do painel.
              </p>
              <div className="sidebar-code-card__actions">
                <Link href="/planos" className="sidebar-code-card__link">
                  Escolher plano
                </Link>
              </div>
            </div>
          ) : (
            <div className="sidebar-code-card">
              <span className="eyebrow">Código do app</span>
              <strong>{salonCode}</strong>
              <p className="muted">Use no app para conectar clientes ao salão.</p>
              <div className="sidebar-code-card__actions">
                <Link href={`/s/${salonCode}`} className="sidebar-code-card__link">
                  Ver vitrine
                </Link>
              </div>
            </div>
          )}

          <PanelSignOutButton />
        </div>
      </aside>

      <div className="content-area">
        <PanelResponseController />
        <DashboardContentChrome
          ownerName={ownerName}
          ownerInitials={ownerInitials}
          ownerAvatarUrl={ownerAvatarUrl}
          isBillingLocked={billingSnapshot.isLocked}
          allowedPathsWhenLocked={billingSnapshot.allowedPathsWhenLocked}
        >
          {children}
        </DashboardContentChrome>
      </div>
    </div>
  );
}
