type EmptyStateCardProps = {
  eyebrow?: string;
  title: string;
  description: string;
};

export function EmptyStateCard({
  eyebrow = "Tudo certo por aqui",
  title,
  description,
}: EmptyStateCardProps) {
  return (
    <div className="empty-state">
      <div className="empty-state__mark" aria-hidden="true" />
      <div className="empty-state__content">
        <span className="eyebrow">{eyebrow}</span>
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}
