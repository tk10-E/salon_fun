"use client";

import { useEffect, useMemo, useState } from "react";

import { FlashMessage } from "@/components/FlashMessage";
import { hasFirebaseWebConfig } from "@/lib/firebase/config";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/browser";

type PanelAuthClientProps = {
  initialMessage?: string;
  initialTone?: string;
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

async function loadPanelAuthModule() {
  return import("@/lib/firebase/panelAuth");
}

function openPanelWorkspace() {
  window.location.assign("/dashboard");
}

export function PanelAuthClient({ initialMessage, initialTone }: PanelAuthClientProps) {
  const [notice, setNotice] = useState<Notice | null>(() => normalizeNotice(initialMessage, initialTone));
  const [loadingIntent, setLoadingIntent] = useState<string | null>(null);
  const [formState, setFormState] = useState(emptyFormState);

  const firebaseConfigured = useMemo(() => hasFirebaseWebConfig(), []);

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    let cancelled = false;

    async function recoverExistingPanelSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession().catch(() => ({ data: { session: null } }));

      if (cancelled || !session?.user) {
        return;
      }

      window.location.replace("/dashboard");
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
  }, []);

  function updateField(name: keyof typeof emptyFormState, value: string) {
    setFormState((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleEmailSignIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseConfigured) {
      setNotice({
        message: "O login do painel ainda não recebeu as chaves do Firebase Web.",
        tone: "error",
      });
      return;
    }

    setLoadingIntent("sign-in");
    setNotice(null);

    try {
      const { signInWithFirebasePassword } = await loadPanelAuthModule();
      await signInWithFirebasePassword({
        email: formState.signInEmail,
        password: formState.signInPassword,
      });
      openPanelWorkspace();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Não foi possível entrar agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleGoogleSignIn() {
    if (!firebaseConfigured) {
      setNotice({
        message: "O login do painel ainda não recebeu as chaves do Firebase Web.",
        tone: "error",
      });
      return;
    }

    setLoadingIntent("google");
    setNotice(null);

    try {
      const { signInWithFirebaseGoogle } = await loadPanelAuthModule();
      await signInWithFirebaseGoogle();
      openPanelWorkspace();
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Não foi possível iniciar o login com Google.",
        tone: "error",
      });
      setLoadingIntent(null);
    }
  }

  async function handlePasswordReset(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseConfigured) {
      setNotice({
        message: "A recuperação de senha ainda não recebeu as chaves do Firebase Web.",
        tone: "error",
      });
      return;
    }

    setLoadingIntent("reset");
    setNotice(null);

    try {
      const { sendFirebasePasswordResetEmail } = await loadPanelAuthModule();
      await sendFirebasePasswordResetEmail(formState.resetEmail);
      setNotice({
        message: "Enviamos um e-mail de redefinição pelo Firebase. Abra a mensagem mais recente para continuar.",
        tone: "success",
      });
    } catch (error) {
      setNotice({
        message: error instanceof Error ? error.message : "Não foi possível enviar o e-mail de recuperação agora.",
        tone: "error",
      });
    } finally {
      setLoadingIntent(null);
    }
  }

  async function handleSignUp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!firebaseConfigured) {
      setNotice({
        message: "O cadastro do painel ainda não recebeu as chaves do Firebase Web.",
        tone: "error",
      });
      return;
    }

    setLoadingIntent("sign-up");
    setNotice(null);

    try {
      const { signUpWithFirebasePassword } = await loadPanelAuthModule();
      const outcome = await signUpWithFirebasePassword({
        email: formState.signUpEmail,
        password: formState.signUpPassword,
        passwordConfirmation: formState.signUpPasswordConfirmation,
      });

      setNotice({
        message: outcome.requiresEmailConfirmation
          ? `Conta criada no Firebase. Confirme o e-mail ${outcome.email} antes de entrar no painel.`
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
        message: error instanceof Error ? error.message : "Não foi possível criar a conta.",
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
          <div className="auth-form-card__meta">
            <h3>Continuar com Google</h3>
            <p className="muted">
              Entre com sua conta profissional. Se for seu primeiro acesso, o cadastro do painel começa na hora.
            </p>
          </div>
          <div className="form-grid">
            <button
              type="button"
              className="secondary-button auth-provider-button"
              onClick={handleGoogleSignIn}
              disabled={loadingIntent !== null}
            >
              <span className="auth-provider-button__mark" aria-hidden="true">
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
              <span>
                {loadingIntent === "google" ? "Abrindo Google..." : "Continuar com Google"}
              </span>
            </button>
            <p className="field-hint auth-provider-note">
              Ideal para um onboarding mais rápido, sem depender de senha no primeiro acesso.
            </p>
          </div>
        </div>

        <div className="panel-card panel-card--accent auth-form-card">
          <div className="panel-card__header">
            <span className="eyebrow">Sua conta</span>
          </div>
          <div className="auth-form-card__meta">
            <h3>Entrar</h3>
            <p className="muted">Acesse o painel para acompanhar a operação do salão em tempo real.</p>
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
                onChange={(event) => updateField("signInEmail", event.target.value)}
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
                onChange={(event) => updateField("signInPassword", event.target.value)}
              />
            </div>

            <button type="submit" className="primary-button" disabled={loadingIntent !== null}>
              {loadingIntent === "sign-in" ? "Entrando..." : "Acessar minha conta"}
            </button>
          </form>

          <div className="auth-inline-divider" aria-hidden="true">
            <span />
          </div>

          <form className="form-grid auth-recovery-form" onSubmit={handlePasswordReset}>
            <div className="auth-compact-copy">
              <strong>Recuperar conta</strong>
              <p className="muted">
                Use a recuperação do Firebase para redefinir a senha e retomar o acesso do salão.
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
                onChange={(event) => updateField("resetEmail", event.target.value)}
              />
            </div>

            <button type="submit" className="secondary-button" disabled={loadingIntent !== null}>
              {loadingIntent === "reset" ? "Enviando..." : "Enviar link de recuperação"}
            </button>
          </form>
        </div>

        <div className="panel-card auth-form-card">
          <div className="panel-card__header">
            <span className="eyebrow">Novo por aqui?</span>
          </div>
          <div className="auth-form-card__meta">
            <h3>Criar conta</h3>
            <p className="muted">
              Comece agora e deixe o seu salão pronto para receber agenda, equipe e clientes.
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
                onChange={(event) => updateField("signUpEmail", event.target.value)}
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
                onChange={(event) => updateField("signUpPassword", event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="signup-password-confirmation">Confirmar senha</label>
              <input
                id="signup-password-confirmation"
                name="passwordConfirmation"
                type="password"
                minLength={6}
                placeholder="Repita a senha"
                required
                value={formState.signUpPasswordConfirmation}
                onChange={(event) => updateField("signUpPasswordConfirmation", event.target.value)}
              />
              <span className="field-hint">
                Depois de confirmar o e-mail no Firebase, você entra e segue para o onboarding do salão.
              </span>
            </div>

            <button type="submit" className="secondary-button" disabled={loadingIntent !== null}>
              {loadingIntent === "sign-up" ? "Criando conta..." : "Começar agora"}
            </button>
          </form>
        </div>
      </div>

      {notice ? <FlashMessage message={notice.message} tone={notice.tone} /> : null}
    </>
  );
}
