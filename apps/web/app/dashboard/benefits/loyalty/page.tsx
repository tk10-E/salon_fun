import { CommercialPageIntro, LoyaltyOverviewSection, LoyaltyProgramPanel } from "../_components";
import type { NoticeSearchParams } from "../_lib";
import { loadLoyaltyPageData } from "../_lib";
import { formatCurrency } from "@/lib/formatters";

type LoyaltyPageProps = {
  searchParams?: NoticeSearchParams;
};

export default async function LoyaltyPage({ searchParams }: LoyaltyPageProps) {
  const data = await loadLoyaltyPageData();
  const topCustomer = data.loyaltyLeaderboard[0];

  return (
    <div className="two-column-grid workspace-page commercial-page">
      <section className="page-grid">
        <CommercialPageIntro
          currentPath="/dashboard/benefits/loyalty"
          title="Fidelidade e ranking"
          description="Pontos, cashback, desconto progressivo e VIP em uma tela própria, com leitura do ranking e da evolução real dos clientes."
          message={searchParams?.message}
          tone={searchParams?.tone}
          highlight={{
            label: "Líder do ranking",
            value: topCustomer?.customer_name ?? "Sem ranking ainda",
            note: topCustomer
              ? `${topCustomer.completed_visits} visitas concluídas e ${topCustomer.points_balance} pontos disponíveis agora.`
              : "Assim que os clientes concluírem visitas, o ranking começa a subir aqui com dados reais.",
          }}
          signals={[
            {
              label: "Programa",
              value: data.loyaltyProgram?.is_active ? "Ativo" : "Pausado",
              tone: data.loyaltyProgram?.is_active ? "success" : "soft",
            },
            {
              label: "Serviço VIP",
              value: data.loyaltyProgram?.vip_reward_service_name ?? "Sem brinde",
              tone: "accent",
            },
            {
              label: "Clientes VIP",
              value: data.loyaltyOverview.vip_customers ?? 0,
              tone: "warm",
            },
          ]}
        stats={[
          {
            label: "Ranking ativo",
            value: data.loyaltyOverview.ranked_customers ?? 0,
            note: "Clientes com pontos e histórico suficientes para entrar no ranking.",
            tone: "warm",
          },
            {
              label: "Visitas concluídas",
              value: data.loyaltyOverview.total_completed_visits ?? 0,
              note: "Atendimentos que já alimentaram o programa de fidelidade.",
              tone: "soft",
            },
            {
              label: "Pontos emitidos",
              value: data.loyaltyOverview.total_points_earned ?? 0,
              note: "Volume total de pontos distribuídos na carteira do salão.",
              tone: "accent",
            },
          {
            label: "Cashback total",
            value: formatCurrency(Number(data.loyaltyOverview.total_cashback_earned ?? 0)),
            note: "Saldo acumulado em benefícios distribuídos para retorno.",
            tone: "success",
            },
          ]}
          aside={
            <>
              <span className="workspace-panel__eyebrow">Estratégia de retenção</span>
              <h3>
                {data.loyaltyProgram?.is_active
                  ? `${data.loyaltyProgram.title || "Programa de fidelidade"} está sustentando recorrência.`
                  : "O salão pode transformar retorno em jogo claro para o cliente."}
              </h3>
              <p>
                Quando o ranking fica bem comunicado, o cliente passa a perceber avanço, benefício e recompensa. Isso aumenta hábito e reduz dependência de desconto manual.
              </p>
            </>
          }
        />
        <LoyaltyOverviewSection data={data} />
      </section>

      <div className="page-grid">
        <LoyaltyProgramPanel data={data} />
      </div>
    </div>
  );
}
