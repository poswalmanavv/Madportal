import { and, desc, eq, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, escapeLike, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { hospitalityEntries, hospitalityHistory } from "@backend/schema";
import { hospitalityEntrySchema } from "@backend/validators";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(request.url).searchParams.get("q");
    const scope = canManageTasks(current) ? undefined : eq(hospitalityEntries.createdBy, current.id);
    const search = q
      ? or(
          like(hospitalityEntries.guestName, `%${escapeLike(q)}%`),
          like(hospitalityEntries.organization, `%${escapeLike(q)}%`)
        )
      : undefined;

    const rows = await db
      .select()
      .from(hospitalityEntries)
      .where(and(scope, search))
      .orderBy(desc(hospitalityEntries.arrivalDate));

    return NextResponse.json(rows.map((row) => ({ ...row, _id: row.id })));
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = hospitalityEntrySchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const id = newId();
    await db.insert(hospitalityEntries).values({
      id,
      guestName: payload.data.guestName,
      organization: payload.data.organization,
      contactNumber: payload.data.contactNumber,
      email: payload.data.email,
      arrivalDate: new Date(payload.data.arrivalDate).toISOString(),
      departureDate: payload.data.departureDate ? new Date(payload.data.departureDate).toISOString() : null,
      requirement: payload.data.requirement,
      currentStatus: payload.data.currentStatus,
      detailedUpdate: payload.data.detailedUpdate,
      createdBy: current.id
    });

    await db.insert(hospitalityHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(current.id, "hospitality", "created hospitality entry", id, 2);
    await notify(current.id, "Hospitality updated", `${payload.data.guestName} was added`, "hospitality");

    return NextResponse.json({ id, _id: id, ...payload.data }, { status: 201 });
  });
}
