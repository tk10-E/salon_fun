import { EmptyStateCard } from "@/components/EmptyStateCard";
import { FlashMessage } from "@/components/FlashMessage";
import { requireOwnerSalon } from "@/lib/auth";
import { formatCurrency } from "@/lib/formatters";
import {
  getLocalDateKey,
  loadManagementCommissions,
  loadManagementSelectOptions,
} from "@/lib/management";

import styles from "./page.module.css";

type ComissoesPageProps = {
  searchParams?: Promise<{
    professionalId?: string;
    dateFrom?: string;
    dateTo?: string;
    message?: string;
    tone?: string;
  }>;
};

function buildFilterHref(args: {
  dateFrom: string;
  dateTo: string;
  professionalId?: string;
}) {
  const params = new URLSearchParams();
  params.set("dateFrom", args.dateFrom);
  params.set("dateTo", args.dateTo);

  if (args.professionalId) {
    params.set("professionalId", args.professionalId);
  }

  return `/dashboard/gestao/comissoes?${params.toString()}`;
}

function formatCountLabel(count: number, singular: string, plural: string) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function ComissoesPage({
  searchParams: searchParamsPromise,
}: ComissoesPageProps) {
  const [searchParams, { salon }] = await Promise.all([
    searchParamsPromise,
    requireOwnerSalon(),
  ]);
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
    loadManagementSelectOptions(salon.id, {
      categories: false,
      serviceFormCategories: false,
      services: false,
      professionals: true,
      clients: false,
    }),
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
  const averageRate = items.length
    ? items.reduce((sum, item) => sum + item.commissionRate, 0) / items.length
    : 0;
  const leadingProfessional = items[0] ?? null;
  const selectedProfessionalLabel = professionalId
    ? options.professionals.find((item) => item.id === professionalId)?.label ??
      "Profissional"
    : "Todos";
  const periodLabel =
    dateFrom === dateTo ? dateFrom : `${dateFrom} a ${dateTo}`;
  const highestAppointments = Math.max(
    ...items.map((item) => item.appointmentsCount),
    1,
  );
  const highestCommission = Math.max(
    ...items.map((item) => item.commissionAmount),
    1,
  );

  return (
    <div className={styles.page}>
      {searchParams?.message ? (
        <FlashMessage message={searchParams.message} tone={searchParams.tone} />
      ) : null}

      <section className={styles.hero}>
        <div className={styles.heroHeader}>
          <div>
            <p className={styles.eyebrow}>Repasse</p>
            <h1>Comissões da equipe</h1>
            <p className={styles.lead}>
              Veja o período, filtre por profissional e feche a equipe com o
              valor certo.
            </p>
          </div>

          <div className={styles.heroActions}>
            <a href="#commission-filters" className={styles.secondaryButton}>
              Ajustar filtro
            </a>
            <a href="#commission-list" className={styles.primaryButton}>
              Ver comissões
            </a>
          </div>
        </div>

        <div className={styles.metricGrid}>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Comissão calculada</span>
            <strong className={styles.metricValue}>
              {formatCurrency(totalCommission)}
            </strong>
            <p className={styles.metricMeta}>
              {items.length
                ? `${formatCurrency(totalSold)} vendidos em ${formatCountLabel(totalAppointments, "atendimento concluído", "atendimentos concluídos")}.`
                : "Sem comissão neste recorte."}
            </p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Venda do período</span>
            <strong className={styles.metricValue}>
              {formatCurrency(totalSold)}
            </strong>
            <p className={styles.metricMeta}>Base real do cálculo atual.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Atendimentos</span>
            <strong className={styles.metricValue}>{totalAppointments}</strong>
            <p className={styles.metricMeta}>Só atendimentos concluídos entram aqui.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Comissão média</span>
            <strong className={styles.metricValue}>
              {items.length ? formatCurrency(averageCommission) : "Sem base"}
            </strong>
            <p className={styles.metricMeta}>Média por profissional no período.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Período</span>
            <strong className={styles.metricTitle}>{periodLabel}</strong>
            <p className={styles.metricMeta}>Filtro aplicado agora.</p>
          </article>
          <article className={styles.metricCard}>
            <span className={styles.metricLabel}>Profissional</span>
            <strong className={styles.metricTitle}>
              {selectedProfessionalLabel}
            </strong>
            <p className={styles.metricMeta}>
              {items.length
                ? `${formatCountLabel(items.length, "profissional no recorte", "profissionais no recorte")}.`
                : "Sem resultados."}
            </p>
          </article>
        </div>
      </section>

      <div className={styles.contentGrid}>
        <div className={styles.mainColumn}>
          <section id="commission-filters" className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Filtro</p>
                <h2>Filtro do período</h2>
                <p className={styles.panelCopy}>
                  A comissão considera apenas atendimentos concluídos.
                </p>
              </div>
              <div className={styles.pillRow}>
                <span className={styles.pill}>Período: {periodLabel}</span>
                <span className={styles.pill}>
                  Profissional: {selectedProfessionalLabel}
                </span>
              </div>
            </div>

            <form method="get" className={styles.form}>
              <div className={styles.formGrid}>
                <label className={styles.fieldFull}>
                  <span>Profissional</span>
                  <select name="professionalId" defaultValue={professionalId}>
                    <option value="">Todos</option>
                    {options.professionals.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.field}>
                  <span>De</span>
                  <input
                    name="dateFrom"
                    type="date"
                    defaultValue={dateFrom}
                    required
                  />
                </label>
                <label className={styles.field}>
                  <span>Até</span>
                  <input
                    name="dateTo"
                    type="date"
                    defaultValue={dateTo}
                    required
                  />
                </label>
              </div>

              <div className={styles.actionRow}>
                <button type="submit" className={styles.primaryButton}>
                  Aplicar filtro
                </button>
                <a href="/dashboard/gestao/comissoes" className={styles.secondaryButton}>
                  Limpar
                </a>
              </div>
            </form>
          </section>

          <section id="commission-list" className={styles.panel}>
            <div className={styles.panelHeader}>
              <div>
                <p className={styles.eyebrow}>Equipe</p>
                <h2>Comissões por profissional</h2>
                <p className={styles.panelCopy}>
                  {items.length
                    ? `${formatCountLabel(items.length, "profissional com comissão", "profissionais com comissão")}.`
                    : "Nenhuma comissão encontrada."}
                </p>
              </div>
            </div>

            {!items.length ? (
              <EmptyStateCard
                eyebrow="Sem comissão"
                title="Nenhum atendimento concluído nesse período"
                description="A comissão aparece quando o atendimento é concluído."
              />
            ) : (
              <div className={styles.cardGrid}>
                {items.map((item) => {
                  const commissionShare = totalCommission
                    ? (item.commissionAmount / totalCommission) * 100
                    : 0;
                  const appointmentsShare =
                    (item.appointmentsCount / highestAppointments) * 100;
                  const isFocused =
                    item.professionalId === professionalId ||
                    (!professionalId &&
                      item.professionalId === leadingProfessional?.professionalId);

                  return (
                    <article
                      key={item.professionalId}
                      className={`${styles.staffCard} ${
                        isFocused ? styles.staffCardActive : ""
                      }`}
                    >
                      <div className={styles.staffHeader}>
                        <div>
                          <div className={styles.staffBadgeRow}>
                            <span className={styles.tag}>
                              {item.commissionRate.toFixed(1)}%
                            </span>
                            <span className={styles.tag}>
                              {formatCountLabel(item.appointmentsCount, "atendimento", "atendimentos")}
                            </span>
                          </div>
                          <h3>{item.professionalName}</h3>
                          <p className={styles.panelCopy}>
                            {formatCurrency(item.totalSold)} vendidos no recorte.
                          </p>
                        </div>
                        <a
                          href={buildFilterHref({
                            dateFrom,
                            dateTo,
                            professionalId: item.professionalId,
                          })}
                          className={styles.inlineLink}
                        >
                          Filtrar
                        </a>
                      </div>

                      <div className={styles.statGrid}>
                        <article className={styles.statCard}>
                          <span>Comissão</span>
                          <strong>{formatCurrency(item.commissionAmount)}</strong>
                        </article>
                        <article className={styles.statCard}>
                          <span>Total vendido</span>
                          <strong>{formatCurrency(item.totalSold)}</strong>
                        </article>
                        <article className={styles.statCard}>
                          <span>Participação</span>
                          <strong>{commissionShare.toFixed(0)}%</strong>
                        </article>
                      </div>

                      <div className={styles.progressStack}>
                        <div className={styles.progressRow}>
                          <div className={styles.progressLabelRow}>
                            <span>Participação na comissão</span>
                            <strong>{commissionShare.toFixed(0)}%</strong>
                          </div>
                          <div className={styles.progressTrack}>
                            <span style={{ width: `${commissionShare}%` }} />
                          </div>
                        </div>
                        <div className={styles.progressRow}>
                          <div className={styles.progressLabelRow}>
                            <span>Volume de atendimentos</span>
                            <strong>{item.appointmentsCount}</strong>
                          </div>
                          <div className={styles.progressTrackMuted}>
                            <span style={{ width: `${appointmentsShare}%` }} />
                          </div>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>

        <div className={styles.sidebarColumn}>
          <section className={styles.sidebarCard}>
            <div className={styles.sidebarHeader}>
              <div>
                <p className={styles.eyebrow}>Foco</p>
                <h2>Profissional em foco</h2>
              </div>
            </div>

            <div className={styles.focusCard}>
              <strong>
                {leadingProfessional?.professionalName ?? "Sem destaque neste recorte"}
              </strong>
              <p className={styles.panelCopy}>
                {leadingProfessional
                  ? `${leadingProfessional.commissionRate.toFixed(1)}% de taxa, ${formatCurrency(leadingProfessional.totalSold)} vendidos e ${formatCountLabel(leadingProfessional.appointmentsCount, "atendimento", "atendimentos")}.`
                  : "Assim que o período tiver atendimento concluído, o destaque aparece aqui."}
              </p>
            </div>

            <div className={styles.sidebarMetricGrid}>
              <article className={styles.sidebarMetric}>
                <span>Maior taxa</span>
                <strong>
                  {leadingProfessional
                    ? `${leadingProfessional.commissionRate.toFixed(1)}%`
                    : "Sem base"}
                </strong>
              </article>
              <article className={styles.sidebarMetric}>
                <span>Atendimentos</span>
                <strong>{leadingProfessional?.appointmentsCount ?? 0}</strong>
              </article>
            </div>
          </section>

          <section className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.eyebrow}>Resumo</p>
                  <h2>Resumo do período</h2>
                </div>
              </div>

            <div className={styles.summaryList}>
              <article className={styles.summaryRow}>
                <span>Venda do período</span>
                <strong>{formatCurrency(totalSold)}</strong>
              </article>
              <article className={styles.summaryRow}>
                <span>Comissão calculada</span>
                <strong>{formatCurrency(totalCommission)}</strong>
              </article>
              <article className={styles.summaryRow}>
                <span>Comissão média</span>
                <strong>
                  {items.length ? formatCurrency(averageCommission) : "Sem base"}
                </strong>
              </article>
              <article className={styles.summaryRow}>
                <span>Taxa média</span>
                <strong>{items.length ? `${averageRate.toFixed(1)}%` : "Sem base"}</strong>
              </article>
            </div>
          </section>

          <section className={styles.sidebarCard}>
              <div className={styles.sidebarHeader}>
                <div>
                  <p className={styles.eyebrow}>Ranking</p>
                  <h2>Leitura rápida</h2>
                </div>
              </div>

            <div className={styles.rankList}>
              {items.slice(0, 5).map((item, index) => (
                <article key={item.professionalId} className={styles.rankRow}>
                  <span className={styles.rankBadge}>{index + 1}</span>
                  <div>
                    <strong>{item.professionalName}</strong>
                    <p className={styles.panelCopy}>
                      {formatCurrency(item.commissionAmount)} de comissão
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
