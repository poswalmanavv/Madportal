"use client";

import { signOut } from "next-auth/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Bell, Download, KeyRound, Plus, Search, Send, ShieldCheck } from "lucide-react";
import {
  DEPARTMENTS,
  DESIGN_STATUSES,
  EP_STATUSES,
  PRIORITIES,
  SPONSORSHIP_STATUSES,
  TASK_STATUSES
} from "@shared/constants";

type DashboardData = {
  current: {
    id: string;
    name: string;
    email: string;
    year: string;
    role: "member" | "secretary";
    teamHeadRole: string;
    canManageTeam?: boolean;
  };
  stats: Record<string, number>;
  memberStats: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  epEntries: Array<Record<string, any>>;
  sponsorships: Array<Record<string, any>>;
  designRequests: Array<Record<string, any>>;
  charts: {
    monthlyContributions: Array<{ month: string; count: number }>;
    yearPerformance: Array<{ year: string; members: number; completion: number }>;
    topContributors: Array<Record<string, any>>;
  };
};

const inputClass = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:border-neutral-700 dark:bg-neutral-950";
const cardClass = "rounded-lg border border-neutral-200 bg-white p-4 shadow-soft dark:border-neutral-800 dark:bg-neutral-900";

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [team, setTeam] = useState("");
  const [panel, setPanel] = useState<"task" | "ep" | "sponsor" | "design">("task");
  // Mirrors isLeader() in src/backend/rbac.ts. This is presentation only -- the server
  // re-checks on every request -- but it must agree, or the UI shows controls that 403.
  const canManage =
    data.current.role === "secretary" ||
    Boolean(data.current.canManageTeam) ||
    (Boolean(data.current.teamHeadRole) && data.current.teamHeadRole !== "None");
  const canDesign = data.current.role === "secretary" || data.current.teamHeadRole === "Design Team Head";

  async function refresh() {
    const response = await fetch("/api/dashboard");
    if (response.ok) setData(await response.json());
  }

  const filteredMembers = useMemo(() => {
    return data.memberStats.filter((member) => {
      const text = `${member.name} ${member.email} ${member.year} ${member.departments?.join(" ")}`.toLowerCase();
      const matchesQuery = text.includes(query.toLowerCase());
      const matchesTeam = !team || member.departments?.includes(team);
      return matchesQuery && matchesTeam;
    });
  }, [data.memberStats, query, team]);

  const filteredTasks = data.tasks.filter((task) => !status || task.status === status);

  return (
    <main className="min-h-screen bg-[#f7f8fb] px-4 py-6 dark:bg-neutral-950 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-col gap-4 rounded-lg border border-neutral-200 bg-white p-5 shadow-soft dark:border-neutral-800 dark:bg-neutral-900 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold text-brand"><ShieldCheck size={16} /> MAD Club, NIT Kurukshetra</p>
            <h1 className="mt-2 text-2xl font-bold md:text-3xl">Operations Dashboard</h1>
            <p className="mt-1 text-sm text-neutral-500">{data.current.name} · {data.current.year} · {data.current.teamHeadRole}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <NotificationBell />
            {data.current.role === "secretary" && (
              <a href="/api/admin/export" className="inline-flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-ink">
                <Download size={16} /> CSV Export
              </a>
            )}
            <a href="/account/password" className="inline-flex items-center gap-2 rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700">
              <KeyRound size={16} /> Change Password
            </a>
            <button onClick={() => signOut({ callbackUrl: "/" })} className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-semibold dark:border-neutral-700">Sign out</button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Metric label="Active Members" value={data.stats.activeMembers} />
          <Metric label="Tasks" value={data.stats.tasks} />
          <Metric label="Completed" value={data.stats.completedTasks} />
          <Metric label="EP Entries" value={data.stats.epEntries} />
          <Metric label="Sponsorships" value={data.stats.sponsorships} />
        </section>

        <section className="grid gap-4 xl:grid-cols-[1.25fr_0.75fr]">
          <div className={cardClass}>
            <h2 className="mb-4 text-lg font-bold">Monthly Contributions</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.charts.monthlyContributions}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis allowDecimals={false} />
                  <Tooltip />
                  <Area type="monotone" dataKey="count" stroke="#0f766e" fill="#99f6e4" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className={cardClass}>
            <h2 className="mb-4 text-lg font-bold">Year-wise Performance</h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.charts.yearPerformance}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="year" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="completion" fill="#f9735b" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
          <div className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Performance Dashboard</h2>
              <div className="flex flex-wrap gap-2">
                <label className="flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 dark:border-neutral-700">
                  <Search size={16} />
                  <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search members" className="w-36 bg-transparent text-sm outline-none" />
                </label>
                <select value={team} onChange={(event) => setTeam(event.target.value)} className={inputClass}>
                  <option value="">All teams</option>
                  {DEPARTMENTS.map((department) => <option key={department}>{department}</option>)}
                </select>
              </div>
            </div>
            <DataTable
              rows={filteredMembers}
              columns={[
                ["name", "Member"],
                ["year", "Year"],
                ["totalTasksCompleted", "Completed"],
                ["pendingWork", "Pending"],
                ["completionPercentage", "Completion %"]
              ]}
            />
          </div>

          <div className={cardClass}>
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-bold">Task Workflow</h2>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                <option value="">All statuses</option>
                {TASK_STATUSES.map((item) => <option key={item}>{item}</option>)}
              </select>
            </div>
            <TaskWorkflow tasks={filteredTasks} currentUserId={data.current.id} canManage={canManage} refresh={refresh} />
          </div>
        </section>

        <section className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className={cardClass}>
            <div className="mb-4 flex gap-2 overflow-x-auto">
              {(["task", "ep", "sponsor", "design"] as const).map((item) => (
                <button key={item} onClick={() => setPanel(item)} className={`rounded-md px-3 py-2 text-sm font-semibold ${panel === item ? "bg-brand text-white" : "bg-neutral-100 dark:bg-neutral-800"}`}>
                  {item}
                </button>
              ))}
            </div>
            {panel === "task" && <TaskForm canManage={canManage} members={data.memberStats} refresh={refresh} />}
            {panel === "ep" && <EPForm refresh={refresh} />}
            {panel === "sponsor" && <SponsorForm refresh={refresh} />}
            {panel === "design" && <DesignForm canDesign={canDesign} members={data.memberStats} refresh={refresh} />}
          </div>

          <div className={cardClass}>
            <h2 className="mb-4 text-lg font-bold">Pipelines and Top Contributors</h2>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {/* Each pipeline is now editable in place. Previously these were read-only
                  lists: an entry kept the status it was created with, forever. */}
              <Pipeline
                title="EP Pipeline"
                items={data.epEntries}
                labelOf={(entry) => entry.epName}
                statusOf={(entry) => entry.currentStatus}
                statuses={EP_STATUSES}
                endpoint={(id) => `/api/ep-entries/${id}`}
                buildBody={(status, comment) => ({ currentStatus: status, detailedUpdate: comment })}
                refresh={refresh}
              />
              <Pipeline
                title="Sponsorship Pipeline"
                items={data.sponsorships}
                labelOf={(entry) => entry.companyName}
                statusOf={(entry) => entry.currentStatus}
                statuses={SPONSORSHIP_STATUSES}
                endpoint={(id) => `/api/sponsorships/${id}`}
                buildBody={(status, comment) => ({ currentStatus: status, detailedUpdate: comment })}
                refresh={refresh}
              />
              <Pipeline
                title="Design Requests"
                items={data.designRequests ?? []}
                labelOf={(entry) => entry.designTitle}
                statusOf={(entry) => entry.status}
                statuses={DESIGN_STATUSES}
                endpoint={(id) => `/api/design-requests/${id}`}
                buildBody={(status, comment) => ({
                  status,
                  // The comment box doubles as the submission link for design work.
                  finalSubmissionLink: /^https?:\/\//.test(comment) ? comment : undefined
                })}
                commentLabel="Submission link (optional)"
                commentRequired={false}
                refresh={refresh}
              />
              <List title="Top Contributors" rows={data.charts.topContributors.map((member) => `${member.name} · ${member.completionPercentage}%`)} />
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

