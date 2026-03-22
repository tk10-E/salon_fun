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
      <span className="eyebrow">{eyebrow}</span>
      <h3>{title}</h3>
      <p>{description}</p>
    </div>
  );
}

