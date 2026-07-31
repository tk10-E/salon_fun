import {
  createSalonOfferAction,
  deleteSalonOfferAction,
  updateSalonOfferAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { PromotionAiDraftAssistant } from "@/components/PromotionAiDraftAssistant";
import { formatCurrency } from "@/lib/formatters";

import {
  badgeClassForLifecycle,
  formatLifecycleLabel,
  formatOfferKind,
  formatOfferOperationalSummary,
  formatOfferPeriod,
  getOfferLifecycle,
  lifecycleHint,
  type OfferSearchParams,
  type PromotionsPageData,
} from "./_lib";
import styles from "./promotions.module.css";

const PROMOTIONS_PATH = "/dashboard/benefits/promotions";

export type PromotionComposerPrefill = {
  aiGoal?: string;
  aiNotes?: string;
  description?: string;
  endsOn?: string;
  highlight?: string;
  kind?: "membership" | "promotion";
  price?: string;
  serviceId?: string;
  sessionsIncluded?: string;
  startsOn?: string;
  title?: string;
  validityDays?: string;
};

type PromotionsPageContentProps = {
  aiEnabled: boolean;
  composeOpen: boolean;
  composePrefill: PromotionComposerPrefill;
  data: PromotionsPageData;
  offerKind: string;
  offerQ: string;
  offerState: string;
};

function buildPromotionsHref(
  current: Partial<OfferSearchParams> | undefined,
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (current) {
    for (const key of ["compose", "offerKind", "offerQ", "offerState"] as const) {
      const rawValue = current[key];
      const value = Array.isArray(rawValue) ? rawValue[0] : rawValue;

      if (value) {
        params.set(key, value);
      }
    }
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (!value) {
      params.delete(key);
      continue;
    }

    params.set(key, value);
  }

  const query = params.toString();
  return `${PROMOTIONS_PATH}${query ? `?${query}` : ""}`;
}

function formatPriceLabel(value: number | string | null) {
  return value == null ? "Sem preco" : formatCurrency(Number(value));
}

export function PromotionsPageContent({
  aiEnabled,
  composeOpen,
  composePrefill,
  data,
  offerKind,
  offerQ,
  offerState,
}: PromotionsPageContentProps) {
  const currentSearchParams: Partial<OfferSearchParams> = {
    compose: composeOpen ? "1" : undefined,
    offerKind,
    offerQ,
    offerState,
  };
  const composeHref = buildPromotionsHref(currentSearchParams, { compose: "1" });
  const closeComposeHref = buildPromotionsHref(currentSearchParams, {
    compose: undefined,
  });
  const clearFiltersHref = buildPromotionsHref(currentSearchParams, {
    offerKind: undefined,
    offerQ: undefined,
    offerState: undefined,
  });
  const groupedEntries = Object.entries(data.groupedOffers);

  return (
    <div className={styles.page}>
            <section className={styles.hero}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>Campanhas</p>
            <h1>Campanhas do app</h1>
            <p className={styles.lead}>
              Publique, ajuste e pause campanhas sem complicacao.
            </p>
            <div className={styles.badgeRow}>
              <span className={styles.countPill}>{data.activeOffersCount} ativas</span>
              <span className={styles.countPill}>{data.activeMembershipsCount} planos</span>
              <span className={styles.countPill}>{data.lifecycleCounts.scheduled} agendadas</span>
            </div>
          </div>

          <div className={styles.headerActions}>
            <a href={composeHref} className={styles.primaryButton}>
              Nova campanha
            </a>
          </div>
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.catalogPanel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Lista</p>
                <h2>Campanhas no app</h2>
              </div>
              <div className={styles.badgeRow}>
                <span className={styles.countPill}>
                  Busca: {offerQ.trim() ? offerQ.trim() : "toda a vitrine"}
                </span>
                <span className={styles.countPill}>
                  Resultado: {data.offers.length}
                </span>
              </div>
            </div>

            <form method="get" className={styles.filterRow}>
              {composeOpen ? <input type="hidden" name="compose" value="1" /> : null}
              {offerKind ? <input type="hidden" name="offerKind" value={offerKind} /> : null}
              <label className={styles.filterSearch}>
                <input
                  type="search"
                  name="offerQ"
                  defaultValue={offerQ}
                  placeholder="Buscar campanha..."
                />
              </label>

              <select
                id="offer-state-filter"
                name="offerState"
                defaultValue={offerState}
                className={styles.filterSelect}
              >
                <option value="">Todas as situacoes</option>
                <option value="active">Ativas</option>
                <option value="scheduled">Agendadas</option>
                <option value="expired">Expiradas</option>
                <option value="paused">Pausadas</option>
              </select>
              <button type="submit" className={styles.iconButton}>
                Filtrar
              </button>
              {data.hasOfferFilters ? (
                <a href={clearFiltersHref} className={styles.secondaryButton}>
                  Limpar
                </a>
              ) : null}
            </form>

            {!data.offers.length ? (
              <EmptyStateCard
                eyebrow={data.hasOfferFilters ? "Sem resultado" : "Sem ofertas"}
                title={
                  data.hasOfferFilters
                    ? "Nenhuma oferta bate com esse filtro"
                    : "Crie a primeira campanha do app"
                }
                description="Use Nova campanha para aparecer no app."
              />
            ) : (
              <div className={styles.groupStack}>
                {groupedEntries.map(([groupLabel, offers]) => (
                  <section key={groupLabel} className={styles.offerGroup}>
                    <div className={styles.groupHeader}>
                      <h3>{groupLabel}</h3>
                      <span>{offers.length} item(ns)</span>
                    </div>

                    <div className={styles.offerGrid}>
                      {offers.map((offer) => {
                        const lifecycle = getOfferLifecycle(offer, data.today);

                        return (
                          <article key={offer.id} className={styles.offerCard}>
                            <div className={styles.offerHeader}>
                              <div className={styles.badgeRow}>
                                <span className={styles.kindBadge}>
                                  {formatOfferKind(offer)}
                                </span>
                                <span className={badgeClassForLifecycle(lifecycle)}>
                                  {formatLifecycleLabel(lifecycle)}
                                </span>
                              </div>
                              <span className={styles.offerValue}>
                                {formatPriceLabel(offer.price)}
                              </span>
                            </div>

                            <h4>{offer.title}</h4>
                            <p className={styles.offerHighlight}>
                              {offer.highlight_text?.trim() ||
                                offer.description?.trim() ||
                                "Campanha pronta para o app."}
                            </p>
                            <p className={styles.offerMeta}>{formatOfferPeriod(offer)}</p>
                            <p className={styles.offerMeta}>
                              {formatOfferOperationalSummary(
                                offer,
                                data.serviceOptions.find(
                                  (service) => service.id === offer.membership_service_id,
                                )?.name,
                              )}
                            </p>
                            <p className={styles.offerHint}>
                              {lifecycleHint(offer, lifecycle, data.today)}
                            </p>

                            <details className={styles.disclosure}>
                              <summary>Editar campanha</summary>
                              <div className={styles.editStack}>
                                <form action={updateSalonOfferAction} className={styles.inlineForm}>
                                  <input type="hidden" name="returnPath" value={PROMOTIONS_PATH} />
                                  <input type="hidden" name="offerId" value={offer.id} />

                                  <div className={styles.fieldGrid}>
                                    <div className="field">
                                      <label htmlFor={`offer-title-${offer.id}`}>TÃ­tulo</label>
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
                                  </div>

                                  <div className={styles.fieldGrid}>
                                    <div className="field">
                                      <label htmlFor={`offer-kind-${offer.id}`}>Tipo</label>
                                      <select
                                        id={`offer-kind-${offer.id}`}
                                        name="kind"
                                        defaultValue={offer.kind}
                                      >
                                        <option value="promotion">PromoÃ§Ã£o</option>
                                        <option value="membership">Plano / pacote</option>
                                      </select>
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
                                      DescriÃ§Ã£o
                                    </label>
                                    <textarea
                                      id={`offer-description-${offer.id}`}
                                      name="description"
                                      rows={3}
                                      defaultValue={offer.description ?? ""}
                                    />
                                  </div>

                                  <div className={styles.fieldGrid}>
                                    <div className="field">
                                      <label htmlFor={`offer-start-${offer.id}`}>InÃ­cio</label>
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
                                  </div>

                                  <div className={styles.fieldGrid}>
                                    <div className="field">
                                      <label htmlFor={`offer-service-${offer.id}`}>
                                        ServiÃ§o vinculado
                                      </label>
                                      <select
                                        id={`offer-service-${offer.id}`}
                                        name="membershipServiceId"
                                        defaultValue={offer.membership_service_id ?? ""}
                                      >
                                        <option value="">Sem vÃ­nculo</option>
                                        {data.serviceOptions.map((service) => (
                                          <option key={service.id} value={service.id}>
                                            {service.category
                                              ? `${service.category} â€¢ ${service.name}`
                                              : service.name}
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                    <div className="field">
                                      <label htmlFor={`offer-sessions-${offer.id}`}>
                                        SessÃµes incluÃ­das
                                      </label>
                                      <input
                                        id={`offer-sessions-${offer.id}`}
                                        name="membershipSessionsIncluded"
                                        type="number"
                                        min="1"
                                        step="1"
                                        defaultValue={
                                          offer.membership_sessions_included ?? ""
                                        }
                                      />
                                    </div>
                                  </div>

                                  <div className={styles.fieldGrid}>
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
                                    <label className={`checkbox-field ${styles.checkboxField}`}>
                                      <input
                                        type="checkbox"
                                        name="isActive"
                                        defaultChecked={offer.is_active}
                                        id={`offer-active-${offer.id}`}
                                      />
                                      Publicar no app
                                    </label>
                                  </div>

                                  <button type="submit" className={styles.primaryButton}>
                                    Salvar
                                  </button>
                                </form>

                                <form action={deleteSalonOfferAction}>
                                  <input type="hidden" name="returnPath" value={PROMOTIONS_PATH} />
                                  <input type="hidden" name="offerId" value={offer.id} />
                                  <button type="submit" className={styles.dangerButton}>
                                    Remover
                                  </button>
                                </form>
                              </div>
                            </details>
                          </article>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            )}
          </article>

          {composeOpen ? (
            <article className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.sidebarEyebrow}>Nova campanha</p>
                  <h2>Criar campanha</h2>
                  <p className={styles.lead}>
                    Titulo, valor e periodo em um cadastro.
                  </p>
                </div>
                <a href={closeComposeHref} className={styles.inlineLink}>
                  Fechar
                </a>
              </div>

              <PromotionAiDraftAssistant
                aiEnabled={aiEnabled}
                initialGoal={composePrefill.aiGoal}
                initialNotes={composePrefill.aiNotes}
              />

              <form action={createSalonOfferAction} className={styles.inlineForm}>
                <input type="hidden" name="returnPath" value={PROMOTIONS_PATH} />

                <div className={styles.fieldGrid}>
                  <div className="field">
                    <label htmlFor="offer-kind">Tipo</label>
                    <select
                      id="offer-kind"
                      name="kind"
                      defaultValue={composePrefill.kind ?? "promotion"}
                    >
                      <option value="promotion">PromoÃ§Ã£o</option>
                      <option value="membership">Plano / pacote</option>
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
                      defaultValue={composePrefill.price ?? ""}
                      placeholder="79.90"
                    />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="offer-title">TÃ­tulo</label>
                  <input
                    id="offer-title"
                    name="title"
                    defaultValue={composePrefill.title ?? ""}
                    placeholder="Ex.: Pacote corte + barba"
                    required
                  />
                </div>

                <div className="field">
                  <label htmlFor="offer-highlight">Chamada principal</label>
                  <input
                    id="offer-highlight"
                    name="highlightText"
                    defaultValue={composePrefill.highlight ?? ""}
                    placeholder="Ex.: 2 atendimentos no mÃªs com valor fixo"
                  />
                </div>

                <div className="field">
                  <label htmlFor="offer-description">DescriÃ§Ã£o</label>
                  <textarea
                    id="offer-description"
                    name="description"
                    rows={3}
                    defaultValue={composePrefill.description ?? ""}
                    placeholder="Resumo rÃ¡pido do que entra na campanha."
                  />
                </div>

                <div className={styles.fieldGrid}>
                  <div className="field">
                    <label htmlFor="offer-start">InÃ­cio</label>
                    <input
                      id="offer-start"
                      name="startsOn"
                      type="date"
                      defaultValue={composePrefill.startsOn ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="offer-end">Fim</label>
                    <input
                      id="offer-end"
                      name="endsOn"
                      type="date"
                      defaultValue={composePrefill.endsOn ?? ""}
                    />
                  </div>
                  <label className={`checkbox-field ${styles.checkboxField}`}>
                    <input id="offer-active" type="checkbox" name="isActive" defaultChecked />
                    Publicar no app
                  </label>
                </div>

                <div className={styles.fieldGrid}>
                  <div className="field">
                    <label htmlFor="offer-membership-service">ServiÃ§o (opcional)</label>
                    <select
                      id="offer-membership-service"
                      name="membershipServiceId"
                      defaultValue={composePrefill.serviceId ?? ""}
                    >
                      <option value="">Sem vÃ­nculo</option>
                      {data.serviceOptions.map((service) => (
                        <option key={service.id} value={service.id}>
                          {service.category
                            ? `${service.category} â€¢ ${service.name}`
                            : service.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label htmlFor="offer-membership-sessions">SessÃµes incluÃ­das</label>
                    <input
                      id="offer-membership-sessions"
                      name="membershipSessionsIncluded"
                      type="number"
                      min="1"
                      step="1"
                      defaultValue={composePrefill.sessionsIncluded ?? ""}
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
                      defaultValue={composePrefill.validityDays ?? ""}
                      placeholder="30"
                    />
                  </div>
                </div>

                <button type="submit" className={styles.primaryButton}>
                  Publicar campanha
                </button>
              </form>
            </article>
          ) : null}
        </div>
      </section>
    </div>
  );
}

