import Link from "next/link";

import {
  registerInventoryMovementAction,
  saveInventoryProductAction,
  saveStaffCommissionSettingsAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

type OperationsPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

type OperationsDashboardResponse = {
  overview: {
    active_inventory_products: number;
    active_staff_members: number;
    average_ticket: number | string;
    estimated_commissions: number | string;
    low_stock_products: number;
    top_staff_name: string | null;
    top_staff_revenue: number | string;
    total_revenue: number | string;
  };
  daily_revenue: Array<{
    completed_appointments: number;
    day: string;
    total_revenue: number | string;
  }>;
  top_staff: Array<{
    assigned_services: number;
    commission_flat_fee: number | string;
    commission_rate_percent: number | string;
    completed_appointments: number;
    estimated_commission: number | string;
    id: string;
    is_active: boolean;
    name: string;
    next_appointment_at: string | null;
    pending_appointments: number;
    role: string | null;
    total_revenue: number | string;
    upcoming_appointments: number;
  }>;
  staff_agenda: Array<{
    assigned_services: number;
    commission_flat_fee: number | string;
    commission_rate_percent: number | string;
    id: string;
    is_active: boolean;
    name: string;
    next_appointment_at: string | null;
    pending_appointments: number;
    role: string | null;
    upcoming_appointments: number;
  }>;
};

type InventoryProductRow = {
  id: string;
  name: string;
  brand: string | null;
  sku: string | null;
  unit: string;
  current_stock: number | string;
  minimum_stock: number | string;
  cost_price: number | string | null;
  retail_price: number | string | null;
  is_active: boolean;
  updated_at: string;
};

type InventoryMovementRow = {
  id: string;
  movement_type: "in" | "out" | "adjustment";
  quantity: number | string;
  previous_stock: number | string;
  resulting_stock: number | string;
  reason: string | null;
  created_at: string;
  inventory_products: { name: string } | { name: string }[] | null;
  staff_members: { name: string } | { name: string }[] | null;
};

type StaffOption = {
  id: string;
  is_active: boolean;
  name: string;
};

function firstRelation<T>(value: T | T[] | null) {
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

function formatPercent(value: number | string) {
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(Number(value))}%`;
}

function formatStock(value: number | string, unit: string) {
  const numericValue = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
  return `${formatted} ${unit}`;
}

function formatMovementLabel(value: InventoryMovementRow["movement_type"]) {
  switch (value) {
    case "in":
      return "Entrada";
    case "out":
      return "Saída";
    default:
      return "Ajuste";
  }
}

export default async function OperationsPage({ searchParams }: OperationsPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [operationsResult, inventoryProductsResult, inventoryMovementsResult, staffOptionsResult] =
    await Promise.all([
      supabase.rpc("get_owner_operations_dashboard", {
        days_input: 7,
        top_staff_limit_input: 5,
      }),
      supabase
        .from("inventory_products")
        .select("id, name, brand, sku, unit, current_stock, minimum_stock, cost_price, retail_price, is_active, updated_at")
        .eq("salon_id", salon.id)
        .order("is_active", { ascending: false })
        .order("name"),
      supabase
        .from("inventory_movements")
        .select("id, movement_type, quantity, previous_stock, resulting_stock, reason, created_at, inventory_products(name), staff_members(name)")
        .eq("salon_id", salon.id)
        .order("created_at", { ascending: false })
        .limit(8),
      supabase
        .from("staff_members")
        .select("id, name, is_active")
        .eq("salon_id", salon.id)
        .order("name"),
    ]);

  const operations = (operationsResult.data ?? {
    overview: {
      active_inventory_products: 0,
      active_staff_members: 0,
      average_ticket: 0,
      estimated_commissions: 0,
      low_stock_products: 0,
      top_staff_name: null,
      top_staff_revenue: 0,
      total_revenue: 0,
    },
    daily_revenue: [],
    top_staff: [],
    staff_agenda: [],
  }) as OperationsDashboardResponse;
  const inventoryProducts = ((inventoryProductsResult.data ?? []) as InventoryProductRow[]).sort((left, right) => {
    const leftLow = Number(left.current_stock) <= Number(left.minimum_stock);
    const rightLow = Number(right.current_stock) <= Number(right.minimum_stock);

    if (leftLow != rightLow) {
      return leftLow ? -1 : 1;
    }

    if (left.is_active !== right.is_active) {
      return left.is_active ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
  const inventoryMovements = (inventoryMovementsResult.data ?? []) as InventoryMovementRow[];
  const staffOptions = ((staffOptionsResult.data ?? []) as StaffOption[]).filter((staffMember) => staffMember.is_active);

  return (
    <div className="page-grid dashboard-home operations-page workspace-page">
      {searchParams?.message ? <FlashMessage message={searchParams.message} tone={searchParams.tone} /> : null}

      <DashboardWorkspaceHero
        eyebrow="Financeiro e estoque"
        title="Operação do salão em tempo real"
        description="Receita, comissão, equipe e estoque no mesmo fluxo operacional, com leitura mais rápida para tomar decisão e agir antes do problema bater na agenda."
        highlight={{
          label: "Quem mais rende agora",
          value: operations.overview.top_staff_name ?? "Sem ranking ainda",
          note: operations.overview.top_staff_name
            ? `${formatCurrency(Number(operations.overview.top_staff_revenue ?? 0))} gerados no recorte atual pela pessoa líder de faturamento.`
            : "Assim que houver atendimentos concluídos com profissional, o ranking aparece aqui.",
        }}
        signals={[
          {
            label: "Equipe ativa",
            value: operations.overview.active_staff_members ?? 0,
            tone: "soft",
          },
          {
            label: "Estoque em alerta",
            value: operations.overview.low_stock_products ?? 0,
            tone: (operations.overview.low_stock_products ?? 0) > 0 ? "danger" : "success",
          },
          {
            label: "Itens ativos",
            value: operations.overview.active_inventory_products ?? 0,
            tone: "accent",
          },
        ]}
        stats={[
          {
            label: "Caixa dos últimos 7 dias",
            value: formatCurrency(Number(operations.overview.total_revenue ?? 0)),
            note: "Leitura rápida do caixa gerado pelos atendimentos concluídos mais recentes.",
            tone: "warm",
          },
          {
            label: "Ticket atual",
            value: formatCurrency(Number(operations.overview.average_ticket ?? 0)),
            note: "Quanto cada atendimento concluído está deixando, em média, para o salão.",
            tone: "soft",
          },
          {
            label: "Comissão prevista",
            value: formatCurrency(Number(operations.overview.estimated_commissions ?? 0)),
            note: "Estimativa automática baseada nas regras configuradas por profissional.",
            tone: "accent",
          },
          {
            label: "Base de estoque",
            value: operations.overview.active_inventory_products ?? 0,
            note: "Produtos ativos hoje participando do controle operacional do salão.",
            tone: "success",
          },
        ]}
        actions={
          <Link href="/dashboard" className="secondary-button">
            Voltar ao dashboard
          </Link>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Leitura operacional</span>
            <h3>
              {inventoryProducts.length > 0
                ? "Caixa, estoque e equipe agora estão no mesmo ritmo."
                : "O financeiro já está pronto para ganhar controle de estoque."}
            </h3>
            <p>
              Esta área junta rentabilidade, comissionamento e movimentação de produto em uma superfície só, para o salão não depender de leitura espalhada entre várias telas.
            </p>
          </>
        }
      />

      <section className="stats-grid operations-stats-grid">
        <article className="card metric-card metric-card--warm operations-metric-card">
          <span className="eyebrow">Faturamento 7 dias</span>
          <p className="stat-value">{formatCurrency(Number(operations.overview.total_revenue ?? 0))}</p>
          <p className="metric-note">Leitura rápida do caixa gerado pelos atendimentos concluídos mais recentes.</p>
        </article>
        <article className="card metric-card metric-card--soft operations-metric-card">
          <span className="eyebrow">Ticket médio</span>
          <p className="stat-value">{formatCurrency(Number(operations.overview.average_ticket ?? 0))}</p>
          <p className="metric-note">Quanto cada atendimento concluído está deixando, em média, para o salão.</p>
        </article>
        <article className="card metric-card metric-card--accent operations-metric-card">
          <span className="eyebrow">Comissão estimada</span>
          <p className="stat-value">{formatCurrency(Number(operations.overview.estimated_commissions ?? 0))}</p>
          <p className="metric-note">Estimativa automática baseada nas regras configuradas por profissional.</p>
        </article>
        <article className="card metric-card metric-card--soft operations-metric-card">
          <span className="eyebrow">Estoque em alerta</span>
          <p className="stat-value">{operations.overview.low_stock_products ?? 0}</p>
          <p className="metric-note">Produtos que já chegaram ou passaram do mínimo definido no salão.</p>
        </article>
        <article className="card metric-card metric-card--warm operations-metric-card">
          <span className="eyebrow">Equipe ativa</span>
          <p className="stat-value">{operations.overview.active_staff_members ?? 0}</p>
          <p className="metric-note">Profissionais ativos hoje puxando agenda, receita e comissão automática.</p>
        </article>
        <article className="card metric-card metric-card--accent operations-metric-card">
          <span className="eyebrow">Quem mais rende</span>
          <p className="stat-value">{operations.overview.top_staff_name ?? "Sem ranking"}</p>
          <p className="metric-note">
            {operations.overview.top_staff_name
              ? `${formatCurrency(Number(operations.overview.top_staff_revenue ?? 0))} gerados no recorte atual.`
              : "Assim que houver atendimentos concluídos com profissional, o ranking aparece aqui."}
          </p>
        </article>
      </section>

      <div className="two-column-grid operations-layout">
        <section className="page-grid">
          <section className="card content-card operations-card">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Painel profissional</span>
                <h2>Relatórios automáticos do dono</h2>
                <p className="muted">
                  Faturamento por dia, profissional que mais rende, agenda por funcionário e comissão automática em um só lugar.
                </p>
              </div>
            </div>

            <div className="row-list" style={{ marginTop: 18 }}>
              {operations.daily_revenue.length === 0 ? (
                <EmptyStateCard
                  eyebrow="Sem faturamento ainda"
                  title="Os relatórios aparecem quando os atendimentos são concluídos"
                  description="Assim que o salão começar a concluir atendimentos, esta área mostra o faturamento por dia e o ritmo de receita."
                />
              ) : (
                operations.daily_revenue.map((entry) => (
                  <article key={entry.day} className="list-row operations-row">
                    <div className="list-row__content">
                      <h3>{formatDate(entry.day)}</h3>
                      <p className="muted list-description">
                        {entry.completed_appointments} atendimento{entry.completed_appointments === 1 ? "" : "s"} concluído
                        {entry.completed_appointments === 1 ? "" : "s"} nesse dia.
                      </p>
                    </div>
                    <div className="inline-actions">
                      <span className="badge badge--soft">{entry.completed_appointments} concluídos</span>
                      <strong>{formatCurrency(Number(entry.total_revenue ?? 0))}</strong>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="card content-card operations-card">
            <div className="section-heading">
              <div>
                <h2>Profissionais que mais rendem</h2>
                <p className="muted">
                  Receita, comissão estimada e agenda futura de quem mais está puxando o resultado do salão.
                </p>
              </div>
            </div>

            <div className="row-list" style={{ marginTop: 18 }}>
              {!operations.top_staff.length ? (
                <EmptyStateCard
                  eyebrow="Sem ranking ainda"
                  title="O ranking entra quando houver atendimento concluído"
                  description="Assim que os horários forem marcados como atendidos, o sistema passa a ranquear a equipe por receita real."
                />
              ) : (
                operations.top_staff.map((staffMember) => (
                  <article key={staffMember.id} className="list-row customer-card operations-row operations-record">
                    <div className="customer-card__content">
                      <div className="customer-card__header">
                        <div className="list-row__content">
                          <h3>{staffMember.name}</h3>
                          <div className="customer-card__badges">
                            <span className={staffMember.is_active ? "badge badge--confirmed" : "badge badge--cancelled"}>
                              {staffMember.is_active ? "Ativo" : "Pausado"}
                            </span>
                            <span className="badge badge--pending">
                              {staffMember.role?.trim() || "Atendimento do salão"}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="customer-card__metrics">
                        <div className="customer-metric-tile">
                          <span className="customer-detail-item__label">Receita</span>
                          <strong>{formatCurrency(Number(staffMember.total_revenue ?? 0))}</strong>
                        </div>
                        <div className="customer-metric-tile">
                          <span className="customer-detail-item__label">Comissão estimada</span>
                          <strong>{formatCurrency(Number(staffMember.estimated_commission ?? 0))}</strong>
                        </div>
                        <div className="customer-metric-tile">
                          <span className="customer-detail-item__label">Atendidos</span>
                          <strong>{staffMember.completed_appointments}</strong>
                        </div>
                        <div className="customer-metric-tile">
                          <span className="customer-detail-item__label">Agenda futura</span>
                          <strong>{staffMember.upcoming_appointments}</strong>
                        </div>
                      </div>

                      <small className="list-meta">
                        Comissão atual: {formatPercent(staffMember.commission_rate_percent)} +{" "}
                        {formatCurrency(Number(staffMember.commission_flat_fee ?? 0))} por atendimento concluído.
                        {staffMember.next_appointment_at
                          ? ` Próximo horário em ${formatDateTime(staffMember.next_appointment_at)}.`
                          : " Sem horário futuro reservado no momento."}
                      </small>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="card content-card operations-card">
            <div className="section-heading">
              <div>
                <h2>Agenda e comissão por funcionário</h2>
                <p className="muted">
                  A agenda individual já existe no painel da equipe. Aqui ela ganha leitura operacional e regra de comissão automática.
                </p>
              </div>

              <Link href="/dashboard/team" className="secondary-button">
                Abrir equipe e agenda
              </Link>
            </div>

            <div className="row-list" style={{ marginTop: 18 }}>
              {!operations.staff_agenda.length ? (
                <EmptyStateCard
                  eyebrow="Sem equipe"
                  title="Cadastre profissionais para operar agenda e comissão"
                  description="Assim que a equipe existir, o painel passa a resumir agenda futura, pendências e comissão automática por profissional."
                />
              ) : (
                operations.staff_agenda.map((staffMember) => (
                  <article key={staffMember.id} className="list-row service-editor-card operations-row operations-record">
                    <div className="list-row__content">
                      <div className="inline-actions" style={{ marginBottom: 8 }}>
                        <span className={staffMember.is_active ? "badge badge--confirmed" : "badge badge--cancelled"}>
                          {staffMember.is_active ? "Ativo" : "Pausado"}
                        </span>
                        <span className="badge badge--soft">{staffMember.assigned_services} serviços</span>
                        <span className="badge badge--pending">{staffMember.upcoming_appointments} futuros</span>
                      </div>
                      <h3>{staffMember.name}</h3>
                      <p className="muted list-description">
                        {staffMember.role?.trim() || "Atendimento do salão"} •{" "}
                        {staffMember.next_appointment_at
                          ? `próximo horário em ${formatDateTime(staffMember.next_appointment_at)}`
                          : "sem próxima reserva"}.
                      </p>
                      <small className="list-meta">
                        {staffMember.pending_appointments} agenda
                        {staffMember.pending_appointments === 1 ? " pendente" : "s pendentes"} aguardando operação.
                      </small>

                      <form action={saveStaffCommissionSettingsAction} className="form-grid" style={{ marginTop: 16 }}>
                        <input type="hidden" name="staffMemberId" value={staffMember.id} />

                        <div className="split-grid">
                          <div className="field">
                            <label htmlFor={`commission-rate-${staffMember.id}`}>Comissão (%)</label>
                            <input
                              id={`commission-rate-${staffMember.id}`}
                              name="commissionRatePercent"
                              type="number"
                              min="0"
                              max="100"
                              step="0.5"
                              defaultValue={Number(staffMember.commission_rate_percent ?? 0)}
                              required
                            />
                          </div>

                          <div className="field">
                            <label htmlFor={`commission-flat-${staffMember.id}`}>Fixo por atendimento</label>
                            <input
                              id={`commission-flat-${staffMember.id}`}
                              name="commissionFlatFee"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={Number(staffMember.commission_flat_fee ?? 0)}
                              required
                            />
                          </div>
                        </div>

                        <div className="inline-actions">
                          <button type="submit" className="primary-button">
                            Salvar comissão automática
                          </button>
                        </div>
                      </form>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className="page-grid">
          <section className="card content-card form-panel operations-card operations-form-panel">
            <div className="section-heading">
              <div>
                <h2>Controle de estoque</h2>
                <p className="muted">
                  Cadastre produtos, defina o mínimo e registre entradas, saídas e ajustes sem planilha paralela.
                </p>
              </div>
            </div>

            <form action={saveInventoryProductAction} className="form-grid" style={{ marginTop: 18 }}>
              <div className="field">
                <label htmlFor="inventory-name">Produto</label>
                <input id="inventory-name" name="name" placeholder="Ex.: Shampoo reconstrutor" required />
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="inventory-brand">Marca</label>
                  <input id="inventory-brand" name="brand" placeholder="Ex.: Wella" />
                </div>

                <div className="field">
                  <label htmlFor="inventory-sku">SKU interno</label>
                  <input id="inventory-sku" name="sku" placeholder="Ex.: WELLA-001" />
                </div>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="inventory-unit">Unidade</label>
                  <input id="inventory-unit" name="unit" defaultValue="un" required />
                </div>

                <div className="field">
                  <label htmlFor="inventory-current-stock">Estoque inicial</label>
                  <input id="inventory-current-stock" name="currentStock" type="number" min="0" step="0.01" defaultValue="0" required />
                </div>
              </div>

              <div className="split-grid">
                <div className="field">
                  <label htmlFor="inventory-minimum-stock">Estoque mínimo</label>
                  <input id="inventory-minimum-stock" name="minimumStock" type="number" min="0" step="0.01" defaultValue="1" required />
                </div>

                <div className="field">
                  <label htmlFor="inventory-cost-price">Custo</label>
                  <input id="inventory-cost-price" name="costPrice" type="number" min="0" step="0.01" placeholder="0,00" />
                </div>
              </div>

              <div className="field">
                <label htmlFor="inventory-retail-price">Preço de venda</label>
                <input id="inventory-retail-price" name="retailPrice" type="number" min="0" step="0.01" placeholder="0,00" />
              </div>

              <label className="checkbox-field">
                <input type="checkbox" name="isActive" defaultChecked />
                Produto ativo no estoque do salão
              </label>

              <button type="submit" className="primary-button">
                Adicionar produto ao estoque
              </button>
            </form>
          </section>

          <section className="card content-card operations-card">
            <div className="section-heading">
              <div>
                <h2>Produtos e alertas</h2>
                <p className="muted">
                  Os itens em baixa aparecem primeiro para o dono agir rápido antes de travar o atendimento.
                </p>
              </div>
            </div>

            <div className="row-list" style={{ marginTop: 18 }}>
              {!inventoryProducts.length ? (
                <EmptyStateCard
                  eyebrow="Sem produtos ainda"
                  title="Cadastre o primeiro item do estoque"
                  description="Comece pelos produtos críticos do atendimento para o painel já avisar quando algum deles entrar em baixa."
                />
              ) : (
                inventoryProducts.map((product) => {
                  const isLowStock = Number(product.current_stock ?? 0) <= Number(product.minimum_stock ?? 0);

                  return (
                    <article key={product.id} className="list-row customer-card operations-row operations-record">
                      <div className="customer-card__content">
                        <div className="customer-card__header">
                          <div className="list-row__content">
                            <h3>{product.name}</h3>
                            <div className="customer-card__badges">
                              <span className={product.is_active ? "badge badge--confirmed" : "badge badge--cancelled"}>
                                {product.is_active ? "Ativo" : "Pausado"}
                              </span>
                              {isLowStock ? <span className="badge badge--pending">Estoque em alerta</span> : null}
                              {product.brand ? <span className="badge badge--soft">{product.brand}</span> : null}
                            </div>
                          </div>
                        </div>

                        <div className="customer-card__metrics">
                          <div className="customer-metric-tile">
                            <span className="customer-detail-item__label">Disponível</span>
                            <strong>{formatStock(product.current_stock, product.unit)}</strong>
                          </div>
                          <div className="customer-metric-tile">
                            <span className="customer-detail-item__label">Mínimo</span>
                            <strong>{formatStock(product.minimum_stock, product.unit)}</strong>
                          </div>
                          <div className="customer-metric-tile">
                            <span className="customer-detail-item__label">Custo</span>
                            <strong>
                              {product.cost_price == null ? "Sem custo" : formatCurrency(Number(product.cost_price))}
                            </strong>
                          </div>
                          <div className="customer-metric-tile">
                            <span className="customer-detail-item__label">Venda</span>
                            <strong>
                              {product.retail_price == null ? "Sem preço" : formatCurrency(Number(product.retail_price))}
                            </strong>
                          </div>
                        </div>

                        <form action={saveInventoryProductAction} className="form-grid">
                          <input type="hidden" name="productId" value={product.id} />

                          <div className="split-grid">
                            <div className="field">
                              <label htmlFor={`product-name-${product.id}`}>Produto</label>
                              <input id={`product-name-${product.id}`} name="name" defaultValue={product.name} required />
                            </div>
                            <div className="field">
                              <label htmlFor={`product-brand-${product.id}`}>Marca</label>
                              <input id={`product-brand-${product.id}`} name="brand" defaultValue={product.brand ?? ""} />
                            </div>
                          </div>

                          <div className="split-grid">
                            <div className="field">
                              <label htmlFor={`product-stock-${product.id}`}>Estoque atual</label>
                              <input
                                id={`product-stock-${product.id}`}
                                name="currentStock"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={Number(product.current_stock ?? 0)}
                                required
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`product-minimum-${product.id}`}>Estoque mínimo</label>
                              <input
                                id={`product-minimum-${product.id}`}
                                name="minimumStock"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={Number(product.minimum_stock ?? 0)}
                                required
                              />
                            </div>
                          </div>

                          <div className="split-grid">
                            <div className="field">
                              <label htmlFor={`product-cost-${product.id}`}>Custo</label>
                              <input
                                id={`product-cost-${product.id}`}
                                name="costPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={product.cost_price == null ? "" : Number(product.cost_price)}
                              />
                            </div>
                            <div className="field">
                              <label htmlFor={`product-retail-${product.id}`}>Preço de venda</label>
                              <input
                                id={`product-retail-${product.id}`}
                                name="retailPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={product.retail_price == null ? "" : Number(product.retail_price)}
                              />
                            </div>
                          </div>

                          <div className="split-grid">
                            <div className="field">
                              <label htmlFor={`product-unit-${product.id}`}>Unidade</label>
                              <input id={`product-unit-${product.id}`} name="unit" defaultValue={product.unit} required />
                            </div>
                            <div className="field">
                              <label htmlFor={`product-sku-${product.id}`}>SKU</label>
                              <input id={`product-sku-${product.id}`} name="sku" defaultValue={product.sku ?? ""} />
                            </div>
                          </div>

                          <label className="checkbox-field">
                            <input type="checkbox" name="isActive" defaultChecked={product.is_active} />
                            Produto ativo
                          </label>

                          <div className="inline-actions">
                            <button type="submit" className="secondary-button">
                              Salvar produto
                            </button>
                            <span className="list-meta">Atualizado em {formatDateTime(product.updated_at)}</span>
                          </div>
                        </form>

                        <form action={registerInventoryMovementAction} className="form-grid" style={{ marginTop: 16 }}>
                          <input type="hidden" name="productId" value={product.id} />

                          <div className="split-grid">
                            <div className="field">
                              <label htmlFor={`movement-type-${product.id}`}>Movimento</label>
                              <select id={`movement-type-${product.id}`} name="movementType" defaultValue="out">
                                <option value="out">Saída</option>
                                <option value="in">Entrada</option>
                                <option value="adjustment">Ajuste de saldo</option>
                              </select>
                            </div>

                            <div className="field">
                              <label htmlFor={`movement-quantity-${product.id}`}>Quantidade</label>
                              <input
                                id={`movement-quantity-${product.id}`}
                                name="quantity"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue="1"
                                required
                              />
                            </div>
                          </div>

                          <div className="split-grid">
                            <div className="field">
                              <label htmlFor={`movement-reason-${product.id}`}>Motivo</label>
                              <input
                                id={`movement-reason-${product.id}`}
                                name="reason"
                                placeholder="Ex.: uso no atendimento, compra, ajuste de contagem"
                              />
                            </div>

                            <div className="field">
                              <label htmlFor={`movement-staff-${product.id}`}>Profissional</label>
                              <select id={`movement-staff-${product.id}`} name="staffMemberId" defaultValue="">
                                <option value="">Sem vínculo direto</option>
                                {staffOptions.map((staffMember) => (
                                  <option key={staffMember.id} value={staffMember.id}>
                                    {staffMember.name}
                                  </option>
                                ))}
                              </select>
                            </div>
                          </div>

                          <div className="inline-actions">
                            <button type="submit" className="primary-button">
                              Registrar movimento
                            </button>
                          </div>
                        </form>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </section>

          <section className="card content-card operations-card">
            <div className="section-heading">
              <div>
                <h2>Movimentos recentes</h2>
                <p className="muted">
                  Histórico rápido para entender quem mexeu no estoque e como o saldo evoluiu no dia a dia.
                </p>
              </div>
            </div>

            <div className="row-list" style={{ marginTop: 18 }}>
              {!inventoryMovements.length ? (
                <EmptyStateCard
                  eyebrow="Sem movimentos"
                  title="Os lançamentos aparecem aqui"
                  description="Assim que entradas, saídas ou ajustes forem registrados, o histórico do estoque aparece nesta área."
                />
              ) : (
                inventoryMovements.map((movement) => {
                  const product = firstRelation(movement.inventory_products);
                  const staffMember = firstRelation(movement.staff_members);

                  return (
                    <article key={movement.id} className="list-row operations-row">
                      <div className="list-row__content">
                        <div className="inline-actions" style={{ marginBottom: 8 }}>
                          <span className="badge badge--soft">{formatMovementLabel(movement.movement_type)}</span>
                          {staffMember?.name ? <span className="badge badge--pending">{staffMember.name}</span> : null}
                        </div>
                        <h3>{product?.name ?? "Produto removido"}</h3>
                        <p className="muted list-description">
                          {movement.reason?.trim() || "Sem observação operacional."}
                        </p>
                        <small className="list-meta">
                          {formatDateTime(movement.created_at)} • estoque saiu de{" "}
                          {Number(movement.previous_stock ?? 0)} para {Number(movement.resulting_stock ?? 0)}.
                        </small>
                      </div>
                      <strong>{Number(movement.quantity ?? 0)}</strong>
                    </article>
                  );
                })
              )}
            </div>
          </section>
        </section>
      </div>
    </div>
  );
}
