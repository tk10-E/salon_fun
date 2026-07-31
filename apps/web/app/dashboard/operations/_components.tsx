import Image from "next/image";
import Link from "next/link";

import {
  saveSalonMonthlyTargetsAction,
  saveStaffCommissionSettingsAction,
  updateCustomerProductOrderStatusAction,
} from "@/app/actions";
import { OPERATIONS_PATH } from "@/app/_actions/shared";
import { EmptyStateCard } from "@/components/EmptyStateCard";

import type { OperationsPageData } from "./_lib";
import styles from "./page.module.css";

type OperationsPageContentProps = {
  data: OperationsPageData;
  searchParams?: {
    message?: string;
    orderState?: string;
    tone?: string;
  };
};

function normalizeValue(value?: string | null) {
  return value?.trim() ?? "";
}

function buildOperationsHref(
  current: OperationsPageContentProps["searchParams"],
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (current) {
    for (const [key, value] of Object.entries(current)) {
      if (key === "message" || key === "tone") {
        continue;
      }

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
  return `${OPERATIONS_PATH}${query ? `?${query}` : ""}`;
}

function buildMetricCards(data: OperationsPageData) {
  return [
    {
      accent: "#5b4bce",
      label: "Faturamento do mês",
      meta: data.header.monthLabel,
      value: data.header.currentMonthRevenueLabel,
    },
    {
      accent: "#7b54f5",
      label: "Ticket médio",
      meta: "Leitura atual",
      value: data.header.ticketLabel,
    },
    {
      accent: "#ef7f1a",
      label: "Clientes atendidos",
      meta: "No mês corrente",
      value: data.header.currentMonthServedCustomersLabel,
    },
    {
      accent: "#f15b87",
      label: "Comissões",
      meta: "Estimativa em curso",
      value: data.header.estimatedCommissionsLabel,
    },
    {
      accent: "#5b4bce",
      label: "Pedidos da loja",
      meta: "Fila comercial",
      value: data.header.storeOrdersLabel,
    },
    {
      accent: "#ef7f1a",
      label: "Estoque em alerta",
      meta: "Itens abaixo do mínimo",
      value: data.header.lowStockProductsLabel,
    },
  ];
}

function statusFilterMatches(
  statusFilter: string,
  status: OperationsPageData["store"]["orders"][number]["status"],
) {
  return statusFilter === "all" || statusFilter === status;
}

export function OperationsPageContent({
  data,
  searchParams,
}: OperationsPageContentProps) {
  const metricCards = buildMetricCards(data);
  const orderState = normalizeValue(searchParams?.orderState) || "all";
  const currentOperationsHref = buildOperationsHref(searchParams, {});
  const storeOrdersSectionHref = `${currentOperationsHref}#store-orders`;
  const filteredOrders = data.store.orders.filter((order) =>
    statusFilterMatches(orderState, order.status),
  );
  const orderCounts = {
    all: data.store.orders.length,
    cancelled: data.store.orders.filter((order) => order.status === "cancelled").length,
    completed: data.store.orders.filter((order) => order.status === "completed").length,
    confirmed: data.store.orders.filter((order) => order.status === "confirmed").length,
    pending: data.store.orders.filter((order) => order.status === "pending").length,
    ready: data.store.orders.filter((order) => order.status === "ready").length,
  };
  const statusOptions = [
    { label: "Todos", value: "all" },
    { label: "Novos", value: "pending" },
    { label: "Separando", value: "confirmed" },
    { label: "Prontos", value: "ready" },
    { label: "Concluídos", value: "completed" },
    { label: "Cancelados", value: "cancelled" },
  ];

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.headerRow}>
          <div>
            <p className={styles.eyebrow}>Operação integrada</p>
            <h1>Pedidos, equipe e rotina do salão</h1>
            <p className={styles.lead}>
              Loja, metas, equipe e estoque em uma leitura única para agir rápido
              com dados reais.
            </p>
          </div>

          <div className={styles.headerActions}>
            <Link href="/dashboard/inventory" className={styles.secondaryButton}>
              Loja e estoque
            </Link>
            <Link href="/dashboard/finance" className={styles.primaryButton}>
              Caixa
            </Link>
          </div>
        </div>

        <div className={styles.metricGrid}>
          {metricCards.map((card) => (
            <article key={card.label} className={styles.metricCard}>
              <span className={styles.metricLabel}>{card.label}</span>
              <strong className={styles.metricValue}>{card.value}</strong>
              <small className={styles.metricMeta}>{card.meta}</small>
              <div className={styles.metricSpark}>
                <span style={{ background: card.accent }} />
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <article id="store-orders" className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Pedidos da loja</p>
                <h2>Fila comercial do app</h2>
              </div>
              <div className={styles.badgeRow}>
                <span className={styles.countPill}>
                  Leitura: {statusOptions.find((item) => item.value === orderState)?.label}
                </span>
                <span className={styles.countPill}>{filteredOrders.length} pedido(s)</span>
              </div>
            </div>

            <div className={styles.tabRow}>
              {statusOptions.map((status) => (
                <a
                  key={status.value}
                  href={`${buildOperationsHref(searchParams, {
                    orderState: status.value === "all" ? undefined : status.value,
                  })}#store-orders`}
                  className={
                    orderState === status.value
                      ? styles.tabActive
                      : styles.tabLink
                  }
                >
                  {status.label}
                  <span>{orderCounts[status.value as keyof typeof orderCounts]}</span>
                </a>
              ))}
            </div>

            {!filteredOrders.length ? (
              <EmptyStateCard
                eyebrow="Sem pedidos"
                title="A fila da loja está vazia neste recorte"
                description="Quando a cliente comprar pelo app, o pedido entra aqui para confirmar, separar e entregar."
              />
            ) : (
              <div className={styles.orderGrid}>
                {filteredOrders.map((order) => (
                  <article key={order.id} className={styles.orderCard}>
                    <div className={styles.orderHeader}>
                      <div className={styles.badgeRow}>
                        <span className={order.statusBadgeClass}>{order.statusLabel}</span>
                        <span className={styles.orderChip}>{order.orderNumberLabel}</span>
                        <span className={styles.orderChip}>{order.totalItemsLabel}</span>
                      </div>
                      <strong className={styles.orderValue}>{order.totalLabel}</strong>
                    </div>

                    <h3>{order.customerName}</h3>
                    <p className={styles.orderCopy}>{order.itemsSummary}</p>

                    <div className={styles.orderMetaGrid}>
                      <div className={styles.metaTile}>
                        <span>Contato</span>
                        <strong>{order.contactLabel}</strong>
                      </div>
                      <div className={styles.metaTile}>
                        <span>Momento</span>
                        <strong>{order.orderMomentLabel}</strong>
                      </div>
                    </div>

                    {order.notes ? (
                      <p className={styles.orderNote}>Obs: {order.notes}</p>
                    ) : null}

                    {order.status !== "completed" && order.status !== "cancelled" ? (
                      <div className={styles.actionRow}>
                        {order.canConfirm ? (
                          <form action={updateCustomerProductOrderStatusAction}>
                            <input type="hidden" name="returnPath" value={storeOrdersSectionHref} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="status" value="confirmed" />
                            <button type="submit" className={styles.primaryButton}>
                              Confirmar
                            </button>
                          </form>
                        ) : null}
                        {order.canReady ? (
                          <form action={updateCustomerProductOrderStatusAction}>
                            <input type="hidden" name="returnPath" value={storeOrdersSectionHref} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="status" value="ready" />
                            <button type="submit" className={styles.secondaryButton}>
                              Pronto
                            </button>
                          </form>
                        ) : null}
                        {order.canComplete ? (
                          <form action={updateCustomerProductOrderStatusAction}>
                            <input type="hidden" name="returnPath" value={storeOrdersSectionHref} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="status" value="completed" />
                            <button type="submit" className={styles.primaryButton}>
                              Concluir
                            </button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}

                    {order.canCancel ? (
                      <details className={styles.disclosure}>
                        <summary>Cancelar pedido</summary>
                        <form action={updateCustomerProductOrderStatusAction} className={styles.inlineForm}>
                          <input type="hidden" name="returnPath" value={storeOrdersSectionHref} />
                          <input type="hidden" name="orderId" value={order.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <div className="field">
                            <label htmlFor={`cancel-store-order-${order.id}`}>
                              Motivo do cancelamento
                            </label>
                            <input
                              id={`cancel-store-order-${order.id}`}
                              name="cancellationReason"
                              placeholder="Ex.: item indisponivel"
                              required
                            />
                          </div>
                          <button type="submit" className={styles.dangerButton}>
                            Confirmar cancelamento
                          </button>
                        </form>
                      </details>
                    ) : null}
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Equipe</p>
                <h2>Profissionais em foco</h2>
              </div>
            </div>

            {!data.team.members.length ? (
              <EmptyStateCard
                eyebrow="Sem ranking"
                title="A equipe aparece aqui quando houver operação"
                description="Assim que os atendimentos forem concluídos, a leitura de comissão e performance ganha corpo."
              />
            ) : (
              <div className={styles.teamGrid}>
                {data.team.members.map((staffMember) => (
                  <article key={staffMember.id} className={styles.teamCard}>
                    <div className={styles.teamHeader}>
                      <div>
                        <div className={styles.badgeRow}>
                          <span className={staffMember.statusBadgeClass}>
                            {staffMember.statusLabel}
                          </span>
                        </div>
                        <h3>{staffMember.name}</h3>
                        <p className={styles.teamMeta}>{staffMember.roleSummary}</p>
                      </div>
                      <div className={styles.teamCommission}>
                        <span>Comissão</span>
                        <strong>{staffMember.estimatedCommissionLabel}</strong>
                      </div>
                    </div>

                    <p className={styles.teamSummary}>{staffMember.performanceSummary}</p>
                    <div className={styles.progressCard}>
                      <div className={styles.progressHeader}>
                        <span>Serviços ligados</span>
                        <strong>{staffMember.assignedServicesSummary}</strong>
                      </div>
                      <div className={styles.progressTrack}>
                        <span style={{ width: `${Math.min(staffMember.commissionRatePercent, 100)}%` }} />
                      </div>
                      <small>{staffMember.commissionRatePercent}% de comissão variável</small>
                    </div>

                    <details className={styles.disclosure}>
                      <summary>Editar comissão</summary>
                      <form action={saveStaffCommissionSettingsAction} className={styles.inlineForm}>
                        <input type="hidden" name="staffMemberId" value={staffMember.id} />
                        <div className={styles.fieldGrid}>
                          <div className="field">
                            <label htmlFor={`commission-rate-${staffMember.id}`}>
                              Comissão (%)
                            </label>
                            <input
                              id={`commission-rate-${staffMember.id}`}
                              name="commissionRatePercent"
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              defaultValue={staffMember.commissionRatePercent}
                              required
                            />
                          </div>
                          <div className="field">
                            <label htmlFor={`commission-flat-${staffMember.id}`}>Fixo</label>
                            <input
                              id={`commission-flat-${staffMember.id}`}
                              name="commissionFlatFee"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={staffMember.commissionFlatFee}
                              required
                            />
                          </div>
                        </div>
                        <button type="submit" className={styles.secondaryButton}>
                          Salvar comissão
                        </button>
                      </form>
                    </details>
                  </article>
                ))}
              </div>
            )}
          </article>

          <article className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Metas do mês</p>
                <h2>Ritmo operacional</h2>
              </div>
              <span className={styles.countPill}>{data.goals.monthLabel}</span>
            </div>

            <div className={styles.goalGrid}>
              {data.goals.cards.map((goal) => (
                <article key={goal.id} className={styles.goalCard}>
                  <span>{goal.label}</span>
                  <strong>{goal.currentLabel}</strong>
                  <small>Meta {goal.targetLabel}</small>
                  <div className={styles.progressTrack}>
                    <span style={{ width: `${goal.progress}%` }} />
                  </div>
                  <p>{goal.note}</p>
                </article>
              ))}
            </div>

            <form action={saveSalonMonthlyTargetsAction} className={styles.inlineForm}>
              <input type="hidden" name="returnPath" value={OPERATIONS_PATH} />
              <input
                type="hidden"
                name="referenceMonth"
                value={data.goals.currentMonthReference}
              />
              <div className={styles.fieldGrid}>
                <div className="field">
                  <label htmlFor="operations-revenue-goal">Meta de faturamento</label>
                  <input
                    id="operations-revenue-goal"
                    name="revenueGoal"
                    type="number"
                    min="0"
                    step="50"
                    defaultValue={data.goals.cards[0]?.targetValue ?? 0}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="operations-completed-goal">Meta de atendimentos</label>
                  <input
                    id="operations-completed-goal"
                    name="completedAppointmentsGoal"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={data.goals.cards[1]?.targetValue ?? 0}
                    required
                  />
                </div>
                <div className="field">
                  <label htmlFor="operations-served-customers-goal">
                    Meta de clientes atendidos
                  </label>
                  <input
                    id="operations-served-customers-goal"
                    name="servedCustomersGoal"
                    type="number"
                    min="0"
                    step="1"
                    defaultValue={data.goals.cards[2]?.targetValue ?? 0}
                    required
                  />
                </div>
              </div>
              <div className={styles.footerRow}>
                <small>{data.goals.helperText}</small>
                <button type="submit" className={styles.primaryButton}>
                  Salvar metas do mês
                </button>
              </div>
            </form>
          </article>
        </div>

        <div className={styles.sidebarColumn}>
          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Piloto do salão</p>
                <h3>Agenda automática</h3>
              </div>
              <div className={styles.badgeRow}>
                <span
                  className={
                    data.autopilot.active
                      ? "badge badge--confirmed"
                      : "badge badge--pending"
                  }
                >
                  {data.autopilot.active ? "Ligado" : "Desligado"}
                </span>
                <span
                  className={
                    data.autopilot.schedulerReady
                      ? "badge badge--soft"
                      : "badge badge--pending"
                  }
                >
                  {data.autopilot.schedulerReady
                    ? "Agendador pronto"
                    : "Agendador pendente"}
                </span>
              </div>
            </div>

            <p className={styles.sidebarCopy}>{data.autopilot.statusNote}</p>

            <div className={styles.counterGrid}>
              {data.autopilot.cards.map((card) => (
                <div key={card.id} className={styles.counterCard}>
                  <span>{card.label}</span>
                  <strong>{card.value}</strong>
                  <small>{card.note}</small>
                </div>
              ))}
            </div>

            <div className={styles.ruleList}>
              {data.autopilot.rules.map((rule) => (
                <p key={rule}>{rule}</p>
              ))}
            </div>

            {!data.autopilot.queue.length ? (
              <p className={styles.sidebarCopy}>
                Nenhum horário sensível agora. O sistema segue a regra sozinho.
              </p>
            ) : (
              <div className={styles.alertList}>
                {data.autopilot.queue.map((item) => (
                  <div key={item.id} className={styles.alertRow}>
                    <div className={styles.badgeRow}>
                      <span className={item.badgeClassName}>{item.badgeLabel}</span>
                      {item.signalBadges.map((signal) => (
                        <span key={signal} className="badge badge--soft">
                          {signal}
                        </span>
                      ))}
                    </div>
                    <strong>{item.title}</strong>
                    <span>{item.meta}</span>
                    <small>{item.note}</small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Leitura do mês</p>
                <h3>Sinais executivos</h3>
              </div>
            </div>
            <div className={styles.insightStack}>
              <div className={styles.insightRow}>
                <strong>Receita e ticket</strong>
                <span>{data.insights.revenueSummary}</span>
                <small>{data.insights.ticketSummary}</small>
              </div>
              <div className={styles.insightRow}>
                <strong>Serviço e cliente</strong>
                <span>{data.insights.serviceSummary}</span>
                <small>{data.insights.topCustomerSummary}</small>
              </div>
              <div className={styles.insightRow}>
                <strong>Horário e cancelamento</strong>
                <span>{data.insights.bestHourSummary}</span>
                <small>{data.insights.cancelRateSummary}</small>
              </div>
            </div>
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Clientes em atenção</p>
                <h3>Base e reativação</h3>
              </div>
            </div>
            <div className={styles.counterGrid}>
              <div className={styles.counterCard}>
                <span>Novos</span>
                <strong>{data.customersAttention.stageCounters.novo}</strong>
              </div>
              <div className={styles.counterCard}>
                <span>Retorno</span>
                <strong>{data.customersAttention.stageCounters.retorno}</strong>
              </div>
              <div className={styles.counterCard}>
                <span>Fidelizados</span>
                <strong>{data.customersAttention.stageCounters.fidelizado}</strong>
              </div>
              <div className={styles.counterCard}>
                <span>Perdidos</span>
                <strong>{data.customersAttention.stageCounters.perdido}</strong>
              </div>
            </div>

            {!data.customersAttention.lostCustomers.length ? (
              <p className={styles.sidebarCopy}>Nenhum cliente perdido no momento.</p>
            ) : (
              <div className={styles.alertList}>
                {data.customersAttention.lostCustomers.map((customer) => (
                  <div key={customer.id} className={styles.alertRow}>
                    <strong>{customer.name}</strong>
                    <span>{customer.stageBadges.join(" • ")}</span>
                    <small>{customer.contactSummary}</small>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Produtos em alerta</p>
                <h3>Estoque sob vigia</h3>
              </div>
            </div>
            {!data.inventory.lowStockProducts.length ? (
              <p className={styles.sidebarCopy}>Nenhum item abaixo do minimo agora.</p>
            ) : (
              <div className={styles.stockList}>
                {data.inventory.lowStockProducts.map((product) => (
                  <div key={product.id} className={styles.stockRow}>
                    <div className={styles.stockThumb}>
                      {product.imageUrl ? (
                        <Image
                          src={product.imageUrl}
                          alt={product.name}
                          fill
                          sizes="72px"
                        />
                      ) : null}
                    </div>
                    <div>
                      <strong>{product.name}</strong>
                      <span>{product.stockLabel}</span>
                      <small>Minimo {product.minimumStockLabel}</small>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.sidebarEyebrow}>Movimentos recentes</p>
                <h3>Entrada, saida e ajuste</h3>
              </div>
            </div>
            {!data.inventory.movements.length ? (
              <p className={styles.sidebarCopy}>Nada registrado no momento.</p>
            ) : (
              <div className={styles.alertList}>
                {data.inventory.movements.map((movement) => (
                  <div key={movement.id} className={styles.alertRow}>
                    <strong>{movement.productName}</strong>
                    <span>
                      {movement.movementLabel} • {movement.quantityLabel}
                    </span>
                    <small>
                      Saldo {movement.resultingStockLabel}
                      {movement.reason ? ` • ${movement.reason}` : ""}
                    </small>
                  </div>
                ))}
              </div>
            )}
          </article>
        </div>
      </section>
    </div>
  );
}
