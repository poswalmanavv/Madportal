import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@frontend/components/providers/AppProviders";

const siteUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "MAD Club Management Portal",
    template: "%s · MAD Club"
  },
  description: "Managing and Directing Club portal for NIT Kurukshetra",
  applicationName: "MAD Club Portal",
  openGraph: {
    title: "MAD Club Management Portal",
    description: "Managing and Directing Club portal for NIT Kurukshetra",
    url: siteUrl,
    siteName: "MAD Club Portal",
    type: "website"
  },
  // The portal is behind a login and should never be indexed.
  robots: { index: false, follow: false }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/*
          Runs before the first paint: reads the saved choice (or falls back to the OS
          setting) and sets the `dark` class on <html> immediately. Without this, the page
          renders light and then snaps to dark after hydration -- a visible flash.
          The previous toggle did not persist at all: it reset to light on every reload.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');var d=t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.classList.toggle('dark',d);}catch(e){}})();`
          }}
        />
      </head>
      <body className="text-ink antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
