"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type DashboardAccessGateProps = {
  isLocked: boolean;
  allowedPaths: readonly string[];
  title: string;
  description: string;
};

function matchesAllowedPath(pathname: string, allowedPaths: readonly string[]) {
  return allowedPaths.some((allowedPath) => pathname === allowedPath || pathname.startsWith(`${allowedPath}/`));
}

export function DashboardAccessGate({
  isLocked,
  allowedPaths,
  title,
  description,
}: DashboardAccessGateProps) {
  const pathname = usePathname();

  if (!isLocked || matchesAllowedPath(pathname, allowedPaths)) {
    return null;
  }

  return (
    <div className="dashboard-access-overlay" role="alert" aria-live="polite">
      <div className="dashboard-access-overlay__card">
        <span className="eyebrow">Área indisponível</span>
        <h2>{title}</h2>
        <p>{description}</p>
        <div className="dashboard-access-overlay__actions">
          <Link href="/dashboard" className="primary-button">
            Voltar ao início
          </Link>
          <Link href="/planos" className="secondary-button">
            Escolher plano
          </Link>
        </div>
      </div>
    </div>
  );
}
