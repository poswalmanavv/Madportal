import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notifyMany } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { taskAssignees, tasks, taskTimeline } from "@backend/schema";
import { listAllTasks, listTasksForAssignee } from "@backend/task-queries";
import { taskSchema } from "@backend/validators";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const status = new URL(request.url).searchParams.get("status");
    const all = canManageTasks(current) ? await listAllTasks() : await listTasksForAssignee(current.id);
    const filtered = status ? all.filter((task) => task.status === status) : all;

    return NextResponse.json(filtered);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || !canManageTasks(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = taskSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const id = newId();
    await db.insert(tasks).values({
      id,
      title: payload.data.title,
      description: payload.data.description,
      createdBy: current.id,
      priority: payload.data.priority,
      deadline: new Date(payload.data.deadline).toISOString(),
      status: "Pending",
      progress: 0,
      attachments: payload.data.attachments,
      remarks: payload.data.remarks ?? null
    });

    await db
      .insert(taskAssignees)
      .values(payload.data.assignedTo.map((userId) => ({ taskId: id, userId })));

    await db.insert(taskTimeline).values({
      id: newId(),
      taskId: id,
      actor: current.id,
      status: "Pending",
      progress: 0,
      comment: payload.data.remarks ?? "Task created"
    });

    // One insert for every recipient, rather than one round trip per assignee.
    await notifyMany(
      payload.data.assignedTo,
      "New task assigned",
      `${current.name} assigned: ${payload.data.title}`,
      "task"
    );
    await logPerformance(current.id, "task", "created task", id);

    return NextResponse.json({ id, _id: id, ...payload.data, status: "Pending", progress: 0 }, { status: 201 });
  });
}
