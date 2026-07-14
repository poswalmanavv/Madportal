import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { sponsorshipStatusUpdateSchema } from "@backend/validators";
import Notification from "@backend/models/Notification";
import PerformanceLog from "@backend/models/PerformanceLog";
import SponsorshipEntry from "@backend/models/SponsorshipEntry";

// Sponsorships were create-only: whatever status you picked at creation was the status
// forever, so the "pipeline" never actually moved. This advances an existing entry and
// appends to its history trail.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = sponsorshipStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    await connectDB();
    const entry = await SponsorshipEntry.findById(id);
    if (!entry) return NextResponse.json({ error: "Sponsorship entry not found" }, { status: 404 });

    // The member who owns the entry, or a team lead. Anyone else is not allowed to move
    // another member's sponsorship along.
    const isOwner = String(entry.createdBy) === current.id;
    if (!isOwner && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    entry.currentStatus = payload.data.currentStatus;
    entry.detailedUpdate = payload.data.detailedUpdate;
    if (payload.data.followUpDate) entry.followUpDate = new Date(payload.data.followUpDate);
    entry.history.push({
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });
    await entry.save();

    await PerformanceLog.create({
      user: current.id,
      type: "sponsorship",
      action: `moved sponsorship to ${payload.data.currentStatus}`,
      referenceId: entry._id,
      points: payload.data.currentStatus === "Confirmed" ? 3 : 1
    });

    // Tell the owner when someone else moves their entry.
    if (!isOwner) {
      await Notification.create({
        user: entry.createdBy,
        title: "Sponsorship updated",
        message: `${current.name} moved ${entry.companyName} to ${payload.data.currentStatus}`,
        type: "sponsorship"
      });
    }

    return NextResponse.json(entry);
  });
}
