import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { epEntries, epHistory } from "@backend/schema";
import { epStatusUpdateSchema } from "@backend/validators";

// Moves an existing EP entry along the pipeline and records who moved it and why.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = epStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const [entry] = await db.select().from(epEntries).where(eq(epEntries.id, id)).limit(1);
    if (!entry) return NextResponse.json({ error: "EP entry not found" }, { status: 404 });

    // The member who owns the entry, or a team lead. Nobody else may move it.
    const isOwner = entry.createdBy === current.id;
    if (!isOwner && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(epEntries)
      .set({
        currentStatus: payload.data.currentStatus,
        detailedUpdate: payload.data.detailedUpdate,
        updatedAt: nowIso()
      })
      .where(eq(epEntries.id, id));

    await db.insert(epHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(
      current.id,
      "ep",
      `moved EP entry to ${payload.data.currentStatus}`,
      id,
      payload.data.currentStatus === "Confirmed" ? 3 : 1
    );

    // Tell the owner when someone else moves their entry.
    if (!isOwner) {
      await notify(
        entry.createdBy,
        "EP entry updated",
        `${current.name} moved ${entry.epName} to ${payload.data.currentStatus}`,
        "ep"
      );
    }

    const [updated] = await db.select().from(epEntries).where(eq(epEntries.id, id)).limit(1);
    return NextResponse.json({ ...updated, _id: updated.id });
  });
}
