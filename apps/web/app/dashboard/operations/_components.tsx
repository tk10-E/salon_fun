import Image from "next/image";
import Link from "next/link";

import {
  runSalonAutoPilotAction,
  saveSalonMonthlyTargetsAction,
  saveStaffCommissionSettingsAction,
  updateCustomerProductOrderStatusAction,
  sendCustomerReactivationAction,
} from "@/app/actions";
import { OPERATIONS_PATH } from "@/app/_actions/shared";
import { EmptyStateCard } from "@/components/EmptyStateCard";

import type { OperationsPageData } from "./_lib";

type OperationsPageContentProps = {
  data: OperationsPageData;
};

export function OperationsPageContent({ data }: OperationsPageContentProps) {
  return (
    <>
      <OperationsHeader header={data.header} />
      <OperationsGoalsSection goals={data.goals} />
      <OperationsInsightsSection insights={data.insights} />
      <OperationsCustomersAttentionSection
        customersAttention={data.customersAttention}
      />
      <OperationsTeamSection team={data.team} />
      <OperationsStoreOrdersSection store={data.store} />
      <OperationsLowStockSection inventory={data.inventory} />
      <OperationsMovementsSection inventory={data.inventory} />
    </>
  );
}

function OperationsHeader({
  header,
}: {
  header: OperationsPageData["header"];
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Operações</p>
        <h1>Visão executiva das operações do salão</h1>
        <p className="muted">
          Metas do mês, equipe, clientes e loja em uma leitura rápida.
        </p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span className="badge badge--soft">{header.monthLabel}</span>
          <span className="badge badge--confirmed">
            Faturamento {header.currentMonthRevenueLabel}
          </span>
          <span className="badge badge--soft">Ticket médio {header.ticketLabel}</span>
          <span className="badge badge--soft">
            Clientes atendidos {header.currentMonthServedCustomersLabel}
          </span>
          <span className="badge badge--soft">
            Comissões {header.estimatedCommissionsLabel}
          </span>
          <span className="badge badge--accent">{header.storeOrdersLabel}</span>
          <span className="badge badge--pending">
            {header.lowStockProductsLabel}
          </span>
          <span
            className={
              header.autoPilotEnabled
                ? "badge badge--confirmed"
                : "badge badge--soft"
            }
          >
            {header.autoPilotEnabled
              ? "Sugestões automáticas ativas"
              : "Sugestões automáticas pausadas"}
          </span>
        </div>
      </div>

      <div className="simple-row__actions" style={{ flexWrap: "wrap", gap: 8 }}>
        <form action={runSalonAutoPilotAction}>
          <input type="hidden" name="returnPath" value={OPERATIONS_PATH} />
          <button type="submit" className="primary-button">
            Atualizar prioridades agora
          </button>
        </form>
        <Link href="/dashboard/finance" className="secondary-button">
          Caixa
        </Link>
        <Link href="/dashboard/inventory" className="secondary-button">
          Estoque
        </Link>
      </div>
    </header>
  );
}

