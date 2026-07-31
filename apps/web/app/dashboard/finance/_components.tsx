import {
  closeCashSessionAction,
  createPayableAction,
  createRecurringExpenseRuleAction,
  createSalonFinancialTransactionAction,
  createTeamPayoutAction,
  openCashSessionAction,
  recordRecurringExpensePostingAction,
  settlePayableAction,
  toggleRecurringExpenseRuleAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatCurrency, formatDate } from "@/lib/formatters";

import type { FinancePageData } from "./_lib";
import styles from "./page.module.css";

type FinancePageContentProps = {
  data: FinancePageData;
};

function statusTone(tone: "success" | "accent" | "warm" | "soft") {
  switch (tone) {
    case "success":
      return styles.pillSuccess;
    case "accent":
      return styles.pillAccent;
    case "warm":
      return styles.pillWarm;
    default:
      return styles.pillSoft;
  }
}

function buildPendingSettlementHref(appointmentId: string) {
  const encodedId = encodeURIComponent(appointmentId);
  return `/dashboard/gestao/pagamentos?compose=1&appointmentId=${encodedId}#payment-create`;
}

function buildStoreOrdersHref() {
  return "/dashboard/inventory#inventory-orders";
}

function storeOrderStatusTone(
  tone: "success" | "accent" | "warm" | "soft",
) {
  return statusTone(tone);
}

function MetricCard({
  label,
  value,
  meta,
  toneClass,
}: {
  label: string;
  value: string;
  meta: string;
  toneClass?: string;
}) {
  return (
    <article className={styles.metricCard}>
      <span className={styles.metricLabel}>{label}</span>
      <strong className={styles.metricValue}>{value}</strong>
      <p className={styles.metricMeta}>{meta}</p>
      <span className={`${styles.metricGlow} ${toneClass ?? styles.tonePurple}`} />
    </article>
  );
}

