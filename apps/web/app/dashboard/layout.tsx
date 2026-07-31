import type { ReactNode } from "react";

import { FirebaseWebRuntimeConfig } from "@/components/auth/FirebaseWebRuntimeConfig";
import { DashboardShell } from "@/components/DashboardShell";
import { requireOwnerSalon } from "@/lib/auth";
import { getSalonBillingSnapshot } from "@/lib/billing";
import { getFirebaseWebConfig } from "@/lib/firebase/config";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const { salon, user } = await requireOwnerSalon({ allowLocked: true });
  const billingSnapshot = await getSalonBillingSnapshot(salon.id);
  const firebaseConfig = getFirebaseWebConfig();
  const supabase = createClient();
  const salonLogoPath = salon.logo_path?.trim() ?? null;
  const salonLogoUrl = salonLogoPath
    ? supabase.storage.from("salon-assets").getPublicUrl(salonLogoPath).data
      .publicUrl
    : null;

  return (
    <DashboardShell
      salonId={salon.id}
      salonCode={salon.join_code}
      salonName={salon.name}
      ownerEmail={user.email}
      ownerDisplayName={user.displayName}
      salonLogoUrl={salonLogoUrl}
      ownerAvatarUrl={user.avatarUrl}
      billingSnapshot={billingSnapshot}
    >
      <FirebaseWebRuntimeConfig config={firebaseConfig} />
      {children}
    </DashboardShell>
  );
}
