import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
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
    message?: string;
    tone?: string;
  }>;
};

export default async function ClientesPage({
  searchParams: searchParamsPromise,
}: ClientesPageProps) {
  const searchParams = await searchParamsPromise;
  const { salon } = await requireOwnerSalon();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const query = searchParams?.q?.trim() ?? "";
  const selectedClientId = searchParams?.clientId?.trim() ?? "";
  const currentPath = buildFilterHref("/dashboard/gestao/clientes", searchParams, {});
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
  const clientsWithWhatsapp = clients.filter((client) => Boolean(client.whatsapp_phone?.trim())).length;
  const clientsWithUpcoming = clients.filter((client) => client.upcomingCount > 0).length;
  const clientsWithHistory = clients.filter((client) => client.completedCount > 0).length;
  const clientsWithBirthDate = clients.filter((client) => Boolean(client.birth_date)).length;
  const totalUpcoming = clients.reduce((sum, client) => sum + client.upcomingCount, 0);
  const totalCompleted = clients.reduce((sum, client) => sum + client.completedCount, 0);
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
    })[0] ??
    null;
  const mostRecentClient =
    [...clients]
      .filter((client) => Boolean(client.lastVisitAt))
      .sort((left, right) => (right.lastVisitAt ?? "").localeCompare(left.lastVisitAt ?? ""))[0] ?? null;

  return (
    <div className="page-grid workspace-page management-page management-page--clients">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        id="clients-overview"
        eyebrow="Carteira do salão"
        title="Clientes em ordem para atender e reativar."
        description="Cadastro rápido, busca limpa e histórico útil para recepção e relacionamento."
        highlight={{
          label: "Base de clientes",
          value: `${clients.length} cliente${clients.length === 1 ? "" : "s"}`,
          note: clients.length
            ? `${clientsWithUpcoming} com retorno previsto e ${totalCompleted} atendimento${totalCompleted === 1 ? "" : "s"} concluído${totalCompleted === 1 ? "" : "s"} no histórico.`
            : "Assim que a recepção começar a cadastrar clientes, a carteira aparece aqui.",
        }}
        signals={[
          {
            label: "Com WhatsApp",
            value: clientsWithWhatsapp,
            tone: clientsWithWhatsapp ? "success" : "soft",
          },
          {
            label: "Com retorno",
            value: clientsWithUpcoming,
            tone: clientsWithUpcoming ? "accent" : "soft",
          },
          {
            label: "Com histórico",
            value: clientsWithHistory,
            tone: clientsWithHistory ? "warm" : "soft",
          },
        ]}
        stats={[
          {
            label: "Próximos agendamentos",
            value: totalUpcoming,
            note: "Clientes com hora marcada.",
            tone: totalUpcoming ? "accent" : "soft",
          },
          {
            label: "Atendimentos concluídos",
            value: totalCompleted,
            note: "Histórico já registrado.",
            tone: totalCompleted ? "success" : "soft",
          },
          {
            label: "Aniversários com data",
            value: clientsWithBirthDate,
            note: "Base pronta para campanhas.",
            tone: clientsWithBirthDate ? "warm" : "soft",
          },
          {
            label: "Cliente forte",
            value: spotlightClient?.name ?? "Sem destaque",
            note: spotlightClient
              ? `${spotlightClient.upcomingCount} próximo(s) e ${spotlightClient.completedCount} concluído(s).`
              : "Cadastre e atenda para formar histórico.",
            tone: spotlightClient ? "soft" : "neutral",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#client-create" className="primary-button">
              Novo cliente
            </a>
            <a href="#client-list" className="secondary-button">
              Ver carteira
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Cliente em foco</span>
            <h3>{spotlightClient?.name ?? "Base pronta para crescer"}</h3>
            <p>
              {spotlightClient
                ? `${spotlightClient.completedCount} atendimento${spotlightClient.completedCount === 1 ? "" : "s"} concluído${spotlightClient.completedCount === 1 ? "" : "s"} e ${spotlightClient.upcomingCount} próximo${spotlightClient.upcomingCount === 1 ? "" : "s"} horário${spotlightClient.upcomingCount === 1 ? "" : "s"} nesta carteira.`
                : "Quando a base ganhar histórico, o cliente com maior movimento aparece aqui."}
            </p>
            <div className="management-hero-pill-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Última visita</span>
                <strong>
                  {mostRecentClient?.lastVisitAt
                    ? formatDateLabel(mostRecentClient.lastVisitAt, timeZone)
                    : "Sem histórico"}
                </strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Contato forte</span>
                <strong>
                  {spotlightClient?.whatsapp_phone ||
                    spotlightClient?.phone ||
                    spotlightClient?.email ||
                    "Atualize contato"}
                </strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos da carteira"
        items={[
          { href: "#client-create", label: "Novo cliente", meta: "Cadastro rápido" },
          { href: "#client-search", label: "Buscar", meta: "Nome, telefone ou e-mail" },
          { href: "#client-list", label: "Carteira", meta: "Histórico e edição" },
        ]}
      />

      <section className="workspace-subgrid management-summary-grid" aria-label="Resumo da carteira">
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Relacionamento</span>
          <h3>{clientsWithWhatsapp} contato{clientsWithWhatsapp === 1 ? "" : "s"} com WhatsApp</h3>
          <p>
            {clientsWithWhatsapp
              ? "A base já tem canal direto para lembrete, retorno e campanhas."
              : "Preencha o WhatsApp dos clientes para abrir comunicação rápida com a carteira."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Retorno em aberto</span>
          <h3>{clientsWithUpcoming} cliente{clientsWithUpcoming === 1 ? "" : "s"} com visita marcada</h3>
          <p>
            {spotlightClient?.upcomingCount
              ? `${spotlightClient.name} já aparece com ${spotlightClient.upcomingCount} próximo(s) horário(s).`
              : "Assim que a agenda girar, os retornos aparecem aqui para leitura rápida."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Histórico útil</span>
          <h3>{clientsWithHistory} cliente{clientsWithHistory === 1 ? "" : "s"} com atendimentos concluídos</h3>
          <p>
            {mostRecentClient?.lastVisitAt
              ? `A última visita registrada foi em ${formatDateLabel(mostRecentClient.lastVisitAt, timeZone)}.`
              : "Sem histórico ainda. Os atendimentos concluídos alimentam esta leitura automaticamente."}
          </p>
        </article>
      </section>

      <section className="management-grid management-grid--two">
        <article id="client-create" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Novo cliente</h2>
              <p className="muted">Cadastro curto com dados úteis para recepção.</p>
            </div>
          </div>

          <form action={createManagementClientAction} className="simple-form">
            <input type="hidden" name="returnPath" value={currentPath} />

            <div className="field">
              <label htmlFor="client-name">Nome</label>
              <input id="client-name" name="name" placeholder="Nome completo" required />
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="client-phone">Telefone</label>
                <input id="client-phone" name="phone" placeholder="(11) 99999-0000" />
              </div>
              <div className="field">
                <label htmlFor="client-whatsapp">WhatsApp</label>
                <input
                  id="client-whatsapp"
                  name="whatsappPhone"
                  placeholder="(11) 99999-0000"
                />
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="client-email">E-mail</label>
                <input id="client-email" name="email" type="email" />
              </div>
              <div className="field">
                <label htmlFor="client-birthdate">Nascimento</label>
                <input id="client-birthdate" name="birthDate" type="date" />
              </div>
            </div>

            <div className="field">
              <label htmlFor="client-notes">Observações</label>
              <textarea
                id="client-notes"
                name="notes"
                rows={3}
                placeholder="Preferências, lembretes ou detalhes de atendimento."
              />
            </div>

            <button type="submit" className="primary-button">
              Salvar cliente
            </button>
          </form>
        </article>

        <article id="client-search" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Busca rápida</h2>
              <p className="muted">Localize por nome, telefone, WhatsApp ou e-mail.</p>
            </div>
          </div>

          <form method="get" className="simple-form">
            <div className="field">
              <label htmlFor="clients-search">Buscar cliente</label>
              <input
                id="clients-search"
                name="q"
                defaultValue={query}
                placeholder="Ex.: Ana ou 11999990000"
              />
            </div>

            <div className="inline-actions">
              <button type="submit" className="secondary-button">
                Buscar
              </button>
              <a href="/dashboard/gestao/clientes" className="secondary-button">
                Limpar
              </a>
            </div>
          </form>
        </article>
      </section>

      <section id="client-list" className="card content-card management-card">
        <div className="section-heading">
          <div>
            <h2>Clientes cadastrados</h2>
            <p className="muted">
              {clients.length
                ? `${clients.length} cliente(s) encontrados`
                : "Nenhum cliente cadastrado ainda"}
            </p>
          </div>
        </div>

        {!clients.length ? (
          <EmptyStateCard
            eyebrow="Base vazia"
            title="Cadastre o primeiro cliente"
            description="Assim fica mais fácil marcar horários e acompanhar o histórico."
          />
        ) : (
          <div className="management-customer-list">
              {orderedClients.map((client) => (
              <article key={client.id} className="management-customer-card">
                <div className="management-customer-card__header">
                  <div>
                    <strong>{client.name}</strong>
                    <p className="muted">
                      {[client.phone, client.whatsapp_phone, client.email]
                        .filter(Boolean)
                        .join(" • ") || "Sem contato principal informado"}
                    </p>
                  </div>
                  <div className="management-customer-card__metrics">
                    {client.id === selectedClientId ? <span>em destaque</span> : null}
                    <span>{client.upcomingCount} próximo(s)</span>
                    <span>{client.completedCount} concluído(s)</span>
                  </div>
                </div>

                <div className="management-customer-card__meta">
                  <span>
                    Última visita:{" "}
                    {client.lastVisitAt
                      ? formatDateLabel(client.lastVisitAt, timeZone)
                      : "sem histórico"}
                  </span>
                  <span>
                    Nascimento:{" "}
                    {client.birth_date
                      ? formatDateLabel(client.birth_date, timeZone)
                      : "não informado"}
                  </span>
                </div>

                {client.notes ? (
                  <p className="management-inline-note">{client.notes}</p>
                ) : null}

                <details
                  className="management-details"
                  open={client.id === selectedClientId}
                >
                  <summary>Editar cadastro e ver histórico</summary>

                  <form action={updateManagementClientAction} className="simple-form">
                    <input type="hidden" name="returnPath" value={currentPath} />
                    <input type="hidden" name="clientId" value={client.id} />

                    <div className="field">
                      <label>Nome</label>
                      <input name="name" defaultValue={client.name} required />
                    </div>

                    <div className="split-grid">
                      <div className="field">
                        <label>Telefone</label>
                        <input name="phone" defaultValue={client.phone ?? ""} />
                      </div>
                      <div className="field">
                        <label>WhatsApp</label>
                        <input
                          name="whatsappPhone"
                          defaultValue={client.whatsapp_phone ?? ""}
                        />
                      </div>
                    </div>

                    <div className="split-grid">
                      <div className="field">
                        <label>E-mail</label>
                        <input
                          name="email"
                          type="email"
                          defaultValue={client.email ?? ""}
                        />
                      </div>
                      <div className="field">
                        <label>Nascimento</label>
                        <input
                          name="birthDate"
                          type="date"
                          defaultValue={client.birth_date ?? ""}
                        />
                      </div>
                    </div>

                    <div className="field">
                      <label>Observações</label>
                      <textarea
                        name="notes"
                        rows={3}
                        defaultValue={client.notes ?? ""}
                      />
                    </div>

                    <div className="inline-actions">
                      <button type="submit" className="primary-button">
                        Salvar alterações
                      </button>
                    </div>
                  </form>

                  <div className="management-history">
                    <strong>Histórico recente</strong>
                    {!client.history.length ? (
                      <p className="muted">Nenhum atendimento concluído ainda.</p>
                    ) : (
                      <div className="management-list">
                        {client.history.map((entry) => (
                          <div key={entry.id} className="management-list-row">
                            <div className="management-list-row__main">
                              <strong>{entry.serviceName}</strong>
                              <span>
                                {entry.professionalName} •{" "}
                                {formatDateLabel(entry.date, timeZone)}
                              </span>
                            </div>
                            <span className="badge badge--soft">
                              {entry.status === "completed" ? "Concluído" : entry.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <form action={deleteManagementClientAction}>
                    <input type="hidden" name="returnPath" value={currentPath} />
                    <input type="hidden" name="clientId" value={client.id} />
                    <button type="submit" className="danger-button">
                      Excluir cliente
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