// Notifications were written by four different routes and never read by anything -- no
// endpoint, no UI. The Bell icon was even imported here and never rendered.
function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Array<Record<string, any>>>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    const body = await response.json();
    setItems(body.notifications ?? []);
    setUnread(body.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    load();
    // Cheap polling. A club-sized portal does not warrant websockets, but this is the
    // knob to turn if that changes.
    const timer = setInterval(load, 60_000);
    return () => clearInterval(timer);
  }, [load]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    await load();
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        className="relative inline-flex items-center gap-2 rounded-md border border-neutral-300 px-3 py-2 text-sm font-semibold dark:border-neutral-700"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1 text-xs font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-20 mt-2 w-80 rounded-lg border border-neutral-200 bg-white p-3 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold">Notifications</h3>
            {unread > 0 && (
              <button onClick={markAllRead} className="text-xs font-semibold text-brand">
                Mark all read
              </button>
            )}
          </div>
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <li
                key={String(item._id)}
                className={`rounded-md border p-2 text-sm ${
                  item.read
                    ? "border-neutral-200 text-neutral-500 dark:border-neutral-800"
                    : "border-brand/40 bg-brand/5 dark:border-brand/40"
                }`}
              >
                <p className="font-semibold">{item.title}</p>
                <p className="text-xs text-neutral-500">{item.message}</p>
                <p className="mt-1 text-[10px] uppercase text-neutral-400">
                  {item.createdAt ? new Date(item.createdAt).toLocaleString() : ""}
                </p>
              </li>
            ))}
            {!items.length && <li className="py-4 text-center text-sm text-neutral-500">Nothing yet.</li>}
          </ul>
        </div>
      )}
    </div>
  );
}

