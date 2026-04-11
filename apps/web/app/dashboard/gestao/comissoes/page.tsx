import { DashboardWorkspaceHero } from "@/components/DashboardWorkspaceHero";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { WorkspaceSectionNav } from "@/components/WorkspaceSectionNav";
import { requireOwnerSalon } from "@/lib/auth";
import {
  getLocalDateKey,
  loadManagementCommissions,
  loadManagementSelectOptions,
} from "@/lib/management";
import { formatCurrency } from "@/lib/formatters";

type ComissoesPageProps = {
  searchParams?: {
    professionalId?: string;
    dateFrom?: string;
    dateTo?: string;
    message?: string;
    tone?: string;
  };
};

export default async function ComissoesPage({
  searchParams,
}: ComissoesPageProps) {
  const { salon } = await requireOwnerSalon();
  const timeZone = salon.timezone ?? "America/Sao_Paulo";
  const todayKey = getLocalDateKey(new Date(), timeZone);
  const monthStart = `${todayKey.slice(0, 8)}01`;
  const professionalId = searchParams?.professionalId ?? "";
  const dateFrom = searchParams?.dateFrom ?? monthStart;
  const dateTo = searchParams?.dateTo ?? todayKey;

  const [items, options] = await Promise.all([
    loadManagementCommissions({
      salonId: salon.id,
      timeZone,
      professionalId: professionalId || undefined,
      dateFrom,
      dateTo,
    }),
    loadManagementSelectOptions(salon.id),
  ]);

  const totalSold = items.reduce((total, item) => total + item.totalSold, 0);
  const totalCommission = items.reduce(
    (total, item) => total + item.commissionAmount,
    0,
  );
  const totalAppointments = items.reduce(
    (total, item) => total + item.appointmentsCount,
    0,
  );
  const averageCommission = items.length ? totalCommission / items.length : 0;
  const leadingProfessional = items[0] ?? null;
  const selectedProfessionalLabel =
    professionalId
      ? options.professionals.find((item) => item.id === professionalId)?.label ?? "Profissional"
      : "Todos";
  const periodLabel = dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`;

  return (
    <div className="page-grid workspace-page management-page management-page--commissions">
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <DashboardWorkspaceHero
        id="commissions-overview"
        eyebrow="Repasse"
        title="Repasse claro para fechar o mês sem ruído."
        description="Leitura do período, filtro por profissional e visão rápida do valor projetado da equipe."
        highlight={{
          label: "Comissão calculada",
          value: formatCurrency(totalCommission),
          note: items.length
            ? `${formatCurrency(totalSold)} vendidos em ${totalAppointments} atendimento(s) concluído(s).`
            : "Sem comissão no recorte atual. Ajuste o período ou aguarde atendimentos concluídos.",
        }}
        signals={[
          {
            label: "Período",
            value: periodLabel,
            tone: "soft",
          },
          {
            label: "Profissional",
            value: selectedProfessionalLabel,
            tone: professionalId ? "accent" : "soft",
          },
          {
            label: "Linhas",
            value: items.length,
            tone: items.length ? "success" : "soft",
          },
        ]}
        stats={[
          {
            label: "Total vendido",
            value: formatCurrency(totalSold),
            note: "Base do cálculo atual.",
            tone: totalSold ? "accent" : "soft",
          },
          {
            label: "Atendimentos",
            value: totalAppointments,
            note: "Só concluídos entram aqui.",
            tone: totalAppointments ? "success" : "soft",
          },
          {
            label: "Comissão média",
            value: items.length ? formatCurrency(averageCommission) : "Sem base",
            note: "Média por profissional no período.",
            tone: items.length ? "warm" : "soft",
          },
          {
            label: "Maior comissão",
            value: leadingProfessional?.professionalName ?? "Sem destaque",
            note: leadingProfessional
              ? `${formatCurrency(leadingProfessional.commissionAmount)} calculados.`
              : "O topo aparece quando houver comissão no recorte.",
            tone: leadingProfessional ? "soft" : "neutral",
          },
        ]}
        actions={
          <div className="row-actions">
            <a href="#commission-filters" className="primary-button">
              Ajustar filtro
            </a>
            <a href="#commission-list" className="secondary-button">
              Ver comissão
            </a>
          </div>
        }
        aside={
          <>
            <span className="workspace-panel__eyebrow">Profissional em foco</span>
            <h3>{leadingProfessional?.professionalName ?? "Sem liderança no recorte"}</h3>
            <p>
              {leadingProfessional
                ? `${leadingProfessional.commissionRate.toFixed(1)}% de taxa com ${formatCurrency(leadingProfessional.totalSold)} vendidos e ${leadingProfessional.appointmentsCount} atendimento(s).`
                : "Assim que o período tiver atendimento concluído, o destaque aparece aqui."}
            </p>
            <div className="management-hero-pill-grid">
              <div className="workspace-signal-pill workspace-hero__stat--soft">
                <span>Taxa líder</span>
                <strong>
                  {leadingProfessional
                    ? `${leadingProfessional.commissionRate.toFixed(1)}%`
                    : "Sem base"}
                </strong>
              </div>
              <div className="workspace-signal-pill workspace-hero__stat--accent">
                <span>Atendimentos</span>
                <strong>{leadingProfessional?.appointmentsCount ?? 0}</strong>
              </div>
            </div>
          </>
        }
      />

      <WorkspaceSectionNav
        label="Atalhos das comissões"
        items={[
          { href: "#commission-filters", label: "Filtro", meta: "Período e profissional" },
          { href: "#commission-summary", label: "Resumo", meta: "Venda e comissão" },
          { href: "#commission-list", label: "Tabela", meta: "Detalhe por profissional" },
        ]}
      />

      <section
        id="commission-summary"
        className="workspace-subgrid management-summary-grid"
        aria-label="Resumo das comissões"
      >
        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Venda do período</span>
          <h3>{formatCurrency(totalSold)}</h3>
          <p>
            {totalAppointments
              ? `${totalAppointments} atendimento(s) concluído(s) formando a base do cálculo.`
              : "Sem venda concluída neste recorte para calcular comissão."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Comissão média</span>
          <h3>{items.length ? formatCurrency(averageCommission) : "Sem base"}</h3>
          <p>
            {items.length
              ? "Média por profissional com comissão no período."
              : "A média aparece quando houver pelo menos uma linha calculada."}
          </p>
        </article>

        <article className="workspace-panel">
          <span className="workspace-panel__eyebrow">Líder do recorte</span>
          <h3>{leadingProfessional?.professionalName ?? "Sem destaque"}</h3>
          <p>
            {leadingProfessional
              ? `${formatCurrency(leadingProfessional.commissionAmount)} é a maior comissão calculada neste recorte.`
              : "O profissional com maior comissão aparece aqui assim que houver cálculo."}
          </p>
        </article>
      </section>

      <section className="management-grid management-grid--two">
        <article id="commission-filters" className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Filtro do período</h2>
              <p className="muted">A comissão considera apenas atendimentos concluídos.</p>
            </div>
          </div>

          <form method="get" className="simple-form">
            <div className="field">
              <label htmlFor="commission-professional">Profissional</label>
              <select
                id="commission-professional"
                name="professionalId"
                defaultValue={professionalId}
              >
                <option value="">Todos</option>
                {options.professionals.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="split-grid">
              <div className="field">
                <label htmlFor="commission-from">De</label>
                <input
                  id="commission-from"
                  name="dateFrom"
                  type="date"
                  defaultValue={dateFrom}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="commission-to">Até</label>
                <input
                  id="commission-to"
                  name="dateTo"
                  type="date"
                  defaultValue={dateTo}
                  required
                />
              </div>
            </div>

            <div className="inline-actions">
              <button type="submit" className="secondary-button">
                Aplicar filtro
              </button>
              <a href="/dashboard/gestao/comissoes" className="secondary-button">
                Limpar
              </a>
            </div>
          </form>
        </article>

        <article className="card content-card management-card">
          <div className="section-heading">
            <div>
              <h2>Resumo do período</h2>
              <p className="muted">Volume vendido e comissão calculada.</p>
            </div>
          </div>

          <div className="management-list">
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{formatCurrency(totalSold)}</strong>
                <span>total vendido</span>
              </div>
            </div>
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{formatCurrency(totalCommission)}</strong>
                <span>comissão calculada</span>
              </div>
            </div>
            <div className="management-list-row">
              <div className="management-list-row__main">
                <strong>{items.length}</strong>
                <span>profissional(is) com comissão no período</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      <section id="commission-list" className="card content-card management-card">
        <div className="section-heading">
          <div>
            <h2>Comissões por profissional</h2>
            <p className="muted">
              {items.length
                ? `${items.length} linha(s) calculada(s)`
                : "Nenhuma comissão encontrada"}
            </p>
          </div>
        </div>

        {!items.length ? (
          <EmptyStateCard
            eyebrow="Sem comissão"
            title="Nenhum atendimento concluído nesse período"
            description="A comissão aparece quando o atendimento está concluído."
          />
        ) : (
          <div className="management-table">
            <div className="management-table__head">
              <span>Profissional</span>
              <span>Comissão</span>
              <span>Atendimentos</span>
              <span>Total vendido</span>
              <span>Comissão calculada</span>
            </div>
            {items.map((item) => (
              <div key={item.professionalId} className="management-table__row">
                <strong>{item.professionalName}</strong>
                <span>{item.commissionRate.toFixed(1)}%</span>
                <span>{item.appointmentsCount}</span>
                <span>{formatCurrency(item.totalSold)}</span>
                <span>{formatCurrency(item.commissionAmount)}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
