"use client";

import { useEffect, useState } from "react";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";

import { FlashMessage } from "@/components/FlashMessage";
import { createClient } from "@/lib/supabase/browser";

type Notice = {
  message: string;
  tone: "success" | "error" | "info";
};

function readRecoveryParams() {
  const url = new URL(window.location.href);
  const searchParams = url.searchParams;
  const hashParams = new URLSearchParams(url.hash.replace(/^#/, ""));

  return {
    code: searchParams.get("code"),
    errorCode: searchParams.get("error_code") ?? hashParams.get("error_code"),
    errorDescription:
      searchParams.get("error_description") ??
      hashParams.get("error_description"),
    accessToken: hashParams.get("access_token"),
    refreshToken: hashParams.get("refresh_token"),
    type: hashParams.get("type"),
  };
}

function buildLoginSuccessRedirect() {
  const searchParams = new URLSearchParams({
    message: "Senha atualizada com sucesso. Entre com sua nova senha.",
    tone: "success",
  });
  return `/login?${searchParams.toString()}`;
}

export default function PasswordRecoveryPage() {
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    const supabase = createClient();
    let cancelled = false;

    async function bootstrapRecovery() {
      const {
        code,
        errorCode,
        errorDescription,
        accessToken,
        refreshToken,
        type,
      } = readRecoveryParams();

      if (errorCode || errorDescription) {
        if (!cancelled) {
          setNotice({
            message:
              "O link de recuperação não é mais válido. Peça um novo e-mail para continuar.",
            tone: "error",
          });
          setBootstrapping(false);
        }
        return;
      }

      if (type === "recovery" && accessToken && refreshToken) {
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken,
        });

        if (error) {
          if (!cancelled) {
            setNotice({
              message:
                "Não foi possível preparar a redefinição da senha. Peça um novo link para continuar.",
              tone: "error",
            });
            setBootstrapping(false);
          }
          return;
        }

        if (!cancelled) {
          setReady(true);
          setBootstrapping(false);
          window.history.replaceState({}, "", "/auth/recovery");
        }
        return;
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);

        if (error) {
          if (!cancelled) {
            setNotice({
              message:
                "Não foi possível validar este link de recuperação. Peça um novo e-mail para continuar.",
              tone: "error",
            });
            setBootstrapping(false);
          }
          return;
        }

        if (!cancelled) {
          setReady(true);
          setBootstrapping(false);
          window.history.replaceState({}, "", "/auth/recovery");
        }
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!cancelled && session) {
        setReady(true);
      }

      if (!cancelled) {
        setBootstrapping(false);
      }
    }

    bootstrapRecovery();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((
      event: AuthChangeEvent,
      session: Session | null,
    ) => {
      if (cancelled) {
        return;
      }

      if (event === "PASSWORD_RECOVERY" || session) {
        setReady(true);
        setBootstrapping(false);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (loading) {
      return;
    }

    if (password.length < 6) {
      setNotice({
        message: "Use uma senha com pelo menos 6 caracteres.",
        tone: "error",
      });
      return;
    }

    if (password !== passwordConfirmation) {
      setNotice({
        message: "Confirme a mesma senha nos dois campos.",
        tone: "error",
      });
      return;
    }

    setLoading(true);
    setNotice(null);

    const supabase = createClient();
    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      setNotice({
        message:
          "Não foi possível atualizar a senha agora. Tente abrir o link de recuperação novamente.",
        tone: "error",
      });
      setLoading(false);
      return;
    }

    setNotice({
      message: "Senha atualizada com sucesso. Redirecionando para o login...",
      tone: "success",
    });

    await supabase.auth.signOut().catch(() => undefined);

    setTimeout(() => {
      window.location.assign(buildLoginSuccessRedirect());
    }, 800);
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="hero-card auth-hero-panel">
          <div className="auth-hero-copy">
            <div className="hero-badges">
              <span className="eyebrow">Recuperação segura</span>
              <span className="hero-note">Acesso protegido</span>
            </div>

            <p className="auth-hero-kicker">
              Redefina sua senha e volte ao painel com segurança
            </p>
            <h1>
              Seu acesso ao salão fica pronto em poucos instantes.
            </h1>
            <p className="auth-hero-summary">
              Escolha uma nova senha para continuar acompanhando agenda, equipe,
              clientes e operação do salão no mesmo painel.
            </p>
          </div>
        </section>

        <section className="auth-panel-column">
          <div className="auth-panel-intro">
            <span className="eyebrow">Nova senha</span>
            <h2>Recuperar conta</h2>
            <p className="muted">
              Defina uma nova senha e siga direto para o painel do seu salão.
            </p>
          </div>

          <div className="auth-form-stack">
            <div className="panel-card panel-card--accent auth-form-card">
              <div className="panel-card__header">
                <span className="eyebrow">Senha do painel</span>
              </div>
              <div className="auth-form-card__meta">
                <h3>Criar nova senha</h3>
                <p className="muted">
                  Use uma senha forte para proteger o acesso profissional do
                  salão.
                </p>
              </div>

              {notice ? (
                <FlashMessage message={notice.message} tone={notice.tone} />
              ) : null}

              {ready ? (
                <form className="form-grid" onSubmit={handleSubmit}>
                  <div className="field">
                    <label htmlFor="recovery-password">Nova senha</label>
                    <input
                      id="recovery-password"
                      type="password"
                      minLength={6}
                      placeholder="Mínimo 6 caracteres"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="recovery-password-confirmation">
                      Confirmar nova senha
                    </label>
                    <input
                      id="recovery-password-confirmation"
                      type="password"
                      minLength={6}
                      placeholder="Repita a nova senha"
                      value={passwordConfirmation}
                      onChange={(event) =>
                        setPasswordConfirmation(event.target.value)
                      }
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="primary-button"
                    disabled={loading}
                  >
                    {loading ? "Atualizando senha..." : "Salvar nova senha"}
                  </button>
                </form>
              ) : (
                <div className="auth-recovery-state">
                  <p className="muted">
                    {bootstrapping
                      ? "Preparando sua recuperação de senha..."
                      : "Abra este endereço a partir do link mais recente enviado para o seu e-mail de recuperação."}
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
