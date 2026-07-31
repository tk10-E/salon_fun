import Image from "next/image";
import type { CSSProperties, ReactNode } from "react";

import {
  registerInventoryMovementAction,
  saveInventoryProductAction,
  updateCustomerProductOrderStatusAction,
} from "@/app/actions";
import { CuratedImageUploadField } from "@/components/CuratedImageUploadField";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatCurrency, formatDateTime } from "@/lib/formatters";

import type {
  InventoryPageData,
  InventoryProduct,
  InventoryStoreOrderStatus,
} from "./_lib";
import styles from "./page.module.css";

const INVENTORY_PATH = "/dashboard/inventory";

type InventorySearchParams = {
  brand?: string;
  category?: string;
  compose?: string;
  q?: string;
  sort?: string;
  status?: string;
};

type InventoryPageContentProps = {
  data: InventoryPageData;
  searchParams?: InventorySearchParams;
};

type ProductSalesSummary = {
  lastSoldAt: string | null;
  orders: number;
  profit: number;
  revenue: number;
  units: number;
};

function normalizeText(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeSearch(value?: string | null) {
  return normalizeText(value).toLocaleLowerCase("pt-BR");
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  const normalizedQuery = normalizeSearch(query);
  return values.some((value) => normalizeSearch(value).includes(normalizedQuery));
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
  return value == null ? "Sem preco" : formatCurrency(Number(value));
}

function formatMetricCurrency(value: number) {
  return formatCurrency(value).replace("R$ ", "R$\u00A0");
}

function inventoryCategoryLabel(product: {
  brand?: string | null;
  description?: string | null;
  name?: string | null;
}) {
  const haystack = normalizeSearch(
    `${product.name ?? ""} ${product.description ?? ""} ${product.brand ?? ""}`,
  );

  if (haystack.includes("kit")) {
    return "Kits";
  }

  if (
    haystack.includes("escova") ||
    haystack.includes("pente") ||
    haystack.includes("acessor") ||
    haystack.includes("tesoura")
  ) {
    return "Acessorios";
  }

  if (
    haystack.includes("pele") ||
    haystack.includes("facial") ||
    haystack.includes("skincare") ||
    haystack.includes("serum")
  ) {
    return "Skincare";
  }

  if (
    haystack.includes("barba") ||
    haystack.includes("balm") ||
    haystack.includes("pos barba") ||
    haystack.includes("locao pos")
  ) {
    return "Barba";
  }

  return "Cabelos";
}

function buildInventoryHref(
  current: InventorySearchParams | undefined,
  overrides: Record<string, string | undefined>,
) {
  const params = new URLSearchParams();

  if (current) {
    for (const key of ["brand", "category", "compose", "q", "sort", "status"] as const) {
      const rawValue = current[key];
      if (rawValue) {
        params.set(key, rawValue);
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
  return `${INVENTORY_PATH}${query ? `?${query}` : ""}`;
}

function buildInventoryReportHref(
  products: InventoryProduct[],
  salesMap: Map<string, ProductSalesSummary>,
) {
  const header = [
    "Produto",
    "Marca",
    "Categoria",
    "Estoque",
    "Estoque minimo",
    "Preco venda",
    "Custo",
    "Unidades vendidas",
    "Receita",
    "Lucro estimado",
    "Status",
  ];
  const rows = products.map((product) => {
    const stats = salesMap.get(product.id) ?? null;
    return [
      product.name,
      product.brand ?? "",
      inventoryCategoryLabel(product),
      String(Number(product.currentStock ?? 0)),
      String(Number(product.minimumStock ?? 0)),
      String(Number(product.retailPrice ?? 0)),
      String(Number(product.costPrice ?? 0)),
      String(stats?.units ?? 0),
      String(stats?.revenue ?? 0),
      String(stats?.profit ?? 0),
      product.isActive ? "Ativo" : "Pausado",
    ]
      .map((cell) => `"${String(cell).replaceAll('"', '""')}"`)
      .join(",");
  });

  const csv = [header.join(","), ...rows].join("\n");
  return `data:text/csv;charset=utf-8,%EF%BB%BF${encodeURIComponent(csv)}`;
}

function productStatusLabel(product: InventoryProduct) {
  if (!product.isActive) {
    return "Pausado";
  }

  if (Number(product.currentStock ?? 0) <= 0) {
    return "Sem saldo";
  }

  if (product.isLowStock) {
    return "Estoque baixo";
  }

  return "Na vitrine";
}

function formatStoreOrderStatusLabel(value: InventoryStoreOrderStatus) {
  switch (value) {
    case "confirmed":
      return "Separando";
    case "ready":
      return "Pronto";
    case "completed":
      return "Concluido";
    case "cancelled":
      return "Cancelado";
    default:
      return "Novo";
  }
}

function resolveStoreOrderBadgeClass(value: InventoryStoreOrderStatus) {
  switch (value) {
    case "confirmed":
      return styles.badgeAccent;
    case "ready":
      return styles.badgeSoft;
    case "completed":
      return styles.badgeSuccess;
    case "cancelled":
      return styles.badgeMuted;
    default:
      return styles.badgeWarm;
  }
}

type SparkPoint = {
  x: number;
  y: number;
};

function buildSparklinePoints(values: number[], width = 140, height = 36) {
  if (!values.length) {
    return [] as SparkPoint[];
  }

  const maxValue = Math.max(...values, 1);
  const minValue = Math.min(...values, 0);
  const range = Math.max(maxValue - minValue, 1);
  const lastIndex = Math.max(values.length - 1, 1);

  return values.map((value, index) => ({
    x: (width * index) / lastIndex,
    y: height - ((value - minValue) / range) * (height - 4) - 2,
  }));
}

function buildSmoothSparklinePath(points: SparkPoint[]) {
  if (!points.length) {
    return "";
  }

  if (points.length === 1) {
    return `M ${points[0].x} ${points[0].y}`;
  }

  return points.reduce((path, point, index) => {
    if (index === 0) {
      return `M ${point.x} ${point.y}`;
    }

    const previousPoint = points[index - 1];
    const controlX = (previousPoint.x + point.x) / 2;
    return `${path} C ${controlX} ${previousPoint.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, "");
}

function buildSparklineAreaPath(points: SparkPoint[], height = 36) {
  if (!points.length) {
    return "";
  }

  const linePath = buildSmoothSparklinePath(points);
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];

  return `${linePath} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`;
}

function hashSparklineKey(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function MiniSparkline({
  color,
  values,
}: {
  color: string;
  values: number[];
}) {
  const width = 140;
  const height = 36;
  const points = buildSparklinePoints(values, width, height);
  const linePath = buildSmoothSparklinePath(points);
  const areaPath = buildSparklineAreaPath(points, height);
  const lastPoint = points[points.length - 1];
  const gradientKey = hashSparklineKey(`${color}:${values.join(",")}`);
  const strokeId = `sparkline-stroke-${gradientKey}`;
  const fillId = `sparkline-fill-${gradientKey}`;

  if (!linePath || !lastPoint) {
    return null;
  }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={styles.metricSparkline}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={strokeId} x1="0%" x2="100%" y1="0%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity="0.72" />
          <stop offset="100%" stopColor={color} stopOpacity="1" />
        </linearGradient>
        <linearGradient id={fillId} x1="0%" x2="0%" y1="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d={areaPath}
        fill={`url(#${fillId})`}
      />
      <path
        d={linePath}
        fill="none"
        stroke={`url(#${strokeId})`}
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2.8"
      />
      <circle cx={lastPoint.x} cy={lastPoint.y} fill="#fff" r="3.8" />
      <circle cx={lastPoint.x} cy={lastPoint.y} fill={color} r="2.2" />
    </svg>
  );
}

function InventoryMetricCard({
  accent,
  kicker,
  label,
  meta,
  title,
  trendValues,
  value,
  visual,
}: {
  accent: string;
  kicker?: string;
  label: string;
  meta?: string;
  title?: string;
  trendValues?: number[];
  value: ReactNode;
  visual?: ReactNode;
}) {
  return (
    <article className={styles.metricCard}>
      <div className={styles.metricHeader}>
        <div>
          <span className={styles.metricLabel}>{label}</span>
          <strong className={styles.metricValue}>{value}</strong>
        </div>
        <span
          className={styles.metricDot}
          data-kicker={kicker ?? "+"}
          style={{ "--metric-accent": accent } as CSSProperties}
        >
          ●
        </span>
      </div>
      {title ? <p className={styles.metricTitle}>{title}</p> : null}
      {meta ? <small className={styles.metricMeta}>{meta}</small> : null}
      {visual ?? (trendValues?.length ? <MiniSparkline color={accent} values={trendValues} /> : null)}
    </article>
  );
}

function ProductImage({
  alt,
  src,
}: {
  alt: string;
  src: string | null;
}) {
  return (
    <div className={styles.productMedia}>
      {src ? (
        <Image src={src} alt={alt} fill sizes="(max-width: 760px) 100vw, 280px" />
      ) : (
        <div className={styles.productMediaFallback}>{alt.slice(0, 1).toUpperCase()}</div>
      )}
    </div>
  );
}

function VisibleStorefrontCard({
  visibleProducts,
}: {
  visibleProducts: InventoryProduct[];
}) {
  const previewProducts = visibleProducts.slice(0, 5);

  return (
    <article className={`${styles.sidebarCard} ${styles.storefrontCard}`}>
      <div className={styles.sidebarHeader}>
        <div>
          <span className={styles.sidebarEyebrow}>Vitrine no app</span>
          <h3>Produtos prontos para vender</h3>
        </div>
        <a href="/dashboard/client-app" className={styles.inlineLink}>
          Ver previa
        </a>
      </div>
      <div className={styles.storefrontHero}>
        <div className={styles.storefrontCopy}>
          <strong>Cuide do seu estilo</strong>
          <p>O app mostra os produtos ativos com preco, foto e saldo real do estoque.</p>
          <a href="/dashboard/client-app" className={styles.primaryButton}>
            Ver produtos
          </a>
        </div>
        <div className={styles.storefrontGallery}>
          {previewProducts.length ? (
            previewProducts.map((product) => (
              <div key={product.id} className={styles.storefrontThumb}>
                {product.imageUrls[0] ? (
                  <Image src={product.imageUrls[0]} alt={product.name} fill sizes="80px" />
                ) : (
                  <span>{product.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>
            ))
          ) : (
            <div className={styles.storefrontEmpty}>Sem vitrine ativa</div>
          )}
        </div>
      </div>
    </article>
  );
}

export function InventoryPageContent({
  data,
  searchParams,
}: InventoryPageContentProps) {
  const query = normalizeText(searchParams?.q);
  const categoryFilter = searchParams?.category ?? "Todos";
  const brandFilter = searchParams?.brand ?? "";
  const statusFilter = searchParams?.status ?? "all";
  const sort = searchParams?.sort ?? "recent";
  const composeOpen = searchParams?.compose === "1";

  const inventoryProducts = data.products.inventoryProducts;
  const storeOrders = data.orders.storeOrders;
  const completedOrders = data.analytics.completedStoreOrders;
  const periodLabel = data.analytics.periodLabel;
  const inventoryMovements = data.movements.inventoryMovements;
  const activeProducts = inventoryProducts.filter((product) => product.isActive);
  const lowStockProducts = inventoryProducts.filter((product) => product.isLowStock);
  const visibleProducts = inventoryProducts.filter(
    (product) =>
      product.isActive &&
      Number(product.currentStock ?? 0) > 0 &&
      Number(product.retailPrice ?? 0) > 0,
  );
  const listedOrders = storeOrders.filter((order) => order.status !== "cancelled");

  const productMapById = new Map(inventoryProducts.map((product) => [product.id, product]));
  const productMapByName = new Map(
    inventoryProducts.map((product) => [normalizeSearch(product.name), product]),
  );
  const salesByProduct = new Map<string, ProductSalesSummary>();
  const categoryPerformance = new Map<string, { count: number; revenue: number }>();
  let estimatedProfit = 0;

  for (const order of completedOrders) {
    for (const item of order.items) {
      const product =
        (item.productId ? productMapById.get(item.productId) : null) ??
        productMapByName.get(normalizeSearch(item.productNameSnapshot)) ??
        null;
      const productId = product?.id ?? item.productId ?? normalizeSearch(item.productNameSnapshot);
      const current = salesByProduct.get(productId) ?? {
        lastSoldAt: null,
        orders: 0,
        profit: 0,
        revenue: 0,
        units: 0,
      };
      const revenue = Number(item.lineTotalAmount ?? 0);
      const quantity = Number(item.quantity ?? 0);
      const costPrice = Number(product?.costPrice ?? 0);
      const profit = revenue - costPrice * quantity;
      const soldAt = order.completedAt ?? order.orderMoment;

      salesByProduct.set(productId, {
        lastSoldAt:
          current.lastSoldAt && current.lastSoldAt > soldAt
            ? current.lastSoldAt
            : soldAt,
        orders: current.orders + 1,
        profit: current.profit + profit,
        revenue: current.revenue + revenue,
        units: current.units + quantity,
      });

      const category = inventoryCategoryLabel(
        product ?? {
          brand: item.productBrandSnapshot,
          name: item.productNameSnapshot,
        },
      );
      const performance = categoryPerformance.get(category) ?? {
        count: 0,
        revenue: 0,
      };
      categoryPerformance.set(category, {
        count: performance.count + quantity,
        revenue: performance.revenue + revenue,
      });

      estimatedProfit += profit;
    }
  }

  const averageTicket = completedOrders.length
    ? data.header.storeRevenue / completedOrders.length
    : 0;
  const totalRealizedUnits = [...salesByProduct.values()].reduce(
    (sum, item) => sum + item.units,
    0,
  );
  const categoryOptions = Array.from(
    new Set([
      "Todos",
      "Cabelos",
      "Barba",
      "Skincare",
      "Acessorios",
      "Kits",
      ...inventoryProducts.map((product) => inventoryCategoryLabel(product)),
    ]),
  );
  const brandOptions = Array.from(
    new Set(
      inventoryProducts
        .map((product) => normalizeText(product.brand))
        .filter(Boolean),
    ),
  ).sort((left, right) => left.localeCompare(right));

  const filteredProducts = inventoryProducts
    .filter((product) => {
      const category = inventoryCategoryLabel(product);
      const brand = normalizeText(product.brand);
      const stock = Number(product.currentStock ?? 0);
      const statusMatches =
        statusFilter === "all" ||
        (statusFilter === "active" && product.isActive) ||
        (statusFilter === "paused" && !product.isActive) ||
        (statusFilter === "low" && product.isLowStock) ||
        (statusFilter === "out" && stock <= 0);

      return (
        matchesQuery(query, [product.name, product.brand, product.description, category]) &&
        (categoryFilter === "Todos" || category === categoryFilter) &&
        (!brandFilter || brand === brandFilter) &&
        statusMatches
      );
    })
    .sort((left, right) => {
      const leftStats = salesByProduct.get(left.id);
      const rightStats = salesByProduct.get(right.id);

      switch (sort) {
        case "price-high":
          return Number(right.retailPrice ?? 0) - Number(left.retailPrice ?? 0);
        case "price-low":
          return Number(left.retailPrice ?? 0) - Number(right.retailPrice ?? 0);
        case "stock-high":
          return Number(right.currentStock ?? 0) - Number(left.currentStock ?? 0);
        case "sales":
          return (rightStats?.units ?? 0) - (leftStats?.units ?? 0);
        case "name":
          return left.name.localeCompare(right.name);
        default:
          return (
            new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime()
          );
      }
    });

  const categoryPerformanceRows = [...categoryPerformance.entries()]
    .map(([label, value]) => ({ label, ...value }))
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, 4);
  const topCategoryRevenue = Math.max(
    ...categoryPerformanceRows.map((row) => row.revenue),
    1,
  );
  const totalCategoryRevenue = categoryPerformanceRows.reduce(
    (sum, row) => sum + row.revenue,
    0,
  );

  const salesRanking = inventoryProducts
    .map((product) => ({
      category: inventoryCategoryLabel(product),
      product,
      stats: salesByProduct.get(product.id) ?? {
        lastSoldAt: null,
        orders: 0,
        profit: 0,
        revenue: 0,
        units: 0,
      },
    }))
    .sort((left, right) => {
      const unitsDelta = right.stats.units - left.stats.units;
      if (unitsDelta !== 0) {
        return unitsDelta;
      }
      return new Date(left.product.updatedAt).getTime() - new Date(right.product.updatedAt).getTime();
    });
  const bestSellers = salesRanking.filter((item) => item.stats.units > 0).slice(0, 3);
  const slowMovers = [...salesRanking]
    .sort((left, right) => {
      const unitsDelta = left.stats.units - right.stats.units;
      if (unitsDelta !== 0) {
        return unitsDelta;
      }
      return new Date(left.product.updatedAt).getTime() - new Date(right.product.updatedAt).getTime();
    })
    .slice(0, 3);

  const featuredProduct = salesRanking.find((item) => item.stats.units > 0) ?? null;
  const latestOrders = listedOrders.slice(0, 6);
  const latestMovements = inventoryMovements.slice(0, 6);
  const currentInventoryHref = buildInventoryHref(searchParams, {});
  const productsSectionHref = `${currentInventoryHref}#inventory-products`;
  const ordersSectionHref = `${currentInventoryHref}#inventory-orders`;
  const movementsSectionHref = `${currentInventoryHref}#inventory-movements`;
  const lowStockHref = `${buildInventoryHref(searchParams, { status: "low" })}#inventory-products`;
  const composeHref = `${buildInventoryHref(searchParams, { compose: "1" })}#product-create`;
  const closeComposeHref = buildInventoryHref(searchParams, { compose: undefined });
  const exportHref = buildInventoryReportHref(filteredProducts, salesByProduct);

  const revenueTrend = completedOrders
    .slice(0, 8)
    .reverse()
    .map((order) => Number(order.subtotalAmount ?? 0));
  const stockTrend = activeProducts
    .slice(0, 8)
    .map((product) => Number(product.currentStock ?? 0));
  const lowStockTrend = (lowStockProducts.length ? lowStockProducts : inventoryProducts)
    .slice(0, 8)
    .map((product) =>
      Math.max(Number(product.minimumStock ?? 0) - Number(product.currentStock ?? 0), 0),
    );
  const ticketTrend = completedOrders
    .slice(0, 8)
    .reverse()
    .map((order) => Number(order.subtotalAmount ?? 0));
  const profitTrend = completedOrders
    .slice(0, 8)
    .reverse()
    .map((order) =>
      order.items.reduce((sum, item) => {
        const product =
          (item.productId ? productMapById.get(item.productId) : null) ??
          productMapByName.get(normalizeSearch(item.productNameSnapshot)) ??
          null;
        return sum + Number(item.lineTotalAmount ?? 0) - Number(product?.costPrice ?? 0) * Number(item.quantity ?? 0);
      }, 0),
    );

  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroTopRow}>
          <div />
          <div className={styles.headerTools}>
            <form method="get" className={styles.searchBar}>
              <input type="hidden" name="brand" value={brandFilter} />
              <input type="hidden" name="category" value={categoryFilter} />
              <input type="hidden" name="sort" value={sort} />
              <input type="hidden" name="status" value={statusFilter} />
              {composeOpen ? <input type="hidden" name="compose" value="1" /> : null}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Buscar produto, categoria, marca..."
              />
            </form>
          </div>
        </div>

        <div className={styles.headerRow}>
          <div className={styles.heroIntro}>
            <p className={styles.eyebrow}>Loja</p>
            <h1>Loja do salao</h1>
            <p className={styles.lead}>
              Produtos, estoque, pedidos e vitrine do app em um lugar so.
            </p>
          </div>

          <div className={styles.headerActions}>
            <a
              href={exportHref}
              download="relatorio-loja.csv"
              className={styles.secondaryButton}
            >
              Baixar CSV
            </a>
            <a href={composeHref} className={styles.primaryButton}>
              Novo produto
            </a>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <InventoryMetricCard
            accent="#5b4bce"
            kicker="R$"
            label="Receita da loja"
            value={formatMetricCurrency(data.header.storeRevenue)}
            meta={periodLabel}
            trendValues={revenueTrend}
          />
          <InventoryMetricCard
            accent="#7b54f5"
            kicker="P"
            label="Produtos ativos"
            value={activeProducts.length}
            meta={`${inventoryProducts.length} cadastrados`}
            trendValues={stockTrend}
          />
          <InventoryMetricCard
            accent="#ef7f1a"
            kicker="!"
            label="Estoque baixo"
            value={lowStockProducts.length}
            meta="Produtos em alerta"
            trendValues={lowStockTrend}
          />
          <article className={`${styles.metricCard} ${styles.metricCardFeature}`}>
            <div className={styles.metricHeader}>
              <div>
                <span className={styles.metricLabel}>Mais vendido</span>
                <strong className={styles.metricFeatureValue}>
                  {featuredProduct?.product.name ?? "Aguardando giro real"}
                </strong>
                <p className={styles.metricFeatureCount}>
                  {featuredProduct
                    ? formatStock(
                        featuredProduct.stats.units,
                        featuredProduct.product.unit,
                      )
                    : "Sem giro no periodo"}
                </p>
              </div>
              <span
                className={styles.metricDot}
                data-kicker="Top"
                style={{ "--metric-accent": "#5b4bce" } as CSSProperties}
              >
                top
              </span>
            </div>
            <small className={styles.metricMeta}>
              {featuredProduct?.stats
                ? `${featuredProduct.stats.orders} pedido(s) concluídos no mês`
                : "Aparece quando a loja conclui vendas no periodo"}
            </small>
            {featuredProduct?.product.imageUrls[0] ? (
              <div className={styles.metricThumb}>
                <Image
                  src={featuredProduct.product.imageUrls[0]}
                  alt={featuredProduct.product.name}
                  fill
                  sizes="72px"
                />
              </div>
            ) : null}
          </article>
          <InventoryMetricCard
            accent="#7b54f5"
            kicker="%"
            label="Ticket médio"
            value={completedOrders.length ? formatMetricCurrency(averageTicket) : "Sem base"}
            meta={
              completedOrders.length
                ? `${completedOrders.length} pedido(s) concluídos no mês`
                : "Sem base no periodo"
            }
            trendValues={ticketTrend}
          />
          <InventoryMetricCard
            accent="#ef7f1a"
            kicker="+"
            label="Lucro estimado"
            value={estimatedProfit > 0 ? formatMetricCurrency(estimatedProfit) : "Sem base"}
            meta="Margem calculada com custo real do periodo"
            trendValues={profitTrend}
          />
        </div>
      </section>

      <section className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <article className={styles.catalogPanel}>
            <div className={styles.panelHeader}>
              <div>
                <h2>Produtos</h2>
              </div>
            </div>

            <div className={styles.categoryTabs}>
              {categoryOptions.map((category) => (
                <a
                  key={category}
                  href={buildInventoryHref(searchParams, { category })}
                  className={
                    category === categoryFilter ? styles.tabActive : styles.tabLink
                  }
                >
                  {category}
                </a>
              ))}
            </div>

            <form method="get" className={styles.filterRow}>
              {composeOpen ? <input type="hidden" name="compose" value="1" /> : null}
              <input type="hidden" name="category" value={categoryFilter} />
              <label className={styles.filterSearch}>
                <input
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Buscar produto..."
                />
              </label>
              <select name="brand" defaultValue={brandFilter} className={styles.filterSelect}>
                <option value="">Marca</option>
                {brandOptions.map((brand) => (
                  <option key={brand} value={brand}>
                    {brand}
                  </option>
                ))}
              </select>
              <select name="status" defaultValue={statusFilter} className={styles.filterSelect}>
                <option value="all">Status</option>
                <option value="active">Ativos</option>
                <option value="low">Estoque baixo</option>
                <option value="out">Sem saldo</option>
                <option value="paused">Pausados</option>
              </select>
              <select name="sort" defaultValue={sort} className={styles.filterSelect}>
                <option value="recent">Ordenar: Mais recentes</option>
                <option value="sales">Mais vendidos</option>
                <option value="price-high">Preco maior</option>
                <option value="price-low">Preco menor</option>
                <option value="stock-high">Maior estoque</option>
                <option value="name">Nome</option>
              </select>
              <button type="submit" className={styles.iconButton}>
                Filtrar
              </button>
            </form>

            {!filteredProducts.length ? (
              <EmptyStateCard
                eyebrow="Sem resultado"
                title="Nenhum produto neste filtro"
                description="Ajuste busca, categoria ou status para voltar ao catálogo."
              />
            ) : (
              <div
                className={`${styles.productGrid}${
                  filteredProducts.length <= 2 ? ` ${styles.productGridSparse}` : ""
                }`}
              >
                {filteredProducts.map((product) => {
                  const stats = salesByProduct.get(product.id) ?? null;
                  const category = inventoryCategoryLabel(product);
                  const unitsSold = stats?.units ?? 0;
                  const stock = Math.max(Number(product.currentStock ?? 0), 0);
                  const minimum = Math.max(Number(product.minimumStock ?? 0), 0);
                  const stockTarget = Math.max(stock, minimum * 2, 1);
                  const stockPercent = Math.min((stock / stockTarget) * 100, 100);
                  const isBestSeller =
                    featuredProduct?.product.id === product.id && unitsSold > 0;
                  const isNew =
                    Date.now() - new Date(product.updatedAt).getTime() <
                    1000 * 60 * 60 * 24 * 21;

                  return (
                    <article key={product.id} className={styles.productCard}>
                      <div className={styles.productVisual}>
                        <ProductImage alt={product.name} src={product.imageUrls[0] ?? null} />
                        <div className={styles.productBadgesOverlay}>
                          {isBestSeller ? (
                            <span className={`${styles.badge} ${styles.badgeWarm}`}>
                              Mais vendido
                            </span>
                          ) : null}
                          {!isBestSeller && isNew ? (
                            <span className={`${styles.badge} ${styles.badgeSuccess}`}>
                              Novo
                            </span>
                          ) : null}
                        </div>
                      </div>

                      <div className={styles.productBody}>
                        <div className={styles.productBadges}>
                          {product.isLowStock ? (
                            <span className={`${styles.badge} ${styles.badgeMuted}`}>
                              Estoque baixo
                            </span>
                          ) : null}
                        </div>

                        <h3>{product.name}</h3>
                        <p className={styles.productMeta}>
                          {category} - {product.brand ?? "Linha propria"}
                        </p>
                        <div className={styles.productPrice}>{formatMoneyValue(product.retailPrice)}</div>
                        <p className={styles.productSubmeta}>
                          {unitsSold
                            ? `${unitsSold} vendidos`
                            : "Sem vendas concluidas ainda"}
                        </p>

                        <div className={styles.stockBlock}>
                          <div className={styles.stockRow}>
                            <span>Estoque</span>
                            <span>{formatStock(product.currentStock, product.unit)}</span>
                          </div>
                          <div className={styles.stockTrack}>
                            <span
                              className={`${styles.stockFill} ${
                                product.isLowStock ? styles.stockFillLow : styles.stockFillGood
                              }`}
                              style={{ width: `${stockPercent}%` }}
                            />
                          </div>
                          <div className={styles.stockRow}>
                            <small>{productStatusLabel(product)}</small>
                            <small>Min {formatStock(product.minimumStock, product.unit)}</small>
                          </div>
                        </div>

                        <div className={styles.productActions}>
                          <details className={styles.disclosure}>
                            <summary>Editar</summary>
                            <form
                              action={saveInventoryProductAction}
                              className={`simple-form ${styles.inlineForm}`}
                              encType="multipart/form-data"
                            >
                              <input type="hidden" name="returnPath" value={productsSectionHref} />
                              <input type="hidden" name="productId" value={product.id} />
                              <div className="split-grid">
                                <input name="name" defaultValue={product.name} required />
                                <input
                                  name="brand"
                                  defaultValue={product.brand ?? ""}
                                  placeholder="Marca"
                                />
                              </div>
                              <div className="split-grid">
                                <input
                                  name="sku"
                                  defaultValue={product.sku ?? ""}
                                  placeholder="SKU interno"
                                />
                                <input
                                  name="unit"
                                  defaultValue={product.unit}
                                  placeholder="Unidade"
                                  required
                                />
                              </div>
                              <textarea
                                name="description"
                                rows={3}
                                defaultValue={product.description ?? ""}
                                placeholder="Descrição para a vitrine"
                              />
                              <div className="split-grid">
                                <input
                                  name="currentStock"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={Number(product.currentStock ?? 0)}
                                  required
                                />
                                <input
                                  name="minimumStock"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={Number(product.minimumStock ?? 0)}
                                  required
                                />
                                <input
                                  name="maxPurchaseQuantity"
                                  type="number"
                                  min="1"
                                  max="99"
                                  step="1"
                                  defaultValue={product.maxPurchaseQuantity}
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
                                  placeholder="Preco de venda"
                                />
                              </div>
                              <div className="field">
                                <label>Fotos</label>
                                <CuratedImageUploadField
                                  id={`inventory-product-images-${product.id}`}
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
                                Produto visivel no app
                              </label>
                              <button type="submit" className="primary-button">
                                Salvar produto
                              </button>
                            </form>
                          </details>

                          <details className={styles.disclosure}>
                            <summary>Ajustar</summary>
                            <form
                              action={registerInventoryMovementAction}
                              className={`simple-form ${styles.inlineForm}`}
                            >
                              <input type="hidden" name="returnPath" value={movementsSectionHref} />
                              <input type="hidden" name="productId" value={product.id} />
                              <div className="split-grid">
                                <select name="movementType" defaultValue="out">
                                  <option value="out">Saida</option>
                                  <option value="in">Entrada</option>
                                  <option value="adjustment">Ajuste</option>
                                </select>
                                <input
                                  name="quantity"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue="1"
                                  required
                                />
                              </div>
                              <div className="split-grid">
                                <input
                                  name="reason"
                                  placeholder="Motivo do movimento"
                                />
                                <select name="staffMemberId" defaultValue="">
                                  <option value="">Sem vínculo</option>
                                  {data.staffOptions.map((staffMember) => (
                                    <option key={staffMember.id} value={staffMember.id}>
                                      {staffMember.name}
                                    </option>
                                  ))}
                                </select>
                              </div>
                              <button type="submit" className="secondary-button">
                                Salvar movimento
                              </button>
                            </form>
                          </details>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <div className={styles.catalogFooter}>
              <a
                href={`${buildInventoryHref(searchParams, { q: undefined, sort: "name" })}#inventory-products`}
                className={styles.inlineLink}
              >
                Ver mais produtos
              </a>
            </div>
          </article>

          <article className={styles.rotationPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sidebarEyebrow}>Giro de estoque</span>
                  <h2>Produtos que mais saem</h2>
                </div>
              </div>

            <div className={styles.rotationGrid}>
              <div className={styles.rotationCard}>
                <strong>Mais giro</strong>
                {bestSellers.length ? (
                  <ul className={styles.rankList}>
                    {bestSellers.map((item, index) => (
                      <li key={item.product.id}>
                        <span className={styles.rankIndex}>{index + 1}</span>
                        <div>
                          <strong>{item.product.name}</strong>
                          <small>{item.stats.units} unidades</small>
                        </div>
                        <span className={styles.rankDelta}>{formatCurrency(item.stats.revenue)}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyCopy}>A loja ainda não concluiu vendas suficientes para este ranking.</p>
                )}
              </div>

              <div className={styles.rotationCard}>
                <strong>Parados ha mais tempo</strong>
                {slowMovers.length ? (
                  <ul className={styles.rankList}>
                    {slowMovers.map((item, index) => (
                      <li key={item.product.id}>
                        <span className={styles.rankIndex}>{index + 1}</span>
                        <div>
                          <strong>{item.product.name}</strong>
                          <small>
                            {item.stats.units
                              ? `${item.stats.units} venda(s)`
                              : `Atualizado em ${formatDateTime(item.product.updatedAt)}`}
                          </small>
                        </div>
                        <span className={styles.rankMuted}>
                          {formatStock(item.product.currentStock, item.product.unit)}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.emptyCopy}>Ainda não há produtos suficientes para comparar giro.</p>
                )}
              </div>
            </div>
          </article>

          {composeOpen ? (
            <article id="product-create" className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sidebarEyebrow}>Cadastro</span>
                  <h2>Novo produto</h2>
                </div>
                <a href={closeComposeHref} className={styles.inlineLink}>
                  Fechar
                </a>
              </div>

              <form
                action={saveInventoryProductAction}
                className={`simple-form ${styles.createForm}`}
                encType="multipart/form-data"
              >
                <input type="hidden" name="returnPath" value={productsSectionHref} />

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
                    <input id="inventory-sku" name="sku" placeholder="Ex.: WEL-001" />
                  </div>
                </div>

                <div className="field">
                  <label htmlFor="inventory-description">Descrição</label>
                  <textarea
                    id="inventory-description"
                    name="description"
                    rows={3}
                    placeholder="Resumo curto para a cliente e para a equipe."
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
                    <label htmlFor="inventory-minimum-stock">Estoque minimo</label>
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
                    <label htmlFor="inventory-retail-price">Preco de venda</label>
                    <input
                      id="inventory-retail-price"
                      name="retailPrice"
                      type="number"
                      min="0"
                      step="0.01"
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="inventory-max-purchase-quantity">Limite por pedido</label>
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
                </div>

                <label className="checkbox-field">
                  <input type="checkbox" name="isActive" defaultChecked />
                  Produto visivel na loja
                </label>

                <button type="submit" className="primary-button">
                  Salvar produto
                </button>
              </form>
            </article>
          ) : null}

          <div className={styles.operationsGrid}>
            <article id="inventory-orders" className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sidebarEyebrow}>Pedidos</span>
                  <h2>Pedidos da loja</h2>
                </div>
              </div>

              {!latestOrders.length ? (
                <EmptyStateCard
                  eyebrow="Sem pedidos"
                  title="Nada entrou na loja ainda"
                  description="Os pedidos do app do cliente aparecem aqui para confirmação, preparo e entrega."
                />
              ) : (
                <div className={styles.orderList}>
                  {latestOrders.map((order) => (
                    <article key={order.id} className={styles.orderCard}>
                      <div className={styles.orderHeader}>
                        <div>
                          <span className={`${styles.badge} ${resolveStoreOrderBadgeClass(order.status)}`}>
                            {formatStoreOrderStatusLabel(order.status)}
                          </span>
                          <h3>{order.customerName}</h3>
                          <p>
                            Pedido #{order.orderNumber} - {formatDateTime(order.orderMoment)}
                          </p>
                        </div>
                        <strong>{formatCurrency(Number(order.subtotalAmount ?? 0))}</strong>
                      </div>

                      <p className={styles.orderItems}>
                        {order.items.length
                          ? order.items
                              .map(
                                (item) =>
                                  `${item.productNameSnapshot} (${item.quantity} ${item.unitSnapshot})`,
                              )
                              .join(" - ")
                          : "Pedido sem itens visiveis."}
                      </p>

                      <div className={styles.orderActions}>
                        {order.status === "pending" ? (
                          <form action={updateCustomerProductOrderStatusAction}>
                            <input type="hidden" name="returnPath" value={ordersSectionHref} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="status" value="confirmed" />
                            <button type="submit" className="primary-button">
                              Confirmar
                            </button>
                          </form>
                        ) : null}

                        {(order.status === "pending" || order.status === "confirmed") ? (
                          <form action={updateCustomerProductOrderStatusAction}>
                            <input type="hidden" name="returnPath" value={ordersSectionHref} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="status" value="ready" />
                            <button type="submit" className="secondary-button">
                              Marcar pronto
                            </button>
                          </form>
                        ) : null}

                        {order.status === "ready" ? (
                          <form action={updateCustomerProductOrderStatusAction}>
                            <input type="hidden" name="returnPath" value={ordersSectionHref} />
                            <input type="hidden" name="orderId" value={order.id} />
                            <input type="hidden" name="status" value="completed" />
                            <button type="submit" className="primary-button">
                              Concluir
                            </button>
                          </form>
                        ) : null}

                        {order.status !== "completed" && order.status !== "cancelled" ? (
                          <details className={styles.disclosure}>
                            <summary>Cancelar</summary>
                            <form
                              action={updateCustomerProductOrderStatusAction}
                              className={`simple-form ${styles.inlineForm}`}
                            >
                              <input type="hidden" name="returnPath" value={ordersSectionHref} />
                              <input type="hidden" name="orderId" value={order.id} />
                              <input type="hidden" name="status" value="cancelled" />
                              <input
                                name="cancellationReason"
                                placeholder="Motivo do cancelamento"
                                required
                              />
                              <button type="submit" className="secondary-button">
                                Confirmar cancelamento
                              </button>
                            </form>
                          </details>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <article id="inventory-movements" className={styles.formPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sidebarEyebrow}>Movimentos</span>
                  <h2>Movimentos recentes</h2>
                </div>
              </div>

              {!latestMovements.length ? (
                <EmptyStateCard
                  eyebrow="Sem histórico"
                  title="Ainda não houve ajuste recente"
                  description="Entradas, saidas e correcoes do estoque aparecem aqui."
                />
              ) : (
                <div className={styles.movementList}>
                  {latestMovements.map((movement) => (
                    <article key={movement.id} className={styles.movementRow}>
                      <div>
                        <strong>{movement.productName}</strong>
                        <p>
                          {movement.staffName
                            ? `Lancado por ${movement.staffName}`
                            : "Sem profissional vinculado"}
                        </p>
                        {movement.reason ? <p>{movement.reason}</p> : null}
                      </div>
                      <div className={styles.movementMeta}>
                        <span>{formatDateTime(movement.createdAt)}</span>
                        <strong>
                          {movement.movementType === "out" ? "-" : "+"}
                          {formatStock(movement.quantity)}
                        </strong>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>
          </div>
        </div>

        <aside className={styles.sidebarColumn}>
          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <h3>Alertas de estoque</h3>
              </div>
              <a href={lowStockHref} className={styles.inlineLink}>
                Ver todos
              </a>
            </div>

            {lowStockProducts.length ? (
              <div className={styles.alertList}>
                {lowStockProducts.slice(0, 4).map((product) => (
                  <article key={product.id} className={styles.alertRow}>
                    <span className={styles.alertDot}>•</span>
                    <div>
                      <strong>{product.name}</strong>
                      <p>{formatStock(product.currentStock, product.unit)} restantes</p>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className={styles.emptyCopy}>Nenhum alerta de reposicao agora.</p>
            )}
          </article>

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <h3>Venda por categoria</h3>
              </div>
              <span className={styles.sidebarPill}>{periodLabel}</span>
            </div>

            {categoryPerformanceRows.length ? (
              <div className={styles.performanceList}>
                {categoryPerformanceRows.map((row) => {
                  const share = totalCategoryRevenue
                    ? (row.revenue / totalCategoryRevenue) * 100
                    : 0;
                  const width = (row.revenue / topCategoryRevenue) * 100;
                  return (
                    <article key={row.label} className={styles.performanceRow}>
                      <div>
                        <strong>{row.label}</strong>
                        <small>{formatCurrency(row.revenue)}</small>
                      </div>
                      <div className={styles.performanceBar}>
                        <span style={{ width: `${width}%` }} />
                      </div>
                      <span>{share.toFixed(0)}%</span>
                    </article>
                  );
                })}
              </div>
            ) : (
              <p className={styles.emptyCopy}>O desempenho por grupo aparece quando a loja concluir vendas.</p>
            )}
          </article>

          <VisibleStorefrontCard visibleProducts={visibleProducts} />

          <article className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <h3>Ir direto</h3>
              </div>
            </div>
            <div className={styles.shortcutGrid}>
              <a href={composeHref} className={styles.shortcutCard}>
                <strong>Novo produto</strong>
                <span>Cadastro</span>
              </a>
              <a href={lowStockHref} className={styles.shortcutCard}>
                <strong>Ajustar estoque</strong>
                <span>Produtos em alerta</span>
              </a>
              <a href={ordersSectionHref} className={styles.shortcutCard}>
                <strong>Pedidos</strong>
                <span>Fila da loja</span>
              </a>
              <a href="/dashboard/client-app" className={styles.shortcutCard}>
                <strong>Vitrine app</strong>
                <span>Preview</span>
              </a>
            </div>
          </article>
        </aside>
      </section>
    </div>
  );
}
