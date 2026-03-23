"use client";

import Link from "next/link";
import { MouseEvent, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Resumo" },
  { href: "/dashboard/feed", label: "Feed do salão" },
  { href: "/dashboard/instagram", label: "Instagram" },
  { href: "/dashboard/services", label: "Serviços" },
  { href: "/dashboard/benefits", label: "Comercial e retenção" },
  { href: "/dashboard/notifications", label: "Avisos enviados" },
  { href: "/dashboard/team", label: "Equipe e agenda" },
  { href: "/dashboard/operations", label: "Financeiro e estoque" },
  { href: "/dashboard/appointments", label: "Agendamentos" },
  { href: "/dashboard/customers", label: "Clientes" },
  { href: "/dashboard/settings", label: "Código para clientes" },
];

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
      {links.map((link) => {
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
            aria-busy={isPending ? "true" : undefined}
            data-pending={isPending ? "true" : "false"}
            onMouseEnter={() => router.prefetch(link.href)}
            onTouchStart={() => router.prefetch(link.href)}
            onFocus={() => router.prefetch(link.href)}
            onClick={(event) => handleLinkClick(event, link.href, isActive)}
          >
            <span>{link.label}</span>
            <span className="nav-link__pulse" aria-hidden="true" />
          </Link>
        );
      })}
    </nav>
  );
}
