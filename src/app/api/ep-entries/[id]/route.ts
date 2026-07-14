import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { epStatusUpdateSchema } from "@backend/validators";
import EPEntry from "@backend/models/EPEntry";
import Notification from "@backend/models/Notification";
import PerformanceLog from "@backend/models/PerformanceLog";

// EP entries were create-only (and until recently could not be created at all). This
// advances an existing entry and records who moved it and why.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = epStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    await connectDB();
    const entry = await EPEntry.findById(id);
    if (!entry) return NextResponse.json({ error: "EP entry not found" }, { status: 404 });

    const isOwner = String(entry.createdBy) === current.id;
    if (!isOwner && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    entry.currentStatus = payload.data.currentStatus;
    entry.detailedUpdate = payload.data.detailedUpdate;
    entry.history.push({
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });
    await entry.save();

    await PerformanceLog.create({
      user: current.id,
      type: "ep",
      action: `moved EP entry to ${payload.data.currentStatus}`,
      referenceId: entry._id,
      points: payload.data.currentStatus === "Confirmed" ? 3 : 1
    });

    if (!isOwner) {
      await Notification.create({
        user: entry.createdBy,
        title: "EP entry updated",
        message: `${current.name} moved ${entry.epName} to ${payload.data.currentStatus}`,
        type: "ep"
      });
    }

    return NextResponse.json(entry);
  });
}
