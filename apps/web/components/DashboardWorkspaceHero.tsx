import type { ReactNode } from "react";

type DashboardWorkspaceHeroStat = {
  label: string;
  value: ReactNode;
  note?: string;
  tone?: "warm" | "soft" | "accent" | "success" | "danger" | "neutral";
};

type DashboardWorkspaceHeroSignal = {
  label: string;
  value: ReactNode;
  tone?: "warm" | "soft" | "accent" | "success" | "danger" | "neutral";
};

type DashboardWorkspaceHeroHighlight = {
  label: string;
  value: ReactNode;
  note?: string;
};

type DashboardWorkspaceHeroProps = {
  id?: string;
  eyebrow: string;
  title: string;
  description?: string;
  highlight?: DashboardWorkspaceHeroHighlight;
  stats?: DashboardWorkspaceHeroStat[];
  signals?: DashboardWorkspaceHeroSignal[];
  actions?: ReactNode;
  aside?: ReactNode;
  className?: string;
};

function getToneClass(tone?: DashboardWorkspaceHeroStat["tone"]) {
  switch (tone) {
    case "warm":
      return "workspace-hero__stat--warm";
    case "soft":
      return "workspace-hero__stat--soft";
    case "accent":
      return "workspace-hero__stat--accent";
    case "success":
      return "workspace-hero__stat--success";
    case "danger":
      return "workspace-hero__stat--danger";
    default:
      return "";
  }
}

export function DashboardWorkspaceHero({
  id,
  eyebrow,
  title,
  description,
  highlight,
  stats = [],
  signals = [],
  actions,
  aside,
  className,
}: DashboardWorkspaceHeroProps) {
  return (
    <section id={id} className={["workspace-hero", className].filter(Boolean).join(" ")}>
      <div className="workspace-hero__grid">
        <div className="workspace-hero__body">
          <span className="eyebrow workspace-hero__eyebrow">{eyebrow}</span>

          <div className="workspace-hero__heading">
            <div className="workspace-hero__copy">
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}
            </div>

            {actions ? <div className="workspace-hero__actions">{actions}</div> : null}
          </div>

          {highlight ? (
            <article className="workspace-highlight-card">
              <span className="workspace-highlight-card__label">{highlight.label}</span>
              <strong>{highlight.value}</strong>
              {highlight.note ? <p>{highlight.note}</p> : null}
            </article>
          ) : null}

          {signals.length ? (
            <div className="workspace-signal-strip" aria-label="Sinais operacionais">
              {signals.map((signal) => (
                <div
                  key={signal.label}
                  className={["workspace-signal-pill", getToneClass(signal.tone)].filter(Boolean).join(" ")}
                >
                  <span>{signal.label}</span>
                  <strong>{signal.value}</strong>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {(stats.length || aside) ? (
          <aside className="workspace-hero__aside">
            {stats.length ? (
              <div className="workspace-hero__stats">
                {stats.map((stat) => (
                  <article
                    key={stat.label}
                    className={["workspace-hero__stat", getToneClass(stat.tone)].filter(Boolean).join(" ")}
                  >
                    <span className="workspace-hero__stat-label">{stat.label}</span>
                    <strong>{stat.value}</strong>
                    {stat.note ? <p>{stat.note}</p> : null}
                  </article>
                ))}
              </div>
            ) : null}

            {aside ? <div className="workspace-hero__aside-card">{aside}</div> : null}
          </aside>
        ) : null}
      </div>
    </section>
  );
}
