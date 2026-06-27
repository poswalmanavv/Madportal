import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { sessionUser } from "@/lib/rbac";
import { changePasswordSchema } from "@/lib/validators";
import User from "@/models/User";

export async function POST(request: Request) {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const payload = changePasswordSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  await connectDB();
  // passwordHash has `select: false`, so it must be explicitly selected.
  const user = await User.findById(current.id).select("+passwordHash");
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const valid = await bcrypt.compare(payload.data.currentPassword, user.passwordHash);
  if (!valid) {
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  user.passwordHash = await bcrypt.hash(payload.data.newPassword, 12);
  await user.save();

  return NextResponse.json({ ok: true });
}