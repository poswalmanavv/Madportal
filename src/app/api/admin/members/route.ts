import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { listUsers, setUserDepartments } from "@backend/queries";
import { sessionUser } from "@backend/rbac";
import { users } from "@backend/schema";
import { adminCreateMemberSchema } from "@backend/validators";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const params = new URL(request.url).searchParams;
    const year = params.get("year");
    const team = params.get("team");
    const q = params.get("q")?.toLowerCase();

    // The member list is club-sized, so filtering in memory is simpler than assembling a
    // dynamic WHERE across the departments join, and it keeps the search free of any
    // wildcard-injection concern.
    let all = await listUsers();
    if (year) all = all.filter((user) => user.year === year);
    if (team) all = all.filter((user) => user.departments.includes(team));
    if (q) all = all.filter((user) => `${user.name} ${user.email}`.toLowerCase().includes(q));

    all.sort((a, b) => a.year.localeCompare(b.year) || a.name.localeCompare(b.name));
    return NextResponse.json(all.map((user) => ({ ...user, _id: user.id })));
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = adminCreateMemberSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const email = payload.data.email.toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const id = newId();
    await db.insert(users).values({
      id,
      name: payload.data.name,
      email,
      passwordHash: await bcrypt.hash(payload.data.password, 12),
      year: payload.data.year,
      role: "member",
      teamHeadRole: payload.data.teamHeadRole,
      canManageTeam: payload.data.canManageTeam
    });
    await setUserDepartments(id, payload.data.departments);

    // Explicit projection: the password hash must never appear in a response body.
    return NextResponse.json(
      {
        id,
        _id: id,
        name: payload.data.name,
        email,
        year: payload.data.year,
        role: "member",
        departments: payload.data.departments,
        teamHeadRole: payload.data.teamHeadRole,
        canManageTeam: payload.data.canManageTeam
      },
      { status: 201 }
    );
  });
}
