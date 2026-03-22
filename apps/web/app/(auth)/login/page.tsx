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
      <div className="auth-grid">
        <section className="hero-card">
          <div className="hero-copy">
            <div className="hero-badges">
              <span className="eyebrow">Feito para o seu salão</span>
              <span className="hero-note">Rotina mais leve</span>
            </div>

            <h1>Sua agenda mais organizada, do primeiro horário ao último atendimento.</h1>
            <p>
              Tenha uma rotina mais leve para cuidar dos agendamentos, acompanhar os
              clientes e manter o atendimento sempre em dia.
            </p>
          </div>

          <div className="feature-list">
            <article className="feature-card">
              <strong>Agenda em ordem</strong>
              <span>Veja horários, pedidos e confirmações com mais clareza ao longo do dia.</span>
            </article>
            <article className="feature-card">
              <strong>Clientes conectados</strong>
              <span>Compartilhe um código simples para cada cliente acessar o app certo.</span>
            </article>
            <article className="feature-card">
              <strong>Atendimento fluido</strong>
              <span>Confirme, remarque ou cancele atendimentos em poucos cliques.</span>
            </article>
          </div>
        </section>

        <section className="stack">
          <div className="panel-card panel-card--accent">
            <div className="panel-card__header">
              <span className="eyebrow">Sua conta</span>
            </div>
            <h2>Entrar</h2>
            <p className="muted">Acesse sua conta para acompanhar a rotina do salão.</p>
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

          <div className="panel-card">
            <div className="panel-card__header">
              <span className="eyebrow">Novo por aqui?</span>
            </div>
            <h2>Criar conta</h2>
            <p className="muted">Comece agora e deixe o seu salão pronto para receber agendamentos.</p>
            <form action={signUpAction} className="form-grid">
              <div className="field">
                <label htmlFor="signup-email">E-mail</label>
                <input id="signup-email" name="email" type="email" placeholder="novo@email.com" required />
              </div>

              <div className="field">
                <label htmlFor="signup-password">Senha</label>
                <input id="signup-password" name="password" type="password" minLength={6} placeholder="Mínimo 6 caracteres" required />
              </div>

              <button type="submit" className="secondary-button">
                Começar agora
              </button>
            </form>
          </div>

          {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}
        </section>
      </div>
    </div>
  );
}
