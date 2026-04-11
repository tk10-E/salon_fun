"use client";

import { useEffect, useState } from "react";

import { FlashMessage } from "@/components/FlashMessage";
import {
  restorePanelSessionFromFirebaseIfNeeded,
  sendFirebasePasswordResetEmail,
  signInWithFirebaseGoogle,
  signInWithFirebasePassword,
  signUpWithFirebasePassword,
} from "@/lib/firebase/panelAuth";
import { setRuntimeFirebaseWebConfig } from "@/lib/firebase/runtimeConfig";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";
import type { FirebaseWebConfig } from "@/lib/firebase/config";

type PanelAuthClientProps = {
  initialMessage?: string;
  initialTone?: string;
  firebaseConfig: FirebaseWebConfig | null;
};

type Notice = {
  message: string;
  tone: "success" | "error" | "info";
};

const emptyFormState = {
  signInEmail: "",
  signInPassword: "",
  resetEmail: "",
  signUpEmail: "",
  signUpPassword: "",
  signUpPasswordConfirmation: "",
};

function normalizeNotice(message?: string, tone?: string): Notice | null {
  if (!message || message.trim().length === 0) {
    return null;
  }

  if (tone === "success" || tone === "error" || tone === "info") {
    return { message, tone };
  }

  return { message, tone: "info" };
}

function normalizeEmailAddress(value: string) {
  return value.trim().toLowerCase();
}

function buildBrowserUrl(pathname: string) {
  if (typeof window === "undefined") {
    return undefined;
  }

  return `${window.location.origin}${pathname}`;
}

function formatSupabaseAuthError(error: unknown, fallbackMessage: string) {
  const code =
    typeof error === "object" && error != null && "code" in error
      ? String((error as { code?: unknown }).code ?? "")
      : "";
  const message =
    typeof error === "object" && error != null && "message" in error
      ? String((error as { message?: unknown }).message ?? "").trim()
      : "";
  const normalizedMessage = message.toLowerCase();

  switch (code) {
    case "invalid_credentials":
      return "E-mail ou senha inválidos.";
    case "email_not_confirmed":
      return "Confirme o e-mail antes de entrar no painel.";
    case "email_exists":
    case "user_already_exists":
      return "Este e-mail já está em uso.";
    case "over_email_send_rate_limit":
      return "Muitos pedidos foram feitos em sequência. Aguarde alguns minutos e tente de novo.";
    default:
      if (
        normalizedMessage.includes("invalid login credentials") ||
        normalizedMessage.includes("email not confirmed")
      ) {
        return "E-mail ou senha inválidos.";
      }

      return message.length > 0 ? message : fallbackMessage;
  }
}

async function signInWithSupabasePassword(input: {
  email: string;
  password: string;
}) {
  const supabase = createSupabaseBrowserClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmailAddress(input.email),
    password: input.password,
  });

  if (error || data.user == null || data.session == null) {
    throw new Error(
      formatSupabaseAuthError(error, "Não foi possível entrar agora."),
    );
  }
}

async function signUpWithSupabasePassword(input: {
  email: string;
  password: string;
  passwordConfirmation: string;
}) {
  if (input.password !== input.passwordConfirmation) {
    throw new Error("Confirme a mesma senha nos dois campos.");
  }

  const supabase = createSupabaseBrowserClient();
  const email = normalizeEmailAddress(input.email);
  const emailRedirectTo = buildBrowserUrl("/login");
  const { data, error } = await supabase.auth.signUp({
    email,
    password: input.password,
    options: emailRedirectTo
      ? {
          emailRedirectTo,
        }
      : undefined,
  });

  if (error) {
    throw new Error(
      formatSupabaseAuthError(error, "Não foi possível criar a conta."),
    );
  }

  return {
    email,
    requiresEmailConfirmation: data.session == null,
  };
}

async function sendSupabasePasswordResetEmail(email: string) {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = buildBrowserUrl("/auth/recovery");
  const { error } = await supabase.auth.resetPasswordForEmail(
    normalizeEmailAddress(email),
    redirectTo
      ? {
          redirectTo,
        }
      : undefined,
  );

  if (error) {
    throw new Error(
      formatSupabaseAuthError(
        error,
        "Não foi possível enviar o e-mail de recuperação agora.",
      ),
    );
  }
}

