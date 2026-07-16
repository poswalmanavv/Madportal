"use client";

import { useCallback, useEffect, useState } from "react";
import { AtSign } from "lucide-react";
import { EmptyState, PageHeader, btnGhost, card, formatDateTime } from "./ui";

type Mention = {
  commentId: string;
  taskId: string;
  taskTitle: string;
  taskStatus: string | null;
  body: string;
  author: string;
  createdAt: string;
  read: boolean;
};

/**
 * Every comment the current user was @-mentioned in. Clicking one opens that task, and marks
 * the mention read so the sidebar badge clears.
 */
export function MentionsView({
  onOpenTask,
  refresh
}: {
  onOpenTask: (taskId: string) => void;
  refresh: () => Promise<void>;
}) {
  const [mentions, setMentions] = useState<Mention[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const response = await fetch("/api/mentions");
    setLoading(false);
    if (!response.ok) return;
    const body = await response.json();
    setMentions(body.mentions ?? []);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function markRead(commentId?: string) {
    await fetch("/api/mentions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(commentId ? { commentId } : {})
    });
    // Refresh the dashboard too, so the sidebar badge recounts.
    await Promise.all([load(), refresh()]);
  }

  const unread = mentions.filter((mention) => !mention.read).length;

  return (
    <div>
      <PageHeader
        title="Mentions"
        subtitle={
          unread
            ? `${unread} unread ${unread === 1 ? "mention" : "mentions"}`
            : "Comments where someone tagged you"
        }
      >
        {unread > 0 && (
          <button onClick={() => markRead()} className={btnGhost}>
            Mark all read
          </button>
        )}
      </PageHeader>

      {loading && <p className="text-sm text-neutral-500">Loading...</p>}

      {!loading && mentions.length === 0 && (
        <EmptyState message="Nobody has mentioned you yet. When they do, it will show up here." />
      )}

      <ul className="space-y-2">
        {mentions.map((mention) => (
          <li key={mention.commentId}>
            <button
              onClick={async () => {
                if (!mention.read) await markRead(mention.commentId);
                onOpenTask(mention.taskId);
              }}
              className={`${card} flex w-full items-start gap-3 text-left transition hover:border-brand/40 ${
                mention.read ? "" : "border-brand/40 bg-brand/[0.03]"
              }`}
            >
              <span
                className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                  mention.read ? "bg-neutral-100 text-neutral-400 dark:bg-neutral-800" : "bg-brand/10 text-brand"
                }`}
              >
                <AtSign size={14} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold">{mention.author}</span>
                  <span className="text-xs text-neutral-400">mentioned you on</span>
                  <span className="truncate text-sm font-medium text-brand">{mention.taskTitle}</span>
                  {!mention.read && (
                    <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-bold text-white">New</span>
                  )}
                </span>
                <span className="mt-1 block break-words text-sm text-neutral-600 dark:text-neutral-300">
                  {mention.body}
                </span>
                <span className="mt-1 block text-xs text-neutral-400">{formatDateTime(mention.createdAt)}</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
