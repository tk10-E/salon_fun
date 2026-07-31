import {
  PanelAiAssistant,
  type PanelAiAssistantHistoryView,
} from "@/components/PanelAiAssistant";

type DashboardAiObservabilityView = {
  appliedFilters: {
    day: string | null;
    feature: string | null;
    model: string | null;
    outcome: "answered" | "failed" | "generated" | null;
    periodDays: 7 | 30 | 90;
    promptProfile: string | null;
    skillId: string | null;
  };
  breakdowns: {
    features: Array<{
      count: number;
      failureCount: number;
      fallbackCount: number;
      key: string;
      label: string;
      successCount: number;
    }>;
    models: Array<{
      count: number;
      failureCount: number;
      fallbackCount: number;
      key: string;
      label: string;
      successCount: number;
    }>;
    skills: Array<{
      count: number;
      failureCount: number;
      fallbackCount: number;
      key: string;
      label: string;
      successCount: number;
    }>;
  };
  entries: Array<{
    createdAt: string;
    createdAtLabel: string;
    dayKey: string;
    eventType: string;
    feature: string;
    featureLabel: string;
    id: string;
    model: string | null;
    outcome: "answered" | "failed" | "generated";
    outcomeLabel: string;
    policyVersion: string | null;
    promptProfile: string | null;
    promptVersion: string | null;
    requestPath: string | null;
    severity: "critical" | "info" | "warn" | null;
    skillId: string | null;
    skillLabel: string | null;
    summary: string | null;
    usedFallback: boolean;
  }>;
  options: {
    features: Array<{ count: number; label: string; value: string }>;
    models: Array<{ count: number; label: string; value: string }>;
    outcomes: Array<{ count: number; label: string; value: string }>;
    promptProfiles: Array<{ count: number; label: string; value: string }>;
    skills: Array<{ count: number; label: string; value: string }>;
  };
  totals: {
    fallbackCount: number;
    failureCount: number;
    filteredCount: number;
    lastEventAt: string | null;
    successCount: number;
    topFeatureLabel: string;
    topModelLabel: string;
    topPromptLabel: string;
    topSkillLabel: string;
    totalEvents: number;
    truncated: boolean;
  };
  trend: Array<{
    dayKey: string;
    dayLabel: string;
    failureCount: number;
    fallbackCount: number;
    successCount: number;
    totalCount: number;
  }>;
};

type DashboardAiPageContentProps = {
  aiEnabled: boolean;
  history: PanelAiAssistantHistoryView[];
  metrics: {
    lastUsageLabel: string;
    lastWeekCount: number;
    topIntentLabel: string;
    totalCount: number;
  };
  observability?: DashboardAiObservabilityView;
  showInternalTools?: boolean;
};

function getOutcomeBadgeClass(outcome: "answered" | "failed" | "generated") {
  return outcome === "failed"
    ? "badge badge--pending"
    : outcome === "generated"
      ? "badge badge--confirmed"
      : "badge badge--accent";
}

function getSeverityBadgeClass(
  severity: "critical" | "info" | "warn" | null,
) {
  return severity === "critical"
    ? "badge badge--cancelled"
    : severity === "warn"
      ? "badge badge--pending"
      : "badge badge--soft";
}

function getPeriodLabel(periodDays: 7 | 30 | 90) {
  return periodDays === 7 ? "7 dias" : periodDays === 90 ? "90 dias" : "30 dias";
}

function getBarPercent(count: number, peak: number) {
  if (peak < 1 || count < 1) {
    return 0;
  }

  return Math.max(8, Math.round((count / peak) * 100));
}

function buildAiDashboardHref(
  filters: DashboardAiObservabilityView["appliedFilters"],
  overrides: Partial<DashboardAiObservabilityView["appliedFilters"]>,
  showInternalTools = false,
  hash?: string,
) {
  const nextFilters = {
    ...filters,
    ...overrides,
  };
  const params = new URLSearchParams();

  params.set("period", String(nextFilters.periodDays));

  if (showInternalTools) {
    params.set("debug", "ai");
  }

  if (nextFilters.day) {
    params.set("day", nextFilters.day);
  }

  if (nextFilters.feature) {
    params.set("feature", nextFilters.feature);
  }

  if (nextFilters.model) {
    params.set("model", nextFilters.model);
  }

  if (nextFilters.outcome) {
    params.set("outcome", nextFilters.outcome);
  }

  if (nextFilters.promptProfile) {
    params.set("promptProfile", nextFilters.promptProfile);
  }

  if (nextFilters.skillId) {
    params.set("skill", nextFilters.skillId);
  }

  const query = params.toString();
  return `/dashboard/ai${query ? `?${query}` : ""}${hash ? `#${hash}` : ""}`;
}

