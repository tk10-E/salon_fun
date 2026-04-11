import Image from "next/image";

import {
  registerInventoryMovementAction,
  saveInventoryProductAction,
  updateCustomerProductOrderStatusAction,
} from "@/app/actions";
import { CuratedImageUploadField } from "@/components/CuratedImageUploadField";
import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

import type {
  InventoryPageData,
  InventoryProduct,
  InventoryStoreOrder,
  InventoryStoreOrderStatus,
} from "./_lib";

const INVENTORY_PATH = "/dashboard/inventory";

type InventoryPageContentProps = {
  data: InventoryPageData;
};

export function InventoryPageContent({ data }: InventoryPageContentProps) {
  const inventoryProducts = data.products.inventoryProducts;
  const storeOrders = data.orders.storeOrders;
  const inventoryMovements = data.movements.inventoryMovements;
  const activeProducts = inventoryProducts.filter((product) => product.isActive);
  const pausedProducts = inventoryProducts.filter((product) => !product.isActive);
  const outOfStockProducts = inventoryProducts.filter(
    (product) => Number(product.currentStock ?? 0) <= 0,
  );
  const readyOrders = storeOrders.filter((order) => order.status === "ready");
  const completedOrders = storeOrders.filter(
    (order) => order.status === "completed",
  );
  const cancelledOrders = storeOrders.filter(
    (order) => order.status === "cancelled",
  );
  const recentAverageTicket = completedOrders.length
    ? completedOrders.reduce(
        (sum, order) => sum + Number(order.subtotalAmount ?? 0),
        0,
      ) / completedOrders.length
    : 0;
  const inventoryRetailValue = inventoryProducts.reduce(
    (sum, product) =>
      sum +
      Math.max(Number(product.currentStock ?? 0), 0) *
        Math.max(Number(product.retailPrice ?? 0), 0),
    0,
  );
  const featuredProduct =
    [...inventoryProducts].sort((left, right) => {
      const rightScore =
        Math.max(Number(right.currentStock ?? 0), 0) *
        Math.max(Number(right.retailPrice ?? 0), 0);
      const leftScore =
        Math.max(Number(left.currentStock ?? 0), 0) *
        Math.max(Number(left.retailPrice ?? 0), 0);

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (left.isLowStock !== right.isLowStock) {
        return left.isLowStock ? 1 : -1;
      }

      if (left.isActive !== right.isActive) {
        return left.isActive ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })[0] ?? null;
  const latestOrder = storeOrders[0] ?? null;
  const latestMovement = inventoryMovements[0] ?? null;

  return (
    <>
      <DashboardWorkspaceHero
        id="inventory-overview"
        className="inventory-page__hero"
        eyebrow="Loja profissional"
        title="Produtos, pedidos e estoque em leitura de negócio."
        description="Acompanhe vendas recentes, vitrine do app e controle de produtos do salão em uma operação só."
        highlight={{
          label: "Visão da loja",
          value: data.header.openStoreOrders
            ? `${data.header.openStoreOrders} pedido${data.header.openStoreOrders === 1 ? "" : "s"} em andamento`
            : `${data.header.publishedStoreProducts} produto${data.header.publishedStoreProducts === 1 ? "" : "s"} pronto${data.header.publishedStoreProducts === 1 ? "" : "s"} para venda`,
          note: `${data.header.publishedStoreProducts} na vitrine, ${data.header.lowStockProductsCount} em alerta e receita recente de ${formatCurrency(data.header.storeRevenue)}.`,
        }}
        signals={[
          {
            label: "Vitrine ativa",
            value: data.header.publishedStoreProducts,
            tone: data.header.publishedStoreProducts ? "success" : "soft",
          },
          {
            label: "Reposição",
            value: data.header.lowStockProductsCount,
            tone: data.header.lowStockProductsCount ? "warm" : "success",
          },
          {
            label: "Prontos",
            value: readyOrders.length,
            tone: readyOrders.length ? "accent" : "soft",
          },
          {
            label: "Pausados",
            value: pausedProducts.length,
            tone: pausedProducts.length ? "soft" : "success",
          },
        ]}
        stats={[
          {
            label: "Receita recente",
            value: formatCurrency(data.header.storeRevenue),
            note: "Pedidos concluídos carregados nesta leitura.",
            tone: data.header.storeRevenue > 0 ? "accent" : "soft",
          },
          {
            label: "Ticket recente",
            value: completedOrders.length
              ? formatCurrency(recentAverageTicket)
              : "Sem base",
            note: completedOrders.length
              ? "Média dos pedidos concluídos."
              : "Aparece quando a loja fechar vendas.",
            tone: completedOrders.length ? "soft" : "neutral",
          },
          {
            label: "Potencial em estoque",
            value: inventoryRetailValue
              ? formatCurrency(inventoryRetailValue)
              : "Sem base",
            note: "Saldo atual multiplicado pelo preço de venda.",
            tone: inventoryRetailValue ? "success" : "soft",
          },
          {
            label: "Produtos cadastrados",
            value: inventoryProducts.length,
            note: `${activeProducts.length} ativo${activeProducts.length === 1 ? "" : "s"} e ${outOfStockProducts.length} sem saldo.`,
            tone: inventoryProducts.length ? "warm" : "neutral",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#inventory-orders" className="secondary-button">
              Ver pedidos
            </a>
            <a href="#product-create" className="primary-button">
              Novo produto
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Produto em foco</span>
            <h3>{featuredProduct?.name ?? "Monte sua vitrine de produtos"}</h3>
            <p>
              {featuredProduct
                ? `${getStorefrontStatusLabel(
                    featuredProduct,
                  )} com ${formatStock(
                    featuredProduct.currentStock,
                    featuredProduct.unit,
                  )} disponíveis e venda em ${formatMoneyValue(
                    featuredProduct.retailPrice,
                  )}.`
                : "Cadastre produtos com preço, saldo e apresentação forte para apoiar as vendas do salão."}
            </p>
            <div className="inventory-page__hero-grid">
              <article>
                <span>Último pedido</span>
                <strong>
                  {latestOrder
                    ? `#${latestOrder.orderNumber} · ${latestOrder.customerName}`
                    : "Nenhum pedido recente"}
                </strong>
              </article>
              <article>
                <span>Último ajuste</span>
                <strong>
                  {latestMovement
                    ? `${formatMovementLabel(latestMovement.movementType)} em ${latestMovement.productName}`
                    : "Sem ajuste recente"}
                </strong>
              </article>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos da loja"
        items={[
          {
            href: "#inventory-alerts",
            label: "Reposição",
            meta: "Produtos em alerta",
          },
          {
            href: "#inventory-orders",
            label: "Pedidos",
            meta: "Confirmação e entrega",
          },
          {
            href: "#product-create",
            label: "Novo produto",
            meta: "Cadastro e vitrine",
          },
          {
            href: "#inventory-products",
            label: "Catálogo",
            meta: "Preço, saldo e edição",
          },
          {
            href: "#inventory-movements",
            label: "Movimentos",
            meta: "Histórico e ajustes",
          },
        ]}
      />

      <section
        className="workspace-subgrid inventory-page__summary-grid"
        aria-label="Resumo da loja"
      >
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Vitrine operando</span>
          <h3>
            {data.header.publishedStoreProducts} produto
            {data.header.publishedStoreProducts === 1 ? "" : "s"} com venda ativa
          </h3>
          <p>
            {data.header.hiddenStoreProductsCount
              ? `${data.header.hiddenStoreProductsCount} produto${data.header.hiddenStoreProductsCount === 1 ? "" : "s"} ativo${data.header.hiddenStoreProductsCount === 1 ? "" : "s"} ainda não entra${data.header.hiddenStoreProductsCount === 1 ? "" : "m"} na vitrine por saldo ou preço.`
              : "Tudo que está ativo já aparece pronto para venda no app."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Fila da operação</span>
          <h3>
            {data.header.openStoreOrders} pedido
            {data.header.openStoreOrders === 1 ? "" : "s"} em andamento
          </h3>
          <p>
            {readyOrders.length
              ? `${readyOrders.length} já ${readyOrders.length === 1 ? "está pronto" : "estão prontos"} para retirada ou entrega.`
              : "A fila pronta aparece aqui assim que a loja começar a girar."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Controle do estoque</span>
          <h3>
            {data.header.lowStockProductsCount} item
            {data.header.lowStockProductsCount === 1 ? "" : "s"} pedindo reposição
          </h3>
          <p>
            {outOfStockProducts.length
              ? `${outOfStockProducts.length} ${outOfStockProducts.length === 1 ? "já está sem saldo e precisa" : "já estão sem saldo e precisam"} de ação imediata.`
              : "Nenhum produto zerado no momento."}
          </p>
        </article>
      </section>

      <InventoryAlertsSection alerts={data.alerts} />
      <InventoryOrdersSection orders={data.orders} />
      <InventoryCreateProductSection />
      <InventoryProductsSection
        products={data.products}
        staffOptions={data.staffOptions}
      />
      <InventoryMovementsSection movements={data.movements} />
    </>
  );
}

function formatStock(value: number | string, unit?: string) {
  const numericValue = Number(value ?? 0);
  const formatted = new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(numericValue) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(numericValue);

  return unit?.trim().length ? `${formatted} ${unit}` : formatted;
}

function formatMoneyValue(value: number | string | null) {
  return value == null ? "Sem preço" : formatCurrency(Number(value));
}

function formatMovementLabel(
  value: InventoryPageData["movements"]["inventoryMovements"][number]["movementType"],
) {
  switch (value) {
    case "in":
      return "Entrada";
    case "out":
      return "Saída";
    default:
      return "Ajuste";
  }
}

function formatStoreOrderStatusLabel(value: InventoryStoreOrderStatus) {
  switch (value) {
    case "confirmed":
      return "Separando";
    case "ready":
      return "Pronto";
    case "completed":
      return "Concluído";
    case "cancelled":
      return "Cancelado";
    default:
      return "Novo";
  }
}

function resolveStoreOrderBadgeClass(value: InventoryStoreOrderStatus) {
  switch (value) {
    case "confirmed":
      return "badge badge--accent";
    case "ready":
      return "badge badge--soft";
    case "completed":
      return "badge badge--confirmed";
    case "cancelled":
      return "badge badge--cancelled";
    default:
      return "badge badge--pending";
  }
}

function getStoreOrderStatusNote(order: InventoryStoreOrder) {
  switch (order.status) {
    case "confirmed":
      return "Pedido em separação pela equipe.";
    case "ready":
      return "Pronto para retirada ou entrega.";
    case "completed":
      return "Pedido concluído com sucesso.";
    case "cancelled":
      return order.cancellationReason?.trim() || "Pedido cancelado.";
    default:
      return "Aguardando confirmação da loja.";
  }
}

function getStorefrontStatusLabel(product: InventoryProduct) {
  if (!product.isActive) {
    return "Produto pausado";
  }

  if (Number(product.currentStock ?? 0) <= 0) {
    return "Sem saldo na vitrine";
  }

  if (Number(product.retailPrice ?? 0) <= 0) {
    return "Sem preço de venda";
  }

  return "Vitrine pronta para vender";
}

function getStorefrontBadgeLabel(product: InventoryProduct) {
  if (!product.isActive) {
    return "Pausado";
  }

  if (Number(product.currentStock ?? 0) <= 0) {
    return "Sem saldo";
  }

  if (Number(product.retailPrice ?? 0) <= 0) {
    return "Sem preço";
  }

  return "Na vitrine";
}

function getStorefrontBadgeClass(product: InventoryProduct) {
  if (!product.isActive) {
    return "badge badge--cancelled";
  }

  if (
    Number(product.currentStock ?? 0) <= 0 ||
    Number(product.retailPrice ?? 0) <= 0
  ) {
    return "badge badge--pending";
  }

  return "badge badge--confirmed";
}

function getProductMarginValue(product: InventoryProduct) {
  const retail = Number(product.retailPrice ?? 0);
  const cost = Number(product.costPrice ?? 0);

  if (retail <= 0 || cost <= 0) {
    return null;
  }

  return retail - cost;
}

function getProductPotentialValue(product: InventoryProduct) {
  const stock = Math.max(Number(product.currentStock ?? 0), 0);
  const retail = Math.max(Number(product.retailPrice ?? 0), 0);

  return stock * retail;
}

function getMovementQuantityLabel(
  movement: InventoryPageData["movements"]["inventoryMovements"][number],
) {
  const prefix = movement.movementType === "out" ? "-" : "+";
  return `${prefix}${formatStock(movement.quantity)}`;
}

function InventoryAlertsSection({
  alerts,
}: {
  alerts: InventoryPageData["alerts"];
}) {
  return (
    <section id="inventory-alerts" className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Reposição em atenção</h2>
          <p className="muted">
            Produtos no mínimo ou abaixo pedindo ação do salão.
          </p>
        </div>
      </div>

      {alerts.lowStockProducts.length ? (
        <div className="inventory-page__alert-grid">
          {alerts.lowStockProducts.map((product) => (
            <article
              key={product.id}
              className="simple-row inventory-alert-card inventory-page__alert-card"
            >
              <div className="inline-actions" style={{ flexWrap: "wrap" }}>
                <span className="badge badge--pending">Reposição</span>
                <span className="badge badge--soft">
                  Atual {formatStock(product.currentStock, product.unit)}
                </span>
                <span className="badge badge--soft">
                  Mínimo {formatStock(product.minimumStock, product.unit)}
                </span>
              </div>
              <h3>{product.name}</h3>
              <p className="muted">
                Revise esse saldo para não deixar a vitrine sem cobertura e nem
                faltar produto na operação.
              </p>
              <a href="#inventory-products" className="secondary-button">
                Ver no catálogo
              </a>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Loja abastecida"
          title="Nenhum item em alerta agora"
          description="Quando o saldo encostar no mínimo, a reposição aparece aqui."
        />
      )}
    </section>
  );
}

function InventoryOrdersSection({
  orders,
}: {
  orders: InventoryPageData["orders"];
}) {
  const pendingOrders = orders.storeOrders.filter(
    (order) => order.status === "pending",
  ).length;
  const confirmedOrders = orders.storeOrders.filter(
    (order) => order.status === "confirmed",
  ).length;
  const readyOrders = orders.storeOrders.filter(
    (order) => order.status === "ready",
  ).length;
  const completedOrders = orders.storeOrders.filter(
    (order) => order.status === "completed",
  ).length;
  const cancelledOrders = orders.storeOrders.filter(
    (order) => order.status === "cancelled",
  ).length;

  return (
    <section id="inventory-orders" className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Pedidos e retirada</h2>
          <p className="muted">
            Confirmação, separação e entrega da loja em uma fila só.
          </p>
        </div>
      </div>

      <div className="workspace-signal-strip" style={{ marginTop: 18 }}>
        <div className="workspace-signal-pill workspace-hero__stat--warm">
          <span>Novos</span>
          <strong>{pendingOrders}</strong>
        </div>
        <div className="workspace-signal-pill workspace-hero__stat--accent">
          <span>Separando</span>
          <strong>{confirmedOrders}</strong>
        </div>
        <div className="workspace-signal-pill workspace-hero__stat--soft">
          <span>Prontos</span>
          <strong>{readyOrders}</strong>
        </div>
        <div className="workspace-signal-pill workspace-hero__stat--success">
          <span>Concluídos</span>
          <strong>{completedOrders}</strong>
        </div>
        {cancelledOrders ? (
          <div className="workspace-signal-pill workspace-hero__stat--danger">
            <span>Cancelados</span>
            <strong>{cancelledOrders}</strong>
          </div>
        ) : null}
      </div>

      <div className="row-list inventory-page__orders-stack" style={{ marginTop: 18 }}>
        {!orders.storeOrders.length ? (
          <EmptyStateCard
            eyebrow="Sem pedidos ainda"
            title="A fila da loja aparece aqui"
            description="Quando a cliente comprar pelo app, o pedido entra nesta lista."
          />
        ) : (
          orders.storeOrders.map((order) => (
            <article key={order.id} className="simple-row inventory-order-card">
              <div className="inventory-order-card__header">
                <div>
                  <div className="inline-actions" style={{ marginBottom: 8, flexWrap: "wrap" }}>
                    <span className={resolveStoreOrderBadgeClass(order.status)}>
                      {formatStoreOrderStatusLabel(order.status)}
                    </span>
                    <span className="badge badge--soft">Pedido #{order.orderNumber}</span>
                    <span className="badge badge--soft">
                      {formatDateTime(order.orderMoment)}
                    </span>
                  </div>
                  <h3>{order.customerName}</h3>
                  <p className="muted">{getStoreOrderStatusNote(order)}</p>
                </div>

                <div className="inventory-order-card__metrics">
                  <div className="customer-metric-tile">
                    <span className="customer-detail-item__label">Total</span>
                    <strong>{formatCurrency(Number(order.subtotalAmount ?? 0))}</strong>
                  </div>
                  <div className="customer-metric-tile">
                    <span className="customer-detail-item__label">Itens</span>
                    <strong>
                      {order.totalItems} item{order.totalItems === 1 ? "" : "s"}
                    </strong>
                  </div>
                  <div className="customer-metric-tile">
                    <span className="customer-detail-item__label">Contato</span>
                    <strong>{order.customerPhone || "Não informado"}</strong>
                  </div>
                </div>
              </div>

              <div className="inventory-order-card__body">
                <article className="customer-detail-item">
                  <span className="customer-detail-item__label">Produtos</span>
                  <strong>
                    {order.items.length
                      ? order.items
                          .map((item) => item.productNameSnapshot)
                          .join(" • ")
                      : "Pedido sem itens visíveis."}
                  </strong>
                </article>

                <article className="customer-detail-item">
                  <span className="customer-detail-item__label">Observação</span>
                  <strong>
                    {order.notes?.trim() || "Sem observações desse pedido."}
                  </strong>
                </article>
              </div>

              {order.status !== "completed" && order.status !== "cancelled" ? (
                <div className="simple-row__actions inventory-order-card__actions">
                  {order.status === "pending" ? (
                    <form action={updateCustomerProductOrderStatusAction}>
                      <input type="hidden" name="returnPath" value={INVENTORY_PATH} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value="confirmed" />
                      <button type="submit" className="primary-button">
                        Confirmar pedido
                      </button>
                    </form>
                  ) : null}

                  {order.status === "pending" || order.status === "confirmed" ? (
                    <form action={updateCustomerProductOrderStatusAction}>
                      <input type="hidden" name="returnPath" value={INVENTORY_PATH} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value="ready" />
                      <button type="submit" className="secondary-button">
                        Marcar pronto
                      </button>
                    </form>
                  ) : null}

                  {order.status === "ready" ? (
                    <form action={updateCustomerProductOrderStatusAction}>
                      <input type="hidden" name="returnPath" value={INVENTORY_PATH} />
                      <input type="hidden" name="orderId" value={order.id} />
                      <input type="hidden" name="status" value="completed" />
                      <button type="submit" className="primary-button">
                        Concluir entrega
                      </button>
                    </form>
                  ) : null}
                </div>
              ) : null}

              {order.status !== "completed" && order.status !== "cancelled" ? (
                <form
                  action={updateCustomerProductOrderStatusAction}
                  className="simple-form"
                >
                  <input type="hidden" name="returnPath" value={INVENTORY_PATH} />
                  <input type="hidden" name="orderId" value={order.id} />
                  <input type="hidden" name="status" value="cancelled" />

                  <div className="split-grid inventory-order-card__cancel-grid">
                    <div className="field">
                      <label htmlFor={`cancel-store-order-${order.id}`}>
                        Motivo do cancelamento
                      </label>
                      <input
                        id={`cancel-store-order-${order.id}`}
                        name="cancellationReason"
                        placeholder="Ex.: item indisponível, cliente desistiu"
                        required
                      />
                    </div>
                    <div className="inline-actions inventory-order-card__cancel-action">
                      <button type="submit" className="secondary-button">
                        Cancelar pedido
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

function InventoryCreateProductSection() {
  return (
    <section id="product-create" className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Novo produto</h2>
          <p className="muted">
            Cadastro comercial para vender bem e controlar melhor.
          </p>
        </div>
      </div>

      <div className="inventory-page__create-grid">
        <div className="inventory-page__create-guide">
          <article className="workspace-panel">
            <span className="workspace-panel__eyebrow">Posicionamento</span>
            <h3>Nome, marca e descrição precisam vender juntos.</h3>
            <p>
              Use um nome claro, destaque a marca quando fizer diferença e
              descreva o benefício do produto em linguagem simples.
            </p>
          </article>

          <article className="workspace-panel">
            <span className="workspace-panel__eyebrow">Preço e margem</span>
            <h3>Defina custo, venda e limite por pedido.</h3>
            <p>
              Isso ajuda a proteger a margem, evitar excesso em um único pedido
              e manter a loja saudável.
            </p>
          </article>

          <article className="workspace-panel">
            <span className="workspace-panel__eyebrow">Controle de saldo</span>
            <h3>Estoque inicial e mínimo já entram prontos para operação.</h3>
            <p>
              O painel passa a avisar quando a reposição estiver chegando no
              limite do salão.
            </p>
          </article>
        </div>

        <form
          action={saveInventoryProductAction}
          className="simple-form inventory-page__product-form"
          encType="multipart/form-data"
        >
          <input type="hidden" name="returnPath" value={INVENTORY_PATH} />

          <div className="field">
            <label htmlFor="inventory-name">Produto</label>
            <input
              id="inventory-name"
              name="name"
              placeholder="Ex.: Shampoo reconstrutor"
              required
            />
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

          <div className="field">
            <label htmlFor="inventory-description">Descrição</label>
            <textarea
              id="inventory-description"
              name="description"
              rows={3}
              placeholder="Resumo curto do produto para a cliente."
            />
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="inventory-unit">Unidade</label>
              <input id="inventory-unit" name="unit" defaultValue="un" required />
            </div>
            <div className="field">
              <label htmlFor="inventory-current-stock">Estoque inicial</label>
              <input
                id="inventory-current-stock"
                name="currentStock"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                required
              />
            </div>
            <div className="field">
              <label htmlFor="inventory-minimum-stock">Estoque mínimo</label>
              <input
                id="inventory-minimum-stock"
                name="minimumStock"
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
              <label htmlFor="inventory-cost-price">Custo</label>
              <input
                id="inventory-cost-price"
                name="costPrice"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <div className="field">
              <label htmlFor="inventory-retail-price">Preço de venda</label>
              <input
                id="inventory-retail-price"
                name="retailPrice"
                type="number"
                min="0"
                step="0.01"
              />
            </div>
            <div className="field">
              <label htmlFor="inventory-max-purchase-quantity">
                Limite por pedido
              </label>
              <input
                id="inventory-max-purchase-quantity"
                name="maxPurchaseQuantity"
                type="number"
                min="1"
                max="99"
                step="1"
                defaultValue="6"
                required
              />
            </div>
          </div>

          <div className="field">
            <label htmlFor="inventory-product-images">Fotos</label>
            <CuratedImageUploadField
              id="inventory-product-images"
              name="productImages"
              context="product"
              multiple
            />
            <span className="list-meta">Até 6 fotos. A primeira vira capa.</span>
          </div>

          <label className="checkbox-field">
            <input type="checkbox" name="isActive" defaultChecked />
            Produto visível na loja
          </label>

          <button type="submit" className="primary-button">
            Salvar produto
          </button>
        </form>
      </div>
    </section>
  );
}

function InventoryProductsSection({
  products,
  staffOptions,
}: {
  products: InventoryPageData["products"];
  staffOptions: InventoryPageData["staffOptions"];
}) {
  return (
    <section id="inventory-products" className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Catálogo de produtos</h2>
          <p className="muted">
            Vitrine, preço, margem e saldo do salão em leitura clara.
          </p>
        </div>
      </div>

      {!products.inventoryProducts.length ? (
        <EmptyStateCard
          eyebrow="Sem produtos ainda"
          title="Cadastre o primeiro produto"
          description="A vitrine, o preço e o estoque aparecem aqui."
        />
      ) : (
        <div className="row-list inventory-page__products-stack">
          {products.inventoryProducts.map((product) => {
            const coverImageUrl = product.imageUrls[0] ?? null;
            const galleryCount = product.imageUrls.length;
            const marginValue = getProductMarginValue(product);
            const potentialValue = getProductPotentialValue(product);

            return (
              <article
                key={product.id}
                className="simple-row inventory-product-card"
              >
                <div className="inline-actions" style={{ marginBottom: 4, flexWrap: "wrap" }}>
                  <span
                    className={
                      product.isActive
                        ? "badge badge--confirmed"
                        : "badge badge--cancelled"
                    }
                  >
                    {product.isActive ? "Ativo" : "Pausado"}
                  </span>
                  <span className={getStorefrontBadgeClass(product)}>
                    {getStorefrontBadgeLabel(product)}
                  </span>
                  {product.isLowStock ? (
                    <span className="badge badge--pending">Estoque baixo</span>
                  ) : null}
                  {product.brand ? (
                    <span className="badge badge--soft">{product.brand}</span>
                  ) : null}
                  <span className="badge badge--soft">
                    {galleryCount === 0
                      ? "Sem fotos"
                      : `${galleryCount} foto${galleryCount === 1 ? "" : "s"}`}
                  </span>
                </div>

                <div className="inventory-product-card__top">
                  <div className="inventory-product-preview__media">
                    {coverImageUrl ? (
                      <Image
                        src={coverImageUrl}
                        alt={product.name}
                        fill
                        sizes="160px"
                        style={{ objectFit: "cover" }}
                      />
                    ) : (
                      <div className="inventory-product-preview__placeholder">
                        Loja
                      </div>
                    )}
                  </div>

                  <div className="inventory-product-card__copy">
                    <h3>{product.name}</h3>
                    <p className="muted">
                      {product.description?.trim() ||
                        "Produto pronto para apoiar venda consultiva, reposição e presença de marca do salão."}
                    </p>
                    <small className="list-meta">
                      {getStorefrontStatusLabel(product)} • SKU{" "}
                      {product.sku?.trim() || "não definido"} • limite por pedido{" "}
                      {product.maxPurchaseQuantity}
                    </small>
                  </div>
                </div>

                <div className="inventory-product-card__metrics">
                  <article className="customer-metric-tile">
                    <span className="customer-detail-item__label">Estoque atual</span>
                    <strong>{formatStock(product.currentStock, product.unit)}</strong>
                  </article>
                  <article className="customer-metric-tile">
                    <span className="customer-detail-item__label">Preço de venda</span>
                    <strong>{formatMoneyValue(product.retailPrice)}</strong>
                  </article>
                  <article className="customer-metric-tile">
                    <span className="customer-detail-item__label">Custo</span>
                    <strong>{formatMoneyValue(product.costPrice)}</strong>
                  </article>
                  <article className="customer-metric-tile">
                    <span className="customer-detail-item__label">Margem unitária</span>
                    <strong>
                      {marginValue == null ? "Sem base" : formatCurrency(marginValue)}
                    </strong>
                  </article>
                  <article className="customer-metric-tile">
                    <span className="customer-detail-item__label">Potencial na prateleira</span>
                    <strong>
                      {potentialValue > 0 ? formatCurrency(potentialValue) : "Sem base"}
                    </strong>
                  </article>
                  <article className="customer-metric-tile">
                    <span className="customer-detail-item__label">Atualizado em</span>
                    <strong>{formatDateTime(product.updatedAt)}</strong>
                  </article>
                </div>

                <details className="accordion">
                  <summary>
                    <span>Cadastro e vitrine</span>
                    <span className="accordion__cta">abrir</span>
                  </summary>
                  <div className="simple-form inventory-product-form" style={{ marginTop: 10 }}>
                    <form
                      action={saveInventoryProductAction}
                      className="simple-form"
                      encType="multipart/form-data"
                    >
                      <input type="hidden" name="returnPath" value={INVENTORY_PATH} />
                      <input type="hidden" name="productId" value={product.id} />

                      <div className="split-grid">
                        <input name="name" defaultValue={product.name} required />
                        <input
                          name="brand"
                          defaultValue={product.brand ?? ""}
                          placeholder="Marca"
                        />
                      </div>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={product.description ?? ""}
                        placeholder="Descrição para a loja"
                      />
                      <div className="split-grid">
                        <input
                          name="currentStock"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={Number(product.currentStock ?? 0)}
                          placeholder="Estoque atual"
                          required
                        />
                        <input
                          name="minimumStock"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={Number(product.minimumStock ?? 0)}
                          placeholder="Estoque mínimo"
                          required
                        />
                        <input
                          name="maxPurchaseQuantity"
                          type="number"
                          min="1"
                          max="99"
                          step="1"
                          defaultValue={product.maxPurchaseQuantity}
                          placeholder="Limite por pedido"
                          required
                        />
                      </div>
                      <div className="split-grid">
                        <input
                          name="costPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={
                            product.costPrice == null ? "" : Number(product.costPrice)
                          }
                          placeholder="Custo"
                        />
                        <input
                          name="retailPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={
                            product.retailPrice == null
                              ? ""
                              : Number(product.retailPrice)
                          }
                          placeholder="Preço de venda"
                        />
                        <input
                          name="unit"
                          defaultValue={product.unit}
                          placeholder="Unidade"
                          required
                        />
                        <input
                          name="sku"
                          defaultValue={product.sku ?? ""}
                          placeholder="SKU"
                        />
                      </div>

                      <div className="field">
                        <label>Fotos da loja</label>
                        <CuratedImageUploadField
                          id={`product-images-${product.id}`}
                          name="productImages"
                          context="product"
                          multiple
                          defaultPreviewUrls={product.imageUrls}
                          replaceHint="Novas fotos substituem a galeria atual."
                        />
                      </div>

                      <label className="checkbox-field">
                        <input
                          type="checkbox"
                          name="isActive"
                          defaultChecked={product.isActive}
                        />
                        Produto visível para a cliente
                      </label>

                      <div className="simple-row__actions">
                        <button type="submit" className="primary-button">
                          Salvar produto
                        </button>
                        <span className="list-meta">
                          Atualizado em {formatDateTime(product.updatedAt)}
                        </span>
                      </div>
                    </form>
                  </div>
                </details>

                <details className="accordion">
                  <summary>
                    <span>Movimentar saldo</span>
                    <span className="accordion__cta">abrir</span>
                  </summary>
                  <div className="simple-form inventory-product-form" style={{ marginTop: 10 }}>
                    <form
                      action={registerInventoryMovementAction}
                      className="simple-form"
                    >
                      <input type="hidden" name="returnPath" value={INVENTORY_PATH} />
                      <input type="hidden" name="productId" value={product.id} />

                      <div className="split-grid">
                        <div className="field">
                          <label>Movimento</label>
                          <select name="movementType" defaultValue="out">
                            <option value="out">Saída</option>
                            <option value="in">Entrada</option>
                            <option value="adjustment">Ajuste</option>
                          </select>
                        </div>
                        <div className="field">
                          <label>Quantidade</label>
                          <input
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
                          <label>Motivo</label>
                          <input
                            name="reason"
                            placeholder="Ex.: uso no atendimento, compra, ajuste"
                          />
                        </div>
                        <div className="field">
                          <label>Profissional</label>
                          <select name="staffMemberId" defaultValue="">
                            <option value="">Sem vínculo</option>
                            {staffOptions.map((staffMember) => (
                              <option key={staffMember.id} value={staffMember.id}>
                                {staffMember.name}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      <div className="simple-row__actions">
                        <button type="submit" className="secondary-button">
                          Salvar movimento
                        </button>
                      </div>
                    </form>
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}

function InventoryMovementsSection({
  movements,
}: {
  movements: InventoryPageData["movements"];
}) {
  const incomingCount = movements.inventoryMovements.filter(
    (movement) => movement.movementType === "in",
  ).length;
  const outgoingCount = movements.inventoryMovements.filter(
    (movement) => movement.movementType === "out",
  ).length;
  const adjustmentCount = movements.inventoryMovements.filter(
    (movement) => movement.movementType === "adjustment",
  ).length;

  return (
    <section id="inventory-movements" className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Movimentos e ajustes</h2>
          <p className="muted">
            Entradas, saídas e correções recentes do estoque.
          </p>
        </div>
      </div>

      <div className="workspace-signal-strip" style={{ marginTop: 18 }}>
        <div className="workspace-signal-pill workspace-hero__stat--success">
          <span>Entradas</span>
          <strong>{incomingCount}</strong>
        </div>
        <div className="workspace-signal-pill workspace-hero__stat--warm">
          <span>Saídas</span>
          <strong>{outgoingCount}</strong>
        </div>
        <div className="workspace-signal-pill workspace-hero__stat--soft">
          <span>Ajustes</span>
          <strong>{adjustmentCount}</strong>
        </div>
      </div>

      {!movements.inventoryMovements.length ? (
        <EmptyStateCard
          eyebrow="Sem movimentos"
          title="Nada registrado"
          description="Entradas, saídas e ajustes aparecem aqui."
        />
      ) : (
        <div className="row-list inventory-page__movements-stack" style={{ marginTop: 18 }}>
          {movements.inventoryMovements.map((movement) => (
            <article
              key={movement.id}
              className="simple-row inventory-movement-card"
            >
              <div className="inventory-movement-card__header">
                <div>
                  <div className="inline-actions" style={{ marginBottom: 8, flexWrap: "wrap" }}>
                    <span className="badge badge--soft">
                      {formatMovementLabel(movement.movementType)}
                    </span>
                    <span className="badge badge--soft">
                      {formatDateTime(movement.createdAt)}
                    </span>
                  </div>
                  <h3>{movement.productName}</h3>
                  <p className="muted">
                    {movement.staffName
                      ? `Movimento lançado por ${movement.staffName}.`
                      : "Movimento sem profissional vinculado."}
                  </p>
                </div>

                <div className="inventory-movement-card__metrics">
                  <div className="customer-metric-tile">
                    <span className="customer-detail-item__label">Quantidade</span>
                    <strong>{getMovementQuantityLabel(movement)}</strong>
                  </div>
                  <div className="customer-metric-tile">
                    <span className="customer-detail-item__label">Antes</span>
                    <strong>{formatStock(movement.previousStock)}</strong>
                  </div>
                  <div className="customer-metric-tile">
                    <span className="customer-detail-item__label">Depois</span>
                    <strong>{formatStock(movement.resultingStock)}</strong>
                  </div>
                </div>
              </div>

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
