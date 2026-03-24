import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

function buildEmailRedirectUrl() {
  const headerStore = headers();
  const origin = headerStore.get("origin")?.trim();

  if (origin) {
    return `${origin.replace(/\/+$/, "")}/login`;
  }

  const host = headerStore.get("x-forwarded-host")?.trim() ?? headerStore.get("host")?.trim();
  if (!host) {
    return undefined;
  }

  const protocol = headerStore.get("x-forwarded-proto")?.trim() || "https";
  return `${protocol}://${host.replace(/\/+$/, "")}/login`;
}

export async function signInActionImpl(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = createClient();

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    redirect(buildRedirectNotice("/login", "Não foi possível entrar. Verifique e-mail e senha.", "error"));
  }

  redirect("/dashboard");
}

export async function signUpActionImpl(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const supabase = createClient();
  const emailRedirectTo = buildEmailRedirectUrl();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: emailRedirectTo
      ? {
          emailRedirectTo,
        }
      : undefined,
  });

  if (error) {
    redirect(buildRedirectNotice("/login", "Não foi possível criar a conta.", "error"));
  }

  if (data.session) {
    redirect("/onboarding");
  }

  redirect(
    buildRedirectNotice(
      "/login",
      "Conta criada. Confira seu e-mail caso a confirmação esteja ativada.",
      "success",
    ),
  );
}

export async function signOutActionImpl() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
