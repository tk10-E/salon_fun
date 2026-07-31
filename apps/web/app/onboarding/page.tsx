import { redirect } from "next/navigation";

import { createSalonAction } from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { getOwnerSalon, requireUser } from "@/lib/auth";
import { resolveOnboardingReturnPath } from "@/lib/onboardingActivation";
import { SALON_SEGMENT_OPTIONS } from "@/lib/salonSegments";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: Promise<{
    message?: string;
    returnPath?: string;
    tone?: string;
  }>;
};

export default async function OnboardingPage({ searchParams: searchParamsPromise }: OnboardingPageProps) {
  const [searchParams, { user }] = await Promise.all([
    searchParamsPromise,
    requireUser(),
  ]);
  const returnPath = resolveOnboardingReturnPath(searchParams?.returnPath);

  const existingSalon = await getOwnerSalon(user.id);

  if (existingSalon?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="setup-page">
      <section className="setup-card card">
        <span className="eyebrow">Primeiros passos</span>
        <h1>Falta pouco para o seu salão começar.</h1>
        <p>Informe o nome do salão e escolha o segmento. Na próxima etapa, você escolhe a assinatura para liberar o painel.</p>

        <div className="setup-highlight">
          <strong>Primeiro você cria o salão. Depois escolhe a assinatura para liberar agenda, clientes, caixa e o restante do painel.</strong>
        </div>

        <form action={createSalonAction} className="form-grid">
          <input type="hidden" name="returnPath" value={returnPath} />

          <div className="field">
            <label htmlFor="salon-name">Nome do salão</label>
            <input id="salon-name" name="name" placeholder="Studio Beleza Centro" required />
          </div>

          <div className="field">
            <label htmlFor="business-segment">Segmento do salão</label>
            <select id="business-segment" name="businessSegment" defaultValue="beauty_salon">
              {SALON_SEGMENT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <button type="submit" className="primary-button">
            Salvar e continuar
          </button>
        </form>

        {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}
      </section>
    </div>
  );
}
