import { redirect } from "next/navigation";

import {
  addTabItemAction,
  addTabPaymentAction,
  closeTabAction,
  openTabAction,
} from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency, formatDateTime } from "@/lib/formatters";
import { createClient } from "@/lib/supabase/server";

import styles from "./page.module.css";

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
      return "Cartão";
    case "cash":
      return "Dinheiro";
    case "voucher":
      return "Voucher";
    case "transfer":
      return "Transferência";
    case "other":
      return "Outro";
    default:
      return "Pix";
  }
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
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
      title: "Lançar atendimento",
      note: "Inclua o primeiro serviço ou produto antes de cobrar.",
    };
  }

  if (totalAmount <= 0) {
    return {
      title: "Definir valor",
      note: "Revise quantidade e preço para formar a conta.",
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
      title: "Registrar primeira cobrança",
      note: `Há ${formatCurrency(totalAmount)} em aberto nesta comanda.`,
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

function initials(value?: string | null) {
  return (
    value
      ?.split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "SF"
  );
}

function badgeClass(
  tone: "accent" | "soft" | "success" | "warm" | "danger",
) {
  switch (tone) {
    case "accent":
      return styles.badgeAccent;
    case "success":
      return styles.badgeSuccess;
    case "warm":
      return styles.badgeWarm;
    case "danger":
      return styles.badgeDanger;
    default:
      return styles.badgeSoft;
  }
}

export default async function ComandasPage({
  searchParams: searchParamsPromise,
}: {
  searchParams?: Promise<{ message?: string; tone?: string }>;
}) {
  const searchParams = await searchParamsPromise;
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
      name: serviceRelation?.name ?? "Serviço sugerido",
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
  const openTabsHref = "/dashboard/operations/comandas#comandas-abertas";
  const createTabHref = "/dashboard/operations/comandas#abrir-comanda";

  return (
    <div className={styles.page}>
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <section className={styles.hero}>
        <div className={styles.headerRow}>
          <div className={styles.headerContent}>
            <p className={styles.eyebrow}>Caixa do salão</p>
            <h1>Comandas</h1>
            <p className={styles.lead}>
              Abra, lance itens, receba e feche sem parar a operação.
            </p>
          </div>

          <div className={styles.headerActions}>
            <a href="#historico-comandas" className={styles.secondaryButton}>
              Histórico
            </a>
            <a href="#abrir-comanda" className={styles.primaryButton}>
              Nova comanda
            </a>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Em aberto</span>
            <strong className={styles.metricValue}>
              {formatCurrency(pendingAmount)}
            </strong>
            <p className={styles.metricMeta}>
              {openTabs.length
                ? `${formatCountLabel(openTabs.length, "comanda aberta", "comandas abertas")} agora.`
                : "Nenhuma comanda aberta neste momento."}
            </p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Recebido</span>
            <strong className={styles.metricValue}>
              {formatCurrency(receivedAmount)}
            </strong>
            <p className={styles.metricMeta}>Já entrou no caixa das comandas.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Ticket médio</span>
            <strong className={styles.metricValue}>
              {formatCurrency(openTabsAverage)}
            </strong>
            <p className={styles.metricMeta}>Média das comandas em atendimento.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Prontas para fechar</span>
            <strong className={styles.metricValue}>{tabsReadyToClose}</strong>
            <p className={styles.metricMeta}>Contas com valor total quitado.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Abertas agora</span>
            <strong className={styles.metricValue}>{openTabs.length}</strong>
            <p className={styles.metricMeta}>
              {formatCountLabel(openItemEntries, "lançamento", "lançamentos")} e{" "}
              {formatCountLabel(openPaymentEntries, "cobrança", "cobranças")} registradas.
            </p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Sugestão em alta</span>
            <strong className={styles.metricTitle}>{topOpportunityLabel}</strong>
            <p className={styles.metricMeta}>
              {largestOpenTab
                ? `Maior comanda: ${formatCurrency(
                    Number(largestOpenTab.total_items ?? 0),
                  )}.`
                : "Sem oportunidade forte no momento."}
            </p>
          </article>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section id="comandas-abertas" className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Operação viva</p>
                <h2>Comandas em andamento</h2>
                <p className={styles.panelCopy}>Tudo o que esta aberto agora.</p>
              </div>
              <div className={styles.pillRow}>
                <span className={styles.countPill}>Abertas agora: {openTabs.length}</span>
                <span className={styles.countPill}>
                  Sem cliente: {tabsWithoutCustomer}
                </span>
              </div>
            </div>

            {!orderedOpenTabs.length ? (
              <EmptyStateCard
                eyebrow="Caixa livre"
                title="Nenhuma comanda em andamento"
                description="Abra uma quando precisar somar itens e fechar depois."
              />
            ) : (
              <div className={styles.tabGrid}>
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
                  const serviceEntriesCount = items.filter((item) =>
                    Boolean(item.service_id),
                  ).length;
                  const productEntriesCount = items.filter((item) =>
                    Boolean(item.inventory_product_id),
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
                  return (
                    <article key={tab.id} className={styles.tabCard}>
                      <div className={styles.tabHeader}>
                        <div className={styles.customerBlock}>
                          <div className={styles.customerAvatar}>
                            {initials(customer?.name)}
                          </div>
                          <div>
                            <div className={styles.badgeRow}>
                              <span className={`${styles.badge} ${badgeClass("accent")}`}>
                                {formatTabStatusLabel(tab.status)}
                              </span>
                              <span className={`${styles.badge} ${badgeClass("soft")}`}>
                                Aberta {formatDateTime(tab.opened_at)}
                              </span>
                              <span className={`${styles.badge} ${badgeClass("warm")}`}>
                                Em aberto {formatCurrency(dueAmount)}
                              </span>
                              {!customer ? (
                                <span className={`${styles.badge} ${badgeClass("soft")}`}>
                                  Sem cliente
                                </span>
                              ) : null}
                            </div>
                            <h3>{customer?.name ?? "Cliente sem cadastro"}</h3>
                            <p className={styles.tabCopy}>
                              {tab.notes?.trim() ? tab.notes : "Sem observação."}
                            </p>
                            <small className={styles.metaLine}>
                              {customer?.phone
                                ? `Contato: ${customer.phone}`
                                : customer
                                  ? "Cadastro sem telefone"
                                  : "Atendimento sem cliente"}
                            </small>
                          </div>
                        </div>

                        <div className={styles.totalGrid}>
                          <article className={styles.statCard}>
                            <small>Total</small>
                            <strong>{formatCurrency(totalAmount)}</strong>
                          </article>
                          <article className={styles.statCard}>
                            <small>Pago</small>
                            <strong>{formatCurrency(paidAmount)}</strong>
                          </article>
                          <article className={styles.statCard}>
                            <small>Falta</small>
                            <strong>{formatCurrency(dueAmount)}</strong>
                          </article>
                        </div>
                      </div>

                      <div className={styles.metaGrid}>
                        <article className={styles.metaCard}>
                          <small>Itens</small>
                          <strong>{itemEntriesCount}</strong>
                          <span>
                            {itemEntriesCount
                              ? `${formatCountLabel(serviceEntriesCount, "serviço", "serviços")} e ${formatCountLabel(productEntriesCount, "produto", "produtos")}`
                              : "Nada lançado"}
                          </span>
                        </article>
                        <article className={styles.metaCard}>
                          <small>Pagamentos</small>
                          <strong>{paymentEntriesCount}</strong>
                          <span>
                            {paymentEntriesCount ? "Já registrado" : "Sem registro"}
                          </span>
                        </article>
                        <article className={styles.metaCard}>
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
                        <article className={styles.metaCard}>
                          <small>Próxima ação</small>
                          <strong>{nextAction.title}</strong>
                          <span>{nextAction.note}</span>
                        </article>
                      </div>

                      <div className={styles.progressCard}>
                        <div className={styles.progressHeader}>
                          <div>
                            <small>Liquidação da conta</small>
                            <strong>{paymentProgress}% recebido</strong>
                          </div>
                          <span className={styles.metaLine}>
                            {overpaidAmount > 0
                              ? `Credito de ${formatCurrency(overpaidAmount)} acima do total.`
                              : dueAmount > 0
                                ? `${formatCurrency(dueAmount)} ainda em aberto.`
                                : "Conta quitada e pronta para fechar."}
                          </span>
                        </div>
                        <div className={styles.progressTrack}>
                          <span style={{ width: `${paymentProgress}%` }} />
                        </div>
                      </div>

                      <div className={styles.bodyGrid}>
                        <div className={styles.bodyCard}>
                          <div className={styles.sectionHead}>
                            <h4>Itens</h4>
                          </div>
                          {!items.length ? (
                            <p className={styles.emptyCopy}>Nenhum item ainda.</p>
                          ) : (
                            <ul className={styles.bulletList}>
                              {items.map((item) => (
                                <li key={item.id}>
                                  {item.description} • {item.quantity} x{" "}
                                  {formatCurrency(Number(item.unit_price ?? 0))} ={" "}
                                  {formatCurrency(Number(item.total ?? 0))}
                                </li>
                              ))}
                            </ul>
                          )}

                          <form action={addTabItemAction} className={styles.form}>
                            <input type="hidden" name="returnPath" value={openTabsHref} />
                            <input type="hidden" name="tabId" value={tab.id} />
                            <div className={styles.formGrid}>
                              <label className={styles.field}>
                                <span>Descrição</span>
                                <input
                                  name="description"
                                  placeholder="Ex.: corte + barba"
                                  required
                                />
                              </label>
                              <label className={styles.field}>
                                <span>Quantidade</span>
                                <input
                                  name="quantity"
                                  type="number"
                                  step="0.1"
                                  min="0.1"
                                  defaultValue="1"
                                  required
                                />
                              </label>
                              <label className={styles.field}>
                                <span>Preco</span>
                                <input
                                  name="unitPrice"
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  defaultValue="0"
                                  required
                                />
                              </label>
                              <label className={styles.field}>
                                <span>Serviço</span>
                                <select name="serviceId" defaultValue="">
                                  <option value="">Opcional</option>
                                  {services.map((service) => (
                                    <option key={service.id} value={service.id}>
                                      {service.name} (
                                      {formatCurrency(Number(service.price ?? 0))})
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <label className={styles.field}>
                                <span>Produto</span>
                                <select name="productId" defaultValue="">
                                  <option value="">Opcional</option>
                                  {products.map((product) => (
                                    <option key={product.id} value={product.id}>
                                      {product.name}
                                    </option>
                                  ))}
                                </select>
                              </label>
                            </div>
                            <button type="submit" className={styles.secondaryButton}>
                              Adicionar item
                            </button>
                          </form>
                        </div>

                        <div className={styles.bodyCard}>
                          <div className={styles.sectionHead}>
                            <h4>Pagamentos</h4>
                          </div>
                          {!payments.length ? (
                            <p className={styles.emptyCopy}>Nenhum pagamento ainda.</p>
                          ) : (
                            <ul className={styles.bulletList}>
                              {payments.map((payment) => (
                                <li key={payment.id}>
                                  {formatPaymentMethodLabel(payment.method)} •{" "}
                                  {formatCurrency(Number(payment.amount ?? 0))}
                                  {payment.note ? ` • ${payment.note}` : ""}
                                </li>
                              ))}
                            </ul>
                          )}

                          <form action={addTabPaymentAction} className={styles.form}>
                            <input type="hidden" name="returnPath" value={openTabsHref} />
                            <input type="hidden" name="tabId" value={tab.id} />
                            <div className={styles.formGrid}>
                              <label className={styles.field}>
                                <span>Valor</span>
                                <input
                                  name="amount"
                                  type="number"
                                  step="0.01"
                                  min="0.01"
                                  required
                                />
                              </label>
                              <label className={styles.field}>
                                <span>Forma</span>
                                <select name="method" defaultValue="pix">
                                  <option value="pix">Pix</option>
                                  <option value="card">Cartão</option>
                                  <option value="cash">Dinheiro</option>
                                  <option value="voucher">Voucher</option>
                                  <option value="transfer">Transferência</option>
                                  <option value="other">Outro</option>
                                </select>
                              </label>
                              <label className={styles.field}>
                                <span>Obs.</span>
                                <input name="note" placeholder="Ex.: sinal" />
                              </label>
                            </div>
                            <button type="submit" className={styles.secondaryButton}>
                              Registrar pagamento
                            </button>
                          </form>
                        </div>
                      </div>

                      {((hasServiceItem && !hasProductItem && topProductSuggestion) ||
                        (hasProductItem && !hasServiceItem && topServiceSuggestion) ||
                        (!items.length &&
                          (topProductSuggestion || topServiceSuggestion))) ? (
                        <div className={styles.suggestionGrid}>
                          {(hasServiceItem || !items.length) &&
                          !hasProductItem &&
                          topProductSuggestion ? (
                            <div className={styles.suggestionCard}>
                              <p className={styles.eyebrow}>Sugestão</p>
                              <h4>{topProductSuggestion.name}</h4>
                              <p className={styles.panelCopy}>
                                Complemento com boa saída.{" "}
                                {formatCurrency(topProductSuggestion.price)}
                              </p>
                              <form action={addTabItemAction} className={styles.quickForm}>
                                <input type="hidden" name="returnPath" value={openTabsHref} />
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
                                <button type="submit" className={styles.secondaryButton}>
                                  Adicionar produto sugerido
                                </button>
                              </form>
                            </div>
                          ) : null}

                          {(hasProductItem || !items.length) &&
                          !hasServiceItem &&
                          topServiceSuggestion ? (
                            <div className={styles.suggestionCard}>
                              <p className={styles.eyebrow}>Retorno</p>
                              <h4>{topServiceSuggestion.name}</h4>
                              <p className={styles.panelCopy}>
                                Serviço recorrente com valor real de{" "}
                                {formatCurrency(topServiceSuggestion.price)}.
                              </p>
                              <form action={addTabItemAction} className={styles.quickForm}>
                                <input type="hidden" name="returnPath" value={openTabsHref} />
                                <input type="hidden" name="tabId" value={tab.id} />
                                <input
                                  type="hidden"
                                  name="description"
                                  value={topServiceSuggestion.name}
                                />
                                <input type="hidden" name="quantity" value="1" />
                                <input
                                  type="hidden"
                                  name="unitPrice"
                                  value={topServiceSuggestion.price.toFixed(2)}
                                />
                                <input
                                  type="hidden"
                                  name="serviceId"
                                  value={topServiceSuggestion.id}
                                />
                                <button type="submit" className={styles.secondaryButton}>
                                  Adicionar serviço sugerido
                                </button>
                              </form>
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      <div className={styles.footerActions}>
                        <form action={closeTabAction}>
                          <input type="hidden" name="returnPath" value={openTabsHref} />
                          <input type="hidden" name="tabId" value={tab.id} />
                          <input type="hidden" name="status" value="closed" />
                          <button type="submit" className={styles.primaryButton}>
                            Fechar comanda
                          </button>
                        </form>
                        <form action={closeTabAction}>
                          <input type="hidden" name="returnPath" value={openTabsHref} />
                          <input type="hidden" name="tabId" value={tab.id} />
                          <input type="hidden" name="status" value="cancelled" />
                          <button type="submit" className={styles.secondaryButton}>
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

          <section id="historico-comandas" className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Histórico</p>
                <h2>Encerradas recentemente</h2>
                <p className={styles.panelCopy}>Fechadas ou canceladas.</p>
              </div>
              <span className={styles.countPill}>
                {formatCountLabel(recentTabs.length, "conta recente", "contas recentes")}
              </span>
            </div>

            {!recentTabs.length ? (
              <EmptyStateCard
                eyebrow="Sem histórico"
                title="Nenhuma comanda encerrada ainda"
                description="As contas fechadas e canceladas passam a aparecer aqui."
              />
            ) : (
              <div className={styles.historyList}>
                {recentTabs.map((tab) => {
                  const customer = firstRelation(tab.customers);
                  const totalAmount = Number(tab.total_items ?? 0);
                  const paidAmount = Number(tab.total_paid ?? 0);
                  const historyTone = tab.status === "closed" ? "success" : "danger";

                  return (
                    <article key={tab.id} className={styles.historyRow}>
                      <div className={styles.historyMain}>
                        <div className={styles.badgeRow}>
                          <span className={`${styles.badge} ${badgeClass(historyTone)}`}>
                            {formatTabStatusLabel(tab.status)}
                          </span>
                          <span className={`${styles.badge} ${badgeClass("soft")}`}>
                            Aberta {formatDateTime(tab.opened_at)}
                          </span>
                          {tab.closed_at ? (
                            <span className={`${styles.badge} ${badgeClass("soft")}`}>
                              Encerrada {formatDateTime(tab.closed_at)}
                            </span>
                          ) : null}
                        </div>
                        <h3>{customer?.name ?? "Cliente sem cadastro"}</h3>
                        <p className={styles.tabCopy}>
                          {tab.notes?.trim()
                            ? tab.notes
                            : tab.status === "cancelled"
                              ? "Comanda encerrada sem venda."
                              : "Conta encerrada com sucesso no caixa."}
                        </p>
                        <small className={styles.metaLine}>
                          {customer?.phone
                            ? `Contato: ${customer.phone}`
                            : customer
                              ? "Cadastro sem telefone"
                              : "Comanda avulsa"}
                        </small>
                      </div>

                      <div className={styles.historyMetrics}>
                        <article className={styles.statCard}>
                          <small>Total</small>
                          <strong>{formatCurrency(totalAmount)}</strong>
                        </article>
                        <article className={styles.statCard}>
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

        <div className={styles.sidebarColumn}>
          <section id="abrir-comanda" className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Abertura rapida</p>
                <h2>Abrir comanda</h2>
                <p className={styles.panelCopy}>
                  Cliente e observação são opcionais.
                </p>
              </div>
            </div>

            <form action={openTabAction} className={styles.form}>
              <input type="hidden" name="returnPath" value={createTabHref} />
              <div className={styles.formGrid}>
                <label className={styles.field}>
                  <span>Cliente</span>
                  <select name="customerId" defaultValue="">
                    <option value="">Selecionar</option>
                    {customers.map((customer) => (
                      <option key={customer.id} value={customer.id}>
                        {customer.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className={styles.field}>
                  <span>Observação</span>
                  <input name="notes" placeholder="Ex.: cadeira 2" />
                </label>
              </div>
              <button type="submit" className={styles.primaryButton}>
                Abrir comanda
              </button>
            </form>
          </section>

          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Painel da fila</p>
                <h2>Leitura executiva</h2>
              </div>
            </div>

            <div className={styles.insightList}>
              <article className={styles.insightRow}>
                <span>Maior comanda aberta</span>
                <strong>
                  {largestOpenTab
                    ? formatCurrency(Number(largestOpenTab.total_items ?? 0))
                    : "R$ 0,00"}
                </strong>
                <small>
                  {largestOpenTab
                    ? firstRelation(largestOpenTab.customers)?.name ??
                      "Cliente sem cadastro"
                    : "Sem destaque agora"}
                </small>
              </article>
              <article className={styles.insightRow}>
                <span>Prontas para fechar</span>
                <strong>{tabsReadyToClose}</strong>
                <small>Contas liquidadas para limpar a fila.</small>
              </article>
              <article className={styles.insightRow}>
                <span>Itens em aberto</span>
                <strong>{openItemEntries}</strong>
                <small>Lancamentos ativos nas comandas abertas.</small>
              </article>
              <article className={styles.insightRow}>
                <span>Sem cliente vinculado</span>
                <strong>{tabsWithoutCustomer}</strong>
                <small>Vincule o cadastro para melhorar o histórico.</small>
              </article>
            </div>
          </section>

          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Upsell</p>
                <h2>Oportunidades rápidas</h2>
              </div>
            </div>

            <div className={styles.insightList}>
              <article className={styles.insightRow}>
                <span>Serviço com melhor saída</span>
                <strong>{topServiceSuggestion?.name ?? "Sem leitura"}</strong>
                <small>
                  {topServiceSuggestion
                    ? formatCurrency(topServiceSuggestion.price)
                    : "Sem serviço em destaque agora"}
                </small>
              </article>
              <article className={styles.insightRow}>
                <span>Produto com melhor saída</span>
                <strong>{topProductSuggestion?.name ?? "Sem leitura"}</strong>
                <small>
                  {topProductSuggestion
                    ? formatCurrency(topProductSuggestion.price)
                    : "Sem produto destacado agora"}
                </small>
              </article>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
