import { eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { canAccessTaskThread, listComments } from "@backend/comment-queries";
import { db } from "@backend/db";
import { handleRoute } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import {
  commentAttachments,
  commentMentions,
  taskAssignees,
  taskComments,
  tasks,
  taskTimeline
} from "@backend/schema";
import { getTaskById, listTaskTimeline } from "@backend/task-queries";

/**
 * One task in full: its fields, its activity trail, and its comment thread.
 *
 * Returned together so the detail view is a single request rather than three. Visible to an
 * assignee or a leader -- the same rule as the comment thread and task updates.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (!(await canAccessTaskThread(current, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const [timeline, comments] = await Promise.all([listTaskTimeline(id), listComments(id)]);
    return NextResponse.json({ ...task, timeline, comments });
  });
}

/**
 * Deletes a task outright. SECRETARIES ONLY.
 *
 * Deliberately narrower than every other task permission: a team head can create and update
 * tasks, but not destroy them. Deletion loses the timeline -- the record of who did what and
 * when -- so it is restricted to the people accountable for the club's data, and cannot be
 * used by a team lead to erase evidence of a missed deadline.
 */
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (current.role !== "secretary") {
      return NextResponse.json({ error: "Only a secretary can delete a task" }, { status: 403 });
    }

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // The child rows are removed explicitly rather than relying on ON DELETE CASCADE:
    // SQLite only enforces foreign keys when `PRAGMA foreign_keys = ON`, which is off by
    // default, so cascade cannot be assumed. Doing it by hand is correct either way.
    //
    // Comments carry their own children (mentions, attachments), which have no task_id of
    // their own -- they must be cleared via the comment ids or they are orphaned forever,
    // and a stale mention would keep counting toward someone's unread badge.
    const commentIds = (
      await db.select({ id: taskComments.id }).from(taskComments).where(eq(taskComments.taskId, id))
    ).map((row) => row.id);

    // One batch = one round trip.
    await db.batch([
      ...(commentIds.length
        ? [
            db.delete(commentMentions).where(inArray(commentMentions.commentId, commentIds)),
            db.delete(commentAttachments).where(inArray(commentAttachments.commentId, commentIds))
          ]
        : []),
      db.delete(taskComments).where(eq(taskComments.taskId, id)),
      db.delete(taskTimeline).where(eq(taskTimeline.taskId, id)),
      db.delete(taskAssignees).where(eq(taskAssignees.taskId, id)),
      db.delete(tasks).where(eq(tasks.id, id))
    ] as never);

    // PerformanceLog rows are left alone on purpose. They are an audit trail of who did what,
    // and they reference the task by id without a foreign key -- deleting them would erase
    // members' contribution history along with the task.

    return NextResponse.json({ ok: true, deleted: id });
  });
}
