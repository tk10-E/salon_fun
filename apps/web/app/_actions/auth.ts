import { redirect } from "next/navigation";
import { headers } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import { buildRedirectNotice } from "./shared";

function buildAppOrigin() {
  const headerStore = headers();
  const origin = headerStore.get("origin")?.trim();

  if (origin) {
    return origin.replace(/\/+$/, "");
  }

  const host = headerStore.get("x-forwarded-host")?.trim() ?? headerStore.get("host")?.trim();
  if (!host) {
    return undefined;
  }

  const protocol = headerStore.get("x-forwarded-proto")?.trim() || "https";
  return `${protocol}://${host.replace(/\/+$/, "")}`;
}

function buildEmailRedirectUrl() {
  const origin = buildAppOrigin();
  if (!origin) {
    return undefined;
  }

  return `${origin}/login`;
}

function sanitizeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function buildGoogleCallbackUrl(nextPath = "/dashboard") {
  const origin = buildAppOrigin();
  if (!origin) {
    return undefined;
  }

  const callbackUrl = new URL(`${origin}/auth/callback`);
  callbackUrl.searchParams.set("next", sanitizeNextPath(nextPath));
  return callbackUrl.toString();
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

export async function signInWithGoogleActionImpl(formData: FormData) {
  const nextPath = sanitizeNextPath(String(formData.get("next") ?? ""));
  const redirectTo = buildGoogleCallbackUrl(nextPath);

  if (!redirectTo) {
    redirect(buildRedirectNotice("/login", "Não foi possível iniciar o login com Google agora.", "error"));
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
    },
  });

  if (error || !data?.url) {
    redirect(buildRedirectNotice("/login", "Não foi possível iniciar o login com Google agora.", "error"));
  }

  redirect(data.url);
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
