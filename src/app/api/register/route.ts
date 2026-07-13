import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { isSecretaryEmail } from "@/lib/rbac";
import { registerSchema } from "@/lib/validators";
import User from "@/models/User";

export async function POST(request: Request) {
  const payload = registerSchema.safeParse(await request.json());
  if (!payload.success) {
    return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  }

  await connectDB();
  const existing = await User.findOne({ email: payload.data.email.toLowerCase() });
  if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

  const passwordHash = await bcrypt.hash(payload.data.password, 12);
  const role = isSecretaryEmail(payload.data.email) ? "secretary" : "member";
  const user = await User.create({
    ...payload.data,
    email: payload.data.email.toLowerCase(),
    passwordHash,
    role,
    canManageTeam: payload.data.year === "3rd Year" && payload.data.teamHeadRole !== "None"
  });

  return NextResponse.json({ id: user._id, role: user.role }, { status: 201 });
}
