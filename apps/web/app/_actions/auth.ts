import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

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

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
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