// An editable pipeline list: pick a new status, add a note, PATCH it.
function Pipeline({
  title,
  items,
  labelOf,
  statusOf,
  statuses,
  endpoint,
  buildBody,
  commentLabel = "What changed?",
  commentRequired = true,
  refresh
}: {
  title: string;
  items: Array<Record<string, any>>;
  labelOf: (item: any) => string;
  statusOf: (item: any) => string;
  statuses: readonly string[];
  endpoint: (id: string) => string;
  buildBody: (status: string, comment: string) => Record<string, unknown>;
  commentLabel?: string;
  commentRequired?: boolean;
  refresh: () => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
        {items.slice(0, 7).map((item) => {
          const id = String(item._id ?? item.id);
          return (
            <li key={id} className="border-b border-neutral-100 pb-2 last:border-0 dark:border-neutral-800">
              <button onClick={() => setOpenId(openId === id ? null : id)} className="w-full text-left">
                <span className="font-medium">{labelOf(item)}</span>
                <span className="text-neutral-400"> · {statusOf(item)}</span>
              </button>
              {openId === id && (
                <StatusEditor
                  currentStatus={statusOf(item)}
                  statuses={statuses}
                  endpoint={endpoint(id)}
                  buildBody={buildBody}
                  commentLabel={commentLabel}
                  commentRequired={commentRequired}
                  onDone={async () => {
                    setOpenId(null);
                    await refresh();
                  }}
                />
              )}
            </li>
          );
        })}
        {!items.length && <li className="py-4 text-neutral-500">Nothing yet.</li>}
      </ul>
    </div>
  );
}

