"use client";

import { SessionProvider } from "next-auth/react";
import { SiteFooter } from "@frontend/components/SiteFooter";

// The theme toggle lives in SiteFooter now. It used to be a floating button pinned to the
// top-right of every page, which overlapped the dashboard header's avatar.
//
// The `dark` class is set before paint by the inline script in src/app/layout.tsx, so there
// is no flash of the wrong theme on load and no state to hold here.
export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <div className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <SiteFooter />
      </div>
    </SessionProvider>
  );
}
