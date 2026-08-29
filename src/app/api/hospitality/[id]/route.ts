import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { hospitalityEntries, hospitalityHistory, users } from "@backend/schema";
import { hospitalityStatusUpdateSchema } from "@backend/validators";

// The entry plus its full history trail, for the detail view.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const [row] = await db
      .select({ entry: hospitalityEntries, creator: { id: users.id, name: users.name, year: users.year } })
      .from(hospitalityEntries)
      .innerJoin(users, eq(users.id, hospitalityEntries.createdBy))
      .where(eq(hospitalityEntries.id, id))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Hospitality entry not found" }, { status: 404 });

    if (row.entry.createdBy !== current.id && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const history = await db
      .select({ entry: hospitalityHistory, actorName: users.name })
      .from(hospitalityHistory)
      .innerJoin(users, eq(users.id, hospitalityHistory.actor))
      .where(eq(hospitalityHistory.entryId, id))
      .orderBy(desc(hospitalityHistory.createdAt));

    return NextResponse.json({
      ...row.entry,
      _id: row.entry.id,
      createdByUser: row.creator,
      history: history.map((h) => ({ ...h.entry, actorName: h.actorName }))
    });
  });
}

// Advances an existing hospitality entry and appends to its history trail.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = hospitalityStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const [entry] = await db.select().from(hospitalityEntries).where(eq(hospitalityEntries.id, id)).limit(1);
    if (!entry) return NextResponse.json({ error: "Hospitality entry not found" }, { status: 404 });

    const isOwner = entry.createdBy === current.id;
    if (!isOwner && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(hospitalityEntries)
      .set({
        currentStatus: payload.data.currentStatus,
        detailedUpdate: payload.data.detailedUpdate,
        updatedAt: nowIso()
      })
      .where(eq(hospitalityEntries.id, id));

    await db.insert(hospitalityHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(
      current.id,
      "hospitality",
      `moved hospitality entry to ${payload.data.currentStatus}`,
      id,
      payload.data.currentStatus === "Completed" ? 3 : 1
    );

    if (!isOwner) {
      await notify(
        entry.createdBy,
        "Hospitality updated",
        `${current.name} moved ${entry.guestName} to ${payload.data.currentStatus}`,
        "hospitality"
      );
    }

    const [updated] = await db.select().from(hospitalityEntries).where(eq(hospitalityEntries.id, id)).limit(1);
    return NextResponse.json({ ...updated, _id: updated.id });
  });
}
