"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  Avatar,
  EmptyState,
  PageHeader,
  RefTag,
  StatusPill,
  Tag,
  btnGhost,
  btnPrimary,
  card,
  formatDate,
  input
} from "./ui";

type Row = Record<string, any>;

/** Column definition for the generic pipeline table. */
export type PipelineColumn = {
  header: string;
  render: (row: Row) => React.ReactNode;
};

export function PipelineView({
  title,
  subtitle,
  rows,
  statuses,
  columns,
  searchOf,
  titleOf,
  statusOf,
  endpoint,
  buildBody,
  commentLabel = "What changed?",
  commentRequired = true,
  refresh
}: {
  title: string;
  subtitle: string;
  rows: Row[];
  statuses: readonly string[];
  columns: PipelineColumn[];
  searchOf: (row: Row) => string;
  titleOf: (row: Row) => string;
  statusOf: (row: Row) => string;
  endpoint: (id: string) => string;
  buildBody: (status: string, comment: string) => Record<string, unknown>;
  commentLabel?: string;
  commentRequired?: boolean;
  refresh: () => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((row) => {
      const matchesQuery = !q || searchOf(row).toLowerCase().includes(q);
      const matchesStatus = !status || statusOf(row) === status;
      return matchesQuery && matchesStatus;
    });
  }, [rows, query, status, searchOf, statusOf]);

  return (
    <>
      <PageHeader title={title} subtitle={subtitle} count={filtered.length} />

      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <label className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search..."
              className={`${input} w-full pl-9`}
            />
          </label>

          <select value={status} onChange={(event) => setStatus(event.target.value)} className={input}>
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>

          {(query || status) && (
            <button
              onClick={() => {
                setQuery("");
                setStatus("");
              }}
              className={btnGhost}
            >
              Clear
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                {columns.map((column) => (
                  <th key={column.header} className="px-4 py-3 font-semibold">
                    {column.header}
                  </th>
                ))}
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => {
                const id = String(row._id ?? row.id);
                return (
                  <>
                    <tr
                      key={id}
                      className="border-b border-neutral-100 transition hover:bg-neutral-50/70 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
                    >
                      {columns.map((column) => (
                        <td key={column.header} className="px-4 py-4 align-top">
                          {column.render(row)}
                        </td>
                      ))}
                      <td className="px-4 py-4 text-right align-top">
                        <button
                          onClick={() => setOpenId(openId === id ? null : id)}
                          className={`${btnGhost} px-2 py-1 text-xs`}
                        >
                          {openId === id ? "Cancel" : "Update"}
                        </button>
                      </td>
                    </tr>
                    {openId === id && (
                      <tr
                        key={`${id}-edit`}
                        className="border-b border-neutral-100 bg-neutral-50/60 dark:border-neutral-800 dark:bg-neutral-800/30"
                      >
                        <td colSpan={columns.length + 1} className="px-4 py-4">
                          <StatusEditor
                            label={titleOf(row)}
                            currentStatus={statusOf(row)}
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
          <EmptyState message={rows.length ? "Nothing matches these filters." : "Nothing here yet."} />
        )}
      </div>
    </>
  );
}

function StatusEditor({
  label,
  currentStatus,
  statuses,
  endpoint,
  buildBody,
  commentLabel,
  commentRequired,
  onDone
}: {
  label: string;
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
      // The server sends a real message for the cases that matter -- e.g. a designer trying
      // to approve their own work. Show it rather than a generic failure.
      setError(typeof body?.error === "string" ? body.error : "Update failed.");
      return;
    }
    await onDone();
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-end gap-3">
      <p className="w-full text-xs font-semibold text-neutral-500">Updating: {label}</p>

      <label className="text-xs font-semibold text-neutral-500">
        Status
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={`${input} mt-1 block w-48`}>
          {statuses.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="min-w-[220px] flex-1 text-xs font-semibold text-neutral-500">
        {commentLabel}
        <input
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={commentLabel}
          required={commentRequired}
          minLength={commentRequired ? 2 : undefined}
          className={`${input} mt-1 block w-full`}
        />
      </label>

      <button disabled={saving} className={btnPrimary}>
        {saving ? "Saving..." : "Save"}
      </button>

      {error && <p className="w-full text-xs text-rose-600">{error}</p>}
    </form>
  );
}

/** Shared cell renderers, so the three pipelines look identical. */
export const cell = {
  ref: (id: string, title: string, sub?: string, onOpen?: () => void) => (
    <>
      <RefTag id={id} />
      {onOpen ? (
        <button onClick={onOpen} className="mt-0.5 block text-left font-semibold hover:text-brand hover:underline">
          {title}
        </button>
      ) : (
        <p className="mt-0.5 font-semibold">{title}</p>
      )}
      {sub && <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">{sub}</p>}
    </>
  ),
  status: (value: string) => <StatusPill value={value} />,
  tag: (value: string) => <Tag value={value} />,
  date: (value?: string | null) => <span className="text-sm text-neutral-500">{formatDate(value)}</span>,
  person: (name?: string | null) =>
    name ? (
      <span className="flex items-center gap-2">
        <Avatar name={name} />
        <span className="truncate text-sm">{name}</span>
      </span>
    ) : (
      <span className="text-sm text-neutral-400">Unassigned</span>
    )
};