async function signInWithSupabaseGoogle() {
  const supabase = createSupabaseBrowserClient();
  const redirectTo = buildBrowserUrl("/auth/callback?next=/dashboard");
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      scopes: "https://www.googleapis.com/auth/userinfo.email",
    },
  });

  if (error || !data?.url) {
    throw new Error("Não foi possível iniciar o login com Google.");
  }

  window.location.assign(data.url);
}

function openPanelWorkspace() {
  window.location.assign("/dashboard");
}

export function PanelAuthClient({
  initialMessage,
  initialTone,
  firebaseConfig,
}: PanelAuthClientProps) {
  const [notice, setNotice] = useState<Notice | null>(() =>
    normalizeNotice(initialMessage, initialTone),
  );
  const [loadingIntent, setLoadingIntent] = useState<string | null>(null);
  const [formState, setFormState] = useState(emptyFormState);
  const firebaseEnabled = firebaseConfig != null;

  useEffect(() => {
    setRuntimeFirebaseWebConfig(firebaseConfig);
  }, [firebaseConfig]);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function recoverExistingPanelSession() {
      const {
        data: { session },
      } = await supabase.auth
        .getSession()
        .catch(() => ({ data: { session: null } }));

      if (cancelled) {
        return;
      }

      if (session?.user) {
        window.location.replace("/dashboard");
        return;
      }

      if (!firebaseEnabled) {
        return;
      }

      try {
        const restored = await restorePanelSessionFromFirebaseIfNeeded();
        if (!cancelled && restored) {
          window.location.replace("/dashboard");
        }
      } catch {
        // best effort, user can still sign in manually
      }
    }

    void recoverExistingPanelSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled && session?.user) {
        window.location.replace("/dashboard");
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, [firebaseEnabled]);

  function updateField(name: keyof typeof emptyFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("sign-in");
    setNotice(null);

    try {
      if (firebaseEnabled) {
        try {
          await signInWithFirebasePassword({
            email: formState.signInEmail,
            password: formState.signInPassword,
          });
        } catch (firebaseError) {
          const message =
            firebaseError instanceof Error
              ? firebaseError.message
              : "Não foi possível entrar agora.";
          if (
            message === "E-mail ou senha inválidos." ||
            message ===
              "O Firebase Web do painel está com chave inválida. Atualize a configuração do deploy."
          ) {
            await signInWithSupabasePassword({
              email: formState.signInEmail,
              password: formState.signInPassword,
            });
          } else {
            throw firebaseError;
          }
        }
      } else {
        await signInWithSupabasePassword({
          email: formState.signInEmail,
          password: formState.signInPassword,
        });
      }
      openPanelWorkspace();
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Não foi possível entrar agora.";
      setNotice({
        message:
          errorMessage === "E-mail ou senha inválidos."
            ? firebaseEnabled
              ? `${errorMessage} Se esta conta já existia no painel, tente a recuperação do mesmo e-mail para alinhar o acesso.`
              : `${errorMessage} Se esta conta é antiga, use a recuperação para definir uma nova senha do painel.`
            : errorMessage,
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleGoogleSignIn() {
    setLoadingIntent("google");
    setNotice(null);

    try {
      if (firebaseEnabled) {
        await signInWithFirebaseGoogle();
      } else {
        await signInWithSupabaseGoogle();
      }
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível iniciar o login com Google.",
        tone: "error",
      });
      setLoadingIntent(null);
    }
  }

  async function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("reset");
    setNotice(null);

    try {
      if (firebaseEnabled) {
        await sendFirebasePasswordResetEmail(formState.resetEmail);
      } else {
        await sendSupabasePasswordResetEmail(formState.resetEmail);
      }
      setNotice({
        message: firebaseEnabled
          ? "Enviamos um e-mail de redefinição. Abra a mensagem mais recente do Firebase, crie a nova senha e depois volte para entrar no painel."
          : "Enviamos um e-mail de redefinição. Abra a mensagem mais recente para continuar.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível enviar o e-mail de recuperação agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoadingIntent("sign-up");
    setNotice(null);

    try {
      const outcome = firebaseEnabled
        ? await signUpWithFirebasePassword({
            email: formState.signUpEmail,
            password: formState.signUpPassword,
            passwordConfirmation: formState.signUpPasswordConfirmation,
          })
        : await signUpWithSupabasePassword({
            email: formState.signUpEmail,
            password: formState.signUpPassword,
            passwordConfirmation: formState.signUpPasswordConfirmation,
          });

      if (!outcome.requiresEmailConfirmation) {
        window.location.assign("/onboarding");
        return;
      }

      setNotice({
        message: outcome.requiresEmailConfirmation
          ? `Conta criada. Confirme o e-mail ${outcome.email} antes de entrar no painel.`
          : "Conta criada com sucesso. Você já pode entrar no painel.",
        tone: "success",
      });
      setFormState((current) => ({
        ...current,
        signUpPassword: "",
        signUpPasswordConfirmation: "",
      }));
    } catch (error) {
      setNotice({
        message:
          error instanceof Error
            ? error.message
            : "Não foi possível criar a conta.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  return (
    <>
      <div className="auth-form-stack">
        <div className="panel-card auth-form-card auth-provider-card">
          <div className="panel-card__header">
            <span className="eyebrow">Acesso rápido</span>
          </div>
          <div className="auth-form-card__meta auth-form-card__meta--compact">
            <h3>Entrar no painel</h3>
            <p className="muted">
              Use Google ou o e-mail profissional do salão.
            </p>
          </div>
          <div className="auth-social-grid">
            <button
              type="button"
              className="secondary-button auth-social-button"
              onClick={handleGoogleSignIn}
              disabled={loadingIntent !== null}
            >
              <span className="auth-social-button__mark" aria-hidden="true">
                <svg viewBox="0 0 18 18" role="presentation" focusable="false">
                  <path
                    fill="#4285F4"
                    d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.56 2.68-3.86 2.68-6.62Z"
                  />
                  <path
                    fill="#34A853"
                    d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H1v2.34A9 9 0 0 0 9 18Z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M3.98 10.72A5.41 5.41 0 0 1 3.7 9c0-.6.1-1.18.28-1.72V4.94H1A9 9 0 0 0 0 9c0 1.45.35 2.82 1 4.06l2.98-2.34Z"
                  />
                  <path
                    fill="#EA4335"
                    d="M9 3.58c1.32 0 2.5.46 3.42 1.36l2.56-2.56C13.46.96 11.43 0 9 0A9 9 0 0 0 1 4.94l2.98 2.34c.7-2.12 2.68-3.7 5.02-3.7Z"
                  />
                </svg>
              </span>
              <span className="auth-social-button__meta">
                <strong>Google</strong>
                <span>
                  {loadingIntent === "google" ? "Abrindo..." : "Continuar"}
                </span>
              </span>
            </button>
            <button
              type="button"
              className="secondary-button auth-social-button auth-social-button--facebook"
              disabled
              title="Login com Facebook em breve"
            >
              <span className="auth-social-button__mark" aria-hidden="true">
                <svg viewBox="0 0 24 24" role="presentation" focusable="false">
                  <path
                    fill="currentColor"
                    d="M13.47 21.5v-8.2h2.76l.41-3.2h-3.17V8.06c0-.92.26-1.55 1.58-1.55h1.69V3.65c-.29-.04-1.28-.12-2.43-.12-2.4 0-4.05 1.47-4.05 4.17v2.4H7.53v3.2h2.73v8.2h3.21Z"
                  />
                </svg>
              </span>
              <span className="auth-social-button__meta">
                <strong>Facebook</strong>
                <span>Em breve</span>
              </span>
            </button>
          </div>
        </div>

        <div className="panel-card panel-card--accent auth-form-card">
          <div className="panel-card__header">
            <span className="eyebrow">Sua conta</span>
          </div>
          <div className="auth-form-card__meta auth-form-card__meta--compact">
            <h3>Entrar com e-mail</h3>
            <p className="muted">Acesse o painel com o e-mail principal do salão.</p>
          </div>
          <form className="form-grid" onSubmit={handleEmailSignIn}>
            <div className="field">
              <label htmlFor="signin-email">E-mail</label>
              <input
                id="signin-email"
                name="email"
                type="email"
                placeholder="salao@email.com"
                required
                value={formState.signInEmail}
                onChange={(event) =>
                  updateField("signInEmail", event.target.value)
                }
              />
            </div>

            <div className="field">
              <label htmlFor="signin-password">Senha</label>
              <input
                id="signin-password"
                name="password"
                type="password"
                placeholder="Sua senha"
                required
                value={formState.signInPassword}
                onChange={(event) =>
                  updateField("signInPassword", event.target.value)
                }
              />
            </div>

            <button
              type="submit"
              className="primary-button"
              disabled={loadingIntent !== null}
            >
              {loadingIntent === "sign-in"
                ? "Entrando..."
                : "Acessar minha conta"}
            </button>
          </form>

          <div className="auth-inline-divider" aria-hidden="true">
            <span />
          </div>

          <form
            className="form-grid auth-recovery-form"
            onSubmit={handlePasswordReset}
          >
            <div className="auth-compact-copy">
              <strong>Recuperar acesso</strong>
              <p className="muted">
                Envie um link novo para redefinir a senha da conta.
              </p>
            </div>

            <div className="field">
              <label htmlFor="recovery-email">E-mail da conta</label>
              <input
                id="recovery-email"
                name="email"
                type="email"
                placeholder="salao@email.com"
                required
                value={formState.resetEmail}
                onChange={(event) =>
                  updateField("resetEmail", event.target.value)
                }
              />
            </div>

            <button
              type="submit"
              className="secondary-button"
              disabled={loadingIntent !== null}
            >
              {loadingIntent === "reset"
                ? "Enviando..."
                : "Enviar link de recuperação"}
            </button>
          </form>
        </div>

        <div className="panel-card auth-form-card">
          <div className="panel-card__header">
            <span className="eyebrow">Novo por aqui?</span>
          </div>
          <div className="auth-form-card__meta auth-form-card__meta--compact">
            <h3>Criar conta</h3>
            <p className="muted">
              Abra o painel do seu salão com um acesso novo e profissional.
            </p>
          </div>
          <form className="form-grid" onSubmit={handleSignUp}>
            <div className="field">
              <label htmlFor="signup-email">E-mail</label>
              <input
                id="signup-email"
                name="email"
                type="email"
                placeholder="novo@email.com"
                required
                value={formState.signUpEmail}
                onChange={(event) =>
                  updateField("signUpEmail", event.target.value)
                }
              />
            </div>

            <div className="field">
              <label htmlFor="signup-password">Senha</label>
              <input
                id="signup-password"
                name="password"
                type="password"
                minLength={6}
                placeholder="Mínimo 6 caracteres"
                required
                value={formState.signUpPassword}
                onChange={(event) =>
                  updateField("signUpPassword", event.target.value)
                }
              />
            </div>

            <div className="field">
              <label htmlFor="signup-password-confirmation">
                Confirmar senha
              </label>
              <input
                id="signup-password-confirmation"
                name="passwordConfirmation"
                type="password"
                minLength={6}
                placeholder="Repita a senha"
                required
                value={formState.signUpPasswordConfirmation}
                onChange={(event) =>
                  updateField("signUpPasswordConfirmation", event.target.value)
                }
              />
              <span className="field-hint">
                Depois de confirmar o e-mail, você entra e segue para o
                onboarding do salão.
              </span>
            </div>

            <button
              type="submit"
              className="secondary-button"
              disabled={loadingIntent !== null}
            >
              {loadingIntent === "sign-up"
                ? "Criando conta..."
                : "Começar agora"}
            </button>
          </form>
        </div>
      </div>

      {notice ? (
        <FlashMessage message={notice.message} tone={notice.tone} />
      ) : null}
    </>
  );
}
