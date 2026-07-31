import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import {
  deleteManagementPaymentAction,
  upsertManagementPaymentAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import {
  PAYMENT_METHOD_OPTIONS,
  buildFilterHref,
  formatAppointmentPaymentPreferenceLabel,
  formatDateTimeLabel,
  formatPaymentMethodLabel,
  formatTimeInput,
  getLocalDateKey,
  loadManagementPayments,
} from "@/lib/management";

import styles from "./page.module.css";

type PagamentosPageProps = {
  searchParams?: Promise<{
    appointmentId?: string;
    compose?: string;
    dateFrom?: string;
    dateTo?: string;
    message?: string;
    paymentMethod?: string;
    q?: string;
    tone?: string;
  }>;
};

function normalizeSearch(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeSearch(query);
  return values.some((value) =>
    normalizeSearch(value ?? "").includes(normalizedQuery),
  );
}

function formatAmountInput(value: number) {
  return value > 0 ? value.toFixed(2) : "";
}

export default async function PagamentosPage({
  searchParams: searchParamsPromise,
}: PagamentosPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const dateFrom = searchParams?.dateFrom ?? todayKey;
  const dateTo = searchParams?.dateTo ?? searchParams?.dateFrom ?? todayKey;
  const paymentMethod = searchParams?.paymentMethod ?? "";
  const query = searchParams?.q?.trim() ?? "";
  const composeOpen = searchParams?.compose === "1";
  const requestedAppointmentId = searchParams?.appointmentId?.trim() ?? "";
  const currentPath = buildFilterHref(
    "/dashboard/gestao/pagamentos",
    searchParams,
    { appointmentId: undefined, compose: undefined },
  );
  const composeHref = `${buildFilterHref("/dashboard/gestao/pagamentos", searchParams, {
    compose: "1",
  })}#payment-create`;

  const paymentsData = await loadManagementPayments({
    salonId: salon.id,
    timeZone,
    dateFrom,
    dateTo,
    paymentMethod: paymentMethod || undefined,
  });
  const filteredPayments = paymentsData.items.filter((item) =>
    matchesQuery(query, [
      item.customerName,
      item.serviceName,
      item.professionalName,
      item.notes,
    ]),
  );
  const filteredTotalReceived = filteredPayments.reduce(
    (sum, item) => sum + item.amountNumber,
    0,
  );
  const filteredAverageTicket = filteredPayments.length
    ? filteredTotalReceived / filteredPayments.length
    : 0;
  const selectedUnpaidAppointment =
    paymentsData.unpaidAppointments.find(
      (item) => item.id === requestedAppointmentId,
    ) ?? null;
  const composeAppointmentId =
    selectedUnpaidAppointment?.id ??
    (paymentsData.unpaidAppointments[0]?.id ?? "");
  const composeAmount = selectedUnpaidAppointment?.amount
    ? formatAmountInput(selectedUnpaidAppointment.amount)
    : "";
  const composePaidAtDate = selectedUnpaidAppointment?.completedAt
    ? getLocalDateKey(selectedUnpaidAppointment.completedAt, timeZone)
    : todayKey;
  const composePaidAtTime = selectedUnpaidAppointment?.completedAt
    ? formatTimeInput(selectedUnpaidAppointment.completedAt, timeZone)
    : formatTimeInput(new Date(), timeZone);

  return (
    <AsyncActionNoticeRegion
      initialMessage={searchParams?.message}
      initialTone={searchParams?.tone}
    >
      <div className={`page-grid workspace-page management-page ${styles.page}`}>
        <section className={styles.hero}>
          <div className={styles.heroHeader}>
            <div>
              <p className={styles.eyebrow}>Caixa</p>
              <h1>Caixa do salao</h1>
              <p className={styles.lead}>
                Veja o que entrou, a media por pagamento e o que ainda falta
                baixar.
              </p>
            </div>

            <a href={composeHref} className={styles.primaryButton}>
              Novo recebimento
            </a>
          </div>

          <div className={styles.heroStats}>
            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Entrou no filtro</span>
              </div>
              <strong className={styles.metricValue}>
                {formatCurrency(filteredTotalReceived)}
              </strong>
              <small className={styles.metricMeta}>
                {filteredPayments.length} pagamento(s) encontrados
              </small>
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Ticket medio</span>
              </div>
              <strong className={styles.metricValue}>
                {formatCurrency(filteredAverageTicket)}
              </strong>
              <small className={styles.metricMeta}>Media por recebimento</small>
            </article>

            <article className={styles.metricCard}>
              <div className={styles.metricHeader}>
                <span className={styles.metricLabel}>Pendentes para baixar</span>
              </div>
              <strong className={styles.metricValue}>
                {paymentsData.unpaidAppointments.length}
              </strong>
              <small className={styles.metricMeta}>
                Atendimento(s) aguardando baixa
              </small>
            </article>
          </div>
        </section>

        <section className={styles.operationsSection}>
          <div className={styles.operationsHeader}>
            <div>
              <p className={styles.eyebrow}>Movimento</p>
              <h2>Filtrar, registrar e conferir</h2>
              <p className={styles.operationsLead}>
                Tudo o que o salao usa no dia a dia fica aqui.
              </p>
            </div>
          </div>

          <div
            className={`${styles.operationsGrid} ${
              !composeOpen ? styles.operationsGridSingle : ""
            }`}
          >
            {composeOpen ? (
              <article id="payment-create" className={styles.formCard}>
                <div className={styles.formCardHeader}>
                  <div>
                    <h3>Novo recebimento</h3>
                    <p>Registre a baixa de um atendimento concluido.</p>
                  </div>
                  <a href={currentPath} className={styles.inlineLink}>
                    Fechar
                  </a>
                </div>

                <AsyncActionForm
                  action={upsertManagementPaymentAction}
                  className="simple-form"
                  resetOnSuccess
                >
                  <input type="hidden" name="returnPath" value={currentPath} />

                  <div className="field">
                    <label htmlFor="payment-appointment">Atendimento</label>
                    <select
                      id="payment-appointment"
                      name="appointmentId"
                      defaultValue={composeAppointmentId}
                      required
                    >
                      <option value="">Selecione</option>
                      {paymentsData.unpaidAppointments.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                          {item.secondary ? ` - ${item.secondary}` : ""}
                        </option>
                      ))}
                    </select>
                    {selectedUnpaidAppointment ? (
                      <small>
                        Valor oficial{" "}
                        {formatCurrency(selectedUnpaidAppointment.amount)}.
                        {selectedUnpaidAppointment.paymentPreference
                          ? ` Forma prevista: ${formatAppointmentPaymentPreferenceLabel(selectedUnpaidAppointment.paymentPreference)}.`
                          : " Forma ainda nao informada."}
                      </small>
                    ) : null}
                  </div>

                  <div className="split-grid">
                    <div className="field">
                      <label htmlFor="payment-amount">Valor</label>
                      <input
                        id="payment-amount"
                        name="amount"
                        defaultValue={composeAmount}
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
                        defaultValue={composePaidAtDate}
                        required
                      />
                    </div>
                    <div className="field">
                      <label htmlFor="payment-time">Horario</label>
                      <input
                        id="payment-time"
                        name="paidAtTime"
                        type="time"
                        defaultValue={composePaidAtTime}
                        required
                      />
                    </div>
                  </div>

                  <div className="field">
                    <label htmlFor="payment-notes">Observacao</label>
                    <textarea id="payment-notes" name="notes" rows={3} />
                  </div>

                  <button type="submit" className="primary-button">
                    Salvar pagamento
                  </button>
                </AsyncActionForm>
              </article>
            ) : null}

            <article id="payment-filters" className={styles.formCard}>
              <div className={styles.formCardHeader}>
                <div>
                  <h3>Filtro do caixa</h3>
                  <p>Filtre por periodo, forma de pagamento e busca.</p>
                </div>
              </div>

              <form method="get" className="simple-form">
                {composeOpen ? <input type="hidden" name="compose" value="1" /> : null}
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
                    <label htmlFor="payments-to">Ate</label>
                    <input
                      id="payments-to"
                      name="dateTo"
                      type="date"
                      defaultValue={dateTo}
                      required
                    />
                  </div>
                </div>

                <div className="split-grid">
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
                  <div className="field">
                    <label htmlFor="payments-search-filter">Busca</label>
                    <input
                      id="payments-search-filter"
                      name="q"
                      defaultValue={query}
                      placeholder="Cliente, servico ou observacao"
                    />
                  </div>
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
          </div>

          <article id="payment-list" className={styles.listCard}>
            <div className={styles.listHeader}>
              <div>
                <h3>Movimentacoes do caixa</h3>
                <p>
                  {filteredPayments.length
                    ? `${filteredPayments.length} pagamento(s) no filtro atual`
                    : "Nenhum pagamento encontrado no filtro atual"}
                </p>
              </div>
            </div>

            {!filteredPayments.length ? (
              <EmptyStateCard
                eyebrow="Caixa sem movimento"
                title="Nenhum pagamento neste recorte"
                description="Registre um recebimento ou limpe os filtros para voltar a carteira completa."
              />
            ) : (
              <div className={styles.paymentList}>
                {filteredPayments.map((item) => (
                  <article key={item.id} className={styles.paymentCard}>
                    <div className={styles.paymentHeader}>
                      <div>
                        <strong>{item.customerName}</strong>
                        <p>
                          {item.serviceName} - {item.professionalName}
                        </p>
                      </div>
                      <strong>{formatCurrency(item.amountNumber)}</strong>
                    </div>

                    <div className={styles.paymentMeta}>
                      <span>{formatPaymentMethodLabel(item.payment_method)}</span>
                      <span>{formatDateTimeLabel(item.paid_at, timeZone)}</span>
                    </div>

                    {item.notes ? (
                      <p className={styles.paymentNote}>{item.notes}</p>
                    ) : null}

                    <AsyncActionForm action={deleteManagementPaymentAction}>
                      <input type="hidden" name="returnPath" value={currentPath} />
                      <input type="hidden" name="paymentId" value={item.id} />
                      <button type="submit" className="danger-button">
                        Remover pagamento
                      </button>
                    </AsyncActionForm>
                  </article>
                ))}
              </div>
            )}
          </article>
        </section>
      </div>
    </AsyncActionNoticeRegion>
  );
}
