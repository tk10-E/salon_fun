import { saveSalonLoyaltyProgramAction } from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatCurrency } from "@/lib/formatters";

import type { LoyaltyPageData } from "./_lib";

type LoyaltyPageContentProps = {
  data: LoyaltyPageData;
};

export function LoyaltyPageContent({ data }: LoyaltyPageContentProps) {
  const topCustomer = data.loyaltyLeaderboard[0];

  return (
    <>
      <LoyaltyHeader
        isActive={Boolean(data.loyaltyProgram?.is_active)}
        rankedCustomers={data.loyaltyOverview.ranked_customers ?? 0}
        vipCustomers={data.loyaltyOverview.vip_customers ?? 0}
      />
      <LoyaltySummarySection
        loyaltyProgram={data.loyaltyProgram}
        topCustomer={topCustomer}
      />
      <LoyaltyProgramSection data={data} />
    </>
  );
}

function LoyaltyHeader({
  isActive,
  rankedCustomers,
  vipCustomers,
}: {
  isActive: boolean;
  rankedCustomers: number;
  vipCustomers: number;
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Campanhas · Fidelidade</p>
        <h1>Fidelidade com pontos e cashback</h1>
        <p className="muted">Edite regras principais e veja o ranking rápido.</p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className={isActive ? "badge badge--confirmed" : "badge badge--soft"}>
            {isActive ? "Programa ativo" : "Programa pausado"}
          </span>
          <span className="badge badge--soft">{rankedCustomers} ranqueados</span>
          <span className="badge badge--soft">{vipCustomers} VIP</span>
        </div>
      </div>
    </header>
  );
}

function LoyaltySummarySection({
  loyaltyProgram,
  topCustomer,
}: {
  loyaltyProgram: LoyaltyPageData["loyaltyProgram"];
  topCustomer: LoyaltyPageData["loyaltyLeaderboard"][number] | undefined;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Resumo rápido</h2>
          <p className="muted">Ranking e saldo principal.</p>
        </div>
      </div>

      {loyaltyProgram ? (
        <div className="simple-list">
          <article className="simple-row">
            <h3>{loyaltyProgram.title}</h3>
            <p className="muted">
              {loyaltyProgram.description?.trim() ||
                "O cliente acompanha saldo, ranking e próximo nível no app."}
            </p>
            <small className="list-meta">
              {loyaltyProgram.points_per_visit} pontos por visita •{" "}
              {loyaltyProgram.cashback_percent}% de cashback
            </small>
            <small className="list-meta">
              VIP em {loyaltyProgram.vip_min_visits} visitas com{" "}
              {loyaltyProgram.vip_discount_percent}% de desconto.
            </small>
          </article>

          <article className="simple-row">
            <div className="inline-actions" style={{ marginBottom: 6 }}>
              <span className="badge badge--soft">Ranking</span>
            </div>
            {topCustomer ? (
              <>
                <h3>{topCustomer.customer_name}</h3>
                <p className="muted">
                  {topCustomer.points_balance} pts •{" "}
                  {formatCurrency(Number(topCustomer.cashback_balance))} cashback •{" "}
                  {topCustomer.completed_visits} visitas
                </p>
              </>
            ) : (
              <p className="muted">Ainda não há clientes ranqueados.</p>
            )}
          </article>
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Programa ausente"
          title="Configure o programa para começar"
          description="Defina título, pontos e níveis abaixo."
        />
      )}
    </section>
  );
}

function LoyaltyProgramSection({ data }: { data: LoyaltyPageData }) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Regras do programa</h2>
          <p className="muted">Campos essenciais em um formulário.</p>
        </div>
      </div>

      <form action={saveSalonLoyaltyProgramAction} className="simple-form">
        <div className="field">
          <label htmlFor="loyalty-title">Título</label>
          <input
            id="loyalty-title"
            name="title"
            defaultValue={data.loyaltyProgram?.title ?? "Clube de fidelidade"}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="loyalty-description">Descrição</label>
          <textarea
            id="loyalty-description"
            name="description"
            rows={3}
            defaultValue={data.loyaltyProgram?.description ?? ""}
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="loyalty-points">Pontos por visita</label>
            <input
              id="loyalty-points"
              name="pointsPerVisit"
              type="number"
              min="1"
              step="1"
              defaultValue={data.loyaltyProgram?.points_per_visit ?? 10}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="loyalty-cashback">Cashback (%)</label>
            <input
              id="loyalty-cashback"
              name="cashbackPercent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={Number(data.loyaltyProgram?.cashback_percent ?? 5)}
              required
            />
          </div>
          <div className="field">
            <label className="checkbox-field" style={{ marginTop: 28 }}>
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={data.loyaltyProgram?.is_active ?? false}
              />
              Ativar programa
            </label>
          </div>
        </div>

        <div className="simple-list">
          <article className="simple-row">
            <h3>Nível 1</h3>
            <div className="split-grid">
              <input
                name="tierOneName"
                defaultValue={data.loyaltyProgram?.tier_one_name ?? "Bronze"}
                placeholder="Nome"
                required
              />
              <input
                name="tierOneMinVisits"
                type="number"
                min="1"
                step="1"
                defaultValue={data.loyaltyProgram?.tier_one_min_visits ?? 3}
                required
              />
              <input
                name="tierOneDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={Number(
                  data.loyaltyProgram?.tier_one_discount_percent ?? 5,
                )}
                required
              />
            </div>
          </article>

          <article className="simple-row">
            <h3>Nível 2</h3>
            <div className="split-grid">
              <input
                name="tierTwoName"
                defaultValue={data.loyaltyProgram?.tier_two_name ?? "Prata"}
                placeholder="Nome"
                required
              />
              <input
                name="tierTwoMinVisits"
                type="number"
                min="2"
                step="1"
                defaultValue={data.loyaltyProgram?.tier_two_min_visits ?? 6}
                required
              />
              <input
                name="tierTwoDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={Number(
                  data.loyaltyProgram?.tier_two_discount_percent ?? 10,
                )}
                required
              />
            </div>
          </article>

          <article className="simple-row">
            <h3>VIP</h3>
            <div className="split-grid">
              <input
                name="vipTierName"
                defaultValue={data.loyaltyProgram?.vip_tier_name ?? "Ouro"}
                placeholder="Nome"
                required
              />
              <input
                name="vipMinVisits"
                type="number"
                min="3"
                step="1"
                defaultValue={data.loyaltyProgram?.vip_min_visits ?? 10}
                required
              />
              <input
                name="vipDiscountPercent"
                type="number"
                min="0"
                max="100"
                step="0.5"
                defaultValue={Number(
                  data.loyaltyProgram?.vip_discount_percent ?? 15,
                )}
                required
              />
            </div>

            <div className="field" style={{ marginTop: 10 }}>
              <label htmlFor="vip-reward-service">Recompensa VIP (opcional)</label>
              <select
                id="vip-reward-service"
                name="vipRewardServiceId"
                defaultValue={data.loyaltyProgram?.vip_reward_service_id ?? ""}
              >
                <option value="">Sem serviço extra</option>
                {data.serviceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.name}
                    {service.category ? ` • ${service.category}` : ""}
                  </option>
                ))}
              </select>
            </div>
          </article>
        </div>

        <button type="submit" className="primary-button">
          Salvar programa
        </button>
      </form>
    </section>
  );
}
