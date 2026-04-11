import { redirect } from "next/navigation";

import { FirebaseWebRuntimeConfig } from "@/components/auth/FirebaseWebRuntimeConfig";
import { PanelAuthClient } from "@/components/auth/PanelAuthClient";
import { getAuthenticatedPanelEntryPath } from "@/lib/auth";
import { getFirebaseWebConfig } from "@/lib/firebase/config";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const entryPath = await getAuthenticatedPanelEntryPath();
  const firebaseConfig = getFirebaseWebConfig();

  if (entryPath) {
    redirect(entryPath);
  }

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="hero-card auth-hero-panel auth-hero-panel--compact">
          <div className="auth-hero-copy auth-hero-copy--compact">
            <div className="hero-badges">
              <span className="eyebrow">Painel do salão</span>
              <span className="hero-note">Acesso profissional</span>
            </div>

            <p className="auth-hero-kicker">Login simples para uma operação forte</p>
            <h1>Entrar no painel do salão</h1>
            <p className="auth-hero-summary">
              Agenda, clientes, equipe e crescimento em um só fluxo.
            </p>
          </div>

          <div className="auth-hero-points">
            <div className="auth-hero-point">
              <strong>Agenda em dia</strong>
              <span>Confirmações e encaixes com leitura rápida.</span>
            </div>
            <div className="auth-hero-point">
              <strong>Equipe alinhada</strong>
              <span>Profissionais, serviços e operação no mesmo ritmo.</span>
            </div>
            <div className="auth-hero-point">
              <strong>Clientes por perto</strong>
              <span>Retenção, avisos e crescimento no mesmo painel.</span>
            </div>
          </div>
        </section>

        <section className="auth-panel-column auth-panel-column--compact">
          <div className="auth-panel-intro auth-panel-intro--compact">
            <span className="eyebrow">Acesso</span>
            <h2>Use o login do salão</h2>
            <p className="muted">Entre com Google ou com o e-mail da sua conta.</p>
          </div>

          <FirebaseWebRuntimeConfig config={firebaseConfig} />
          <PanelAuthClient
            initialMessage={searchParams?.message}
            initialTone={searchParams?.tone}
            firebaseConfig={firebaseConfig}
          />
        </section>
      </div>
    </div>
  );
}
