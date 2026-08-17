import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { contentEntries, contentHistory } from "@backend/schema";
import { contentStatusUpdateSchema } from "@backend/validators";

// Advances an existing content entry and appends to its history trail.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = contentStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const [entry] = await db.select().from(contentEntries).where(eq(contentEntries.id, id)).limit(1);
    if (!entry) return NextResponse.json({ error: "Content entry not found" }, { status: 404 });

    const isOwner = entry.createdBy === current.id;
    if (!isOwner && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(contentEntries)
      .set({
        currentStatus: payload.data.currentStatus,
        detailedUpdate: payload.data.detailedUpdate,
        updatedAt: nowIso()
      })
      .where(eq(contentEntries.id, id));

    await db.insert(contentHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(
      current.id,
      "content",
      `moved content entry to ${payload.data.currentStatus}`,
      id,
      payload.data.currentStatus === "Published" ? 3 : 1
    );

    if (!isOwner) {
      await notify(
        entry.createdBy,
        "Content updated",
        `${current.name} moved ${entry.contentTitle} to ${payload.data.currentStatus}`,
        "content"
      );
    }

    const [updated] = await db.select().from(contentEntries).where(eq(contentEntries.id, id)).limit(1);
    return NextResponse.json({ ...updated, _id: updated.id });
  });
}
