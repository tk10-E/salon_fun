import {
  markReferralRewardRedeemedAction,
  saveSalonReferralProgramAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatDate } from "@/lib/formatters";

import type { ReferralsPageData } from "./_lib";

type ReferralsPageContentProps = {
  data: ReferralsPageData;
};

function requiredQualified(
  referralProgram?: { required_qualified_referrals?: number | null } | null,
) {
  return referralProgram?.required_qualified_referrals ?? 10;
}

export function ReferralsPageContent({ data }: ReferralsPageContentProps) {
  const latestQualified = data.referralEvents.find(
    (event) => event.status === "qualified",
  );

  return (
    <>
      <ReferralsHeader
        isActive={Boolean(data.referralProgram?.is_active)}
        pendingCountInPeriod={data.pendingCountInPeriod}
        periodQualifiedCount={data.periodQualifiedCount}
      />
      <ReferralsActivitySections
        data={data}
        latestQualified={latestQualified}
      />
      <ReferralProgramSection
        referralProgram={data.referralProgram}
        serviceOptions={data.serviceOptions}
      />
    </>
  );
}

function ReferralsActivitySections({
  data,
  latestQualified = data.referralEvents.find(
    (event) => event.status === "qualified",
  ),
}: {
  data: ReferralsPageData;
  latestQualified?: ReferralsPageData["referralEvents"][number] | undefined;
}) {
  return (
    <>
      <ReferralEntriesSection referralEvents={data.referralEvents} />
      <ReferralRewardUnlocksSection
        availableRewardUnlocksCount={data.availableRewardUnlocksCount}
        rewardUnlocks={data.rewardUnlocks}
        rewardUnlocksCount={data.rewardUnlocksCount}
      />
      <LatestQualifiedReferralSection latestQualified={latestQualified} />
    </>
  );
}

function ReferralsHeader({
  isActive,
  pendingCountInPeriod,
  periodQualifiedCount,
}: {
  isActive: boolean;
  pendingCountInPeriod: number;
  periodQualifiedCount: number;
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Campanhas · Indicações</p>
        <h1>Programa de indicações do salão</h1>
        <p className="muted">Regra clara e lista de entradas em uma tela só.</p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className={isActive ? "badge badge--confirmed" : "badge badge--soft"}>
            {isActive ? "Indicação ativa" : "Indicação pausada"}
          </span>
          <span className="badge badge--soft">{pendingCountInPeriod} pendentes</span>
          <span className="badge badge--soft">{periodQualifiedCount} validadas</span>
        </div>
      </div>
    </header>
  );
}

