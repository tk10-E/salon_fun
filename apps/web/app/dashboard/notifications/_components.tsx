import Link from "next/link";

import { deleteSalonNotificationAction } from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";

import {
  badgeClassForCategory,
  badgeClassForDispatchStatus,
  formatAudienceLabel,
  formatCategoryLabel,
  formatDispatchStatus,
} from "./shared";
import type { NotificationsPageData } from "./_lib";

type NotificationsPageContentProps = {
  data: NotificationsPageData;
};

export function NotificationsPageContent({
  data,
}: NotificationsPageContentProps) {
  return (
    <>
      <NotificationsHeader header={data.header} />
      <NotificationsInternalAlertsSection alerts={data.internalAlerts} />
      <NotificationsFilterSection filters={data.filters} />
      <NotificationsHistorySection history={data.history} />
    </>
  );
}

function NotificationsHeader({
  header,
}: {
  header: NotificationsPageData["header"];
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Lembretes</p>
        <h1>Lembretes e avisos do salão</h1>
        <p className="muted">Filtre, exporte e revise sem poluição visual.</p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            {header.totalCount} aviso{header.totalCount === 1 ? "" : "s"}
          </span>
          <span className="badge badge--success">
            {header.deliveredOnPageCount} entregues nesta página
          </span>
          <span
            className={
              header.issueOnPageCount > 0
                ? "badge badge--cancelled"
                : "badge badge--soft"
            }
          >
            {header.issueOnPageCount} com problema
          </span>
          <span className="badge badge--soft">
            {header.activePushTokensCount} clientes com app ativo
          </span>
          <span className="badge badge--soft">
            {header.recentPushTokensCount} ativos recentemente
          </span>
        </div>
      </div>

      <div
        className="simple-row__actions"
        style={{ justifyContent: "flex-end", flexWrap: "wrap" }}
      >
        <Link href={header.exportHref} className="secondary-button">
          Exportar CSV
        </Link>
        <Link href="/dashboard/benefits/automations" className="secondary-button">
          Retenção
        </Link>
        <Link href="/dashboard/settings" className="secondary-button">
          Ajustes do app
        </Link>
      </div>
    </header>
  );
}

