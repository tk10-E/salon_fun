"use client";

import Link from "next/link";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";

const links = [
  { href: "/dashboard", label: "Resumo" },
  { href: "/dashboard/feed", label: "Feed do salão" },
  { href: "/dashboard/services", label: "Serviços" },
  { href: "/dashboard/benefits", label: "Comercial e retenção" },
  { href: "/dashboard/notifications", label: "Avisos enviados" },
  { href: "/dashboard/team", label: "Equipe e agenda" },
  { href: "/dashboard/appointments", label: "Agendamentos" },
  { href: "/dashboard/customers", label: "Clientes" },
  { href: "/dashboard/settings", label: "Código para clientes" },
];

export function SidebarNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

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
      const idleId = window.requestIdleCallback(prefetchLinks, { timeout: 1200 });
      return () => {
        cancelled = true;
        window.cancelIdleCallback(idleId);
      };
    }

    const timeoutId = globalThis.setTimeout(prefetchLinks, 250);
    return () => {
      cancelled = true;
      globalThis.clearTimeout(timeoutId);
    };
  }, [pathname, router]);

  return (
    <nav className="sidebar-nav">
      {links.map((link) => {
        const isActive =
          link.href === "/dashboard"
            ? pathname === link.href
            : pathname === link.href || pathname.startsWith(`${link.href}/`);

        return (
          <Link
            key={link.href}
            href={link.href}
            className={isActive ? "nav-link nav-link--active" : "nav-link"}
            onMouseEnter={() => router.prefetch(link.href)}
            onFocus={() => router.prefetch(link.href)}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
