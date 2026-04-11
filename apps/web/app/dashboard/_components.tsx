import Link from "next/link";

import { EmptyStateCard } from "@/components/EmptyStateCard";
import { MANAGEMENT_ROUTES } from "@/lib/management-navigation";

import type { DashboardHomeData } from "./_lib";

type DashboardHomeContentProps = {
  data: DashboardHomeData;
};

export function DashboardHomeContent({ data }: DashboardHomeContentProps) {
  return (
    <>
      <DashboardHero
        salonName={data.salonName}
        customerGrowth={data.customerGrowth}
        finance={data.finance}
        agenda={data.agenda}
        attentionCount={data.attentionItems.length}
      />
      <DashboardSignalStrip signals={data.signals} />

      <section className="dashboard-reference-grid dashboard-reference-grid--simple dashboard-reference-grid--home">
        <DashboardGrowthPanel customerGrowth={data.customerGrowth} />
        <DashboardAgendaPanel agenda={data.agenda} />
        <DashboardFinancePanel finance={data.finance} />
        <DashboardAttentionPanel attentionItems={data.attentionItems} />
      </section>
    </>
  );
}

function DashboardHero({
  salonName,
  customerGrowth,
  finance,
  agenda,
  attentionCount,
}: Pick<
  DashboardHomeData,
  "salonName" | "customerGrowth" | "finance" | "agenda"
> & { attentionCount: number }) {
  const attentionLabel = attentionCount
    ? `${attentionCount} ponto(s) pedem atenção`
    : "Sem alertas críticos agora";

  return (
    <section className="dashboard-home-hero">
      <div className="dashboard-home-hero__copy">
        <div className="dashboard-home-hero__kicker">
          <p className="eyebrow">Painel</p>
          <span className="dashboard-home-hero__live">Leitura ao vivo</span>
        </div>
        <h1>{salonName}</h1>
        <p className="muted">
          A primeira leitura do salão com visão rápida, comercial e operacional,
          pronta para quem abre o dia e precisa decidir sem ruído.
        </p>

        <div className="dashboard-home-hero__status-row">
          <span className="dashboard-home-hero__status">{agenda.dateLabel}</span>
          <span className="dashboard-home-hero__status">
            {agenda.items.length} horário(s) no dia
          </span>
          <span className="dashboard-home-hero__status dashboard-home-hero__status--alert">
            {attentionLabel}
          </span>
        </div>

        <div className="dashboard-home-hero__metrics">
          <article className="dashboard-home-hero__metric">
            <span>Clientes ativas</span>
            <strong>{customerGrowth.activeCustomersLast30d}</strong>
            <small>Clientes com atendimento concluido.</small>
          </article>

          <article className="dashboard-home-hero__metric">
            <span>Entradas recentes</span>
            <strong>{customerGrowth.newCustomersThisMonth}</strong>
            <small>Entradas recentes na carteira.</small>
          </article>

          <article className="dashboard-home-hero__metric">
            <span>Ticket do mes</span>
            <strong>{finance.averageTicketLabel}</strong>
            <small>Media dos atendimentos concluidos.</small>
          </article>
        </div>
      </div>

      <aside className="dashboard-home-hero__focus">
        <span className="dashboard-home-hero__focus-label">
          Ritmo da carteira
        </span>
        <strong>{`Ritmo ${customerGrowth.monthlyDeltaLabel}`}</strong>
        <p>
          {customerGrowth.hasPreviousBaseline
            ? "Variação do fechamento mais recente comparada ao mês anterior."
            : "Base mensal ainda em formação, com espaço para acelerar a entrada."}
        </p>

        <div className="dashboard-home-hero__focus-grid">
          <article className="dashboard-home-hero__focus-tile">
            <span>Entradas no mês</span>
            <strong>{customerGrowth.newCustomersThisMonth}</strong>
            <small>Novas clientes cadastradas.</small>
          </article>

          <article className="dashboard-home-hero__focus-tile">
            <span>Ativas em 30d</span>
            <strong>{customerGrowth.activeCustomersLast30d}</strong>
            <small>Carteira recente em movimento.</small>
          </article>

          <article className="dashboard-home-hero__focus-tile">
            <span>Atenção hoje</span>
            <strong>{attentionCount}</strong>
            <small>Itens que merecem acompanhamento.</small>
          </article>
        </div>

        <div className="dashboard-home-hero__focus-band">
          <div>
            <span>Carteira total</span>
            <strong>{customerGrowth.totalCustomers}</strong>
          </div>
          <div>
            <span>Media por atendimento</span>
            <strong>{finance.averageTicketLabel}</strong>
          </div>
        </div>
      </aside>
    </section>
  );
}