function buildAiExportHref(
  filters: DashboardAiObservabilityView["appliedFilters"],
  showInternalTools = false,
) {
  const params = new URLSearchParams();

  params.set("period", String(filters.periodDays));

  if (showInternalTools) {
    params.set("debug", "ai");
  }

  if (filters.day) {
    params.set("day", filters.day);
  }

  if (filters.feature) {
    params.set("feature", filters.feature);
  }

  if (filters.model) {
    params.set("model", filters.model);
  }

  if (filters.outcome) {
    params.set("outcome", filters.outcome);
  }

  if (filters.promptProfile) {
    params.set("promptProfile", filters.promptProfile);
  }

  if (filters.skillId) {
    params.set("skill", filters.skillId);
  }

  const query = params.toString();
  return `/dashboard/ai/export${query ? `?${query}` : ""}`;
}

function buildSelectedFilterBadges(
  observability: DashboardAiObservabilityView,
) {
  const { appliedFilters } = observability;
  const badges: string[] = [];

  if (appliedFilters.day) {
    badges.push(`Dia: ${appliedFilters.day}`);
  }

  if (appliedFilters.feature) {
    badges.push(
      `Feature: ${
        observability.options.features.find(
          (item) => item.value === appliedFilters.feature,
        )?.label ?? appliedFilters.feature
      }`,
    );
  }

  if (appliedFilters.model) {
    badges.push(`Modelo: ${appliedFilters.model}`);
  }

  if (appliedFilters.outcome) {
    badges.push(
      `Resultado: ${
        observability.options.outcomes.find(
          (item) => item.value === appliedFilters.outcome,
        )?.label ?? appliedFilters.outcome
      }`,
    );
  }

  if (appliedFilters.promptProfile) {
    badges.push(`Prompt: ${appliedFilters.promptProfile}`);
  }

  if (appliedFilters.skillId) {
    badges.push(
      `Skill: ${
        observability.options.skills.find(
          (item) => item.value === appliedFilters.skillId,
        )?.label ?? appliedFilters.skillId
      }`,
    );
  }

  return badges;
}

function renderBreakdownList(args: {
  emptyCopy: string;
  filterKey: "feature" | "model" | "skillId";
  filters: DashboardAiObservabilityView["appliedFilters"];
  hash?: string;
  items: Array<{
    count: number;
    failureCount: number;
    fallbackCount: number;
    key: string;
    label: string;
    successCount: number;
  }>;
  showInternalTools?: boolean;
}) {
  if (!args.items.length) {
    return <p className="muted" style={{ margin: 0 }}>{args.emptyCopy}</p>;
  }

  const peak = Math.max(...args.items.map((item) => item.count), 1);

  return (
    <div style={{ display: "grid", gap: 10 }}>
      {args.items.map((item) => {
        const isActive =
          args.filterKey === "feature"
            ? args.filters.feature === item.key
            : args.filterKey === "model"
              ? args.filters.model === item.key
              : args.filters.skillId === item.key;
        const href = buildAiDashboardHref(
          args.filters,
          args.filterKey === "feature"
            ? { feature: isActive ? null : item.key }
            : args.filterKey === "model"
              ? { model: isActive ? null : item.key }
              : { skillId: isActive ? null : item.key },
          args.showInternalTools,
          args.hash,
        );

        return (
          <a
            key={item.key}
            href={href}
            className="card"
            style={{
              color: "inherit",
              display: "grid",
              gap: 8,
              padding: 14,
              textDecoration: "none",
            }}
          >
            <div
              style={{
                alignItems: "center",
                display: "flex",
                gap: 10,
                justifyContent: "space-between",
              }}
            >
              <strong style={{ minWidth: 0 }}>{item.label}</strong>
              <span className={isActive ? "badge badge--accent" : "badge badge--soft"}>
                {item.count} evento(s)
              </span>
            </div>
            <div
              aria-hidden="true"
              style={{
                background: "rgba(17, 24, 39, 0.08)",
                borderRadius: 999,
                height: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  background:
                    "linear-gradient(90deg, rgba(37, 99, 235, 0.88), rgba(14, 165, 233, 0.72))",
                  borderRadius: 999,
                  height: "100%",
                  width: `${getBarPercent(item.count, peak)}%`,
                }}
              />
            </div>
            <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="badge badge--soft">{item.successCount} sucesso(s)</span>
              <span className="badge badge--pending">{item.failureCount} falha(s)</span>
              <span className="badge badge--soft">{item.fallbackCount} fallback(s)</span>
            </div>
          </a>
        );
      })}
    </div>
  );
}

