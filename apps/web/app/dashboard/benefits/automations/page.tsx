import { CommercialPageIntro, GrowthAutomationOverviewSection, GrowthAutomationPanel } from "../_components";
import type { NoticeSearchParams } from "../_lib";
import { loadGrowthAutomationPageData } from "../_lib";

type AutomationsPageProps = {
  searchParams?: NoticeSearchParams;
};

export default async function AutomationsPage({ searchParams }: AutomationsPageProps) {
  const data = await loadGrowthAutomationPageData();

  return (
    <div className="two-column-grid">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/automations"
          title="Automações comerciais"
          description="Rebook inteligente e recuperação de clientes em uma área separada, com histórico de disparos e leitura de retorno."
          message={searchParams?.message}
          tone={searchParams?.tone}
        />
        <GrowthAutomationOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <GrowthAutomationPanel data={data} />
      </div>
    </div>
  );
}
