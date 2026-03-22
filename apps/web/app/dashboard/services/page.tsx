import Image from "next/image";

import { createServiceAction, updateServiceCatalogAction } from "@/app/actions";
import { ConfirmServiceDeleteButton } from "@/components/ConfirmServiceDeleteButton";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import { SERVICE_CATEGORY_PRESETS } from "@/lib/service-taxonomy";
import { createClient } from "@/lib/supabase/server";

type ServicesPageProps = {
  searchParams?: {
    category?: string | string[];
    message?: string;
    q?: string | string[];
    tone?: string;
  };
};

export default async function ServicesPage({ searchParams }: ServicesPageProps) {
  const { salon } = await requireOwnerSalon();
  const supabase = createClient();
  const searchQuery = Array.isArray(searchParams?.q) ? searchParams?.q[0] : searchParams?.q;
  const categoryFilter = Array.isArray(searchParams?.category) ? searchParams?.category[0] : searchParams?.category;
  const normalizedSearch = searchQuery?.trim() ?? "";
  const normalizedCategory = categoryFilter?.trim() ?? "";

  const [servicesResult, categoriesResult] = await Promise.all([
    (() => {
      let query = supabase.from("services").select("*").eq("salon_id", salon.id);

      if (normalizedCategory) {
        query = query.eq("category", normalizedCategory);
      }

      if (normalizedSearch) {
        query = query.or(
          `name.ilike.%${normalizedSearch}%,description.ilike.%${normalizedSearch}%,category.ilike.%${normalizedSearch}%`,
        );
      }

      return query.order("sort_order").order("category").order("name");
    })(),
    supabase.from("services").select("category").eq("salon_id", salon.id).order("category"),
  ]);

  const services = servicesResult.data;
  const availableCategories = [...new Set((categoriesResult.data ?? []).map((service) => service.category).filter(Boolean))];
  const hasActiveFilters = Boolean(normalizedSearch || normalizedCategory);

  const groupedServices = (services ?? []).reduce<Record<string, NonNullable<typeof services>>>((groups, service) => {
    const category = service.category ?? "Geral";
    groups[category] ??= [];
    groups[category].push(service);
    return groups;
  }, {});

  return (
    <div className="two-column-grid">
      <section className="card content-card">
        <div className="section-heading">
          <div>
            <h2>Serviços cadastrados</h2>
            <p className="muted">
              Organize o catálogo por frentes reais da estética, como cabelo feminino ou masculino, unhas,
              sobrancelhas, cílios, maquiagem, depilação e massagens.
            </p>
          </div>
        </div>

        <form method="get" className="services-toolbar">
          <div className="services-toolbar__grid">
            <div className="field">
              <label htmlFor="services-search">Buscar serviço</label>
              <input
                id="services-search"
                name="q"
                placeholder="Busque por nome, descrição ou categoria"
                defaultValue={normalizedSearch}
              />
            </div>

            <div className="field">
              <label htmlFor="services-category">Categoria</label>
              <select id="services-category" name="category" defaultValue={normalizedCategory}>
                <option value="">Todas as categorias</option>
                {availableCategories.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="services-toolbar__actions">
            <button type="submit" className="secondary-button">
              Filtrar
            </button>
            {hasActiveFilters ? (
              <a href="/dashboard/services" className="secondary-button services-toolbar__clear">
                Limpar filtros
              </a>
            ) : null}
            <span className="muted service-results-meta">
              {services?.length ?? 0} {(services?.length ?? 0) === 1 ? "resultado" : "resultados"}
            </span>
          </div>
        </form>

        <div className="row-list" style={{ marginTop: 16 }}>
          {!services?.length ? (
            <EmptyStateCard
              eyebrow={hasActiveFilters ? "Nenhum resultado" : "Comece por aqui"}
              title={hasActiveFilters ? "Nenhum serviço encontrado com esse filtro" : "Nenhum serviço cadastrado"}
              description={
                hasActiveFilters
                  ? "Ajuste a busca ou troque a categoria para encontrar o atendimento que você quer editar."
                  : "Cadastre os atendimentos que você oferece para que eles apareçam no app dos clientes."
              }
            />
          ) : (
            Object.entries(groupedServices).map(([category, items]) => (
              <section key={category} className="service-category-section">
                <div className="service-category-header">
                  <div>
                    <span className="eyebrow">Categoria</span>
                    <h3>{category}</h3>
                  </div>
                  <span className="list-meta">
                    {items.length} {items.length === 1 ? "serviço" : "serviços"}
                  </span>
                </div>

                <div className="row-list">
                  {items.map((service) => (
                    <article key={service.id} className="list-row service-editor-card">
                      <div className="service-editor-grid">
                        <aside className="service-preview-panel">
                          {service.image_path ? (
                            <Image
                              src={supabase.storage.from("salon-assets").getPublicUrl(service.image_path).data.publicUrl}
                              alt={service.name}
                              width={240}
                              height={180}
                              className="service-preview-image"
                            />
                          ) : (
                            <div className="service-preview-placeholder">
                              <span className="eyebrow">Sem foto</span>
                              <strong>{service.name}</strong>
                              <span className="muted">Adicione uma imagem para valorizar a vitrine no app do cliente.</span>
                            </div>
                          )}

                          <div className="service-preview-meta">
                            <span className="list-meta">Ordem {service.sort_order ?? 0}</span>
                            <h3>{service.name}</h3>
                            <small className="list-meta">
                              {service.duration} min • {formatCurrency(Number(service.price))}
                            </small>
                            {service.description ? <p className="muted list-description">{service.description}</p> : null}
                          </div>
                        </aside>

                        <div className="list-row__content">
                          <form action={updateServiceCatalogAction} className="form-grid">
                            <input type="hidden" name="serviceId" value={service.id} />

                            <div className="field">
                              <label htmlFor={`service-category-${service.id}`}>Tipo do serviço</label>
                              <input
                                id={`service-category-${service.id}`}
                                name="category"
                                list="service-category-options"
                                defaultValue={service.category ?? "Geral"}
                                required
                              />
                            </div>

                            <div className="field">
                              <label htmlFor={`service-name-${service.id}`}>Nome do serviço</label>
                              <input
                                id={`service-name-${service.id}`}
                                name="name"
                                defaultValue={service.name}
                                required
                              />
                            </div>

                            <div className="field">
                              <label htmlFor={`service-description-${service.id}`}>Descrição curta</label>
                              <textarea
                                id={`service-description-${service.id}`}
                                name="description"
                                rows={4}
                                defaultValue={service.description ?? ""}
                              />
                            </div>

                            <div className="split-grid">
                              <div className="field">
                                <label htmlFor={`service-price-${service.id}`}>Preço</label>
                                <input
                                  id={`service-price-${service.id}`}
                                  name="price"
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  defaultValue={Number(service.price)}
                                  required
                                />
                              </div>

                              <div className="field">
                                <label htmlFor={`service-duration-${service.id}`}>Duração (min)</label>
                                <input
                                  id={`service-duration-${service.id}`}
                                  name="duration"
                                  type="number"
                                  min="10"
                                  step="5"
                                  defaultValue={service.duration}
                                  required
                                />
                              </div>
                            </div>

                            <div className="split-grid">
                              <div className="field">
                                <label htmlFor={`service-order-${service.id}`}>Ordem de exibição</label>
                                <input
                                  id={`service-order-${service.id}`}
                                  name="sortOrder"
                                  type="number"
                                  min="0"
                                  step="1"
                                  defaultValue={service.sort_order ?? 0}
                                  required
                                />
                              </div>

                              <div className="field">
                                <label htmlFor={`service-image-${service.id}`}>Foto do serviço</label>
                                <input id={`service-image-${service.id}`} name="image" type="file" accept="image/*" />
                              </div>
                            </div>

                            {service.image_path ? (
                              <label className="checkbox-field">
                                <input type="checkbox" name="removeImage" />
                                Remover foto atual
                              </label>
                            ) : null}

                            <button type="submit" className="secondary-button">
                              Salvar serviço
                            </button>
                          </form>

                          <div className="service-editor-footer">
                            <ConfirmServiceDeleteButton serviceId={service.id} serviceName={service.name} />
                            <small className="muted service-delete-note">
                              A exclusão é bloqueada quando o serviço já estiver em agendamentos ou vinculado ao feed.
                            </small>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      </section>

      <section className="card content-card form-panel">
        <div className="section-heading">
          <div>
            <h2>Novo serviço</h2>
            <p className="muted">Adicione um novo atendimento para aparecer no app dos clientes e entrar na agenda da equipe.</p>
          </div>
        </div>
        <form action={createServiceAction} className="form-grid">
          <div className="field">
            <label htmlFor="service-category">Tipo do serviço</label>
            <input
              id="service-category"
              name="category"
              list="service-category-options"
              placeholder="Ex.: Cabelo feminino, manicure, sobrancelhas"
              required
            />
          </div>

          <div className="field">
            <label htmlFor="service-name">Nome</label>
            <input id="service-name" name="name" placeholder="Corte feminino" required />
          </div>

          <div className="field">
            <label htmlFor="service-description">Descrição curta</label>
            <textarea
              id="service-description"
              name="description"
              placeholder="Explique rapidamente como funciona esse atendimento para o cliente."
              rows={4}
            />
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="service-order">Ordem de exibição</label>
              <input id="service-order" name="sortOrder" type="number" min="0" step="1" defaultValue="0" required />
            </div>

            <div className="field">
              <label htmlFor="service-image">Foto do serviço</label>
              <input id="service-image" name="image" type="file" accept="image/*" />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label htmlFor="service-price">Preço</label>
              <input id="service-price" name="price" type="number" min="0" step="0.01" placeholder="80" required />
            </div>

            <div className="field">
              <label htmlFor="service-duration">Duração (min)</label>
              <input id="service-duration" name="duration" type="number" min="10" step="5" placeholder="60" required />
            </div>
          </div>

          <button type="submit" className="primary-button">
            Adicionar serviço
          </button>

          <small className="muted">Novos serviços entram disponíveis para os profissionais ativos e podem ser ajustados em Equipe e agenda.</small>
        </form>

        <datalist id="service-category-options">
          {SERVICE_CATEGORY_PRESETS.map((category) => (
            <option key={category} value={category} />
          ))}
        </datalist>

        {searchParams?.message ? (
          <div style={{ marginTop: 16 }}>
            <FlashMessage message={searchParams.message} tone={searchParams.tone} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
