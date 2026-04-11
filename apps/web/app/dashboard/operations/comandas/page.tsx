import { redirect } from "next/navigation";

import {
  addTabItemAction,
  addTabPaymentAction,
  closeTabAction,
  openTabAction,
} from "@/app/actions";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ProductSuggestion = {
  count: number;
  name: string;
  price: number;
  productId: string | null;
};

type ServiceSuggestion = {
  count: number;
  id: string;
  name: string;
  price: number;
};

type TabCustomer = {
  id: string;
  name: string;
  phone: string | null;
};

type TabItem = {
  id: string;
  created_at: string;
  description: string;
  inventory_product_id: string | null;
  quantity: number | string;
  service_id: string | null;
  total: number | string;
  unit_price: number | string;
};

type TabPayment = {
  amount: number | string;
  created_at: string;
  id: string;
  method: string;
  note: string | null;
};

type CustomerTabRecord = {
  closed_at: string | null;
  customer_tab_items: TabItem[] | null;
  customer_tab_payments: TabPayment[] | null;
  customers: TabCustomer | TabCustomer[] | null;
  id: string;
  notes: string | null;
  opened_at: string;
  status: "open" | "closed" | "cancelled" | string;
  total_items: number | string;
  total_paid: number | string;
};

function firstRelation<T>(value: T | T[] | null | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }

  return value ?? null;
}

function formatTabStatusLabel(status: string) {
  if (status === "open") return "Aberta";
  if (status === "closed") return "Fechada";
  if (status === "cancelled") return "Cancelada";
  return "Em andamento";
}

function formatPaymentMethodLabel(method: string) {
  switch (method) {
    case "card":
      return "Cartao";
    case "cash":
      return "Dinheiro";
    case "voucher":
      return "Voucher";
    case "transfer":
      return "Transferencia";
    case "other":
      return "Outro";
    default:
      return "Pix";
  }
}

function buildNextActionSummary({
  itemCount,
  paidAmount,
  paymentCount,
  totalAmount,
}: {
  itemCount: number;
  paidAmount: number;
  paymentCount: number;
  totalAmount: number;
}) {
  if (!itemCount) {
    return {
      title: "Lancar atendimento",
      note: "Inclua o primeiro servico ou produto antes de cobrar.",
    };
  }

  if (totalAmount <= 0) {
    return {
      title: "Definir valor",
      note: "Revise quantidade e preco para formar a conta.",
    };
  }

  if (paidAmount >= totalAmount) {
    return {
      title: "Fechar conta",
      note: "Tudo recebido. Encerre a comanda para limpar a fila.",
    };
  }

  if (!paymentCount) {
    return {
      title: "Registrar primeira cobranca",
      note: `Ha ${formatCurrency(totalAmount)} em aberto nessa comanda.`,
    };
  }

  return {
    title: "Receber restante",
    note: `Ainda faltam ${formatCurrency(
      Math.max(0, totalAmount - paidAmount),
    )} para concluir.`,
  };
}

