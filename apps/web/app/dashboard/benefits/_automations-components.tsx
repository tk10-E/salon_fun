import { saveSalonGrowthAutomationAction } from "@/app/actions";
import { EmptyStateCard } from "@/components/EmptyStateCard";
import { formatDateTime } from "@/lib/formatters";

import type { GrowthAutomationPageData } from "./_lib";

type AutomationsPageContentProps = {
  data: GrowthAutomationPageData;
};

export function AutomationsPageContent({
  data,
}: AutomationsPageContentProps) {
  const automationLive =
    data.growthAutomationSettings.is_active ||
    data.growthAutomationSettings.smart_rebook_is_active;

  return (
    <>
      <AutomationsHeader
        automationLive={automationLive}
        recoveredLast30Days={
          data.growthAutomationOverview.recovered_customers_last_30d ?? 0
        }
        remindersQueued={
          data.growthAutomationOverview.smart_rebook_due_customers ?? 0
        }
      />
      <AutomationSettingsSection
        settings={data.growthAutomationSettings}
      />
      <AutomationRecentRunsSection
        recentRuns={data.growthAutomationRecentRuns}
      />
    </>
  );
}

function AutomationsHeader({
  automationLive,
  recoveredLast30Days,
  remindersQueued,
}: {
  automationLive: boolean;
  recoveredLast30Days: number;
  remindersQueued: number;
}) {
  return (
    <header className="simple-header">
      <div>
        <p className="eyebrow">Campanhas · Retenção</p>
        <h1>Retenção automática da base</h1>
        <p className="muted">
          Configure inatividade, incentivo e lembrete de retorno em um único bloco.
        </p>
        <div className="inline-actions" style={{ marginTop: 8, flexWrap: "wrap" }}>
          <span
            className={
              automationLive ? "badge badge--confirmed" : "badge badge--soft"
            }
          >
            {automationLive ? "Automações ligadas" : "Automações pausadas"}
          </span>
          <span className="badge badge--soft">
            {recoveredLast30Days} recuperadas 30d
          </span>
          <span className="badge badge--soft">{remindersQueued} lembretes na fila</span>
        </div>
      </div>
    </header>
  );
}

function AutomationSettingsSection({
  settings,
}: {
  settings: GrowthAutomationPageData["growthAutomationSettings"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Configuração rápida</h2>
          <p className="muted">Edite só os campos principais.</p>
        </div>
      </div>

      <form action={saveSalonGrowthAutomationAction} className="simple-form">
        <div className="split-grid">
          <div className="field">
            <label htmlFor="growth-inactive-days">Inatividade (dias)</label>
            <input
              id="growth-inactive-days"
              name="winbackInactiveDays"
              type="number"
              min="7"
              max="365"
              step="1"
              defaultValue={settings.winback_inactive_days}
              required
            />
          </div>
          <div className="field">
            <label htmlFor="growth-discount">Incentivo (%)</label>
            <input
              id="growth-discount"
              name="winbackDiscountPercent"
              type="number"
              min="0"
              max="100"
              step="1"
              defaultValue={settings.winback_discount_percent}
              required
            />
          </div>
          <div className="field">
            <label className="checkbox-field" style={{ marginTop: 28 }}>
              <input
                type="checkbox"
                name="isActive"
                defaultChecked={settings.is_active}
              />
              Ativar reativação
            </label>
          </div>
        </div>

        <div className="field">
          <label htmlFor="growth-title">Título do push</label>
          <input
            id="growth-title"
            name="winbackTitle"
            defaultValue={settings.winback_title}
            maxLength={120}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="growth-body">Mensagem</label>
          <textarea
            id="growth-body"
            name="winbackBodyTemplate"
            rows={3}
            maxLength={220}
            defaultValue={settings.winback_body_template}
            required
          />
        </div>

        <div className="split-grid">
          <div className="field">
            <label htmlFor="smart-rebook-window-days">Janela do lembrete (dias)</label>
            <input
              id="smart-rebook-window-days"
              name="smartRebookWindowDays"
              type="number"
              min="1"
              max="14"
              step="1"
              defaultValue={settings.smart_rebook_window_days}
              required
            />
          </div>
          <div className="field">
            <label className="checkbox-field" style={{ marginTop: 28 }}>
              <input
                type="checkbox"
                name="smartRebookIsActive"
                defaultChecked={settings.smart_rebook_is_active}
              />
              Ativar lembrete
            </label>
          </div>
        </div>

        <div className="field">
          <label htmlFor="smart-rebook-title">Título do lembrete</label>
          <input
            id="smart-rebook-title"
            name="smartRebookTitle"
            defaultValue={settings.smart_rebook_title}
            maxLength={120}
            required
          />
        </div>

        <div className="field">
          <label htmlFor="smart-rebook-body">Mensagem do lembrete</label>
          <textarea
            id="smart-rebook-body"
            name="smartRebookBodyTemplate"
            rows={3}
            maxLength={220}
            defaultValue={settings.smart_rebook_body_template}
            required
          />
        </div>

        <button type="submit" className="primary-button">
          Salvar automação
        </button>
      </form>
    </section>
  );
}

function AutomationRecentRunsSection({
  recentRuns,
}: {
  recentRuns: GrowthAutomationPageData["growthAutomationRecentRuns"];
}) {
  return (
    <section className="card content-card">
      <div className="section-heading">
        <div>
          <h2>Últimos disparos</h2>
          <p className="muted">Até 5 execuções mais recentes.</p>
        </div>
        <span className="badge badge--soft">{recentRuns.length} registros</span>
      </div>

      {recentRuns.length ? (
        <div className="simple-list">
          {recentRuns.slice(0, 5).map((run) => (
            <article key={run.id} className="simple-row">
              <div
                className="inline-actions"
                style={{ marginBottom: 6, flexWrap: "wrap" }}
              >
                <span className="badge badge--soft">
                  {run.automation_type === "smart_rebook_prompt"
                    ? "Lembrete"
                    : "Reativação"}
                </span>
                <span className="badge badge--soft">
                  {formatDateTime(run.sent_at)}
                </span>
                <span className="badge badge--soft">
                  {run.discount_percent}% • {run.service_name}
                </span>
              </div>
              <h3>{run.customer_name}</h3>
              <p className="muted">
                {run.recovered ? "Voltou a agendar" : "Ainda sem retorno"} •{" "}
                {run.recovered_appointment_at
                  ? `Retorno em ${formatDateTime(run.recovered_appointment_at)}`
                  : "Aguardando agendamento"}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <EmptyStateCard
          eyebrow="Sem disparos"
          title="Ainda não houve execuções"
          description="Quando a automação rodar, os disparos aparecem aqui."
        />
      )}
    </section>
  );
}
