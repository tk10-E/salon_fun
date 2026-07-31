import {
  createPayableAction,
  createRecurringExpenseRuleAction,
  createSalonFinancialTransactionAction,
  recordRecurringExpensePostingAction,
  settlePayableAction,
  toggleRecurringExpenseRuleAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { formatCurrency, formatDate } from "@/lib/formatters";
import { measureServerRender } from "@/lib/serverPerformance";

import { loadFinancePageData } from "../_lib";
import styles from "./page.module.css";

type FinanceExpensesPageProps = {
  searchParams?: Promise<{
    message?: string;
    tone?: string;
  }>;
};

export default async function FinanceExpensesPage({
  searchParams: searchParamsPromise,
}: FinanceExpensesPageProps) {
  return measureServerRender("dashboard.finance.expenses", async () => {
    const [searchParams, data] = await Promise.all([
      searchParamsPromise,
      loadFinancePageData(),
    ]);

    const expenseEntries = data.timelineEntries.filter(
      (entry) => entry.kind === "expense",
    );
    const committedAmount =
      data.payables.dueAmount + data.recurringExpenses.dueAmount;
    const activeRecurring = data.recurringExpenses.items.filter(
      (item) => item.isActive,
    );
    const paidPayables = data.payables.items.filter((item) => item.status === "paid");
    const recurringOpenCount = data.recurringExpenses.items.filter(
      (item) => item.isActive,
    ).length;

    return (
      <div className={styles.page}>
        {searchParams?.message ? (
          <FlashMessage message={searchParams.message} tone={searchParams.tone} />
        ) : null}

        <section className={styles.hero}>
          <div className={styles.heroHeader}>
            <div>
              <p className={styles.eyebrow}>Saidas</p>
              <h1>Despesas</h1>
              <p className={styles.lead}>
                Controle contas, recorrências e lançamentos manuais com a mesma
                leitura do caixa.
              </p>
            </div>

            <div className={styles.heroActions}>
              <a href="#expense-payables" className={styles.secondaryButton}>
                Ver contas
              </a>
              <a href="#expense-new" className={styles.primaryButton}>
                Nova despesa
              </a>
            </div>
          </div>

          <div className={styles.metricGrid}>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Despesas do mês</span>
              <strong className={styles.metricValue}>
                {formatCurrency(data.currentMonth.expense)}
              </strong>
              <p className={styles.metricMeta}>Tudo que ja saiu do caixa no periodo.</p>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Contas a pagar</span>
              <strong className={styles.metricValue}>
                {formatCurrency(data.payables.dueAmount)}
              </strong>
              <p className={styles.metricMeta}>
                {data.payables.dueCount} conta(s) vencendo/agora.
              </p>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Compromissos recorrentes</span>
              <strong className={styles.metricValue}>
                {formatCurrency(data.recurringExpenses.dueAmount)}
              </strong>
              <p className={styles.metricMeta}>
                {data.recurringExpenses.dueCount} vencimento(s) em aberto.
              </p>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Compromisso aberto</span>
              <strong className={styles.metricValue}>
                {formatCurrency(committedAmount)}
              </strong>
              <p className={styles.metricMeta}>Soma de avulsas e recorrentes.</p>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Lancamentos recentes</span>
              <strong className={styles.metricValue}>{expenseEntries.length}</strong>
              <p className={styles.metricMeta}>Movimentos de saída no histórico.</p>
            </article>
            <article className={styles.metricCard}>
              <span className={styles.metricLabel}>Contas fixas ativas</span>
              <strong className={styles.metricValue}>{recurringOpenCount}</strong>
              <p className={styles.metricMeta}>Regras recorrentes em operação.</p>
            </article>
          </div>
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <section id="expense-payables" className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Agenda</p>
                  <h2>Contas a pagar</h2>
                  <p className={styles.panelCopy}>
                    Lance contas avulsas e baixe no caixa quando pagar.
                  </p>
                </div>
              </div>

              {!data.payables.items.length ? (
                <EmptyStateCard
                  eyebrow="Sem contas"
                  title="Nenhuma conta a pagar cadastrada"
                  description="As despesas avulsas entram aqui quando voce registrar."
                />
              ) : (
                <div className={styles.stack}>
                  {data.payables.items.map((item) => (
                    <article key={item.id} className={styles.rowCard}>
                      <div>
                        <div className={styles.badgeRow}>
                          <span className={styles.tag}>{item.statusLabel}</span>
                          <span className={styles.tag}>{item.category}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p className={styles.panelCopy}>
                          Vence {formatDate(item.dueOn)}
                          {item.paidOn ? ` • pago em ${formatDate(item.paidOn)}` : ""}
                          {item.paymentMethod ? ` • ${item.paymentMethod}` : ""}
                          {item.notes ? ` • ${item.notes}` : ""}
                        </p>
                      </div>
                      <div className={styles.rowAside}>
                        <strong>{formatCurrency(item.amount)}</strong>
                        {item.status === "pending" ? (
                          <form action={settlePayableAction}>
                            <input type="hidden" name="payableId" value={item.id} />
                            <button type="submit" className={styles.ghostButton}>
                              Baixar no caixa
                            </button>
                          </form>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section id="expense-recurring" className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Recorrencia</p>
                  <h2>Contas fixas e recorrentes</h2>
                  <p className={styles.panelCopy}>
                    Deixe as regras prontas e lance cada vencimento no momento certo.
                  </p>
                </div>
              </div>

              {!data.recurringExpenses.items.length ? (
                <EmptyStateCard
                  eyebrow="Sem recorrencia"
                  title="Nenhuma conta fixa cadastrada"
                  description="As despesas recorrentes entram aqui quando voce criar a primeira regra."
                />
              ) : (
                <div className={styles.stack}>
                  {data.recurringExpenses.items.map((item) => (
                    <article key={item.id} className={styles.rowCard}>
                      <div>
                        <div className={styles.badgeRow}>
                          <span className={styles.tag}>{item.statusLabel}</span>
                          <span className={styles.tag}>{item.category}</span>
                        </div>
                        <h3>{item.title}</h3>
                        <p className={styles.panelCopy}>
                          Proximo vencimento {formatDate(item.nextDueOn)}
                          {item.lastPostedOn
                            ? ` • ultima baixa ${formatDate(item.lastPostedOn)}`
                            : ""}
                          {item.paymentMethod ? ` • ${item.paymentMethod}` : ""}
                          {item.notes ? ` • ${item.notes}` : ""}
                        </p>
                      </div>
                      <div className={styles.rowAside}>
                        <strong>{formatCurrency(item.amount)}</strong>
                        {item.isActive ? (
                          <div className={styles.actionStack}>
                            <form action={recordRecurringExpensePostingAction}>
                              <input type="hidden" name="ruleId" value={item.id} />
                              <button type="submit" className={styles.ghostButton}>
                                Lancar vencimento
                              </button>
                            </form>
                            <form action={toggleRecurringExpenseRuleAction}>
                              <input type="hidden" name="ruleId" value={item.id} />
                              <input type="hidden" name="nextState" value="paused" />
                              <button type="submit" className={styles.ghostButton}>
                                Pausar
                              </button>
                            </form>
                          </div>
                        ) : (
                          <form action={toggleRecurringExpenseRuleAction}>
                            <input type="hidden" name="ruleId" value={item.id} />
                            <input type="hidden" name="nextState" value="active" />
                            <button type="submit" className={styles.ghostButton}>
                              Reativar
                            </button>
                          </form>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>

            <section className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.eyebrow}>Histórico</p>
                  <h2>Transações de saída</h2>
                  <p className={styles.panelCopy}>
                    Ultimos movimentos que reduziram o caixa.
                  </p>
                </div>
              </div>

              {!expenseEntries.length ? (
                <EmptyStateCard
                  eyebrow="Sem saída"
                  title="Nenhuma despesa registrada"
                  description="As despesas manuais, contas pagas e baixas recorrentes aparecem aqui."
                />
              ) : (
                <div className={styles.stack}>
                  {expenseEntries.slice(0, 10).map((entry) => (
                    <article key={entry.id} className={styles.rowCard}>
                      <div>
                        <div className={styles.badgeRow}>
                          <span className={styles.tag}>{entry.sourceLabel}</span>
                          <span className={styles.tag}>{formatDate(entry.occurredAt)}</span>
                        </div>
                        <h3>{entry.title}</h3>
                        <p className={styles.panelCopy}>{entry.subtitle}</p>
                      </div>
                      <div className={styles.rowAside}>
                        <strong className={styles.amountNegative}>
                          - {formatCurrency(entry.amount)}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>

          <div className={styles.sidebarColumn}>
            <section className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.eyebrow}>Leitura</p>
                  <h2>Resumo das despesas</h2>
                </div>
              </div>

              <div className={styles.healthGrid}>
                <article className={styles.healthCard}>
                  <span>Pagas no mês</span>
                  <strong>{formatCurrency(data.currentMonth.expense)}</strong>
                </article>
                <article className={styles.healthCard}>
                  <span>Avulsas quitadas</span>
                  <strong>{paidPayables.length}</strong>
                </article>
                <article className={styles.healthCard}>
                  <span>Regras ativas</span>
                  <strong>{activeRecurring.length}</strong>
                </article>
              </div>
            </section>

            <section className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.eyebrow}>Nova conta</p>
                  <h2>Lancar conta a pagar</h2>
                </div>
              </div>

              <form action={createPayableAction} className={styles.form}>
                <div className={styles.formGrid}>
                  <label className={styles.fieldFull}>
                    <span>Título</span>
                    <input
                      name="title"
                      placeholder="Ex.: fornecedor, energia"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Categoria</span>
                    <input name="category" placeholder="Ex.: estrutura" required />
                  </label>
                  <label className={styles.field}>
                    <span>Valor</span>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Vencimento</span>
                    <input name="dueOn" type="date" />
                  </label>
                  <label className={styles.field}>
                    <span>Forma prevista</span>
                    <input name="paymentMethod" placeholder="Ex.: pix, boleto" />
                  </label>
                  <label className={styles.fieldFull}>
                    <span>Observação</span>
                    <input name="notes" placeholder="Detalhes da conta" />
                  </label>
                </div>

                <button type="submit" className={styles.primaryButton}>
                  Salvar conta a pagar
                </button>
              </form>
            </section>

            <section className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.eyebrow}>Conta fixa</p>
                  <h2>Nova conta recorrente</h2>
                </div>
              </div>

              <form action={createRecurringExpenseRuleAction} className={styles.form}>
                <div className={styles.formGrid}>
                  <label className={styles.fieldFull}>
                    <span>Título</span>
                    <input
                      name="title"
                      placeholder="Ex.: aluguel, internet"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Categoria</span>
                    <input name="category" placeholder="Ex.: assinaturas" required />
                  </label>
                  <label className={styles.field}>
                    <span>Valor</span>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Frequencia</span>
                    <select name="cadence" defaultValue="monthly">
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                      <option value="yearly">Anual</option>
                    </select>
                  </label>
                  <label className={styles.field}>
                    <span>Proximo vencimento</span>
                    <input name="nextDueOn" type="date" />
                  </label>
                  <label className={styles.field}>
                    <span>Forma</span>
                    <input name="paymentMethod" placeholder="Ex.: pix" />
                  </label>
                  <label className={styles.fieldFull}>
                    <span>Observação</span>
                    <input name="notes" placeholder="Fornecedor e detalhes" />
                  </label>
                </div>

                <button type="submit" className={styles.secondaryButton}>
                  Salvar conta fixa
                </button>
              </form>
            </section>

            <section id="expense-new" className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.eyebrow}>Manual</p>
                  <h2>Nova despesa manual</h2>
                </div>
              </div>

              <form action={createSalonFinancialTransactionAction} className={styles.form}>
                <input type="hidden" name="entryType" value="expense" />
                <div className={styles.formGrid}>
                  <label className={styles.field}>
                    <span>Valor</span>
                    <input
                      name="amount"
                      type="number"
                      min="0.01"
                      step="0.01"
                      placeholder="0.00"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Data</span>
                    <input name="occurredOn" type="date" />
                  </label>
                  <label className={styles.fieldFull}>
                    <span>Título</span>
                    <input
                      name="title"
                      placeholder="Ex.: manutencao, compra urgente"
                      required
                    />
                  </label>
                  <label className={styles.field}>
                    <span>Categoria</span>
                    <input name="category" placeholder="Ex.: caixa" required />
                  </label>
                  <label className={styles.field}>
                    <span>Forma</span>
                    <input name="paymentMethod" placeholder="Ex.: dinheiro" />
                  </label>
                  <label className={styles.fieldFull}>
                    <span>Observação</span>
                    <textarea name="notes" rows={3} placeholder="Detalhes da despesa." />
                  </label>
                </div>

                <button type="submit" className={styles.primaryButton}>
                  Salvar despesa
                </button>
              </form>
            </section>
          </div>
        </div>
      </div>
    );
  });
}
