import {
  sendPasswordResetAction,
  signInAction,
  signInWithGoogleAction,
  signUpAction,
} from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";

type LoginPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default function LoginPage({ searchParams }: LoginPageProps) {
  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="hero-card auth-hero-panel">
          <div className="auth-hero-copy">
            <div className="hero-badges">
              <span className="eyebrow">Painel profissional</span>
              <span className="hero-note">Operação mais leve</span>
            </div>

            <p className="auth-hero-kicker">Agenda, equipe, clientes e crescimento em um só lugar</p>
            <h1>Seu salão mais organizado, mais claro e mais pronto para crescer.</h1>
            <p className="auth-hero-summary">
              Tenha uma visão profissional da rotina do salão para cuidar dos agendamentos,
              da equipe, dos clientes e das campanhas de retenção sem perder tempo.
            </p>
          </div>

          <div className="auth-capability-grid">
            <article className="auth-capability-card">
              <strong>Agenda e equipe</strong>
              <span>Veja horários, remanejamentos e confirmações com leitura rápida e sem ruído.</span>
            </article>
            <article className="auth-capability-card">
              <strong>Clientes e fidelização</strong>
              <span>Centralize histórico, promoções, indicações e automações de retorno em um painel só.</span>
            </article>
            <article className="auth-capability-card">
              <strong>Operação mais confiante</strong>
              <span>Controle serviços, comunicações e oportunidades comerciais com menos retrabalho.</span>
            </article>
          </div>

          <div className="auth-proof-strip">
            <div className="auth-proof-item">
              <span className="auth-proof-label">Fluxo diário</span>
              <strong>Mais organizado</strong>
            </div>
            <div className="auth-proof-item">
              <span className="auth-proof-label">Contato com clientes</span>
              <strong>Mais direto</strong>
            </div>
            <div className="auth-proof-item">
              <span className="auth-proof-label">Decisão do salão</span>
              <strong>Mais clara</strong>
            </div>
          </div>
        </section>

        <section className="auth-panel-column">
          <div className="auth-panel-intro">
            <span className="eyebrow">Acesso do salão</span>
            <h2>Entre ou crie a conta do seu painel</h2>
            <p className="muted">
              Use o acesso do salão para abrir o dashboard e acompanhar agenda, clientes,
              serviços, avisos e automações comerciais.
            </p>
          </div>

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
              <form action={signInWithGoogleAction} className="form-grid">
                <input type="hidden" name="next" value="/dashboard" />
                <button type="submit" className="secondary-button auth-provider-button">
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
                  <span>Continuar com Google</span>
                </button>
                <p className="field-hint auth-provider-note">
                  Ideal para um onboarding mais rápido, sem depender de senha no primeiro acesso.
                </p>
              </form>
            </div>

            <div className="panel-card panel-card--accent auth-form-card">
              <div className="panel-card__header">
                <span className="eyebrow">Sua conta</span>
              </div>
              <div className="auth-form-card__meta">
                <h3>Entrar</h3>
                <p className="muted">Acesse o painel para acompanhar a operação do salão em tempo real.</p>
              </div>
              <form action={signInAction} className="form-grid">
                <div className="field">
                  <label htmlFor="signin-email">E-mail</label>
                  <input id="signin-email" name="email" type="email" placeholder="salao@email.com" required />
                </div>

                <div className="field">
                  <label htmlFor="signin-password">Senha</label>
                  <input id="signin-password" name="password" type="password" placeholder="Sua senha" required />
                </div>

                <button type="submit" className="primary-button">
                  Acessar minha conta
                </button>
              </form>

              <div className="auth-inline-divider" aria-hidden="true">
                <span />
              </div>

              <form action={sendPasswordResetAction} className="form-grid auth-recovery-form">
                <div className="auth-compact-copy">
                  <strong>Recuperar conta</strong>
                  <p className="muted">
                    Envie um link seguro para redefinir a senha e retomar o acesso do salão.
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
                  />
                </div>

                <button type="submit" className="secondary-button">
                  Enviar link de recuperação
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
              <form action={signUpAction} className="form-grid">
                <div className="field">
                  <label htmlFor="signup-email">E-mail</label>
                  <input id="signup-email" name="email" type="email" placeholder="novo@email.com" required />
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
                  />
                  <span className="field-hint">
                    Se o acesso entrar na hora, você segue direto para a configuração inicial do salão.
                  </span>
                </div>

                <button type="submit" className="secondary-button">
                  Começar agora
                </button>
              </form>
            </div>
          </div>

          {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}
        </section>
      </div>
    </div>
  );
}
