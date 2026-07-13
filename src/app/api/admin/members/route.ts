import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { sessionUser } from "@/lib/rbac";
import { registerSchema } from "@/lib/validators";
import User from "@/models/User";

export async function GET(request: Request) {
  const current = sessionUser(await auth());
  if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();
  const params = new URL(request.url).searchParams;
  const filter: Record<string, unknown> = {};
  if (params.get("year")) filter.year = params.get("year");
  if (params.get("team")) filter.departments = params.get("team");
  if (params.get("q")) filter.$or = [{ name: new RegExp(params.get("q")!, "i") }, { email: new RegExp(params.get("q")!, "i") }];
  return NextResponse.json(await User.find(filter).sort({ year: 1, name: 1 }).lean());
}

export async function POST(request: Request) {
  const current = sessionUser(await auth());
  if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const payload = registerSchema.safeParse(await request.json());
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  await connectDB();
  const passwordHash = await bcrypt.hash(payload.data.password, 12);
  const member = await User.create({
    ...payload.data,
    email: payload.data.email.toLowerCase(),
    passwordHash,
    role: "member",
    canManageTeam: payload.data.year === "3rd Year" && payload.data.teamHeadRole !== "None"
  });
  return NextResponse.json(member, { status: 201 });
}
