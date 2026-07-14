"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun } from "lucide-react";

type Theme = "light" | "dark" | "system";

/**
 * Site footer, and the home of the theme switcher.
 *
 * The toggle used to be a `fixed right-4 top-4` button floating over every page, which sat
 * directly on top of the dashboard header's avatar. A footer is where this belongs.
 *
 * Content is right-aligned on purpose: the dashboard sidebar is fixed to the left edge, so
 * anything left-aligned here would be hidden behind it on desktop.
 */
export function SiteFooter() {
  const [theme, setTheme] = useState<Theme>("system");

  // Read whatever the pre-hydration script in layout.tsx already decided, so the button
  // starts in the right position instead of flipping after mount.
  useEffect(() => {
    const stored = window.localStorage.getItem("theme") as Theme | null;
    setTheme(stored === "light" || stored === "dark" ? stored : "system");
  }, []);

  function apply(next: Theme) {
    setTheme(next);

    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const isDark = next === "dark" || (next === "system" && prefersDark);
    document.documentElement.classList.toggle("dark", isDark);

    // "system" means "follow the OS", so we remove the override rather than storing it.
    if (next === "system") window.localStorage.removeItem("theme");
    else window.localStorage.setItem("theme", next);
  }

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "system", label: "System", icon: Monitor },
    { value: "dark", label: "Dark", icon: Moon }
  ];

  return (
    <footer className="border-t border-neutral-200 bg-white/60 px-4 py-4 dark:border-neutral-800 dark:bg-neutral-900/60 lg:px-8">
      <div className="flex flex-wrap items-center justify-end gap-4">
        <p className="text-xs text-neutral-500">MAD Club · NIT Kurukshetra</p>

        <div
          role="group"
          aria-label="Theme"
          className="flex items-center gap-0.5 rounded-lg border border-neutral-200 p-0.5 dark:border-neutral-800"
        >
          {options.map((option) => {
            const Icon = option.icon;
            const active = theme === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => apply(option.value)}
                aria-pressed={active}
                title={option.label}
                className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "bg-neutral-100 text-ink dark:bg-neutral-800 dark:text-white"
                    : "text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                }`}
              >
                <Icon size={14} />
                <span className="hidden sm:inline">{option.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </footer>
  );
}
