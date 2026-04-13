import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import {
  deleteManagementPaymentAction,
  upsertManagementPaymentAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import {
  PAYMENT_METHOD_OPTIONS,
  buildFilterHref,
  formatDateTimeLabel,
  formatPaymentMethodLabel,
  formatTimeInput,
  getLocalDateKey,
  loadManagementPayments,
} from "@/lib/management";
import { formatCurrency } from "@/lib/formatters";

type PagamentosPageProps = {
  searchParams?: Promise<{
    dateFrom?: string;
    dateTo?: string;
    paymentMethod?: string;
    message?: string;
    tone?: string;
  }>;
};

export default async function PagamentosPage({
  searchParams: searchParamsPromise,
}: PagamentosPageProps) {
  const searchParams = await searchParamsPromise;
  const { salon } = await requireOwnerSalon();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const dateFrom = searchParams?.dateFrom ?? todayKey;
  const dateTo = searchParams?.dateTo ?? dateFrom;
  const paymentMethod = searchParams?.paymentMethod ?? "";
  const currentPath = buildFilterHref(
    "/dashboard/gestao/pagamentos",
    searchParams,
    {},
  );

  const data = await loadManagementPayments({
    salonId: salon.id,
    timeZone,
    dateFrom,
    dateTo,
    paymentMethod: paymentMethod || undefined,
  });
  const cardTotal =
    data.summary.byMethod.debit_card + data.summary.byMethod.credit_card;
  const averageTicket = data.items.length
    ? data.summary.totalReceived / data.items.length
    : 0;
  const topMethod = [
    { key: "pix", label: "Pix", value: data.summary.byMethod.pix },
    { key: "cash", label: "Dinheiro", value: data.summary.byMethod.cash },
    { key: "cards", label: "Cartões", value: cardTotal },
  ].sort((left, right) => right.value - left.value)[0];
  const latestPayment = data.items[0] ?? null;
  const highestPayment =
    [...data.items].sort((left, right) => right.amountNumber - left.amountNumber)[0] ?? null;
  const periodLabel =
    dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`;
  const methodLabel = paymentMethod
    ? PAYMENT_METHOD_OPTIONS.find((item) => item.value === paymentMethod)?.label ?? "Todas"
    : "Todas";

  return (
    <div className="page-grid workspace-page management-page management-page--payments">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        id="payments-overview"
        eyebrow="Recebimentos"
        title="Recebimentos com leitura clara de caixa."
        description="Recebimento, recorte do período e movimentações da operação em uma visão mais forte."
        highlight={{
          label: "Total recebido",
          value: formatCurrency(data.summary.totalReceived),
          note: data.items.length
            ? `${data.items.length} pagamento(s) no recorte atual com ticket médio de ${formatCurrency(averageTicket)}.`
            : "Sem movimento neste recorte. Registre um pagamento para começar a leitura.",
        }}
        signals={[
          {
            label: "Período",
            value: periodLabel,
            tone: "soft",
          },
          {
            label: "Forma",
            value: methodLabel,
            tone: paymentMethod ? "accent" : "soft",
          },
          {
            label: "Sem baixa",
            value: data.unpaidAppointments.length,
            tone: data.unpaidAppointments.length ? "warm" : "success",
          },
        ]}
        stats={[
          {
            label: "Pix",
            value: formatCurrency(data.summary.byMethod.pix),
            note: "Recebido via chave instantânea.",
            tone: data.summary.byMethod.pix ? "accent" : "soft",
          },
          {
            label: "Dinheiro",
            value: formatCurrency(data.summary.byMethod.cash),
            note: "Caixa físico no período.",
            tone: data.summary.byMethod.cash ? "warm" : "soft",
          },
          {
            label: "Cartões",
            value: formatCurrency(cardTotal),
            note: "Débito + crédito.",
            tone: cardTotal ? "success" : "soft",
          },
          {
            label: "Método forte",
            value: topMethod?.label ?? "Sem movimento",
            note: topMethod?.value
              ? `${formatCurrency(topMethod.value)} no recorte atual.`
              : "Assim que o caixa girar, o método líder aparece aqui.",
            tone: topMethod?.value ? "soft" : "neutral",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#payment-create" className="primary-button">
              Registrar pagamento
            </a>
            <a href="#payment-list" className="secondary-button">
              Ver caixa
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Leitura do movimento</span>
            <h3>{highestPayment ? formatCurrency(highestPayment.amountNumber) : "Sem caixa no período"}</h3>
            <p>
              {highestPayment
                ? `${highestPayment.customerName} em ${highestPayment.serviceName} com ${formatPaymentMethodLabel(highestPayment.payment_method)}.`
                : "Assim que o primeiro recebimento entrar, o maior valor do período aparece aqui."}
            </p>
            <div className="management-hero-pill-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Último recebimento</span>
                <strong>
                  {latestPayment
                    ? formatDateTimeLabel(latestPayment.paid_at, timeZone)
                    : "Sem movimento"}
                </strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Pendentes</span>
                <strong>{data.unpaidAppointments.length}</strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos do caixa"
        items={[
          { href: "#payment-create", label: "Registrar", meta: "Nova baixa" },
          { href: "#payment-filters", label: "Filtros", meta: "Período e método" },
          { href: "#payment-list", label: "Movimentações", meta: "Histórico do caixa" },
        ]}
      />

      <section className="workspace-subgrid management-summary-grid" aria-label="Resumo do caixa">
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Canal forte</span>
          <h3>{topMethod?.label ?? "Sem método dominante"}</h3>
          <p>
            {topMethod?.value
              ? `${formatCurrency(topMethod.value)} liderando o caixa neste recorte.`
              : "O método com maior volume aparece aqui quando houver movimentação."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Recebimentos pendentes</span>
          <h3>{data.unpaidAppointments.length} atendimento(s) sem baixa</h3>
          <p>
            {data.unpaidAppointments.length
              ? "Use o registro rápido para limpar o caixa e fechar o recorte do dia."
              : "Nenhum atendimento pendente de pagamento neste filtro."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Maior valor</span>
          <h3>{highestPayment ? formatCurrency(highestPayment.amountNumber) : "Sem leitura"}</h3>
          <p>
            {highestPayment
              ? `${highestPayment.customerName} gerou o maior recebimento do período.`
              : "Assim que o caixa receber pagamentos, o maior valor aparece aqui."}
          </p>
        </article>
      </section>

      <section className="management-grid management-grid--two">
        <article id="payment-create" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Registrar pagamento</h2>
              <p className="muted">Vincule o recebimento a um atendimento concluído.</p>
            </div>
          </div>

          <form action={upsertManagementPaymentAction} className="simple-form">
            <input type="hidden" name="returnPath" value={currentPath} />

            <div className="field">
              <label htmlFor="payment-appointment">Atendimento</label>
              <select id="payment-appointment" name="appointmentId" required>
                <option value="">Selecione</option>
                {data.unpaidAppointments.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                    {item.secondary ? ` • ${item.secondary}` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="payment-amount">Valor</label>
                <input
                  id="payment-amount"
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="payment-method">Forma de pagamento</label>
                <select id="payment-method" name="paymentMethod" required>
                  {PAYMENT_METHOD_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="payment-date">Data</label>
                <input
                  id="payment-date"
                  name="paidAtDate"
                  type="date"
                  defaultValue={todayKey}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="payment-time">Horário</label>
                <input
                  id="payment-time"
                  name="paidAtTime"
                  type="time"
                  defaultValue={formatTimeInput(new Date(), timeZone)}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="payment-notes">Observação</label>
              <textarea id="payment-notes" name="notes" rows={3} />
            </div>

            <button type="submit" className="primary-button">
              Salvar pagamento
            </button>
          </form>
        </article>

        <article id="payment-filters" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Filtro do caixa</h2>
              <p className="muted">Recorte por período e forma de pagamento.</p>
            </div>
          </div>

          <form method="get" className="simple-form">
            <div className="split-grid">
              <div className="field">
                <label htmlFor="payments-from">De</label>
                <input
                  id="payments-from"
                  name="dateFrom"
                  type="date"
                  defaultValue={dateFrom}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="payments-to">Até</label>
                <input
                  id="payments-to"
                  name="dateTo"
                  type="date"
                  defaultValue={dateTo}
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="payments-method-filter">Forma de pagamento</label>
              <select
                id="payments-method-filter"
                name="paymentMethod"
                defaultValue={paymentMethod}
              >
                <option value="">Todas</option>
                {PAYMENT_METHOD_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="inline-actions">
              <button type="submit" className="secondary-button">
                Aplicar
              </button>
              <a href="/dashboard/gestao/pagamentos" className="secondary-button">
                Limpar
              </a>
            </div>
          </form>
        </article>
      </section>

      <section id="payment-list" className="card content-card management-card">
        <div className="section-heading">
          <div>
            <h2>Movimentações do caixa</h2>
            <p className="muted">
              {data.items.length
                ? `${data.items.length} pagamento(s) no período`
                : "Nenhum pagamento encontrado"}
            </p>
          </div>
        </div>

        {!data.items.length ? (
          <EmptyStateCard
            eyebrow="Caixa sem movimento"
            title="Nenhum pagamento nesse recorte"
            description="Registre um recebimento para acompanhar o caixa do salão."
          />
        ) : (
          <div className="management-payment-list">
            {data.items.map((item) => (
              <article key={item.id} className="management-payment-card">
                <div className="management-payment-card__header">
                  <div>
                    <strong>{item.customerName}</strong>
                    <p className="muted">
                      {item.serviceName} • {item.professionalName}
                    </p>
                  </div>
                  <strong>{formatCurrency(item.amountNumber)}</strong>
                </div>

                <div className="management-payment-card__meta">
                  <span>{formatPaymentMethodLabel(item.payment_method)}</span>
                  <span>{formatDateTimeLabel(item.paid_at, timeZone)}</span>
                </div>

                {item.notes ? (
                  <p className="management-inline-note">{item.notes}</p>
                ) : null}

                <form action={deleteManagementPaymentAction}>
                  <input type="hidden" name="returnPath" value={currentPath} />
                  <input type="hidden" name="paymentId" value={item.id} />
                  <button type="submit" className="danger-button">
                    Remover pagamento
                  </button>
                </form>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
