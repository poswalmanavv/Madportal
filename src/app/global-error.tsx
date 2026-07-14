"use client";

import { useEffect } from "react";

// Last-resort boundary: catches errors thrown in the root layout itself, which error.tsx
// cannot. It must render its own <html>/<body>.
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", padding: "3rem", textAlign: "center" }}>
        <h1 style={{ fontSize: "1.25rem", fontWeight: 700 }}>The application failed to load</h1>
        <p style={{ marginTop: "0.5rem", color: "#666" }}>Please refresh the page. If it keeps happening, contact a secretary.</p>
        {error.digest && <p style={{ marginTop: "0.5rem", color: "#999", fontSize: "0.8rem" }}>Reference: {error.digest}</p>}
        <button
          onClick={reset}
          style={{ marginTop: "1.5rem", padding: "0.5rem 1rem", borderRadius: "0.375rem", border: "1px solid #ccc", cursor: "pointer" }}
        >
          Try again
        </button>
      </body>
    </html>
  );
}
