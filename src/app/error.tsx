"use client";

import { useEffect } from "react";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8fb] px-4 dark:bg-neutral-950">
      <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 text-center shadow-soft dark:border-neutral-800 dark:bg-neutral-900">
        <h1 className="text-xl font-bold">Something went wrong</h1>
        <p className="mt-2 text-sm text-neutral-500">
          The page could not be loaded. You can retry, or head back to the dashboard.
        </p>
        {error.digest && <p className="mt-2 text-xs text-neutral-400">Reference: {error.digest}</p>}
        <div className="mt-5 flex justify-center gap-2">
          <button onClick={reset} className="rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white">
            Try again
          </button>
          <a href="/dashboard" className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700">
            Dashboard
          </a>
        </div>
      </div>
    </main>
  );
}
