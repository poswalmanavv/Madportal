import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { notify } from "@backend/queries";
import { canManageDesign, sessionUser } from "@backend/rbac";
import { designRequests, users } from "@backend/schema";
import { designRequestSchema } from "@backend/validators";

// Joins the assigned designer so the UI can show a name rather than an id.
async function listDesignRequests(scopeToDesignerId?: string) {
  const rows = await db
    .select({
      request: designRequests,
      designerId: users.id,
      designerName: users.name,
      designerEmail: users.email
    })
    .from(designRequests)
    .innerJoin(users, eq(users.id, designRequests.assignedDesigner))
    .where(scopeToDesignerId ? eq(designRequests.assignedDesigner, scopeToDesignerId) : undefined)
    .orderBy(asc(designRequests.deadline));

  return rows.map((row) => ({
    ...row.request,
    _id: row.request.id,
    assignedDesigner: { _id: row.designerId, id: row.designerId, name: row.designerName, email: row.designerEmail }
  }));
}

export async function GET() {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // The design head and secretaries see everything; a designer sees only their own work.
    const requests = canManageDesign(current) ? await listDesignRequests() : await listDesignRequests(current.id);
    return NextResponse.json(requests);
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || !canManageDesign(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = designRequestSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const id = newId();
    await db.insert(designRequests).values({
      id,
      designTitle: payload.data.designTitle,
      requirement: payload.data.requirement,
      description: payload.data.description,
      assignedDesigner: payload.data.assignedDesigner,
      requestedBy: current.id,
      deadline: new Date(payload.data.deadline).toISOString(),
      status: payload.data.status,
      finalSubmissionLink: payload.data.finalSubmissionLink || null
    });

    await notify(payload.data.assignedDesigner, "New design request", payload.data.designTitle, "design");

    return NextResponse.json({ id, _id: id, ...payload.data }, { status: 201 });
  });
}
