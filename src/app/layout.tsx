import type { Metadata } from "next";
import "./globals.css";
import { AppProviders } from "@/components/providers/AppProviders";

export const metadata: Metadata = {
  title: "MAD Club Management Portal",
  description: "Managing and Directing Club portal for NIT Kurukshetra"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="text-ink antialiased dark:bg-neutral-950 dark:text-neutral-100">
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
