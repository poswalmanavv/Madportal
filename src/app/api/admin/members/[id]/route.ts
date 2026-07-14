import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import { updateMemberSchema } from "@backend/validators";
import User from "@backend/models/User";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    // Validated: this was the one mutating route taking a raw, unchecked body.
    const payload = updateMemberSchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const { id } = await params;
    await connectDB();
    // Fields are listed explicitly, so `role` can never be written through this route.
    const member = await User.findByIdAndUpdate(
      id,
      {
        name: payload.data.name,
        year: payload.data.year,
        departments: payload.data.departments,
        teamHeadRole: payload.data.teamHeadRole,
        canManageTeam: payload.data.canManageTeam,
        active: payload.data.active
      },
      { new: true, runValidators: true }
    );
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json(member);
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

    await connectDB();
    const member = await User.findByIdAndUpdate(id, { active: false }, { new: true });
    if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  });
}
