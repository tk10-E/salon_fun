import { redirect } from "next/navigation";

import { FirebaseWebRuntimeConfig } from "@/components/auth/FirebaseWebRuntimeConfig";
import { PanelAuthClient } from "@/components/auth/PanelAuthClient";
import { getAuthenticatedPanelEntryPath } from "@/lib/auth";
import { getFirebaseWebConfig } from "@/lib/firebase/config";

export const dynamic = "force-dynamic";

type LoginPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function LoginPage({ searchParams: searchParamsPromise }: LoginPageProps) {
  const entryPath = await getAuthenticatedPanelEntryPath();

  if (entryPath) {
    redirect(entryPath);
  }

  const searchParams = await searchParamsPromise;
  const firebaseConfig = getFirebaseWebConfig();
  const initialMessage = searchParams?.message?.trim() || undefined;
  const initialTone = searchParams?.tone ?? "info";

  return (
    <div className="auth-page">
      <div className="auth-shell auth-login-shell">
        <section className="hero-card auth-hero-panel auth-hero-panel--compact auth-login-hero">
          <div className="auth-hero-copy auth-hero-copy--compact">
            <div className="hero-badges">
              <span className="eyebrow">Painel do salão</span>
              <span className="hero-note">Acesso seguro</span>
            </div>

            <h1>Acessar o painel</h1>
            <p className="auth-hero-summary">
              Agenda, clientes, caixa e app do cliente em um só lugar.
            </p>
          </div>

          <div className="auth-login-highlights" aria-label="O que você acompanha no painel">
            <article className="auth-login-highlight">
              <strong>Agenda do dia</strong>
              <span>Horários, confirmações e encaixes.</span>
            </article>
            <article className="auth-login-highlight">
              <strong>Clientes e caixa</strong>
              <span>Receita, retorno e pedidos do app.</span>
            </article>
            <article className="auth-login-highlight">
              <strong>Acesso protegido</strong>
              <span>Autenticador só quando a conta exigir.</span>
            </article>
          </div>

          <p className="auth-hero-caption">
            Entre só para trabalhar. O resto do fluxo aparece no momento certo.
          </p>
        </section>

        <section className="auth-panel-column auth-panel-column--compact auth-login-column">
          <div className="auth-panel-intro auth-panel-intro--compact">
            <span className="eyebrow">Acesso</span>
            <h2>Entre com sua conta</h2>
            <p className="muted">Use Google ou o e-mail principal do salão.</p>
          </div>

          <FirebaseWebRuntimeConfig config={firebaseConfig} />
          <PanelAuthClient
            initialMessage={initialMessage}
            initialTone={initialTone}
            firebaseConfig={firebaseConfig}
          />
        </section>
      </div>
    </div>
  );
}
