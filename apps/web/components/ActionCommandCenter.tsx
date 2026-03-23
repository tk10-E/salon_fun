import Link from "next/link";

type ActionCommandCard = {
  ctaLabel: string;
  description: string;
  eyebrow: string;
  href: string;
  highlight: string;
  support?: string;
  title: string;
  tone?: "warm" | "soft" | "accent";
};

type ActionCommandCenterProps = {
  cards: ActionCommandCard[];
  description: string;
  framed?: boolean;
  title: string;
};

export function ActionCommandCenter({
  cards,
  description,
  framed = true,
  title,
}: ActionCommandCenterProps) {
  return (
    <section className={framed ? "card content-card" : "command-center command-center--embedded"}>
      <div className="section-heading">
        <div>
          <h2>{title}</h2>
          <p className="muted">{description}</p>
        </div>
      </div>

      <div className="command-center-grid" style={{ marginTop: 18 }}>
        {cards.map((card) => (
          <article
            key={`${card.eyebrow}-${card.title}`}
            className={`command-card command-card--${card.tone ?? "soft"}`}
          >
            <span className="eyebrow">{card.eyebrow}</span>
            <strong className="command-card__highlight">{card.highlight}</strong>
            <h3>{card.title}</h3>
            <p className="muted">{card.description}</p>
            {card.support ? <small className="list-meta">{card.support}</small> : null}
            <div className="command-card__footer">
              <Link href={card.href} className="secondary-button">
                {card.ctaLabel}
              </Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
