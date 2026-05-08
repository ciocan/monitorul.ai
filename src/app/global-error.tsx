"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app:global-error]", error);
  }, [error]);

  return (
    <html lang="ro">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          background: "oklch(0.99 0.003 80)",
          color: "oklch(0.16 0.01 80)",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        }}
      >
        <main
          style={{
            margin: "0 auto",
            width: "100%",
            maxWidth: "44rem",
            padding: "5rem 1.5rem",
          }}
        >
          <p
            style={{
              fontFamily: 'ui-monospace, "IBM Plex Mono", "SF Mono", Menlo, monospace',
              fontSize: "0.75rem",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "oklch(0.55 0.22 25)",
              margin: 0,
            }}
          >
            Eroare de sistem
          </p>
          <h1
            style={{
              fontSize: "2rem",
              lineHeight: 1.15,
              margin: "0.75rem 0 0",
              fontWeight: 600,
            }}
          >
            Aplicația nu a putut porni
          </h1>
          <p
            style={{
              maxWidth: "60ch",
              fontSize: "1rem",
              lineHeight: 1.65,
              color: "oklch(0.30 0.01 80)",
              margin: "1rem 0 0",
            }}
          >
            A apărut o eroare la nivelul cadrului aplicației. Reîncărcați pagina sau reveniți peste
            câteva minute.
          </p>

          <div style={{ marginTop: "2rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={reset}
              style={{
                fontFamily: 'ui-monospace, "IBM Plex Mono", "SF Mono", Menlo, monospace',
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.75rem 1.25rem",
                border: "1px solid oklch(0.16 0.01 80)",
                background: "oklch(0.16 0.01 80)",
                color: "oklch(0.99 0.003 80)",
                cursor: "pointer",
              }}
            >
              Reîncearcă
            </button>
            <Link
              href="/"
              style={{
                fontFamily: 'ui-monospace, "IBM Plex Mono", "SF Mono", Menlo, monospace',
                fontSize: "0.75rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                padding: "0.75rem 1.25rem",
                border: "1px solid oklch(0.85 0.01 80)",
                background: "transparent",
                color: "oklch(0.16 0.01 80)",
                textDecoration: "none",
              }}
            >
              Pagina principală
            </Link>
          </div>

          {error.digest ? (
            <p
              style={{
                fontFamily: 'ui-monospace, "IBM Plex Mono", "SF Mono", Menlo, monospace',
                fontSize: "0.75rem",
                color: "oklch(0.45 0.01 80)",
                marginTop: "2.5rem",
              }}
            >
              Cod referință: {error.digest}
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
