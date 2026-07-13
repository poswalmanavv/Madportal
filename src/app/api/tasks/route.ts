import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { canManageTasks, sessionUser } from "@/lib/rbac";
import { taskSchema } from "@/lib/validators";
import Notification from "@/models/Notification";
import PerformanceLog from "@/models/PerformanceLog";
import Task from "@/models/Task";

export async function GET(request: Request) {
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
}

export async function POST(request: Request) {
  const current = sessionUser(await auth());
  if (!current || !canManageTasks(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const payload = taskSchema.safeParse(await request.json());
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
}
