import { cache } from "react";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/database.types";

type Salon = Database["public"]["Tables"]["salons"]["Row"];
type FlashTone = "success" | "error" | "info";

const SESSION_EXPIRED_MESSAGE = "Sessao expirada. Entre novamente para continuar.";
const withCache = typeof cache === "function"
  ? cache
  : (<T extends (...args: never[]) => unknown>(fn: T) => fn);

const getAuthenticatedUser = withCache(async () => {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.user ?? null;
});

export function buildRedirectPath(
  pathname: string,
  options?: {
    message?: string;
    tone?: FlashTone;
  },
) {
  if (!options?.message) {
    return pathname;
  }

  const searchParams = new URLSearchParams({
    message: options.message,
    tone: options.tone ?? "info",
  });

  return `${pathname}?${searchParams.toString()}`;
}

export function buildLoginRedirectPath(options?: {
  message?: string;
  tone?: FlashTone;
}) {
  return buildRedirectPath("/login", options);
}

export async function requireUser() {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect(buildLoginRedirectPath({
      message: SESSION_EXPIRED_MESSAGE,
      tone: "info",
    }));
  }

  return { supabase: createClient(), user };
}

// Salon data changes often from server actions in the dashboard.
// Keep this read uncached so redirects after "save" always render fresh data.
export async function getOwnerSalon(userId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("salons")
    .select("*")
    .match({ owner_user_id: userId })
    .maybeSingle();

  return data as Salon | null;
}

export async function getAuthenticatedPanelEntryPath() {
  const user = await getAuthenticatedUser();

  if (!user) {
    return null;
  }

  const salon = await getOwnerSalon(user.id);
  return salon ? "/dashboard" : "/onboarding";
}

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
