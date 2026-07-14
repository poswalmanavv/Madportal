"use client";

import { Bell } from "lucide-react";
import { EmptyState, PageHeader, btnGhost, card, formatDateTime } from "./ui";

export function NotificationsView({
  notifications,
  unread,
  markAllRead
}: {
  notifications: Array<Record<string, any>>;
  unread: number;
  markAllRead: () => Promise<void>;
}) {
  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle={unread ? `${unread} unread` : "You are all caught up"}
        count={notifications.length}
      >
        {unread > 0 && (
          <button onClick={markAllRead} className={btnGhost}>
            Mark all read
          </button>
        )}
      </PageHeader>

      <div className={card}>
        {notifications.length ? (
          <ul>
            {notifications.map((item) => (
              <li
                key={String(item._id ?? item.id)}
                className={`flex gap-3 border-b border-neutral-100 p-4 last:border-0 dark:border-neutral-800 ${
                  item.read ? "" : "bg-brand/[0.04]"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                    item.read ? "bg-neutral-100 dark:bg-neutral-800" : "bg-brand/10"
                  }`}
                >
                  <Bell size={15} className={item.read ? "text-neutral-400" : "text-brand"} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="text-sm font-semibold">{item.title}</span>
                    {!item.read && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}
                  </span>
                  <span className="mt-0.5 block text-sm text-neutral-600 dark:text-neutral-400">{item.message}</span>
                  <span className="mt-1 block text-[11px] uppercase tracking-wide text-neutral-400">
                    {formatDateTime(item.createdAt)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="Nothing yet. You will be notified when a task is assigned to you or a request moves." />
        )}
      </div>
    </>
  );
}
