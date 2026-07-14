import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { tasks, taskTimeline } from "@backend/schema";
import { assigneeIdsFor, getTaskById } from "@backend/task-queries";
import { taskUpdateSchema } from "@backend/validators";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = taskUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const task = await getTaskById(id);
    if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

    // Only an assignee or a team lead may move a task. This is the IDOR guard.
    const assignees = await assigneeIdsFor(id);
    if (!assignees.includes(current.id) && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(tasks)
      .set({ status: payload.data.status, progress: payload.data.progress, updatedAt: nowIso() })
      .where(eq(tasks.id, id));

    await db.insert(taskTimeline).values({
      id: newId(),
      taskId: id,
      actor: current.id,
      status: payload.data.status,
      progress: payload.data.progress,
      comment: payload.data.comment
    });

    await notify(
      task.createdBy,
      "Task update added",
      `${current.name} updated ${task.title} to ${payload.data.status}`,
      "task"
    );
    await logPerformance(
      current.id,
      "task",
      payload.data.status === "Completed" ? "completed task" : "updated task",
      id,
      payload.data.status === "Completed" ? 3 : 1
    );

    const updated = await getTaskById(id);
    return NextResponse.json(updated);
  });
}
