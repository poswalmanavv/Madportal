"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AtSign, ChevronLeft, Link2, Paperclip, Send, Trash2, X } from "lucide-react";
import { TASK_STATUSES } from "@shared/constants";
import {
  Avatar,
  PROGRESS_STEPS,
  PriorityPill,
  ProgressLabel,
  RefTag,
  StatusPill,
  btnGhost,
  btnPrimary,
  card,
  formatDate,
  formatDateTime,
  input,
  progressLabel
} from "./ui";

type Task = Record<string, any>;
type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  mentions: Array<{ id: string; name: string }>;
  attachments: Array<{ id: string; url: string; label: string | null }>;
};

/**
 * The full view of one task: details, the comment thread (with @mentions and link
 * attachments), the update control, and the activity timeline built from task_timeline.
 *
 * Comments are fetched here rather than bundled into /api/dashboard -- the dashboard already
 * ships every task, and loading every thread with it would be wasteful when you only ever
 * read one at a time.
 */
export function TaskDetail({
  task,
  members,
  currentUserId,
  canManage,
  canDelete,
  onBack,
  refresh
}: {
  task: Task;
  members: Array<Record<string, any>>;
  currentUserId: string;
  canManage: boolean;
  canDelete: boolean;
  onBack: () => void;
  refresh: () => Promise<void>;
}) {
  const taskId = String(task._id ?? task.id);
  // The dashboard payload carries the task's fields but not its history or thread -- those
  // are fetched here, in one request, and kept fresh after each post.
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/tasks/${taskId}`);
    setLoading(false);
    if (!response.ok) {
      setError(response.status === 403 ? "You do not have access to this task." : "Could not load this task.");
      return;
    }
    setError("");
    setDetail(await response.json());
  }, [taskId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Prefer freshly-fetched values, fall back to the row we were handed so the header renders
  // immediately instead of flashing empty.
  const view = detail ?? task;
  const comments: Comment[] = detail?.comments ?? [];
  const assignees = (view.assignedTo ?? []) as Array<Record<string, any>>;
  const timeline = ((detail?.timeline ?? []) as Array<Record<string, any>>).slice().reverse();

  async function remove() {
    if (!window.confirm(`Delete "${task.title}"?\n\nThis also removes its comments and history. It cannot be undone.`)) {
      return;
    }
    const response = await fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
    if (!response.ok) {
      setError(response.status === 403 ? "Only a secretary can delete a task." : "Could not delete the task.");
      return;
    }
    await refresh();
    onBack();
  }

  return (
    <div>
      <button onClick={onBack} className="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200">
        <ChevronLeft size={16} /> Back to tasks
      </button>

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        {/* ---------------------------------------------------------------- main column */}
        <div className="space-y-4">
          <section className={card}>
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <RefTag id={taskId} />
              <StatusPill value={view.status} />
              <PriorityPill value={view.priority} />
              <ProgressLabel value={view.progress ?? 0} />
            </div>
            <h1 className="text-xl font-bold md:text-2xl">{view.title}</h1>
            <p className="mt-2 whitespace-pre-wrap text-sm text-neutral-600 dark:text-neutral-300">
              {view.description}
            </p>
            {view.remarks && (
              <p className="mt-3 rounded-lg bg-neutral-50 p-3 text-sm text-neutral-600 dark:bg-neutral-800/60 dark:text-neutral-300">
                <span className="font-semibold">Remarks: </span>
                {view.remarks}
              </p>
            )}
          </section>

          <CommentThread
            taskId={taskId}
            comments={comments}
            loading={loading}
            error={error}
            members={members}
            currentUserId={currentUserId}
            reload={load}
          />

          <ActivityPanel timeline={timeline} />
        </div>

        {/* ------------------------------------------------------------- right sidebar */}
        <div className="space-y-4">
          <section className={card}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Update</p>
            <UpdatePanel
              taskId={taskId}
              currentStatus={view.status}
              currentProgress={view.progress ?? 0}
              canUpdate={canManage || assignees.some((a) => String(a.id ?? a._id) === currentUserId)}
              refresh={async () => {
                await Promise.all([refresh(), load()]);
              }}
            />
          </section>

          <section className={card}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Assignees</p>
            {assignees.length === 0 && <p className="text-sm text-neutral-500">Nobody assigned.</p>}
            <ul className="space-y-2">
              {assignees.map((member) => (
                <li key={String(member.id ?? member._id)} className="flex items-center gap-2">
                  <Avatar name={String(member.name)} size={30} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold">{member.name}</span>
                    <span className="block truncate text-xs text-neutral-500">{member.year}</span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className={card}>
            <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">Details</p>
            <dl className="space-y-2 text-sm">
              <Row label="Deadline" value={formatDate(view.deadline)} />
              <Row label="Created" value={formatDate(view.createdAt)} />
              <Row label="Comments" value={String(comments.length)} />
            </dl>
          </section>

          {canDelete && (
            <button
              onClick={remove}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 dark:border-rose-900 dark:bg-rose-950/40 dark:hover:bg-rose-950/70"
            >
              <Trash2 size={15} /> Delete task
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-neutral-500">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

/* ------------------------------------------------------------------------- comments */

function CommentThread({
  taskId,
  comments,
  loading,
  error,
  members,
  currentUserId,
  reload
}: {
  taskId: string;
  comments: Comment[];
  loading: boolean;
  error: string;
  members: Array<Record<string, any>>;
  currentUserId: string;
  reload: () => Promise<void>;
}) {
  return (
    <section className={card}>
      <p className="mb-3 text-[10px] font-bold uppercase tracking-widest text-neutral-500">
        Comments {comments.length > 0 && <span className="text-neutral-400">· {comments.length}</span>}
      </p>

      {loading && <p className="py-4 text-sm text-neutral-500">Loading...</p>}
      {!loading && error && <p className="py-4 text-sm text-rose-600">{error}</p>}
      {!loading && !error && comments.length === 0 && (
        <p className="py-4 text-sm italic text-neutral-500">No comments yet.</p>
      )}

      <ul className="space-y-4">
        {comments.map((comment) => (
          <li key={comment.id} className="flex gap-3">
            <Avatar name={comment.author.name} size={32} />
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <span className="font-semibold">{comment.author.name}</span>
                {comment.author.id === currentUserId && (
                  <span className="ml-1 text-xs text-neutral-400">(you)</span>
                )}
                <span className="ml-2 text-xs text-neutral-400">{formatDateTime(comment.createdAt)}</span>
              </p>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-neutral-700 dark:text-neutral-300">
                {highlightMentions(comment.body, comment.mentions)}
              </p>
              {comment.attachments.length > 0 && (
                <ul className="mt-2 flex flex-wrap gap-2">
                  {comment.attachments.map((attachment) => (
                    <li key={attachment.id}>
                      <a
                        href={attachment.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 rounded-md border border-neutral-200 px-2 py-1 text-xs font-medium text-brand hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
                      >
                        <Link2 size={12} />
                        {attachment.label || hostOf(attachment.url)}
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ul>

      {!error && <Composer taskId={taskId} members={members} reload={reload} />}
    </section>
  );
}

/** Renders @Name in brand colour for anyone actually mentioned on the comment. */
function highlightMentions(body: string, mentions: Array<{ name: string }>) {
  if (!mentions.length) return body;

  // Longest first, so "@Manav Poswal" wins over "@Manav".
  const names = mentions.map((m) => m.name).sort((a, b) => b.length - a.length);
  const pattern = new RegExp(`@(${names.map(escapeRegExp).join("|")})`, "g");

  const parts: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(body)) !== null) {
    if (match.index > last) parts.push(body.slice(last, match.index));
    parts.push(
      <span key={`${match.index}-${match[1]}`} className="rounded bg-brand/10 px-1 font-semibold text-brand">
        @{match[1]}
      </span>
    );
    last = match.index + match[0].length;
  }
  if (last < body.length) parts.push(body.slice(last));
  return parts;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hostOf(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "Attachment";
  }
}

function Composer({
  taskId,
  members,
  reload
}: {
  taskId: string;
  members: Array<Record<string, any>>;
  reload: () => Promise<void>;
}) {
  const [body, setBody] = useState("");
  const [mentions, setMentions] = useState<Array<{ id: string; name: string }>>([]);
  const [attachments, setAttachments] = useState<Array<{ url: string; label?: string }>>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const boxRef = useRef<HTMLTextAreaElement>(null);

  function addMention(member: Record<string, any>) {
    const name = String(member.name);
    if (!mentions.some((m) => m.id === member.id)) {
      setMentions((current) => [...current, { id: String(member.id), name }]);
    }
    // Drop the @Name into the text so the comment reads naturally.
    setBody((current) => `${current}${current && !current.endsWith(" ") ? " " : ""}@${name} `);
    setPickerOpen(false);
    boxRef.current?.focus();
  }

  function addAttachment() {
    const url = window.prompt("Paste a link to attach (Drive, Figma, an image URL...)");
    if (!url) return;
    try {
      new URL(url);
    } catch {
      setError("That does not look like a valid URL.");
      return;
    }
    setError("");
    setAttachments((current) => [...current, { url }]);
  }

  async function post() {
    if (!body.trim()) return;
    setSaving(true);
    setError("");

    // Only send mentions whose @Name still appears in the text -- otherwise deleting the
    // name from the comment would still notify them.
    const stillMentioned = mentions.filter((m) => body.includes(`@${m.name}`));

    const response = await fetch(`/api/tasks/${taskId}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, mentions: stillMentioned.map((m) => m.id), attachments })
    });
    setSaving(false);

    if (!response.ok) {
      setError(response.status === 403 ? "You do not have access to this task." : "Could not post the comment.");
      return;
    }
    setBody("");
    setMentions([]);
    setAttachments([]);
    await reload();
  }

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 p-2 dark:border-neutral-800">
      <textarea
        ref={boxRef}
        value={body}
        onChange={(event) => setBody(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
            event.preventDefault();
            post();
          }
        }}
        rows={3}
        placeholder="Write a comment... (Ctrl+Enter to post)"
        className="w-full resize-y bg-transparent px-2 py-1.5 text-sm outline-none"
      />

      {attachments.length > 0 && (
        <ul className="mb-2 flex flex-wrap gap-2 px-2">
          {attachments.map((attachment, index) => (
            <li
              key={`${attachment.url}-${index}`}
              className="inline-flex items-center gap-1 rounded-md bg-neutral-100 px-2 py-0.5 text-xs dark:bg-neutral-800"
            >
              <Link2 size={11} />
              {hostOf(attachment.url)}
              <button
                onClick={() => setAttachments((current) => current.filter((_, i) => i !== index))}
                aria-label="Remove attachment"
                className="text-neutral-400 hover:text-rose-600"
              >
                <X size={11} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="px-2 pb-1 text-xs text-rose-600">{error}</p>}

      <div className="relative flex items-center justify-between gap-2 border-t border-neutral-100 pt-2 dark:border-neutral-800">
        <div className="flex items-center gap-1">
          <button onClick={addAttachment} className={`${btnGhost} !px-2 !py-1 text-xs`} type="button">
            <Paperclip size={13} /> Attach
          </button>
          <button
            onClick={() => setPickerOpen((value) => !value)}
            className={`${btnGhost} !px-2 !py-1 text-xs`}
            type="button"
          >
            <AtSign size={13} /> Mention
          </button>
        </div>

        <button onClick={post} disabled={saving || !body.trim()} className={`${btnPrimary} !px-3 !py-1.5 text-xs`}>
          <Send size={13} /> {saving ? "Posting..." : "Post"}
        </button>

        {pickerOpen && (
          <div className="absolute bottom-10 left-0 z-20 max-h-52 w-60 overflow-y-auto rounded-lg border border-neutral-200 bg-white p-1 shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
            {members.length === 0 && (
              <p className="p-3 text-center text-xs text-neutral-500">No members to mention.</p>
            )}
            {members.map((member) => (
              <button
                key={String(member.id)}
                onClick={() => addMention(member)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <Avatar name={String(member.name)} size={22} />
                <span className="flex-1 truncate">{member.name}</span>
                <span className="text-xs text-neutral-400">{member.year}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------------- activity */

function ActivityPanel({ timeline }: { timeline: Array<Record<string, any>> }) {
  return (
    <section className={card}>
      <div className="mb-3 flex items-center justify-between">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-500">Activity</p>
        <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[10px] font-semibold text-neutral-500 dark:bg-neutral-800">
          {timeline.length} {timeline.length === 1 ? "event" : "events"}
        </span>
      </div>

      {timeline.length === 0 && <p className="py-2 text-sm text-neutral-500">No activity recorded.</p>}

      <ol className="space-y-3">
        {timeline.map((event, index) => (
          <li key={String(event.id ?? index)} className="flex gap-3">
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand" />
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-semibold">{event.actorName ?? "Someone"}</span>
                <StatusPill value={event.status} />
                <ProgressLabel value={event.progress ?? 0} />
              </p>
              {event.comment && (
                <p className="mt-0.5 break-words text-sm text-neutral-600 dark:text-neutral-300">{event.comment}</p>
              )}
              <p className="mt-0.5 text-xs text-neutral-400">{formatDateTime(event.createdAt)}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* --------------------------------------------------------------------- update panel */

function UpdatePanel({
  taskId,
  currentStatus,
  currentProgress,
  canUpdate,
  refresh
}: {
  taskId: string;
  currentStatus: string;
  currentProgress: number;
  canUpdate: boolean;
  refresh: () => Promise<void>;
}) {
  const [status, setStatus] = useState(currentStatus ?? "Pending");
  const [progress, setProgress] = useState(currentProgress ?? 0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const activeLabel = useMemo(() => progressLabel(progress), [progress]);

  if (!canUpdate) {
    return <p className="text-sm text-neutral-500">Only an assignee or a team lead can update this task.</p>;
  }

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
      setError(response.status === 403 ? "You are not assigned to this task." : "Add a comment of at least 2 characters.");
      return;
    }
    setComment("");
    await refresh();
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${input} w-full`}>
        {TASK_STATUSES.map((value) => (
          <option key={value}>{value}</option>
        ))}
      </select>

      <div className="flex flex-wrap gap-1">
        {PROGRESS_STEPS.map((step) => (
          <button
            key={step.label}
            type="button"
            onClick={() => setProgress(step.value)}
            aria-pressed={activeLabel === step.label}
            className={`rounded-lg border px-2 py-1 text-[11px] font-semibold transition ${
              activeLabel === step.label
                ? "border-brand bg-brand/10 text-brand"
                : "border-neutral-300 text-neutral-600 hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-800"
            }`}
          >
            {step.label}
          </button>
        ))}
      </div>

      <input
        value={comment}
        onChange={(event) => setComment(event.target.value)}
        placeholder="What changed?"
        required
        minLength={2}
        className={`${input} w-full`}
      />

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button disabled={saving} className={`${btnPrimary} w-full justify-center !py-2 text-xs`}>
        {saving ? "Saving..." : "Save update"}
      </button>
    </form>
  );
}
