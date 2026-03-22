import { CommercialPageIntro, ReferralProgramPanel, ReferralsOverviewSection } from "../_components";
import type { ReferralSearchParams } from "../_lib";
import { loadReferralsPageData } from "../_lib";

type ReferralsPageProps = {
  searchParams?: ReferralSearchParams;
};

export default async function ReferralsPage({ searchParams }: ReferralsPageProps) {
  const data = await loadReferralsPageData(searchParams);

  return (
    <div className="two-column-grid">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/referrals"
          title="Programa de indicação"
          description="Configuração do incentivo e relatório de validação em uma área própria para não misturar indicação com promoções ou fidelidade."
          message={searchParams?.message}
          tone={searchParams?.tone}
        />
        <ReferralsOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <ReferralProgramPanel data={data} />
      </div>
    </div>
  );
}
