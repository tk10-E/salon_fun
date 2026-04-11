import type { ReactNode } from "react";

export default function GestaoLayout({ children }: { children: ReactNode }) {
  return <div className="management-page">{children}</div>;
}
