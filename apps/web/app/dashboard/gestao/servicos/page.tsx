import Image from "next/image";
import Link from "next/link";

import styles from "./page.module.css";
import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { EmptyStateCard } from "@/components/EmptyStateCard";
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
  searchParams?: Promise<{
    q?: string;
    categoryId?: string;
    status?: string;
    composer?: string;
    draftCategoryId?: string;
    message?: string;
    tone?: string;
  }>;
};

type ServiceItem = Awaited<ReturnType<typeof loadManagementServices>>[number];
type SelectOptions = Awaited<ReturnType<typeof loadManagementSelectOptions>>;

type CategoryChoice = {
  id: string;
  label: string;
  secondary?: string | null;
};

type ServiceGroup = {
  id: string;
  label: string;
  serviceCategoryId: string;
  totalAppointments: number;
  activeCount: number;
  items: ServiceItem[];
};

function serviceInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "SV";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? "S"}${parts[parts.length - 1][0] ?? "V"}`.toUpperCase();
}

function buildServiceCategoryChoices(args: {
  categoryId: string;
  categories: CategoryChoice[];
  serviceFormCategories: CategoryChoice[];
}) {
  const choices = [...args.serviceFormCategories];

  if (!choices.some((item) => item.id === args.categoryId)) {
    const currentCategory = args.categories.find((item) => item.id === args.categoryId);

    if (currentCategory) {
      choices.push({
        ...currentCategory,
        secondary: currentCategory.secondary ?? "Categoria atual do catálogo",
      });
    }
  }

  return choices;
}

function groupServicesByCategory(services: ServiceItem[]) {
  const groups = new Map<string, ServiceGroup>();

  for (const service of services) {
    const label = service.categoryName?.trim() || "Sem categoria";
    const current =
      groups.get(label) ??
      ({
        id: label.toLowerCase().replace(/\s+/g, "-"),
        label,
        serviceCategoryId: service.service_category_id,
        totalAppointments: 0,
        activeCount: 0,
        items: [],
      } satisfies ServiceGroup);

    current.items.push(service);
    current.totalAppointments += service.appointmentsCount;
    current.activeCount += service.is_active ? 1 : 0;

    if (!current.serviceCategoryId && service.service_category_id) {
      current.serviceCategoryId = service.service_category_id;
    }

    groups.set(label, current);
  }

  return [...groups.values()];
}

function CatalogGlyph({
  name,
}: {
  name: "search" | "plus" | "spark" | "clock" | "money" | "history" | "dots";
}) {
  switch (name) {
    case "search":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M10.5 4.75a5.75 5.75 0 1 1 0 11.5a5.75 5.75 0 0 1 0-11.5Zm0 1.5a4.25 4.25 0 1 0 0 8.5a4.25 4.25 0 0 0 0-8.5Zm6.53 9.72a.75.75 0 0 1 1.06 0l2.16 2.16a.75.75 0 0 1-1.06 1.06l-2.16-2.16a.75.75 0 0 1 0-1.06Z"
            fill="currentColor"
          />
        </svg>
      );
    case "clock":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.75a7.25 7.25 0 1 1 0 14.5a7.25 7.25 0 0 1 0-14.5Zm0 1.5a5.75 5.75 0 1 0 0 11.5a5.75 5.75 0 0 0 0-11.5Zm.75 2.5a.75.75 0 0 0-1.5 0v3.73c0 .2.08.39.22.53l2.2 2.2a.75.75 0 1 0 1.06-1.06l-1.98-1.97V8.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "money":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6 6.25A2.75 2.75 0 0 0 3.25 9v6A2.75 2.75 0 0 0 6 17.75h12A2.75 2.75 0 0 0 20.75 15V9A2.75 2.75 0 0 0 18 6.25H6Zm.75 2a.75.75 0 0 1 0 1.5a1.25 1.25 0 0 0-1.25 1.25a.75.75 0 0 1-1.5 0A2.75 2.75 0 0 1 6.75 8.25Zm10.5 0A2.75 2.75 0 0 1 20 11a.75.75 0 0 1-1.5 0a1.25 1.25 0 0 0-1.25-1.25a.75.75 0 0 1 0-1.5ZM12 9.5a2.5 2.5 0 1 1 0 5a2.5 2.5 0 0 1 0-5Zm-5.75 4.75a.75.75 0 0 1 .75.75A1.25 1.25 0 0 0 8.25 16.25a.75.75 0 0 1 0 1.5A2.75 2.75 0 0 1 5.5 15a.75.75 0 0 1 .75-.75Zm11.5 0A.75.75 0 0 1 18.5 15a2.75 2.75 0 0 1-2.75 2.75a.75.75 0 0 1 0-1.5A1.25 1.25 0 0 0 17 15a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "history":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.75a7.24 7.24 0 0 1 6.97 5.3a.75.75 0 1 1-1.45.39A5.75 5.75 0 1 0 17.4 14a.75.75 0 0 1 1.42.48A7.25 7.25 0 1 1 12 4.75Zm.75 2.5a.75.75 0 0 0-1.5 0V12c0 .2.08.39.22.53l2.45 2.45a.75.75 0 0 0 1.06-1.06l-2.23-2.23V7.25ZM4.78 7.72a.75.75 0 0 1 1.06 0l.8.8v-2a.75.75 0 0 1 1.5 0v3.81a.75.75 0 0 1-.75.75H3.58a.75.75 0 1 1 0-1.5h2l-.8-.8a.75.75 0 0 1 0-1.06Z"
            fill="currentColor"
          />
        </svg>
      );
    case "dots":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M6.75 12a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 0 1 2.5 0Zm6.5 0a1.25 1.25 0 1 1-2.5 0a1.25 1.25 0 0 1 2.5 0Zm5.25 1.25a1.25 1.25 0 1 0 0-2.5a1.25 1.25 0 0 0 0 2.5Z"
            fill="currentColor"
          />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.23 4.54c.28-1.06 1.8-1.06 2.08 0l.46 1.74a1.5 1.5 0 0 0 1.06 1.06l1.74.46c1.06.28 1.06 1.8 0 2.08l-1.74.46a1.5 1.5 0 0 0-1.06 1.06l-.46 1.74c-.28 1.06-1.8 1.06-2.08 0l-.46-1.74a1.5 1.5 0 0 0-1.06-1.06l-1.74-.46c-1.06-.28-1.06-1.8 0-2.08l1.74-.46a1.5 1.5 0 0 0 1.06-1.06l.46-1.74Z"
            fill="currentColor"
          />
        </svg>
      );
    case "plus":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.25a.75.75 0 0 1 .75.75v6.25H19a.75.75 0 0 1 0 1.5h-6.25V19a.75.75 0 0 1-1.5 0v-6.25H5a.75.75 0 0 1 0-1.5h6.25V5a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

export default async function ServicosPage({
  searchParams: searchParamsPromise,
}: ServicosPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);

  const query = searchParams?.q?.trim() ?? "";
  const selectedCategoryId = searchParams?.categoryId?.trim() ?? "";
  const selectedStatus = searchParams?.status?.trim() ?? "";
  const isComposerOpen = searchParams?.composer === "1";
  const rawDraftCategoryId = searchParams?.draftCategoryId?.trim() ?? "";

  const [services, options] = await Promise.all([
    loadManagementServices({
      salonId: salon.id,
      search: query || undefined,
      categoryId: selectedCategoryId || undefined,
      status: selectedStatus || undefined,
    }),
    loadManagementSelectOptions(salon.id, {
      categories: true,
      serviceFormCategories: true,
      services: false,
      professionals: false,
      clients: false,
    }),
  ]);

  const serviceFormCategories = options.serviceFormCategories as CategoryChoice[];
  const categoryOptions = options.categories as CategoryChoice[];
  const currentPath = buildFilterHref("/dashboard/gestao/servicos", searchParams, {});
  const clearFiltersHref = buildFilterHref("/dashboard/gestao/servicos", searchParams, {
    q: undefined,
    categoryId: undefined,
    status: undefined,
  });
  const openCreateHref = `${buildFilterHref("/dashboard/gestao/servicos", searchParams, {
    composer: "1",
    draftCategoryId: undefined,
  })}#service-create`;
  const closeCreateHref = buildFilterHref("/dashboard/gestao/servicos", searchParams, {
    composer: undefined,
    draftCategoryId: undefined,
  });
  const isDraftCategoryValid = serviceFormCategories.some(
    (item) => item.id === rawDraftCategoryId,
  );
  const draftCategoryId = isDraftCategoryValid ? rawDraftCategoryId : "";
  const activeServices = services.filter((service) => service.is_active);
  const inactiveServices = services.filter((service) => !service.is_active);
  const groupedServices = groupServicesByCategory(services);
  const hasFilters = Boolean(query || selectedCategoryId || selectedStatus);

  return (
    <AsyncActionNoticeRegion
      initialMessage={searchParams?.message}
      initialTone={searchParams?.tone}
    >
      <div className={styles.page}>
        <section className={styles.board}>
          <header className={styles.topbar}>
            <div className={styles.titleBlock}>
              <span className={styles.eyebrow}>Catalogo</span>
              <h1>Serviços</h1>
              <p>Cadastre e ajuste o que o salao vende no dia a dia.</p>
            </div>

            <form method="get" className={styles.toolbar}>
              {isComposerOpen ? <input type="hidden" name="composer" value="1" /> : null}
              {draftCategoryId ? (
                <input type="hidden" name="draftCategoryId" value={draftCategoryId} />
              ) : null}

              <label className={styles.searchBox} htmlFor="service-search">
                <span className={styles.searchIcon}>
                  <CatalogGlyph name="search" />
                </span>
                <input
                  id="service-search"
                  name="q"
                  defaultValue={query}
                  placeholder="Buscar por nome, categoria ou descrição"
                />
              </label>

              <select name="categoryId" defaultValue={selectedCategoryId} className={styles.toolbarSelect}>
                <option value="">Todas as categorias</option>
                {categoryOptions.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>

              <select name="status" defaultValue={selectedStatus} className={styles.toolbarSelect}>
                <option value="">Todos os status</option>
                <option value="active">Ativos</option>
                <option value="inactive">Inativos</option>
              </select>

              <button type="submit" className={styles.toolbarButton}>
                Filtrar
              </button>

              {hasFilters ? (
                <Link href={clearFiltersHref} className={styles.toolbarGhostButton}>
                  Limpar
                </Link>
              ) : null}

              <Link
                href={isComposerOpen ? closeCreateHref : openCreateHref}
                className={styles.primaryButton}
              >
                <span className={styles.buttonIcon}>
                  <CatalogGlyph name="plus" />
                </span>
                {isComposerOpen ? "Fechar cadastro" : "Novo serviço"}
              </Link>
            </form>
          </header>

          <div className={styles.statsRow}>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Servicos ativos</span>
              <strong>{activeServices.length}</strong>
              <small>{services.length} item(ns) no catalogo atual</small>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Categorias no filtro</span>
              <strong>{groupedServices.length}</strong>
              <small>{hasFilters ? "Lista filtrada" : "Catalogo completo"}</small>
            </article>
            <article className={styles.statCard}>
              <span className={styles.statLabel}>Servicos inativos</span>
              <strong>{inactiveServices.length}</strong>
              <small>{inactiveServices.length ? "Revise o que nao aparece na agenda" : "Tudo ativo no momento"}</small>
            </article>
          </div>

          {isComposerOpen ? (
            <section id="service-create" className={styles.composer}>
              <div className={styles.composerHeader}>
                <div>
                  <span className={styles.eyebrow}>Cadastro</span>
                  <h2>Novo serviço</h2>
                  <p>Cadastro rapido com categoria, duracao e preco.</p>
                </div>

                <Link href={closeCreateHref} className={styles.toolbarGhostButton}>
                  Fechar
                </Link>
              </div>

              <AsyncActionForm
                action={createManagementServiceAction}
                className={styles.composerForm}
                encType="multipart/form-data"
                resetOnSuccess
              >
                <input type="hidden" name="returnPath" value={closeCreateHref} />

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="service-name">Nome do serviço</label>
                    <input id="service-name" name="name" required />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="service-category-id">Categoria</label>
                    <select
                      id="service-category-id"
                      name="serviceCategoryId"
                      defaultValue={draftCategoryId}
                      required
                    >
                      <option value="">Selecione</option>
                      {serviceFormCategories.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="service-duration">Duração</label>
                    <input
                      id="service-duration"
                      name="duration"
                      type="number"
                      min="5"
                      step="5"
                      required
                    />
                  </div>

                  <div className={styles.field}>
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


                <div className={styles.field}>
                  <label htmlFor="service-description">Descrição</label>
                  <textarea id="service-description" name="description" rows={3} />
                </div>

                <div className={styles.formGrid}>
                  <div className={styles.field}>
                    <label htmlFor="service-image">Foto do serviço</label>
                    <input
                      id="service-image"
                      name="image"
                      type="file"
                      accept="image/*"
                    />
                  </div>

                  <label className={styles.toggleField}>
                    <input type="checkbox" name="isActive" defaultChecked />
                    <span>Serviço ativo no catálogo</span>
                  </label>
                </div>

                <div className={styles.formFooter}>
                  <p>Os dados seguem reais no sistema e continuam valendo para a agenda e o app do cliente.</p>
                  <button type="submit" className={styles.primaryButton}>
                    Salvar serviço
                  </button>
                </div>
              </AsyncActionForm>
            </section>
          ) : null}

          <section id="service-catalog" className={styles.catalog}>
            {!groupedServices.length ? (
              <div className={styles.emptyWrap}>
                <EmptyStateCard
                  eyebrow="Catálogo vazio"
                  title="Cadastre o primeiro serviço"
                  description="Ele ficará disponível na agenda assim que estiver ativo."
                />
              </div>
            ) : (
              groupedServices.map((group) => (
                <section key={group.id} className={styles.categorySection}>
                  <div className={styles.categoryHeader}>
                    <div>
                      <h2>{group.label}</h2>
                      <p>
                        {group.items.length} serviço{group.items.length === 1 ? "" : "s"} •{" "}
                        {group.totalAppointments} atendimento
                        {group.totalAppointments === 1 ? "" : "s"} • {group.activeCount} ativo
                        {group.activeCount === 1 ? "" : "s"}
                      </p>
                    </div>

                  </div>

                  <div className={styles.serviceGrid}>
                    {group.items.map((service) => {
                      const categoryChoices = buildServiceCategoryChoices({
                        categoryId: service.service_category_id,
                        categories: categoryOptions,
                        serviceFormCategories,
                      });
                      const usesLegacyCategory = !serviceFormCategories.some(
                        (item) => item.id === service.service_category_id,
                      );

                      return (
                        <article
                          key={service.id}
                          className={`${styles.serviceCard} ${
                            !service.is_active ? styles.serviceCardMuted : ""
                          }`}
                        >
                          <div className={styles.serviceCardHead}>
                            <div className={styles.serviceCardTitle}>
                              <strong>{service.name}</strong>
                              <span>
                                {service.duration} min • {formatCurrency(Number(service.price))}
                              </span>
                            </div>

                            <div className={styles.serviceCardControls}>
                              <span
                                className={`${styles.statusBadge} ${
                                  service.is_active ? styles.statusLive : styles.statusPaused
                                }`}
                              >
                                {service.is_active ? "Ativo" : "Inativo"}
                              </span>

                              <details className={styles.cardMenu}>
                                <summary
                                  className={styles.cardMenuButton}
                                  aria-label={`Gerenciar ${service.name}`}
                                >
                                  <CatalogGlyph name="dots" />
                                </summary>

                                <div className={styles.editorPanel}>
                                  <AsyncActionForm
                                    action={updateManagementServiceAction}
                                    className={styles.editorForm}
                                    encType="multipart/form-data"
                                  >
                                    <input type="hidden" name="returnPath" value={currentPath} />
                                    <input type="hidden" name="serviceId" value={service.id} />

                                    <div className={styles.field}>
                                      <label htmlFor={`service-name-${service.id}`}>Nome</label>
                                      <input
                                        id={`service-name-${service.id}`}
                                        name="name"
                                        defaultValue={service.name}
                                        required
                                      />
                                    </div>

                                    <div className={styles.field}>
                                      <label htmlFor={`service-category-${service.id}`}>Categoria</label>
                                      <select
                                        id={`service-category-${service.id}`}
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
                                      <p className={styles.fieldHint}>
                                        {usesLegacyCategory
                                          ? "Esse serviço ainda está ligado a uma categoria antiga do catálogo."
                                          : "Principal para carro-chefe. Complementar para extras e adicionais."}
                                      </p>
                                    </div>

                                    <div className={styles.editorGrid}>
                                      <div className={styles.field}>
                                        <label htmlFor={`service-duration-${service.id}`}>Duração</label>
                                        <input
                                          id={`service-duration-${service.id}`}
                                          name="duration"
                                          type="number"
                                          min="5"
                                          step="5"
                                          defaultValue={service.duration}
                                          required
                                        />
                                      </div>

                                      <div className={styles.field}>
                                        <label htmlFor={`service-price-${service.id}`}>Preço</label>
                                        <input
                                          id={`service-price-${service.id}`}
                                          name="price"
                                          type="number"
                                          min="0.01"
                                          step="0.01"
                                          defaultValue={Number(service.price)}
                                          required
                                        />
                                      </div>
                                    </div>

                                    <div className={styles.field}>
                                      <label htmlFor={`service-description-${service.id}`}>Descrição</label>
                                      <textarea
                                        id={`service-description-${service.id}`}
                                        name="description"
                                        rows={3}
                                        defaultValue={service.description ?? ""}
                                      />
                                    </div>

                                    <div className={styles.field}>
                                      <label htmlFor={`service-image-${service.id}`}>Foto do serviço</label>
                                      <input
                                        id={`service-image-${service.id}`}
                                        name="image"
                                        type="file"
                                        accept="image/*"
                                      />
                                      <p className={styles.fieldHint}>
                                        {service.imageUrl ? (
                                          <>
                                            <a href={service.imageUrl} target="_blank" rel="noreferrer">
                                              Ver foto atual
                                            </a>{" "}
                                            publicada no app do cliente.
                                          </>
                                        ) : (
                                          "Envie uma foto real para destacar o serviço no catálogo."
                                        )}
                                      </p>
                                    </div>

                                    {service.imageUrl ? (
                                      <label className={styles.toggleField}>
                                        <input type="checkbox" name="removeImage" />
                                        <span>Remover foto atual</span>
                                      </label>
                                    ) : null}

                                    <label className={styles.toggleField}>
                                      <input
                                        type="checkbox"
                                        name="isActive"
                                        defaultChecked={service.is_active}
                                      />
                                      <span>Serviço ativo</span>
                                    </label>

                                    <div className={styles.editorActions}>
                                      <button type="submit" className={styles.primaryButton}>
                                        Salvar alterações
                                      </button>
                                    </div>
                                  </AsyncActionForm>

                                  <AsyncActionForm action={deleteManagementServiceAction}>
                                    <input type="hidden" name="returnPath" value={currentPath} />
                                    <input type="hidden" name="serviceId" value={service.id} />
                                    <button type="submit" className={styles.dangerButton}>
                                      Excluir serviço
                                    </button>
                                  </AsyncActionForm>
                                </div>
                              </details>
                            </div>
                          </div>

                          <p className={styles.serviceDescription}>
                            {service.description || "Sem descrição complementar para este serviço."}
                          </p>

                          <div className={styles.serviceFoot}>
                            <div className={styles.metaGrid}>
                              <span>
                                <CatalogGlyph name="history" />
                                {service.appointmentsCount} atendimento
                                {service.appointmentsCount === 1 ? "" : "s"}
                              </span>
                              <span>
                                <CatalogGlyph name="clock" />
                                {service.categoryName}
                              </span>
                              <span>
                                <CatalogGlyph name="money" />
                                Atualizado para agenda real
                              </span>
                            </div>

                            <div className={styles.avatarShell}>
                              {service.imageUrl ? (
                                <Image
                                  src={service.imageUrl}
                                  alt={`Foto do serviço ${service.name}`}
                                  width={56}
                                  height={56}
                                  unoptimized
                                  className={styles.avatarImage}
                                />
                              ) : (
                                <div className={styles.avatarFallback}>
                                  {serviceInitials(service.name)}
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>
              ))
            )}
          </section>
        </section>
      </div>
    </AsyncActionNoticeRegion>
  );
}

