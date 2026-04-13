import { cache } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { evaluatePanelAccessPolicy } from "@/lib/sessionSecurity";
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
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (user) {
    return user;
  }

  if (error) {
    const {
      data: { session },
    } = await supabase.auth.getSession();

    return session?.user ?? null;
  }

  return null;
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

  try {
    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.access_token) {
      const accessPolicy = await evaluatePanelAccessPolicy({
        accessToken: session.access_token,
        headerStore: await headers(),
        requestPath: "/login",
        userId: user.id,
      });

      if (!accessPolicy.allowed && accessPolicy.action === "mfa_required") {
        return null;
      }
    }
  } catch {
    // best effort: if policy lookup fails, keep the previous entry routing
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
