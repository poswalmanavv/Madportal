import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { DESIGN_APPROVAL_STATUSES } from "@shared/constants";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageDesign, sessionUser } from "@backend/rbac";
import { designStatusUpdateSchema } from "@backend/validators";
import DesignRequest from "@backend/models/DesignRequest";
import Notification from "@backend/models/Notification";
import PerformanceLog from "@backend/models/PerformanceLog";

// Design requests were write-only: they were created, never displayed and never
// actionable, so the assigned designer had no way to work them. This lets the designer
// move their own request forward and attach the finished artwork.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = designStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    await connectDB();
    const design = await DesignRequest.findById(id);
    if (!design) return NextResponse.json({ error: "Design request not found" }, { status: 404 });

    const isAssignedDesigner = String(design.assignedDesigner) === current.id;
    const isApprover = canManageDesign(current);
    if (!isAssignedDesigner && !isApprover) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Separation of duties: a designer may take work up to "Submitted", but signing it off
    // is the design head's or secretary's call. Otherwise a designer could approve their
    // own work and close the loop on themselves.
    const isApprovalStatus = (DESIGN_APPROVAL_STATUSES as readonly string[]).includes(payload.data.status);
    if (isApprovalStatus && !isApprover) {
      return NextResponse.json(
        { error: "Only the Design Head or a secretary can approve or reject a design request" },
        { status: 403 }
      );
    }

    design.status = payload.data.status;
    if (payload.data.finalSubmissionLink) design.finalSubmissionLink = payload.data.finalSubmissionLink;
    await design.save();

    await PerformanceLog.create({
      user: current.id,
      type: "design",
      action: `moved design request to ${payload.data.status}`,
      referenceId: design._id,
      points: payload.data.status === "Submitted" ? 3 : 1
    });

    // Notify the other side of the handoff: the requester when the designer submits, the
    // designer when the request is signed off.
    const notifyUser = isAssignedDesigner ? design.requestedBy : design.assignedDesigner;
    await Notification.create({
      user: notifyUser,
      title: "Design request updated",
      message: `${current.name} moved ${design.designTitle} to ${payload.data.status}`,
      type: "design"
    });

    return NextResponse.json(design);
  });
}
