import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import {
  createManagementServiceAction,
  deleteManagementServiceAction,
  updateManagementServiceAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import {
  buildFilterHref,
  loadManagementSelectOptions,
  loadManagementServices,
} from "@/lib/management";
import { formatCurrency } from "@/lib/formatters";

type ServicosPageProps = {
  searchParams?: {
    q?: string;
    categoryId?: string;
    status?: string;
    message?: string;
    tone?: string;
  };
};

function buildServiceCategoryChoices(args: {
  categoryId: string;
  categories: Array<{ id: string; label: string; secondary?: string | null }>;
  serviceFormCategories: Array<{
    id: string;
    label: string;
    secondary?: string | null;
  }>;
}) {
  const choices = [...args.serviceFormCategories];

  if (!choices.some((item) => item.id === args.categoryId)) {
    const currentCategory = args.categories.find(
      (item) => item.id === args.categoryId,
    );

    if (currentCategory) {
      choices.push({
        ...currentCategory,
        secondary: currentCategory.secondary ?? "Categoria antiga do catálogo",
      });
    }
  }

  return choices;
}

export default async function ServicosPage({
  searchParams,
}: ServicosPageProps) {
  const { salon } = await requireOwnerSalon();
  const query = searchParams?.q?.trim() ?? "";
  const selectedCategoryId = searchParams?.categoryId ?? "";
  const selectedStatus = searchParams?.status ?? "";
  const currentPath = buildFilterHref(
    "/dashboard/gestao/servicos",
    searchParams,
    {},
  );

  const [services, options] = await Promise.all([
    loadManagementServices({
      salonId: salon.id,
      search: query,
      categoryId: selectedCategoryId || undefined,
      status: selectedStatus || undefined,
    }),
    loadManagementSelectOptions(salon.id),
  ]);
  const activeServices = services.filter((service) => service.is_active);
  const inactiveServices = services.filter((service) => !service.is_active);
  const servicesWithHistory = services.filter(
    (service) => service.appointmentsCount > 0,
  );
  const categoriesCovered = new Set(
    services.map((service) => service.categoryName),
  ).size;
  const averagePrice = activeServices.length
    ? activeServices.reduce((sum, service) => sum + Number(service.price), 0) /
      activeServices.length
    : 0;
  const averageDuration = activeServices.length
    ? Math.round(
        activeServices.reduce((sum, service) => sum + service.duration, 0) /
          activeServices.length,
      )
    : 0;
  const topService =
    [...services].sort((left, right) => {
      if (right.appointmentsCount !== left.appointmentsCount) {
        return right.appointmentsCount - left.appointmentsCount;
      }

      return Number(right.price) - Number(left.price);
    })[0] ?? null;
  const categoryVolume = new Map<string, number>();

  for (const service of services) {
    categoryVolume.set(
      service.categoryName,
      (categoryVolume.get(service.categoryName) ?? 0) + 1,
    );
  }

  const topCategory =
    [...categoryVolume.entries()].sort(
      (left, right) => right[1] - left[1],
    )[0] ?? null;
  const totalAppointmentsInCatalog = services.reduce(
    (sum, service) => sum + service.appointmentsCount,
    0,
  );

  return (
    <div className="page-grid workspace-page management-page management-page--services">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        id="services-overview"
        eyebrow="Catálogo do salão"
        title="Serviços prontos para vender com clareza."
        description="Preço, duração, categoria e saúde do catálogo em uma leitura só."
        highlight={{
          label: "Catálogo ativo",
          value: `${activeServices.length} serviço${activeServices.length === 1 ? "" : "s"} ativo${activeServices.length === 1 ? "" : "s"}`,
          note: services.length
            ? `${categoriesCovered} categoria${categoriesCovered === 1 ? "" : "s"} coberta${categoriesCovered === 1 ? "" : "s"} e ${totalAppointmentsInCatalog} atendimento${totalAppointmentsInCatalog === 1 ? "" : "s"} já registrado${totalAppointmentsInCatalog === 1 ? "" : "s"}.`
            : "Cadastre o primeiro serviço para ligar agenda, equipe e vendas.",
        }}
        signals={[
          {
            label: "Opções rápidas",
            value: options.serviceFormCategories.length,
            tone: options.serviceFormCategories.length ? "soft" : "neutral",
          },
          {
            label: "Inativos",
            value: inactiveServices.length,
            tone: inactiveServices.length ? "warm" : "success",
          },
          {
            label: "Com histórico",
            value: servicesWithHistory.length,
            tone: servicesWithHistory.length ? "accent" : "soft",
          },
        ]}
        stats={[
          {
            label: "Serviços no catálogo",
            value: services.length,
            note: "Itens visíveis para operação.",
            tone: services.length ? "soft" : "neutral",
          },
          {
            label: "Preço médio",
            value: activeServices.length
              ? formatCurrency(averagePrice)
              : "Sem base",
            note: "Média dos ativos.",
            tone: activeServices.length ? "accent" : "soft",
          },
          {
            label: "Tempo médio",
            value: activeServices.length
              ? `${averageDuration} min`
              : "Sem base",
            note: "Duração da carteira ativa.",
            tone: activeServices.length ? "success" : "soft",
          },
          {
            label: "Mais agendado",
            value: topService?.name ?? "Sem histórico",
            note: topService
              ? `${topService.appointmentsCount} atendimento(s) no histórico.`
              : "O líder aparece quando a agenda ganhar volume.",
            tone: topService?.appointmentsCount ? "warm" : "soft",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#service-create" className="primary-button">
              Novo serviço
            </a>
            <a href="#service-catalog" className="secondary-button">
              Ver catálogo
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">
              Leitura do catálogo
            </span>
            <h3>{topService?.name ?? "Monte o primeiro serviço"}</h3>
            <p>
              {topService
                ? `${topService.categoryName} com ${topService.duration} min, ${formatCurrency(Number(topService.price))} e ${topService.appointmentsCount} atendimento(s) no histórico.`
                : "Preço, categoria e duração bem definidos deixam a agenda mais fluida e vendável."}
            </p>
            <div className="management-hero-pill-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Categoria forte</span>
                <strong>{topCategory?.[0] ?? "Sem leitura"}</strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Faixa média</span>
                <strong>
                  {activeServices.length
                    ? formatCurrency(averagePrice)
                    : "Sem base"}
                </strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos do catálogo"
        items={[
          {
            href: "#service-create",
            label: "Novo serviço",
            meta: "Preço e duração",
          },
          {
            href: "#service-filters",
            label: "Filtros",
            meta: "Categoria e status",
          },
          {
            href: "#service-catalog",
            label: "Catálogo",
            meta: "Edição e limpeza",
          },
        ]}
      />

      <section
        className="workspace-subgrid management-summary-grid"
        aria-label="Resumo do catálogo"
      >
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Categoria forte</span>
          <h3>
            {topCategory
              ? `${topCategory[1]} serviço(s) em ${topCategory[0]}`
              : "Sem categoria dominante"}
          </h3>
          <p>
            {topCategory
              ? "Essa frente concentra mais itens no catálogo atual do salão."
              : "Assim que o catálogo crescer, a categoria dominante aparece aqui."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Serviços em atenção</span>
          <h3>
            {inactiveServices.length} item
            {inactiveServices.length === 1 ? "" : "s"} inativo
            {inactiveServices.length === 1 ? "" : "s"}
          </h3>
          <p>
            {inactiveServices.length
              ? "Revise o que está pausado para não deixar o catálogo confuso na operação."
              : "Todo o catálogo atual está ativo e pronto para agenda."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Demanda registrada</span>
          <h3>
            {totalAppointmentsInCatalog} atendimento
            {totalAppointmentsInCatalog === 1 ? "" : "s"} no histórico
          </h3>
          <p>
            {topService?.appointmentsCount
              ? `${topService.name} lidera com ${topService.appointmentsCount} atendimento(s).`
              : "Quando os serviços começarem a girar, a leitura de demanda aparece aqui."}
          </p>
        </article>
      </section>

      <section className="management-grid management-grid--two">
        <article
          id="service-create"
          className="card content-card management-card"
        >
          <div className="section-heading">
            <div>
              <h2>Novo serviço</h2>
              <p className="muted">
                Classifique o serviço como principal ou complementar para o
                salão controlar melhor o catálogo.
              </p>
            </div>
          </div>

          <form
            action={createManagementServiceAction}
            className="simple-form"
            encType="multipart/form-data"
          >
            <input type="hidden" name="returnPath" value={currentPath} />

            <div className="field">
              <label htmlFor="service-name">Nome do serviço</label>
              <input id="service-name" name="name" required />
            </div>

            <div className="field">
              <label htmlFor="service-category-id">Categoria</label>
              <div className="management-service-category-guide">
                {options.serviceFormCategories.map((item) => (
                  <article key={item.id}>
                    <strong>{item.label}</strong>
                    <p>{item.secondary}</p>
                  </article>
                ))}
              </div>
              <select
                id="service-category-id"
                name="serviceCategoryId"
                required
              >
                <option value="">Selecione</option>
                {options.serviceFormCategories.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="muted">
                Use <strong>Principal</strong> para os serviços carro-chefe e{" "}
                <strong>Complementar</strong> para extras e adicionais.
              </p>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="service-duration">Duração (min)</label>
                <input
                  id="service-duration"
                  name="duration"
                  type="number"
                  min="5"
                  step="5"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="service-price">Preço</label>
                <input
                  id="service-price"
                  name="price"
                  type="number"
                  min="0.01"
                  step="0.01"
                  required
                />
              </div>
            </div>

            <div className="field">
              <label htmlFor="service-description">Descrição</label>
              <textarea id="service-description" name="description" rows={3} />
            </div>

            <div className="field">
              <label htmlFor="service-image">Foto do serviço</label>
              <input
                id="service-image"
                name="image"
                type="file"
                accept="image/*"
              />
              <p className="muted">Essa foto também aparece no app cliente.</p>
            </div>

            <label className="checkbox-field">
              <input type="checkbox" name="isActive" defaultChecked />
              <span>Serviço ativo</span>
            </label>

            <button type="submit" className="primary-button">
              Salvar serviço
            </button>
          </form>
        </article>

        <article
          id="service-filters"
          className="card content-card management-card"
        >
          <div className="section-heading">
            <div>
              <h2>Filtros do catálogo</h2>
              <p className="muted">Busque por nome, categoria ou status.</p>
            </div>
          </div>

          <form method="get" className="simple-form">
            <div className="field">
              <label htmlFor="service-search">Buscar</label>
              <input
                id="service-search"
                name="q"
                defaultValue={query}
                placeholder="Nome ou descrição"
              />
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="service-filter-category">Categoria</label>
                <select
                  id="service-filter-category"
                  name="categoryId"
                  defaultValue={selectedCategoryId}
                >
                  <option value="">Todas</option>
                  {options.categories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="field">
                <label htmlFor="service-filter-status">Status</label>
                <select
                  id="service-filter-status"
                  name="status"
                  defaultValue={selectedStatus}
                >
                  <option value="">Todos</option>
                  <option value="active">Ativos</option>
                  <option value="inactive">Inativos</option>
                </select>
              </div>
            </div>

            <div className="inline-actions">
              <button type="submit" className="secondary-button">
                Aplicar
              </button>
              <a href="/dashboard/gestao/servicos" className="secondary-button">
                Limpar
              </a>
            </div>
          </form>
        </article>
      </section>

      <section
        id="service-catalog"
        className="card content-card management-card"
      >
        <div className="section-heading">
          <div>
            <h2>Serviços cadastrados</h2>
            <p className="muted">
              {services.length
                ? `${services.length} serviço(s) encontrados`
                : "Nenhum serviço encontrado"}
            </p>
          </div>
        </div>

        {!services.length ? (
          <EmptyStateCard
            eyebrow="Catálogo vazio"
            title="Cadastre o primeiro serviço"
            description="Ele ficará disponível para a agenda assim que estiver ativo."
          />
        ) : (
          <div className="management-service-list">
            {services.map((service) => {
              const categoryChoices = buildServiceCategoryChoices({
                categoryId: service.service_category_id,
                categories: options.categories,
                serviceFormCategories: options.serviceFormCategories,
              });
              const usesLegacyCategory = !options.serviceFormCategories.some(
                (item) => item.id === service.service_category_id,
              );

              return (
                <article key={service.id} className="management-service-card">
                <div className="management-service-card__header">
                  <div>
                    <strong>{service.name}</strong>
                    <p className="muted">
                      {service.categoryName} • {service.duration} min •{" "}
                      {formatCurrency(Number(service.price))}
                    </p>
                  </div>
                  <span
                    className={`badge ${
                      service.is_active
                        ? "badge--confirmed"
                        : "badge--cancelled"
                    }`}
                  >
                    {service.is_active ? "Ativo" : "Inativo"}
                  </span>
                </div>

                <div className="management-service-card__meta">
                  <span>{service.appointmentsCount} atendimento(s)</span>
                  <span>
                    {service.description || "Sem descrição complementar"}
                  </span>
                </div>

                <details className="management-details">
                  <summary>Editar serviço</summary>

                  <form
                    action={updateManagementServiceAction}
                    className="simple-form"
                    encType="multipart/form-data"
                  >
                    <input
                      type="hidden"
                      name="returnPath"
                      value={currentPath}
                    />
                    <input type="hidden" name="serviceId" value={service.id} />

                    <div className="field">
                      <label>Nome do serviço</label>
                      <input name="name" defaultValue={service.name} required />
                    </div>

                    <div className="field">
                      <label>Categoria</label>
                      <select
                        name="serviceCategoryId"
                        defaultValue={service.service_category_id}
                        required
                      >
                        {categoryChoices.map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.label}
                          </option>
                        ))}
                      </select>
                      <p className="muted">
                        {usesLegacyCategory
                          ? "Esse serviço está em uma categoria antiga. Se quiser simplificar o catálogo, mova para Principal ou Complementar."
                          : "Principal para o carro-chefe. Complementar para extras e adicionais."}
                      </p>
                    </div>

                    <div className="split-grid">
                      <div className="field">
                        <label>Duração (min)</label>
                        <input
                          name="duration"
                          type="number"
                          min="5"
                          step="5"
                          defaultValue={service.duration}
                          required
                        />
                      </div>
                      <div className="field">
                        <label>Preço</label>
                        <input
                          name="price"
                          type="number"
                          min="0.01"
                          step="0.01"
                          defaultValue={Number(service.price)}
                          required
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Descrição</label>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={service.description ?? ""}
                      />
                    </div>

                    <div className="field">
                      <label>Foto do serviço</label>
                      <input name="image" type="file" accept="image/*" />
                      <p className="muted">
                        {service.imageUrl ? (
                          <>
                            <a
                              href={service.imageUrl}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Ver foto atual
                            </a>{" "}
                            publicada no app.
                          </>
                        ) : (
                          "Envie uma foto para destacar o serviço no app cliente."
                        )}
                      </p>
                    </div>

                    {service.imageUrl ? (
                      <label className="checkbox-field">
                        <input type="checkbox" name="removeImage" />
                        <span>Remover foto atual</span>
                      </label>
                    ) : null}

                    <label className="checkbox-field">
                      <input
                        type="checkbox"
                        name="isActive"
                        defaultChecked={service.is_active}
                      />
                      <span>Serviço ativo</span>
                    </label>

                    <div className="inline-actions">
                      <button type="submit" className="primary-button">
                        Salvar alterações
                      </button>
                    </div>
                  </form>

                  <form action={deleteManagementServiceAction}>
                    <input
                      type="hidden"
                      name="returnPath"
                      value={currentPath}
                    />
                    <input type="hidden" name="serviceId" value={service.id} />
                    <button type="submit" className="danger-button">
                      Excluir serviço
                    </button>
                  </form>
                </details>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
