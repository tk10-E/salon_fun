import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Salon = Database["public"]["Tables"]["salons"]["Row"];

const getAuthenticatedUser = cache(async () => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user;
});

export async function requireUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect("/login");
  }

  return { supabase: createClient(), user };
}

export const getOwnerSalon = cache(async (userId: string) => {
  const supabase = createClient();
  const { data } = await supabase
    .from("salons")
    .select("*")
    .match({ owner_user_id: userId })
    .maybeSingle();

  return data as Salon | null;
});

export async function requireOwnerSalon(): Promise<{
  salon: Salon;
  user: { id: string; email?: string | null };
}> {
  const { user } = await requireUser();
  const salon = await getOwnerSalon(user.id);

  if (!salon) {
    redirect("/onboarding");
  }

  return {
    salon,
    user: {
      id: user.id,
      email: user.email,
    },
  };
}
