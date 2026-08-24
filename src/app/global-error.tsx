"use client";

/**
 * Top-level error boundary. Renders OUTSIDE the root layout (so no globals.css / Tailwind),
 * hence inline styles. Catches catastrophic failures in the root layout itself.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          display: "flex",
          minHeight: "100vh",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          textAlign: "center",
          padding: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Something went wrong</h1>
        <p style={{ color: "#666" }}>Please try again.</p>
        <button
          onClick={reset}
          style={{
            borderRadius: "0.5rem",
            border: "1px solid #ccc",
            padding: "0.5rem 1.25rem",
            cursor: "pointer",
          }}
        >
          Retry
        </button>
      </body>
    </html>
  );
}
