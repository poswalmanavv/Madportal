import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { DESIGN_APPROVAL_STATUSES } from "@shared/constants";
import { db, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageDesign, sessionUser } from "@backend/rbac";
import { designRequests } from "@backend/schema";
import { designStatusUpdateSchema } from "@backend/validators";

// Lets the assigned designer move their own request forward and attach the finished
// artwork; sign-off stays with the design head.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = designStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const [design] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
    if (!design) return NextResponse.json({ error: "Design request not found" }, { status: 404 });

    const isAssignedDesigner = design.assignedDesigner === current.id;
    const isApprover = canManageDesign(current);
    if (!isAssignedDesigner && !isApprover) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Separation of duties: a designer may take work up to "Submitted", but signing it off
    // is the design head's or secretary's call. Otherwise a designer could approve their own
    // work and close the loop on themselves.
    const isApprovalStatus = (DESIGN_APPROVAL_STATUSES as readonly string[]).includes(payload.data.status);
    if (isApprovalStatus && !isApprover) {
      return NextResponse.json(
        { error: "Only the Design Head or a secretary can approve or reject a design request" },
        { status: 403 }
      );
    }

    await db
      .update(designRequests)
      .set({
        status: payload.data.status,
        finalSubmissionLink: payload.data.finalSubmissionLink || design.finalSubmissionLink,
        updatedAt: nowIso()
      })
      .where(eq(designRequests.id, id));

    await logPerformance(
      current.id,
      "design",
      `moved design request to ${payload.data.status}`,
      id,
      payload.data.status === "Submitted" ? 3 : 1
    );

    // Notify the other side of the handoff: the requester when the designer submits, the
    // designer when the request is signed off.
    const notifyUser = isAssignedDesigner ? design.requestedBy : design.assignedDesigner;
    await notify(
      notifyUser,
      "Design request updated",
      `${current.name} moved ${design.designTitle} to ${payload.data.status}`,
      "design"
    );

    const [updated] = await db.select().from(designRequests).where(eq(designRequests.id, id)).limit(1);
    return NextResponse.json({ ...updated, _id: updated.id });
  });
}
