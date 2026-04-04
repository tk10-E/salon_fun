import { redirect } from "next/navigation";

import { PanelAuthClient } from "@/components/auth/PanelAuthClient";
import { getAuthenticatedPanelEntryPath } from "@/lib/auth";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const entryPath = await getAuthenticatedPanelEntryPath();

  if (entryPath) {
    redirect(entryPath);
  }

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

          <PanelAuthClient initialMessage={searchParams?.message} initialTone={searchParams?.tone} />
        </section>
      </div>
    </div>
  );
}
