"use client";

import { useMemo, useState } from "react";
import { Search, Trash2 } from "lucide-react";
import { PRIORITIES, TASK_STATUSES } from "@shared/constants";
import {
  Avatar,
  EmptyState,
  PROGRESS_STEPS,
  PageHeader,
  PriorityPill,
  ProgressLabel,
  RefTag,
  StatusPill,
  btnGhost,
  btnPrimary,
  card,
  formatDate,
  input,
  progressLabel
} from "./ui";

type Task = Record<string, any>;

export function TasksView({
  title,
  subtitle,
  tasks,
  currentUserId,
  canManage,
  canDelete,
  onOpen,
  refresh
}: {
  title: string;
  subtitle: string;
  tasks: Task[];
  currentUserId: string;
  canManage: boolean;
  canDelete: boolean;
  onOpen: (taskId: string) => void;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesQuery = !q || `${task.title} ${task.description ?? ""}`.toLowerCase().includes(q);
      const matchesStatus = !status || task.status === status;
      const matchesPriority = !priority || task.priority === priority;
      return matchesQuery && matchesStatus && matchesPriority;
    });
  }, [tasks, query, status, priority]);

  function idOf(task: Task) {
    return String(task._id ?? task.id);
  }

  function canUpdate(task: Task) {
    const assignees = (task.assignedTo ?? []).map((a: any) => String(a?._id ?? a?.id ?? a));
    return canManage || assignees.includes(currentUserId);
  }

  async function deleteTask(task: Task) {
    const id = idOf(task);
    const ok = window.confirm(
      `Delete "${task.title}"?\n\nThis permanently removes the task and its progress history. It cannot be undone.`
    );
    if (!ok) return;

    setBusyId(id);
    setError("");
    const response = await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    setBusyId(null);

    if (!response.ok) {
      setError(response.status === 403 ? "Only a secretary can delete a task." : "Could not delete that task.");
      return;
    }
    await refresh();
  }

  const clearable = query || status || priority;

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} count={filtered.length} />

      <div className={card}>
        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <label className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search task title..."
              className={`${input} w-full pl-9`}
            />
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)} className={input}>
            <option value="">All Statuses</option>
            {TASK_STATUSES.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          <select value={priority} onChange={(event) => setPriority(event.target.value)} className={input}>
            <option value="">All Priorities</option>
            {PRIORITIES.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </select>

          {clearable && (
            <button
              onClick={() => {
                setQuery("");
                setStatus("");
                setPriority("");
              }}
              className={btnGhost}
            >
              Clear
            </button>
          )}
        </div>

        {error && <p className="border-b border-neutral-200 px-4 py-2 text-sm text-rose-600 dark:border-neutral-800">{error}</p>}

        <div className="overflow-x-auto">
          <table className="w-full min-w-[840px] text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <th className="px-4 py-3 font-semibold">Task</th>
                <th className="px-4 py-3 font-semibold">Priority</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Progress</th>
                <th className="px-4 py-3 font-semibold">Assignee</th>
                <th className="px-4 py-3 font-semibold">Deadline</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((task) => {
                const id = idOf(task);
                const assignees: any[] = task.assignedTo ?? [];
                return (
                  <>
                    <tr
                      key={id}
                      className="border-b border-neutral-100 transition hover:bg-neutral-50/70 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
                    >
                      <td className="px-4 py-4 align-top">
                        <RefTag id={id} />
                        {/* Opens the full task: comments, activity, details. */}
                        <button
                          onClick={() => onOpen(id)}
                          className="mt-0.5 block text-left font-semibold hover:text-brand hover:underline"
                        >
                          {task.title}
                        </button>
                        {task.description && (
                          <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{task.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top">
                        <PriorityPill value={task.priority} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <StatusPill value={task.status} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        <ProgressLabel value={task.progress ?? 0} />
                      </td>
                      <td className="px-4 py-4 align-top">
                        {assignees.length ? (
                          <span className="flex items-center gap-2">
                            <Avatar name={assignees[0].name ?? "?"} />
                            <span className="truncate text-sm">
                              {assignees[0].name}
                              {assignees.length > 1 && (
                                <span className="text-neutral-400"> +{assignees.length - 1}</span>
                              )}
                            </span>
                          </span>
                        ) : (
                          <span className="text-sm text-neutral-400">Unassigned</span>
                        )}
                      </td>
                      <td className="px-4 py-4 align-top text-sm text-neutral-500">{formatDate(task.deadline)}</td>
                      <td className="px-4 py-4 align-top">
                        <div className="flex justify-end gap-1">
                          {canUpdate(task) && (
                            <button
                              onClick={() => setOpenId(openId === id ? null : id)}
                              className={`${btnGhost} px-2 py-1 text-xs`}
                            >
                              {openId === id ? "Cancel" : "Update"}
                            </button>
                          )}
                          {/* Secretaries only. The server enforces this too. */}
                          {canDelete && (
                            <button
                              onClick={() => deleteTask(task)}
                              disabled={busyId === id}
                              aria-label={`Delete task ${task.title}`}
                              title="Delete task"
                              className="inline-flex items-center rounded-lg border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50 dark:border-rose-900 dark:hover:bg-rose-950/40"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {openId === id && (
                      <tr key={`${id}-edit`} className="border-b border-neutral-100 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-800/30">
                        <td colSpan={7} className="px-4 py-4">
                          <UpdateForm
                            taskId={id}
                            currentStatus={task.status}
                            currentProgress={task.progress ?? 0}
                            onDone={async () => {
                              setOpenId(null);
                              await refresh();
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <EmptyState message={tasks.length ? "No tasks match these filters." : "No tasks yet."} />
        )}
      </div>
    </>
  );
}

function UpdateForm({
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
      setError(
        response.status === 403
          ? "You are not assigned to this task."
          : "Update failed. Add a comment of at least 2 characters."
      );
      return;
    }
    await onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <label className="text-xs font-semibold text-neutral-500">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} mt-1 block w-40`}>
          {TASK_STATUSES.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <div className="text-xs font-semibold text-neutral-500">
        Progress
        <div className="mt-1 flex flex-wrap gap-1">
          {PROGRESS_STEPS.map((step) => {
            // Highlight by bucket, not exact value, so an existing task at e.g. 45 still
            // shows "In progress" as active. Clicking sets that bucket's representative value.
            const active = progressLabel(progress) === step.label;
            return (
              <button
                key={step.label}
                type="button"
                onClick={() => setProgress(step.value)}
                aria-pressed={active}
                className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
                }`}
              >
                {step.label}
              </button>
            );
          })}
        </div>
      </div>

      <label className="min-w-[200px] flex-1 text-xs font-semibold text-neutral-500">
        Comment
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="What changed?"
          required
          minLength={2}
          className={`${input} mt-1 block w-full`}
        />
      </label>

      <button disabled={saving} className={btnPrimary}>
        {saving ? "Saving..." : "Save update"}
      </button>

      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}