function OperationsGoalsSection({
  goals,
}: {
  goals: OperationsPageData["goals"];
}) {
  return (
    <section className="card content-card form-panel">
      <div className="section-heading">
        <div>
          <h2>Metas do mês</h2>
          <p className="muted">
            Trabalhe com objetivos reais e acompanhe o ritmo do salão sem
            complicação.
          </p>
        </div>
        <span
          className={
            goals.monthlyTargetSaved ? "badge badge--confirmed" : "badge badge--soft"
          }
        >
          {goals.monthlyTargetSaved ? "Metas salvas" : "Sugestões prontas"}
        </span>
      </div>

      <div className="simple-list">
        <div className="operations-target-grid">
          {goals.cards.map((goal) => (
            <article key={goal.id} className="operations-target-card">
              <div className="operations-target-card__header">
                <div>
                  <p className="eyebrow">{goal.label}</p>
                  <strong className="operations-target-card__value">
                    {goal.currentLabel}
                  </strong>
                </div>
                <span className="badge badge--soft">Meta {goal.targetLabel}</span>
              </div>
              <div
                className="operations-progress"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={goal.progress}
                aria-label={`${goal.label} no mês`}
              >
                <div
                  className="operations-progress__fill"
                  style={{ width: `${goal.progress}%` }}
                />
              </div>
              <p className="operations-target-card__note">{goal.note}</p>
            </article>
          ))}
        </div>

        <form action={saveSalonMonthlyTargetsAction} className="simple-form">
          <input type="hidden" name="returnPath" value={OPERATIONS_PATH} />
          <input
            type="hidden"
            name="referenceMonth"
            value={goals.currentMonthReference}
          />
          <div className="split-grid operations-target-form-grid">
            <div className="field">
              <label htmlFor="operations-revenue-goal">Meta de faturamento</label>
              <input
                id="operations-revenue-goal"
                name="revenueGoal"
                type="number"
                min="0"
                step="50"
                defaultValue={goals.cards[0]?.targetValue ?? 0}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="operations-completed-goal">
                Meta de atendimentos
              </label>
              <input
                id="operations-completed-goal"
                name="completedAppointmentsGoal"
                type="number"
                min="0"
                step="1"
                defaultValue={goals.cards[1]?.targetValue ?? 0}
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
                defaultValue={goals.cards[2]?.targetValue ?? 0}
                required
              />
            </div>
          </div>
          <div
            className="simple-row__actions"
            style={{ justifyContent: "space-between" }}
          >
            <small className="list-meta">{goals.helperText}</small>
            <button type="submit" className="primary-button">
              Salvar metas do mês
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}

function OperationsInsightsSection({
  insights,
}: {
  insights: OperationsPageData["insights"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Leitura rápida do mês</h2>
          <p className="muted">
            Os sinais principais para decidir a próxima ação.
          </p>
        </div>
      </div>

      <div className="simple-list">
        <article className="simple-row">
          <h3>Receita e ticket</h3>
          <p className="muted">{insights.revenueSummary}</p>
          <small className="list-meta">{insights.ticketSummary}</small>
        </article>

        <article className="simple-row">
          <h3>Serviço e cliente destaque</h3>
          <p className="muted">{insights.serviceSummary}</p>
          <small className="list-meta">{insights.topCustomerSummary}</small>
        </article>

        <article className="simple-row">
          <h3>Horário e cancelamento</h3>
          <p className="muted">{insights.bestHourSummary}</p>
          <small className="list-meta">{insights.cancelRateSummary}</small>
        </article>

        {insights.highlights.length ? (
          <article className="simple-row">
            <h3>Resumo executivo</h3>
            <ul className="muted operations-insights-list">
              {insights.highlights.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ) : null}
      </div>
    </section>
  );
}

function OperationsCustomersAttentionSection({
  customersAttention,
}: {
  customersAttention: OperationsPageData["customersAttention"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Clientes que pedem atenção</h2>
          <p className="muted">Estágio da base e quem merece reativação agora.</p>
        </div>
      </div>

      <div className="simple-list">
        <article className="simple-row">
          <h3>Base por estágio</h3>
          <p className="muted">Um retrato rápido para orientar retenção e retorno.</p>
          <div className="simple-row__grid">
            <div className="stat-card">
              <strong>{customersAttention.stageCounters.novo}</strong>
              <small>Novos (≤30d)</small>
            </div>
            <div className="stat-card">
              <strong>{customersAttention.stageCounters.retorno}</strong>
              <small>Retorno (≤60d)</small>
            </div>
            <div className="stat-card">
              <strong>{customersAttention.stageCounters.fidelizado}</strong>
              <small>Fidelizados (3+ visitas)</small>
            </div>
            <div className="stat-card">
              <strong>{customersAttention.stageCounters.perdido}</strong>
              <small>Perdidos (&gt;60d)</small>
            </div>
          </div>
          <p className="muted" style={{ marginTop: 6 }}>
            Ação sugerida: acompanhar novos, recuperar perdidos e ativar retorno
            dos clientes recentes.
          </p>
        </article>

        <article className="simple-row">
          <h3>Clientes para reativar agora</h3>
          <p className="muted">Top clientes há mais de 60 dias sem voltar.</p>
          {!customersAttention.lostCustomers.length ? (
            <p className="muted">Nenhum cliente perdido no momento.</p>
          ) : (
            customersAttention.lostCustomers.map((customer) => (
              <div
                key={customer.id}
                className="simple-row"
                style={{ marginTop: 8, borderColor: "var(--dashboard-border)" }}
              >
                <div
                  className="inline-actions"
                  style={{ flexWrap: "wrap", marginBottom: 6 }}
                >
                  <span className="badge badge--pending">
                    {customer.stageBadges[0]}
                  </span>
                  <span className="badge badge--soft">{customer.stageBadges[1]}</span>
                  {customer.lastVisitLabel ? (
                    <span className="badge badge--soft">
                      {customer.lastVisitLabel}
                    </span>
                  ) : null}
                </div>
                <h3>{customer.name}</h3>
                <p className="muted">{customer.contactSummary}</p>
                {customer.hasContact ? (
                  <div className="simple-row__actions" style={{ flexWrap: "wrap", gap: 8 }}>
                    <form action={sendCustomerReactivationAction}>
                      <input type="hidden" name="customerName" value={customer.name} />
                      <input
                        type="hidden"
                        name="customerPhone"
                        value={customer.phoneValue}
                      />
                      <input type="hidden" name="returnPath" value={OPERATIONS_PATH} />
                      <button type="submit" className="primary-button">
                        Enviar pelo painel
                      </button>
                    </form>
                    <a
                      href={customer.whatsappUrl ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className="secondary-button"
                    >
                      Abrir no WhatsApp
                    </a>
                  </div>
                ) : null}
              </div>
            ))
          )}
        </article>
      </div>
    </section>
  );
}

function OperationsTeamSection({
  team,
}: {
  team: OperationsPageData["team"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Equipe em foco</h2>
          <p className="muted">Top profissionais e comissão rápida.</p>
        </div>
      </div>

      {!team.members.length ? (
        <EmptyStateCard
          eyebrow="Sem ranking"
          title="Nenhum profissional ranqueado ainda"
          description="Assim que os atendimentos concluídos entrarem, o ranking aparece aqui."
        />
      ) : (
        <div className="simple-list">
          {team.members.map((staffMember) => (
            <article key={staffMember.id} className="simple-row">
              <div className="inline-actions" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                <span className={staffMember.statusBadgeClass}>
                  {staffMember.statusLabel}
                </span>
                <span className="badge badge--soft">
                  {staffMember.assignedServicesSummary}
                </span>
              </div>
              <h3>{staffMember.name}</h3>
              <p className="muted">{staffMember.roleSummary}</p>
              <small className="list-meta">{staffMember.performanceSummary}</small>

              <details className="accordion" style={{ marginTop: 8 }}>
                <summary>
                  <span>Comissão</span>
                  <span className="accordion__cta">editar</span>
                </summary>
                <div className="simple-form" style={{ marginTop: 8 }}>
                  <form action={saveStaffCommissionSettingsAction} className="simple-form">
                    <input type="hidden" name="staffMemberId" value={staffMember.id} />
                    <div className="split-grid">
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
                    <button type="submit" className="secondary-button">
                      Salvar comissão
                    </button>
                  </form>
                </div>
              </details>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function OperationsStoreOrdersSection({
  store,
}: {
  store: OperationsPageData["store"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Pedidos da loja</h2>
          <p className="muted">Fila curta com ações rápidas.</p>
        </div>
      </div>

      <div className="simple-list">
        {!store.orders.length ? (
          <EmptyStateCard
            eyebrow="Sem pedidos"
            title="A fila aparece aqui"
            description="Quando a cliente comprar pelo app, o pedido entra nesta lista."
          />
        ) : (
          store.orders.map((order) => (
            <article key={order.id} className="simple-row">
              <div className="inline-actions" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                <span className={order.statusBadgeClass}>{order.statusLabel}</span>
                <span className="badge badge--soft">{order.orderNumberLabel}</span>
                <span className="badge badge--soft">{order.totalItemsLabel}</span>
                <span className="badge badge--soft">{order.orderMomentLabel}</span>
              </div>
              <h3>{order.customerName}</h3>
              <p className="muted">{order.itemsSummary}</p>
              <small className="list-meta">
                Total {order.totalLabel} • Contato: {order.contactLabel}
              </small>
              {order.notes ? (
                <p className="muted" style={{ marginTop: 6 }}>
                  Obs: {order.notes}
                </p>
              ) : null}

              {order.status !== "completed" && order.status !== "cancelled" ? (
                <div className="simple-row__actions" style={{ flexWrap: "wrap" }}>
                  {order.canConfirm ? (
                    <form action={updateCustomerProductOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value="confirmed" />
                      <button type="submit" className="primary-button">
                        Confirmar
                      </button>
                    </form>
                  ) : null}
                  {order.canReady ? (
                    <form action={updateCustomerProductOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value="ready" />
                      <button type="submit" className="secondary-button">
                        Pronto
                      </button>
                    </form>
                  ) : null}
                  {order.canComplete ? (
                    <form action={updateCustomerProductOrderStatusAction}>
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button type="submit" className="primary-button">
                        Concluir
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              {order.canCancel ? (
                <form
                  action={updateCustomerProductOrderStatusAction}
                  className="simple-form"
                  style={{ marginTop: 10 }}
                >
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value="cancelled" />
                  <div className="split-grid">
                    <div className="field">
                      <label htmlFor={`cancel-store-order-${order.id}`}>
                        Motivo do cancelamento
                      </label>
                      <input
                        id={`cancel-store-order-${order.id}`}
                        name="cancellationReason"
                        placeholder="Ex.: cliente desistiu, item indisponível"
                        required
                      />
                    </div>
                    <div className="inline-actions" style={{ alignItems: "flex-end" }}>
                      <button type="submit" className="secondary-button">
                        Cancelar
                      </button>
                    </div>
                  </div>
                </form>
              ) : null}
            </article>
          ))
        )}
      </div>
    </section>
  );
}

function OperationsLowStockSection({
  inventory,
}: {
  inventory: OperationsPageData["inventory"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Produtos em alerta</h2>
          <p className="muted">Itens no mínimo.</p>
        </div>
      </div>

      {inventory.lowStockProducts.length ? (
        <div className="simple-list">
          {inventory.lowStockProducts.map((product) => (
            <article
              key={product.id}
              className="simple-row"
              style={{ display: "flex", gap: 12 }}
            >
              <div
                style={{
                  width: 80,
                  height: 60,
                  borderRadius: 10,
                  overflow: "hidden",
                  border: "1px solid var(--dashboard-border)",
                  background: "#f8fafc",
                  position: "relative",
                }}
              >
                {product.imageUrl ? (
                  <Image
                    src={product.imageUrl}
                    alt={product.name}
                    fill
                    sizes="80px"
                    style={{ objectFit: "cover" }}
                  />
                ) : null}
              </div>
              <div>
                <h3>{product.name}</h3>
                <p className="muted">
                  {product.stockLabel} • mínimo {product.minimumStockLabel}
                </p>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Estoque saudável"
          title="Nenhum item abaixo do mínimo"
          description="Quando faltar, aparece aqui."
        />
      )}
    </section>
  );
}

function OperationsMovementsSection({
  inventory,
}: {
  inventory: OperationsPageData["inventory"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Movimentos recentes</h2>
          <p className="muted">Entradas, saídas e ajustes.</p>
        </div>
      </div>

      {!inventory.movements.length ? (
        <EmptyStateCard
          eyebrow="Sem movimentos"
          title="Nada registrado"
          description="Entradas, saídas e ajustes aparecem aqui."
        />
      ) : (
        <div className="simple-list">
          {inventory.movements.map((movement) => (
            <article key={movement.id} className="simple-row">
              <div className="inline-actions" style={{ marginBottom: 6, flexWrap: "wrap" }}>
                <span className="badge badge--soft">{movement.movementLabel}</span>
                <span className="badge badge--soft">{movement.createdAtLabel}</span>
              </div>
              <h3>{movement.productName}</h3>
              <p className="muted">
                {movement.quantityLabel} • saldo {movement.resultingStockLabel}
              </p>
              {movement.reason ? (
                <small className="list-meta">{movement.reason}</small>
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
