import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { getUserById, setUserDepartments } from "@backend/queries";
import { sessionUser } from "@backend/rbac";
import { users } from "@backend/schema";
import { updateMemberSchema } from "@backend/validators";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = updateMemberSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    const existing = await getUserById(id);
    if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Fields are listed explicitly, so `role` can never be written through this route.
    await db
      .update(users)
      .set({
        name: payload.data.name,
        year: payload.data.year,
        teamHeadRole: payload.data.teamHeadRole,
        canManageTeam: payload.data.canManageTeam,
        active: payload.data.active,
        updatedAt: nowIso()
      })
      .where(eq(users.id, id));

    await setUserDepartments(id, payload.data.departments);

    const updated = await getUserById(id);
    return NextResponse.json({ ...updated, _id: id });
  });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const { id } = await params;
    if (id === current.id) {
      return NextResponse.json({ error: "You cannot deactivate your own account" }, { status: 400 });
    }

    const existing = await getUserById(id);
    if (!existing) return NextResponse.json({ error: "Member not found" }, { status: 404 });

    // Soft delete. The jwt callback checks `active` on every request, so this also revokes
    // any session the member currently holds.
    await db.update(users).set({ active: false, updatedAt: nowIso() }).where(eq(users.id, id));

    return NextResponse.json({ ok: true });
  });
}
