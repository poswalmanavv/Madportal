import { and, desc, eq, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, escapeLike, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { sponsorshipEntries, sponsorshipHistory } from "@backend/schema";
import { sponsorshipSchema } from "@backend/validators";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(request.url).searchParams.get("q");
    const scope = canManageTasks(current) ? undefined : eq(sponsorshipEntries.createdBy, current.id);
    const search = q
      ? or(
          like(sponsorshipEntries.companyName, `%${escapeLike(q)}%`),
          like(sponsorshipEntries.industry, `%${escapeLike(q)}%`)
        )
      : undefined;

    const rows = await db
      .select()
      .from(sponsorshipEntries)
      .where(and(scope, search))
      .orderBy(desc(sponsorshipEntries.dateContacted));

    return NextResponse.json(rows.map((row) => ({ ...row, _id: row.id })));
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = sponsorshipSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const id = newId();
    await db.insert(sponsorshipEntries).values({
      id,
      companyName: payload.data.companyName,
      industry: payload.data.industry,
      companyWebsite: payload.data.companyWebsite || null,
      contactPersonName: payload.data.contactPersonName,
      designation: payload.data.designation,
      contactNumber: payload.data.contactNumber,
      email: payload.data.email,
      dateContacted: new Date(payload.data.dateContacted).toISOString(),
      sponsorshipRequirement: payload.data.sponsorshipRequirement,
      currentStatus: payload.data.currentStatus,
      followUpDate: payload.data.followUpDate ? new Date(payload.data.followUpDate).toISOString() : null,
      detailedUpdate: payload.data.detailedUpdate,
      createdBy: current.id
    });

    await db.insert(sponsorshipHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(current.id, "sponsorship", "created sponsorship entry", id, 2);
    await notify(current.id, "Sponsorship updated", `${payload.data.companyName} was added`, "sponsorship");

    return NextResponse.json({ id, _id: id, ...payload.data }, { status: 201 });
  });
}
