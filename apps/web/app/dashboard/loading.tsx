function LoadingLine({
  width = "100%",
  className = "",
}: {
  width?: string;
  className?: string;
}) {
  return <div className={`dashboard-loading-line ${className}`.trim()} style={{ width }} aria-hidden="true" />;
}

export default function DashboardLoading() {
  return (
    <div className="dashboard-loading-shell" aria-busy="true" aria-live="polite">
      <section className="dashboard-loading-grid dashboard-loading-grid--stats">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={`loading-stat-${index}`} className="card dashboard-loading-card">
            <div className="dashboard-loading-pill" />
            <LoadingLine width="72%" />
            <LoadingLine width="48%" />
            <div className="dashboard-loading-stats">
              <LoadingLine width="100%" />
              <LoadingLine width="100%" />
              <LoadingLine width="100%" />
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-loading-grid dashboard-loading-grid--content">
        <article className="card content-card dashboard-loading-card dashboard-loading-card--tall">
          <div className="dashboard-loading-pill" />
          <LoadingLine width="56%" />
          <LoadingLine width="88%" />
          <LoadingLine width="82%" />
          <div className="dashboard-loading-stack">
            <LoadingLine width="100%" />
            <LoadingLine width="94%" />
            <LoadingLine width="90%" />
            <LoadingLine width="78%" />
          </div>
        </article>

        <article className="card content-card dashboard-loading-card dashboard-loading-card--tall">
          <div className="dashboard-loading-pill" />
          <LoadingLine width="62%" />
          <LoadingLine width="84%" />
          <div className="dashboard-loading-stack">
            <LoadingLine width="100%" />
            <LoadingLine width="100%" />
            <LoadingLine width="92%" />
            <LoadingLine width="86%" />
            <LoadingLine width="74%" />
          </div>
        </article>
      </section>
    </div>
  );
}