function DashboardSignalStrip({
  signals,
}: Pick<DashboardHomeData, "signals">) {
  return (
    <section
      className="dashboard-signal-strip dashboard-signal-strip--compact"
      aria-label="Resumo do dia"
    >
      {signals.map((signal) => (
        <article
          key={signal.label}
          className={`dashboard-signal-card dashboard-signal-card--${signal.tone}`}
        >
          <div className="dashboard-signal-card__header">
            <span>{signal.label}</span>
            <span
              className="dashboard-signal-card__pulse"
              aria-hidden="true"
            />
          </div>
          <strong>{signal.value}</strong>
          <small>{signal.note}</small>
        </article>
      ))}
    </section>
  );
}

function DashboardGrowthPanel({
  customerGrowth,
}: {
  customerGrowth: DashboardHomeData["customerGrowth"];
}) {
  const chartPeak = Math.max(
    ...customerGrowth.series.map((item) => item.count),
    1,
  );
  const chartAverage = Math.round(
    customerGrowth.series.reduce((total, item) => total + item.count, 0) /
      Math.max(customerGrowth.series.length, 1),
  );
  const chartGuides = Array.from(
    new Set([
      chartPeak,
      Math.max(1, Math.round(chartPeak * 0.66)),
      Math.max(1, Math.round(chartPeak * 0.33)),
      0,
    ]),
  ).sort((left, right) => right - left);
  const currentItem =
    customerGrowth.series[customerGrowth.series.length - 1] ?? null;
  const bestMonth =
    customerGrowth.series.reduce<(typeof customerGrowth.series)[number] | null>(
      (currentBest, item) => {
        if (!currentBest || item.count > currentBest.count) {
          return item;
        }

        return currentBest;
      },
      null,
    ) ?? currentItem;

  return (
    <article className="card content-card dashboard-panel dashboard-panel--growth">
      <div className="dashboard-panel__header">
        <div>
          <h2>Crescimento de clientes</h2>
          <p className="muted">
            Novas clientes entrando no salao e ritmo da base nos ultimos 6
            meses.
          </p>
        </div>
        <Link href={MANAGEMENT_ROUTES.clients} className="dashboard-panel__link">
          Abrir clientes
        </Link>
      </div>

      <div className="dashboard-growth-summary">
        <article className="dashboard-growth-kpi">
          <span>Base total</span>
          <strong>{customerGrowth.totalCustomers}</strong>
          <small>Clientes cadastradas no salao.</small>
        </article>

        <article className="dashboard-growth-kpi">
          <span>Novas no mes</span>
          <strong>{customerGrowth.newCustomersThisMonth}</strong>
          <small>Entradas mais recentes da carteira.</small>
        </article>

        <article className="dashboard-growth-kpi">
          <span>Ativas 30d</span>
          <strong>{customerGrowth.activeCustomersLast30d}</strong>
          <small>Clientes com atendimento concluido.</small>
        </article>

        <article className="dashboard-growth-kpi">
          <span>Vs mes anterior</span>
          <strong>{customerGrowth.monthlyDeltaLabel}</strong>
          <small>
            {customerGrowth.hasPreviousBaseline
              ? "Comparativo de novas clientes."
              : "Sem base anterior relevante."}
          </small>
        </article>
      </div>

      <div className="dashboard-chart dashboard-chart--customer-growth">
        <div className="dashboard-chart__heading">
          <h3>Entrada de clientes</h3>
          <small>Leitura comercial dos ultimos 6 meses do salao.</small>
        </div>

        <div className="dashboard-chart__summary">
          <span className="dashboard-chart__tag">
            Pico do periodo: {chartPeak} cliente(s)
          </span>
          <span className="dashboard-chart__tag dashboard-chart__tag--accent">
            {customerGrowth.monthlyDeltaLabel} no fechamento mais recente
          </span>
        </div>

        <div className="dashboard-chart__insights">
          <article className="dashboard-chart__insight">
            <span>Mês atual</span>
            <strong>{currentItem?.count ?? 0}</strong>
            <small>{currentItem ? currentItem.label : "Sem leitura recente"}</small>
          </article>

          <article className="dashboard-chart__insight">
            <span>Média 6 meses</span>
            <strong>{chartAverage}</strong>
            <small>Entrada média da base.</small>
          </article>

          <article className="dashboard-chart__insight">
            <span>Melhor mês</span>
            <strong>{bestMonth?.count ?? 0}</strong>
            <small>{bestMonth ? bestMonth.label : "Sem referência"}</small>
          </article>
        </div>

        <div className="dashboard-chart__frame">
          <div className="dashboard-chart__axis" aria-hidden="true">
            {chartGuides.map((level) => (
              <span key={level}>{level}</span>
            ))}
          </div>

          <div className="dashboard-chart__plot">
            <div
              className="dashboard-chart__bars"
              style={{
                gridTemplateColumns: `repeat(${customerGrowth.series.length}, minmax(0, 1fr))`,
              }}
            >
              {customerGrowth.series.map((item, index) => (
                <div
                  key={item.key}
                  className={`dashboard-chart__item${index === customerGrowth.series.length - 1 ? " dashboard-chart__item--current" : ""}`}
                >
                  <strong className="dashboard-chart__value">{item.count}</strong>
                  <div className="dashboard-chart__bar-shell">
                    <span
                      className="dashboard-chart__bar"
                      style={{ height: `${item.height}px` }}
                    >
                      <span className="dashboard-chart__bar-cap" />
                    </span>
                  </div>
                  <span className="dashboard-chart__label">{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="dashboard-chart__footer">
          <article className="dashboard-chart__footer-card">
            <span>Carteira cadastrada</span>
            <strong>{customerGrowth.totalCustomers}</strong>
            <small>Clientes cadastradas no salao.</small>
          </article>

          <article className="dashboard-chart__footer-card">
            <span>Mes atual</span>
            <strong>{currentItem?.count ?? 0}</strong>
            <small>
              {currentItem
                ? `Fechamento de ${currentItem.label}.`
                : "Sem leitura recente."}
            </small>
          </article>
        </div>
      </div>
    </article>
  );
}

function DashboardAgendaPanel({
  agenda,
}: {
  agenda: DashboardHomeData["agenda"];
}) {
  return (
    <article className="card content-card dashboard-panel dashboard-panel--agenda">
      <div className="dashboard-panel__header">
        <h2>Agenda do dia</h2>
        <Link href={MANAGEMENT_ROUTES.appointments} className="dashboard-panel__link">
          {agenda.dateLabel}
        </Link>
      </div>

      <div className="dashboard-agenda-list">
        {!agenda.items.length ? (
          <div className="dashboard-empty">
            Nenhum horario hoje. Abra a agenda para preencher a operacao.
          </div>
        ) : (
          agenda.items.map((appointment) => (
            <div key={appointment.id} className="dashboard-agenda-item">
              <div className="dashboard-agenda-item__content">
                <strong className="dashboard-agenda-item__time">
                  {appointment.timeLabel}
                </strong>
                <span className="dashboard-agenda-item__separator">-</span>
                <strong>{appointment.serviceName}</strong>
                <span>{appointment.customerLine}</span>
              </div>

              {appointment.isPending ? (
                <span className="dashboard-agenda-item__flag" />
              ) : null}
            </div>
          ))
        )}
      </div>
    </article>
  );
}

function DashboardFinancePanel({
  finance,
}: {
  finance: DashboardHomeData["finance"];
}) {
  return (
    <article className="card content-card dashboard-panel dashboard-panel--finance">
      <div className="dashboard-panel__header">
        <h2>Financeiro rapido</h2>
        <Link href="/dashboard/finance" className="dashboard-panel__link">
          Abrir caixa
        </Link>
      </div>

      <div className="dashboard-finance-list">
        <div className="dashboard-finance-row">
          <div>
            <span>Hoje previsto</span>
            <small>{finance.todayAppointmentsCount} horario(s)</small>
          </div>
          <strong>{finance.todayRevenueLabel}</strong>
        </div>

        <div className="dashboard-finance-row">
          <div>
            <span>Concluidos no mes</span>
            <small>Atendimentos fechados no caixa</small>
          </div>
          <strong>{finance.monthCompletedAppointmentsCount}</strong>
        </div>

        <div className="dashboard-finance-row">
          <div>
            <span>Comandas abertas</span>
            <small>
              {finance.openTabsCount
                ? `${finance.openTabsPendingLabel} em aberto`
                : "Nenhuma comanda aberta agora"}
            </small>
          </div>
          <strong>{finance.openTabsCount}</strong>
        </div>

        <div className="dashboard-finance-row dashboard-finance-row--accent">
          <div>
            <span>Ticket medio</span>
            <small>Media do mes</small>
          </div>
          <strong>{finance.averageTicketLabel}</strong>
        </div>
      </div>
    </article>
  );
}

function DashboardAttentionPanel({
  attentionItems,
}: {
  attentionItems: DashboardHomeData["attentionItems"];
}) {
  return (
    <article className="card content-card dashboard-panel dashboard-panel--attention">
      <div className="dashboard-panel__header">
        <h2>Hoje precisa de atencao</h2>
      </div>

      {attentionItems.length ? (
        <div className="simple-list" style={{ padding: "14px 18px 16px" }}>
          {attentionItems.map((item) => (
            <article key={item.label} className="simple-row">
              <h3>{item.label}</h3>
              <p className="muted">{item.description}</p>
              <div className="simple-row__actions">
                <Link href={item.href} className="secondary-button">
                  Abrir
                </Link>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Tudo em ordem"
          title="Nenhum alerta importante agora"
          description="Voce pode seguir a operacao normalmente."
        />
      )}
    </article>
  );
}