function NotificationsInternalAlertsSection({
  alerts,
}: {
  alerts: NotificationsPageData["internalAlerts"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Alertas internos do salão</h2>
          <p className="muted">
            Leitura operacional em tempo real para agenda, loja, comandas, estoque e financeiro.
          </p>
        </div>
        <div className="inline-actions" style={{ flexWrap: "wrap" }}>
          <span
            className={
              alerts.operationalCount > 0
                ? "badge badge--pending"
                : "badge badge--soft"
            }
          >
            {alerts.operationalCount} operação pedindo ação
          </span>
          <span
            className={
              alerts.lowStockCount > 0
                ? "badge badge--pending"
                : "badge badge--soft"
            }
          >
            {alerts.lowStockCount} estoque baixo
          </span>
          <span
            className={
              alerts.dueFinancialCount > 0
                ? "badge badge--cancelled"
                : "badge badge--soft"
            }
          >
            {alerts.dueFinancialCount} financeiro em alerta
          </span>
        </div>
      </div>

      {!alerts.items.length ? (
        <EmptyStateCard
          eyebrow="Tudo em ordem"
          title="Nenhum alerta interno agora"
          description="Quando estoque ou financeiro pedirem atenção, eles aparecem aqui."
        />
      ) : (
        <div className="simple-list">
          {alerts.items.map((item) => (
            <article key={item.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span
                  className={
                    item.tone === "danger"
                      ? "badge badge--cancelled"
                      : "badge badge--pending"
                  }
                >
                  {item.label}
                </span>
                <span className="badge badge--soft">
                  {item.tone === "danger" ? "Ação urgente" : "Acompanhar agora"}
                </span>
              </div>

              <h3>{item.title}</h3>
              <p className="muted">{item.body}</p>

              <div className="simple-row__actions" style={{ marginTop: 8 }}>
                <Link href={item.href} className="secondary-button">
                  Abrir área
                </Link>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function NotificationsFilterSection({
  filters,
}: {
  filters: NotificationsPageData["filters"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Filtro rápido</h2>
          <p className="muted">{filters.filterSummary}</p>
        </div>
        <span className="badge badge--soft">
          Página {filters.safePage} de {filters.totalPages} • {filters.startItem}-
          {filters.endItem}
        </span>
      </div>

      <form method="get" className="simple-filter">
        <div className="field">
          <label htmlFor="notifications-search">Buscar</label>
          <input
            id="notifications-search"
            name="q"
            placeholder="Título ou texto"
            defaultValue={filters.q}
          />
        </div>

        <div className="field">
          <label htmlFor="notifications-audience">Público</label>
          <select
            id="notifications-audience"
            name="audience"
            defaultValue={filters.audienceFilter}
          >
            <option value="">Todos</option>
            <option value="salon_customers">Todos os clientes</option>
            <option value="single_customer">Cliente específico</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="notifications-category">Tipo</label>
          <select
            id="notifications-category"
            name="category"
            defaultValue={filters.categoryFilter}
          >
            <option value="">Todos</option>
            <option value="promotion">Promoções</option>
            <option value="growth">Recuperação</option>
            <option value="appointment">Agendamentos</option>
            <option value="referral">Indicações</option>
            <option value="service">Serviços</option>
            <option value="feed">Feed</option>
            <option value="other">Outros avisos</option>
          </select>
        </div>

        <div className="field">
          <label htmlFor="notifications-date-from">De</label>
          <input
            id="notifications-date-from"
            name="dateFrom"
            type="date"
            defaultValue={filters.dateFrom}
          />
        </div>

        <div className="field">
          <label htmlFor="notifications-date-to">Até</label>
          <input
            id="notifications-date-to"
            name="dateTo"
            type="date"
            defaultValue={filters.dateTo}
          />
        </div>

        <input type="hidden" name="page" value="1" />

        <button type="submit" className="primary-button">
          Aplicar filtro
        </button>
        {filters.showClear ? (
          <a href={filters.clearHref} className="secondary-button">
            Limpar
          </a>
        ) : null}
      </form>
    </section>
  );
}

function NotificationsHistorySection({
  history,
}: {
  history: NotificationsPageData["history"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Histórico</h2>
          <p className="muted">Avisos enviados com status e destino.</p>
        </div>
      </div>

      {!history.items.length ? (
        <EmptyStateCard
          eyebrow="Nenhum aviso"
          title="Nada nesse recorte"
          description="Ajuste o filtro ou aguarde novos disparos."
        />
      ) : (
        <form action={deleteSalonNotificationAction}>
          <input
            type="hidden"
            name="returnPathCurrent"
            value={history.currentPagePath}
          />
          <input
            type="hidden"
            name="returnPathPrevious"
            value={history.previousPagePath}
          />
          <input
            type="hidden"
            name="pageItemCount"
            value={String(history.items.length)}
          />
          <div className="simple-list">
            {history.items.map((notification) => (
              <article key={notification.id} className="simple-row">
                <div
                  className="inline-actions"
                  style={{ marginBottom: 6, flexWrap: "wrap" }}
                >
                  <span className={badgeClassForCategory(notification.category)}>
                    {formatCategoryLabel(notification.category)}
                  </span>
                  <span className="badge badge--soft">
                    {formatAudienceLabel(notification.audience)}
                  </span>
                  <span
                    className={badgeClassForDispatchStatus(
                      notification.dispatchStatus,
                    )}
                  >
                    {formatDispatchStatus(notification.dispatchStatus)}
                  </span>
                  <span className="badge badge--soft">
                    {notification.createdAtLabel}
                  </span>
                </div>

                <h3>{notification.title}</h3>
                <p className="muted">{notification.body}</p>
                <small className="list-meta">
                  Destino: {notification.destinationLabel}
                  {notification.sentCount != null
                    ? ` • enviados ${notification.sentCount}`
                    : ""}
                  {notification.failedCount != null
                    ? ` • falhas ${notification.failedCount}`
                    : ""}
                </small>

                <div className="simple-row__actions" style={{ marginTop: 8 }}>
                  <button
                    type="submit"
                    name="singleDeleteId"
                    value={notification.id}
                    className="danger-button"
                  >
                    Excluir aviso
                  </button>
                </div>
              </article>
            ))}
          </div>
        </form>
      )}

      {history.pageLinks.length > 1 ? (
        <nav className="notifications-pagination" aria-label="Paginação dos avisos">
          <div className="notifications-pagination__summary">{history.summary}</div>

          <div className="notifications-pagination__links">
            {history.previousPageHref ? (
              <Link href={history.previousPageHref} className="secondary-button">
                Anterior
              </Link>
            ) : null}

            {history.pageLinks.map((pageLink) => (
              <Link
                key={pageLink.href}
                href={pageLink.href}
                className={`secondary-button${pageLink.isActive ? " notifications-pagination__link--active" : ""}`}
              >
                {pageLink.label}
              </Link>
            ))}

            {history.nextPageHref ? (
              <Link href={history.nextPageHref} className="secondary-button">
                Próxima
              </Link>
            ) : null}
          </div>
        </nav>
      ) : null}
    </section>
  );
}
