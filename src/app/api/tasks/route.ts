import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { taskSchema } from "@backend/validators";
import Notification from "@backend/models/Notification";
import PerformanceLog from "@backend/models/PerformanceLog";
import Task from "@backend/models/Task";

export async function GET(request: Request) {
  return handleRoute(async () => {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const filter: Record<string, unknown> = canManageTasks(current) ? {} : { assignedTo: current.id };
  if (status) filter.status = status;

  const tasks = await Task.find(filter)
    .populate("assignedTo", "name email year departments")
    .populate("createdBy", "name email")
    .sort({ deadline: 1 })
    .lean();
  return NextResponse.json(tasks);
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

  await connectDB();
  const task = await Task.create({
    ...payload.data,
    deadline: new Date(payload.data.deadline),
    createdBy: current.id,
    status: "Pending",
    timeline: [{ actor: current.id, status: "Pending", progress: 0, comment: payload.data.remarks ?? "Task created" }]
  });

  await Notification.insertMany(
    payload.data.assignedTo.map((user) => ({
      user,
      title: "New task assigned",
      message: `${current.name} assigned: ${payload.data.title}`,
      type: "task"
    }))
  );
  await PerformanceLog.create({ user: current.id, type: "task", action: "created task", referenceId: task._id });

  return NextResponse.json(task, { status: 201 });
  });
}
