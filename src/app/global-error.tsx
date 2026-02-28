"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0b",
          color: "#e4e4e7",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        }}
      >
        <div style={{ textAlign: "center", padding: "2rem", maxWidth: "480px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              margin: "0 auto 1.5rem",
              borderRadius: "12px",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "24px",
            }}
          >
            !
          </div>
          <h1
            style={{
              fontSize: "1.5rem",
              fontWeight: 700,
              margin: "0 0 0.75rem",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              fontSize: "0.875rem",
              color: "#a1a1aa",
              margin: "0 0 1.5rem",
              lineHeight: 1.6,
            }}
          >
            An unexpected error occurred. Please try again or refresh the page.
          </p>
          {error?.digest && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "#71717a",
                margin: "0 0 1.5rem",
                fontFamily: "monospace",
              }}
            >
              Error ID: {error.digest}
            </p>
          )}
          <button
            onClick={reset}
            style={{
              padding: "0.625rem 1.5rem",
              backgroundColor: "#00d4aa",
              color: "#0a0a0b",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try Again
          </button>
        </div>
      </body>
    </html>
  );
}
