import Link from "next/link";

import {
  createSalonOfferAction,
  deleteSalonOfferAction,
  saveSalonGrowthAutomationAction,
  saveSalonLoyaltyProgramAction,
  saveSalonReferralProgramAction,
  updateSalonOfferAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";

import type {
  BenefitsOverviewData,
  GrowthAutomationPageData,
  LoyaltyPageData,
  PromotionsPageData,
  ReferralsPageData,
} from "./_lib";
import {
  badgeClassForLifecycle,
  formatLifecycleLabel,
  formatOfferKind,
  formatOfferPeriod,
  formatPercent,
  getOfferLifecycle,
  lifecycleHint,
} from "./_lib";

const commercialRoutes = [
  { href: "/dashboard/benefits", label: "Visão geral" },
  { href: "/dashboard/benefits/promotions", label: "Promoções" },
  { href: "/dashboard/benefits/loyalty", label: "Fidelidade" },
  { href: "/dashboard/benefits/referrals", label: "Indicações" },
  { href: "/dashboard/benefits/automations", label: "Automações" },
];

type CommercialPageIntroProps = {
  currentPath: string;
  description: string;
  message?: string;
  title: string;
  tone?: string;
};

export function CommercialPageIntro({ currentPath, description, message, title, tone }: CommercialPageIntroProps) {
  return (
    <>
      {message ? <FlashMessage message={message} tone={tone} /> : null}

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <span className="eyebrow">Painel comercial</span>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
          </div>
        </div>

        <nav className="commercial-nav" style={{ marginTop: 18 }}>
          {commercialRoutes.map((route) => {
            const isActive = route.href === currentPath;

            return (
              <Link
                key={route.href}
                href={route.href}
                className={isActive ? "commercial-nav__link commercial-nav__link--active" : "commercial-nav__link"}
              >
                {route.label}
              </Link>
            );
          })}
        </nav>
      </section>
    </>
  );
}

export function CommercialOverviewPanel({ data }: { data: BenefitsOverviewData }) {
  const automationActive = data.growthAutomationSettings.is_active || data.growthAutomationSettings.smart_rebook_is_active;

  return (
    <>
      <section className="stats-grid">
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Ofertas ativas</span>
          <p className="stat-value">{data.activeOffersCount}</p>
          <p className="metric-note">Campanhas comerciais disponíveis agora no app do cliente.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Clientes VIP</span>
          <p className="stat-value">{data.loyaltyOverview.vip_customers ?? 0}</p>
          <p className="metric-note">Clientes que já atingiram o nível mais alto do programa.</p>
        </article>
        <article className="card metric-card metric-card--accent">
          <span className="eyebrow">Clientes em risco</span>
          <p className="stat-value">{data.growthAutomationOverview.at_risk_customers ?? 0}</p>
          <p className="metric-note">Sem próxima agenda e já entrando na zona de esfriamento.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Indicações validadas</span>
          <p className="stat-value">{data.qualifiedReferralsCount}</p>
          <p className="metric-note">Clientes que vieram por indicação e já concluíram a primeira visita.</p>
        </article>
      </section>

      <section className="commercial-overview-grid">
        <article className="card content-card commercial-overview-card">
          <div className="inline-actions">
            <span className="badge badge--pending">{data.activeOffersCount} ativas</span>
            <span className="badge badge--soft">{data.activeMembershipsCount} planos mensais</span>
          </div>
          <h3>Promoções e planos</h3>
          <p className="muted">
            Catálogo separado para publicar campanhas sazonais e planos recorrentes sem misturar com fidelidade ou indicação.
          </p>
          <small className="list-meta">Tudo o que estiver ativo aqui aparece no app do cliente com dados reais.</small>
          <Link href="/dashboard/benefits/promotions" className="secondary-button">
            Abrir promoções
          </Link>
        </article>

        <article className="card content-card commercial-overview-card">
          <div className="inline-actions">
            <span className={data.loyaltyProgram?.is_active ? "badge badge--confirmed" : "badge badge--soft"}>
              {data.loyaltyProgram?.is_active ? "Programa ativo" : "Programa pausado"}
            </span>
            <span className="badge badge--pending">{data.loyaltyOverview.ranked_customers ?? 0} no ranking</span>
          </div>
          <h3>Fidelidade e ranking</h3>
          <p className="muted">
            Pontos por visita, cashback, desconto progressivo e nível VIP com leitura clara para o dono do salão.
          </p>
          <small className="list-meta">
            {data.loyaltyProgram
              ? `${data.loyaltyProgram.points_per_visit} pontos por visita e ${formatPercent(data.loyaltyProgram.cashback_percent)} de cashback.`
              : "Configure o programa para começar a ranquear clientes."}
          </small>
          <Link href="/dashboard/benefits/loyalty" className="secondary-button">
            Abrir fidelidade
          </Link>
        </article>

        <article className="card content-card commercial-overview-card">
          <div className="inline-actions">
            <span className={data.referralProgram?.is_active ? "badge badge--confirmed" : "badge badge--soft"}>
              {data.referralProgram?.is_active ? "Indicação ativa" : "Indicação pausada"}
            </span>
            <span className="badge badge--pending">{data.pendingReferralsCount} pendentes</span>
          </div>
          <h3>Indicações</h3>
          <p className="muted">
            Regra de indicação em uma tela própria, com relatório de entradas, pendências e validações concluídas.
          </p>
          <small className="list-meta">
            {data.referralProgram?.title ?? "Ative um programa para gerar aquisição orgânica dentro do app."}
          </small>
          <Link href="/dashboard/benefits/referrals" className="secondary-button">
            Abrir indicações
          </Link>
        </article>

        <article className="card content-card commercial-overview-card">
          <div className="inline-actions">
            <span className={automationActive ? "badge badge--confirmed" : "badge badge--soft"}>
              {automationActive ? "Automação ligada" : "Automação pausada"}
            </span>
            <span className="badge badge--pending">{data.growthAutomationOverview.recovered_customers_last_30d ?? 0} recuperados</span>
          </div>
          <h3>Rebook e recuperação</h3>
          <p className="muted">
            Rebook inteligente por hábito e winback para clientes perdidos, separados da vitrine comercial e do ranking.
          </p>
          <small className="list-meta">
            Winback após {data.growthAutomationSettings.winback_inactive_days} dias e rebook até {data.growthAutomationSettings.smart_rebook_window_days} dias antes da janela ideal.
          </small>
          <Link href="/dashboard/benefits/automations" className="secondary-button">
            Abrir automações
          </Link>
        </article>
      </section>
    </>
  );
}

export function PromotionsOverviewSection({ data }: { data: PromotionsPageData }) {
  return (
    <>
      <section className="stats-grid">
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Ofertas ativas</span>
          <p className="stat-value">{data.activeOffersCount}</p>
          <p className="metric-note">Promoções e planos disponíveis hoje no app do cliente.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Planos mensais</span>
          <p className="stat-value">{data.activeMembershipsCount}</p>
          <p className="metric-note">Planos recorrentes ativos para gerar retorno previsível.</p>
        </article>
      </section>

      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Promoções e planos publicados</h2>
            <p className="muted">Tudo o que estiver ativo aqui passa a aparecer no app do cliente com dados reais.</p>
          </div>
        </div>

        <form method="get" className="services-toolbar" style={{ marginTop: 18 }}>
          <div className="services-toolbar__grid">
            <div className="field">
              <label htmlFor="offer-search">Buscar oferta</label>
              <input
                id="offer-search"
                name="offerQ"
                placeholder="Título, descrição ou chamada principal"
                defaultValue={data.offerQuery}
              />
            </div>

            <div className="field">
              <label htmlFor="offer-kind-filter">Tipo</label>
              <select id="offer-kind-filter" name="offerKind" defaultValue={data.offerKindFilter}>
                <option value="">Todos</option>
                <option value="promotion">Promoções</option>
                <option value="membership">Planos mensais</option>
              </select>
            </div>
          </div>

          <div className="services-toolbar__grid">
            <div className="field">
              <label htmlFor="offer-state-filter">Situação</label>
              <select id="offer-state-filter" name="offerState" defaultValue={data.offerStateFilter}>
                <option value="">Todas</option>
                <option value="active">Ativas</option>
                <option value="scheduled">Agendadas</option>
                <option value="expired">Expiradas</option>
                <option value="paused">Pausadas</option>
              </select>
            </div>

            <div className="field">
              <label>Resumo do filtro</label>
              <div className="list-meta" style={{ paddingTop: 16 }}>
                {data.offers.length} {data.offers.length === 1 ? "oferta encontrada" : "ofertas encontradas"}
              </div>
            </div>
          </div>

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar ofertas
            </button>
            {data.hasOfferFilters ? (
              <Link href="/dashboard/benefits/promotions" className="secondary-button services-toolbar__clear">
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </form>

        <div className="row-list" style={{ marginTop: 16 }}>
          {!data.offers.length ? (
            <EmptyStateCard
              eyebrow={data.hasOfferFilters ? "Nenhum resultado" : "Sem ofertas ainda"}
              title={data.hasOfferFilters ? "Nenhuma oferta encontrada nesse filtro" : "Nenhuma promoção ou plano mensal cadastrado"}
              description={
                data.hasOfferFilters
                  ? "Ajuste a busca, o tipo ou a situação para encontrar a campanha certa."
                  : "Crie a primeira oferta para publicar campanhas sazonais, combos ou planos recorrentes no app."
              }
            />
          ) : (
            Object.entries(data.groupedOffers).map(([sectionTitle, sectionOffers]) => (
              <section key={sectionTitle} className="service-category-section">
                <div className="service-category-header">
                  <div>
                    <span className="eyebrow">Catálogo comercial</span>
                    <h3>{sectionTitle}</h3>
                  </div>
                  <span className="list-meta">
                    {sectionOffers.length} {sectionOffers.length === 1 ? "item" : "itens"}
                  </span>
                </div>

                <div className="row-list">
                  {sectionOffers.map((offer) => {
                    const lifecycle = getOfferLifecycle(offer, data.today);

                    return (
                      <article key={offer.id} className="list-row service-editor-card">
                        <div className="service-editor-grid" style={{ gridTemplateColumns: "minmax(220px, 260px) minmax(0, 1fr)" }}>
                          <aside className="service-preview-panel">
                            <div className="service-preview-placeholder" style={{ minHeight: 160 }}>
                              <span className="eyebrow">{formatOfferKind(offer.kind)}</span>
                              <strong>{offer.title}</strong>
                              <span className="muted">
                                {offer.highlight_text?.trim() || "Use este destaque para vender o benefício principal da oferta."}
                              </span>
                            </div>

                            <div className="service-preview-meta">
                              <span className="list-meta">Ordem {offer.sort_order}</span>
                              <h3>{offer.title}</h3>
                              <small className="list-meta">{formatOfferPeriod(offer)}</small>
                              <small className="list-meta">
                                {offer.price != null ? `Valor divulgado: ${formatCurrency(Number(offer.price))}` : "Sem valor fixo"}
                              </small>
                              <span className={badgeClassForLifecycle(lifecycle)}>{formatLifecycleLabel(lifecycle)}</span>
                              <small className="list-meta">{lifecycleHint(offer, lifecycle, data.today)}</small>
                            </div>
                          </aside>

                          <div className="list-row__content">
                            <form action={updateSalonOfferAction} className="form-grid">
                              <input type="hidden" name="offerId" value={offer.id} />

                              <div className="split-grid">
                                <div className="field">
                                  <label htmlFor={`offer-kind-${offer.id}`}>Tipo</label>
                                  <select id={`offer-kind-${offer.id}`} name="kind" defaultValue={offer.kind}>
                                    <option value="promotion">Promoção</option>
                                    <option value="membership">Plano mensal</option>
                                  </select>
                                </div>

                                <div className="field">
                                  <label htmlFor={`offer-order-${offer.id}`}>Ordem de exibição</label>
                                  <input
                                    id={`offer-order-${offer.id}`}
                                    name="sortOrder"
                                    type="number"
                                    min="0"
                                    step="1"
                                    defaultValue={offer.sort_order}
                                    required
                                  />
                                </div>
                              </div>

                              <div className="field">
                                <label htmlFor={`offer-title-${offer.id}`}>Título</label>
                                <input id={`offer-title-${offer.id}`} name="title" defaultValue={offer.title} required />
                              </div>

                              <div className="field">
                                <label htmlFor={`offer-highlight-${offer.id}`}>Chamada principal</label>
                                <input
                                  id={`offer-highlight-${offer.id}`}
                                  name="highlightText"
                                  defaultValue={offer.highlight_text ?? ""}
                                  placeholder="Ex.: 2 cortes por mês com valor especial"
                                />
                              </div>

                              <div className="field">
                                <label htmlFor={`offer-description-${offer.id}`}>Descrição</label>
                                <textarea
                                  id={`offer-description-${offer.id}`}
                                  name="description"
                                  rows={4}
                                  defaultValue={offer.description ?? ""}
                                />
                              </div>

                              <div className="split-grid">
                                <div className="field">
                                  <label htmlFor={`offer-price-${offer.id}`}>Valor divulgado</label>
                                  <input
                                    id={`offer-price-${offer.id}`}
                                    name="price"
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={offer.price == null ? "" : Number(offer.price)}
                                    placeholder="79.90"
                                  />
                                </div>

                                <div className="field">
                                  <label htmlFor={`offer-active-${offer.id}`}>Status</label>
                                  <label className="checkbox-field" style={{ marginTop: 10 }}>
                                    <input id={`offer-active-${offer.id}`} type="checkbox" name="isActive" defaultChecked={offer.is_active} />
                                    Publicar essa oferta no app do cliente
                                  </label>
                                </div>
                              </div>

                              <div className="split-grid">
                                <div className="field">
                                  <label htmlFor={`offer-start-${offer.id}`}>Válida a partir de</label>
                                  <input id={`offer-start-${offer.id}`} name="startsOn" type="date" defaultValue={offer.starts_on ?? ""} />
                                </div>

                                <div className="field">
                                  <label htmlFor={`offer-end-${offer.id}`}>Válida até</label>
                                  <input id={`offer-end-${offer.id}`} name="endsOn" type="date" defaultValue={offer.ends_on ?? ""} />
                                </div>
                              </div>

                              <div className="inline-actions">
                                <button type="submit" className="secondary-button">
                                  Salvar oferta
                                </button>
                              </div>
                            </form>

                            <div className="service-editor-footer">
                              <form action={deleteSalonOfferAction}>
                                <input type="hidden" name="offerId" value={offer.id} />
                                <button type="submit" className="danger-button">
                                  Remover oferta
                                </button>
                              </form>
                            </div>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </section>
    </>
  );
}

export function NewOfferPanel() {
  return (
    <section className="card content-card form-panel">
      <div className="section-heading">
        <div>
          <h2>Nova promoção ou plano</h2>
          <p className="muted">Publique campanhas sazonais ou um plano mensal recorrente para aparecer no app do cliente.</p>
        </div>
      </div>

      <form action={createSalonOfferAction} className="form-grid" style={{ marginTop: 18 }}>
        <div className="split-grid">
          <div className="field">
            <label htmlFor="offer-kind">Tipo</label>
            <select id="offer-kind" name="kind" defaultValue="promotion">
              <option value="promotion">Promoção</option>
              <option value="membership">Plano mensal</option>
            </select>
          </div>

          <div className="field">
            <label htmlFor="offer-order">Ordem de exibição</label>
            <input id="offer-order" name="sortOrder" type="number" min="0" step="1" defaultValue="0" required />
          </div>
        </div>

        <div className="field">
          <label htmlFor="offer-title">Título</label>
          <input id="offer-title" name="title" placeholder="Ex.: Plano mensal de corte e barba" required />
        </div>

        <div className="field">
          <label htmlFor="offer-highlight">Chamada principal</label>
          <input id="offer-highlight" name="highlightText" placeholder="Ex.: 2 atendimentos por mês com valor fixo" />
        </div>

        <div className="field">
          <label htmlFor="offer-description">Descrição</label>
          <textarea
            id="offer-description"
            name="description"
            rows={4}
            placeholder="Explique o que entra na campanha, vigência e como o cliente usa esse benefício."
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="offer-price">Valor divulgado</label>
            <input id="offer-price" name="price" type="number" min="0" step="0.01" placeholder="79.90" />
          </div>

          <div className="field">
            <label>Status</label>
            <label className="checkbox-field" style={{ marginTop: 10 }}>
              <input type="checkbox" name="isActive" defaultChecked />
              Publicar no app assim que salvar
            </label>
          </div>
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="offer-start">Válida a partir de</label>
            <input id="offer-start" name="startsOn" type="date" />
          </div>

          <div className="field">
            <label htmlFor="offer-end">Válida até</label>
            <input id="offer-end" name="endsOn" type="date" />
          </div>
        </div>

        <button type="submit" className="primary-button">
          Publicar oferta
        </button>
      </form>
    </section>
  );
}

export function ReferralsOverviewSection({ data }: { data: ReferralsPageData }) {
  return (
    <>
      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Relatório de indicações</h2>
            <p className="muted">O crédito só valida quando a pessoa baixa o app, agenda e o salão conclui o atendimento.</p>
          </div>
        </div>

        <form method="get" className="services-toolbar" style={{ marginTop: 18 }}>
          <div className="services-toolbar__grid">
            <div className="field">
              <label htmlFor="referral-from">Entrada pelo app a partir de</label>
              <input id="referral-from" name="referralFrom" type="date" defaultValue={data.referralFrom} />
            </div>

            <div className="field">
              <label htmlFor="referral-to">Entrada pelo app até</label>
              <input id="referral-to" name="referralTo" type="date" defaultValue={data.referralTo} />
            </div>
          </div>

          <div className="services-toolbar__grid">
            <div className="field">
              <label htmlFor="referral-status-filter">Status na lista</label>
              <select id="referral-status-filter" name="referralStatus" defaultValue={data.referralStatusFilter}>
                <option value="">Todos</option>
                <option value="pending">Pendentes</option>
                <option value="qualified">Validadas</option>
              </select>
            </div>

            <div className="field">
              <label>Resumo do período</label>
              <div className="list-meta" style={{ paddingTop: 16 }}>
                {data.referralEvents.length} {data.referralEvents.length === 1 ? "registro encontrado" : "registros encontrados"}
              </div>
            </div>
          </div>

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar relatório
            </button>
            {data.hasReferralFilters ? (
              <Link href="/dashboard/benefits/referrals" className="secondary-button services-toolbar__clear">
                Limpar filtros
              </Link>
            ) : null}
          </div>
        </form>

        <div className="stats-grid" style={{ marginTop: 16 }}>
          <article className="card metric-card metric-card--soft">
            <span className="eyebrow">Entradas no período</span>
            <p className="stat-value">{data.referralEventsBaseCount}</p>
            <p className="metric-note">Pessoas que baixaram o app e entraram com indicação dentro do recorte.</p>
          </article>
          <article className="card metric-card metric-card--warm">
            <span className="eyebrow">Pendentes no período</span>
            <p className="stat-value">{data.pendingCountInPeriod}</p>
            <p className="metric-note">Já entraram no app, mas ainda dependem da visita concluída no salão.</p>
          </article>
          <article className="card metric-card metric-card--accent">
            <span className="eyebrow">Validadas no período</span>
            <p className="stat-value">{data.periodQualifiedCount}</p>
            <p className="metric-note">Concluídas e marcadas como atendidas dentro do recorte informado.</p>
          </article>
        </div>

        <div className="row-list" style={{ marginTop: 16 }}>
          {!data.referralEvents.length ? (
            <EmptyStateCard
              eyebrow={data.hasReferralFilters ? "Nenhum resultado" : "Sem indicações"}
              title={data.hasReferralFilters ? "Nenhuma indicação encontrada nesse período" : "Nenhuma indicação registrada ainda"}
              description={
                data.hasReferralFilters
                  ? "Ajuste as datas ou o status para localizar as indicações do recorte desejado."
                  : "Assim que clientes compartilharem o código no app e novos clientes concluírem o primeiro atendimento, tudo vai aparecer aqui."
              }
            />
          ) : (
            data.referralEvents.map((event) => (
              <article key={event.id} className="list-row referral-event-card">
                <div className="list-row__content">
                  <div className="inline-actions" style={{ marginBottom: 4 }}>
                    <span className="badge badge--soft">Indicação registrada</span>
                  </div>
                  <h3>{event.invited_name}</h3>
                  <p className="muted list-description">
                    Registro completo da indicação, com origem, código usado e data de validação.
                  </p>

                  <div className="referral-event-grid">
                    <div className="referral-event-item">
                      <span className="referral-event-item__label">Cliente que indicou</span>
                      <strong>{event.referrer_name}</strong>
                    </div>

                    <div className="referral-event-item">
                      <span className="referral-event-item__label">Cliente indicado</span>
                      <strong>{event.invited_name}</strong>
                    </div>

                    <div className="referral-event-item">
                      <span className="referral-event-item__label">Código usado</span>
                      <strong>{event.used_referral_code}</strong>
                    </div>

                    <div className="referral-event-item">
                      <span className="referral-event-item__label">Entrou pelo app em</span>
                      <strong>{formatDate(event.created_at)}</strong>
                    </div>

                    <div className="referral-event-item">
                      <span className="referral-event-item__label">Status</span>
                      <strong>{event.status === "qualified" ? "Validada" : "Pendente"}</strong>
                    </div>

                    <div className="referral-event-item">
                      <span className="referral-event-item__label">Data da validação</span>
                      <strong>{event.qualified_at ? formatDate(event.qualified_at) : "Ainda não validada"}</strong>
                    </div>
                  </div>
                </div>
                <div className="list-row__aside">
                  <span className={`badge ${event.status === "qualified" ? "badge--confirmed" : "badge--pending"}`}>
                    {event.status === "qualified" ? "validada" : "pendente"}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}

export function ReferralProgramPanel({ data }: { data: ReferralsPageData }) {
  return (
    <section className="card content-card form-panel">
      <div className="section-heading">
        <div>
          <h2>Programa de indicação</h2>
          <p className="muted">Esse programa aparece no app e só valida depois da visita concluída no salão.</p>
        </div>
      </div>

      {data.referralProgram ? (
        <div className="list-row" style={{ marginTop: 18 }}>
          <div className="list-row__content">
            <div className="inline-actions" style={{ marginBottom: 8 }}>
              <span className={data.referralProgram.is_active ? "badge badge--confirmed" : "badge badge--soft"}>
                {data.referralProgram.is_active ? "Ativo no app do cliente" : "Salvo, mas inativo"}
              </span>
            </div>
            <h3>{data.referralProgram.title}</h3>
            <p className="muted list-description">
              {data.referralProgram.description?.trim().length
                ? data.referralProgram.description
                : "O cliente verá esse programa na home do app com código próprio e acompanhamento das indicações."}
            </p>
            <small className="list-meta">Benefício para quem indica: {data.referralProgram.reward_for_referrer}</small>
            {data.referralProgram.reward_for_invited ? (
              <small className="list-meta">Benefício para quem entra: {data.referralProgram.reward_for_invited}</small>
            ) : null}
            <small className="list-meta">Última atualização em {formatDateTime(data.referralProgram.updated_at)}</small>
          </div>
        </div>
      ) : null}

      <form action={saveSalonReferralProgramAction} className="form-grid" style={{ marginTop: 18 }}>
        <div className="field">
          <label htmlFor="referral-title">Título</label>
          <input
            id="referral-title"
            name="title"
            defaultValue={data.referralProgram?.title ?? "Indique e ganhe"}
            placeholder="Ex.: Indique uma amiga e ganhe um bônus"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="referral-description">Descrição</label>
          <textarea
            id="referral-description"
            name="description"
            rows={4}
            defaultValue={data.referralProgram?.description ?? ""}
            placeholder="Explique a regra da indicação e o momento em que o benefício é liberado."
          />
        </div>

        <div className="field">
          <label htmlFor="reward-for-referrer">Benefício para quem indicou</label>
          <input
            id="reward-for-referrer"
            name="rewardForReferrer"
            defaultValue={data.referralProgram?.reward_for_referrer ?? ""}
            placeholder="Ex.: 15% de desconto no próximo atendimento"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="reward-for-invited">Benefício para quem entrou</label>
          <input
            id="reward-for-invited"
            name="rewardForInvited"
            defaultValue={data.referralProgram?.reward_for_invited ?? ""}
            placeholder="Ex.: avaliação com preço promocional na primeira visita"
          />
        </div>

        <label className="checkbox-field">
          <input type="checkbox" name="isActive" defaultChecked={data.referralProgram?.is_active ?? false} />
          Ativar indicação no app do cliente
        </label>

        <small className="muted">
          Quando ativo, cada cliente recebe um código próprio. A indicação só fica válida depois de baixar o app,
          vincular ao salão, agendar e ter o atendimento marcado como concluído no painel.
        </small>

        <button type="submit" className="primary-button">
          Salvar programa
        </button>
      </form>
    </section>
  );
}

export function LoyaltyOverviewSection({ data }: { data: LoyaltyPageData }) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Clube de fidelidade e ranking</h2>
          <p className="muted">Pontos por visita, cashback, desconto progressivo e nível VIP atualizados a cada atendimento concluído.</p>
        </div>
      </div>

      {data.loyaltyProgram ? (
        <>
          <div className="list-row" style={{ marginTop: 18 }}>
            <div className="list-row__content">
              <div className="inline-actions" style={{ marginBottom: 8 }}>
                <span className={data.loyaltyProgram.is_active ? "badge badge--confirmed" : "badge badge--soft"}>
                  {data.loyaltyProgram.is_active ? "Ativo no app do cliente" : "Salvo, mas inativo"}
                </span>
              </div>
              <h3>{data.loyaltyProgram.title}</h3>
              <p className="muted list-description">
                {data.loyaltyProgram.description?.trim().length
                  ? data.loyaltyProgram.description
                  : "O cliente vê no app a pontuação acumulada, o cashback, o ranking dentro do salão e o próximo nível a ser desbloqueado."}
              </p>
              <small className="list-meta">
                Cada visita concluída soma {data.loyaltyProgram.points_per_visit} pontos e {formatPercent(data.loyaltyProgram.cashback_percent)} de cashback.
              </small>
              <small className="list-meta">
                O nível máximo é {data.loyaltyProgram.vip_tier_name} com {formatPercent(data.loyaltyProgram.vip_discount_percent)} de desconto progressivo.
              </small>
            </div>
          </div>

          <div className="stats-grid" style={{ marginTop: 16 }}>
            <article className="card metric-card metric-card--soft">
              <span className="eyebrow">Clientes ranqueados</span>
              <p className="stat-value">{data.loyaltyOverview.ranked_customers ?? 0}</p>
              <p className="metric-note">Clientes que já pontuaram e aparecem no ranking do salão.</p>
            </article>
            <article className="card metric-card metric-card--warm">
              <span className="eyebrow">Visitas bonificadas</span>
              <p className="stat-value">{data.loyaltyOverview.total_completed_visits ?? 0}</p>
              <p className="metric-note">Atendimentos concluídos que já geraram pontuação e cashback.</p>
            </article>
            <article className="card metric-card metric-card--accent">
              <span className="eyebrow">Pontos distribuídos</span>
              <p className="stat-value">{data.loyaltyOverview.total_points_earned ?? 0}</p>
              <p className="metric-note">Total de pontos acumulados pelos clientes desde que o programa foi ligado.</p>
            </article>
            <article className="card metric-card metric-card--soft">
              <span className="eyebrow">Cashback gerado</span>
              <p className="stat-value">{formatCurrency(Number(data.loyaltyOverview.total_cashback_earned ?? 0))}</p>
              <p className="metric-note">Crédito total já gerado para resgate futuro diretamente no salão.</p>
            </article>
          </div>

          <div className="row-list" style={{ marginTop: 16 }}>
            {!data.loyaltyProgram || !data.loyaltyLeaderboard.length ? (
              <EmptyStateCard
                eyebrow="Ranking ainda vazio"
                title="Os clientes aparecem aqui depois da primeira visita concluída"
                description="Assim que o salão marcar atendimentos como concluídos, o ranking passa a mostrar quem mais pontuou, acumulou cashback e chegou ao VIP."
              />
            ) : (
              data.loyaltyLeaderboard.map((entry) => (
                <article key={entry.customer_id} className="list-row service-editor-card">
                  <div className="list-row__content">
                    <div className="inline-actions" style={{ marginBottom: 8 }}>
                      <span className={entry.current_tier?.is_vip ? "badge badge--confirmed" : "badge badge--soft"}>
                        {entry.current_tier?.label ?? "Cliente do programa"}
                      </span>
                      <span className="badge badge--pending">#{entry.rank_position}</span>
                    </div>
                    <h3>{entry.customer_name}</h3>
                    <p className="muted list-description">
                      {entry.current_tier
                        ? `${entry.completed_visits} visitas concluídas • ${formatPercent(entry.current_tier.discount_percent)} de desconto atual`
                        : `${entry.completed_visits} visitas concluídas com saldo ativo no programa`}
                    </p>
                    <div className="referral-event-grid">
                      <div className="referral-event-item">
                        <span className="referral-event-item__label">Pontos</span>
                        <strong>{entry.points_balance}</strong>
                      </div>
                      <div className="referral-event-item">
                        <span className="referral-event-item__label">Cashback</span>
                        <strong>{formatCurrency(Number(entry.cashback_balance ?? 0))}</strong>
                      </div>
                      <div className="referral-event-item">
                        <span className="referral-event-item__label">Visitas validadas</span>
                        <strong>{entry.completed_visits}</strong>
                      </div>
                      <div className="referral-event-item">
                        <span className="referral-event-item__label">Último ganho</span>
                        <strong>{entry.last_reward_at ? formatDateTime(entry.last_reward_at) : "Sem registro"}</strong>
                      </div>
                    </div>
                  </div>
                </article>
              ))
            )}
          </div>
        </>
      ) : (
        <div style={{ marginTop: 16 }}>
          <EmptyStateCard
            eyebrow="Sem programa ainda"
            title="Crie um clube de fidelidade no painel"
            description="Defina pontos por visita, cashback, desconto progressivo e o nível VIP. Assim o app começa a mostrar evolução real para cada cliente."
          />
        </div>
      )}
    </section>
  );
}

export function LoyaltyProgramPanel({ data }: { data: LoyaltyPageData }) {
  return (
    <section className="card content-card form-panel">
      <div className="section-heading">
        <div>
          <h2>Programa de fidelidade</h2>
          <p className="muted">Transforme visita concluída em pontos, cashback, desconto progressivo e status VIP no app do cliente.</p>
        </div>
      </div>

      {data.loyaltyProgram ? (
        <div className="list-row" style={{ marginTop: 18 }}>
          <div className="list-row__content">
            <div className="inline-actions" style={{ marginBottom: 8 }}>
              <span className={data.loyaltyProgram.is_active ? "badge badge--confirmed" : "badge badge--soft"}>
                {data.loyaltyProgram.is_active ? "Programa ativo" : "Programa salvo, mas inativo"}
              </span>
            </div>
            <h3>{data.loyaltyProgram.title}</h3>
            <p className="muted list-description">
              {data.loyaltyProgram.description?.trim().length
                ? data.loyaltyProgram.description
                : "Esse bloco aparece no app mostrando saldo, ranking, cashback e o próximo nível de fidelidade do cliente."}
            </p>
            <small className="list-meta">
              Cada visita concluída: {data.loyaltyProgram.points_per_visit} pontos + {formatPercent(data.loyaltyProgram.cashback_percent)} de cashback.
            </small>
            <small className="list-meta">
              VIP em {data.loyaltyProgram.vip_min_visits} visitas com {formatPercent(data.loyaltyProgram.vip_discount_percent)} de desconto.
            </small>
          </div>
        </div>
      ) : null}

      <form action={saveSalonLoyaltyProgramAction} className="form-grid" style={{ marginTop: 18 }}>
        <div className="field">
          <label htmlFor="loyalty-title">Título</label>
          <input
            id="loyalty-title"
            name="title"
            defaultValue={data.loyaltyProgram?.title ?? "Clube de fidelidade"}
            placeholder="Ex.: Clube VIP do salão"
            required
          />
        </div>

        <div className="field">
          <label htmlFor="loyalty-description">Descrição</label>
          <textarea
            id="loyalty-description"
            name="description"
            rows={4}
            defaultValue={data.loyaltyProgram?.description ?? ""}
            placeholder="Explique como o cliente acumula pontos, cashback e sobe de nível."
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="loyalty-points">Pontos por visita concluída</label>
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
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
          <div className="field">
            <label htmlFor="tier-one-name">Nível 1</label>
            <input
              id="tier-one-name"
              name="tierOneName"
              defaultValue={data.loyaltyProgram?.tier_one_name ?? "Cliente Frequente"}
              placeholder="Ex.: Cliente Frequente"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="tier-one-min-visits">Visitas mínimas</label>
            <input
              id="tier-one-min-visits"
              name="tierOneMinVisits"
              type="number"
              min="1"
              step="1"
              defaultValue={data.loyaltyProgram?.tier_one_min_visits ?? 3}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="tier-one-discount">Desconto (%)</label>
            <input
              id="tier-one-discount"
              name="tierOneDiscountPercent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={Number(data.loyaltyProgram?.tier_one_discount_percent ?? 5)}
              required
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
          <div className="field">
            <label htmlFor="tier-two-name">Nível 2</label>
            <input
              id="tier-two-name"
              name="tierTwoName"
              defaultValue={data.loyaltyProgram?.tier_two_name ?? "Cliente Ouro"}
              placeholder="Ex.: Cliente Ouro"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="tier-two-min-visits">Visitas mínimas</label>
            <input
              id="tier-two-min-visits"
              name="tierTwoMinVisits"
              type="number"
              min="2"
              step="1"
              defaultValue={data.loyaltyProgram?.tier_two_min_visits ?? 6}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="tier-two-discount">Desconto (%)</label>
            <input
              id="tier-two-discount"
              name="tierTwoDiscountPercent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={Number(data.loyaltyProgram?.tier_two_discount_percent ?? 10)}
              required
            />
          </div>
        </div>

        <div style={{ display: "grid", gap: 16, gridTemplateColumns: "minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 1fr)" }}>
          <div className="field">
            <label htmlFor="vip-tier-name">Nível VIP</label>
            <input
              id="vip-tier-name"
              name="vipTierName"
              defaultValue={data.loyaltyProgram?.vip_tier_name ?? "Cliente VIP"}
              placeholder="Ex.: Cliente VIP"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="vip-min-visits">Visitas mínimas</label>
            <input
              id="vip-min-visits"
              name="vipMinVisits"
              type="number"
              min="3"
              step="1"
              defaultValue={data.loyaltyProgram?.vip_min_visits ?? 10}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="vip-discount">Desconto VIP (%)</label>
            <input
              id="vip-discount"
              name="vipDiscountPercent"
              type="number"
              min="0"
              max="100"
              step="0.5"
              defaultValue={Number(data.loyaltyProgram?.vip_discount_percent ?? 15)}
              required
            />
          </div>
        </div>

        <label className="checkbox-field">
          <input type="checkbox" name="isActive" defaultChecked={data.loyaltyProgram?.is_active ?? false} />
          Ativar fidelidade no app do cliente
        </label>

        <small className="muted">
          O programa só pontua quando o atendimento é marcado como concluído no painel. O cliente vê ranking, cashback, desconto atual e quanto falta para o próximo nível.
        </small>

        <button type="submit" className="primary-button">
          Salvar programa de fidelidade
        </button>
      </form>
    </section>
  );
}

export function GrowthAutomationOverviewSection({ data }: { data: GrowthAutomationPageData }) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Automação comercial inteligente</h2>
          <p className="muted">O sistema combina rebook por hábito e recuperação com incentivo para puxar retorno antes de virar horário perdido.</p>
        </div>
      </div>

      <div className="row-list" style={{ marginTop: 18 }}>
        <article className="list-row">
          <div className="list-row__content">
            <div className="inline-actions" style={{ marginBottom: 8 }}>
              <span className={data.growthAutomationSettings.smart_rebook_is_active ? "badge badge--confirmed" : "badge badge--soft"}>
                {data.growthAutomationSettings.smart_rebook_is_active ? "Rebook ativo" : "Rebook pausado"}
              </span>
              <span className="badge badge--pending">Janela de {data.growthAutomationSettings.smart_rebook_window_days} dias</span>
            </div>
            <h3>{data.growthAutomationSettings.smart_rebook_title}</h3>
            <p className="muted list-description">{data.growthAutomationSettings.smart_rebook_body_template}</p>
            <small className="list-meta">
              Clientes prontos para o próximo rebook: {data.growthAutomationOverview.smart_rebook_due_customers ?? 0}
            </small>
            <small className="list-meta">
              Rebooks inteligentes enviados nos últimos 30 dias: {data.growthAutomationOverview.smart_rebooks_sent_last_30d ?? 0}
            </small>
          </div>
        </article>

        <article className="list-row">
          <div className="list-row__content">
            <div className="inline-actions" style={{ marginBottom: 8 }}>
              <span className={data.growthAutomationSettings.is_active ? "badge badge--confirmed" : "badge badge--soft"}>
                {data.growthAutomationSettings.is_active ? "Winback ativo" : "Winback pausado"}
              </span>
              <span className="badge badge--pending">{data.growthAutomationSettings.winback_inactive_days} dias</span>
              <span className="badge badge--completed">{data.growthAutomationSettings.winback_discount_percent}% OFF</span>
            </div>
            <h3>{data.growthAutomationSettings.winback_title}</h3>
            <p className="muted list-description">{data.growthAutomationSettings.winback_body_template}</p>
            <small className="list-meta">
              Clientes prontos para o winback agora: {data.growthAutomationOverview.due_now_customers ?? 0}
            </small>
            <small className="list-meta">
              Winbacks enviados nos últimos 30 dias: {data.growthAutomationOverview.winbacks_sent_last_30d ?? 0}
            </small>
            <small className="list-meta">
              Última alteração em{" "}
              {data.growthAutomationSettings.updated_at
                ? formatDateTime(data.growthAutomationSettings.updated_at)
                : "configuração padrão do sistema"}
            </small>
          </div>
        </article>
      </div>

      <div className="stats-grid" style={{ marginTop: 16 }}>
        <article className="card metric-card metric-card--warm">
          <span className="eyebrow">Clientes em risco</span>
          <p className="stat-value">{data.growthAutomationOverview.at_risk_customers ?? 0}</p>
          <p className="metric-note">Clientes sem próxima agenda que já entraram na zona de esfriamento.</p>
        </article>
        <article className="card metric-card metric-card--soft">
          <span className="eyebrow">Rebooks prontos</span>
          <p className="stat-value">{data.growthAutomationOverview.smart_rebook_due_customers ?? 0}</p>
          <p className="metric-note">Clientes com hábito claro e janela ideal abrindo para reservar antes de esfriar.</p>
        </article>
        <article className="card metric-card metric-card--accent">
          <span className="eyebrow">Recuperados em 30 dias</span>
          <p className="stat-value">{data.growthAutomationOverview.recovered_customers_last_30d ?? 0}</p>
          <p className="metric-note">Clientes que voltaram a marcar depois dos pushes automáticos mais recentes.</p>
        </article>
      </div>

      <div className="row-list" style={{ marginTop: 16 }}>
        {!data.growthAutomationRecentRuns.length ? (
          <EmptyStateCard
            eyebrow="Sem disparos ainda"
            title="A automação ainda não acionou clientes"
            description="Assim que algum cliente entrar na janela de rebook inteligente ou de recuperação, o painel começa a mostrar os disparos e as recuperações reais."
          />
        ) : (
          data.growthAutomationRecentRuns.map((run) => (
            <article key={run.id} className="list-row referral-event-card">
              <div className="list-row__content">
                <div className="inline-actions" style={{ marginBottom: 8 }}>
                  <span className={run.recovered ? "badge badge--confirmed" : "badge badge--pending"}>
                    {run.recovered ? "Recuperado" : "Aguardando retorno"}
                  </span>
                  <span className="badge badge--soft">
                    {run.automation_type === "smart_rebook_prompt" ? "Rebook inteligente" : `${run.discount_percent}% OFF`}
                  </span>
                </div>
                <h3>{run.customer_name}</h3>
                <p className="muted list-description">
                  {run.automation_type === "smart_rebook_prompt"
                    ? `Rebook baseado no hábito de ${run.service_name}${run.target_weekday ? `, mirando ${run.target_weekday}` : ""}${run.target_period ? ` ${run.target_period}` : ""}.`
                    : `Winback baseado em ${run.service_name}, disparado após ${run.inactive_days} dias sem retorno.`}
                </p>
                <div className="referral-event-grid">
                  <div className="referral-event-item">
                    <span className="referral-event-item__label">Enviado em</span>
                    <strong>{formatDateTime(run.sent_at)}</strong>
                  </div>

                  <div className="referral-event-item">
                    <span className="referral-event-item__label">
                      {run.automation_type === "smart_rebook_prompt" ? "Alvo" : "Oferta"}
                    </span>
                    <strong>
                      {run.automation_type === "smart_rebook_prompt"
                        ? `${run.target_weekday ?? "Janela ideal"}${run.target_period ? ` ${run.target_period}` : ""}`
                        : `${run.discount_percent}% OFF`}
                    </strong>
                  </div>

                  <div className="referral-event-item">
                    <span className="referral-event-item__label">Status</span>
                    <strong>{run.recovered ? "Voltou a agendar" : "Sem novo agendamento ainda"}</strong>
                  </div>

                  <div className="referral-event-item">
                    <span className="referral-event-item__label">Retorno detectado</span>
                    <strong>{run.recovered_appointment_at ? formatDateTime(run.recovered_appointment_at) : "Ainda não"}</strong>
                  </div>
                </div>
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}

export function GrowthAutomationPanel({ data }: { data: GrowthAutomationPageData }) {
  return (
    <section className="card content-card form-panel">
      <div className="section-heading">
        <div>
          <h2>Automação de recuperação</h2>
          <p className="muted">Defina quando o salão considera um cliente perdido e qual incentivo o app vai usar para trazê-lo de volta.</p>
        </div>
      </div>

      <form action={saveSalonGrowthAutomationAction} className="form-grid" style={{ marginTop: 18 }}>
        <div className="split-grid">
          <div className="field">
            <label htmlFor="growth-inactive-days">Inatividade para acionar</label>
            <input
              id="growth-inactive-days"
              name="winbackInactiveDays"
              type="number"
              min="7"
              max="365"
              step="1"
              defaultValue={data.growthAutomationSettings.winback_inactive_days}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="growth-discount">Incentivo (%)</label>
            <input
              id="growth-discount"
              name="winbackDiscountPercent"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={data.growthAutomationSettings.winback_discount_percent}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="growth-title">Título do push</label>
          <input
            id="growth-title"
            name="winbackTitle"
            defaultValue={data.growthAutomationSettings.winback_title}
            maxLength={120}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="growth-body">Mensagem automática</label>
          <textarea
            id="growth-body"
            name="winbackBodyTemplate"
            rows={5}
            maxLength={220}
            defaultValue={data.growthAutomationSettings.winback_body_template}
            required
          />
          <small className="muted">
            Você pode usar {"{discount}"}, {"{inactive_days}"} e {"{service_name}"} para personalizar a mensagem.
          </small>
        </div>

        <label className="checkbox-field">
          <input type="checkbox" name="isActive" defaultChecked={data.growthAutomationSettings.is_active} />
          Ativar winback automático no app do cliente
        </label>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="smart-rebook-window-days">Janela do rebook inteligente</label>
            <input
              id="smart-rebook-window-days"
              name="smartRebookWindowDays"
              type="number"
              min="1"
              max="14"
              step="1"
              defaultValue={data.growthAutomationSettings.smart_rebook_window_days}
              required
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="smart-rebook-title">Título do push inteligente</label>
          <input
            id="smart-rebook-title"
            name="smartRebookTitle"
            defaultValue={data.growthAutomationSettings.smart_rebook_title}
            maxLength={120}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="smart-rebook-body">Mensagem de rebook inteligente</label>
          <textarea
            id="smart-rebook-body"
            name="smartRebookBodyTemplate"
            rows={5}
            maxLength={220}
            defaultValue={data.growthAutomationSettings.smart_rebook_body_template}
            required
          />
          <small className="muted">
            Você pode usar {"{service_name}"}, {"{habit_weekday}"}, {"{target_weekday}"}, {"{target_period}"}, {"{days_until_due}"} e {"{combo_service_name}"}.
          </small>
        </div>

        <label className="checkbox-field">
          <input type="checkbox" name="smartRebookIsActive" defaultChecked={data.growthAutomationSettings.smart_rebook_is_active} />
          Ativar rebook inteligente baseado no hábito do cliente
        </label>

        <small className="muted">
          A mesma regra daqui alimenta o push remoto, o histórico gerencial do painel e as sugestões que aparecem no app do cliente.
        </small>

        <button type="submit" className="primary-button">
          Salvar automação
        </button>
      </form>
    </section>
  );
}
