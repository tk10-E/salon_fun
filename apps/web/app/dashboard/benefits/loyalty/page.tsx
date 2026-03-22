import { CommercialPageIntro, LoyaltyOverviewSection, LoyaltyProgramPanel } from "../_components";
import type { NoticeSearchParams } from "../_lib";
import { loadLoyaltyPageData } from "../_lib";

type LoyaltyPageProps = {
  searchParams?: NoticeSearchParams;
};

export default async function LoyaltyPage({ searchParams }: LoyaltyPageProps) {
  const data = await loadLoyaltyPageData();

  return (
    <div className="two-column-grid">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/loyalty"
          title="Fidelidade e ranking"
          description="Pontos, cashback, desconto progressivo e VIP em uma tela própria, com leitura do ranking e da evolução real dos clientes."
          message={searchParams?.message}
          tone={searchParams?.tone}
        />
        <LoyaltyOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <LoyaltyProgramPanel data={data} />
      </div>
    </div>
  );
}
