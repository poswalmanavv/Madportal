import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { sessionUser } from "@/lib/rbac";
import User from "@/models/User";

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = sessionUser(await auth());
  if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json();
  const { id } = await params;
  await connectDB();
  const member = await User.findByIdAndUpdate(
    id,
    {
      name: body.name,
      year: body.year,
      departments: body.departments,
      teamHeadRole: body.teamHeadRole,
      canManageTeam: Boolean(body.canManageTeam),
      active: body.active ?? true
    },
    { new: true, runValidators: true }
  );
  if (!member) return NextResponse.json({ error: "Member not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const current = sessionUser(await auth());
  if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const { id } = await params;
  await connectDB();
  await User.findByIdAndUpdate(id, { active: false });
  return NextResponse.json({ ok: true });
}
