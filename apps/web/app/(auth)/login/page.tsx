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

const DEFAULT_LOGIN_SECURITY_MESSAGE =
  "No primeiro acesso, pode ser necessário configurar o autenticador.";

export default async function LoginPage({ searchParams: searchParamsPromise }: LoginPageProps) {
  const entryPath = await getAuthenticatedPanelEntryPath();

  if (entryPath) {
    redirect(entryPath);
  }

  const searchParams = await searchParamsPromise;
  const firebaseConfig = getFirebaseWebConfig();
  const initialMessage =
    searchParams?.message?.trim() || DEFAULT_LOGIN_SECURITY_MESSAGE;
  const initialTone = searchParams?.tone ?? "info";

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="hero-card auth-hero-panel auth-hero-panel--compact">
          <div className="auth-hero-copy auth-hero-copy--compact">
            <div className="hero-badges">
              <span className="eyebrow">Painel do salão</span>
              <span className="hero-note">Acesso seguro</span>
            </div>

            <p className="auth-hero-kicker">Gestão diária</p>
            <h1>Acessar o painel</h1>
            <p className="auth-hero-summary">
              Entre para acompanhar agenda, clientes, equipe e pagamentos.
            </p>
          </div>
          <p className="auth-hero-caption">
            Acesso protegido com autenticação adicional e monitoramento de
            sessão.
          </p>
        </section>

        <section className="auth-panel-column auth-panel-column--compact">
          <div className="auth-panel-intro auth-panel-intro--compact">
            <span className="eyebrow">Acesso</span>
            <h2>Entre com sua conta</h2>
            <p className="muted">Use Google, Facebook ou o e-mail principal do salão.</p>
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
