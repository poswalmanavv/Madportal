import { and, asc, count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { canManageTasks, type AppUser } from "./rbac";
import { commentAttachments, commentMentions, taskComments, users } from "./schema";
import { assigneeIdsFor } from "./task-queries";

/**
 * Comment reads.
 *
 * Who may see or comment on a task's thread is the same rule as updating the task: an
 * assignee, or a leader. Kept here so the two routes cannot drift apart.
 */
export async function canAccessTaskThread(current: AppUser, taskId: string) {
  if (canManageTasks(current)) return true;
  const assignees = await assigneeIdsFor(taskId);
  return assignees.includes(current.id);
}

export type CommentView = {
  id: string;
  body: string;
  createdAt: string;
  author: { id: string; name: string; email: string };
  mentions: Array<{ id: string; name: string }>;
  attachments: Array<{ id: string; url: string; label: string | null }>;
};

/** Every comment on a task, oldest first, with author, mentions and attachments. */
export async function listComments(taskId: string): Promise<CommentView[]> {
  const rows = await db
    .select({ comment: taskComments, authorName: users.name, authorEmail: users.email })
    .from(taskComments)
    .innerJoin(users, eq(users.id, taskComments.authorId))
    .where(eq(taskComments.taskId, taskId))
    .orderBy(asc(taskComments.createdAt));

  if (!rows.length) return [];
  const ids = rows.map((row) => row.comment.id);

  // Two more round trips regardless of comment count, rather than one per comment.
  const [mentionRows, attachmentRows] = await Promise.all([
    db
      .select({ commentId: commentMentions.commentId, id: users.id, name: users.name })
      .from(commentMentions)
      .innerJoin(users, eq(users.id, commentMentions.userId))
      .where(inArray(commentMentions.commentId, ids)),
    db.select().from(commentAttachments).where(inArray(commentAttachments.commentId, ids))
  ]);

  const mentionsByComment = new Map<string, Array<{ id: string; name: string }>>();
  for (const row of mentionRows) {
    const list = mentionsByComment.get(row.commentId) ?? [];
    list.push({ id: row.id, name: row.name });
    mentionsByComment.set(row.commentId, list);
  }

  const attachmentsByComment = new Map<string, Array<{ id: string; url: string; label: string | null }>>();
  for (const row of attachmentRows) {
    const list = attachmentsByComment.get(row.commentId) ?? [];
    list.push({ id: row.id, url: row.url, label: row.label });
    attachmentsByComment.set(row.commentId, list);
  }

  return rows.map((row) => ({
    id: row.comment.id,
    body: row.comment.body,
    createdAt: row.comment.createdAt,
    author: { id: row.comment.authorId, name: row.authorName, email: row.authorEmail },
    mentions: mentionsByComment.get(row.comment.id) ?? [],
    attachments: attachmentsByComment.get(row.comment.id) ?? []
  }));
}

/** How many unread mentions the user has. Drives the sidebar badge. One round trip. */
export async function unreadMentionCount(userId: string) {
  const [row] = await db
    .select({ value: count() })
    .from(commentMentions)
    .where(and(eq(commentMentions.userId, userId), eq(commentMentions.read, false)));
  return row?.value ?? 0;
}

/** Comments the user is mentioned in, newest first, with the task they belong to. */
export async function listMentionsFor(userId: string) {
  const rows = await db
    .select({
      commentId: commentMentions.commentId,
      read: commentMentions.read,
      body: taskComments.body,
      createdAt: taskComments.createdAt,
      taskId: taskComments.taskId,
      authorName: users.name
    })
    .from(commentMentions)
    .innerJoin(taskComments, eq(taskComments.id, commentMentions.commentId))
    .innerJoin(users, eq(users.id, taskComments.authorId))
    .where(eq(commentMentions.userId, userId))
    .orderBy(desc(taskComments.createdAt));

  return rows;
}
