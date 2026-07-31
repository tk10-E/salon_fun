import {
  approveCustomerMembershipRequestAction,
  createSalonOfferAction,
  deleteSalonOfferAction,
  markCustomerMembershipRequestPaidAction,
  rejectCustomerMembershipRequestAction,
  updateSalonOfferAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDate } from "@/lib/formatters";
import {
  resolveMembershipLifecycleCopy,
  resolveMembershipOfferLabel,
} from "@/lib/membershipOffers";
import { parseMembershipRequestPreferredScheduleNotes } from "@/lib/membershipRequestPreferredSchedule";
import { createClient } from "@/lib/supabase/server";

type SubscriptionsPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

type MembershipOfferRow = {
  id: string;
  title: string;
  description: string | null;
  highlight_text: string | null;
  image_path: string | null;
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

type MembershipRequestRecord = {
  id: string;
  customer_id: string;
  offer_id: string;
  offer_title_snapshot: string;
  approved_starts_on: string | null;
  decided_at: string | null;
  membership_id: string | null;
  price_snapshot: number | string | null;
  notes: string | null;
  status: string;
  requested_at: string;
  customers?: { name: string } | { name: string }[] | null;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  return Array.isArray(value) ? (value[0] ?? null) : (value ?? null);
}

function resolveMembershipStatus(membership: MembershipRecord, today: string) {
  if (membership.status === "cancelled") return "cancelled";
  if (membership.status === "expired" || membership.expires_at < today)
    return "expired";
  if (
    membership.status === "completed" ||
    membership.sessions_used >= membership.sessions_included
  )
    return "completed";
  return "active";
}

function membershipStatusBadge(
  status: ReturnType<typeof resolveMembershipStatus>,
) {
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

function membershipStatusLabel(
  status: ReturnType<typeof resolveMembershipStatus>,
) {
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

function formatOperationalSummary(
  offer: MembershipOfferRow,
  serviceName: string | null | undefined,
) {
  if (
    !offer.membership_service_id ||
    offer.membership_sessions_included == null ||
    offer.membership_validity_days == null
  ) {
    return "Defina serviço, sessões e validade para operar.";
  }

  const serviceLabel = serviceName?.trim() || "serviço configurado";
  const sessionsLabel =
    offer.membership_sessions_included === 1
      ? "1 sessão"
      : `${offer.membership_sessions_included} sessões`;
  const validityLabel =
    offer.membership_validity_days === 1
      ? "1 dia"
      : `${offer.membership_validity_days} dias`;
  const membershipLabel = resolveMembershipLifecycleCopy(
    offer.membership_validity_days,
  );

  return `${sessionsLabel} de ${serviceLabel} com validade real de ${validityLabel} para este ${membershipLabel}.`;
}

function formatMembershipActivationGuidance(validityDays: number | null) {
  const membershipLabel = resolveMembershipLifecycleCopy(validityDays);

  if (validityDays == null || validityDays <= 0) {
    return `A validade real deste ${membershipLabel} começa na data de ativação escolhida pelo salão.`;
  }

  return validityDays === 1
    ? `A validade real deste ${membershipLabel} é de 1 dia a partir da data de ativação.`
    : `A validade real deste ${membershipLabel} é de ${validityDays} dias a partir da data de ativação.`;
}

export default async function SubscriptionsPage({
  searchParams: searchParamsPromise,
}: SubscriptionsPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);
  const supabase = createClient();
  const today = new Date().toISOString().slice(0, 10);

  const [
    offersResult,
    membershipsResult,
    servicesResult,
    membershipRequestsResult,
  ] = await Promise.all([
    supabase
      .from("salon_offers")
      .select(
        "id, title, description, highlight_text, image_path, membership_service_id, membership_sessions_included, membership_validity_days, price, starts_on, ends_on, is_active, sort_order",
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
    supabase
      .from("services")
      .select("id, name, category")
      .eq("salon_id", salon.id)
      .order("sort_order")
      .order("name"),
    (supabase as any)
      .from("customer_membership_requests")
      .select(
        "id, customer_id, offer_id, offer_title_snapshot, approved_starts_on, decided_at, membership_id, price_snapshot, notes, status, requested_at, customers(name)",
      )
      .eq("salon_id", salon.id)
      .or("status.eq.pending,and(status.eq.approved,membership_id.is.null)")
      .order("requested_at", { ascending: false }),
  ]);

  const offers = (offersResult.data ?? []) as MembershipOfferRow[];
  const memberships = (membershipsResult.data ?? []) as MembershipRecord[];
  const serviceOptions = (servicesResult.data ?? []) as ServiceOption[];
  const membershipRequests = (membershipRequestsResult.data ??
    []) as MembershipRequestRecord[];
  const pendingMembershipRequests = membershipRequests.filter(
    (request) => request.status === "pending",
  );
  const awaitingPaymentRequests = membershipRequests.filter(
    (request) =>
      request.status === "approved" &&
      !String(request.membership_id ?? "").trim(),
  );
  const serviceNameById = new Map(
    serviceOptions.map((service) => [
      service.id,
      service.category ? `${service.category} • ${service.name}` : service.name,
    ]),
  );
  const offerById = new Map(offers.map((offer) => [offer.id, offer]));

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
    const current = offerStats.get(membership.offer_id) ?? {
      active: 0,
      total: 0,
      projectedRevenue: 0,
    };
    const status = resolveMembershipStatus(membership, today);
    current.total += 1;
    if (status === "active") {
      current.active += 1;
      current.projectedRevenue += Number(membership.price_snapshot ?? 0);
    }
    offerStats.set(membership.offer_id, current);
  }

  const activeMemberships = memberships.filter(
    (membership) => resolveMembershipStatus(membership, today) === "active",
  );
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
    const diffInDays = Math.ceil(
      (expiration.getTime() - currentDay.getTime()) / 86_400_000,
    );

    return diffInDays >= 0 && diffInDays <= 7;
  });
  const projectedRevenue = activeMemberships.reduce(
    (sum, membership) => sum + Number(membership.price_snapshot ?? 0),
    0,
  );
  const averageTicket = activeMemberships.length
    ? projectedRevenue / activeMemberships.length
    : 0;
  const leadingOffer =
    [...offers]
      .sort(
        (left, right) =>
          (offerStats.get(right.id)?.active ?? 0) -
          (offerStats.get(left.id)?.active ?? 0),
      )
      .find((offer) => (offerStats.get(offer.id)?.active ?? 0) > 0) ??
    offers[0] ??
    null;
  const leadingOfferStats = leadingOffer
    ? (offerStats.get(leadingOffer.id) ?? null)
    : null;
  const nextMembershipToExpire =
    [...activeMemberships].sort((left, right) =>
      left.expires_at.localeCompare(right.expires_at),
    )[0] ?? null;
  const recentMemberships = memberships.slice(0, 12);

  return (
    <div className="page-grid workspace-page subscriptions-page subscriptions-simple">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

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
            note:
              configuredOffers.length === offers.length
                ? "Todos operacionais."
                : `${configuredOffers.length} completos para venda.`,
            tone: offers.length ? "soft" : "neutral",
          },
          {
            label: "Ticket médio",
            value: activeMemberships.length
              ? formatCurrency(averageTicket)
              : "Sem base",
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
            note: leadingOfferStats?.active
              ? `${leadingOfferStats.active} cliente${leadingOfferStats.active === 1 ? "" : "s"} ativo${leadingOfferStats.active === 1 ? "" : "s"}.`
              : "Publique o primeiro plano para começar.",
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
                <strong>
                  {nextMembershipToExpire
                    ? formatDate(nextMembershipToExpire.expires_at)
                    : "Sem alertas"}
                </strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Plano completo</span>
                <strong>
                  {configuredOffers.length}/{offers.length || 0}
                </strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos da recorrência"
        items={[
          {
            href: "#subscription-requests",
            label: "Pedidos do app",
            meta: "Aprovar pedido",
          },
          {
            href: "#subscription-payments",
            label: "Pagamentos",
            meta: "Ativar no app",
          },
          {
            href: "#subscription-catalog",
            label: "Catálogo",
            meta: "Planos ativos e edição",
          },
          {
            href: "#subscription-create",
            label: "Novo plano",
            meta: "Criar plano ou pacote",
          },
          {
            href: "#subscription-base",
            label: "Carteira",
            meta: "Clientes e saldo",
          },
        ]}
      />

      <section
        className="workspace-subgrid subscriptions-page__summary-grid"
        aria-label="Resumo comercial da recorrência"
      >
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Catálogo pronto</span>
          <h3>
            {configuredOffers.length} plano
            {configuredOffers.length === 1 ? "" : "s"} operacional
            {configuredOffers.length === 1 ? "" : "is"}
          </h3>
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

      <section id="subscription-requests" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Pedidos vindos do app do cliente</h2>
            <p className="muted">
              Aprove com a data real de início. O plano só entra no app quando
              o salão confirmar o pagamento.
            </p>
          </div>
        </div>

        {!pendingMembershipRequests.length ? (
          <EmptyStateCard
            eyebrow="Fila vazia"
            title="Nenhum pedido pendente agora"
            description="Quando uma cliente pedir um plano ou pacote pelo app, a aprovação aparece aqui e também na home do painel."
          />
        ) : (
          <div className="simple-list">
            {pendingMembershipRequests.map((request) => {
              const customer = firstRelation(request.customers);
              const offer = offerById.get(request.offer_id) ?? null;
              const activationGuidance = formatMembershipActivationGuidance(
                offer?.membership_validity_days ?? null,
              );
              const parsedNotes = parseMembershipRequestPreferredScheduleNotes(
                request.notes,
              );
              const requestNote = parsedNotes.notes?.trim();

              return (
                <article key={request.id} className="simple-row">
                  <div
                    className="inline-actions"
                    style={{ marginBottom: 6, flexWrap: "wrap" }}
                  >
                    <span className="badge badge--pending">Pedido do app</span>
                    <span className="badge badge--soft">
                      {customer?.name ?? "Cliente sem nome"}
                    </span>
                    <span className="badge badge--soft">
                      {formatDate(request.requested_at)}
                    </span>
                  </div>
                  <h3>{request.offer_title_snapshot}</h3>
                  <p className="muted">
                    {request.price_snapshot == null
                      ? "Pedido feito no app do cliente."
                      : `${formatCurrency(Number(request.price_snapshot))} • pedido feito no app do cliente.`}
                  </p>
                  <p className="list-meta">{activationGuidance}</p>
                  <small className="list-meta">
                    {requestNote
                      ? `Mensagem da cliente: ${requestNote}`
                      : "Sem observação enviada pela cliente."}
                  </small>
                  <div
                    className="simple-row__actions"
                    style={{ flexWrap: "wrap", gap: 12 }}
                  >
                    <form
                      action={approveCustomerMembershipRequestAction}
                      className="simple-form"
                      style={{ marginTop: 0 }}
                    >
                      <input
                        type="hidden"
                        name="returnPath"
                        value="/dashboard/subscriptions"
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <div className="field">
                        <label
                          htmlFor={`membership-request-start-${request.id}`}
                        >
                          Início real da assinatura
                        </label>
                        <input
                          id={`membership-request-start-${request.id}`}
                          name="startsOn"
                          type="date"
                          defaultValue={today}
                          required
                        />
                      </div>
                      <div className="row-actions">
                        <button type="submit" className="primary-button">
                          Aprovar e aguardar pagamento
                        </button>
                      </div>
                    </form>

                    <form action={rejectCustomerMembershipRequestAction}>
                      <input
                        type="hidden"
                        name="returnPath"
                        value="/dashboard/subscriptions"
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <button type="submit" className="secondary-button">
                        Recusar pedido
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="subscription-payments" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Planos aguardando pagamento</h2>
            <p className="muted">
              O plano só fica ativo no aplicativo depois que o salão marcar o
              pagamento como recebido.
            </p>
          </div>
        </div>

        {!awaitingPaymentRequests.length ? (
          <EmptyStateCard
            eyebrow="Sem pendência"
            title="Nenhum plano aguardando pagamento"
            description="Quando um pedido for aprovado e ainda faltar confirmação de pagamento, ele aparece aqui."
          />
        ) : (
          <div className="simple-list">
            {awaitingPaymentRequests.map((request) => {
              const customer = firstRelation(request.customers);
              const offer = offerById.get(request.offer_id) ?? null;
              const activationGuidance = formatMembershipActivationGuidance(
                offer?.membership_validity_days ?? null,
              );
              const parsedNotes = parseMembershipRequestPreferredScheduleNotes(
                request.notes,
              );
              const requestNote = parsedNotes.notes?.trim();

              return (
                <article key={request.id} className="simple-row">
                  <div
                    className="inline-actions"
                    style={{ marginBottom: 6, flexWrap: "wrap" }}
                  >
                    <span className="badge badge--pending">
                      Aguardando pagamento
                    </span>
                    <span className="badge badge--soft">
                      {customer?.name ?? "Cliente sem nome"}
                    </span>
                    <span className="badge badge--soft">
                      {request.decided_at
                        ? `Aprovado em ${formatDate(request.decided_at)}`
                        : formatDate(request.requested_at)}
                    </span>
                  </div>
                  <h3>{request.offer_title_snapshot}</h3>
                  <p className="muted">
                    {request.price_snapshot == null
                      ? "Pedido aprovado e aguardando confirmação de pagamento."
                      : `${formatCurrency(Number(request.price_snapshot))} • pedido aprovado e aguardando confirmação de pagamento.`}
                  </p>
                  <p className="list-meta">
                    {request.approved_starts_on
                      ? `Início programado: ${formatDate(request.approved_starts_on)} • ${activationGuidance}`
                      : activationGuidance}
                  </p>
                  <small className="list-meta">
                    {requestNote
                      ? `Mensagem da cliente: ${requestNote}`
                      : "Sem observação enviada pela cliente."}
                  </small>
                  <div
                    className="simple-row__actions"
                    style={{ flexWrap: "wrap", gap: 12 }}
                  >
                    <form
                      action={markCustomerMembershipRequestPaidAction}
                      className="simple-form"
                      style={{ marginTop: 0 }}
                    >
                      <input
                        type="hidden"
                        name="returnPath"
                        value="/dashboard/subscriptions"
                      />
                      <input
                        type="hidden"
                        name="requestId"
                        value={request.id}
                      />
                      <div className="row-actions">
                        <button type="submit" className="primary-button">
                          Marcar como pago e ativar
                        </button>
                      </div>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section id="subscription-catalog" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Planos do salão</h2>
            <p className="muted">
              Planos mensais e pacotes com edição simples. Pedidos feitos no app
              do cliente aparecem aqui e também na home do painel.
            </p>
          </div>
        </div>

        {!offers.length ? (
          <EmptyStateCard
            eyebrow="Sem planos"
            title="Crie o primeiro plano"
            description="Assim que um plano for publicado, ele aparece aqui."
          />
        ) : (
          <div className="simple-list">
            {offers.map((offer) => {
              const stats = offerStats.get(offer.id) ?? {
                active: 0,
                total: 0,
                projectedRevenue: 0,
              };
              const serviceName = offer.membership_service_id
                ? serviceNameById.get(offer.membership_service_id)
                : null;
              const isPopular =
                leadingOffer?.id === offer.id && stats.active > 0;

              return (
                <article key={offer.id} className="simple-row">
                  <div
                    className="inline-actions"
                    style={{ marginBottom: 6, flexWrap: "wrap" }}
                  >
                    <span
                      className={
                        offer.is_active
                          ? "badge badge--confirmed"
                          : "badge badge--soft"
                      }
                    >
                      {offer.is_active ? "Ativo" : "Pausado"}
                    </span>
                    <span className="badge badge--soft">
                      {resolveMembershipOfferLabel(
                        offer.membership_validity_days,
                      )}
                    </span>
                    {isPopular ? (
                      <span className="badge badge--pending">Mais vendido</span>
                    ) : null}
                    <span className="badge badge--soft">
                      Ordem {offer.sort_order}
                    </span>
                  </div>
                  <h3>{offer.title}</h3>
                  <p className="muted">
                    {offer.highlight_text?.trim() ||
                      formatOperationalSummary(offer, serviceName)}
                  </p>
                  <p className="list-meta">
                    {offer.price == null
                      ? "Sob consulta"
                      : formatCurrency(Number(offer.price))}{" "}
                    • {formatOperationalSummary(offer, serviceName)}
                  </p>
                  <p className="list-meta">
                    {stats.active} ativo{stats.active === 1 ? "" : "s"} •{" "}
                    {stats.total} vendido{stats.total === 1 ? "" : "s"}
                    {offer.starts_on
                      ? ` • vigência de ${formatDate(offer.starts_on)}`
                      : ""}{" "}
                    {offer.ends_on ? ` até ${formatDate(offer.ends_on)}` : ""}
                  </p>

                  <details className="accordion" style={{ marginTop: 12 }}>
                    <summary>
                      <span>Editar plano</span>
                      <span className="accordion__cta">ajustar</span>
                    </summary>
                    <form
                      action={updateSalonOfferAction}
                      className="simple-form"
                      style={{ marginTop: 10 }}
                      encType="multipart/form-data"
                    >
                      <input
                        type="hidden"
                        name="returnPath"
                        value="/dashboard/subscriptions"
                      />
                      <input type="hidden" name="offerId" value={offer.id} />
                      <input type="hidden" name="kind" value="membership" />

                      <div className="field">
                        <label htmlFor={`subscription-title-${offer.id}`}>
                          Título
                        </label>
                        <input
                          id={`subscription-title-${offer.id}`}
                          name="title"
                          defaultValue={offer.title}
                          required
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`subscription-highlight-${offer.id}`}>
                          Chamada
                        </label>
                        <input
                          id={`subscription-highlight-${offer.id}`}
                          name="highlightText"
                          defaultValue={offer.highlight_text ?? ""}
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`subscription-description-${offer.id}`}>
                          Descrição
                        </label>
                        <textarea
                          id={`subscription-description-${offer.id}`}
                          name="description"
                          rows={3}
                          defaultValue={offer.description ?? ""}
                        />
                      </div>

                      <div className="field">
                        <label htmlFor={`subscription-image-${offer.id}`}>
                          Foto da assinatura
                        </label>
                        <input
                          id={`subscription-image-${offer.id}`}
                          name="offerImage"
                          type="file"
                          accept="image/png,image/jpeg,image/webp"
                        />
                        <small className="muted">
                          Opcional. JPG, PNG ou WEBP. Aparece na home do app.
                        </small>
                        {offer.image_path ? (
                          <label
                            className="checkbox-field"
                            style={{ marginTop: 10 }}
                          >
                            <input type="checkbox" name="removeImage" />
                            Remover foto atual da home
                          </label>
                        ) : (
                          <small className="muted">
                            Sem foto cadastrada ainda.
                          </small>
                        )}
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-price-${offer.id}`}>
                            Valor
                          </label>
                          <input
                            id={`subscription-price-${offer.id}`}
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={
                              offer.price == null ? "" : Number(offer.price)
                            }
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`subscription-order-${offer.id}`}>
                            Ordem
                          </label>
                          <input
                            id={`subscription-order-${offer.id}`}
                            name="sortOrder"
                            type="number"
                            min="0"
                            step="1"
                            defaultValue={offer.sort_order}
                            required
                          />
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-service-${offer.id}`}>
                            Serviço
                          </label>
                          <select
                            id={`subscription-service-${offer.id}`}
                            name="membershipServiceId"
                            defaultValue={offer.membership_service_id ?? ""}
                          >
                            <option value="">Selecione</option>
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
                          <label htmlFor={`subscription-sessions-${offer.id}`}>
                            Sessões
                          </label>
                          <input
                            id={`subscription-sessions-${offer.id}`}
                            name="membershipSessionsIncluded"
                            type="number"
                            min="1"
                            step="1"
                            defaultValue={
                              offer.membership_sessions_included ?? ""
                            }
                            required
                          />
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-validity-${offer.id}`}>
                            Validade (dias)
                          </label>
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
                          <label
                            className="checkbox-field"
                            style={{ marginTop: 10 }}
                          >
                            <input
                              type="checkbox"
                              name="isActive"
                              defaultChecked={offer.is_active}
                            />
                            Plano visível
                          </label>
                        </div>
                      </div>

                      <div className="split-grid">
                        <div className="field">
                          <label htmlFor={`subscription-start-${offer.id}`}>
                            Válido a partir de
                          </label>
                          <input
                            id={`subscription-start-${offer.id}`}
                            name="startsOn"
                            type="date"
                            defaultValue={offer.starts_on ?? ""}
                          />
                        </div>
                        <div className="field">
                          <label htmlFor={`subscription-end-${offer.id}`}>
                            Válido até
                          </label>
                          <input
                            id={`subscription-end-${offer.id}`}
                            name="endsOn"
                            type="date"
                            defaultValue={offer.ends_on ?? ""}
                          />
                        </div>
                      </div>

                      <div
                        className="simple-row__actions"
                        style={{ flexWrap: "wrap" }}
                      >
                        <button type="submit" className="secondary-button">
                          Salvar plano
                        </button>
                      </div>
                    </form>
                    <form
                      action={deleteSalonOfferAction}
                      style={{ marginTop: 8 }}
                    >
                      <input
                        type="hidden"
                        name="returnPath"
                        value="/dashboard/subscriptions"
                      />
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
            <p className="muted">
              Cadastre rapidamente um novo plano ou pacote.
            </p>
          </div>
        </div>

        <form
          action={createSalonOfferAction}
          className="simple-form"
          encType="multipart/form-data"
        >
          <input
            type="hidden"
            name="returnPath"
            value="/dashboard/subscriptions"
          />
          <input type="hidden" name="kind" value="membership" />

          <div className="field">
            <label htmlFor="subscription-title">Título</label>
            <input
              id="subscription-title"
              name="title"
              placeholder="Ex.: Clube mensal de hidratação"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="subscription-highlight">Chamada</label>
            <input
              id="subscription-highlight"
              name="highlightText"
              placeholder="Ex.: 2 hidratações por mês com preço fixo"
            />
          </div>

          <div className="field">
            <label htmlFor="subscription-description">Descrição</label>
            <textarea
              id="subscription-description"
              name="description"
              rows={3}
              placeholder="Explique o que entra no plano."
            />
          </div>

          <div className="field">
            <label htmlFor="subscription-image">Foto da assinatura</label>
            <input
              id="subscription-image"
              name="offerImage"
              type="file"
              accept="image/png,image/jpeg,image/webp"
            />
            <small className="muted">
              Opcional. JPG, PNG ou WEBP. Aparece na home do app.
            </small>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-price">Valor</label>
              <input
                id="subscription-price"
                name="price"
                type="number"
                min="0"
                step="0.01"
                placeholder="149.90"
              />
            </div>
            <div className="field">
              <label htmlFor="subscription-order">Ordem</label>
              <input
                id="subscription-order"
                name="sortOrder"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                required
              />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-service">Serviço vinculado</label>
              <select
                id="subscription-service"
                name="membershipServiceId"
                defaultValue=""
              >
                <option value="">Selecione</option>
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
              <label htmlFor="subscription-sessions">Sessões incluídas</label>
              <input
                id="subscription-sessions"
                name="membershipSessionsIncluded"
                type="number"
                min="1"
                step="1"
                placeholder="2"
                required
              />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="subscription-validity">Validade em dias</label>
              <input
                id="subscription-validity"
                name="membershipValidityDays"
                type="number"
                min="1"
                step="1"
                placeholder="30"
                required
              />
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
            <EmptyStateCard
              eyebrow="Sem clientes ainda"
              title="A base aparece aqui"
              description="Quando vender planos, os clientes ficam nesta lista."
            />
          ) : (
            recentMemberships.map((membership) => {
              const membershipStatus = resolveMembershipStatus(
                membership,
                today,
              );
              const customer = firstRelation(membership.customers);
              const remainingSessions = Math.max(
                membership.sessions_included - membership.sessions_used,
                0,
              );

              return (
                <article key={membership.id} className="simple-row">
                  <div
                    className="inline-actions"
                    style={{ marginBottom: 6, flexWrap: "wrap" }}
                  >
                    <span className={membershipStatusBadge(membershipStatus)}>
                      {membershipStatusLabel(membershipStatus)}
                    </span>
                    {customer?.name ? (
                      <span className="badge badge--soft">{customer.name}</span>
                    ) : null}
                  </div>
                  <h3>{membership.title}</h3>
                  <p className="muted">
                    {membership.service_name_snapshot} • {remainingSessions}{" "}
                    restante{remainingSessions === 1 ? "" : "s"}
                  </p>
                  <small className="list-meta">
                    Iniciado em {formatDate(membership.started_at)} • até{" "}
                    {formatDate(membership.expires_at)}.
                    {membership.price_snapshot != null
                      ? ` ${formatCurrency(Number(membership.price_snapshot))}.`
                      : ""}
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
