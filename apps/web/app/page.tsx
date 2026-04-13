import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
  const headerStore = await headers();
  const host = headerStore
    .get("x-forwarded-host")
    ?.split(",")[0]
    ?.trim() || headerStore.get("host");
  const normalizedHost = host?.toLowerCase().replace(/:\d+$/, "") ?? null;

  if (normalizedHost) {
    const whiteLabelResult = await supabase.rpc(
      "get_public_salon_join_code_by_domain",
      {
        domain_input: normalizedHost,
      },
    );

    const whiteLabelJoinCode = String(whiteLabelResult.data ?? "").trim();
    if (whiteLabelJoinCode) {
      redirect(`/s/${whiteLabelJoinCode}`);
    }
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: salon } = await supabase
    .from("salons")
    .select("*")
    .match({ owner_user_id: user.id })
    .maybeSingle();
  const salonData = salon as { id: string } | null;

  if (salonData?.id) {
    redirect("/dashboard");
  }

  redirect("/onboarding");
}
