import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { canManageDesign, sessionUser } from "@/lib/rbac";
import { designRequestSchema } from "@/lib/validators";
import DesignRequest from "@/models/DesignRequest";
import Notification from "@/models/Notification";

export async function GET() {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const filter = canManageDesign(current) ? {} : { assignedDesigner: current.id };
  const requests = await DesignRequest.find(filter).populate("assignedDesigner", "name email").sort({ deadline: 1 }).lean();
  return NextResponse.json(requests);
}

export async function POST(request: Request) {
  const current = sessionUser(await auth());
  if (!current || !canManageDesign(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const payload = designRequestSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  await connectDB();
  const design = await DesignRequest.create({
    ...payload.data,
    deadline: new Date(payload.data.deadline),
    requestedBy: current.id
  });
  await Notification.create({
    user: payload.data.assignedDesigner,
    title: "New design request",
    message: payload.data.designTitle,
    type: "design"
  });
  return NextResponse.json(design, { status: 201 });
}
