import Link from "next/link";
import { redirect } from "next/navigation";

import { FirebaseWebRuntimeConfig } from "@/components/auth/FirebaseWebRuntimeConfig";
import { PanelAuthClient } from "@/components/auth/PanelAuthClient";
import { getAuthenticatedPanelEntryPath } from "@/lib/auth";
import { getFirebaseWebConfig } from "@/lib/firebase/config";
import { resolveOnboardingReturnPath } from "@/lib/onboardingActivation";

export const dynamic = "force-dynamic";

type ActivationPageProps = {
  searchParams?: Promise<{
    message?: string;
    returnPath?: string;
    tone?: string;
  }>;
};

const DEFAULT_ACTIVATION_MESSAGE =
  "Crie a conta principal para montar o salão e liberar o painel.";

function buildOnboardingPath(returnPath: string) {
  if (returnPath === "/planos") {
    return "/onboarding";
  }

  return `/onboarding?returnPath=${encodeURIComponent(returnPath)}`;
}

export default async function ActivationPage({
  searchParams: searchParamsPromise,
}: ActivationPageProps) {
  const searchParams = await searchParamsPromise;
  const returnPath = resolveOnboardingReturnPath(searchParams?.returnPath);
  const onboardingPath = buildOnboardingPath(returnPath);
  const entryPath = await getAuthenticatedPanelEntryPath();

  if (entryPath) {
    if (entryPath === "/onboarding") {
      redirect(onboardingPath);
    }

    redirect(entryPath);
  }

  const firebaseConfig = getFirebaseWebConfig();
  const initialMessage =
    searchParams?.message?.trim() || DEFAULT_ACTIVATION_MESSAGE;
  const initialTone = searchParams?.tone ?? "info";

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <section className="hero-card auth-hero-panel auth-hero-panel--compact">
          <div className="auth-hero-copy auth-hero-copy--compact">
            <div className="hero-badges">
              <span className="eyebrow">Começar</span>
              <span className="hero-note">Conta principal</span>
            </div>

            <p className="auth-hero-kicker">Cadastro rápido</p>
            <h1>Crie sua conta</h1>
            <p className="auth-hero-summary">
              Depois você cria o salão, escolhe o plano e entra no painel.
            </p>
          </div>

          <div className="auth-capability-grid">
            <article className="auth-capability-card">
              <strong>1. Criar a conta</strong>
              <span>Google ou e-mail.</span>
            </article>

            <article className="auth-capability-card">
              <strong>2. Criar o salão</strong>
              <span>Nome, segmento e dados básicos.</span>
            </article>

            <article className="auth-capability-card">
              <strong>3. Liberar o painel</strong>
              <span>Escolha o plano e comece.</span>
            </article>
          </div>

          <div className="auth-proof-strip">
            <article className="auth-proof-item">
              <span className="auth-proof-label">Conta</span>
              <strong>Acesso principal</strong>
            </article>
            <article className="auth-proof-item">
              <span className="auth-proof-label">Próximo passo</span>
              <strong>Criar salão</strong>
            </article>
            <article className="auth-proof-item">
              <span className="auth-proof-label">Meta</span>
              <strong>Painel liberado</strong>
            </article>
          </div>

          <p className="auth-hero-caption">
            Já tem conta? Entre no painel e continue de onde parou.
            {" "}
            <Link href="/login">Ir para login</Link>
          </p>
        </section>

        <section className="auth-panel-column auth-panel-column--compact">
          <div className="auth-panel-intro auth-panel-intro--compact">
            <span className="eyebrow">Cadastro</span>
            <h2>Abra a conta principal</h2>
            <p className="muted">
              O cadastro já leva você para o próximo passo. Se veio dos planos,
              continuamos da mesma etapa.
            </p>
          </div>

          <FirebaseWebRuntimeConfig config={firebaseConfig} />
          <PanelAuthClient
            emailConfirmationPath="/comecar"
            firebaseConfig={firebaseConfig}
            initialMessage={initialMessage}
            initialTone={initialTone}
            mode="sign-up"
            onboardingPath={onboardingPath}
          />
        </section>
      </div>
    </div>
  );
}