function ReferralEntriesSection({
  referralEvents,
}: {
  referralEvents: ReferralsPageData["referralEvents"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Entradas recentes</h2>
          <p className="muted">Até 10 registros mais novos.</p>
        </div>
      </div>

      {referralEvents.length ? (
        <div className="simple-list">
          {referralEvents.slice(0, 10).map((event) => (
            <article key={event.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span
                  className={
                    event.status === "qualified"
                      ? "badge badge--confirmed"
                      : "badge badge--pending"
                  }
                >
                  {event.status === "qualified" ? "Validada" : "Pendente"}
                </span>
                <span className="badge badge--soft">
                  {formatDate(event.created_at)}
                </span>
              </div>
              <h3>{event.invited_name}</h3>
              <p className="muted">
                Indicado por {event.referrer_name} • Código {event.used_referral_code}
              </p>
              {event.qualified_at ? (
                <small className="list-meta">
                  Validado em {formatDate(event.qualified_at)}
                </small>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem indicações"
          title="Nenhuma entrada no período"
          description="Quando entrar uma indicação, ela aparece aqui."
        />
      )}
    </section>
  );
}

function ReferralRewardUnlocksSection({
  availableRewardUnlocksCount,
  rewardUnlocks,
  rewardUnlocksCount,
}: {
  availableRewardUnlocksCount: number;
  rewardUnlocks: ReferralsPageData["rewardUnlocks"];
  rewardUnlocksCount: number;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Recompensas liberadas</h2>
          <p className="muted">
            O que já virou benefício real e pode ser baixado pela equipe.
          </p>
        </div>
        <div className="inline-actions" style={{ flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {availableRewardUnlocksCount} disponíveis
          </span>
          <span className="badge badge--soft">
            {rewardUnlocksCount - availableRewardUnlocksCount} entregues
          </span>
        </div>
      </div>

      {rewardUnlocks.length ? (
        <div className="simple-list">
          {rewardUnlocks.map((unlock) => (
            <article key={unlock.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span
                  className={
                    unlock.status === "available"
                      ? "badge badge--confirmed"
                      : "badge badge--soft"
                  }
                >
                  {unlock.status === "available" ? "Disponível" : "Entregue"}
                </span>
                <span className="badge badge--soft">
                  {unlock.thresholdReached}/{unlock.requiredQualifiedReferrals}
                </span>
              </div>
              <h3>{unlock.customerName}</h3>
              <p className="muted">{unlock.rewardDescription}</p>
              <small className="list-meta">
                Liberada em {formatDate(unlock.unlockedAt)}
                {unlock.rewardServiceName ? ` • ${unlock.rewardServiceName}` : ""}
                {unlock.redeemedAt
                  ? ` • entregue em ${formatDate(unlock.redeemedAt)}`
                  : ""}
              </small>
              {unlock.status === "available" ? (
                <div className="simple-row__actions">
                  <form action={markReferralRewardRedeemedAction}>
                    <input type="hidden" name="unlockId" value={unlock.id} />
                    <input
                      type="hidden"
                      name="returnPath"
                      value="/dashboard/benefits/referrals"
                    />
                    <button type="submit" className="primary-button">
                      Marcar como entregue
                    </button>
                  </form>
                </div>
              ) : null}
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem recompensa"
          title="Nenhuma recompensa foi liberada ainda"
          description="Quando uma cliente bater a meta de indicações, ela aparece aqui."
        />
      )}
    </section>
  );
}

function ReferralProgramSection({
  referralProgram,
  serviceOptions,
}: {
  referralProgram: ReferralsPageData["referralProgram"];
  serviceOptions: ReferralsPageData["serviceOptions"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Regra do programa</h2>
          <p className="muted">
            Texto curto e recompensa definidas em um formulário.
          </p>
        </div>
      </div>

      <form action={saveSalonReferralProgramAction} className="simple-form">
        <div className="field">
          <label htmlFor="referral-title">Título</label>
          <input
            id="referral-title"
            name="title"
            defaultValue={referralProgram?.title ?? "Indique e ganhe"}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="referral-description">Descrição</label>
          <textarea
            id="referral-description"
            name="description"
            rows={3}
            defaultValue={referralProgram?.description ?? ""}
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="reward-for-referrer">
              Benefício para quem indicou
            </label>
            <input
              id="reward-for-referrer"
              name="rewardForReferrer"
              defaultValue={referralProgram?.reward_for_referrer ?? ""}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reward-for-invited">
              Benefício para quem entrou
            </label>
            <input
              id="reward-for-invited"
              name="rewardForInvited"
              defaultValue={referralProgram?.reward_for_invited ?? ""}
            />
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="required-qualified-referrals">
              Indicações para liberar
            </label>
            <input
              id="required-qualified-referrals"
              name="requiredQualifiedReferrals"
              type="number"
              min="1"
              max="100"
              step="1"
              defaultValue={requiredQualified(referralProgram)}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="reward-service-id">
              Serviço da recompensa (opcional)
            </label>
            <select
              id="reward-service-id"
              name="rewardServiceId"
              defaultValue={referralProgram?.reward_service_id ?? ""}
            >
              <option value="">Usar apenas texto livre</option>
              {serviceOptions.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.category
                    ? `${service.category} • ${service.name}`
                    : service.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="checkbox-field">
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={referralProgram?.is_active ?? false}
          />
          Ativar programa no app do cliente
        </label>

        <button type="submit" className="primary-button">
          Salvar programa
        </button>
      </form>
    </section>
  );
}

function LatestQualifiedReferralSection({
  latestQualified,
}: {
  latestQualified: ReferralsPageData["referralEvents"][number] | undefined;
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Última validação</h2>
          <p className="muted">Quem já trouxe alguém com sucesso.</p>
        </div>
      </div>

      {latestQualified ? (
        <div className="simple-list">
          <article className="simple-row">
            <h3>{latestQualified.invited_name}</h3>
            <p className="muted">
              Indicada por {latestQualified.referrer_name} • Código{" "}
              {latestQualified.used_referral_code}
            </p>
            <small className="list-meta">
              Validado em{" "}
              {formatDate(
                latestQualified.qualified_at ?? latestQualified.created_at,
              )}
            </small>
          </article>
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem validação"
          title="Ainda não houve indicação validada"
          description="Quando a primeira visita for concluída, aparece aqui."
        />
      )}
    </section>
  );
}
