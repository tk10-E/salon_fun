import { CommercialPageIntro, ReferralProgramPanel, ReferralsOverviewSection } from "../_components";
import type { ReferralSearchParams } from "../_lib";
import { loadReferralsPageData } from "../_lib";

type ReferralsPageProps = {
  searchParams?: ReferralSearchParams;
};

export default async function ReferralsPage({ searchParams }: ReferralsPageProps) {
  const data = await loadReferralsPageData(searchParams);
  const latestQualifiedReferral = data.referralEvents.find((event) => event.status === "qualified");

  return (
    <div className="two-column-grid workspace-page commercial-page">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/referrals"
          title="Programa de indicação"
          description="Configuração do incentivo e relatório de validação em uma área própria para não misturar indicação com promoções ou fidelidade."
          message={searchParams?.message}
          tone={searchParams?.tone}
          highlight={{
            label: "Última validação visível",
            value: latestQualifiedReferral?.invited_name ?? "Nenhuma validação ainda",
            note: latestQualifiedReferral
              ? `${latestQualifiedReferral.referrer_name} trouxe essa cliente usando o código ${latestQualifiedReferral.used_referral_code}.`
              : "Assim que uma indicação concluir a primeira visita, o painel começa a mostrar validações reais aqui.",
          }}
          signals={[
            {
              label: "Filtro ativo",
              value: data.hasReferralFilters ? "Sim" : "Não",
              tone: data.hasReferralFilters ? "accent" : "soft",
            },
          {
            label: "Pendentes",
            value: data.pendingCountInPeriod,
            tone: "warm",
          },
            {
              label: "Disponíveis para liberar",
              value: data.availableRewardUnlocksCount,
              tone: data.availableRewardUnlocksCount > 0 ? "success" : "soft",
            },
          ]}
          stats={[
            {
              label: "Entradas no período",
              value: data.referralEventsBaseCount,
              note: "Clientes que baixaram o app e chegaram pelo código de indicação.",
              tone: "soft",
            },
            {
              label: "Validadas",
              value: data.periodQualifiedCount,
              note: "Indicações que concluíram a primeira visita no recorte atual.",
              tone: "success",
            },
          {
            label: "Liberadas",
            value: data.rewardUnlocksCount,
            note: "Marcos já conquistados dentro da regra atual do programa.",
            tone: "accent",
            },
            {
              label: "Pendentes",
              value: data.pendingCountInPeriod,
              note: "Entradas que ainda dependem da primeira visita ser concluída.",
              tone: "warm",
            },
          ]}
          aside={
            <>
              <span className="workspace-panel__eyebrow">Aquisição orgânica</span>
              <h3>
                {data.referralProgram?.is_active
                  ? `${data.referralProgram.title || "Programa de indicação"} está pronto para escalar boca a boca.`
                  : "A estrutura do programa já está pronta para ativar crescimento por indicação."}
              </h3>
              <p>
                Aqui o salão enxerga a jornada completa da indicação: entrada no app, validação após visita e liberação de recompensa sem perder rastreabilidade.
              </p>
            </>
          }
        />
        <ReferralsOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <ReferralProgramPanel data={data} />
      </div>
    </div>
  );
}
