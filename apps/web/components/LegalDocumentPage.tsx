import styles from "./LegalDocumentPage.module.css";

type LegalAction = {
  href: string;
  label: string;
  tone?: "primary" | "secondary";
};

type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

type LegalDocumentPageProps = {
  actions?: LegalAction[];
  asideItems?: string[];
  asideTitle?: string;
  eyebrow: string;
  lastUpdated: string;
  sections: LegalSection[];
  summary: string;
  title: string;
};

export function LegalDocumentPage({
  actions = [],
  asideItems = [],
  asideTitle = "Atendimento",
  eyebrow,
  lastUpdated,
  sections,
  summary,
  title,
}: LegalDocumentPageProps) {
  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.hero}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <div>
            <h1>{title}</h1>
          </div>
          <p className={styles.summary}>{summary}</p>
          <div className={styles.meta}>
            <span>
              <strong>App:</strong> Salon Fun
            </span>
            <span>
              <strong>Empresa operadora:</strong> JC7 Desenvolvimentos
            </span>
            <span>
              <strong>Relação de marca:</strong> Salon Fun e um produto da JC7 Desenvolvimentos
            </span>
            <span>
              <strong>Atualizado em:</strong> {lastUpdated}
            </span>
          </div>
          {actions.length ? (
            <div className={styles.actions}>
              {actions.map((action) => (
                <a
                  key={`${action.href}:${action.label}`}
                  href={action.href}
                  className={
                    action.tone === "secondary"
                      ? styles.secondaryAction
                      : styles.primaryAction
                  }
                >
                  {action.label}
                </a>
              ))}
            </div>
          ) : null}
        </section>

        <div className={styles.contentGrid}>
          <div className={styles.content}>
            {sections.map((section) => (
              <section key={section.title} className={styles.sectionCard}>
                <h2>{section.title}</h2>
                {section.paragraphs?.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
                {section.bullets?.length ? (
                  <ul className={styles.bulletList}>
                    {section.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                ) : null}
              </section>
            ))}
          </div>

          <aside className={styles.aside}>
            <section className={styles.asideCard}>
              <h2>{asideTitle}</h2>
              <ul className={styles.infoList}>
                {asideItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
