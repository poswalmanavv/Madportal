import { and, desc, eq, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, escapeLike, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { epEntries } from "@backend/schema";
import { epEntrySchema } from "@backend/validators";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(request.url).searchParams.get("q");

    // A leader sees every entry; a member sees only their own.
    const scope = canManageTasks(current) ? undefined : eq(epEntries.createdBy, current.id);
    // Mongo used a $text index; SQLite gets a LIKE with the wildcards escaped so a user's
    // "%" or "_" cannot turn into a wildcard match.
    const search = q ? or(like(epEntries.epName, `%${escapeLike(q)}%`), like(epEntries.organization, `%${escapeLike(q)}%`)) : undefined;

    // and() ignores undefined operands, so this covers all four combinations of
    // scoped/unscoped and searching/not.
    const where = and(scope, search);
    const rows = await db.select().from(epEntries).where(where).orderBy(desc(epEntries.date));

    // Keep `_id` alongside `id` -- the dashboard and tests key off it.
    return NextResponse.json(rows.map((row) => ({ ...row, _id: row.id })));
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

    const id = newId();
    await db.insert(epEntries).values({
      id,
      epName: payload.data.epName,
      organization: payload.data.organization,
      contactNumber: payload.data.contactNumber,
      email: payload.data.email,
      personContacted: payload.data.personContacted,
      date: new Date(payload.data.date).toISOString(),
      discussionSummary: payload.data.discussionSummary,
      currentStatus: payload.data.currentStatus,
      detailedUpdate: payload.data.detailedUpdate,
      attachNotes: payload.data.attachNotes ?? null,
      createdBy: current.id
    });

    await logPerformance(current.id, "ep", "created EP entry", id, 2);
    await notify(current.id, "EP entry added", `${payload.data.epName} was added`, "ep");

    return NextResponse.json({ id, _id: id, ...payload.data }, { status: 201 });
  });
}
