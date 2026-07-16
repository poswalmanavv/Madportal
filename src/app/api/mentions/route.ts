import { and, eq, inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { listMentionsFor } from "@backend/comment-queries";
import { db } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import { commentMentions, tasks } from "@backend/schema";

/** Comments the caller was @-mentioned in, newest first. */
export async function GET() {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const rows = await listMentionsFor(current.id);
    if (!rows.length) return NextResponse.json({ mentions: [], unreadCount: 0 });

    // Attach the task title so the list is readable without opening each one.
    const taskIds = [...new Set(rows.map((row) => row.taskId))];
    const taskRows = await db
      .select({ id: tasks.id, title: tasks.title, status: tasks.status })
      .from(tasks)
      .where(inArray(tasks.id, taskIds));
    const byTask = new Map(taskRows.map((task) => [task.id, task]));

    return NextResponse.json({
      mentions: rows.map((row) => ({
        commentId: row.commentId,
        taskId: row.taskId,
        taskTitle: byTask.get(row.taskId)?.title ?? "(deleted task)",
        taskStatus: byTask.get(row.taskId)?.status ?? null,
        body: row.body,
        author: row.authorName,
        createdAt: row.createdAt,
        read: row.read
      })),
      unreadCount: rows.filter((row) => !row.read).length
    });
  });
}

/** Marks one mention read, or all of them when no commentId is given. */
export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const commentId = (body.data as { commentId?: unknown })?.commentId;
    if (commentId !== undefined && typeof commentId !== "string") {
      return NextResponse.json({ error: "Invalid commentId" }, { status: 400 });
    }

    // `userId: current.id` is part of the filter, not just the lookup -- without it a caller
    // could mark someone else's mention read by guessing an id.
    await db
      .update(commentMentions)
      .set({ read: true })
      .where(
        and(
          eq(commentMentions.userId, current.id),
          typeof commentId === "string" ? eq(commentMentions.commentId, commentId) : undefined
        )
      );

    return NextResponse.json({ ok: true });
  });
}
