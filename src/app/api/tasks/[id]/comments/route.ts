import { inArray } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { canAccessTaskThread, listComments } from "@backend/comment-queries";
import { db, newId } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { notifyMany } from "@backend/queries";
import { sessionUser } from "@backend/rbac";
import { commentAttachments, commentMentions, taskComments, users } from "@backend/schema";
import { getTaskById } from "@backend/task-queries";
import { commentSchema } from "@backend/validators";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Same rule as updating a task: assignee or leader. A member cannot read the thread of
    // a task that is not theirs.
    if (!(await canAccessTaskThread(current, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(await listComments(id));
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = commentSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    if (!(await canAccessTaskThread(current, id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Mentions are ids from the composer, so they must be checked: a crafted request could
    // otherwise mention (and notify) anyone, or a non-existent user.
    const requested = [...new Set(payload.data.mentions)];
    const mentioned = requested.length
      ? await db.select({ id: users.id, name: users.name }).from(users).where(inArray(users.id, requested))
      : [];

    const commentId = newId();
    await db.insert(taskComments).values({
      id: commentId,
      taskId: id,
      authorId: current.id,
      body: payload.data.body
    });

    if (mentioned.length) {
      await db.insert(commentMentions).values(
        // Mentioning yourself should not light up your own badge.
        mentioned
          .filter((user) => user.id !== current.id)
          .map((user) => ({ commentId, userId: user.id, read: false }))
      );
    }

    if (payload.data.attachments.length) {
      await db.insert(commentAttachments).values(
        payload.data.attachments.map((attachment) => ({
          id: newId(),
          commentId,
          url: attachment.url,
          label: attachment.label ?? null
        }))
      );
    }

    // Notify the people mentioned, plus the task's other participants.
    const mentionIds = mentioned.map((user) => user.id).filter((userId) => userId !== current.id);
    await notifyMany(
      mentionIds,
      "You were mentioned",
      `${current.name} mentioned you on: ${task.title}`,
      "mention"
    );

    const assignees = (task.assignedTo ?? []).map((a: { id: string }) => a.id);
    const others = [...new Set([...assignees, task.createdBy])].filter(
      (userId) => userId !== current.id && !mentionIds.includes(userId)
    );
    await notifyMany(others, "New comment", `${current.name} commented on: ${task.title}`, "task");

    return NextResponse.json({ id: commentId }, { status: 201 });
  });
}