function StatusEditor({
  currentStatus,
  statuses,
  endpoint,
  buildBody,
  commentLabel,
  commentRequired,
  onDone
}: {
  currentStatus: string;
  statuses: readonly string[];
  endpoint: string;
  buildBody: (status: string, comment: string) => Record<string, unknown>;
  commentLabel: string;
  commentRequired: boolean;
  onDone: () => Promise<void>;
}) {
  const [status, setStatus] = useState(currentStatus);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch(endpoint, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildBody(status, comment))
    });
    setSaving(false);
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      setError(body?.error && typeof body.error === "string" ? body.error : "Update failed.");
      return;
    }
    await onDone();
  }

  return (
    <form onSubmit={submit} className="mt-2 space-y-2">
      <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} w-full`}>
        {statuses.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <input
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder={commentLabel}
        required={commentRequired}
        minLength={commentRequired ? 2 : undefined}
        className={`${inputClass} w-full`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button disabled={saving} className="w-full rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
        {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className={cardClass}>
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-2 text-3xl font-bold">{value}</p>
    </div>
  );
}

function DataTable({ rows, columns, format }: { rows: any[]; columns: [string, string][]; format?: (key: string, value: any) => any }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>{columns.map(([, label]) => <th key={label} className="py-3 pr-4 font-semibold">{label}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.id ?? row._id ?? index} className="border-b border-neutral-100 dark:border-neutral-800">
              {columns.map(([key]) => <td key={key} className="py-3 pr-4">{String(format ? format(key, row[key]) : row[key] ?? "-")}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <p className="py-6 text-sm text-neutral-500">No records match the current filters.</p>}
    </div>
  );
}

// Task progress could previously only be changed by calling the API by hand -- there was
// no control for it anywhere in the UI, so tasks never left "Pending" and every
// completion metric on this page was permanently zero.
function TaskWorkflow({
  tasks,
  currentUserId,
  canManage,
  refresh
}: {
  tasks: any[];
  currentUserId: string;
  canManage: boolean;
  refresh: () => Promise<void>;
}) {
  const [openTaskId, setOpenTaskId] = useState<string | null>(null);

  function canUpdate(task: any) {
    const assignees = (task.assignedTo ?? []).map((assignee: any) => String(assignee?._id ?? assignee));
    return canManage || assignees.includes(currentUserId);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[620px] text-left text-sm">
        <thead className="border-b border-neutral-200 text-neutral-500 dark:border-neutral-800">
          <tr>
            <th className="py-3 pr-4 font-semibold">Task</th>
            <th className="py-3 pr-4 font-semibold">Priority</th>
            <th className="py-3 pr-4 font-semibold">Status</th>
            <th className="py-3 pr-4 font-semibold">Progress</th>
            <th className="py-3 pr-4 font-semibold">Deadline</th>
            <th className="py-3 pr-4 font-semibold" />
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const id = String(task._id ?? task.id);
            return (
              <tr key={id} className="border-b border-neutral-100 align-top dark:border-neutral-800">
                <td className="py-3 pr-4">{task.title}</td>
                <td className="py-3 pr-4">{task.priority}</td>
                <td className="py-3 pr-4">{task.status}</td>
                <td className="py-3 pr-4">{task.progress ?? 0}%</td>
                <td className="py-3 pr-4">{task.deadline ? new Date(task.deadline).toLocaleDateString() : "-"}</td>
                <td className="py-3 pr-4">
                  {canUpdate(task) && (
                    <button
                      onClick={() => setOpenTaskId(openTaskId === id ? null : id)}
                      className="rounded-md border border-neutral-300 px-2 py-1 text-xs font-semibold dark:border-neutral-700"
                    >
                      {openTaskId === id ? "Cancel" : "Update"}
                    </button>
                  )}
                  {openTaskId === id && (
                    <TaskUpdateForm
                      taskId={id}
                      currentStatus={task.status}
                      currentProgress={task.progress ?? 0}
                      onDone={async () => {
                        setOpenTaskId(null);
                        await refresh();
                      }}
                    />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {!tasks.length && <p className="py-6 text-sm text-neutral-500">No tasks match the current filters.</p>}
    </div>
  );
}

function TaskUpdateForm({
  taskId,
  currentStatus,
  currentProgress,
  onDone
}: {
  taskId: string;
  currentStatus: string;
  currentProgress: number;
  onDone: () => Promise<void>;
}) {
  const [status, setStatus] = useState(currentStatus ?? "Pending");
  const [progress, setProgress] = useState(currentProgress ?? 0);
  const [comment, setComment] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch(`/api/tasks/${taskId}/updates`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, progress: Number(progress), comment })
    });
    setSaving(false);
    if (!response.ok) {
      setError(response.status === 403 ? "You are not assigned to this task." : "Update failed. Add a comment of at least 2 characters.");
      return;
    }
    await onDone();
  }

  return (
    <form onSubmit={submit} className="mt-2 w-56 space-y-2">
      <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${inputClass} w-full`}>
        {TASK_STATUSES.map((item) => (
          <option key={item}>{item}</option>
        ))}
      </select>
      <label className="block text-xs text-neutral-500">
        Progress: {progress}%
        <input
          type="range"
          min={0}
          max={100}
          value={progress}
          onChange={(event) => setProgress(Number(event.target.value))}
          className="w-full"
        />
      </label>
      <input
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="Comment"
        required
        minLength={2}
        className={`${inputClass} w-full`}
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <button disabled={saving} className="w-full rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60">
        {saving ? "Saving..." : "Save update"}
      </button>
    </form>
  );
}

function List({ title, rows }: { title: string; rows: string[] }) {
  return (
    <div className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800">
      <h3 className="mb-2 font-semibold">{title}</h3>
      <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-300">
        {rows.slice(0, 7).map((row, index) => <li key={`${row}-${index}`}>{row}</li>)}
      </ul>
    </div>
  );
}

