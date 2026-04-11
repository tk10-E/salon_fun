import Link from "next/link";

import {
  createSalonOfferAction,
  deleteSalonOfferAction,
  updateSalonOfferAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatDate } from "@/lib/formatters";

import { getOfferLifecycle, type PromotionsPageData } from "./_lib";

type PromotionsPageContentProps = {
  data: PromotionsPageData;
  offerKind: string;
  offerQ: string;
  offerState: string;
};

export function PromotionsPageContent({
  data,
  offerKind,
  offerQ,
  offerState,
}: PromotionsPageContentProps) {
  const scheduledCount = data.offers.filter(
    (offer) => getOfferLifecycle(offer, data.today) === "scheduled",
  ).length;

  return (
    <>
      <PromotionsHeader
        activeMembershipsCount={data.activeMembershipsCount}
        activeOffersCount={data.activeOffersCount}
        scheduledCount={scheduledCount}
      />
      <NewPromotionSection serviceOptions={data.serviceOptions} />
      <PromotionsListSection
        data={data}
        offerKind={offerKind}
        offerQ={offerQ}
        offerState={offerState}
      />
    </>
  );
}

function PromotionsHeader({
  activeMembershipsCount,
  activeOffersCount,
  scheduledCount,
}: {
  activeMembershipsCount: number;
  activeOffersCount: number;
  scheduledCount: number;
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Campanhas · Promoções</p>
        <h1>Promoções para o app do salão</h1>
        <p className="muted">
          Cadastre ou edite título, valor e vigência sem telas pesadas.
        </p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {activeOffersCount} ofertas ativas
          </span>
          <span className="badge badge--soft">
            {activeMembershipsCount} planos/clubes
          </span>
          <span className="badge badge--soft">{scheduledCount} agendadas</span>
        </div>
      </div>
      <div
        className="simple-row__actions"
        style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
      >
        <Link href="/dashboard/benefits" className="secondary-button">
          Voltar para campanhas
        </Link>
      </div>
    </header>
  );
}

