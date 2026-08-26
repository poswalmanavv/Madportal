"use client";

import {
  AtSign,
  BarChart3,
  Bell,
  ClipboardList,
  ConciergeBell,
  Handshake,
  Newspaper,
  Palette,
  PlusCircle,
  UserRound,
  Users
} from "lucide-react";
import { Logo } from "@frontend/components/Logo";

export type ViewKey =
  | "overview"
  | "tasks"
  | "mine"
  | "ep"
  | "sponsorships"
  | "design"
  | "hospitality"
  | "content"
  | "members"
  | "notifications"
  | "mentions"
  // Not a nav item: the task detail view, reached by clicking a task row or a mention.
  | "task"
  | "create";

type Item = {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  badge?: number;
};

export function Sidebar({
  view,
  setView,
  unread,
  counts,
  open,
  onNavigate
}: {
  view: ViewKey;
  setView: (v: ViewKey) => void;
  unread: number;
  counts: Record<string, number>;
  open: boolean;
  onNavigate: () => void;
}) {
  // The nav mirrors what the server will actually allow. Hiding an item is presentation,
  // not a permission check -- every route re-checks the role on its own.
  const main: Item[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "tasks", label: "All Tasks", icon: ClipboardList, badge: counts.tasks },
    { key: "mine", label: "Assigned to Me", icon: UserRound, badge: counts.mine }
  ];

  const pipelines: Item[] = [
    { key: "ep", label: "EP Pipeline", icon: Handshake, badge: counts.ep },
    { key: "sponsorships", label: "Sponsorships", icon: Handshake, badge: counts.sponsorships },
    { key: "design", label: "Design Requests", icon: Palette, badge: counts.design },
    { key: "hospitality", label: "Hospitality", icon: ConciergeBell, badge: counts.hospitality },
    { key: "content", label: "Content Pipeline", icon: Newspaper, badge: counts.content }
  ];

  const rest: Item[] = [
    { key: "members", label: "Team Performance", icon: Users, badge: counts.members },
    // Mentions carries its own unread badge, like Notifications.
    { key: "mentions", label: "Mentions", icon: AtSign, badge: counts.mentions },
    { key: "notifications", label: "Notifications", icon: Bell, badge: unread },
    // Every member can log an EP/Sponsorship/Hospitality/Content entry regardless of year or
    // role -- CreateView itself hides the Task and Design panels for anyone who isn't a leader
    // or the design head, matching what the server actually allows.
    { key: "create", label: "Create New", icon: PlusCircle }
  ];

  function Group({ title, items }: { title: string; items: Item[] }) {
    return (
      <div className="mb-6">
        <p className="mb-2 px-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">{title}</p>
        <ul className="space-y-1">
          {items.map((item) => {
            const active = view === item.key;
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  onClick={() => {
                    setView(item.key);
                    onNavigate();
                  }}
                  aria-current={active ? "page" : undefined}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                    active
                      ? "bg-white/10 text-white shadow-inner"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <Icon size={17} className={active ? "text-brand" : ""} />
                  <span className="flex-1 text-left">{item.label}</span>
                  {typeof item.badge === "number" && item.badge > 0 && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        item.key === "notifications" || item.key === "mentions"
                          ? "bg-brand text-white"
                          : "bg-white/10 text-neutral-300"
                      }`}
                    >
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
  }

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto bg-[#0d1424] px-4 py-6 transition-transform lg:translate-x-0 ${
        open ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      <div className="mb-8 flex items-center gap-3 px-3">
        {/* The sidebar is always dark, so the mark is forced white -- the theme-following
            version would vanish here whenever the rest of the app is in light mode. */}
        <Logo height={40} variant="white" />
        <span>
          <span className="block text-sm font-bold leading-tight text-white">MAD Club</span>
          <span className="block text-[11px] leading-tight text-neutral-500">NIT Kurukshetra</span>
        </span>
      </div>

      <nav>
        <Group title="Menu" items={main} />
        <Group title="Pipelines" items={pipelines} />
        <Group title="Club" items={rest} />
      </nav>
    </aside>
  );
}
