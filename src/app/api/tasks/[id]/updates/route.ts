import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { canManageTasks, sessionUser } from "@/lib/rbac";
import { taskUpdateSchema } from "@/lib/validators";
import Notification from "@/models/Notification";
import PerformanceLog from "@/models/PerformanceLog";
import Task from "@/models/Task";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = taskUpdateSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

  await connectDB();
  const { id } = await params;
  const task = await Task.findById(id);
  if (!task) return NextResponse.json({ error: "Task not found" }, { status: 404 });

  const isAssignee = task.assignedTo.some((assignee: unknown) => String(assignee) === current.id);
  if (!isAssignee && !canManageTasks(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  task.status = payload.data.status;
  task.progress = payload.data.progress;
  task.timeline.push({ actor: current.id, ...payload.data });
  await task.save();

  await Notification.create({
    user: task.createdBy,
    title: "Task update added",
    message: `${current.name} updated ${task.title} to ${payload.data.status}`,
    type: "task"
  });
  await PerformanceLog.create({
    user: current.id,
    type: "task",
    action: payload.data.status === "Completed" ? "completed task" : "updated task",
    referenceId: task._id,
    points: payload.data.status === "Completed" ? 3 : 1
  });

  return NextResponse.json(task);
}
