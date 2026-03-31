"use client";

import Link from "next/link";
import { MouseEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: string;
};

const primaryLinks: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", description: "Visao geral", icon: "home" },
  { href: "/dashboard/appointments", label: "Agenda", description: "Agendamentos", icon: "calendar" },
  { href: "/dashboard/customers", label: "Clientes", description: "CRM do salao", icon: "users" },
  { href: "/dashboard/services", label: "Serviços", description: "Catalogo", icon: "sparkles" },
  { href: "/dashboard/team", label: "Profissionais", description: "Equipe", icon: "team" },
  { href: "/dashboard/operations", label: "Financeiro", description: "Caixa e estoque", icon: "chart" },
  { href: "/dashboard/benefits", label: "Relatórios", description: "Retencao", icon: "bolt" },
];

const links = [...primaryLinks];

function NavIcon({ name }: { name: string }) {
  switch (name) {
    case "calendar":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7 3.75a.75.75 0 0 1 .75.75V6h8.5V4.5a.75.75 0 0 1 1.5 0V6h.25A2.75 2.75 0 0 1 20.75 8.75v9.5A2.75 2.75 0 0 1 18 21H6a2.75 2.75 0 0 1-2.75-2.75v-9.5A2.75 2.75 0 0 1 6 6h.25V4.5A.75.75 0 0 1 7 3.75Zm11 7.75h-12v6.75c0 .69.56 1.25 1.25 1.25h10.5c.69 0 1.25-.56 1.25-1.25V11.5Zm-10.75-4A1.25 1.25 0 0 0 6 8.75V10h12V8.75c0-.69-.56-1.25-1.25-1.25H7.25Z"
            fill="currentColor"
          />
        </svg>
      );
    case "users":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M9.5 6.25a3.25 3.25 0 1 1 0 6.5a3.25 3.25 0 0 1 0-6.5Zm0 1.5a1.75 1.75 0 1 0 0 3.5a1.75 1.75 0 0 0 0-3.5Zm7.25.5a2.5 2.5 0 1 1 0 5a.75.75 0 0 1 0-1.5a1 1 0 1 0 0-2a.75.75 0 0 1 0-1.5ZM3.75 18A4.75 4.75 0 0 1 8.5 13.25h2A4.75 4.75 0 0 1 15.25 18a.75.75 0 0 1-1.5 0a3.25 3.25 0 0 0-3.25-3.25h-2A3.25 3.25 0 0 0 5.25 18a.75.75 0 0 1-1.5 0Zm11-.5a.75.75 0 0 1 .75-.75h.5A3.25 3.25 0 0 1 19.25 20a.75.75 0 0 1-1.5 0a1.75 1.75 0 0 0-1.75-1.75h-.5a.75.75 0 0 1-.75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "sparkles":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.23 4.54c.28-1.06 1.8-1.06 2.08 0l.46 1.74a1.5 1.5 0 0 0 1.06 1.06l1.74.46c1.06.28 1.06 1.8 0 2.08l-1.74.46a1.5 1.5 0 0 0-1.06 1.06l-.46 1.74c-.28 1.06-1.8 1.06-2.08 0l-.46-1.74a1.5 1.5 0 0 0-1.06-1.06l-1.74-.46c-1.06-.28-1.06-1.8 0-2.08l1.74-.46a1.5 1.5 0 0 0 1.06-1.06l.46-1.74Zm6.72 9.72c.18-.68 1.15-.68 1.33 0l.22.83c.12.43.45.76.88.88l.83.22c.68.18.68 1.15 0 1.33l-.83.22a1.25 1.25 0 0 0-.88.88l-.22.83c-.18.68-1.15.68-1.33 0l-.22-.83a1.25 1.25 0 0 0-.88-.88l-.83-.22c-.68-.18-.68-1.15 0-1.33l.83-.22c.43-.12.76-.45.88-.88l.22-.83Zm-9.9 2.36c.21-.8 1.35-.8 1.56 0l.29 1.08c.14.54.56.96 1.1 1.1l1.08.29c.8.21.8 1.35 0 1.56l-1.08.29c-.54.14-.96.56-1.1 1.1l-.29 1.08c-.21.8-1.35.8-1.56 0l-.29-1.08a1.56 1.56 0 0 0-1.1-1.1l-1.08-.29c-.8-.21-.8-1.35 0-1.56l1.08-.29c.54-.14.96-.56 1.1-1.1l.29-1.08Z"
            fill="currentColor"
          />
        </svg>
      );
    case "team":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M7.75 6.5a2.75 2.75 0 1 1 5.5 0a2.75 2.75 0 0 1-5.5 0Zm2.75-1.25a1.25 1.25 0 1 0 0 2.5a1.25 1.25 0 0 0 0-2.5Zm5.75 2A2.25 2.25 0 1 1 18.5 9.5a.75.75 0 0 1 0-1.5a.75.75 0 1 0-.75-.75a.75.75 0 0 1-1.5 0ZM4.25 16.5A3.25 3.25 0 0 1 7.5 13.25h6A3.25 3.25 0 0 1 16.75 16.5a.75.75 0 0 1-1.5 0a1.75 1.75 0 0 0-1.75-1.75h-6A1.75 1.75 0 0 0 5.75 16.5a.75.75 0 0 1-1.5 0Zm11 .5a.75.75 0 0 1 .75-.75h.5a2.75 2.75 0 0 1 2.75 2.75a.75.75 0 0 1-1.5 0a1.25 1.25 0 0 0-1.25-1.25H16a.75.75 0 0 1-.75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "chart":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M5 4.25a.75.75 0 0 1 .75.75v13.25H19a.75.75 0 0 1 0 1.5H5A.75.75 0 0 1 4.25 19V5A.75.75 0 0 1 5 4.25Zm4.25 7a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0v-6a.75.75 0 0 1 .75-.75Zm4-4a.75.75 0 0 1 .75.75V18a.75.75 0 0 1-1.5 0V8a.75.75 0 0 1 .75-.75Zm4 2.5A.75.75 0 0 1 18 10.5V18a.75.75 0 0 1-1.5 0v-7.5a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "bolt":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12.76 3.5a.75.75 0 0 1 .67 1.1L10.96 9h4.79a.75.75 0 0 1 .56 1.25l-6.5 7.25a.75.75 0 0 1-1.26-.77L10.73 12H6.25a.75.75 0 0 1-.62-1.17l6.5-7a.75.75 0 0 1 .63-.33Z"
            fill="currentColor"
          />
        </svg>
      );
    case "home":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.47 4.6a.75.75 0 0 1 1.06 0l6.25 6.25a.75.75 0 0 1-.53 1.28H17.5v5a1.75 1.75 0 0 1-1.75 1.75h-2.5a.75.75 0 0 1-.75-.75V14h-1v4.13a.75.75 0 0 1-.75.75h-2.5A1.75 1.75 0 0 1 6.5 17.13v-5h-.75a.75.75 0 0 1-.53-1.28l6.25-6.25Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  useEffect(() => {
    setPendingHref(null);
  }, [pathname]);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: ReturnType<typeof globalThis.setTimeout> | null = null;
    let frameId: number | null = null;

    const prefetchLinks = () => {
      if (cancelled) {
        return;
      }

      for (const link of links) {
        if (link.href !== pathname) {
          router.prefetch(link.href);
        }
      }
    };

    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      frameId = window.requestAnimationFrame(prefetchLinks);
      const idleId = window.requestIdleCallback(prefetchLinks, { timeout: 320 });
      return () => {
        cancelled = true;
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
        window.cancelIdleCallback(idleId);
      };
    }

    timeoutId = globalThis.setTimeout(prefetchLinks, 80);
    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        globalThis.clearTimeout(timeoutId);
      }
    };
  }, [pathname, router]);

  const handleLinkClick = (
    event: MouseEvent<HTMLAnchorElement>,
    href: string,
    isActive: boolean,
  ) => {
    if (
      isActive ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    setPendingHref(href);
    router.prefetch(href);
  };

  return (
    <nav className="sidebar-nav" aria-label="Navegação do painel">
      <div
        className={pendingHref ? "sidebar-progress sidebar-progress--active" : "sidebar-progress"}
        aria-hidden="true"
      />
      <div className="sidebar-section">
        {primaryLinks.map((link) => {
          const isActive =
            link.href === "/dashboard"
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(`${link.href}/`);
          const isPending = pendingHref === link.href;

          return (
            <Link
              key={link.href}
              href={link.href}
              className={
                isActive
                  ? "nav-link nav-link--active"
                  : isPending
                    ? "nav-link nav-link--pending"
                    : "nav-link"
              }
              aria-current={isActive ? "page" : undefined}
              aria-busy={isPending ? "true" : undefined}
              data-pending={isPending ? "true" : "false"}
              onMouseEnter={() => router.prefetch(link.href)}
              onTouchStart={() => router.prefetch(link.href)}
              onFocus={() => router.prefetch(link.href)}
              onClick={(event) => handleLinkClick(event, link.href, isActive)}
            >
              <span className="nav-link__content">
                <span className="nav-link__icon" aria-hidden="true">
                  <NavIcon name={link.icon} />
                </span>

                <span className="nav-link__text">
                  <strong>{link.label}</strong>
                  <small>{link.description}</small>
                </span>
              </span>

              <span className="nav-link__pulse" aria-hidden="true" />
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
