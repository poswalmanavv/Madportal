import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { epEntrySchema } from "@backend/validators";
import EPEntry from "@backend/models/EPEntry";
import Notification from "@backend/models/Notification";
import PerformanceLog from "@backend/models/PerformanceLog";

// This route did not exist. The EP form in the dashboard has always POSTed to
// /api/ep-entries, so every "Add New EP" submission 404'd and silently failed --
// EP records could only ever be created by the seed script.

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    await connectDB();

    const q = new URL(request.url).searchParams.get("q");
    const filter: Record<string, unknown> = canManageTasks(current) ? {} : { createdBy: current.id };
    if (q) filter.$text = { $search: q };

    return NextResponse.json(await EPEntry.find(filter).sort({ date: -1 }).lean());
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = epEntrySchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    await connectDB();
    const entry = await EPEntry.create({
      ...payload.data,
      date: new Date(payload.data.date),
      createdBy: current.id
    });

    await PerformanceLog.create({
      user: current.id,
      type: "ep",
      action: "created EP entry",
      referenceId: entry._id,
      points: 2
    });
    await Notification.create({
      user: current.id,
      title: "EP entry added",
      message: `${payload.data.epName} was added`,
      type: "ep"
    });

    return NextResponse.json(entry, { status: 201 });
  });
}
