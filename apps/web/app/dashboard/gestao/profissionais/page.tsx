import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import {
  createManagementProfessionalAction,
  deleteManagementProfessionalAction,
  updateManagementProfessionalAction,
} from "@/app/_actions/management";
import { requireOwnerSalon } from "@/lib/auth";
import {
  buildFilterHref,
  loadManagementProfessionals,
} from "@/lib/management";
import { formatCurrency } from "@/lib/formatters";

type ManagementProfessional =
  Awaited<ReturnType<typeof loadManagementProfessionals>>[number];

type ProfissionaisPageProps = {
  searchParams?: Promise<{
    message?: string;
    showHistory?: string;
    tone?: string;
  }>;
};

function ProfessionalCard({
  currentPath,
  professional,
}: {
  currentPath: string;
  professional: ManagementProfessional;
}) {
  return (
    <article key={professional.id} className="management-professional-card">
      <div className="management-professional-card__header">
        <div>
          <strong>{professional.name}</strong>
          <p className="muted">
            {[professional.role, professional.phone].filter(Boolean).join(" • ") ||
              "Sem detalhe adicional"}
          </p>
        </div>
        <span
          className={`badge ${
            professional.is_active ? "badge--confirmed" : "badge--cancelled"
          }`}
        >
          {professional.is_active ? "Ativo" : "Fora da equipe"}
        </span>
      </div>

      <div className="management-professional-card__meta">
        <span>{professional.upcomingCount} próximo(s)</span>
        <span>{professional.completedCount} concluído(s)</span>
        <span>{formatCurrency(professional.totalSold)} vendidos</span>
        <span>{formatCurrency(professional.commissionProjected)} comissão</span>
      </div>

      {!professional.is_active ? (
        <p className="management-inline-note">
          Esse profissional saiu da equipe ativa. O histórico ficou salvo e ele
          pode ser reativado se voltar ao salão.
        </p>
      ) : null}

      <details className="management-details">
        <summary>
          {professional.is_active ? "Editar profissional" : "Ver profissional"}
        </summary>

        <form action={updateManagementProfessionalAction} className="simple-form">
          <input type="hidden" name="returnPath" value={currentPath} />
          <input type="hidden" name="professionalId" value={professional.id} />

          <div className="field">
            <label>Nome</label>
            <input name="name" defaultValue={professional.name} required />
          </div>

          <div className="split-grid">
            <div className="field">
              <label>Especialidade</label>
              <input name="specialty" defaultValue={professional.role ?? ""} />
            </div>
            <div className="field">
              <label>Telefone</label>
              <input name="phone" defaultValue={professional.phone ?? ""} />
            </div>
          </div>

          <div className="split-grid">
            <div className="field">
              <label>Comissão (%)</label>
              <input
                name="commissionRatePercent"
                type="number"
                min="0"
                max="100"
                step="0.1"
                defaultValue={Number(professional.commission_rate_percent ?? 0)}
                required
              />
            </div>
            <label className="checkbox-field">
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={professional.is_active}
              />
              <span>Profissional ativo</span>
            </label>
          </div>

          <div className="inline-actions">
            <button type="submit" className="primary-button">
              {professional.is_active ? "Salvar alterações" : "Salvar e reativar"}
            </button>
          </div>
        </form>

        {professional.is_active ? (
          <form action={deleteManagementProfessionalAction}>
            <input type="hidden" name="returnPath" value={currentPath} />
            <input type="hidden" name="professionalId" value={professional.id} />
            <p className="management-inline-note">
              Se esse profissional ainda tiver agenda, o sistema tira ele da
              equipe ativa, reserva o cliente com o melhor nome disponível e
              envia um pedido de confirmação ao cliente.
            </p>
            <button type="submit" className="danger-button">
              Remover da equipe
            </button>
          </form>
        ) : null}
      </details>
    </article>
  );
}

