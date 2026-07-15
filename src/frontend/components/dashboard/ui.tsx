"use client";

/**
 * Shared visual primitives for the dashboard: pills, avatars, cards, empty states.
 *
 * Everything here is presentation only. No permission logic lives in this file -- the
 * server re-checks every request, and the role mirrors stay in DashboardClient.
 */

export const card =
  "rounded-xl border border-neutral-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.05)] dark:border-neutral-800 dark:bg-neutral-900";

export const input =
  "rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/20 dark:border-neutral-700 dark:bg-neutral-950";

export const btn =
  "inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:opacity-50";

export const btnPrimary = `${btn} bg-brand text-white hover:bg-brand/90`;
export const btnGhost = `${btn} border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800`;

/** Every status string used anywhere in the app, mapped to a tone. */
const STATUS_TONE: Record<string, string> = {
  // tasks
  Pending: "slate",
  "In Progress": "amber",
  Review: "blue",
  Completed: "green",
  // EP + sponsorship
  Interested: "blue",
  "Follow-up Required": "amber",
  Confirmed: "green",
  Rejected: "red",
  "Proposal Sent": "slate",
  Negotiation: "amber",
  // design
  Submitted: "blue",
  Approved: "green"
};

const PRIORITY_TONE: Record<string, string> = {
  Low: "slate",
  Medium: "blue",
  High: "amber",
  Critical: "red"
};

const TONE_CLASS: Record<string, string> = {
  slate: "bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
  blue: "bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300",
  amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
  green: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
  red: "bg-rose-50 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300"
};

const DOT_CLASS: Record<string, string> = {
  slate: "bg-neutral-400",
  blue: "bg-sky-500",
  amber: "bg-amber-500",
  green: "bg-emerald-500",
  red: "bg-rose-500"
};

export function StatusPill({ value }: { value: string }) {
  const tone = STATUS_TONE[value] ?? "slate";
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}>
      {value}
    </span>
  );
}

export function PriorityPill({ value }: { value: string }) {
  const tone = PRIORITY_TONE[value] ?? "slate";
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400">
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {value}
    </span>
  );
}

export function Tag({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-md bg-neutral-100 px-2 py-1 text-xs font-medium text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300">
      {value}
    </span>
  );
}

/** Deterministic colour per person, so the same member is always the same shade. */
const AVATAR_COLOURS = [
  "bg-rose-600",
  "bg-amber-600",
  "bg-emerald-600",
  "bg-sky-600",
  "bg-indigo-600",
  "bg-fuchsia-600",
  "bg-teal-600"
];

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function colourFor(seed: string) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLOURS[hash % AVATAR_COLOURS.length];
}

export function Avatar({ name, size = 28 }: { name: string; size?: number }) {
  return (
    <span
      title={name}
      style={{ width: size, height: size, fontSize: size * 0.36 }}
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-bold text-white ${colourFor(name)}`}
    >
      {initials(name) || "?"}
    </span>
  );
}

export function AvatarWithName({ name }: { name: string }) {
  return (
    <span className="flex items-center gap-2">
      <Avatar name={name} />
      <span className="truncate text-sm text-neutral-700 dark:text-neutral-300">{name}</span>
    </span>
  );
}

/**
 * A short, human-readable reference for a record. Our IDs are UUIDs -- unreadable in a
 * table -- so this renders the first six characters as #A1B2C3. It is derived in the
 * browser: no database column, no backend change.
 */
export function RefTag({ id }: { id: string }) {
  return (
    <span className="font-mono text-xs text-neutral-400">#{String(id).replace(/-/g, "").slice(0, 6).toUpperCase()}</span>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
      <p className="text-sm text-neutral-500">{message}</p>
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  count,
  children
}: {
  title: string;
  subtitle?: string;
  count?: number;
  children?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-3">
        {children}
        {typeof count === "number" && (
          <span className="text-sm font-medium text-neutral-500">
            {count} {count === 1 ? "record" : "records"}
          </span>
        )}
      </div>
    </div>
  );
}

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  });
}

// A true 0-100 rate (a member's overall completion), where a bar is the right shape. Used
// in Team Performance, not for a task's own progress.
export function ProgressBar({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
      </span>
      <span className="text-xs tabular-nums text-neutral-500">{value}%</span>
    </span>
  );
}

// Task progress is stored as a 0-100 number, but a bar is noise in a dense table -- these
// buckets read at a glance. The values a member can pick map back onto that number, so the
// database field and the completion charts are unchanged.
export const PROGRESS_STEPS = [
  { label: "Not started", value: 0 },
  { label: "In progress", value: 50 },
  { label: "Almost done", value: 90 },
  { label: "Completed", value: 100 }
] as const;

export function progressLabel(value: number) {
  if (value >= 100) return "Completed";
  if (value >= 75) return "Almost done";
  if (value > 0) return "In progress";
  return "Not started";
}

const PROGRESS_TONE: Record<string, string> = {
  "Not started": "slate",
  "In progress": "amber",
  "Almost done": "blue",
  Completed: "green"
};

export function ProgressLabel({ value }: { value: number }) {
  const label = progressLabel(value);
  const tone = PROGRESS_TONE[label] ?? "slate";
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${TONE_CLASS[tone]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${DOT_CLASS[tone]}`} />
      {label}
    </span>
  );
}
