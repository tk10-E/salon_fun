import { CommercialOverviewPanel, CommercialPageIntro } from "./_components";
import type { NoticeSearchParams } from "./_lib";
import { loadBenefitsOverviewData } from "./_lib";

type BenefitsPageProps = {
  searchParams?: NoticeSearchParams;
};

export default async function BenefitsPage({ searchParams }: BenefitsPageProps) {
  const data = await loadBenefitsOverviewData();
  const automationActive =
    data.growthAutomationSettings.is_active ||
    data.growthAutomationSettings.smart_rebook_is_active;

  return (
    <div className="page-grid workspace-page commercial-page">
      <CommercialPageIntro
        currentPath="/dashboard/benefits"
        title="Comercial e retenção"
        description="Cada frente comercial do salão agora fica em uma tela própria: promoções, fidelidade, indicação e automações."
        message={searchParams?.message}
        tone={searchParams?.tone}
        highlight={{
          label: "Motor comercial ativo",
          value: automationActive ? "Retenção ligada" : "Operação manual",
          note: automationActive
            ? `Winback em ${data.growthAutomationSettings.winback_inactive_days} dias e rebook inteligente até ${data.growthAutomationSettings.smart_rebook_window_days} dias antes da janela ideal.`
            : "As automações podem ser ativadas para puxar rebook e recuperação sem depender de ação manual o tempo todo.",
        }}
        signals={[
          {
            label: "Promoções ativas",
            value: data.activeOffersCount,
            tone: "warm",
          },
          {
            label: "Planos mensais",
            value: data.activeMembershipsCount,
            tone: "soft",
          },
          {
            label: "Indicações pendentes",
            value: data.pendingReferralsCount,
            tone: "accent",
          },
        ]}
        stats={[
          {
            label: "VIP na base",
            value: data.loyaltyOverview.vip_customers ?? 0,
            note: "Clientes no topo da fidelidade e com maior valor de recorrência.",
            tone: "success",
          },
          {
            label: "Base em risco",
            value: data.growthAutomationOverview.at_risk_customers ?? 0,
            note: "Sem próxima agenda e já perto de esfriar.",
            tone: "danger",
          },
          {
            label: "Validadas",
            value: data.qualifiedReferralsCount,
            note: "Clientes que vieram por indicação e já concluíram a primeira visita.",
            tone: "accent",
          },
          {
            label: "Ranking ativo",
            value: data.loyaltyOverview.ranked_customers ?? 0,
            note: "Clientes que já aparecem no ranking de fidelidade do salão.",
            tone: "soft",
          },
        ]}
        aside={
          <>
            <span className="workspace-panel__eyebrow">Leitura do dono</span>
            <h3>
              {data.loyaltyProgram?.is_active
                ? `${data.loyaltyProgram.title || "Programa de fidelidade"} está em jogo junto com o comercial.`
                : "O comercial está pronto para ficar mais previsível."}
            </h3>
            <p>
              Promoções, indicação, fidelidade e automações agora se conversam na mesma área. Isso ajuda a decidir onde empurrar aquisição, retenção e recorrência com dados reais.
            </p>
          </>
        }
      />
      <CommercialOverviewPanel data={data} />
    </div>
  );
}
