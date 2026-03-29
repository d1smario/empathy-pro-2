import { EMPATHY_PLATFORM_VERSION } from "@empathy/contracts";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        padding: "2rem",
        fontFamily: "system-ui, sans-serif",
        maxWidth: "42rem",
      }}
    >
      <h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>
        Empathy Pro 2.0
      </h1>
      <p style={{ color: "#444", marginBottom: "1rem" }}>
        Monorepo scaffold: contract-first packages + Next.js app.
      </p>
      <code
        style={{
          display: "block",
          padding: "0.75rem 1rem",
          background: "#f4f4f5",
          borderRadius: 6,
          fontSize: "0.9rem",
        }}
      >
        {EMPATHY_PLATFORM_VERSION}
      </code>
    </main>
  );
}
