import { CommercialPageIntro, GrowthAutomationOverviewSection, GrowthAutomationPanel } from "../_components";
import type { NoticeSearchParams } from "../_lib";
import { loadGrowthAutomationPageData } from "../_lib";

type AutomationsPageProps = {
  searchParams?: NoticeSearchParams;
};

export default async function AutomationsPage({ searchParams }: AutomationsPageProps) {
  const data = await loadGrowthAutomationPageData();
  const latestRun = data.growthAutomationRecentRuns[0];
  const automationLive = data.growthAutomationSettings.is_active || data.growthAutomationSettings.smart_rebook_is_active;

  return (
    <div className="two-column-grid workspace-page commercial-page">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/automations"
          title="Automações comerciais"
          description="Rebook inteligente e recuperação de clientes em uma área separada, com histórico de disparos e leitura de retorno."
          message={searchParams?.message}
          tone={searchParams?.tone}
          highlight={{
            label: "Último disparo visível",
            value: latestRun?.customer_name ?? "Nenhum disparo recente",
            note: latestRun
              ? `${latestRun.automation_type === "smart_rebook_prompt" ? "Rebook inteligente" : "Winback"} com a mensagem ${latestRun.title ? `"${latestRun.title}"` : "configurada na automação"}.`
              : "Assim que a automação rodar, esta área passa a mostrar o cliente mais recente impactado.",
          }}
          signals={[
            {
              label: "Motor ativo",
              value: automationLive ? "Sim" : "Não",
              tone: automationLive ? "success" : "soft",
            },
          {
            label: "Recuperados 30d",
            value: data.growthAutomationOverview.recovered_customers_last_30d ?? 0,
            tone: "accent",
          },
          {
            label: "Rebooks na fila",
            value: data.growthAutomationOverview.smart_rebook_due_customers ?? 0,
            tone: "warm",
          },
        ]}
        stats={[
          {
            label: "Base em risco",
            value: data.growthAutomationOverview.at_risk_customers ?? 0,
            note: "Sem próxima agenda e pedindo estímulo de retorno.",
            tone: "danger",
            },
            {
              label: "Due now",
              value: data.growthAutomationOverview.due_now_customers ?? 0,
              note: "Clientes já na janela de winback ou recuperação.",
              tone: "warm",
            },
            {
              label: "Winbacks 30d",
              value: data.growthAutomationOverview.winbacks_sent_last_30d ?? 0,
              note: "Disparos de recuperação já enviados no último mês.",
              tone: "soft",
            },
            {
              label: "Rebooks 30d",
              value: data.growthAutomationOverview.smart_rebooks_sent_last_30d ?? 0,
              note: "Lembretes inteligentes de rebook disparados no período.",
              tone: "success",
            },
          ]}
          aside={
            <>
              <span className="workspace-panel__eyebrow">Máquina de recorrência</span>
              <h3>
                {automationLive
                  ? "A retenção automática está rodando com dados reais."
                  : "O salão ainda pode ativar a camada automática de retenção."}
              </h3>
              <p>
                O objetivo aqui é reduzir esquecimento e ociosidade: o painel identifica quem precisa voltar, quando vale lembrar e quais clientes já responderam ao estímulo.
              </p>
            </>
          }
        />
        <GrowthAutomationOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <GrowthAutomationPanel data={data} />
      </div>
    </div>
  );
}
