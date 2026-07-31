import Link from "next/link";

import {
  markReferralRewardRedeemedAction,
  sendMarketingCustomerCampaignAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

import type { BenefitsOverviewData } from "./_lib";

type BenefitsOverviewContentProps = {
  data: BenefitsOverviewData;
};

export function BenefitsOverviewContent({
  data,
}: BenefitsOverviewContentProps) {
  const automationActive =
    data.growthAutomationSettings.is_active ||
    data.growthAutomationSettings.smart_rebook_is_active;

  return (
    <>
      <BenefitsOverviewHeader
        activeMembershipsCount={data.activeMembershipsCount}
        activeOffersCount={data.activeOffersCount}
        automationActive={automationActive}
        vipCustomers={data.loyaltyOverview.vip_customers ?? 0}
      />
      <BenefitsOverviewSections data={data} />
    </>
  );
}

function BenefitsOverviewSections({
  data,
}: BenefitsOverviewContentProps) {
  const birthdayList = data.birthdayCustomers.slice(0, 5);
  const inactiveList = data.inactiveCustomers.slice(0, 5);

  return (
    <>
      <BenefitsQuickCampaignsSection />
      <BenefitsWalletStatsSection data={data} />
      <BenefitsWalletSection data={data} />
      <BenefitsExpiringMembershipsSection data={data} />
      <BenefitsRewardUnlocksSection data={data} />
      <BenefitsBirthdaysSection
        birthdayList={birthdayList}
        birthdaysThisMonth={data.birthdaysThisMonth}
      />
      <BenefitsInactiveCustomersSection
        inactiveList={inactiveList}
        inactiveThresholdDays={data.inactiveThresholdDays}
        inactiveTotal={data.inactiveTotal}
      />
      <BenefitsIdeasSection marketingIdeas={data.marketingIdeas} />
    </>
  );
}

function BenefitsOverviewHeader({
  activeMembershipsCount,
  activeOffersCount,
  automationActive,
  vipCustomers,
}: {
  activeMembershipsCount: number;
  activeOffersCount: number;
  automationActive: boolean;
  vipCustomers: number;
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Campanhas</p>
        <h1>Campanhas, fidelidade e retorno da base</h1>
        <p className="muted">
          Navegue rápido por promoções, fidelidade, indicações e retenção.
        </p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {activeOffersCount} ofertas ativas
          </span>
          <span className="badge badge--soft">{activeMembershipsCount} planos</span>
          <span
            className={
              automationActive ? "badge badge--confirmed" : "badge badge--soft"
            }
          >
            Automações {automationActive ? "ligadas" : "pausadas"}
          </span>
          <span className="badge badge--soft">{vipCustomers} clientes VIP</span>
        </div>
      </div>
      <div
        className="simple-row__actions"
        style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
      >
        <Link href="/dashboard/benefits/promotions" className="primary-button">
          Abrir promoções
        </Link>
        <Link href="/dashboard/benefits/loyalty" className="secondary-button">
          Abrir fidelidade
        </Link>
        <Link href="/dashboard/benefits/referrals" className="secondary-button">
          Abrir indicações
        </Link>
        <Link href="/dashboard/benefits/automations" className="secondary-button">
          Abrir automações
        </Link>
      </div>
    </header>
  );
}

function BenefitsQuickCampaignsSection() {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Campanhas rápidas</h2>
          <p className="muted">Escolha a frente e vá direto.</p>
        </div>
      </div>

      <div className="simple-list">
        <article className="simple-row">
          <h3>Promoções e planos</h3>
          <p className="muted">Crie ou edite o que aparece no app.</p>
          <div className="simple-row__actions">
            <Link href="/dashboard/benefits/promotions" className="primary-button">
              Abrir promoções
            </Link>
          </div>
        </article>

        <article className="simple-row">
          <h3>Fidelidade</h3>
          <p className="muted">Pontos, cashback e níveis.</p>
          <div className="simple-row__actions">
            <Link href="/dashboard/benefits/loyalty" className="primary-button">
              Abrir fidelidade
            </Link>
          </div>
        </article>

        <article className="simple-row">
          <h3>Indicações</h3>
          <p className="muted">Código, validação e recompensa.</p>
          <div className="simple-row__actions">
            <Link href="/dashboard/benefits/referrals" className="primary-button">
              Abrir indicações
            </Link>
          </div>
        </article>

        <article className="simple-row">
          <h3>Retorno automático</h3>
          <p className="muted">Reativação e lembrete de retorno.</p>
          <div className="simple-row__actions">
            <Link href="/dashboard/benefits/automations" className="primary-button">
              Abrir automações
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}

function BenefitsWalletStatsSection({ data }: { data: BenefitsOverviewData }) {
  return (
    <section className="stats-grid">
      <article className="card metric-card metric-card--warm">
        <span className="eyebrow">Carteira</span>
        <p className="stat-value">{data.walletSnapshot.cashbackCustomers}</p>
        <p className="metric-note">
          Clientes com saldo ou cashback no radar.
        </p>
      </article>
      <article className="card metric-card metric-card--soft">
        <span className="eyebrow">Cashback gerado</span>
        <p className="stat-value">
          {formatCurrency(Number(data.walletSnapshot.cashbackGenerated))}
        </p>
        <p className="metric-note">Acumulado pelo programa de fidelidade.</p>
      </article>
      <article className="card metric-card metric-card--accent">
        <span className="eyebrow">Pacotes em uso</span>
        <p className="stat-value">{data.walletSnapshot.activeMemberships}</p>
        <p className="metric-note">
          {data.walletSnapshot.sessionsRemaining}{" "}
          {data.walletSnapshot.sessionsRemaining === 1
            ? "sessão ainda ativa."
            : "sessões ainda ativas."}
        </p>
      </article>
      <article className="card metric-card metric-card--success">
        <span className="eyebrow">Recompensas prontas</span>
        <p className="stat-value">
          {data.walletSnapshot.availableReferralRewards}
        </p>
        <p className="metric-note">
          {data.walletSnapshot.redeemedReferralRewards} já entregues.
        </p>
      </article>
    </section>
  );
}

function BenefitsWalletSection({ data }: { data: BenefitsOverviewData }) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Carteira do cliente agora</h2>
          <p className="muted">
            Quem está com benefício ativo e merece ação rápida da equipe.
          </p>
        </div>
        <div
          className="simple-row__actions"
          style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
        >
          <Link href={MANAGEMENT_ROUTES.clients} className="secondary-button">
            Abrir CRM
          </Link>
          <Link href="/dashboard/subscriptions" className="secondary-button">
            Abrir pacotes
          </Link>
        </div>
      </div>

      {data.walletHighlights.length ? (
        <div className="simple-list">
          {data.walletHighlights.map((customer) => (
            <article key={customer.customerId} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                {customer.tierLabel ? (
                  <span className="badge badge--soft">{customer.tierLabel}</span>
                ) : null}
                {customer.availableReferralRewards > 0 ? (
                  <span className="badge badge--confirmed">
                    {customer.availableReferralRewards} recompensa
                    {customer.availableReferralRewards === 1 ? "" : "s"} pronta
                    {customer.availableReferralRewards === 1 ? "" : "s"}
                  </span>
                ) : null}
                {customer.activeMembershipTitle ? (
                  <span className="badge badge--soft">Pacote ativo</span>
                ) : null}
              </div>
              <h3>{customer.name}</h3>
              <p className="muted">
                {customer.pointsBalance} pts •{" "}
                {formatCurrency(Number(customer.cashbackBalance))} cashback •{" "}
                {customer.completedVisits} visita
                {customer.completedVisits === 1 ? "" : "s"}
              </p>
              <small className="list-meta">
                {customer.activeMembershipTitle
                  ? `${customer.activeMembershipTitle} • ${customer.membershipSessionsRemaining} ${customer.membershipSessionsRemaining === 1 ? "sessão restante" : "sessões restantes"}${customer.activeMembershipExpiresAt ? ` até ${formatDate(customer.activeMembershipExpiresAt)}` : ""}`
                  : "Sem pacote ativo agora."}
                {customer.referralCode ? ` • Código ${customer.referralCode}` : ""}
              </small>
              <div className="simple-row__actions">
                <Link
                  href={`${MANAGEMENT_ROUTES.clients}?clientId=${customer.customerId}`}
                  className="secondary-button"
                >
                  Abrir cliente
                </Link>
                {customer.availableReferralRewards > 0 ? (
                  <Link
                    href="/dashboard/benefits/referrals"
                    className="secondary-button"
                  >
                    Ver recompensa
                  </Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Carteira vazia"
          title="Nenhum benefício ativo na base agora"
          description="Quando surgirem pontos, pacotes ou recompensas, a carteira aparece aqui."
        />
      )}
    </section>
  );
}

function BenefitsExpiringMembershipsSection({
  data,
}: {
  data: BenefitsOverviewData;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Pacotes perto do fim</h2>
          <p className="muted">
            Clientes com pacote ativo vencendo nos próximos 7 dias.
          </p>
        </div>
        <span
          className={
            data.expiringMemberships.length
              ? "badge badge--pending"
              : "badge badge--soft"
          }
        >
          {data.walletSnapshot.expiringMemberships} no radar
        </span>
      </div>

      {data.expiringMemberships.length ? (
        <div className="simple-list">
          {data.expiringMemberships.map((membership) => (
            <article key={membership.membershipId} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span className="badge badge--pending">
                  até {formatDate(membership.expiresAt)}
                </span>
              </div>
              <h3>{membership.customerName}</h3>
              <p className="muted">
                {membership.title} • {membership.sessionsRemaining}{" "}
                {membership.sessionsRemaining === 1
                  ? "sessão restante"
                  : "sessões restantes"}
              </p>
              <div className="simple-row__actions">
                <Link
                  href={`${MANAGEMENT_ROUTES.clients}?clientId=${membership.customerId}`}
                  className="secondary-button"
                >
                  Renovar pelo CRM
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem urgência"
          title="Nenhum pacote vencendo agora"
          description="Quando alguma cliente entrar na janela de renovação, aparece aqui."
        />
      )}
    </section>
  );
}

function BenefitsRewardUnlocksSection({ data }: { data: BenefitsOverviewData }) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Recompensas prontas para entrega</h2>
          <p className="muted">
            O que o cliente já liberou por indicação e a equipe precisa baixar.
          </p>
        </div>
        <div className="inline-actions" style={{ flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {data.availableReferralRewardUnlocksCount} disponíveis
          </span>
          <span className="badge badge--soft">
            {data.redeemedReferralRewardUnlocksCount} entregues
          </span>
        </div>
      </div>

      {data.rewardUnlocks.length ? (
        <div className="simple-list">
          {data.rewardUnlocks.map((rewardUnlock) => (
            <article key={rewardUnlock.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span className="badge badge--confirmed">
                  {rewardUnlock.thresholdReached}/
                  {rewardUnlock.requiredQualifiedReferrals}
                </span>
                <span className="badge badge--soft">
                  {formatDate(rewardUnlock.unlockedAt)}
                </span>
              </div>
              <h3>{rewardUnlock.customerName}</h3>
              <p className="muted">{rewardUnlock.rewardDescription}</p>
              {rewardUnlock.rewardServiceName ? (
                <small className="list-meta">
                  Serviço vinculado: {rewardUnlock.rewardServiceName}
                </small>
              ) : null}
              <div className="simple-row__actions">
                <Link
                  href={`${MANAGEMENT_ROUTES.clients}?clientId=${rewardUnlock.customerId}`}
                  className="secondary-button"
                >
                  Abrir cliente
                </Link>
                <form action={markReferralRewardRedeemedAction}>
                  <input type="hidden" name="unlockId" value={rewardUnlock.id} />
                  <input
                    type="hidden"
                    name="returnPath"
                    value="/dashboard/benefits"
                  />
                  <button type="submit" className="primary-button">
                    Marcar entregue
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem resgate"
          title="Nenhuma recompensa pronta agora"
          description="Quando uma indicação bater a meta, a recompensa aparece aqui."
        />
      )}
    </section>
  );
}

function BenefitsBirthdaysSection({
  birthdayList,
  birthdaysThisMonth,
}: {
  birthdayList: BenefitsOverviewData["birthdayCustomers"];
  birthdaysThisMonth: number;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Aniversários do mês</h2>
          <p className="muted">
            Envie um aviso rápido para quem faz aniversário.
          </p>
        </div>
        <span className="badge badge--soft">{birthdaysThisMonth} no mês</span>
      </div>

      {birthdayList.length ? (
        <div className="simple-list">
          {birthdayList.map((customer) => (
            <article key={customer.customer_id} className="simple-row">
              <div className="inline-actions" style={{ marginBottom: 6 }}>
                <span className="badge badge--soft">
                  Dia {String(customer.birth_day).padStart(2, "0")}
                </span>
              </div>
              <h3>{customer.name}</h3>
              <p className="muted">
                {customer.phone ?? "Sem telefone"} • ID {customer.customer_id}
              </p>
              <div className="simple-row__actions">
                <form action={sendMarketingCustomerCampaignAction}>
                  <input
                    type="hidden"
                    name="campaignType"
                    value="birthday_campaign"
                  />
                  <input
                    type="hidden"
                    name="customerId"
                    value={customer.customer_id}
                  />
                  <input
                    type="hidden"
                    name="customerName"
                    value={customer.name}
                  />
                  <input
                    type="hidden"
                    name="returnPath"
                    value="/dashboard/benefits"
                  />
                  <button type="submit" className="secondary-button">
                    Enviar no app
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem aniversários"
          title="Nenhuma campanha de aniversário agora"
          description="Quando entrar alguém com aniversário no mês, aparece aqui."
        />
      )}
    </section>
  );
}

function BenefitsInactiveCustomersSection({
  inactiveList,
  inactiveThresholdDays,
  inactiveTotal,
}: {
  inactiveList: BenefitsOverviewData["inactiveCustomers"];
  inactiveThresholdDays: number;
  inactiveTotal: number;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Clientes inativas</h2>
          <p className="muted">Sem agenda futura há {inactiveThresholdDays} dias.</p>
        </div>
        <span
          className={
            inactiveTotal > 0 ? "badge badge--cancelled" : "badge badge--soft"
          }
        >
          {inactiveTotal} em foco
        </span>
      </div>

      {inactiveList.length ? (
        <div className="simple-list">
          {inactiveList.map((customer) => (
            <article key={customer.customer_id} className="simple-row">
              <div className="inline-actions" style={{ marginBottom: 6 }}>
                <span className="badge badge--soft">
                  {customer.inactive_days} dias
                </span>
              </div>
              <h3>{customer.name}</h3>
              <p className="muted">
                Última visita em {formatDate(customer.last_visit_at)}
                {customer.last_service_name ? ` • ${customer.last_service_name}` : ""}
              </p>
              <div className="simple-row__actions">
                <form action={sendMarketingCustomerCampaignAction}>
                  <input
                    type="hidden"
                    name="campaignType"
                    value="manual_reactivation"
                  />
                  <input
                    type="hidden"
                    name="customerId"
                    value={customer.customer_id}
                  />
                  <input
                    type="hidden"
                    name="customerName"
                    value={customer.name}
                  />
                  <input
                    type="hidden"
                    name="serviceName"
                    value={customer.last_service_name ?? ""}
                  />
                  <input
                    type="hidden"
                    name="inactiveDays"
                    value={String(customer.inactive_days)}
                  />
                  <input
                    type="hidden"
                    name="returnPath"
                    value="/dashboard/benefits"
                  />
                  <button type="submit" className="secondary-button">
                    Reativar no app
                  </button>
                </form>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Base aquecida"
          title="Nenhuma cliente em recuperação"
          description="Quando alguém passar do corte de inatividade, aparece aqui."
        />
      )}
    </section>
  );
}

function BenefitsIdeasSection({
  marketingIdeas,
}: {
  marketingIdeas: BenefitsOverviewData["marketingIdeas"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Oportunidades do momento</h2>
          <p className="muted">Sugestões rápidas baseadas nos dados.</p>
        </div>
      </div>

      {marketingIdeas.length ? (
        <div className="simple-list">
          {marketingIdeas.map((idea) => (
            <article key={idea.id} className="simple-row">
              <span className="badge badge--soft" style={{ marginBottom: 6 }}>
                {idea.label}
              </span>
              <h3>{idea.title}</h3>
              <p className="muted">{idea.note}</p>
              <div className="simple-row__actions">
                <Link href={idea.href} className="primary-button">
                  Abrir
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem alertas"
          title="Nenhuma oportunidade pendente"
          description="Quando surgir algo relevante, aparece aqui."
        />
      )}
    </section>
  );
}
