import { redirect } from "next/navigation";

import { validatePasswordStrength } from "@/lib/passwordPolicy";
import { createClient } from "@/lib/supabase/server";
import { buildRequestOrigin } from "@/lib/requestOrigin";

import { buildRedirectNotice } from "./shared";

async function buildAppOrigin() {
  return buildRequestOrigin();
}

function normalizeEmailAddress(value: FormDataEntryValue | null) {
  return String(value ?? "").trim().toLowerCase();
}

async function buildEmailRedirectUrl() {
  const origin = await buildAppOrigin();
  if (!origin) {
    return undefined;
  }

  return `${origin}/login`;
}

async function buildPasswordRecoveryUrl() {
  const origin = await buildAppOrigin();
  if (!origin) {
    return undefined;
  }

  return `${origin}/auth/recovery`;
}

function sanitizeNextPath(value: string | null | undefined) {
  if (!value || !value.startsWith("/")) {
    return "/dashboard";
  }

  return value;
}

function buildSignUpErrorMessage(error: { code?: string | null; message?: string | null }) {
  switch (error.code) {
    case "email_exists":
    case "user_already_exists":
      return "Este e-mail já está cadastrado. Entre no painel ou use Recuperar senha.";
    case "over_email_send_rate_limit":
      return "Muitos pedidos foram feitos em sequência. Aguarde alguns minutos e tente de novo.";
    default:
      return "Não foi possível criar a conta.";
  }
}

async function buildGoogleCallbackUrl(nextPath = "/dashboard") {
  const origin = await buildAppOrigin();
  if (!origin) {
    return undefined;
  }

  const callbackUrl = new URL(`${origin}/auth/callback`);
  callbackUrl.searchParams.set("next", sanitizeNextPath(nextPath));
  return callbackUrl.toString();
}

export async function signInActionImpl(formData: FormData) {
  const email = normalizeEmailAddress(formData.get("email"));
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
  const redirectTo = await buildGoogleCallbackUrl(nextPath);

  if (!redirectTo) {
    redirect(buildRedirectNotice("/login", "Não foi possível iniciar o login com Google agora.", "error"));
  }

  const supabase = createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "https://www.googleapis.com/auth/userinfo.email",
    },
  });

  if (error || !data?.url) {
    redirect(buildRedirectNotice("/login", "Não foi possível iniciar o login com Google agora.", "error"));
  }

  redirect(data.url);
}

export async function signUpActionImpl(formData: FormData) {
  const email = normalizeEmailAddress(formData.get("email"));
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");
  const supabase = createClient();
  const emailRedirectTo = await buildEmailRedirectUrl();

  if (password !== passwordConfirmation) {
    redirect(buildRedirectNotice("/login", "Confirme a mesma senha nos dois campos para criar a conta.", "error"));
  }

  const signUpPasswordError = validatePasswordStrength(password);
  if (signUpPasswordError) {
    redirect(buildRedirectNotice("/login", signUpPasswordError, "error"));
  }

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
    redirect(buildRedirectNotice("/login", buildSignUpErrorMessage(error), "error"));
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

export async function sendPasswordResetActionImpl(formData: FormData) {
  const email = normalizeEmailAddress(formData.get("email"));
  const supabase = createClient();
  const redirectTo = await buildPasswordRecoveryUrl();

  if (!email) {
    redirect(buildRedirectNotice("/login", "Informe o e-mail da conta para recuperar o acesso.", "error"));
  }

  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    redirectTo
      ? {
          redirectTo,
        }
      : undefined,
  );

  if (error) {
    if (error.code === "over_email_send_rate_limit") {
      redirect(
        buildRedirectNotice(
          "/login",
          "Muitos pedidos de recuperação foram feitos em sequência. Aguarde alguns minutos e use o e-mail mais recente já enviado.",
          "error",
        ),
      );
    }

    redirect(buildRedirectNotice("/login", "Não foi possível enviar o e-mail de recuperação agora.", "error"));
  }

  redirect(
    buildRedirectNotice(
      "/login",
      "Enviamos um link de recuperação para seu e-mail. Abra a mensagem mais recente para redefinir a senha.",
      "success",
    ),
  );
}

export async function updatePasswordActionImpl(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const passwordConfirmation = String(formData.get("passwordConfirmation") ?? "");

  const updatePasswordError = validatePasswordStrength(password);
  if (updatePasswordError) {
    redirect(buildRedirectNotice("/auth/recovery", updatePasswordError, "error"));
  }

  if (password !== passwordConfirmation) {
    redirect(buildRedirectNotice("/auth/recovery", "Confirme a mesma senha nos dois campos.", "error"));
  }

  const supabase = createClient();
  const { error } = await supabase.auth.updateUser({
    password,
  });

  if (error) {
    redirect(
      buildRedirectNotice(
        "/auth/recovery",
        "Não foi possível atualizar a senha agora. Tente abrir o link de recuperação novamente.",
        "error",
      ),
    );
  }

  redirect(buildRedirectNotice("/login", "Senha atualizada com sucesso. Entre com sua nova senha.", "success"));
}

export async function signOutActionImpl() {
  const supabase = createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
