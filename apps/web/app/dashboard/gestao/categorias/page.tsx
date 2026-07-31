import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import {
  createManagementCategoryAction,
  deleteManagementCategoryAction,
  updateManagementCategoryAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import { buildFilterHref, loadManagementCategories } from "@/lib/management";

import styles from "./page.module.css";

type CategoriasPageSearchParams = {
  compose?: string;
  message?: string;
  q?: string;
  status?: string;
  tone?: string;
};

type CategoriasPageProps = {
  searchParams?: Promise<CategoriasPageSearchParams>;
};

function normalizeValue(value?: string | null) {
  return value?.trim() ?? "";
}

function normalizeSearch(value?: string | null) {
  return normalizeValue(value).toLocaleLowerCase("pt-BR");
}

function matchesQuery(query: string, values: Array<string | null | undefined>) {
  if (!query) {
    return true;
  }

  return values.some((value) => normalizeSearch(value).includes(query));
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function CategoriasPage({
  searchParams: searchParamsPromise,
}: CategoriasPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);

  const categories = await loadManagementCategories(salon.id);
  const query = normalizeSearch(searchParams?.q);
  const statusFilter = normalizeValue(searchParams?.status) || "all";
  const composeOpen = searchParams?.compose === "1";
  const currentPath = buildFilterHref("/dashboard/gestao/categorias", searchParams, {
    message: undefined,
    tone: undefined,
  });
  const composeHref = buildFilterHref("/dashboard/gestao/categorias", searchParams, {
    compose: "1",
  });
  const closeComposeHref = buildFilterHref("/dashboard/gestao/categorias", searchParams, {
    compose: undefined,
  });
  const clearFiltersHref = buildFilterHref("/dashboard/gestao/categorias", searchParams, {
    q: undefined,
    status: undefined,
  });
  const categoryBase = [...categories].sort((left, right) => {
    if (right.servicesCount !== left.servicesCount) {
      return right.servicesCount - left.servicesCount;
    }

    return right.activeServicesCount - left.activeServicesCount;
  });
  const activeCategories = categories.filter((category) => category.is_active);
  const inactiveCategories = categories.filter((category) => !category.is_active);
  const emptyCategories = categories.filter((category) => category.servicesCount === 0);
  const totalServices = categories.reduce((sum, category) => sum + category.servicesCount, 0);
  const totalActiveServices = categories.reduce(
    (sum, category) => sum + category.activeServicesCount,
    0,
  );
  const topCategory = categoryBase[0] ?? null;

  const filteredCategories = categoryBase.filter((category) => {
    if (
      !matchesQuery(query, [category.name, category.description]) ||
      (statusFilter === "active" && !category.is_active) ||
      (statusFilter === "inactive" && category.is_active) ||
      (statusFilter === "empty" && category.servicesCount > 0)
    ) {
      return false;
    }

    return true;
  });

  const categoryCards = [
    {
      accent: "#5b4bce",
      label: "Categorias ativas",
      meta: "Prontas para o catálogo",
      value: activeCategories.length,
    },
    {
      accent: "#7b54f5",
      label: "Serviços vinculados",
      meta: `${totalActiveServices} ativos agora`,
      value: totalServices,
    },
    {
      accent: "#ef7f1a",
      label: "Sem cobertura",
      meta: "Grupos aguardando serviços",
      value: emptyCategories.length,
    },
    {
      accent: "#5b4bce",
      label: "Grupo forte",
      meta: topCategory
        ? `${topCategory.activeServicesCount} ativos`
        : "Aparece quando houver volume",
      value: topCategory?.name ?? "Sem destaque",
    },
  ];

  return (
    <AsyncActionNoticeRegion
      initialMessage={searchParams?.message}
      initialTone={searchParams?.tone}
    >
      <div className={`page-grid ${styles.page}`}>
        <section className={styles.hero}>
          <div className={styles.headerRow}>
            <div>
              <p className={styles.eyebrow}>Catálogo</p>
              <h1>Categorias do catálogo</h1>
              <p className={styles.lead}>
                Organize o catálogo, veja onde os serviços estão mais fortes e
                ajuste os grupos que ainda estão vazios.
              </p>
            </div>

            <div className={styles.headerTools}>
              <form method="get" className={styles.searchBar}>
                {composeOpen ? <input type="hidden" name="compose" value="1" /> : null}
                <input
                  type="search"
                  name="q"
                  defaultValue={normalizeValue(searchParams?.q)}
                  placeholder="Buscar categoria ou descrição..."
                />
              </form>

              <div className={styles.headerActions}>
                <a href="#category-board" className={styles.secondaryButton}>
                  Ver catálogo
                </a>
                <a href={composeHref} className={styles.primaryButton}>
                  Nova categoria
                </a>
              </div>
            </div>
          </div>

          <div className={styles.metricGrid}>
            {categoryCards.map((card) => (
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
            <article id="category-board" className={styles.catalogPanel}>
              <div className={styles.panelHeader}>
                <div>
                  <p className={styles.sidebarEyebrow}>Categorias</p>
                  <h2>Categorias cadastradas</h2>
                </div>
                <div className={styles.badgeRow}>
                  <span className={styles.countPill}>
                    Busca: {query ? normalizeValue(searchParams?.q) : "toda a base"}
                  </span>
                  <span className={styles.countPill}>
                    Ativas: {activeCategories.length}
                  </span>
                </div>
              </div>

              <form method="get" className={styles.filterRow}>
                {composeOpen ? <input type="hidden" name="compose" value="1" /> : null}
                <label className={styles.filterSearch}>
                  <input
                    type="search"
                    name="q"
                    defaultValue={normalizeValue(searchParams?.q)}
                    placeholder="Buscar categoria..."
                  />
                </label>
                <select
                  name="status"
                  defaultValue={statusFilter}
                  className={styles.filterSelect}
                >
                  <option value="all">Todas</option>
                  <option value="active">Ativas</option>
                  <option value="inactive">Inativas</option>
                  <option value="empty">Sem serviços</option>
                </select>
                <button type="submit" className={styles.iconButton}>
                  Filtrar
                </button>
                {(query || statusFilter !== "all") ? (
                  <a href={clearFiltersHref} className={styles.secondaryButton}>
                    Limpar
                  </a>
                ) : null}
              </form>

              {!filteredCategories.length ? (
                <EmptyStateCard
                  eyebrow="Sem resultado"
                  title="Nenhuma categoria nesse recorte"
                  description="Ajuste a busca ou o status para voltar a ver o catálogo."
                />
              ) : (
                <div className={styles.categoryGrid}>
                  {filteredCategories.map((category) => {
                    const categoryShare =
                      totalServices > 0
                        ? Math.max(
                            8,
                            Math.round((category.servicesCount / totalServices) * 100),
                          )
                        : 0;

                    return (
                      <article key={category.id} className={styles.categoryCard}>
                        <div className={styles.categoryHeader}>
                          <div>
                            <h3>{category.name}</h3>
                            <p className={styles.categoryCopy}>
                              {category.description || "Sem descrição adicional."}
                            </p>
                          </div>
                          <span
                            className={
                              category.is_active
                                ? `${styles.badge} ${styles.badgeSuccess}`
                                : `${styles.badge} ${styles.badgeMuted}`
                            }
                          >
                            {category.is_active ? "Ativa" : "Inativa"}
                          </span>
                        </div>

                        <div className={styles.categoryMeta}>
                          <div>
                            <span>Serviços</span>
                            <strong>{category.servicesCount}</strong>
                          </div>
                          <div>
                            <span>Ativos</span>
                            <strong>{category.activeServicesCount}</strong>
                          </div>
                          <div>
                            <span>Cobertura</span>
                            <strong>{totalServices ? `${categoryShare}%` : "0%"}</strong>
                          </div>
                        </div>

                        <div className={styles.progressTrack}>
                          <span style={{ width: `${categoryShare}%` }} />
                        </div>

                        <details className={styles.disclosure}>
                          <summary>Editar categoria</summary>
                          <div className={styles.editStack}>
                            <AsyncActionForm
                              action={updateManagementCategoryAction}
                              className={`simple-form ${styles.inlineForm}`}
                            >
                              <input type="hidden" name="returnPath" value={currentPath} />
                              <input type="hidden" name="categoryId" value={category.id} />

                              <div className="field">
                                <label htmlFor={`category-name-${category.id}`}>Nome</label>
                                <input
                                  id={`category-name-${category.id}`}
                                  name="name"
                                  defaultValue={category.name}
                                  required
                                />
                              </div>

                              <div className="field">
                                <label htmlFor={`category-description-${category.id}`}>
                                  Descrição
                                </label>
                                <textarea
                                  id={`category-description-${category.id}`}
                                  name="description"
                                  rows={3}
                                  defaultValue={category.description ?? ""}
                                />
                              </div>

                              <label className="checkbox-field">
                                <input
                                  type="checkbox"
                                  name="isActive"
                                  defaultChecked={category.is_active}
                                />
                                <span>Categoria ativa</span>
                              </label>

                              <button type="submit" className={styles.primaryButton}>
                                Salvar alterações
                              </button>
                            </AsyncActionForm>

                            <AsyncActionForm action={deleteManagementCategoryAction}>
                              <input type="hidden" name="returnPath" value={currentPath} />
                              <input type="hidden" name="categoryId" value={category.id} />
                              <button type="submit" className={styles.dangerButton}>
                                Excluir categoria
                              </button>
                            </AsyncActionForm>
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </article>

            {composeOpen ? (
              <article id="category-create" className={styles.formPanel}>
                <div className={styles.panelHeader}>
                  <div>
                    <p className={styles.sidebarEyebrow}>Nova categoria</p>
                    <h2>Criar categoria</h2>
                    <p className={styles.lead}>
                      Defina um nome claro e um resumo curto para organizar o
                      catálogo com a equipe.
                    </p>
                  </div>
                  <a href={closeComposeHref} className={styles.inlineLink}>
                    Fechar
                  </a>
                </div>

                <AsyncActionForm
                  action={createManagementCategoryAction}
                  className={`simple-form ${styles.inlineForm}`}
                  resetOnSuccess
                >
                  <input type="hidden" name="returnPath" value={currentPath} />

                  <div className="field">
                    <label htmlFor="category-name">Nome</label>
                    <input
                      id="category-name"
                      name="name"
                      placeholder="Ex.: cabelos e finalização"
                      required
                    />
                  </div>

                  <div className="field">
                    <label htmlFor="category-description">Descrição</label>
                    <textarea
                      id="category-description"
                      name="description"
                      rows={4}
                      placeholder="Texto curto para orientar a equipe e organizar o catálogo."
                    />
                  </div>

                  <label className="checkbox-field">
                    <input type="checkbox" name="isActive" defaultChecked />
                    <span>Categoria ativa</span>
                  </label>

                  <button type="submit" className={styles.primaryButton}>
                    Salvar categoria
                  </button>
                </AsyncActionForm>
              </article>
            ) : null}
          </div>

          <div className={styles.sidebarColumn}>
            <article className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.sidebarEyebrow}>Resumo do catálogo</p>
                  <h3>{topCategory?.name ?? "Catálogo em construção"}</h3>
                </div>
                <span className={styles.badgeValue}>{categories.length}</span>
              </div>
              <p>
                {topCategory
                  ? `${formatCountLabel(topCategory.servicesCount, "serviço", "serviços")} no total e ${formatCountLabel(topCategory.activeServicesCount, "ativo", "ativos")} hoje.`
                  : "Assim que o catálogo ganhar categorias, o grupo com mais peso aparece aqui."}
              </p>
              <div className={styles.sidebarMetricGrid}>
                <div className={styles.sidebarMetricCard}>
                  <span>Ativas</span>
                  <strong>{activeCategories.length}</strong>
                </div>
                <div className={styles.sidebarMetricCard}>
                  <span>Inativas</span>
                  <strong>{inactiveCategories.length}</strong>
                </div>
                <div className={styles.sidebarMetricCard}>
                  <span>Sem serviços</span>
                  <strong>{emptyCategories.length}</strong>
                </div>
              </div>
            </article>

            <article className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.sidebarEyebrow}>Alertas de estrutura</p>
                  <h3>Prioridades do catálogo</h3>
                </div>
              </div>
              {!emptyCategories.length ? (
                <p>Nenhuma categoria vazia no momento. A estrutura está consistente.</p>
              ) : (
                <div className={styles.alertList}>
                  {emptyCategories.slice(0, 4).map((category) => (
                    <div key={category.id} className={styles.alertRow}>
                      <strong>{category.name}</strong>
                      <span>Sem serviços vinculados</span>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </section>
      </div>
    </AsyncActionNoticeRegion>
  );
}
