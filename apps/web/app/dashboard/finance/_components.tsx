import { createSalonFinancialTransactionAction } from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatCurrency, formatDate } from "@/lib/formatters";

import type { FinancePageData } from "./_lib";

type FinancePageContentProps = {
  data: FinancePageData;
};

export function FinancePageContent({ data }: FinancePageContentProps) {
  return (
    <>
      <FinanceHeader currentMonth={data.currentMonth} />
      <FinanceMonthSummarySection currentMonth={data.currentMonth} />
      <FinanceSixMonthsSection monthBuckets={data.monthBuckets} />
      <FinanceTimelineSection timelineEntries={data.timelineEntries} />
      <FinanceNewEntrySection />
    </>
  );
}

function FinanceHeader({
  currentMonth,
}: {
  currentMonth: FinancePageData["currentMonth"];
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Caixa</p>
        <h1>Caixa do salão com leitura simples</h1>
        <p className="muted">
          Receitas, despesas e lançamentos manuais num só olhar.
        </p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="badge badge--confirmed">
            Receita mês {formatCurrency(currentMonth.income)}
          </span>
          <span className="badge badge--soft">
            Despesa mês {formatCurrency(currentMonth.expense)}
          </span>
          <span
            className={
              currentMonth.profit >= 0
                ? "badge badge--success"
                : "badge badge--cancelled"
            }
          >
            Lucro {formatCurrency(currentMonth.profit)}
          </span>
        </div>
      </div>
      <a href="#finance-new" className="primary-button">
        Novo lançamento
      </a>
    </header>
  );
}

function FinanceMonthSummarySection({
  currentMonth,
}: {
  currentMonth: FinancePageData["currentMonth"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Resumo do mês</h2>
          <p className="muted">Entradas e saídas registradas.</p>
        </div>
      </div>

      <div className="simple-list">
        <article className="simple-row">
          <strong>Receitas</strong>
          <p className="muted">Atendimentos, loja e entradas manuais.</p>
          <span className="badge badge--success">
            {formatCurrency(currentMonth.income)}
          </span>
        </article>
        <article className="simple-row">
          <strong>Despesas</strong>
          <p className="muted">Saídas lançadas manualmente.</p>
          <span className="badge badge--warm">
            {formatCurrency(currentMonth.expense)}
          </span>
        </article>
        <article className="simple-row">
          <strong>Lucro</strong>
          <p className="muted">Receitas - despesas.</p>
          <span
            className={
              currentMonth.profit >= 0
                ? "badge badge--success"
                : "badge badge--cancelled"
            }
          >
            {formatCurrency(currentMonth.profit)}
          </span>
        </article>
      </div>
    </section>
  );
}

function FinanceSixMonthsSection({
  monthBuckets,
}: {
  monthBuckets: FinancePageData["monthBuckets"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Últimos 6 meses</h2>
          <p className="muted">Valores por mês (entrada x saída).</p>
        </div>
      </div>

      <div className="simple-list">
        {monthBuckets.map((bucket) => (
          <article
            key={bucket.key}
            className="simple-row"
            style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
          >
            <div>
              <strong>{bucket.label}</strong>
              <p className="muted">
                Entrada {formatCurrency(bucket.income)} • Saída{" "}
                {formatCurrency(bucket.expense)}
              </p>
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span className="badge badge--success">
                {formatCurrency(bucket.income)}
              </span>
              <span className="badge badge--warm">
                {formatCurrency(bucket.expense)}
              </span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function FinanceTimelineSection({
  timelineEntries,
}: {
  timelineEntries: FinancePageData["timelineEntries"];
}) {
  return (
    <section className="card content-card" id="finance-timeline">
      <div className="section-heading">
        <div>
          <h2>Transações recentes</h2>
          <p className="muted">Últimas entradas e saídas.</p>
        </div>
      </div>

      {!timelineEntries.length ? (
        <EmptyStateCard
          eyebrow="Sem movimentação"
          title="Nada registrado no período"
          description="Atendimentos, loja e lançamentos aparecem aqui."
        />
      ) : (
        <div className="simple-list">
          {timelineEntries.slice(0, 12).map((entry) => (
            <article
              key={entry.id}
              className="simple-row"
              style={{ display: "flex", justifyContent: "space-between", gap: 12 }}
            >
              <div>
                <div className="inline-actions" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                  <span
                    className={
                      entry.kind === "expense"
                        ? "badge badge--cancelled"
                        : "badge badge--confirmed"
                    }
                  >
                    {entry.sourceLabel}
                  </span>
                  <span className="badge badge--soft">
                    {formatDate(entry.occurredAt)}
                  </span>
                </div>
                <h3>{entry.title}</h3>
                <p className="muted">{entry.subtitle}</p>
              </div>
              <strong
                className={
                  entry.kind === "expense"
                    ? "finance-amount finance-amount--expense"
                    : "finance-amount finance-amount--income"
                }
              >
                {entry.kind === "expense" ? "- " : "+ "}
                {formatCurrency(entry.amount)}
              </strong>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FinanceNewEntrySection() {
  return (
    <section className="card content-card" id="finance-new">
      <div className="section-heading">
        <div>
          <h2>Novo lançamento</h2>
          <p className="muted">Receita ou despesa manual.</p>
        </div>
      </div>

      <form action={createSalonFinancialTransactionAction} className="simple-form">
        <div className="split-grid">
          <div className="field">
            <label htmlFor="finance-entry-type">Tipo</label>
            <select id="finance-entry-type" name="entryType" defaultValue="expense">
              <option value="expense">Despesa</option>
              <option value="income">Receita</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="finance-amount">Valor</label>
            <input
              id="finance-amount"
              name="amount"
              type="number"
              min="0.01"
              step="0.01"
              placeholder="0.00"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="finance-occurred-on">Data</label>
            <input id="finance-occurred-on" name="occurredOn" type="date" />
          </div>
        </div>

        <div className="field">
          <label htmlFor="finance-title">Título</label>
          <input
            id="finance-title"
            name="title"
            placeholder="Ex.: aluguel do salão"
            required
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="finance-category">Categoria</label>
            <input
              id="finance-category"
              name="category"
              placeholder="Ex.: estrutura, fornecedor, caixa"
              required
            />
          </div>
          <div className="field">
            <label htmlFor="finance-payment-method">Forma</label>
            <input
              id="finance-payment-method"
              name="paymentMethod"
              placeholder="Ex.: pix, dinheiro, cartão"
            />
          </div>
        </div>

        <div className="field">
          <label htmlFor="finance-notes">Observação</label>
          <textarea
            id="finance-notes"
            name="notes"
            rows={3}
            placeholder="Detalhes do lançamento."
          />
        </div>

        <button type="submit" className="primary-button">
          Salvar transação
        </button>
      </form>
    </section>
  );
}
