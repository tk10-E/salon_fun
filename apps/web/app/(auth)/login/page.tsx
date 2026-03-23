import { signInAction, signUpAction } from "@/app/actions";
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
