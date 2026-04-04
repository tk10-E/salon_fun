import type { ReactNode } from "react";

import { DashboardShell } from "@/components/DashboardShell";
import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingSnapshot } from "@/lib/billing";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { salon, user } = await requireOwnerSalon();
  const billingSnapshot = await getSalonBillingSnapshot(salon.id);

  return (
    <DashboardShell
      salonCode={salon.join_code}
      salonName={salon.name}
      ownerEmail={user.email}
      billingSnapshot={billingSnapshot}
    >
      {children}
    </DashboardShell>
  );
}
