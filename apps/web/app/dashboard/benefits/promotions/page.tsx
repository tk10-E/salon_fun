import { CommercialPageIntro, NewOfferPanel, PromotionsOverviewSection } from "../_components";
import type { OfferSearchParams } from "../_lib";
import { getOfferLifecycle, loadPromotionsPageData } from "../_lib";

type PromotionsPageProps = {
  searchParams?: OfferSearchParams;
};

export default async function PromotionsPage({ searchParams }: PromotionsPageProps) {
  const data = await loadPromotionsPageData(searchParams);
  const scheduledCount = data.offers.filter((offer) => getOfferLifecycle(offer, data.today) === "scheduled").length;
  const pausedCount = data.offers.filter((offer) => getOfferLifecycle(offer, data.today) === "paused").length;
  const leadingOffer = data.offers[0];

  return (
    <div className="two-column-grid workspace-page commercial-page">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/promotions"
          title="Promoções e planos"
          description="Catálogo comercial separado para publicar campanhas sazonais e planos mensais sem misturar com outras frentes do painel."
          message={searchParams?.message}
          tone={searchParams?.tone}
          highlight={{
            label: "Oferta em primeiro plano",
            value: leadingOffer?.title ?? "Sem campanha ativa ainda",
            note: leadingOffer
              ? `${leadingOffer.kind === "membership" ? "Plano mensal" : "Promoção"} em destaque no recorte atual.`
              : "Crie a primeira campanha para transformar o app do cliente em uma vitrine comercial viva.",
          }}
          signals={[
            {
              label: "Filtro ativo",
              value: data.hasOfferFilters ? "Sim" : "Não",
              tone: data.hasOfferFilters ? "accent" : "soft",
            },
            {
              label: "Agendadas",
              value: scheduledCount,
              tone: "soft",
            },
            {
              label: "Pausadas",
              value: pausedCount,
              tone: pausedCount > 0 ? "danger" : "success",
            },
          ]}
          stats={[
            {
              label: "Ofertas ativas",
              value: data.activeOffersCount,
              note: "Campanhas e planos já disponíveis no app do cliente.",
              tone: "warm",
            },
            {
              label: "Planos mensais",
              value: data.activeMembershipsCount,
              note: "Assinaturas recorrentes ativas para proteger retorno.",
              tone: "accent",
            },
            {
              label: "No catálogo",
              value: data.offers.length,
              note: "Itens visíveis pelo filtro atual do comercial.",
              tone: "soft",
            },
            {
              label: "Agendadas",
              value: scheduledCount,
              note: "Campanhas prontas para entrar no app em breve.",
              tone: "success",
            },
          ]}
          aside={
            <>
              <span className="workspace-panel__eyebrow">Leitura comercial</span>
              <h3>
                {data.activeOffersCount > 0
                  ? "O app do cliente já pode vender campanhas com contexto."
                  : "Ainda falta colocar a primeira oferta no ar."}
              </h3>
              <p>
                Separar promoções de fidelidade e indicação ajuda o salão a publicar campanha com clareza, sem poluir a home do cliente com regras misturadas.
              </p>
            </>
          }
        />
        <PromotionsOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <NewOfferPanel />
      </div>
    </div>
  );
}