export default async function ProfissionaisPage({
  searchParams: searchParamsPromise,
}: ProfissionaisPageProps) {
  const searchParams = await searchParamsPromise;
  const { salon } = await requireOwnerSalon();
  const showHistory = searchParams?.showHistory === "1";
  const currentPath = buildFilterHref(
    "/dashboard/gestao/profissionais",
    searchParams,
    {},
  );
  const historyToggleHref = buildFilterHref(
    "/dashboard/gestao/profissionais",
    searchParams,
    {
      showHistory: showHistory ? undefined : "1",
    },
  );
  const professionals = await loadManagementProfessionals(salon.id);
  const activeProfessionals = professionals.filter((professional) => professional.is_active);
  const inactiveProfessionals = professionals.filter((professional) => !professional.is_active);
  const totalUpcoming = professionals.reduce((total, item) => total + item.upcomingCount, 0);
  const totalCompleted = professionals.reduce((total, item) => total + item.completedCount, 0);
  const totalSold = professionals.reduce((total, item) => total + item.totalSold, 0);
  const totalCommission = professionals.reduce(
    (total, item) => total + item.commissionProjected,
    0,
  );
  const averageCommissionRate = activeProfessionals.length
    ? activeProfessionals.reduce(
        (total, item) => total + Number(item.commission_rate_percent ?? 0),
        0,
      ) / activeProfessionals.length
    : 0;
  const spotlightProfessional =
    [...professionals].sort((left, right) => {
      if (right.totalSold !== left.totalSold) {
        return right.totalSold - left.totalSold;
      }

      if (right.upcomingCount !== left.upcomingCount) {
        return right.upcomingCount - left.upcomingCount;
      }

      return left.name.localeCompare(right.name, "pt-BR");
    })[0] ?? null;

  return (
    <div className="page-grid workspace-page management-page management-page--professionals">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        id="professionals-overview"
        eyebrow="Equipe do salão"
        title="Profissionais alinhados com agenda, venda e comissão."
        description="Cadastre, acompanhe produtividade e leia a força da equipe sem sair da operação."
        highlight={{
          label: "Equipe ativa",
          value: `${activeProfessionals.length} profissional${activeProfessionals.length === 1 ? "" : "is"} ativo${activeProfessionals.length === 1 ? "" : "s"}`,
          note: professionals.length
            ? `${totalUpcoming} próximo(s) horário(s), ${formatCurrency(totalSold)} vendidos e ${formatCurrency(totalCommission)} de comissão projetada.`
            : "Cadastre o primeiro profissional para liberar escala e agenda no salão.",
        }}
        signals={[
          {
            label: "Inativos",
            value: inactiveProfessionals.length,
            tone: inactiveProfessionals.length ? "warm" : "success",
          },
          {
            label: "Agenda da equipe",
            value: totalUpcoming,
            tone: totalUpcoming ? "accent" : "soft",
          },
          {
            label: "Comissão média",
            value: activeProfessionals.length ? `${averageCommissionRate.toFixed(1)}%` : "Sem base",
            tone: activeProfessionals.length ? "soft" : "neutral",
          },
        ]}
        stats={[
          {
            label: "Equipe cadastrada",
            value: professionals.length,
            note: "Profissionais no salão.",
            tone: professionals.length ? "soft" : "neutral",
          },
          {
            label: "Atendimentos concluídos",
            value: totalCompleted,
            note: "Histórico recente da equipe.",
            tone: totalCompleted ? "success" : "soft",
          },
          {
            label: "Comissão projetada",
            value: formatCurrency(totalCommission),
            note: "Leitura do período recente.",
            tone: totalCommission ? "warm" : "soft",
          },
          {
            label: "Profissional forte",
            value: spotlightProfessional?.name ?? "Sem leitura",
            note: spotlightProfessional
              ? `${formatCurrency(spotlightProfessional.totalSold)} vendidos e ${spotlightProfessional.upcomingCount} próximo(s).`
              : "A produtividade da equipe aparece aqui quando houver histórico.",
            tone: spotlightProfessional ? "accent" : "soft",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#professional-create" className="primary-button">
              Novo profissional
            </a>
            <a href="#professional-list" className="secondary-button">
              Ver equipe
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Profissional em foco</span>
            <h3>{spotlightProfessional?.name ?? "Monte a primeira escala"}</h3>
            <p>
              {spotlightProfessional
                ? `${spotlightProfessional.role ?? "Sem especialidade"} com ${formatCurrency(spotlightProfessional.totalSold)} vendidos e ${formatCurrency(spotlightProfessional.commissionProjected)} de comissão projetada.`
                : "Assim que a equipe começar a vender e atender, o destaque aparece aqui."}
            </p>
            <div className="management-hero-pill-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Próximos horários</span>
                <strong>{spotlightProfessional?.upcomingCount ?? 0}</strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Comissão</span>
                <strong>
                  {spotlightProfessional
                    ? `${Number(spotlightProfessional.commission_rate_percent ?? 0).toFixed(1)}%`
                    : "Sem base"}
                </strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos da equipe"
        items={[
          { href: "#professional-create", label: "Novo profissional", meta: "Cadastro e comissão" },
          { href: "#professional-summary", label: "Resumo", meta: "Força da equipe" },
          { href: "#professional-list", label: "Equipe", meta: "Editar e revisar" },
        ]}
      />

      <section
        id="professional-summary"
        className="workspace-subgrid management-summary-grid"
        aria-label="Resumo da equipe"
      >
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Escala ativa</span>
          <h3>{activeProfessionals.length} profissional(is) pronto(s) para agenda</h3>
          <p>
            {inactiveProfessionals.length
              ? `${inactiveProfessionals.length} item(ns) da equipe está(ão) pausado(s) e merece(m) revisão.`
              : "Toda a equipe cadastrada está ativa e pronta para receber horários."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Venda recente</span>
          <h3>{formatCurrency(totalSold)} vendidos pela equipe</h3>
          <p>
            {spotlightProfessional
              ? `${spotlightProfessional.name} lidera a leitura atual da equipe.`
              : "Quando houver histórico de vendas, o destaque da equipe aparece aqui."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Comissão em jogo</span>
          <h3>{formatCurrency(totalCommission)} de comissão projetada</h3>
          <p>
            {activeProfessionals.length
              ? `A média ativa está em ${averageCommissionRate.toFixed(1)}% por profissional.`
              : "Cadastre profissionais e configure a comissão para formar essa leitura."}
          </p>
        </article>
      </section>

      <section className="management-grid management-grid--two">
        <article id="professional-create" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Novo profissional</h2>
              <p className="muted">Cadastro simples com comissão e contato.</p>
            </div>
          </div>

          <form action={createManagementProfessionalAction} className="simple-form">
            <input type="hidden" name="returnPath" value={currentPath} />

            <div className="field">
              <label htmlFor="professional-name">Nome</label>
              <input id="professional-name" name="name" required />
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="professional-specialty">Especialidade</label>
                <input
                  id="professional-specialty"
                  name="specialty"
                  placeholder="Ex.: Cabeleireira"
                />
              </div>
              <div className="field">
                <label htmlFor="professional-phone">Telefone</label>
                <input id="professional-phone" name="phone" />
              </div>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="professional-commission">Comissão (%)</label>
                <input
                  id="professional-commission"
                  name="commissionRatePercent"
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  defaultValue="30"
                  required
                />
              </div>

              <label className="checkbox-field">
                <input type="checkbox" name="isActive" defaultChecked />
                <span>Profissional ativo</span>
              </label>
            </div>

            <button type="submit" className="primary-button">
              Salvar profissional
            </button>
          </form>
        </article>

        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Resumo rápido</h2>
              <p className="muted">Visão de agenda, vendas e comissão projetada.</p>
            </div>
          </div>

          <div className="management-list">
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{professionals.filter((item) => item.is_active).length}</strong>
                <span>profissionais ativos</span>
              </div>
            </div>
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{professionals.reduce((total, item) => total + item.upcomingCount, 0)}</strong>
                <span>próximos horários vinculados à equipe</span>
              </div>
            </div>
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>
                  {formatCurrency(
                    professionals.reduce(
                      (total, item) => total + item.commissionProjected,
                      0,
                    ),
                  )}
                </strong>
                <span>comissão projetada no histórico recente</span>
              </div>
            </div>
          </div>

          <p className="management-inline-note">
            Ao remover um profissional com agenda, o painel preserva o histórico,
            tenta remanejar cada cliente para quem mais atende no salão e pede
            confirmação do novo profissional ou do novo horário.
          </p>
        </article>
      </section>

      <section id="professional-list" className="card content-card management-card">
        <div className="section-heading">
          <div>
            <h2>Equipe ativa</h2>
            <p className="muted">
              {activeProfessionals.length
                ? `${activeProfessionals.length} profissional(is) disponível(is) na agenda`
                : "Nenhum profissional ativo no momento"}
            </p>
          </div>
          {inactiveProfessionals.length ? (
            <a href={historyToggleHref} className="secondary-button">
              {showHistory
                ? "Ocultar histórico"
                : `Ver histórico da equipe (${inactiveProfessionals.length})`}
            </a>
          ) : null}
        </div>

        {!activeProfessionals.length ? (
          <EmptyStateCard
            eyebrow="Equipe ativa vazia"
            title={
              inactiveProfessionals.length
                ? "Só restou o histórico da equipe"
                : "Cadastre o primeiro profissional"
            }
            description={
              inactiveProfessionals.length
                ? "Os profissionais antigos continuam guardados abaixo para preservar agenda, comissão e histórico."
                : "A agenda precisa de profissionais ativos para receber novos horários."
            }
          />
        ) : (
          <div className="management-professional-list">
            {activeProfessionals.map((professional) => (
              <ProfessionalCard
                key={professional.id}
                currentPath={currentPath}
                professional={professional}
              />
            ))}
          </div>
        )}

        {inactiveProfessionals.length && !showHistory ? (
          <p className="management-inline-note">
            Quem saiu da equipe fica fora da lista principal. O histórico só
            aparece quando você pedir, para o painel continuar organizado.
          </p>
        ) : null}
      </section>

      {inactiveProfessionals.length && showHistory ? (
        <section className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Histórico da equipe</h2>
              <p className="muted">
                {inactiveProfessionals.length} profissional(is) fora da agenda
                ativa, com histórico preservado.
              </p>
            </div>
          </div>

          <p className="management-inline-note">
            Esses profissionais não aparecem mais como equipe ativa do salão.
            Eles ficam aqui só para preservar comissão, atendimentos antigos e
            permitir reativação futura.
          </p>

          <div className="management-professional-list">
            {inactiveProfessionals.map((professional) => (
              <ProfessionalCard
                key={professional.id}
                currentPath={currentPath}
                professional={professional}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
