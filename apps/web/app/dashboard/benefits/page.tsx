import { CommercialOverviewPanel, CommercialPageIntro } from "./_components";
import type { NoticeSearchParams } from "./_lib";
import { loadBenefitsOverviewData } from "./_lib";

type BenefitsPageProps = {
  searchParams?: NoticeSearchParams;
};

export default async function BenefitsPage({ searchParams }: BenefitsPageProps) {
  const data = await loadBenefitsOverviewData();

  return (
    <div className="page-grid">
      <CommercialPageIntro
        currentPath="/dashboard/benefits"
        title="Comercial e retenção"
        description="Cada frente comercial do salão agora fica em uma tela própria: promoções, fidelidade, indicação e automações."
        message={searchParams?.message}
        tone={searchParams?.tone}
      />
      <CommercialOverviewPanel data={data} />
    </div>
  );
}
