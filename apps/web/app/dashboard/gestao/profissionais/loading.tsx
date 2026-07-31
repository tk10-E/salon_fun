export default function ProfissionaisLoading() {
  return (
    <div
      aria-busy="true"
      aria-live="polite"
      style={{
        display: "grid",
        gap: "1rem",
        padding: "1.2rem",
        borderRadius: "2rem",
        border: "1px solid rgba(177, 128, 92, 0.16)",
        background:
          "linear-gradient(180deg, #fffdfa 0%, #f7efe7 100%)",
        boxShadow: "0 32px 80px rgba(53, 32, 19, 0.1)",
      }}
    >
      <div
        style={{
          display: "grid",
          gap: "0.8rem",
          padding: "1rem 1.1rem",
          borderRadius: "1.7rem",
          border: "1px solid rgba(177, 128, 92, 0.14)",
          background: "rgba(255, 251, 247, 0.96)",
        }}
      >
        <div
          style={{
            width: "8rem",
            height: "0.85rem",
            borderRadius: "999px",
            background: "rgba(177, 128, 92, 0.18)",
          }}
        />
        <div
          style={{
            width: "14rem",
            height: "2.9rem",
            borderRadius: "1rem",
            background: "rgba(40, 24, 15, 0.08)",
          }}
        />
        <div
          style={{
            width: "24rem",
            maxWidth: "100%",
            height: "1rem",
            borderRadius: "999px",
            background: "rgba(123, 102, 88, 0.14)",
          }}
        />
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(12rem, 1fr))",
          gap: "0.8rem",
        }}
      >
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            style={{
              minHeight: "6.2rem",
              borderRadius: "1.35rem",
              border: "1px solid rgba(177, 128, 92, 0.12)",
              background: "rgba(255, 252, 248, 0.96)",
            }}
          />
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "minmax(0, 1.65fr) minmax(20rem, 0.92fr)",
          gap: "1rem",
        }}
      >
        <div
          style={{
            minHeight: "26rem",
            borderRadius: "1.55rem",
            border: "1px solid rgba(177, 128, 92, 0.14)",
            background: "rgba(255, 252, 248, 0.96)",
          }}
        />
        <div
          style={{
            minHeight: "26rem",
            borderRadius: "1.55rem",
            border: "1px solid rgba(177, 128, 92, 0.14)",
            background: "rgba(255, 252, 248, 0.96)",
          }}
        />
      </div>
    </div>
  );
}
