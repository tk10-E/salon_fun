function LoadingLine({
  width = "100%",
  className = "",
}: {
  width?: string;
  className?: string;
}) {
  return (
    <div
      className={`dashboard-loading-line ${className}`.trim()}
      style={{ width }}
      aria-hidden="true"
    />
  );
}

type DashboardLoadingSkeletonProps = {
  variant?: "home" | "page";
};

function DashboardHomeLoadingSkeleton() {
  return (
    <>
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
    </>
  );
}

function DashboardPageRouteLoadingSkeleton() {
  return (
    <>
      <section className="card content-card dashboard-loading-card">
        <div className="dashboard-loading-pill" style={{ width: 112 }} />
        <LoadingLine width="34%" />
        <LoadingLine width="76%" />
        <div
          className="inline-actions"
          style={{ marginTop: 16, gap: 10, flexWrap: "wrap" }}
          aria-hidden="true"
        >
          <div className="dashboard-loading-pill" style={{ width: 118 }} />
          <div className="dashboard-loading-pill" style={{ width: 138 }} />
          <div className="dashboard-loading-pill" style={{ width: 124 }} />
        </div>
      </section>

      <section className="dashboard-loading-grid dashboard-loading-grid--content">
        {Array.from({ length: 2 }).map((_, index) => (
          <article
            key={`loading-page-panel-${index}`}
            className="card content-card dashboard-loading-card dashboard-loading-card--tall"
          >
            <div className="dashboard-loading-pill" />
            <LoadingLine width={index === 0 ? "52%" : "61%"} />
            <LoadingLine width={index === 0 ? "86%" : "78%"} />
            <div className="dashboard-loading-stack">
              <LoadingLine width="100%" />
              <LoadingLine width="96%" />
              <LoadingLine width="90%" />
              <LoadingLine width="82%" />
            </div>
          </article>
        ))}
      </section>

      <section className="dashboard-loading-grid dashboard-loading-grid--stats">
        {Array.from({ length: 3 }).map((_, index) => (
          <article key={`loading-page-stat-${index}`} className="card dashboard-loading-card">
            <div className="dashboard-loading-pill" />
            <LoadingLine width="64%" />
            <LoadingLine width="42%" />
            <div className="dashboard-loading-stats">
              <LoadingLine width="100%" />
              <LoadingLine width="88%" />
            </div>
          </article>
        ))}
      </section>
    </>
  );
}

export function DashboardLoadingSkeleton({
  variant = "home",
}: DashboardLoadingSkeletonProps) {
  return (
    <div className="dashboard-loading-shell" aria-busy="true" aria-live="polite">
      {variant === "home" ? (
        <DashboardHomeLoadingSkeleton />
      ) : (
        <DashboardPageRouteLoadingSkeleton />
      )}
    </div>
  );
}
