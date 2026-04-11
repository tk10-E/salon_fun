import type { ReactNode } from "react";

import { FirebaseWebRuntimeConfig } from "@/components/auth/FirebaseWebRuntimeConfig";
import { DashboardShell } from "@/components/DashboardShell";
import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingSnapshot } from "@/lib/billing";
import { getFirebaseWebConfig } from "@/lib/firebase/config";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { salon, user } = await requireOwnerSalon();
  const billingSnapshot = await getSalonBillingSnapshot(salon.id);
  const firebaseConfig = getFirebaseWebConfig();

  return (
    <DashboardShell
      salonCode={salon.join_code}
      salonName={salon.name}
      ownerEmail={user.email}
      billingSnapshot={billingSnapshot}
    >
      <FirebaseWebRuntimeConfig config={firebaseConfig} />
      {children}
    </DashboardShell>
  );
}
