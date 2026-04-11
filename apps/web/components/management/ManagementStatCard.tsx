type ManagementStatCardProps = {
  label: string;
  value: string;
  hint?: string;
};

export function ManagementStatCard({
  label,
  value,
  hint,
}: ManagementStatCardProps) {
  return (
    <article className="management-stat-card card">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {hint ? <p className="muted">{hint}</p> : null}
    </article>
  );
}
