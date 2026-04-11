import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import {
  createManagementCategoryAction,
  deleteManagementCategoryAction,
  updateManagementCategoryAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import {
  buildFilterHref,
  loadManagementCategories,
} from "@/lib/management";

type CategoriasPageProps = {
  searchParams?: {
    message?: string;
    tone?: string;
  };
};

export default async function CategoriasPage({
  searchParams,
}: CategoriasPageProps) {
  const { salon } = await requireOwnerSalon();
  const currentPath = buildFilterHref(
    "/dashboard/gestao/categorias",
    searchParams,
    {},
  );
  const categories = await loadManagementCategories(salon.id);
  const activeCategories = categories.filter((category) => category.is_active);
  const inactiveCategories = categories.filter((category) => !category.is_active);
  const emptyCategories = categories.filter((category) => category.servicesCount === 0);
  const totalServices = categories.reduce((total, item) => total + item.servicesCount, 0);
  const totalActiveServices = categories.reduce(
    (total, item) => total + item.activeServicesCount,
    0,
  );
  const topCategory =
    [...categories].sort((left, right) => {
      if (right.servicesCount !== left.servicesCount) {
        return right.servicesCount - left.servicesCount;
      }

      return right.activeServicesCount - left.activeServicesCount;
    })[0] ?? null;

  return (
    <div className="page-grid workspace-page management-page management-page--categories">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        id="categories-overview"
        eyebrow="Categorias"
        title="Categorias organizadas para vender melhor."
        description="Visão rápida da estrutura do catálogo, cobertura de serviços e pontos que pedem ajuste."
        highlight={{
          label: "Cobertura do catálogo",
          value: `${categories.length} categoria${categories.length === 1 ? "" : "s"}`,
          note: categories.length
            ? `${totalServices} serviço(s) distribuído(s) e ${totalActiveServices} ativo(s) no catálogo.`
            : "Cadastre a primeira categoria para organizar o catálogo do salão.",
        }}
        signals={[
          {
            label: "Ativas",
            value: activeCategories.length,
            tone: activeCategories.length ? "success" : "soft",
          },
          {
            label: "Inativas",
            value: inactiveCategories.length,
            tone: inactiveCategories.length ? "warm" : "success",
          },
          {
            label: "Sem serviços",
            value: emptyCategories.length,
            tone: emptyCategories.length ? "accent" : "soft",
          },
        ]}
        stats={[
          {
            label: "Serviços no catálogo",
            value: totalServices,
            note: "Soma da distribuição atual.",
            tone: totalServices ? "accent" : "soft",
          },
          {
            label: "Serviços ativos",
            value: totalActiveServices,
            note: "Prontos para a agenda.",
            tone: totalActiveServices ? "success" : "soft",
          },
          {
            label: "Cobertura vazia",
            value: emptyCategories.length,
            note: "Categorias sem item vinculado.",
            tone: emptyCategories.length ? "warm" : "soft",
          },
          {
            label: "Categoria forte",
            value: topCategory?.name ?? "Sem destaque",
            note: topCategory
              ? `${topCategory.servicesCount} serviço(s) e ${topCategory.activeServicesCount} ativo(s).`
              : "O destaque aparece quando o catálogo ganhar estrutura.",
            tone: topCategory ? "soft" : "neutral",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#category-create" className="primary-button">
              Nova categoria
            </a>
            <a href="#category-list" className="secondary-button">
              Ver catálogo
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Categoria em foco</span>
            <h3>{topCategory?.name ?? "Estruture o primeiro grupo"}</h3>
            <p>
              {topCategory
                ? `${topCategory.servicesCount} serviço(s) no grupo e ${topCategory.activeServicesCount} ativo(s) sustentando o catálogo.`
                : "Assim que o catálogo ganhar categorias, o grupo com maior cobertura aparece aqui."}
            </p>
            <div className="management-hero-pill-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Ativas</span>
                <strong>{activeCategories.length}</strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Sem item</span>
                <strong>{emptyCategories.length}</strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos das categorias"
        items={[
          { href: "#category-create", label: "Nova categoria", meta: "Organizar o catálogo" },
          { href: "#category-summary", label: "Resumo", meta: "Cobertura e estrutura" },
          { href: "#category-list", label: "Categorias", meta: "Editar e limpar" },
        ]}
      />

      <section
        id="category-summary"
        className="workspace-subgrid management-summary-grid"
        aria-label="Resumo das categorias"
      >
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Catálogo vivo</span>
          <h3>{activeCategories.length} categoria(s) ativa(s)</h3>
          <p>
            {inactiveCategories.length
              ? `${inactiveCategories.length} grupo(s) está(ão) pausado(s) e merece(m) revisão.`
              : "Todas as categorias atuais estão ativas e prontas para operação."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Cobertura vazia</span>
          <h3>{emptyCategories.length} categoria(s) sem serviço</h3>
          <p>
            {emptyCategories.length
              ? "Preencha esses grupos para não deixar o catálogo com áreas ocas."
              : "Nenhuma categoria está vazia no momento."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Grupo forte</span>
          <h3>{topCategory?.name ?? "Sem destaque"}</h3>
          <p>
            {topCategory
              ? `${topCategory.servicesCount} item(ns) posicionados nessa frente do catálogo.`
              : "O grupo mais forte aparece quando o catálogo ganhar corpo."}
          </p>
        </article>
      </section>

      <section className="management-grid management-grid--two">
        <article id="category-create" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Nova categoria</h2>
              <p className="muted">Organize o catálogo por área de atendimento.</p>
            </div>
          </div>

          <form action={createManagementCategoryAction} className="simple-form">
            <input type="hidden" name="returnPath" value={currentPath} />

            <div className="field">
              <label htmlFor="category-name">Nome</label>
              <input
                id="category-name"
                name="name"
                placeholder="Ex.: Cabelo"
                required
              />
            </div>

            <div className="field">
              <label htmlFor="category-description">Descrição</label>
              <textarea
                id="category-description"
                name="description"
                rows={3}
                placeholder="Texto curto para identificar a categoria."
              />
            </div>

            <label className="checkbox-field">
              <input type="checkbox" name="isActive" defaultChecked />
              <span>Categoria ativa</span>
            </label>

            <button type="submit" className="primary-button">
              Salvar categoria
            </button>
          </form>
        </article>

        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Resumo do catálogo</h2>
              <p className="muted">Quantidade de grupos ativos e cobertura dos serviços.</p>
            </div>
          </div>

          <div className="management-list">
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{categories.length}</strong>
                <span>categoria(s) cadastrada(s)</span>
              </div>
            </div>
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{categories.filter((item) => item.is_active).length}</strong>
                <span>categoria(s) ativa(s)</span>
              </div>
            </div>
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>
                  {categories.reduce((total, item) => total + item.servicesCount, 0)}
                </strong>
                <span>serviço(s) distribuídos nas categorias</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section id="category-list" className="card content-card management-card">
        <div className="section-heading">
          <div>
            <h2>Categorias cadastradas</h2>
            <p className="muted">
              {categories.length
                ? `${categories.length} categoria(s) no catálogo`
                : "Nenhuma categoria cadastrada"}
            </p>
          </div>
        </div>

        {!categories.length ? (
          <EmptyStateCard
            eyebrow="Sem categorias"
            title="Cadastre a primeira categoria"
            description="Ela ajuda a manter o catálogo visível e fácil de filtrar."
          />
        ) : (
          <div className="management-category-list">
            {categories.map((category) => (
              <article key={category.id} className="management-category-card">
                <div className="management-category-card__header">
                  <div>
                    <strong>{category.name}</strong>
                    <p className="muted">
                      {category.description || "Sem descrição adicional"}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      category.is_active ? "badge--confirmed" : "badge--cancelled"
                    }`}
                  >
                    {category.is_active ? "Ativa" : "Inativa"}
                  </span>
                </div>

                <div className="management-category-card__meta">
                  <span>{category.servicesCount} serviço(s)</span>
                  <span>{category.activeServicesCount} ativo(s)</span>
                </div>

                <details className="management-details">
                  <summary>Editar categoria</summary>

                  <form action={updateManagementCategoryAction} className="simple-form">
                    <input type="hidden" name="returnPath" value={currentPath} />
                    <input type="hidden" name="categoryId" value={category.id} />

                    <div className="field">
                      <label>Nome</label>
                      <input name="name" defaultValue={category.name} required />
                    </div>

                    <div className="field">
                      <label>Descrição</label>
                      <textarea
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

                    <div className="inline-actions">
                      <button type="submit" className="primary-button">
                        Salvar alterações
                      </button>
                    </div>
                  </form>

                  <form action={deleteManagementCategoryAction}>
                    <input type="hidden" name="returnPath" value={currentPath} />
                    <input type="hidden" name="categoryId" value={category.id} />
                    <button type="submit" className="danger-button">
                      Excluir categoria
                    </button>
                  </form>
                </details>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
