import { DashboardRecoveryCampaignPanel } from "@/components/DashboardRecoveryCampaignPanel";

import type { AgendaIntelligencePageData } from "./_lib";
import styles from "./page.module.css";

type AgendaIntelligencePageContentProps = {
  data: AgendaIntelligencePageData;
};

function toneClassName(tone: "accent" | "soft" | "success" | "warn") {
  switch (tone) {
    case "accent":
      return styles.sourceCardAccent;
    case "success":
      return styles.sourceCardSuccess;
    case "warn":
      return styles.sourceCardWarn;
    default:
      return styles.sourceCardSoft;
  }
}

export function AgendaIntelligencePageContent({
  data,
}: AgendaIntelligencePageContentProps) {
  return (
    <div className={styles.page}>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>Agenda Inteligente</span>
          <h1>Sincronização de agenda e preenchimento de horários</h1>
          <p className={styles.lead}>
            O painel cruza agenda real, equipe, serviços, folgas e bloqueios para
            liberar só o que cabe. Depois, a IA aponta onde agir para não deixar
            horário parado.
          </p>
        </div>

        <div className={styles.heroActions}>
          <a href={data.previousDayHref} className={styles.secondaryButton}>
            Dia anterior
          </a>
          <a href={data.nextDayHref} className={styles.secondaryButton}>
            Próximo dia
          </a>
          <a href={data.agendaHref} className={styles.primaryButton}>
            Abrir agenda do dia
          </a>
        </div>

        <div className={styles.heroSummary}>
          <span className={styles.summaryBadge}>{data.dayLabel}</span>
          <p>{data.syncSummary}</p>
          <p>{data.fillSummary}</p>
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>1. Sincronização da agenda</span>
            <h2>Leitura operacional antes de vender horário</h2>
          </div>
          <p>
            Esta camada segura a disponibilidade real do salão com base em
            horário do negócio, profissionais, serviços ligados e ajustes do dia.
          </p>
        </div>

        <div className={styles.sourceGrid}>
          {data.syncSources.map((source) => (
            <article
              key={source.id}
              className={`${styles.sourceCard} ${toneClassName(source.tone)}`}
            >
              <span className={styles.sourceLabel}>{source.label}</span>
              <strong>{source.status}</strong>
              <p>{source.note}</p>
            </article>
          ))}
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <div>
            <span className={styles.sectionEyebrow}>2. Preenchimento de horários</span>
            <h2>Oportunidades prontas para revisão</h2>
          </div>
          <p>
            A IA detecta janela vaga, base com chance de retorno e sugere a ação.
            Nada é disparado sem sua confirmação.
          </p>
        </div>

        <div className={styles.signalGrid}>
          {data.fillSignals.map((signal) => (
            <article key={signal.id} className={styles.signalCard}>
              <span>{signal.label}</span>
              <strong>{signal.value}</strong>
              <small>{signal.note}</small>
            </article>
          ))}
        </div>

        <div className={styles.contentGrid}>
          <div className={styles.mainColumn}>
            <article className={styles.panel}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sectionEyebrow}>Janelas detectadas</span>
                  <h3>Onde encaixar primeiro</h3>
                </div>
                <span className={styles.countPill}>
                  {data.opportunities.length} oportunidade(s)
                </span>
              </div>

              {!data.opportunities.length ? (
                <p className={styles.emptyCopy}>
                  Nenhuma janela forte apareceu neste dia. Quando a agenda abrir
                  espaço com potencial real, ela entra aqui.
                </p>
              ) : (
                <div className={styles.opportunityList}>
                  {data.opportunities.map((opportunity) => (
                    <article key={opportunity.id} className={styles.opportunityCard}>
                      <div className={styles.opportunityHeader}>
                        <div>
                          <span className={styles.opportunityTag}>
                            {opportunity.gapLabel}
                          </span>
                          <h4>{opportunity.headline}</h4>
                        </div>
                        <span className={styles.countPill}>
                          {opportunity.windowLabel}
                        </span>
                      </div>

                      <p className={styles.opportunityDetail}>{opportunity.detail}</p>

                      <div className={styles.factsRow}>
                        <span className={styles.factChip}>
                          Profissional: {opportunity.staffName}
                        </span>
                        <span className={styles.factChip}>
                          Serviço foco: {opportunity.suggestedServiceLabel}
                        </span>
                        <span className={styles.factChip}>
                          {opportunity.compatibleServiceCount} serviço(s) cabem na janela
                        </span>
                      </div>

                      <ul className={styles.serviceList}>
                        {opportunity.compatibleServices.map((service) => (
                          <li key={service}>{service}</li>
                        ))}
                      </ul>

                      <div className={styles.inlineActions}>
                        <a href={opportunity.agendaHref} className={styles.secondaryButton}>
                          Ver agenda
                        </a>
                        <a
                          href="/dashboard/benefits/promotions?compose=1"
                          className={styles.secondaryButton}
                        >
                          Criar campanha
                        </a>
                        <a href="/dashboard/ai" className={styles.secondaryButton}>
                          Perguntar para a IA
                        </a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </article>

            <DashboardRecoveryCampaignPanel
              aiEnabled={data.aiEnabled}
              question={data.campaignQuestion}
              snapshot={data.recoverySnapshot}
            />
          </div>

          <aside className={styles.sideColumn}>
            <article className={styles.sidebarCard}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sectionEyebrow}>Fluxo recomendado</span>
                  <h3>Como esse módulo trabalha</h3>
                </div>
              </div>

              <div className={styles.workflowList}>
                {data.workflow.map((step) => (
                  <article key={step.id} className={styles.workflowStep}>
                    <strong>{step.title}</strong>
                    <p>{step.description}</p>
                  </article>
                ))}
              </div>
            </article>

            <article className={styles.sidebarCard}>
              <div className={styles.panelHeader}>
                <div>
                  <span className={styles.sectionEyebrow}>Modelo de execução</span>
                  <h3>Sem automático total no começo</h3>
                </div>
              </div>

              <p className={styles.sidebarCopy}>
                A IA detecta, sugere e organiza. O dono confirma antes de
                publicar campanha, chamar cliente ou mexer em qualquer ação
                sensível da agenda.
              </p>

              <div className={styles.inlineActions}>
                <a href="/dashboard/benefits/automations" className={styles.secondaryButton}>
                  Ver automações
                </a>
                <a href="/dashboard/gestao/clientes" className={styles.secondaryButton}>
                  Ver clientes
                </a>
              </div>
            </article>
          </aside>
        </div>
      </section>
    </div>
  );
}
