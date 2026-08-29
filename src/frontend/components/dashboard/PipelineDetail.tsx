"use client";

import { useCallback, useEffect, useState } from "react";
import { Activity as ActivityIcon, ChevronLeft, Info, RefreshCw, UserRound } from "lucide-react";
import { Avatar, RefTag, StatusPill, btnPrimary, card, formatDateTime, input } from "./ui";

/**
 * The full view of one pipeline entry (EP, Sponsorship, Hospitality, Content): the entry
 * itself, an update control, and the activity timeline built from that pipeline's own
 * `*_history` table.
 *
 * Deliberately shared across all four -- they have identical shape (a single creator, a
 * status, a history trail). Design Requests is NOT wired to this: it has no creator field, no
 * history table, and an assignee + approval flow instead, so it keeps its own inline editor in
 * PipelineView rather than being forced into a "Created By" section that doesn't fit it.
 */
export function PipelineDetail({
  id,
  endpoint,
  statuses,
  buildBody,
  commentLabel = "What changed?",
  commentRequired = true,
  titleOf,
  statusOf,
  descriptionOf,
  latestUpdateOf,
  latestUpdateLabel = "Latest Update",
  detailFields,
  currentUserId,
  canManage,
  onBack,
  refresh
}: {
  id: string;
  endpoint: string;
  statuses: readonly string[];
  buildBody: (status: string, comment: string) => Record<string, unknown>;
  commentLabel?: string;
  commentRequired?: boolean;
  titleOf: (row: Record<string, any>) => string;
  statusOf: (row: Record<string, any>) => string;
  descriptionOf?: (row: Record<string, any>) => string | undefined;
  latestUpdateOf?: (row: Record<string, any>) => string | undefined;
  latestUpdateLabel?: string;
  detailFields: (row: Record<string, any>) => Array<{ label: string; value: string }>;
  currentUserId: string;
  canManage: boolean;
  onBack: () => void;
  refresh: () => Promise<void>;
}) {
  const [detail, setDetail] = useState<Record<string, any> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(endpoint);
    setLoading(false);
    if (!response.ok) {
      setError(response.status === 403 ? "You do not have access to this entry." : "Could not load this entry.");
      return;
    }
    setError("");
    setDetail(await response.json());
  }, [endpoint]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  if (loading) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <p className="text-sm text-neutral-500">Loading...</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div>
        <BackButton onBack={onBack} />
        <p className="text-sm text-rose-600">{error || "This entry is no longer available."}</p>
      </div>
    );
  }

  const history = ((detail.history ?? []) as Array<Record<string, any>>).slice();
  const canUpdate = canManage || detail.createdBy === currentUserId;

  return (
    <div>
      <BackButton onBack={onBack} />

      <div className="grid gap-5 lg:grid-cols-[1fr_320px]">
        <div className="space-y-5">
          <section className={`${card} p-5 sm:p-6`}>
            <div className="mb-4 flex flex-wrap items-center gap-2.5">
              <RefTag id={id} />
              <span className="h-1 w-1 rounded-full bg-neutral-300 dark:bg-neutral-700" />
              <StatusPill value={statusOf(detail)} />
            </div>
            <h1 className="text-2xl font-bold leading-tight tracking-tight text-neutral-900 dark:text-neutral-50 md:text-[26px]">
              {titleOf(detail)}
            </h1>
            {descriptionOf?.(detail) && (
              <p className="mt-3 whitespace-pre-wrap text-[15px] leading-relaxed text-neutral-600 dark:text-neutral-300">
                {descriptionOf(detail)}
              </p>
            )}
            {latestUpdateOf?.(detail) && (
              <div className="mt-4 rounded-lg border-l-[3px] border-amber-400 bg-amber-50/70 py-2.5 pl-3.5 pr-3 dark:border-amber-500/70 dark:bg-amber-500/10">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-400">
                  {latestUpdateLabel}
                </p>
                <p className="mt-0.5 text-sm text-neutral-700 dark:text-neutral-300">{latestUpdateOf(detail)}</p>
              </div>
            )}
          </section>

          <section className={`${card} p-5 sm:p-6`}>
            <SectionHeader
              icon={ActivityIcon}
              title="Activity"
              trailing={
                <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-semibold text-neutral-500 dark:bg-neutral-800">
                  {history.length} {history.length === 1 ? "event" : "events"}
                </span>
              }
            />

            {history.length === 0 && <p className="py-2 text-sm text-neutral-500">No activity recorded.</p>}

            <ol>
              {history.map((event, index) => (
                <li key={String(event.id ?? index)} className="relative flex gap-3 pb-5 last:pb-0">
                  {index !== history.length - 1 && (
                    <span className="absolute left-[5px] top-3 h-full w-px bg-neutral-200 dark:bg-neutral-800" />
                  )}
                  <span className="relative z-10 mt-1 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white bg-brand dark:border-neutral-900" />
                  <div className="min-w-0 flex-1">
                    <p className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold text-neutral-900 dark:text-neutral-100">
                        {event.actorName ?? "Someone"}
                      </span>
                      <StatusPill value={event.status} />
                    </p>
                    {event.update && (
                      <p className="mt-1 break-words text-sm text-neutral-600 dark:text-neutral-300">{event.update}</p>
                    )}
                    <p className="mt-1 text-xs text-neutral-400">{formatDateTime(event.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-5">
          <section className={`${card} p-5`}>
            <SectionHeader icon={RefreshCw} title="Update" />
            {canUpdate ? (
              <UpdateForm
                endpoint={endpoint}
                currentStatus={statusOf(detail)}
                statuses={statuses}
                buildBody={buildBody}
                commentLabel={commentLabel}
                commentRequired={commentRequired}
                onDone={async () => {
                  await Promise.all([refresh(), load()]);
                }}
              />
            ) : (
              <p className="text-sm text-neutral-500">Only the creator or a team lead can update this entry.</p>
            )}
          </section>

          <section className={`${card} p-5`}>
            <SectionHeader icon={UserRound} title="Created By" />
            {detail.createdByUser ? (
              <div className="flex items-center gap-2.5">
                <Avatar name={String(detail.createdByUser.name)} size={32} />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                    {detail.createdByUser.name}
                  </span>
                  <span className="block truncate text-xs text-neutral-500">{detail.createdByUser.year}</span>
                </span>
              </div>
            ) : (
              <p className="text-sm text-neutral-500">Unknown.</p>
            )}
          </section>

          <section className={`${card} p-5`}>
            <SectionHeader icon={Info} title="Details" />
            <dl className="space-y-3 text-sm">
              {detailFields(detail).map((field) => (
                <div key={field.label} className="flex items-center justify-between gap-3">
                  <dt className="text-neutral-500">{field.label}</dt>
                  <dd className="font-medium text-neutral-900 dark:text-neutral-100">{field.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        </div>
      </div>
    </div>
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <button
      onClick={onBack}
      className="mb-5 inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition hover:text-neutral-900 dark:hover:text-neutral-100"
    >
      <ChevronLeft size={16} /> Back
    </button>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  trailing
}: {
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  trailing?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        <Icon size={14} className="text-neutral-400" />
        <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">{title}</p>
      </div>
      {trailing}
    </div>
  );
}

function UpdateForm({
  endpoint,
  currentStatus,
  statuses,
  buildBody,
  commentLabel,
  commentRequired,
  onDone
}: {
  endpoint: string;
  currentStatus: string;
  statuses: readonly string[];
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
      setError(typeof body?.error === "string" ? body.error : "Update failed.");
      return;
    }
    setComment("");
    await onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <div>
        <label className="mb-1.5 block text-xs font-medium text-neutral-500">Status</label>
        <select value={status} onChange={(event) => setStatus(event.target.value)} className={`${input} w-full`}>
          {statuses.map((value) => (
            <option key={value}>{value}</option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-neutral-500">{commentLabel}</label>
        <input
          value={comment}
          onChange={(event) => setComment(event.target.value)}
          placeholder={commentLabel}
          required={commentRequired}
          minLength={commentRequired ? 2 : undefined}
          className={`${input} w-full`}
        />
      </div>

      {error && <p className="text-xs text-rose-600">{error}</p>}

      <button disabled={saving} className={`${btnPrimary} w-full justify-center !py-2.5 text-sm`}>
        {saving ? "Saving..." : "Save update"}
      </button>
    </form>
  );
}
