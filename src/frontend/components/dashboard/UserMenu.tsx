"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { KeyRound, LogOut } from "lucide-react";
import { Avatar } from "./ui";

/**
 * The profile avatar in the header. Click it to open a dropdown with the account actions
 * (Change password, Sign out) that used to sit loose in the header bar.
 *
 * Closes on: click outside, Escape, or picking an item. Standard menu behaviour.
 */
export function UserMenu({
  name,
  email,
  subtitle
}: {
  name: string;
  email: string;
  subtitle: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="rounded-full ring-offset-2 transition hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand dark:ring-offset-neutral-900"
      >
        <Avatar name={name} size={36} />
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900"
        >
          {/* Who you are signed in as. */}
          <div className="flex items-center gap-3 border-b border-neutral-100 p-3 dark:border-neutral-800">
            <Avatar name={name} size={38} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{name}</p>
              <p className="truncate text-xs text-neutral-500">{email}</p>
              {subtitle && <p className="mt-0.5 truncate text-[11px] text-neutral-400">{subtitle}</p>}
            </div>
          </div>

          <div className="p-1">
            <a
              href="/account/password"
              role="menuitem"
              className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
            >
              <KeyRound size={15} className="text-neutral-500" />
              Change password
            </a>

            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <LogOut size={15} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
