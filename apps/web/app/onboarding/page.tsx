import { redirect } from "next/navigation";

import { createSalonAction } from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { getOwnerSalon, requireUser } from "@/lib/auth";
import { SALON_SEGMENT_OPTIONS } from "@/lib/salonSegments";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const { user } = await requireUser();

  const existingSalon = await getOwnerSalon(user.id);

  if (existingSalon?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="setup-page">
      <section className="setup-card card">
        <span className="eyebrow">Primeiros passos</span>
        <h1>Falta pouco para o seu salão ficar pronto.</h1>
        <p>Informe o nome do salão e escolha o segmento. O app já nasce com um preset visual e comercial mais próximo do seu negócio.</p>

        <div className="setup-highlight">
          <strong>Em instantes você já pode cadastrar serviços, entrar com um visual-base do seu segmento e compartilhar o acesso com seus clientes.</strong>
        </div>

        <form action={createSalonAction} className="form-grid">
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
