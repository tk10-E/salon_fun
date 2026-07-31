import Image from "next/image";
import Link from "next/link";

import styles from "./page.module.css";
import {
  AsyncActionForm,
  AsyncActionNoticeRegion,
} from "@/components/AsyncActionForm";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import {
  createManagementClientAction,
  deleteManagementClientAction,
  updateManagementClientAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import {
  buildFilterHref,
  formatDateLabel,
  loadManagementClients,
} from "@/lib/management";

type ClientesPageProps = {
  searchParams?: Promise<{
    q?: string;
    clientId?: string;
    composer?: string;
    message?: string;
    tone?: string;
  }>;
};

type ClientRecord = Awaited<ReturnType<typeof loadManagementClients>>[number];

function customerInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (!parts.length) {
    return "CL";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? "C"}${parts[parts.length - 1][0] ?? "L"}`.toUpperCase();
}

function getClientStage(client: ClientRecord) {
  if (client.upcomingCount > 0 && client.completedCount >= 4) {
    return { label: "Cliente forte", tone: "violet" as const };
  }

  if (client.upcomingCount > 0) {
    return { label: "Retorno ativo", tone: "accent" as const };
  }

  if (client.completedCount > 0) {
    return { label: "Com histÃ³rico", tone: "success" as const };
  }

  return { label: "Novo cadastro", tone: "soft" as const };
}

function formatPrimaryContact(client: ClientRecord) {
  return [client.phone, client.email].filter(Boolean).join(" â€¢ ") || "Sem contato principal informado";
}

function getStageClass(
  tone: ReturnType<typeof getClientStage>["tone"],
  stylesMap: Record<string, string>,
) {
  if (tone === "accent") {
    return stylesMap.stageAccent;
  }

  if (tone === "violet") {
    return stylesMap.stageViolet;
  }

  if (tone === "success") {
    return stylesMap.stageSuccess;
  }

  return stylesMap.stageSoft;
}

function formatLifecycleCopy(client: ClientRecord) {
  if (client.upcomingCount > 0) {
    return `${client.upcomingCount} retorno${client.upcomingCount === 1 ? "" : "s"} em andamento`;
  }

  if (client.completedCount > 0) {
    return `${client.completedCount} visita${client.completedCount === 1 ? "" : "s"} no histÃ³rico`;
  }

  return "Pronta para o primeiro atendimento";
}

function toVisualPercent(value: number, fallback = 14) {
  if (value <= 0) {
    return fallback;
  }

  return Math.min(100, Math.max(fallback, value));
}

function DashboardGlyph({
  name,
}: {
  name: "arrow" | "plus" | "search" | "spark";
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
    case "plus":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M12 4.25a.75.75 0 0 1 .75.75v6.25H19a.75.75 0 0 1 0 1.5h-6.25V19a.75.75 0 0 1-1.5 0v-6.25H5a.75.75 0 0 1 0-1.5h6.25V5a.75.75 0 0 1 .75-.75Z"
            fill="currentColor"
          />
        </svg>
      );
    case "spark":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M11.23 4.54c.28-1.06 1.8-1.06 2.08 0l.46 1.74a1.5 1.5 0 0 0 1.06 1.06l1.74.46c1.06.28 1.06 1.8 0 2.08l-1.74.46a1.5 1.5 0 0 0-1.06 1.06l-.46 1.74c-.28 1.06-1.8 1.06-2.08 0l-.46-1.74a1.5 1.5 0 0 0-1.06-1.06l-1.74-.46c-1.06-.28-1.06-1.8 0-2.08l1.74-.46a1.5 1.5 0 0 0 1.06-1.06l.46-1.74Zm6.72 9.72c.18-.68 1.15-.68 1.33 0l.22.83c.12.43.45.76.88.88l.83.22c.68.18.68 1.15 0 1.33l-.83.22a1.25 1.25 0 0 0-.88.88l-.22.83c-.18.68-1.15.68-1.33 0l-.22-.83a1.25 1.25 0 0 0-.88-.88l-.83-.22c-.68-.18-.68-1.15 0-1.33l.83-.22c.43-.12.76-.45.88-.88l.22-.83Z"
            fill="currentColor"
          />
        </svg>
      );
    case "arrow":
    default:
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M8.22 6.22a.75.75 0 0 1 1.06 0h6.5a.75.75 0 0 1 .75.75v6.5a.75.75 0 0 1-1.5 0V8.78l-7.5 7.5a.75.75 0 0 1-1.06-1.06l7.5-7.5H9.28a.75.75 0 0 1-1.06-1.5Z"
            fill="currentColor"
          />
        </svg>
      );
  }
}

export default async function ClientesPage({
  searchParams: searchParamsPromise,
}: ClientesPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);

  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const query = searchParams?.q?.trim() ?? "";
  const selectedClientId = searchParams?.clientId?.trim() ?? "";
  const isCreateComposerOpen = searchParams?.composer === "1";
  const currentPath = buildFilterHref("/dashboard/gestao/clientes", searchParams, {});
  const clearFiltersHref = buildFilterHref("/dashboard/gestao/clientes", searchParams, {
    q: undefined,
    clientId: undefined,
  });
  const clearHighlightHref = buildFilterHref("/dashboard/gestao/clientes", searchParams, {
    clientId: undefined,
  });
  const clients = await loadManagementClients(salon.id, query);

  const orderedClients = selectedClientId
    ? [...clients].sort((left, right) => {
        if (left.id === selectedClientId) {
          return -1;
        }

        if (right.id === selectedClientId) {
          return 1;
        }

        return left.name.localeCompare(right.name, "pt-BR");
      })
    : clients;

  const clientsWithUpcoming = clients.filter((client) => client.upcomingCount > 0).length;
  const clientsWithHistory = clients.filter((client) => client.completedCount > 0).length;
  const clientsWithBirthDate = clients.filter((client) => Boolean(client.birth_date)).length;
  const totalUpcoming = clients.reduce((sum, client) => sum + client.upcomingCount, 0);
  const totalCompleted = clients.reduce((sum, client) => sum + client.completedCount, 0);
  const dormantClients = clients.filter(
    (client) => client.completedCount > 0 && client.upcomingCount === 0,
  ).length;
  const strongClients = clients.filter((client) => getClientStage(client).tone === "violet").length;
  const newClients = clients.filter((client) => client.completedCount === 0).length;

  const spotlightClient =
    orderedClients.find((client) => client.id === selectedClientId) ??
    [...clients].sort((left, right) => {
      const leftScore = left.upcomingCount * 3 + left.completedCount;
      const rightScore = right.upcomingCount * 3 + right.completedCount;

      if (rightScore !== leftScore) {
        return rightScore - leftScore;
      }

      if (left.lastVisitAt && right.lastVisitAt) {
        return right.lastVisitAt.localeCompare(left.lastVisitAt);
      }

      if (right.lastVisitAt) {
        return 1;
      }

      if (left.lastVisitAt) {
        return -1;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    })[0] ?? null;

  const mostRecentClient =
    [...clients]
      .filter((client) => Boolean(client.lastVisitAt))
      .sort((left, right) => (right.lastVisitAt ?? "").localeCompare(left.lastVisitAt ?? ""))[0] ??
    null;

  const upcomingCoverage = clients.length
    ? Math.round((clientsWithUpcoming / clients.length) * 100)
    : 0;
  const historyCoverage = clients.length
    ? Math.round((clientsWithHistory / clients.length) * 100)
    : 0;
  const birthdayCoverage = clients.length
    ? Math.round((clientsWithBirthDate / clients.length) * 100)
    : 0;
  const dormantCoverage = clients.length
    ? Math.round((dormantClients / clients.length) * 100)
    : 0;
  const newClientsCoverage = clients.length
    ? Math.round((newClients / clients.length) * 100)
    : 0;

  const focusStage = spotlightClient ? getClientStage(spotlightClient) : null;
  const focusHref = spotlightClient
    ? buildFilterHref("/dashboard/gestao/clientes", searchParams, {
        clientId: spotlightClient.id,
      })
    : "#client-list";
  const openCreateHref = `${buildFilterHref("/dashboard/gestao/clientes", searchParams, {
    composer: "1",
  })}#client-create`;
  const closeCreateHref = buildFilterHref("/dashboard/gestao/clientes", searchParams, {
    composer: undefined,
  });
  const isSparsePortfolio = orderedClients.length <= 4;
  const clientGridClassName = `${styles.clientGrid} ${
    isSparsePortfolio ? styles.clientGridBalanced : ""
  }`;
  const createCard = (
    <article id="client-create" className={styles.createCard}>
      <div className={styles.sideCardHead}>
        <div>
          <span className={styles.sectionEyebrow}>Novo cliente</span>
          <h3>Cadastro rÃ¡pido para recepÃ§Ã£o</h3>
        </div>
        <span className={styles.cardMiniIcon}>
          <DashboardGlyph name="plus" />
        </span>
      </div>

      <AsyncActionForm
        action={createManagementClientAction}
        className={styles.formStack}
        resetOnSuccess
      >
        <input type="hidden" name="returnPath" value={closeCreateHref} />

        <div className={styles.field}>
          <label htmlFor="client-name">Nome</label>
          <input id="client-name" name="name" placeholder="Nome completo" required />
        </div>

        <div className={styles.splitGrid}>
          <div className={styles.field}>
            <label htmlFor="client-phone">Telefone</label>
            <input id="client-phone" name="phone" placeholder="(11) 99999-0000" />
          </div>

          <div className={styles.field}>
            <label htmlFor="client-email">E-mail</label>
            <input id="client-email" name="email" type="email" />
          </div>

          <div className={styles.field}>
            <label htmlFor="client-birthdate">Nascimento</label>
            <input id="client-birthdate" name="birthDate" type="date" />
          </div>
        </div>

        <div className={styles.field}>
          <label htmlFor="client-notes">ObservaÃ§Ãµes</label>
          <textarea
            id="client-notes"
            name="notes"
            rows={3}
            placeholder="PreferÃªncias, lembretes ou detalhes de atendimento."
          />
        </div>

        <div className={styles.createCardFooter}>
          <div className={styles.createHints}>
            <span>WhatsApp</span>
            <span>AniversÃ¡rio</span>
            <span>ObservaÃ§Ãµes</span>
          </div>

          <button type="submit" className="primary-button">
            Salvar cliente
          </button>
        </div>
      </AsyncActionForm>
    </article>
  );
  const renderSpotlightInsights = () => (
    <>
      <div className={styles.focusChart}>
        <div className={styles.focusChartTrack}>
          <span
            className={styles.focusChartPrimary}
            style={{ width: `${toVisualPercent(upcomingCoverage, 18)}%` }}
          />
        </div>
        <div className={styles.focusChartFooter}>
          <div>
            <strong>{clientsWithUpcoming}</strong>
            <span>Retorno ativo</span>
          </div>
          <div>
            <strong>{dormantClients}</strong>
            <span>Para reativar</span>
          </div>
        </div>
      </div>

      <div className={styles.focusStats}>
        <div>
          <span>PrÃ³ximos</span>
          <strong>{spotlightClient?.upcomingCount ?? 0}</strong>
        </div>
        <div>
          <span>ConcluÃ­dos</span>
          <strong>{spotlightClient?.completedCount ?? 0}</strong>
        </div>
        <div>
          <span>Ãšltima visita</span>
          <strong>
            {mostRecentClient?.lastVisitAt
              ? formatDateLabel(mostRecentClient.lastVisitAt, timeZone)
              : "Sem histÃ³rico"}
          </strong>
        </div>
      </div>
    </>
  );
  const renderPortfolioInsights = () => (
    <>
      <div className={styles.overviewChart}>
        <div className={styles.overviewTrack}>
          <span
            className={styles.overviewBarPrimary}
            style={{ width: `${toVisualPercent(historyCoverage, 16)}%` }}
          />
        </div>
        <div className={styles.overviewTrack}>
          <span
            className={styles.overviewBarSecondary}
            style={{ width: `${toVisualPercent(upcomingCoverage, 16)}%` }}
          />
        </div>
      </div>

      <div className={styles.sourceBars}>
        <div className={styles.sourceBarBlock}>
          <div
            className={`${styles.sourceBar} ${styles.sourceBarPrimary}`}
            style={{ width: `${toVisualPercent(historyCoverage, 18)}%` }}
          />
          <div className={styles.sourceMeta}>
            <strong>{clientsWithHistory}</strong>
            <span>Com histÃ³rico</span>
          </div>
        </div>

        <div className={styles.sourceBarBlock}>
          <div
            className={`${styles.sourceBar} ${styles.sourceBarWarm}`}
            style={{ width: `${toVisualPercent(dormantCoverage, 16)}%` }}
          />
          <div className={styles.sourceMeta}>
            <strong>{dormantClients}</strong>
            <span>ReativaÃ§Ã£o</span>
          </div>
        </div>

        <div className={styles.sourceBarBlock}>
          <div
            className={`${styles.sourceBar} ${styles.sourceBarCool}`}
            style={{ width: `${toVisualPercent(newClientsCoverage, 16)}%` }}
          />
          <div className={styles.sourceMeta}>
            <strong>{newClients}</strong>
            <span>Novos cadastros</span>
          </div>
        </div>
      </div>

      <div className={styles.coverageRow}>
        <span>{historyCoverage}% com histÃ³rico</span>
        <span>{upcomingCoverage}% com retorno</span>
        <span>{birthdayCoverage}% prontos para campanha</span>
      </div>

      <div className={styles.radarStats}>
        <div className={styles.radarRow}>
          <span>Ãšltima visita registrada</span>
          <strong>
            {mostRecentClient?.lastVisitAt
              ? formatDateLabel(mostRecentClient.lastVisitAt, timeZone)
              : "Sem histÃ³rico"}
          </strong>
        </div>
        <div className={styles.radarRow}>
          <span>Clientes fortes</span>
          <strong>{strongClients}</strong>
        </div>
        <div className={styles.radarRow}>
          <span>Atendimentos concluÃ­dos</span>
          <strong>{totalCompleted}</strong>
        </div>
      </div>
    </>
  );

  return (
    <AsyncActionNoticeRegion
      initialMessage={searchParams?.message}
      initialTone={searchParams?.tone}
    >
      <div className={styles.page}>
        <section className={styles.board}>
                    <section className={styles.hero}>
            <div className={styles.heroHeader}>
              <div className={styles.heroCopy}>
                <span className={styles.kicker}>Clientes</span>
                <h1>Clientes</h1>
                <p>Busque, abra a ficha e atualize o cadastro em uma tela so.</p>
              </div>

              <div className={styles.heroActions}>
                <Link
                  href={isCreateComposerOpen ? closeCreateHref : openCreateHref}
                  className={styles.heroPrimaryButton}
                >
                  <span className={styles.buttonIcon}>
                    <DashboardGlyph name="plus" />
                  </span>
                  {isCreateComposerOpen ? "Fechar cadastro" : "Novo cliente"}
                </Link>
              </div>
            </div>
          </section>

          <div className={styles.workspace}>
            <section className={styles.mainColumn}>
              <div className={styles.sectionHead}>
                <div>
                  <span className={styles.sectionEyebrow}>Clientes</span>
                  <h2>Lista de clientes</h2>
                </div>

                <div className={styles.sectionFilters}>
                  <span className={styles.filterPill}>
                    Busca: {query ? `"${query}"` : "toda a base"}
                  </span>
                  <span className={styles.filterPill}>Com historico: {clientsWithHistory}</span>
                  <span className={styles.filterPill}>Com retorno: {clientsWithUpcoming}</span>
                  {selectedClientId ? (
                    <Link href={clearHighlightHref} className={styles.filterAction}>
                      Limpar destaque
                    </Link>
                  ) : null}
                </div>
              </div>

              {!clients.length ? (
                <div className={styles.emptyStateWrap}>
                  <EmptyStateCard
                    eyebrow="Base vazia"
                    title="Cadastre o primeiro cliente"
                    description="Assim fica mais fÃ¡cil marcar horÃ¡rios, acompanhar histÃ³rico e organizar o relacionamento."
                  />
                </div>
              ) : (
                <div id="client-list" className={clientGridClassName}>
                  {orderedClients.map((client) => {
                    const stage = getClientStage(client);
                    const isHighlighted = client.id === selectedClientId;
                    const clientHref = buildFilterHref("/dashboard/gestao/clientes", searchParams, {
                      clientId: client.id,
                    });
                    const renderSecondarySnapshot = () => (
                      <>
                        <div className={styles.clientMetrics}>
                          <div>
                            <span>PrÃ³ximos</span>
                            <strong>{client.upcomingCount}</strong>
                          </div>
                          <div>
                            <span>ConcluÃ­dos</span>
                            <strong>{client.completedCount}</strong>
                          </div>
                          <div>
                            <span>Ãšltima visita</span>
                            <strong>
                              {client.lastVisitAt
                                ? formatDateLabel(client.lastVisitAt, timeZone)
                                : "Sem histÃ³rico"}
                            </strong>
                          </div>
                        </div>

                        <div className={styles.clientMeta}>
                          <span>
                            AniversÃ¡rio:{" "}
                            {client.birth_date
                              ? formatDateLabel(client.birth_date, timeZone)
                              : "nÃ£o informado"}
                          </span>
                          {isHighlighted ? <span>cliente em destaque</span> : null}
                        </div>

                        {client.notes ? (
                          <p className={styles.clientNote}>{client.notes}</p>
                        ) : null}
                      </>
                    );

                    return (
                      <article
                        key={client.id}
                        id={`client-card-${client.id}`}
                        className={`${styles.clientCard} ${
                          isHighlighted ? styles.clientCardHighlighted : ""
                        }`}
                      >
                        <div className={styles.clientCardBody}>
                          <div className={styles.clientCardTop}>
                            <div
                              className={`${styles.clientAvatarShell} ${getStageClass(
                                stage.tone,
                                styles,
                              )}`}
                            >
                              <div className={styles.avatarFrame}>
                                {client.profileImageUrl ? (
                                  <Image
                                    src={client.profileImageUrl}
                                    alt={`Foto de ${client.name}`}
                                    width={92}
                                    height={92}
                                    unoptimized
                                    className={styles.clientAvatar}
                                  />
                                ) : (
                                  <div
                                    className={`${styles.clientAvatar} ${styles.clientAvatarPlaceholder}`}
                                  >
                                    {customerInitials(client.name)}
                                  </div>
                                )}
                              </div>
                            </div>

                            <div className={styles.clientCardActions}>
                              <span
                                className={`${styles.stageBadge} ${getStageClass(
                                  stage.tone,
                                  styles,
                                )}`}
                              >
                                {stage.label}
                              </span>
                              <Link href={clientHref} className={styles.cardAction}>
                                {isHighlighted ? "Em foco" : "Abrir ficha"}
                              </Link>
                            </div>
                          </div>

                          <div className={styles.clientIdentity}>
                            <strong>{client.name}</strong>
                            <p>{formatLifecycleCopy(client)}</p>
                            <span className={styles.clientContact}>
                              {formatPrimaryContact(client)}
                            </span>
                            <small>
                              {client.profileImageUrl
                                ? "Foto enviada pela cliente no app."
                                : "Sem foto enviada pela cliente."}
                            </small>
                          </div>

                          <div className={styles.clientCardSecondaryDesktop}>
                            {renderSecondarySnapshot()}
                          </div>

                          <details className={styles.clientMobileDetails}>
                            <summary className={styles.clientMobileSummary}>
                              Ver resumo
                            </summary>
                            <div className={styles.clientMobileBody}>
                              {renderSecondarySnapshot()}
                            </div>
                          </details>
                        </div>

                        <details
                          className={styles.clientDetails}
                          open={client.id === selectedClientId}
                        >
                          <summary>Editar cliente</summary>

                          <div className={styles.detailsBody}>
                            <AsyncActionForm
                              action={updateManagementClientAction}
                              className={styles.formStack}
                            >
                              <input type="hidden" name="returnPath" value={currentPath} />
                              <input type="hidden" name="clientId" value={client.id} />

                              <div className={styles.field}>
                                <label htmlFor={`client-name-${client.id}`}>Nome</label>
                                <input
                                  id={`client-name-${client.id}`}
                                  name="name"
                                  defaultValue={client.name}
                                  required
                                />
                              </div>

                              <div className={styles.splitGrid}>
                                <div className={styles.field}>
                                  <label htmlFor={`client-phone-${client.id}`}>Telefone</label>
                                  <input
                                    id={`client-phone-${client.id}`}
                                    name="phone"
                                    defaultValue={client.phone ?? ""}
                                  />
                                </div>

                                <div className={styles.field}>
                                  <label htmlFor={`client-email-${client.id}`}>E-mail</label>
                                  <input
                                    id={`client-email-${client.id}`}
                                    name="email"
                                    type="email"
                                    defaultValue={client.email ?? ""}
                                  />
                                </div>

                                <div className={styles.field}>
                                  <label htmlFor={`client-birth-${client.id}`}>Nascimento</label>
                                  <input
                                    id={`client-birth-${client.id}`}
                                    name="birthDate"
                                    type="date"
                                    defaultValue={client.birth_date ?? ""}
                                  />
                                </div>
                              </div>

                              <div className={styles.field}>
                                <label htmlFor={`client-notes-${client.id}`}>ObservaÃ§Ãµes</label>
                                <textarea
                                  id={`client-notes-${client.id}`}
                                  name="notes"
                                  rows={3}
                                  defaultValue={client.notes ?? ""}
                                />
                              </div>

                              <div className={styles.inlineActions}>
                                <button type="submit" className="primary-button">
                                  Salvar alteraÃ§Ãµes
                                </button>
                              </div>
                            </AsyncActionForm>

                            <div className={styles.historyBlock}>
                              <strong>HistÃ³rico recente</strong>
                              {!client.history.length ? (
                                <p>Nenhum atendimento concluÃ­do ainda.</p>
                              ) : (
                                <div className={styles.historyList}>
                                  {client.history.map((entry) => (
                                    <div key={entry.id} className={styles.historyRow}>
                                      <div>
                                        <strong>{entry.serviceName}</strong>
                                        <span>
                                          {entry.professionalName} â€¢{" "}
                                          {formatDateLabel(entry.date, timeZone)}
                                        </span>
                                      </div>
                                      <span className={styles.historyBadge}>
                                        {entry.status === "completed" ? "ConcluÃ­do" : entry.status}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <AsyncActionForm action={deleteManagementClientAction}>
                              <input type="hidden" name="returnPath" value={currentPath} />
                              <input type="hidden" name="clientId" value={client.id} />
                              <button type="submit" className="danger-button">
                                Excluir cliente
                              </button>
                            </AsyncActionForm>
                          </div>
                        </details>
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

                        <aside className={styles.sideColumn}>
              <article
                id="client-search"
                className={`${styles.sideCard} ${styles.sideSearchCard}`}
              >
                  <div className={styles.sideCardHead}>
                    <div>
                      <span className={styles.sectionEyebrow}>Busca</span>
                      <h3>Busca rapida</h3>
                    </div>
                  <span className={styles.cardMiniIcon}>
                    <DashboardGlyph name="search" />
                  </span>
                </div>

                <form method="get" className={styles.formStack}>
                  <div className={styles.field}>
                    <label htmlFor="clients-search">Nome, telefone ou e-mail</label>
                    <input
                      id="clients-search"
                      name="q"
                      defaultValue={query}
                      placeholder="Ex.: Ana ou 11999990000"
                    />
                  </div>

                  <div className={styles.inlineActions}>
                    <button type="submit" className="secondary-button">
                      Buscar
                    </button>
                    <Link href={clearFiltersHref} className="secondary-button">
                      Limpar
                    </Link>
                  </div>
                </form>
              </article>

              {isCreateComposerOpen ? createCard : null}
            </aside>
          </div>
        </section>
      </div>
    </AsyncActionNoticeRegion>
  );
}