function TaskForm({ canManage, members, refresh }: { canManage: boolean; members: any[]; refresh: () => Promise<void> }) {
  if (!canManage) return <p className="text-sm text-neutral-500">Only a secretary or team head can create tasks. Use the Update button on any task assigned to you to report progress.</p>;
  return <Form title="Create Task" endpoint="/api/tasks" refresh={refresh} fields={[
    ["title", "Title"], ["description", "Description"], ["assignedTo", "Assign To"], ["deadline", "Deadline"], ["remarks", "Remarks"]
  ]} members={members} extra={{ priority: PRIORITIES }} />;
}

function EPForm({ refresh }: { refresh: () => Promise<void> }) {
  return <Form title="Add New EP" endpoint="/api/ep-entries" refresh={refresh} fields={[
    ["epName", "EP Name"], ["organization", "Organization/College"], ["contactNumber", "Contact Number"], ["email", "Email"], ["personContacted", "Person Contacted"], ["date", "Date"], ["discussionSummary", "Discussion Summary"], ["detailedUpdate", "Detailed Update/Review"], ["attachNotes", "Attach Notes"]
  ]} extra={{ currentStatus: ["Interested", "Follow-up Required", "Confirmed", "Rejected"] }} />;
}

function SponsorForm({ refresh }: { refresh: () => Promise<void> }) {
  return <Form title="Add Sponsorship Entry" endpoint="/api/sponsorships" refresh={refresh} fields={[
    ["companyName", "Company Name"], ["industry", "Industry"], ["companyWebsite", "Company Website"], ["contactPersonName", "Contact Person"], ["designation", "Designation"], ["contactNumber", "Contact Number"], ["email", "Email"], ["dateContacted", "Date Contacted"], ["sponsorshipRequirement", "Requirement"], ["followUpDate", "Follow-up Date"], ["detailedUpdate", "Detailed Update"]
  ]} extra={{ currentStatus: ["Proposal Sent", "Negotiation", "Interested", "Confirmed", "Rejected"] }} />;
}

function DesignForm({ canDesign, members, refresh }: { canDesign: boolean; members: any[]; refresh: () => Promise<void> }) {
  if (!canDesign) return <p className="text-sm text-neutral-500">Only the Design Head or secretary can create design requests.</p>;
  return <Form title="Create Design Request" endpoint="/api/design-requests" refresh={refresh} fields={[
    ["designTitle", "Design Title"], ["requirement", "Requirement"], ["description", "Description"], ["assignedDesigner", "Assigned Designer"], ["deadline", "Deadline"], ["finalSubmissionLink", "Final Submission Link"]
  ]} members={members} extra={{ status: ["Pending", "In Progress", "Submitted", "Approved", "Rejected"] }} />;
}

function Form({ title, endpoint, fields, extra = {}, members = [], refresh }: { title: string; endpoint: string; fields: string[][]; extra?: Record<string, readonly string[]>; members?: any[]; refresh: () => Promise<void> }) {
  const [message, setMessage] = useState("");
  async function submit(formData: FormData) {
    const payload: Record<string, any> = {};
    fields.forEach(([name]) => {
      if (name === "assignedTo") payload[name] = formData.getAll(name);
      else payload[name] = formData.get(name);
    });
    Object.keys(extra).forEach((name) => payload[name] = formData.get(name));
    payload.attachments = [];
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    setMessage(response.ok ? "Saved successfully." : "Could not save. Check required fields.");
    if (response.ok) await refresh();
  }

  return (
    <form action={submit} className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-bold"><Plus size={18} /> {title}</h2>
      {fields.map(([name, label]) => {
        if (name === "assignedTo" || name === "assignedDesigner") {
          return (
            <select key={name} name={name} multiple={name === "assignedTo"} className={`${inputClass} min-h-12 w-full`}>
              {members.map((member) => <option key={member.id} value={member.id}>{member.name} · {member.year}</option>)}
            </select>
          );
        }
        const type = /date|deadline/i.test(name) ? "date" : name === "email" ? "email" : "text";
        return <input key={name} name={name} type={type} required={!["companyWebsite", "followUpDate", "attachNotes", "finalSubmissionLink", "remarks"].includes(name)} placeholder={label} className={`${inputClass} w-full`} />;
      })}
      {Object.entries(extra).map(([name, values]) => (
        <select key={name} name={name} className={`${inputClass} w-full`}>
          {values.map((value) => <option key={value}>{value}</option>)}
        </select>
      ))}
      {message && <p className="text-sm text-brand">{message}</p>}
      <button className="inline-flex items-center gap-2 rounded-md bg-brand px-4 py-2 text-sm font-semibold text-white"><Send size={16} /> Save</button>
    </form>
  );
}