function getDateValue(value: string | null | undefined) {
  if (!value) {
    return 0;
  }

  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

export default async function ComandasPage({
  searchParams,
}: {
  searchParams?: { message?: string; tone?: string };
}) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();

  const [
    tabsResult,
    customersResult,
    servicesResult,
    productsResult,
    topServicesResult,
    topProductsResult,
  ] = await Promise.all([
    supabase
      .from("customer_tabs")
      .select(
        "id, status, opened_at, closed_at, notes, total_items, total_paid, customers ( id, name, phone ), customer_tab_items ( id, description, quantity, unit_price, total, created_at, service_id, inventory_product_id ), customer_tab_payments ( id, amount, method, note, created_at )",
      )
      .eq("salon_id", salon.id)
      .order("opened_at", { ascending: false })
      .limit(30),
    supabase
      .from("customers")
      .select("id, name, phone")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("services")
      .select("id, name, price")
      .eq("salon_id", salon.id)
      .order("name"),
    supabase
      .from("inventory_products")
      .select("id, name, retail_price")
      .eq("salon_id", salon.id)
      .order("name")
      .limit(50),
    supabase
      .from("appointments")
      .select("service_id, services(id, name, price)")
      .eq("salon_id", salon.id)
      .eq("status", "completed")
      .order("date", { ascending: false })
      .limit(200),
    supabase
      .from("customer_product_order_items")
      .select("product_id, product_name_snapshot, unit_price_snapshot")
      .eq("salon_id", salon.id)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  if (tabsResult.error) {
    redirect("/dashboard");
  }

  const tabs = (tabsResult.data ?? []) as CustomerTabRecord[];
  const customers = customersResult.data ?? [];
  const services = servicesResult.data ?? [];
  const products = productsResult.data ?? [];

  const serviceCatalog = new Map(
    services.map((service) => [
      service.id,
      {
        id: service.id,
        name: service.name,
        price: Number(service.price ?? 0),
      },
    ]),
  );
  const productCatalog = new Map(
    products.map((product) => [
      product.id,
      {
        id: product.id,
        name: product.name,
        price: Number(product.retail_price ?? 0),
      },
    ]),
  );

  const topServiceMap = new Map<string, ServiceSuggestion>();
  const topProductMap = new Map<string, ProductSuggestion>();

  for (const entry of topServicesResult.data ?? []) {
    const serviceRelation = firstRelation(entry.services);
    const serviceId = entry.service_id ?? serviceRelation?.id ?? null;

    if (!serviceId) {
      continue;
    }

    const service = serviceCatalog.get(serviceId) ?? {
      id: serviceId,
      name: serviceRelation?.name ?? "Servico sugerido",
      price: Number(serviceRelation?.price ?? 0),
    };
    const current = topServiceMap.get(serviceId);

    if (current) {
      current.count += 1;
      continue;
    }

    topServiceMap.set(serviceId, {
      count: 1,
      id: service.id,
      name: service.name,
      price: service.price,
    });
  }

  for (const entry of topProductsResult.data ?? []) {
    const productKey = entry.product_id ?? entry.product_name_snapshot;
    const catalogProduct = entry.product_id
      ? productCatalog.get(entry.product_id) ?? null
      : null;
    const current = topProductMap.get(productKey);

    if (current) {
      current.count += 1;
      continue;
    }

    topProductMap.set(productKey, {
      count: 1,
      name: catalogProduct?.name ?? entry.product_name_snapshot,
      price: Number(catalogProduct?.price ?? entry.unit_price_snapshot ?? 0),
      productId: catalogProduct?.id ?? entry.product_id ?? null,
    });
  }

  const topServiceSuggestion =
    Array.from(topServiceMap.values()).sort(
      (left, right) =>
        right.count - left.count ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )[0] ??
    Array.from(serviceCatalog.values())
      .filter((service) => service.price > 0)
      .sort(
        (left, right) =>
          right.price - left.price || left.name.localeCompare(right.name),
      )[0] ??
    null;

  const topProductSuggestion =
    Array.from(topProductMap.values()).sort(
      (left, right) =>
        right.count - left.count ||
        right.price - left.price ||
        left.name.localeCompare(right.name),
    )[0] ??
    Array.from(productCatalog.values())
      .filter((product) => product.price > 0)
      .sort(
        (left, right) =>
          right.price - left.price || left.name.localeCompare(right.name),
      )[0] ??
    null;

  const openTabs = tabs.filter((tab) => tab.status === "open");
  const closedTabs = tabs.filter((tab) => tab.status === "closed");
  const cancelledTabs = tabs.filter((tab) => tab.status === "cancelled");
  const orderedOpenTabs = [...openTabs].sort(
    (left, right) => getDateValue(right.opened_at) - getDateValue(left.opened_at),
  );
  const recentTabs = [...closedTabs, ...cancelledTabs].sort(
    (left, right) =>
      getDateValue(right.closed_at ?? right.opened_at) -
      getDateValue(left.closed_at ?? left.opened_at),
  );

  const pendingAmount = openTabs.reduce(
    (total, tab) =>
      total +
      Math.max(0, Number(tab.total_items ?? 0) - Number(tab.total_paid ?? 0)),
    0,
  );
  const receivedAmount = tabs.reduce(
    (total, tab) => total + Number(tab.total_paid ?? 0),
    0,
  );
  const openTabsAverage =
    openTabs.length > 0
      ? openTabs.reduce(
          (total, tab) => total + Number(tab.total_items ?? 0),
          0,
        ) / openTabs.length
      : 0;

  const largestOpenTab =
    openTabs.reduce<CustomerTabRecord | null>((currentLargest, tab) => {
      if (
        !currentLargest ||
        Number(tab.total_items ?? 0) > Number(currentLargest.total_items ?? 0)
      ) {
        return tab;
      }

      return currentLargest;
    }, null) ?? null;

  const tabsWithoutCustomer = openTabs.filter((tab) => !tab.customers).length;
  const tabsReadyToClose = openTabs.filter(
    (tab) =>
      Number(tab.total_items ?? 0) > 0 &&
      Number(tab.total_paid ?? 0) >= Number(tab.total_items ?? 0),
  ).length;
  const openItemEntries = openTabs.reduce(
    (total, tab) => total + (tab.customer_tab_items?.length ?? 0),
    0,
  );
  const openPaymentEntries = openTabs.reduce(
    (total, tab) => total + (tab.customer_tab_payments?.length ?? 0),
    0,
  );
  const topOpportunityLabel = topProductSuggestion
    ? topProductSuggestion.name
    : topServiceSuggestion?.name ?? "Sem sugestao forte no momento";

  return (
    <div className="page-grid workspace-page operations-page operations-simple operations-comandas-page">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        eyebrow="Caixa do salao"
        title="Comandas"
        description="Abra, lance itens, receba e feche sem complicar."
        highlight={{
          label: "Em aberto",
          value: formatCurrency(pendingAmount),
          note: openTabs.length
            ? `${openTabs.length} comanda(s) aberta(s) agora.`
            : "Nenhuma comanda aberta neste momento.",
        }}
        signals={[
          {
            label: "Recebido",
            value: formatCurrency(receivedAmount),
            tone: receivedAmount > 0 ? "success" : "soft",
          },
          {
            label: "Prontas para fechar",
            value: tabsReadyToClose,
            tone: tabsReadyToClose > 0 ? "success" : "soft",
          },
          {
            label: "Sugestao",
            value: topOpportunityLabel,
            tone:
              topProductSuggestion || topServiceSuggestion ? "warm" : "soft",
          },
        ]}
        stats={[
          {
            label: "Abertas agora",
            value: openTabs.length,
            note: "Comandas ainda em atendimento.",
            tone: openTabs.length ? "accent" : "soft",
          },
          {
            label: "Lancamentos ativos",
            value: openItemEntries,
            note: "Itens ja registrados nas abertas.",
            tone: openItemEntries ? "accent" : "soft",
          },
          {
            label: "Cobrancas registradas",
            value: openPaymentEntries,
            note: "Pagamentos parciais ou totais em andamento.",
            tone: openPaymentEntries ? "success" : "soft",
          },
          {
            label: "Sem cliente",
            value: tabsWithoutCustomer,
            note: "Abertas sem cadastro vinculado.",
            tone: tabsWithoutCustomer ? "warm" : "soft",
          },
        ]}
        aside={
          <div className="operations-comandas-page__hero-aside">
            <h3>Hoje</h3>
            <p>
              {largestOpenTab
                ? `Maior comanda: ${formatCurrency(
                    Number(largestOpenTab.total_items ?? 0),
                  )} de ${
                    firstRelation(largestOpenTab.customers)?.name ??
                    "cliente sem cadastro"
                  }.`
                : "Sem comandas abertas agora."}
            </p>

            <div className="operations-comandas-page__hero-grid">
              <article>
                <span>Pendente</span>
                <strong>{formatCurrency(pendingAmount)}</strong>
              </article>
              <article>
                <span>Recebido</span>
                <strong>{formatCurrency(receivedAmount)}</strong>
              </article>
              <article>
                <span>Prontas para fechar</span>
                <strong>
                  {tabsReadyToClose
                    ? `${tabsReadyToClose} pronta(s)`
                    : "Nenhuma pronta"}
                </strong>
              </article>
              <article>
                <span>Ticket medio</span>
                <strong>{formatCurrency(openTabsAverage)}</strong>
              </article>
            </div>
          </div>
        }
      />

      <WorkspaceSectionNav
        label="Ir para uma area"
        items={[
          {
            href: "#abrir-comanda",
            label: "Nova",
            meta: "Abrir",
          },
          {
            href: "#comandas-abertas",
            label: "Abertas",
            meta: `${orderedOpenTabs.length} aberta(s)`,
          },
          {
            href: "#historico-comandas",
            label: "Historico",
            meta: `${recentTabs.length} recente(s)`,
          },
        ]}
      />

      <section className="operations-comandas-page__summary-grid">
        <article className="stat-card">
          <small>Abertas agora</small>
          <strong>{openTabs.length}</strong>
          <span className="muted">Em atendimento.</span>
        </article>
        <article className="stat-card">
          <small>Em aberto</small>
          <strong>{formatCurrency(pendingAmount)}</strong>
          <span className="muted">Falta receber.</span>
        </article>
        <article className="stat-card">
          <small>Recebido</small>
          <strong>{formatCurrency(receivedAmount)}</strong>
          <span className="muted">Ja entrou no caixa.</span>
        </article>
        <article className="stat-card">
          <small>Prontas</small>
          <strong>{tabsReadyToClose}</strong>
          <span className="muted">Pode encerrar.</span>
        </article>
      </section>

      <section
        id="abrir-comanda"
        className="card content-card operations-comandas-page__intro-card"
      >
        <div className="section-heading">
          <div>
            <h2>Abrir comanda</h2>
            <p className="muted">Cliente e observacao sao opcionais.</p>
          </div>
        </div>
        <form action={openTabAction} className="simple-form">
          <div className="split-grid">
            <div className="field">
              <label htmlFor="customerId">Cliente</label>
              <select id="customerId" name="customerId" defaultValue="">
                <option value="">Selecionar</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="notes">Observacao</label>
              <input id="notes" name="notes" placeholder="Ex.: cadeira 2" />
            </div>
          </div>
          <button type="submit" className="primary-button" style={{ marginTop: 8 }}>
            Abrir comanda
          </button>
        </form>
      </section>

      <section id="comandas-abertas" className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Comandas em andamento</h2>
            <p className="muted">O que esta aberto agora.</p>
          </div>
        </div>

        {!orderedOpenTabs.length ? (
          <EmptyStateCard
            eyebrow="Caixa livre"
            title="Nenhuma comanda em andamento"
            description="Abra uma quando precisar somar itens e fechar depois."
          />
        ) : (
          <div className="simple-list operations-comandas-page__stack">
            {orderedOpenTabs.map((tab) => {
              const customer = firstRelation(tab.customers);
              const items = tab.customer_tab_items ?? [];
              const payments = tab.customer_tab_payments ?? [];
              const totalAmount = Number(tab.total_items ?? 0);
              const paidAmount = Number(tab.total_paid ?? 0);
              const dueAmount = Math.max(0, totalAmount - paidAmount);
              const overpaidAmount = Math.max(0, paidAmount - totalAmount);
              const itemEntriesCount = items.length;
              const paymentEntriesCount = payments.length;
              const serviceEntriesCount = items.filter(
                (item) => Boolean(item.service_id),
              ).length;
              const productEntriesCount = items.filter(
                (item) => Boolean(item.inventory_product_id),
              ).length;
              const paymentProgress =
                totalAmount > 0
                  ? Math.min(
                      100,
                      Math.round(
                        (Math.min(paidAmount, totalAmount) / totalAmount) * 100,
                      ),
                    )
                  : paymentEntriesCount
                    ? 100
                    : 0;
              const nextAction = buildNextActionSummary({
                itemCount: itemEntriesCount,
                paidAmount,
                paymentCount: paymentEntriesCount,
                totalAmount,
              });
              const hasServiceItem = serviceEntriesCount > 0;
              const hasProductItem = productEntriesCount > 0;
              const suggestedServicePrice = topServiceSuggestion
                ? Number((topServiceSuggestion.price * 0.9).toFixed(2))
                : 0;

              return (
                <article
                  key={tab.id}
                  className="simple-row operations-comandas-page__tab-card operations-comandas-page__tab-card--active"
                  style={{ borderColor: "var(--dashboard-border)" }}
                >
                  <div className="operations-comandas-page__tab-header">
                    <div>
                      <div
                        className="inline-actions"
                        style={{ flexWrap: "wrap", marginBottom: 8 }}
                      >
                        <span className="badge badge--accent">
                          {formatTabStatusLabel(tab.status)}
                        </span>
                        <span className="badge badge--soft">
                          Aberta {formatDateTime(tab.opened_at)}
                        </span>
                        <span className="badge badge--pending">
                          Em aberto {formatCurrency(dueAmount)}
                        </span>
                        {!customer ? (
                          <span className="badge badge--soft">Sem cliente</span>
                        ) : null}
                      </div>

                      <h3>{customer?.name ?? "Cliente sem cadastro"}</h3>
                      <p className="muted">
                        {tab.notes?.trim()
                          ? tab.notes
                          : "Sem observacao."}
                      </p>
                      <small className="list-meta">
                        {customer?.phone
                          ? `Contato: ${customer.phone}`
                          : customer
                            ? "Cadastro sem telefone"
                            : "Atendimento sem cliente vinculado"}
                      </small>
                    </div>

                    <div className="operations-comandas-page__tab-totals">
                      <article className="stat-card">
                        <small>Total</small>
                        <strong>{formatCurrency(totalAmount)}</strong>
                      </article>
                      <article className="stat-card">
                        <small>Pago</small>
                        <strong>{formatCurrency(paidAmount)}</strong>
                      </article>
                      <article className="stat-card">
                        <small>Falta</small>
                        <strong>{formatCurrency(dueAmount)}</strong>
                      </article>
                    </div>
                  </div>

                  <div className="operations-comandas-page__tab-overview">
                    <article className="operations-comandas-page__overview-card">
                      <small>Itens</small>
                      <strong>{itemEntriesCount}</strong>
                      <span>
                        {itemEntriesCount
                          ? `${serviceEntriesCount} servico(s) e ${productEntriesCount} produto(s)`
                          : "Nada lancado"}
                      </span>
                    </article>
                    <article className="operations-comandas-page__overview-card">
                      <small>Pagamentos</small>
                      <strong>{paymentEntriesCount}</strong>
                      <span>
                        {paymentEntriesCount
                          ? "Ja registrado"
                          : "Sem registro"}
                      </span>
                    </article>
                    <article className="operations-comandas-page__overview-card">
                      <small>Cliente</small>
                      <strong>{customer?.name ?? "Avulsa"}</strong>
                      <span>
                        {customer?.phone
                          ? customer.phone
                          : customer
                            ? "Sem telefone"
                            : "Sem cliente"}
                      </span>
                    </article>
                    <article className="operations-comandas-page__overview-card">
                      <small>Proxima acao</small>
                      <strong>{nextAction.title}</strong>
                      <span>{nextAction.note}</span>
                    </article>
                  </div>

                  <div className="operations-comandas-page__settlement-card">
                    <div className="operations-comandas-page__settlement-head">
                      <div>
                        <small>Liquidacao da conta</small>
                        <strong>{paymentProgress}% recebido</strong>
                      </div>
                      <span className="muted">
                        {overpaidAmount > 0
                          ? `Credito de ${formatCurrency(overpaidAmount)} acima do total.`
                          : dueAmount > 0
                            ? `${formatCurrency(dueAmount)} ainda em aberto.`
                            : "Conta quitada e pronta para fechar."}
                      </span>
                    </div>
                    <div className="operations-comandas-page__progress">
                      <span style={{ width: `${paymentProgress}%` }} />
                    </div>
                  </div>

                  <div className="operations-comandas-page__body-grid">
                    <div>
                      <div className="operations-comandas-page__section-head">
                        <div>
                          <h4>Itens</h4>
                        </div>
                      </div>
                      {!items.length ? (
                        <p className="muted">Nenhum item ainda.</p>
                      ) : (
                        <ul className="muted operations-comandas-page__bullet-list">
                          {items.map((item) => (
                            <li key={item.id}>
                              {item.description} • {item.quantity} x{" "}
                              {formatCurrency(Number(item.unit_price ?? 0))} ={" "}
                              {formatCurrency(Number(item.total ?? 0))}
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        action={addTabItemAction}
                        className="simple-form"
                        style={{ marginTop: 8 }}
                      >
                        <input type="hidden" name="tabId" value={tab.id} />
                        <div className="split-grid">
                          <div className="field">
                            <label>Descricao</label>
                            <input
                              name="description"
                              placeholder="Ex.: corte + barba"
                              required
                            />
                          </div>
                          <div className="field">
                            <label>Quantidade</label>
                            <input
                              name="quantity"
                              type="number"
                              step="0.1"
                              min="0.1"
                              defaultValue="1"
                              required
                            />
                          </div>
                          <div className="field">
                            <label>Preco</label>
                            <input
                              name="unitPrice"
                              type="number"
                              step="0.01"
                              min="0"
                              defaultValue="0"
                              required
                            />
                          </div>
                        </div>
                        <div className="split-grid" style={{ marginTop: 6 }}>
                          <div className="field">
                            <label>Servico</label>
                            <select name="serviceId" defaultValue="">
                              <option value="">Opcional</option>
                              {services.map((service) => (
                                <option key={service.id} value={service.id}>
                                  {service.name} (
                                  {formatCurrency(Number(service.price ?? 0))})
                                </option>
                              ))}
                            </select>
                          </div>
                          <div className="field">
                            <label>Produto</label>
                            <select name="productId" defaultValue="">
                              <option value="">Opcional</option>
                              {products.map((product) => (
                                <option key={product.id} value={product.id}>
                                  {product.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="secondary-button"
                          style={{ marginTop: 6 }}
                        >
                          Adicionar item
                        </button>
                      </form>
                    </div>

                    <div>
                      <div className="operations-comandas-page__section-head">
                        <div>
                          <h4>Pagamentos</h4>
                        </div>
                      </div>
                      {!payments.length ? (
                        <p className="muted">Nenhum pagamento ainda.</p>
                      ) : (
                        <ul className="muted operations-comandas-page__bullet-list">
                          {payments.map((payment) => (
                            <li key={payment.id}>
                              {formatPaymentMethodLabel(payment.method)} •{" "}
                              {formatCurrency(Number(payment.amount ?? 0))}
                              {payment.note ? ` • ${payment.note}` : ""}
                            </li>
                          ))}
                        </ul>
                      )}

                      <form
                        action={addTabPaymentAction}
                        className="simple-form"
                        style={{ marginTop: 8 }}
                      >
                        <input type="hidden" name="tabId" value={tab.id} />
                        <div className="split-grid">
                          <div className="field">
                            <label>Valor</label>
                            <input
                              name="amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              required
                            />
                          </div>
                          <div className="field">
                            <label>Forma</label>
                            <select name="method" defaultValue="pix">
                              <option value="pix">Pix</option>
                              <option value="card">Cartao</option>
                              <option value="cash">Dinheiro</option>
                              <option value="voucher">Voucher</option>
                              <option value="transfer">Transferencia</option>
                              <option value="other">Outro</option>
                            </select>
                          </div>
                          <div className="field">
                            <label>Obs.</label>
                            <input
                              name="note"
                              placeholder="Ex.: sinal"
                            />
                          </div>
                        </div>
                        <button
                          type="submit"
                          className="secondary-button"
                          style={{ marginTop: 6 }}
                        >
                          Registrar pagamento
                        </button>
                      </form>
                    </div>
                  </div>

                  {((hasServiceItem && !hasProductItem && topProductSuggestion) ||
                    (hasProductItem && !hasServiceItem && topServiceSuggestion) ||
                    (!items.length &&
                      (topProductSuggestion || topServiceSuggestion))) ? (
                    <div className="operations-comandas-page__suggestions">
                      {(hasServiceItem || !items.length) &&
                      !hasProductItem &&
                      topProductSuggestion ? (
                        <div
                          className="card content-card operations-comandas-page__suggestion-card"
                          style={{ padding: 16 }}
                        >
                          <p className="eyebrow">Sugestao</p>
                          <h4>{topProductSuggestion.name}</h4>
                          <p className="muted">
                            Complemento de boa saida.{" "}
                            {formatCurrency(topProductSuggestion.price)}
                          </p>
                          <form
                            action={addTabItemAction}
                            className="simple-form"
                            style={{ marginTop: 8 }}
                          >
                            <input type="hidden" name="tabId" value={tab.id} />
                            <input
                              type="hidden"
                              name="description"
                              value={topProductSuggestion.name}
                            />
                            <input type="hidden" name="quantity" value="1" />
                            <input
                              type="hidden"
                              name="unitPrice"
                              value={topProductSuggestion.price.toFixed(2)}
                            />
                            <input
                              type="hidden"
                              name="productId"
                              value={topProductSuggestion.productId ?? ""}
                            />
                            <button type="submit" className="secondary-button">
                              Adicionar produto sugerido
                            </button>
                          </form>
                        </div>
                      ) : null}

                      {(hasProductItem || !items.length) &&
                      !hasServiceItem &&
                      topServiceSuggestion ? (
                        <div
                          className="card content-card operations-comandas-page__suggestion-card"
                          style={{ padding: 16 }}
                        >
                          <p className="eyebrow">Retorno</p>
                          <h4>{topServiceSuggestion.name}</h4>
                          <p className="muted">
                            Valor sugerido:{" "}
                            {formatCurrency(suggestedServicePrice)} em vez de{" "}
                            {formatCurrency(topServiceSuggestion.price)}
                          </p>
                          <form
                            action={addTabItemAction}
                            className="simple-form"
                            style={{ marginTop: 8 }}
                          >
                            <input type="hidden" name="tabId" value={tab.id} />
                            <input
                              type="hidden"
                              name="description"
                              value={`${topServiceSuggestion.name} (beneficio loja -10%)`}
                            />
                            <input type="hidden" name="quantity" value="1" />
                            <input
                              type="hidden"
                              name="unitPrice"
                              value={suggestedServicePrice.toFixed(2)}
                            />
                            <input
                              type="hidden"
                              name="serviceId"
                              value={topServiceSuggestion.id}
                            />
                            <button type="submit" className="secondary-button">
                              Adicionar servico com beneficio
                            </button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  <div
                    className="simple-row__actions operations-comandas-page__footer-actions"
                    style={{ flexWrap: "wrap", gap: 8, marginTop: 10 }}
                  >
                    <form action={closeTabAction}>
                      <input type="hidden" name="tabId" value={tab.id} />
                      <input type="hidden" name="status" value="closed" />
                      <button type="submit" className="primary-button">
                        Fechar comanda
                      </button>
                    </form>
                    <form action={closeTabAction}>
                      <input type="hidden" name="tabId" value={tab.id} />
                      <input type="hidden" name="status" value="cancelled" />
                      <button type="submit" className="secondary-button">
                        Cancelar
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section
        id="historico-comandas"
        className="card content-card operations-comandas-page__history-card"
      >
        <div className="section-heading">
          <div>
            <h2>Encerradas recentemente</h2>
            <p className="muted">Fechadas ou canceladas.</p>
          </div>
        </div>

        {!recentTabs.length ? (
          <EmptyStateCard
            eyebrow="Sem historico"
            title="Nenhuma comanda encerrada ainda"
            description="As contas fechadas e canceladas passam a aparecer aqui."
          />
        ) : (
          <div className="simple-list operations-comandas-page__history-stack">
            {recentTabs.map((tab) => {
              const customer = firstRelation(tab.customers);
              const totalAmount = Number(tab.total_items ?? 0);
              const paidAmount = Number(tab.total_paid ?? 0);
              const historyStatusClass =
                tab.status === "closed"
                  ? "badge badge--confirmed"
                  : "badge badge--cancelled";

              return (
                <article
                  key={tab.id}
                  className="simple-row operations-comandas-page__history-row"
                >
                  <div className="operations-comandas-page__history-main">
                    <div
                      className="inline-actions"
                      style={{ flexWrap: "wrap", marginBottom: 8 }}
                    >
                      <span className={historyStatusClass}>
                        {formatTabStatusLabel(tab.status)}
                      </span>
                      <span className="badge badge--soft">
                        Aberta {formatDateTime(tab.opened_at)}
                      </span>
                      {tab.closed_at ? (
                        <span className="badge badge--soft">
                          Encerrada {formatDateTime(tab.closed_at)}
                        </span>
                      ) : null}
                    </div>

                    <h3>{customer?.name ?? "Cliente sem cadastro"}</h3>
                    <p className="muted">
                      {tab.notes?.trim()
                        ? tab.notes
                        : tab.status === "cancelled"
                          ? "Comanda encerrada sem venda."
                          : "Conta encerrada com sucesso no caixa."}
                    </p>
                    <small className="list-meta">
                      {customer?.phone
                        ? `Contato: ${customer.phone}`
                        : customer
                          ? "Cadastro sem telefone"
                          : "Comanda avulsa"}
                    </small>
                  </div>

                  <div className="operations-comandas-page__history-metrics">
                    <article className="stat-card">
                      <small>Total</small>
                      <strong>{formatCurrency(totalAmount)}</strong>
                    </article>
                    <article className="stat-card">
                      <small>Pago</small>
                      <strong>{formatCurrency(paidAmount)}</strong>
                    </article>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
