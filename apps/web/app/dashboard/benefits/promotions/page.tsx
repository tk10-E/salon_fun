import { CommercialPageIntro, NewOfferPanel, PromotionsOverviewSection } from "../_components";
import type { OfferSearchParams } from "../_lib";
import { loadPromotionsPageData } from "../_lib";

type PromotionsPageProps = {
  searchParams?: OfferSearchParams;
};

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const data = await loadPromotionsPageData(searchParams);

  return (
    <div className="two-column-grid">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/promotions"
          title="Promoções e planos"
          description="Catálogo comercial separado para publicar campanhas sazonais e planos mensais sem misturar com outras frentes do painel."
          message={searchParams?.message}
          tone={searchParams?.tone}
        />
        <PromotionsOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <NewOfferPanel />
      </div>
    </div>
  );
}
