import {
  createSalonOfferAction,
  deleteSalonOfferAction,
  updateSalonOfferAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type SubscriptionsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type MembershipOfferRow = {
  id: string;
  title: string;
  description: string | null;
  highlight_text: string | null;
  membership_service_id: string | null;
  membership_sessions_included: number | null;
  membership_validity_days: number | null;
  price: number | string | null;
  starts_on: string | null;
  ends_on: string | null;
  is_active: boolean;
  sort_order: number;
};

type MembershipRecord = {
  id: string;
  customer_id: string;
  offer_id: string;
  title: string;
  service_name_snapshot: string;
  status: string;
  started_at: string;
  expires_at: string;
  sessions_included: number;
  sessions_used: number;
  price_snapshot: number | string | null;
  customers?: { name: string } | { name: string }[] | null;
};

type ServiceOption = {
  id: string;
  name: string;
  category: string | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function resolveMembershipStatus(membership: MembershipRecord, today: string) {
  if (membership.status === "cancelled") return "cancelled";
  if (membership.status === "expired" || membership.expires_at < today) return "expired";
  if (membership.status === "completed" || membership.sessions_used >= membership.sessions_included) return "completed";
  return "active";
}

function membershipStatusBadge(status: ReturnType<typeof resolveMembershipStatus>) {
  switch (status) {
    case "active":
      return "badge badge--confirmed";
    case "completed":
      return "badge badge--soft";
    case "expired":
      return "badge badge--pending";
    default:
      return "badge badge--cancelled";
  }
}

function membershipStatusLabel(status: ReturnType<typeof resolveMembershipStatus>) {
  switch (status) {
    case "active":
      return "Ativa";
    case "completed":
      return "Consumida";
    case "expired":
      return "Expirada";
    default:
      return "Cancelada";
  }
}

function formatOperationalSummary(offer: MembershipOfferRow, serviceName: string | null | undefined) {
  if (!offer.membership_service_id || offer.membership_sessions_included == null || offer.membership_validity_days == null) {
    return "Defina serviço, sessões e validade para operar.";
  }

  const serviceLabel = serviceName?.trim() || "serviço configurado";
  const sessionsLabel = offer.membership_sessions_included === 1 ? "1 sessão" : `${offer.membership_sessions_included} sessões`;
  const validityLabel = offer.membership_validity_days === 1 ? "1 dia" : `${offer.membership_validity_days} dias`;

  return `${sessionsLabel} de ${serviceLabel} com validade de ${validityLabel}.`;
}

export default async function SubscriptionsPage({ searchParams }: SubscriptionsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [offersResult, membershipsResult, servicesResult] = await Promise.all([
    supabase
      .from("salon_offers")
      .select(
        "id, title, description, highlight_text, membership_service_id, membership_sessions_included, membership_validity_days, price, starts_on, ends_on, is_active, sort_order",
      )
      .eq("salon_id", salon.id)
      .eq("kind", "membership")
      .order("sort_order")
      .order("created_at"),
    (supabase as any)
      .from("customer_memberships")
      .select(
        "id, customer_id, offer_id, title, service_name_snapshot, status, started_at, expires_at, sessions_included, sessions_used, price_snapshot, customers(name)",
      )
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false }),
    supabase.from("services").select("id, name, category").eq("salon_id", salon.id).order("sort_order").order("name"),
  ]);

  const offers = (offersResult.data ?? []) as MembershipOfferRow[];
  const memberships = (membershipsResult.data ?? []) as MembershipRecord[];
  const serviceOptions = (servicesResult.data ?? []) as ServiceOption[];
  const serviceNameById = new Map(serviceOptions.map((service) => [service.id, service.category ? `${service.category} • ${service.name}` : service.name]));

  const offerStats = new Map<
    string,
    {
      active: number;
      total: number;
      projectedRevenue: number;
    }
  >();

  for (const offer of offers) {
    offerStats.set(offer.id, { active: 0, total: 0, projectedRevenue: 0 });
  }

  for (const membership of memberships) {
    const current = offerStats.get(membership.offer_id) ?? { active: 0, total: 0, projectedRevenue: 0 };
    const status = resolveMembershipStatus(membership, today);
    current.total += 1;
    if (status === "active") {
      current.active += 1;
      current.projectedRevenue += Number(membership.price_snapshot ?? 0);
    }
    offerStats.set(membership.offer_id, current);
  }

  const activeMemberships = memberships.filter((membership) => resolveMembershipStatus(membership, today) === "active");
  const activeOffers = offers.filter((offer) => offer.is_active);
  const configuredOffers = offers.filter(
    (offer) =>
      offer.membership_service_id &&
      offer.membership_sessions_included != null &&
      offer.membership_validity_days != null,
  );
  const expiringSoonMemberships = activeMemberships.filter((membership) => {
    const expiration = new Date(`${membership.expires_at}T00:00:00`);
    const currentDay = new Date(`${today}T00:00:00`);
    const diffInDays = Math.ceil((expiration.getTime() - currentDay.getTime()) / 86_400_000);

    return diffInDays >= 0 && diffInDays <= 7;
  });
  const projectedRevenue = activeMemberships.reduce((sum, membership) => sum + Number(membership.price_snapshot ?? 0), 0);
  const averageTicket = activeMemberships.length ? projectedRevenue / activeMemberships.length : 0;
  const leadingOffer =
    [...offers]
      .sort((left, right) => (offerStats.get(right.id)?.active ?? 0) - (offerStats.get(left.id)?.active ?? 0))
      .find((offer) => (offerStats.get(offer.id)?.active ?? 0) > 0) ??
    offers[0] ??
    null;
  const leadingOfferStats = leadingOffer ? offerStats.get(leadingOffer.id) ?? null : null;
  const nextMembershipToExpire =
    [...activeMemberships].sort((left, right) => left.expires_at.localeCompare(right.expires_at))[0] ?? null;
  const recentMemberships = memberships.slice(0, 12);

  return (
    <div className="page-grid workspace-page subscriptions-page subscriptions-simple">
      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      <DashboardWorkspaceHero
        id="subscription-overview"
        eyebrow="Assinaturas"
        title="Assinaturas e planos para vender mais vezes."
        description="Catálogo, carteira ativa e leitura comercial em uma visão só."
        highlight={{
          label: "Receita recorrente projetada",
          value: formatCurrency(projectedRevenue),
          note:
            activeMemberships.length > 0
              ? `${activeMemberships.length} assinatura${activeMemberships.length === 1 ? "" : "s"} ativa${activeMemberships.length === 1 ? "" : "s"} no momento.`
              : "Assim que vender o primeiro plano, a carteira aparece aqui.",
        }}
        signals={[
          {
            label: "Planos ativos",
            value: activeOffers.length,
            tone: activeOffers.length ? "success" : "soft",
          },
          {
            label: "Carteira viva",
            value: activeMemberships.length,
            tone: activeMemberships.length ? "accent" : "soft",
          },
          {
            label: "Vencendo em 7 dias",
            value: expiringSoonMemberships.length,
            tone: expiringSoonMemberships.length ? "warm" : "success",
          },
        ]}
        stats={[
          {
            label: "Planos no catálogo",
            value: offers.length,
            note: configuredOffers.length === offers.length ? "Todos operacionais." : `${configuredOffers.length} completos para venda.`,
            tone: offers.length ? "soft" : "neutral",
          },
          {
            label: "Ticket médio",
            value: activeMemberships.length ? formatCurrency(averageTicket) : "Sem base",
            note: "Média por assinatura ativa.",
            tone: activeMemberships.length ? "accent" : "soft",
          },
          {
            label: "Clientes recorrentes",
            value: memberships.length,
            note: "Histórico total da carteira.",
            tone: memberships.length ? "success" : "soft",
          },
          {
            label: "Plano forte",
            value: leadingOffer?.title ?? "Sem destaque",
            note: leadingOfferStats?.active ? `${leadingOfferStats.active} cliente${leadingOfferStats.active === 1 ? "" : "s"} ativo${leadingOfferStats.active === 1 ? "" : "s"}.` : "Publique o primeiro plano para começar.",
            tone: leadingOfferStats?.active ? "warm" : "soft",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#subscription-create" className="primary-button">
              Novo plano
            </a>
            <a href="#subscription-catalog" className="secondary-button">
              Ver catálogo
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Leitura comercial</span>
            <h3>{leadingOffer?.title ?? "Prepare o primeiro plano"}</h3>
            <p>
              {leadingOffer && leadingOfferStats
                ? `${leadingOfferStats.active} ativo${leadingOfferStats.active === 1 ? "" : "s"} e ${formatCurrency(leadingOfferStats.projectedRevenue)} em carteira para este plano.`
                : "Defina serviço, sessões e validade para deixar a recorrência pronta para o salão."}
            </p>
            <div className="subscriptions-page__hero-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Próximo vencimento</span>
                <strong>{nextMembershipToExpire ? formatDate(nextMembershipToExpire.expires_at) : "Sem alertas"}</strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Plano completo</span>
                <strong>{configuredOffers.length}/{offers.length || 0}</strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos da recorrência"
        items={[
          { href: "#subscription-catalog", label: "Catálogo", meta: "Planos ativos e edição" },
          { href: "#subscription-create", label: "Novo plano", meta: "Criar pacote ou clube" },
          { href: "#subscription-base", label: "Carteira", meta: "Clientes e saldo" },
        ]}
      />

      <section className="workspace-subgrid subscriptions-page__summary-grid" aria-label="Resumo comercial da recorrência">
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Catálogo pronto</span>
          <h3>{configuredOffers.length} plano{configuredOffers.length === 1 ? "" : "s"} operacional{configuredOffers.length === 1 ? "" : "is"}</h3>
          <p>
            {offers.length
              ? configuredOffers.length === offers.length
                ? "Todo o catálogo já tem serviço, sessões e validade definidos."
                : `${offers.length - configuredOffers.length} plano${offers.length - configuredOffers.length === 1 ? "" : "s"} ainda precisa${offers.length - configuredOffers.length === 1 ? "" : "m"} de ajuste para operar liso.`
              : "Crie o primeiro plano para começar a vender recorrência."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Base em atenção</span>
          <h3>{expiringSoonMemberships.length} vencendo nesta semana</h3>
          <p>
            {nextMembershipToExpire
              ? `Próxima validade em ${formatDate(nextMembershipToExpire.expires_at)} para ${firstRelation(nextMembershipToExpire.customers)?.name ?? "cliente sem nome"}.`
              : "Nenhuma assinatura ativa vence nos próximos 7 dias."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Plano de destaque</span>
          <h3>{leadingOffer?.title ?? "Sem plano líder"}</h3>
          <p>
            {leadingOffer && leadingOfferStats
              ? `${leadingOfferStats.total} venda${leadingOfferStats.total === 1 ? "" : "s"} no histórico e ${formatCurrency(leadingOfferStats.projectedRevenue)} projetados agora.`
              : "Assim que a carteira ganhar tração, o plano com melhor giro aparece aqui."}
          </p>
        </article>
      </section>

      <section id="subscription-catalog" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Planos do salão</h2>
            <p className="muted">Clubes e pacotes com edição simples.</p>
          </div>
        </div>

        {!offers.length ? (
          <EmptyStateCard eyebrow="Sem planos" title="Crie o primeiro plano" description="Assim que um plano for publicado, ele aparece aqui." />
        ) : (
          <div className="simple-list">
            {offers.map((offer) => {
              const stats = offerStats.get(offer.id) ?? { active: 0, total: 0, projectedRevenue: 0 };
              const serviceName = offer.membership_service_id ? serviceNameById.get(offer.membership_service_id) : null;
              const isPopular = leadingOffer?.id === offer.id && stats.active > 0;

              return (
                <article key={offer.id} className="simple-row">
                  <div className="inline-actions" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                    <span className={offer.is_active ? "badge badge--confirmed" : "badge badge--soft"}>{offer.is_active ? "Ativo" : "Pausado"}</span>
                    {isPopular ? <span className="badge badge--pending">Mais vendido</span> : null}
                    <span className="badge badge--soft">Ordem {offer.sort_order}</span>
                  </div>
                  <h3>{offer.title}</h3>
                  <p className="muted">{offer.highlight_text?.trim() || formatOperationalSummary(offer, serviceName)}</p>
                  <p className="list-meta">
                    {offer.price == null ? "Sob consulta" : `${formatCurrency(Number(offer.price))}/mês`} • {formatOperationalSummary(offer, serviceName)}
                  </p>
                  <p className="list-meta">
                    {stats.active} ativo{stats.active === 1 ? "" : "s"} • {stats.total} vendido{stats.total === 1 ? "" : "s"}
                    {offer.starts_on ? ` • vigência de ${formatDate(offer.starts_on)}` : ""} {offer.ends_on ? ` até ${formatDate(offer.ends_on)}` : ""}
                  </p>

                  <details className="accordion" style={{ marginTop: 12 }}>
                    <summary>
                      <span>Editar plano</span>
                      <span className="accordion__cta">ajustar</span>
                    </summary>
                    <form action={updateSalonOfferAction} className="simple-form" style={{ marginTop: 10 }}>
                      <input type="hidden" name="returnPath" value="/dashboard/subscriptions" />
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="kind" value="membership" />

                      <div className="field">
                        <label htmlFor={`subscription-title-${offer.id}`}>Título</label>
                        <input id={`subscription-title-${offer.id}`} name="title" defaultValue={offer.title} required />
                      </div>

                      <div className="field">
                        <label htmlFor={`subscription-highlight-${offer.id}`}>Chamada</label>
                        <input id={`subscription-highlight-${offer.id}`} name="highlightText" defaultValue={offer.highlight_text ?? ""} />
                      </div>

                      <div className="field">
                        <label htmlFor={`subscription-description-${offer.id}`}>Descrição</label>
                        <textarea id={`subscription-description-${offer.id}`} name="description" rows={3} defaultValue={offer.description ?? ""} />
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-price-${offer.id}`}>Valor</label>
                          <input
                            id={`subscription-price-${offer.id}`}
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={offer.price == null ? "" : Number(offer.price)}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`subscription-order-${offer.id}`}>Ordem</label>
                          <input id={`subscription-order-${offer.id}`} name="sortOrder" type="number" min="0" step="1" defaultValue={offer.sort_order} required />
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-service-${offer.id}`}>Serviço</label>
                          <select id={`subscription-service-${offer.id}`} name="membershipServiceId" defaultValue={offer.membership_service_id ?? ""}>
                            <option value="">Selecione</option>
                            {serviceOptions.map((service) => (
                              <option key={service.id} value={service.id}>
                                {service.category ? `${service.category} • ${service.name}` : service.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="field">
                          <label htmlFor={`subscription-sessions-${offer.id}`}>Sessões</label>
                          <input
                            id={`subscription-sessions-${offer.id}`}
                            name="membershipSessionsIncluded"
                            type="number"
                            min="1"
                            step="1"
                            defaultValue={offer.membership_sessions_included ?? ""}
                            required
                          />
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-validity-${offer.id}`}>Validade (dias)</label>
                          <input
                            id={`subscription-validity-${offer.id}`}
                            name="membershipValidityDays"
                            type="number"
                            min="1"
                            step="1"
                            defaultValue={offer.membership_validity_days ?? ""}
                            required
                          />
                        </div>
                        <div className="field">
                          <label>Status</label>
                          <label className="checkbox-field" style={{ marginTop: 10 }}>
                            <input type="checkbox" name="isActive" defaultChecked={offer.is_active} />
                            Plano visível
                          </label>
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-start-${offer.id}`}>Válido a partir de</label>
                          <input id={`subscription-start-${offer.id}`} name="startsOn" type="date" defaultValue={offer.starts_on ?? ""} />
                        </div>
                        <div className="field">
                          <label htmlFor={`subscription-end-${offer.id}`}>Válido até</label>
                          <input id={`subscription-end-${offer.id}`} name="endsOn" type="date" defaultValue={offer.ends_on ?? ""} />
                        </div>
                      </div>

                      <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
                        <button type="submit" className="secondary-button">
                          Salvar plano
                        </button>
                      </div>
                    </form>
                    <form action={deleteSalonOfferAction} style={{ marginTop: 8 }}>
                      <input type="hidden" name="returnPath" value="/dashboard/subscriptions" />
                      <input type="hidden" name="offerId" value={offer.id} />
                      <button type="submit" className="danger-button">
                        Remover
                      </button>
                    </form>
                  </details>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="subscription-create" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Novo plano</h2>
            <p className="muted">Cadastre rapidamente um novo clube ou pacote.</p>
          </div>
        </div>

        <form action={createSalonOfferAction} className="simple-form">
          <input type="hidden" name="returnPath" value="/dashboard/subscriptions" />
          <input type="hidden" name="kind" value="membership" />

          <div className="field">
            <label htmlFor="subscription-title">Título</label>
            <input id="subscription-title" name="title" placeholder="Ex.: Clube mensal de hidratação" required />
          </div>

          <div className="field">
            <label htmlFor="subscription-highlight">Chamada</label>
            <input id="subscription-highlight" name="highlightText" placeholder="Ex.: 2 hidratações por mês com preço fixo" />
          </div>

          <div className="field">
            <label htmlFor="subscription-description">Descrição</label>
            <textarea id="subscription-description" name="description" rows={3} placeholder="Explique o que entra no plano." />
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-price">Valor</label>
              <input id="subscription-price" name="price" type="number" min="0" step="0.01" placeholder="149.90" />
            </div>
            <div className="field">
              <label htmlFor="subscription-order">Ordem</label>
              <input id="subscription-order" name="sortOrder" type="number" min="0" step="1" defaultValue="0" required />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-service">Serviço vinculado</label>
              <select id="subscription-service" name="membershipServiceId" defaultValue="">
                <option value="">Selecione</option>
                {serviceOptions.map((service) => (
                  <option key={service.id} value={service.id}>
                    {service.category ? `${service.category} • ${service.name}` : service.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="subscription-sessions">Sessões incluídas</label>
              <input id="subscription-sessions" name="membershipSessionsIncluded" type="number" min="1" step="1" placeholder="2" required />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-validity">Validade em dias</label>
              <input id="subscription-validity" name="membershipValidityDays" type="number" min="1" step="1" placeholder="30" required />
            </div>
            <div className="field">
              <label>Status</label>
              <label className="checkbox-field" style={{ marginTop: 10 }}>
                <input type="checkbox" name="isActive" defaultChecked />
                Plano visível no app
              </label>
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-start">Válido a partir de</label>
              <input id="subscription-start" name="startsOn" type="date" />
            </div>
            <div className="field">
              <label htmlFor="subscription-end">Válido até</label>
              <input id="subscription-end" name="endsOn" type="date" />
            </div>
          </div>

          <button type="submit" className="primary-button">
            Publicar plano
          </button>
        </form>
      </section>

      <section id="subscription-base" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Carteira ativa</h2>
            <p className="muted">Clientes com saldo e validade.</p>
          </div>
        </div>

        <div className="simple-list">
          {!recentMemberships.length ? (
            <EmptyStateCard eyebrow="Sem clientes ainda" title="A base aparece aqui" description="Quando vender planos, os clientes ficam nesta lista." />
          ) : (
            recentMemberships.map((membership) => {
              const membershipStatus = resolveMembershipStatus(membership, today);
              const customer = firstRelation(membership.customers);
              const remainingSessions = Math.max(membership.sessions_included - membership.sessions_used, 0);

              return (
                <article key={membership.id} className="simple-row">
                  <div className="inline-actions" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                    <span className={membershipStatusBadge(membershipStatus)}>{membershipStatusLabel(membershipStatus)}</span>
                    {customer?.name ? <span className="badge badge--soft">{customer.name}</span> : null}
                  </div>
                  <h3>{membership.title}</h3>
                  <p className="muted">
                    {membership.service_name_snapshot} • {remainingSessions} restante{remainingSessions === 1 ? "" : "s"}
                  </p>
                  <small className="list-meta">
                    Iniciado em {formatDate(membership.started_at)} • até {formatDate(membership.expires_at)}.
                    {membership.price_snapshot != null ? ` ${formatCurrency(Number(membership.price_snapshot))}.` : ""}
                  </small>
                </article>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}
