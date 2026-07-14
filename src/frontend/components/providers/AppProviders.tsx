"use client";

import { SessionProvider } from "next-auth/react";
import { useEffect, useState } from "react";

export function AppProviders({ children }: { children: React.ReactNode }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);

  return (
    <SessionProvider>
      <button
        type="button"
        onClick={() => setDark((value) => !value)}
        className="fixed right-4 top-4 z-50 rounded-md border border-neutral-200 bg-white px-3 py-2 text-sm shadow-soft dark:border-neutral-800 dark:bg-neutral-900"
      >
        {dark ? "Light" : "Dark"}
      </button>
      {children}
    </SessionProvider>
  );
}
