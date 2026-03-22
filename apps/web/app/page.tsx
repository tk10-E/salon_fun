import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = createClient();
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