function NewPromotionSection({
  serviceOptions,
}: {
  serviceOptions: PromotionsPageData["serviceOptions"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Nova oferta</h2>
          <p className="muted">Título, valor, vigência e status em um passo.</p>
        </div>
      </div>

      <form action={createSalonOfferAction} className="simple-form">
        <div className="split-grid">
          <div className="field">
            <label htmlFor="offer-kind">Tipo</label>
            <select id="offer-kind" name="kind" defaultValue="promotion">
              <option value="promotion">Promoção</option>
              <option value="membership">Clube / pacote</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="offer-order">Ordem</label>
            <input
              id="offer-order"
              name="sortOrder"
              type="number"
              min="0"
              step="1"
              defaultValue="0"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="offer-price">Valor divulgado</label>
            <input
              id="offer-price"
              name="price"
              type="number"
              min="0"
              step="0.01"
              placeholder="79.90"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="offer-title">Título</label>
          <input
            id="offer-title"
            name="title"
            placeholder="Ex.: Pacote corte + barba"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="offer-highlight">Chamada principal</label>
          <input
            id="offer-highlight"
            name="highlightText"
            placeholder="Ex.: 2 atendimentos no mês com valor fixo"
          />
        </div>

        <div className="field">
          <label htmlFor="offer-description">Descrição (opcional)</label>
          <textarea
            id="offer-description"
            name="description"
            rows={3}
            placeholder="Resumo rápido do que entra na campanha."
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="offer-start">Início</label>
            <input id="offer-start" name="startsOn" type="date" />
          </div>
          <div className="field">
            <label htmlFor="offer-end">Fim</label>
            <input id="offer-end" name="endsOn" type="date" />
          </div>
          <div className="field">
            <label className="checkbox-field" style={{ marginTop: 28 }}>
              <input type="checkbox" name="isActive" defaultChecked />
              Publicar no app
            </label>
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="offer-membership-service">Serviço (opcional)</label>
            <select
              id="offer-membership-service"
              name="membershipServiceId"
              defaultValue=""
            >
              <option value="">Sem vínculo</option>
              {serviceOptions.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.category
                    ? `${service.category} • ${service.name}`
                    : service.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="offer-membership-sessions">Sessões incluídas</label>
            <input
              id="offer-membership-sessions"
              name="membershipSessionsIncluded"
              type="number"
              min="1"
              step="1"
              placeholder="4"
            />
          </div>
          <div className="field">
            <label htmlFor="offer-membership-validity">Validade (dias)</label>
            <input
              id="offer-membership-validity"
              name="membershipValidityDays"
              type="number"
              min="1"
              step="1"
              placeholder="30"
            />
          </div>
        </div>

        <button type="submit" className="primary-button">
          Publicar oferta
        </button>
      </form>
    </section>
  );
}

function PromotionsListSection({
  data,
  offerKind,
  offerQ,
  offerState,
}: PromotionsPageContentProps) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Ofertas cadastradas</h2>
          <p className="muted">Edite direto na lista.</p>
        </div>
      </div>

      <form method="get" className="simple-filter">
        <div className="field">
          <label htmlFor="offer-search">Buscar</label>
          <input
            id="offer-search"
            name="offerQ"
            placeholder="Título ou texto"
            defaultValue={offerQ}
          />
        </div>
        <div className="field">
          <label htmlFor="offer-kind-filter">Tipo</label>
          <select
            id="offer-kind-filter"
            name="offerKind"
            defaultValue={offerKind}
          >
            <option value="">Todos</option>
            <option value="promotion">Promoção</option>
            <option value="membership">Clube / pacote</option>
          </select>
        </div>
        <div className="field">
          <label htmlFor="offer-state-filter">Situação</label>
          <select
            id="offer-state-filter"
            name="offerState"
            defaultValue={offerState}
          >
            <option value="">Todas</option>
            <option value="active">Ativas</option>
            <option value="scheduled">Agendadas</option>
            <option value="expired">Expiradas</option>
            <option value="paused">Pausadas</option>
          </select>
        </div>
        <button type="submit" className="secondary-button">
          Filtrar
        </button>
        {data.hasOfferFilters ? (
          <Link href="/dashboard/benefits/promotions" className="secondary-button">
            Limpar
          </Link>
        ) : null}
      </form>

      {data.offers.length === 0 ? (
        <EmptyStateCard
          eyebrow={data.hasOfferFilters ? "Nenhum resultado" : "Sem ofertas"}
          title={
            data.hasOfferFilters
              ? "Nenhuma oferta com esse filtro"
              : "Crie a primeira oferta para aparecer no app"
          }
          description="Use o formulário acima para publicar rapidamente."
        />
      ) : (
        <div className="simple-list">
          {data.offers.map((offer) => {
            const lifecycle = getOfferLifecycle(offer, data.today);

            return (
              <article key={offer.id} className="simple-row">
                <div
                  className="inline-actions"
                  style={{ marginBottom: 8, flexWrap: "wrap" }}
                >
                  <span className="badge badge--soft">
                    {offer.kind === "membership"
                      ? "Clube / pacote"
                      : "Promoção"}
                  </span>
                  <span className="badge badge--soft">{lifecycle}</span>
                  <span className="badge badge--soft">
                    {offer.starts_on
                      ? `Início ${formatDate(offer.starts_on)}`
                      : "Sem início"}{" "}
                    /{" "}
                    {offer.ends_on
                      ? `Fim ${formatDate(offer.ends_on)}`
                      : "Sem fim"}
                  </span>
                </div>

                <form action={updateSalonOfferAction} className="simple-form">
                  <input type="hidden" name="offerId" value={offer.id} />

                  <div className="split-grid">
                    <div className="field">
                      <label htmlFor={`offer-title-${offer.id}`}>Título</label>
                      <input
                        id={`offer-title-${offer.id}`}
                        name="title"
                        defaultValue={offer.title}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`offer-sort-${offer.id}`}>Ordem</label>
                      <input
                        id={`offer-sort-${offer.id}`}
                        name="sortOrder"
                        type="number"
                        min="0"
                        step="1"
                        defaultValue={offer.sort_order}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`offer-price-${offer.id}`}>Valor</label>
                      <input
                        id={`offer-price-${offer.id}`}
                        name="price"
                        type="number"
                        min="0"
                        step="0.01"
                        defaultValue={
                          offer.price == null ? "" : Number(offer.price)
                        }
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor={`offer-highlight-${offer.id}`}>Chamada</label>
                    <input
                      id={`offer-highlight-${offer.id}`}
                      name="highlightText"
                      defaultValue={offer.highlight_text ?? ""}
                    />
                  </div>

                  <div className="field">
                    <label htmlFor={`offer-description-${offer.id}`}>
                      Descrição
                    </label>
                    <textarea
                      id={`offer-description-${offer.id}`}
                      name="description"
                      rows={2}
                      defaultValue={offer.description ?? ""}
                    />
                  </div>

                  <div className="split-grid">
                    <div className="field">
                      <label htmlFor={`offer-start-${offer.id}`}>Início</label>
                      <input
                        id={`offer-start-${offer.id}`}
                        name="startsOn"
                        type="date"
                        defaultValue={offer.starts_on ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`offer-end-${offer.id}`}>Fim</label>
                      <input
                        id={`offer-end-${offer.id}`}
                        name="endsOn"
                        type="date"
                        defaultValue={offer.ends_on ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label className="checkbox-field" style={{ marginTop: 28 }}>
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={offer.is_active}
                          id={`offer-active-${offer.id}`}
                        />
                        Publicar no app
                      </label>
                    </div>
                  </div>

                  <div className="split-grid">
                    <div className="field">
                      <label htmlFor={`offer-service-${offer.id}`}>
                        Serviço (opcional)
                      </label>
                      <select
                        id={`offer-service-${offer.id}`}
                        name="membershipServiceId"
                        defaultValue={offer.membership_service_id ?? ""}
                      >
                        <option value="">Sem vínculo</option>
                        {data.serviceOptions.map((service) => (
                          <option key={service.id} value={service.id}>
                            {service.category
                              ? `${service.category} • ${service.name}`
                              : service.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label htmlFor={`offer-sessions-${offer.id}`}>Sessões</label>
                      <input
                        id={`offer-sessions-${offer.id}`}
                        name="membershipSessionsIncluded"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={offer.membership_sessions_included ?? ""}
                      />
                    </div>
                    <div className="field">
                      <label htmlFor={`offer-validity-${offer.id}`}>
                        Validade (dias)
                      </label>
                      <input
                        id={`offer-validity-${offer.id}`}
                        name="membershipValidityDays"
                        type="number"
                        min="1"
                        step="1"
                        defaultValue={offer.membership_validity_days ?? ""}
                      />
                    </div>
                  </div>

                  <div className="simple-row__actions">
                    <button type="submit" className="primary-button">
                      Salvar
                    </button>
                  </div>
                </form>

                <form
                  action={deleteSalonOfferAction}
                  className="simple-row__actions"
                  style={{ marginTop: 8 }}
                >
                  <input type="hidden" name="offerId" value={offer.id} />
                  <button type="submit" className="danger-button">
                    Remover
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
