import { desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { sponsorshipEntries, sponsorshipHistory, users } from "@backend/schema";
import { sponsorshipStatusUpdateSchema } from "@backend/validators";

// The entry plus its full history trail, for the detail view.
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await params;
    const [row] = await db
      .select({ entry: sponsorshipEntries, creator: { id: users.id, name: users.name, year: users.year } })
      .from(sponsorshipEntries)
      .innerJoin(users, eq(users.id, sponsorshipEntries.createdBy))
      .where(eq(sponsorshipEntries.id, id))
      .limit(1);
    if (!row) return NextResponse.json({ error: "Sponsorship entry not found" }, { status: 404 });

    if (row.entry.createdBy !== current.id && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const history = await db
      .select({ entry: sponsorshipHistory, actorName: users.name })
      .from(sponsorshipHistory)
      .innerJoin(users, eq(users.id, sponsorshipHistory.actor))
      .where(eq(sponsorshipHistory.entryId, id))
      .orderBy(desc(sponsorshipHistory.createdAt));

    return NextResponse.json({
      ...row.entry,
      _id: row.entry.id,
      createdByUser: row.creator,
      history: history.map((h) => ({ ...h.entry, actorName: h.actorName }))
    });
  });
}

// Advances an existing sponsorship and appends to its history trail.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = sponsorshipStatusUpdateSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const [entry] = await db.select().from(sponsorshipEntries).where(eq(sponsorshipEntries.id, id)).limit(1);
    if (!entry) return NextResponse.json({ error: "Sponsorship entry not found" }, { status: 404 });

    const isOwner = entry.createdBy === current.id;
    if (!isOwner && !canManageTasks(current)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await db
      .update(sponsorshipEntries)
      .set({
        currentStatus: payload.data.currentStatus,
        detailedUpdate: payload.data.detailedUpdate,
        followUpDate: payload.data.followUpDate
          ? new Date(payload.data.followUpDate).toISOString()
          : entry.followUpDate,
        updatedAt: nowIso()
      })
      .where(eq(sponsorshipEntries.id, id));

    await db.insert(sponsorshipHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(
      current.id,
      "sponsorship",
      `moved sponsorship to ${payload.data.currentStatus}`,
      id,
      payload.data.currentStatus === "Confirmed" ? 3 : 1
    );

    if (!isOwner) {
      await notify(
        entry.createdBy,
        "Sponsorship updated",
        `${current.name} moved ${entry.companyName} to ${payload.data.currentStatus}`,
        "sponsorship"
      );
    }

    const [updated] = await db.select().from(sponsorshipEntries).where(eq(sponsorshipEntries.id, id)).limit(1);
    return NextResponse.json({ ...updated, _id: updated.id });
  });
}
