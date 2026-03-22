import { redirect } from "next/navigation";

import { createSalonAction } from "@/app/actions";
import { FlashMessage } from "@/components/FlashMessage";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type OnboardingPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function OnboardingPage({ searchParams }: OnboardingPageProps) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: existingSalon } = await supabase
    .from("salons")
    .select("*")
    .match({ owner_user_id: user.id })
    .maybeSingle();
  const existingSalonData = existingSalon as { id: string } | null;

  if (existingSalonData?.id) {
    redirect("/dashboard");
  }

  return (
    <div className="setup-page">
      <section className="setup-card card">
        <span className="eyebrow">Primeiros passos</span>
        <h1>Falta pouco para o seu salão ficar pronto.</h1>
        <p>Informe o nome do salão. O código para seus clientes será criado automaticamente.</p>

        <div className="setup-highlight">
          <strong>Em instantes você já pode cadastrar serviços e compartilhar o acesso com seus clientes.</strong>
        </div>

        <form action={createSalonAction} className="form-grid">
          <div className="field">
            <label htmlFor="salon-name">Nome do salão</label>
            <input id="salon-name" name="name" placeholder="Studio Beleza Centro" required />
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