export function DashboardAiPageContent({
  aiEnabled,
  history,
  metrics,
  observability,
  showInternalTools = false,
}: DashboardAiPageContentProps) {
  const selectedFilterBadges = observability
    ? buildSelectedFilterBadges(observability)
    : [];
  const maxTrendCount = observability
    ? Math.max(...observability.trend.map((item) => item.totalCount), 1)
    : 1;

  return (
    <>
      <header className="simple-header">
        <div>
          <p className="eyebrow">IA</p>
          <h1>IA para vender e responder rapido</h1>
          <p className="muted">
            Use a IA para ler agenda, chamar clientes e agir antes de perder venda.
          </p>
          <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
            <span className="badge badge--confirmed">
              {metrics.totalCount} leituras salvas
            </span>
            <span className="badge badge--soft">
              {metrics.lastWeekCount} consultas na semana
            </span>
            <span className="badge badge--soft">Assunto mais pedido: {metrics.topIntentLabel}</span>
            <span className="badge badge--accent">{metrics.lastUsageLabel}</span>
          </div>
        </div>
      </header>

      {observability ? (
        <section className="card content-card dashboard-panel">
          <div style={{ display: "grid", gap: 16 }}>
            <div
              style={{
                alignItems: "start",
                display: "flex",
                flexWrap: "wrap",
                gap: 12,
                justifyContent: "space-between",
              }}
            >
              <div>
                <p className="eyebrow">Observabilidade</p>
                <h2 style={{ margin: "0 0 6px" }}>Uso agregado da IA</h2>
                <p className="muted" style={{ margin: 0 }}>
                  Tendencia por dia, ranking por skill e modelo, filtros tecnicos e
                  auditoria detalhada do tenant logado.
                </p>
              </div>
              <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                <span className="badge badge--confirmed">
                  {observability.totals.filteredCount} evento(s) filtrado(s)
                </span>
                <span className="badge badge--soft">
                  {observability.totals.successCount} sucesso(s)
                </span>
                <span className="badge badge--pending">
                  {observability.totals.failureCount} falha(s)
                </span>
                <span className="badge badge--soft">
                  {observability.totals.fallbackCount} fallback(s)
                </span>
                <span className="badge badge--accent">
                  Periodo: {getPeriodLabel(observability.appliedFilters.periodDays)}
                </span>
              </div>
            </div>

            <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
              <span className="badge badge--soft">
                Feature lider: {observability.totals.topFeatureLabel}
              </span>
              <span className="badge badge--soft">
                Modelo lider: {observability.totals.topModelLabel}
              </span>
              <span className="badge badge--soft">
                Prompt lider: {observability.totals.topPromptLabel}
              </span>
              <span className="badge badge--soft">
                Skill lider: {observability.totals.topSkillLabel}
              </span>
              {observability.totals.lastEventAt ? (
                <span className="badge badge--accent">
                  Ultimo evento: {observability.entries[0]?.createdAtLabel}
                </span>
              ) : null}
              {observability.totals.truncated ? (
                <span className="badge badge--pending">
                  Lista detalhada limitada aos registros mais recentes
                </span>
              ) : null}
            </div>

            <form
              method="get"
              className="card"
              style={{ display: "grid", gap: 12, padding: 16 }}
            >
              {showInternalTools ? (
                <input type="hidden" name="debug" value="ai" />
              ) : null}
              <div
                style={{
                  display: "grid",
                  gap: 12,
                  gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                }}
              >
                <label className="field" style={{ margin: 0 }}>
                  <span>Periodo</span>
                  <select
                    name="period"
                    defaultValue={String(observability.appliedFilters.periodDays)}
                  >
                    <option value="7">Ultimos 7 dias</option>
                    <option value="30">Ultimos 30 dias</option>
                    <option value="90">Ultimos 90 dias</option>
                  </select>
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Dia exato</span>
                  <input
                    type="date"
                    name="day"
                    defaultValue={observability.appliedFilters.day ?? ""}
                  />
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Resultado</span>
                  <select
                    name="outcome"
                    defaultValue={observability.appliedFilters.outcome ?? ""}
                  >
                    <option value="">Todos</option>
                    {observability.options.outcomes.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Feature</span>
                  <select
                    name="feature"
                    defaultValue={observability.appliedFilters.feature ?? ""}
                  >
                    <option value="">Todas</option>
                    {observability.options.features.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Modelo</span>
                  <select
                    name="model"
                    defaultValue={observability.appliedFilters.model ?? ""}
                  >
                    <option value="">Todos</option>
                    {observability.options.models.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Prompt</span>
                  <select
                    name="promptProfile"
                    defaultValue={observability.appliedFilters.promptProfile ?? ""}
                  >
                    <option value="">Todos</option>
                    {observability.options.promptProfiles.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="field" style={{ margin: 0 }}>
                  <span>Skill</span>
                  <select
                    name="skill"
                    defaultValue={observability.appliedFilters.skillId ?? ""}
                  >
                    <option value="">Todas</option>
                    {observability.options.skills.map((item) => (
                      <option key={item.value} value={item.value}>
                        {item.label} ({item.count})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                <button type="submit" className="primary-button">
                  Aplicar filtros
                </button>
                <a
                  href={showInternalTools ? "/dashboard/ai?debug=ai" : "/dashboard/ai"}
                  className="secondary-button"
                >
                  Limpar filtros
                </a>
                <a
                  href={buildAiExportHref(
                    observability.appliedFilters,
                    showInternalTools,
                  )}
                  className="secondary-button"
                >
                  Exportar CSV
                </a>
              </div>
            </form>

            {selectedFilterBadges.length ? (
              <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                {selectedFilterBadges.map((badge) => (
                  <span key={badge} className="badge badge--accent">
                    {badge}
                  </span>
                ))}
              </div>
            ) : null}

            <div
              style={{
                display: "grid",
                gap: 14,
                gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              }}
            >
              <article className="card" style={{ display: "grid", gap: 12, padding: 16 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Tendencia
                  </p>
                  <h3 style={{ margin: 0 }}>Volume por dia</h3>
                </div>
                <div
                  style={{
                    alignItems: "end",
                    display: "grid",
                    gap: 6,
                    gridAutoColumns: "minmax(16px, 1fr)",
                    gridAutoFlow: "column",
                    minHeight: 150,
                    overflowX: "auto",
                    paddingBottom: 4,
                  }}
                >
                  {observability.trend.map((point) => {
                    const isActive = observability.appliedFilters.day === point.dayKey;
                    const href = buildAiDashboardHref(
                      observability.appliedFilters,
                      { day: isActive ? null : point.dayKey },
                      showInternalTools,
                      "ai-audit-detail",
                    );

                    return (
                      <a
                        key={point.dayKey}
                        href={href}
                        style={{
                          alignItems: "center",
                          color: "inherit",
                          display: "grid",
                          gap: 8,
                          minWidth: 18,
                          textDecoration: "none",
                        }}
                        title={`${point.dayLabel}: ${point.totalCount} evento(s)`}
                      >
                        <div
                          aria-hidden="true"
                          style={{
                            alignItems: "end",
                            background: "rgba(15, 23, 42, 0.06)",
                            border: isActive
                              ? "1px solid rgba(14, 165, 233, 0.52)"
                              : "1px solid transparent",
                            borderRadius: 14,
                            display: "flex",
                            height: 112,
                            justifyContent: "center",
                            overflow: "hidden",
                            padding: 4,
                          }}
                        >
                          <div
                            style={{
                              background:
                                point.failureCount > 0
                                  ? "linear-gradient(180deg, rgba(234, 88, 12, 0.86), rgba(245, 158, 11, 0.72))"
                                  : point.fallbackCount > 0
                                    ? "linear-gradient(180deg, rgba(14, 165, 233, 0.88), rgba(59, 130, 246, 0.72))"
                                    : "linear-gradient(180deg, rgba(34, 197, 94, 0.88), rgba(16, 185, 129, 0.72))",
                              borderRadius: 999,
                              height: `${getBarPercent(point.totalCount, maxTrendCount)}%`,
                              minHeight: point.totalCount > 0 ? 10 : 2,
                              width: 12,
                            }}
                          />
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            textAlign: "center",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {point.dayLabel}
                        </span>
                      </a>
                    );
                  })}
                </div>
                <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                  <span className="badge badge--soft">
                    {observability.trend.filter((item) => item.totalCount > 0).length} dia(s) com uso
                  </span>
                  <span className="badge badge--pending">
                    {observability.trend.reduce(
                      (total, item) => total + item.failureCount,
                      0,
                    )} falha(s) no recorte
                  </span>
                </div>
              </article>

              <article className="card" style={{ display: "grid", gap: 12, padding: 16 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Skills
                  </p>
                  <h3 style={{ margin: 0 }}>Skills mais acionadas</h3>
                </div>
                {renderBreakdownList({
                  emptyCopy: "Sem dados suficientes para rankear skills neste recorte.",
                  filterKey: "skillId",
                  filters: observability.appliedFilters,
                  hash: "ai-audit-detail",
                  items: observability.breakdowns.skills,
                  showInternalTools,
                })}
              </article>

              <article className="card" style={{ display: "grid", gap: 12, padding: 16 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Modelos
                  </p>
                  <h3 style={{ margin: 0 }}>Modelos mais usados</h3>
                </div>
                {renderBreakdownList({
                  emptyCopy: "Sem dados suficientes para rankear modelos neste recorte.",
                  filterKey: "model",
                  filters: observability.appliedFilters,
                  hash: "ai-audit-detail",
                  items: observability.breakdowns.models,
                  showInternalTools,
                })}
              </article>

              <article className="card" style={{ display: "grid", gap: 12, padding: 16 }}>
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Drill-down
                  </p>
                  <h3 style={{ margin: 0 }}>Feature e resultado</h3>
                </div>
                {renderBreakdownList({
                  emptyCopy: "Sem dados suficientes para abrir features neste recorte.",
                  filterKey: "feature",
                  filters: observability.appliedFilters,
                  hash: "ai-audit-detail",
                  items: observability.breakdowns.features,
                  showInternalTools,
                })}
                <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                  {observability.options.outcomes.map((item) => {
                    const isActive = observability.appliedFilters.outcome === item.value;

                    return (
                      <a
                        key={item.value}
                        href={buildAiDashboardHref(
                          observability.appliedFilters,
                          {
                            outcome: isActive
                              ? null
                              : (item.value as "answered" | "failed" | "generated"),
                          },
                          showInternalTools,
                          "ai-audit-detail",
                        )}
                        className={isActive ? "badge badge--accent" : "badge badge--soft"}
                        style={{ textDecoration: "none" }}
                      >
                        {item.label} ({item.count})
                      </a>
                    );
                  })}
                </div>
              </article>
            </div>

            <div
              id="ai-audit-detail"
              style={{ display: "grid", gap: 12 }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: 10,
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <p className="eyebrow" style={{ marginBottom: 6 }}>
                    Auditoria
                  </p>
                  <h3 style={{ margin: 0 }}>Drill-down operacional</h3>
                </div>
                <span className="badge badge--soft">
                  {observability.entries.length} leitura(s) detalhada(s) carregada(s)
                </span>
              </div>

              {!observability.entries.length ? (
                <article className="card" style={{ padding: 18 }}>
                  <p className="muted" style={{ margin: 0 }}>
                    Nao encontrei eventos de IA com esse recorte. Ajuste periodo,
                    dia, resultado, prompt, modelo ou skill.
                  </p>
                </article>
              ) : (
                <div style={{ display: "grid", gap: 12 }}>
                  {observability.entries.map((entry) => (
                    <article
                      key={entry.id}
                      className="card"
                      style={{ display: "grid", gap: 10, padding: 16 }}
                    >
                      <div
                        style={{
                          alignItems: "center",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: 8,
                          justifyContent: "space-between",
                        }}
                      >
                        <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                          <span className="badge badge--accent">{entry.featureLabel}</span>
                          <span className={getOutcomeBadgeClass(entry.outcome)}>
                            {entry.outcomeLabel}
                          </span>
                          {entry.usedFallback ? (
                            <span className="badge badge--pending">Fallback</span>
                          ) : null}
                          <span className={getSeverityBadgeClass(entry.severity)}>
                            Severidade {entry.severity ?? "info"}
                          </span>
                        </div>
                        <span className="badge badge--soft">{entry.createdAtLabel}</span>
                      </div>

                      <p style={{ margin: 0 }}>{entry.summary ?? entry.featureLabel}</p>

                      <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                        <a
                          href={buildAiDashboardHref(
                            observability.appliedFilters,
                            { day: entry.dayKey },
                            showInternalTools,
                            "ai-audit-detail",
                          )}
                          className="secondary-button"
                        >
                          Filtrar dia
                        </a>
                        {entry.feature ? (
                          <a
                            href={buildAiDashboardHref(
                              observability.appliedFilters,
                              { feature: entry.feature },
                              showInternalTools,
                              "ai-audit-detail",
                            )}
                            className="secondary-button"
                          >
                            Filtrar feature
                          </a>
                        ) : null}
                        {entry.skillId ? (
                          <a
                            href={buildAiDashboardHref(
                              observability.appliedFilters,
                              { skillId: entry.skillId },
                              showInternalTools,
                              "ai-audit-detail",
                            )}
                            className="secondary-button"
                          >
                            Filtrar skill
                          </a>
                        ) : null}
                      </div>

                      <div className="inline-actions" style={{ flexWrap: "wrap", gap: 8 }}>
                        {entry.model ? (
                          <span className="badge badge--soft">Modelo: {entry.model}</span>
                        ) : null}
                        {entry.promptProfile ? (
                          <span className="badge badge--soft">
                            Prompt: {entry.promptProfile}
                          </span>
                        ) : null}
                        {entry.skillLabel ? (
                          <span className="badge badge--soft">Skill: {entry.skillLabel}</span>
                        ) : null}
                        {entry.promptVersion ? (
                          <span className="badge badge--soft">
                            Prompt v{entry.promptVersion}
                          </span>
                        ) : null}
                        {entry.policyVersion ? (
                          <span className="badge badge--soft">
                            Policy: {entry.policyVersion}
                          </span>
                        ) : null}
                        {entry.requestPath ? (
                          <span className="badge badge--soft">
                            Rota: {entry.requestPath}
                          </span>
                        ) : null}
                      </div>

                      <details>
                        <summary>Ver trilha tecnica</summary>
                        <div
                          style={{
                            display: "grid",
                            gap: 10,
                            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                            marginTop: 12,
                          }}
                        >
                          <article className="card" style={{ padding: 12 }}>
                            <strong style={{ display: "block", marginBottom: 6 }}>
                              Event type
                            </strong>
                            <span className="muted">{entry.eventType}</span>
                          </article>
                          <article className="card" style={{ padding: 12 }}>
                            <strong style={{ display: "block", marginBottom: 6 }}>
                              Request path
                            </strong>
                            <span className="muted">{entry.requestPath ?? "Sem rota"}</span>
                          </article>
                          <article className="card" style={{ padding: 12 }}>
                            <strong style={{ display: "block", marginBottom: 6 }}>
                              Dia
                            </strong>
                            <span className="muted">{entry.dayKey}</span>
                          </article>
                          <article className="card" style={{ padding: 12 }}>
                            <strong style={{ display: "block", marginBottom: 6 }}>
                              Registro
                            </strong>
                            <span className="muted">{entry.id}</span>
                          </article>
                        </div>
                      </details>
                    </article>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>
      ) : null}

      <PanelAiAssistant
        aiEnabled={aiEnabled}
        heading="IA para agir no salao"
        description="Veja quem chamar, onde vender e o que corrigir agora com base nos dados reais."
        initialHistory={history}
        showHistory
        showTechnicalDetails={showInternalTools}
        workspaceHref={null}
      />
    </>
  );
}
