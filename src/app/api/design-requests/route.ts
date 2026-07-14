import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageDesign, sessionUser } from "@backend/rbac";
import { designRequestSchema } from "@backend/validators";
import DesignRequest from "@backend/models/DesignRequest";
import Notification from "@backend/models/Notification";

export async function GET() {
  return handleRoute(async () => {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const filter = canManageDesign(current) ? {} : { assignedDesigner: current.id };
  const requests = await DesignRequest.find(filter).populate("assignedDesigner", "name email").sort({ deadline: 1 }).lean();
  return NextResponse.json(requests);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
  const current = sessionUser(await auth());
  if (!current || !canManageDesign(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await parseJson(request);
  if (!body.ok) return badJson();
  const payload = designRequestSchema.safeParse(body.data);
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
  });
}
