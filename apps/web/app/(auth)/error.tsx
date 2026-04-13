"use client";

type AuthErrorPageProps = {
  error: Error & { digest?: string };
  reset: () => void;
};

export default function AuthErrorPage({ reset }: AuthErrorPageProps) {
  function openLogin() {
    window.location.assign("/login");
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="hero-card auth-hero-panel">
          <div className="auth-hero-copy">
            <div className="hero-badges">
              <span className="eyebrow">Acesso do salão</span>
              <span className="hero-note">Recarregue com segurança</span>
            </div>
            <h1>O login encontrou um erro inesperado.</h1>
            <p className="auth-hero-summary">
              Recarregue esta etapa para tentar novamente. Se o problema persistir, abra o painel no domínio oficial
              e tente entrar de novo.
            </p>
          </div>
        </section>

        <section className="auth-panel-column">
          <div className="panel-card panel-card--accent auth-form-card">
            <div className="panel-card__header">
              <span className="eyebrow">Próximo passo</span>
            </div>
            <div className="auth-form-card__meta">
              <h3>Tentar novamente</h3>
              <p className="muted">
                Reabra o login no domínio oficial do painel para continuar com a sessão correta.
              </p>
            </div>
            <div className="form-grid">
              <button type="button" className="primary-button" onClick={() => reset()}>
                Recarregar login
              </button>
              <button
                type="button"
                className="secondary-button"
                onClick={openLogin}
              >
                Abrir domínio oficial
              </button>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