export function FinancePageContent({ data }: FinancePageContentProps) {
  const todayCash = data.cashRegister.today;
  const pendingSettlements = data.receivablesDashboard.pendingSettlements;
  const openStoreOrders = data.storeOrders;

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroHeader}>
          <div>
            <p className={styles.eyebrow}>Financeiro</p>
            <h1>Caixa</h1>
            <p className={styles.lead}>
              Veja o que entrou, o que falta baixar e o que precisa sair.
            </p>
          </div>

          <div className={styles.heroActions}>
            <a href="#finance-cash-register" className={styles.secondaryButton}>
              Caixa do dia
            </a>
            <a href="#finance-new" className={styles.primaryButton}>
              Novo lancamento
            </a>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <MetricCard
            label="Recebido"
            value={formatCurrency(data.currentMonth.realizedIncome)}
            meta="Entradas baixadas no periodo."
            toneClass={styles.toneGreen}
          />
          <MetricCard
            label="Esperado agora"
            value={formatCurrency(todayCash.expectedBalance)}
            meta={todayCash.statusLabel}
            toneClass={styles.toneOrange}
          />
          <MetricCard
            label="Repasse pago"
            value={formatCurrency(data.currentMonth.teamPayoutsPaid)}
            meta={`${data.teamPayouts.items.length} repasse(s) registrado(s).`}
            toneClass={styles.tonePurple}
          />
          <MetricCard
            label="Contas abertas"
            value={formatCurrency(data.payables.dueAmount)}
            meta={`${data.payables.dueCount} conta(s) em aberto.`}
            toneClass={styles.toneOrange}
          />
          <MetricCard
            label="Loja do app"
            value={formatCurrency(openStoreOrders.openAmount)}
            meta={`${openStoreOrders.openCount} pedido(s) ainda fora do caixa.`}
            toneClass={styles.tonePurple}
          />
          <MetricCard
            label="Pendencias de baixa"
            value={formatCurrency(pendingSettlements.totalAmount)}
            meta={`${pendingSettlements.totalCount} atendimento(s) aguardando baixa.`}
            toneClass={styles.tonePurple}
          />
          <MetricCard
            label="Resultado"
            value={formatCurrency(data.currentMonth.cashProfit)}
            meta="Recebido menos despesas do periodo."
            toneClass={
              data.currentMonth.cashProfit >= 0 ? styles.toneGreen : styles.toneRose
            }
          />
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Conferencia</p>
                <h2>Baixas pendentes</h2>
                <p className={styles.panelCopy}>
                  Atendimento concluido que ainda nao entrou no caixa.
                </p>
              </div>
            </div>

            {!pendingSettlements.items.length ? (
              <EmptyStateCard
                eyebrow="Tudo certo"
                title="Nenhuma baixa pendente"
                description="Tudo o que foi concluido ja entrou no caixa."
              />
            ) : (
              <div className={styles.listStack}>
                {pendingSettlements.items.map((item) => (
                  <article key={item.id} className={styles.sidebarRow}>
                    <div>
                      <div className={styles.badgeRow}>
                        <span className={`${styles.tag} ${styles.pillWarm}`}>Pendente</span>
                        <span className={styles.tag}>{item.paymentPreferenceLabel}</span>
                      </div>
                      <strong>{item.customerName}</strong>
                      <p className={styles.panelCopy}>
                        {item.serviceName} com {item.professionalName}
                      </p>
                      <p className={styles.panelCopy}>
                        Concluido em {formatDate(item.completedAt)}
                      </p>
                    </div>
                    <div className={styles.actionColumn}>
                      <strong>{formatCurrency(item.amount)}</strong>
                      <a
                        href={buildPendingSettlementHref(item.id)}
                        className={styles.ghostButton}
                      >
                        Baixar agora
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Movimento</p>
                <h2>Ultimos lancamentos</h2>
                <p className={styles.panelCopy}>
                  Ultimas entradas e saidas que mexeram no caixa.
                </p>
              </div>
            </div>

            {!data.timelineEntries.length ? (
              <EmptyStateCard
                eyebrow="Sem movimento"
                title="Nada registrado no periodo"
                description="Receitas e despesas manuais aparecem aqui."
              />
            ) : (
              <div className={styles.listStack}>
                {data.timelineEntries.slice(0, 8).map((entry) => (
                  <article key={entry.id} className={styles.movementRow}>
                    <div className={styles.movementMain}>
                      <div>
                        <div className={styles.badgeRow}>
                          <span className={styles.sourcePill}>{entry.sourceLabel}</span>
                          <span className={styles.datePill}>
                            {formatDate(entry.occurredAt)}
                          </span>
                        </div>
                        <h3>{entry.title}</h3>
                        <p>{entry.subtitle}</p>
                      </div>
                    </div>
                    <strong
                      className={
                        entry.kind === "expense"
                          ? styles.amountNegative
                          : styles.amountPositive
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

          <section className={styles.panel} id="finance-cash-register">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Hoje</p>
                <h2>Caixa do dia</h2>
                <p className={styles.panelCopy}>
                  Abra o dia, confira o esperado e feche quando terminar.
                </p>
              </div>
              <div className={styles.pillRow}>
                <span className={styles.pill}>{todayCash.statusLabel}</span>
                <span className={styles.pill}>
                  Entradas {formatCurrency(todayCash.incomeAmount)}
                </span>
                <span className={styles.pill}>
                  Saidas {formatCurrency(todayCash.expenseAmount)}
                </span>
              </div>
            </div>

            <div className={styles.dualGrid}>
              <article className={styles.innerCard}>
                <div className={styles.kpiGrid}>
                  <article className={styles.kpiTile}>
                    <span>Saldo inicial</span>
                    <strong>{formatCurrency(todayCash.openingAmount)}</strong>
                  </article>
                  <article className={styles.kpiTile}>
                    <span>Saldo esperado agora</span>
                    <strong>{formatCurrency(todayCash.expectedBalance)}</strong>
                  </article>
                  <article className={styles.kpiTile}>
                    <span>Valor contado</span>
                    <strong>{formatCurrency(todayCash.reportedAmount ?? 0)}</strong>
                  </article>
                </div>

                {!todayCash.sessionId ? (
                  <form action={openCashSessionAction} className={styles.form}>
                    <input type="hidden" name="sessionDate" value={todayCash.sessionDate} />
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span>Saldo inicial</span>
                        <input
                          name="openingAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Dia do caixa</span>
                        <input value={todayCash.sessionDate} readOnly disabled />
                      </label>
                      <label className={styles.fieldFull}>
                        <span>Observacao</span>
                        <input
                          name="openingNote"
                          placeholder="Ex.: troco inicial, fundo de caixa"
                        />
                      </label>
                    </div>
                    <button type="submit" className={styles.primaryButton}>
                      Abrir caixa
                    </button>
                  </form>
                ) : todayCash.isOpen ? (
                  <form action={closeCashSessionAction} className={styles.form}>
                    <input type="hidden" name="sessionId" value={todayCash.sessionId} />
                    <div className={styles.formGrid}>
                      <label className={styles.field}>
                        <span>Valor contado no caixa</span>
                        <input
                          name="reportedAmount"
                          type="number"
                          min="0"
                          step="0.01"
                          placeholder="0.00"
                          required
                        />
                      </label>
                      <label className={styles.fieldFull}>
                        <span>Observacao do fechamento</span>
                        <textarea
                          name="closingNote"
                          rows={3}
                          placeholder="Ex.: conferencia, sangria, ajuste encontrado"
                        />
                      </label>
                    </div>
                    <button type="submit" className={styles.primaryButton}>
                      Fechar caixa
                    </button>
                  </form>
                ) : (
                  <p className={styles.panelCopy}>
                    O caixa deste dia ja foi fechado. Use o historico ao lado para conferir.
                  </p>
                )}
              </article>

              <article className={styles.innerCard}>
                <div className={styles.innerHeader}>
                  <strong>Ultimos caixas</strong>
                </div>

                {!data.cashRegister.recentSessions.length ? (
                  <p className={styles.panelCopy}>Nenhum caixa diario foi registrado ainda.</p>
                ) : (
                  <div className={styles.listStack}>
                    {data.cashRegister.recentSessions.map((session) => (
                      <article key={session.id} className={styles.sessionRow}>
                        <div>
                          <div className={styles.badgeRow}>
                            <span className={styles.sourcePill}>
                              {session.status === "open" ? "Aberto" : "Fechado"}
                            </span>
                            <span className={styles.datePill}>
                              {formatDate(session.sessionDate)}
                            </span>
                          </div>
                          <strong>Caixa de {formatDate(session.sessionDate)}</strong>
                          <p className={styles.panelCopy}>
                            Abertura {formatCurrency(session.openingAmount)}
                            {session.expectedAmount != null
                              ? ` - esperado ${formatCurrency(session.expectedAmount)}`
                              : ""}
                            {session.reportedAmount != null
                              ? ` - contado ${formatCurrency(session.reportedAmount)}`
                              : ""}
                          </p>
                        </div>
                        <strong
                          className={
                            session.differenceAmount == null
                              ? styles.amountNeutral
                              : session.differenceAmount >= 0
                                ? styles.amountPositive
                                : styles.amountNegative
                          }
                        >
                          {session.differenceAmount == null
                            ? "Sem fechamento"
                            : `Diferenca ${formatCurrency(session.differenceAmount)}`}
                        </strong>
                      </article>
                    ))}
                  </div>
                )}
              </article>
            </div>
          </section>

          <section className={styles.panel} id="finance-new">
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Lancamento manual</p>
                <h2>Novo lancamento</h2>
                <p className={styles.panelCopy}>Receita ou despesa fora do fluxo automatico.</p>
              </div>
            </div>

            <form action={createSalonFinancialTransactionAction} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Tipo</span>
                  <select name="entryType" defaultValue="expense">
                    <option value="expense">Despesa</option>
                    <option value="income">Receita</option>
                  </select>
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
                  <span>Data</span>
                  <input name="occurredOn" type="date" />
                </label>
                <label className={styles.fieldFull}>
                  <span>Titulo</span>
                  <input
                    name="title"
                    placeholder="Ex.: aluguel do salao"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Categoria</span>
                  <input
                    name="category"
                    placeholder="Ex.: estrutura, fornecedor, caixa"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Forma</span>
                  <input name="paymentMethod" placeholder="Ex.: pix, dinheiro, cartao" />
                </label>
                <label className={styles.fieldFull}>
                  <span>Observacao</span>
                  <textarea
                    name="notes"
                    rows={3}
                    placeholder="Detalhes do lancamento."
                  />
                </label>
              </div>

              <button type="submit" className={styles.primaryButton}>
                Salvar transacao
              </button>
            </form>
          </section>
        </div>

        <div className={styles.sidebarColumn}>
          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>App do cliente</p>
                <h2>Loja do app</h2>
              </div>
              <a href={buildStoreOrdersHref()} className={styles.ghostButton}>
                Ver pedidos
              </a>
            </div>

            <div className={styles.kpiGrid}>
              <article className={styles.kpiTile}>
                <span>Pedidos em aberto</span>
                <strong>{openStoreOrders.openCount}</strong>
              </article>
              <article className={styles.kpiTile}>
                <span>Fora do caixa</span>
                <strong>{formatCurrency(openStoreOrders.openAmount)}</strong>
              </article>
            </div>

            <p className={styles.panelCopy}>
              Pedido do app so entra no caixa quando a entrega for concluida.
            </p>

            {!openStoreOrders.items.length ? (
              <p className={styles.panelCopy}>
                Nenhum pedido da loja aguardando conclusao agora.
              </p>
            ) : (
              <div className={styles.listStack}>
                {openStoreOrders.items.map((item) => (
                  <article key={item.id} className={styles.sidebarRow}>
                    <div>
                      <div className={styles.badgeRow}>
                        <span
                          className={`${styles.tag} ${storeOrderStatusTone(item.statusTone)}`}
                        >
                          {item.statusLabel}
                        </span>
                        <span className={styles.tag}>Pedido #{item.orderNumber}</span>
                      </div>
                      <strong>{item.customerName}</strong>
                      <p className={styles.panelCopy}>
                        {item.totalItems} item(ns) - {formatDate(item.orderMoment)}
                      </p>
                    </div>
                    <strong>{formatCurrency(item.subtotalAmount)}</strong>
                  </article>
                ))}
              </div>
            )}
          </section>

          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Equipe</p>
                <h2>Repasses da equipe</h2>
              </div>
            </div>

            {!data.teamPayouts.items.length ? (
              <p className={styles.panelCopy}>Nenhum repasse pago foi registrado ainda.</p>
            ) : (
              <div className={styles.listStack}>
                {data.teamPayouts.items.map((item) => (
                  <article key={item.id} className={styles.sidebarRow}>
                    <div>
                      <strong>{item.professionalName}</strong>
                      <p className={styles.panelCopy}>
                        {item.title} - {formatDate(item.occurredOn)}
                        {item.paymentMethod ? ` - ${item.paymentMethod}` : ""}
                      </p>
                    </div>
                    <strong>{formatCurrency(item.amount)}</strong>
                  </article>
                ))}
              </div>
            )}

            <form action={createTeamPayoutAction} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.fieldFull}>
                  <span>Profissional</span>
                  <select name="staffMemberId" required defaultValue="">
                    <option value="" disabled>
                      Escolha quem recebeu
                    </option>
                    {data.staffOptions.map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.label}
                      </option>
                    ))}
                  </select>
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
                  <span>Data</span>
                  <input name="paidOn" type="date" />
                </label>
                <label className={styles.field}>
                  <span>Forma</span>
                  <input name="paymentMethod" placeholder="Ex.: pix, dinheiro" />
                </label>
                <label className={styles.field}>
                  <span>Observacao</span>
                  <input name="notes" placeholder="Ex.: repasse da semana" />
                </label>
              </div>
              <button type="submit" className={styles.secondaryButton}>
                Registrar repasse
              </button>
            </form>
          </section>

          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Saidas</p>
                <h2>Contas a pagar</h2>
              </div>
            </div>

            {!data.payables.items.length ? (
              <p className={styles.panelCopy}>Nenhuma conta a pagar cadastrada ainda.</p>
            ) : (
              <div className={styles.listStack}>
                {data.payables.items.map((item) => (
                  <article key={item.id} className={styles.sidebarRow}>
                    <div>
                      <div className={styles.badgeRow}>
                        <span className={`${styles.tag} ${statusTone(item.statusTone)}`}>
                          {item.statusLabel}
                        </span>
                        <span className={styles.tag}>{item.category}</span>
                      </div>
                      <strong>{item.title}</strong>
                      <p className={styles.panelCopy}>
                        Vence {formatDate(item.dueOn)}
                        {item.paymentMethod ? ` - ${item.paymentMethod}` : ""}
                      </p>
                    </div>
                    <div className={styles.actionColumn}>
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

            <form action={createPayableAction} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.fieldFull}>
                  <span>Titulo</span>
                  <input
                    name="title"
                    placeholder="Ex.: fornecedor de produto, energia"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Categoria</span>
                  <input
                    name="category"
                    placeholder="Ex.: fornecedor, estrutura"
                    required
                  />
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
                  <input name="paymentMethod" placeholder="Ex.: pix, boleto, debito" />
                </label>
                <label className={styles.fieldFull}>
                  <span>Observacao</span>
                  <input name="notes" placeholder="Detalhes da conta a pagar" />
                </label>
              </div>
              <button type="submit" className={styles.secondaryButton}>
                Salvar conta a pagar
              </button>
            </form>
          </section>

          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Contas fixas</p>
                <h2>Contas fixas</h2>
              </div>
            </div>

            {!data.recurringExpenses.items.length ? (
              <p className={styles.panelCopy}>Nenhuma conta fixa cadastrada ainda.</p>
            ) : (
              <div className={styles.listStack}>
                {data.recurringExpenses.items.map((item) => (
                  <article key={item.id} className={styles.sidebarRow}>
                    <div>
                      <div className={styles.badgeRow}>
                        <span className={`${styles.tag} ${statusTone(item.statusTone)}`}>
                          {item.statusLabel}
                        </span>
                        <span className={styles.tag}>{item.category}</span>
                      </div>
                      <strong>{item.title}</strong>
                      <p className={styles.panelCopy}>
                        Proximo vencimento {formatDate(item.nextDueOn)}
                      </p>
                    </div>
                    <div className={styles.actionColumn}>
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

            <form action={createRecurringExpenseRuleAction} className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.fieldFull}>
                  <span>Titulo</span>
                  <input
                    name="title"
                    placeholder="Ex.: aluguel, internet, sistema"
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Categoria</span>
                  <input
                    name="category"
                    placeholder="Ex.: estrutura, assinaturas"
                    required
                  />
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
                  <input
                    name="paymentMethod"
                    placeholder="Ex.: pix, debito automatico"
                  />
                </label>
                <label className={styles.fieldFull}>
                  <span>Observacao</span>
                  <input name="notes" placeholder="Ex.: fornecedor e detalhes" />
                </label>
              </div>
              <button type="submit" className={styles.secondaryButton}>
                Salvar conta fixa
              </button>
            </form>
          </section>
        </div>
      </div>
    </div>
  );
}
