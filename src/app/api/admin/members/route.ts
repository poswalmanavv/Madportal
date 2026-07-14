import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, escapeRegex, handleRoute, parseJson } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import { adminCreateMemberSchema } from "@backend/validators";
import User from "@backend/models/User";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    await connectDB();
    const params = new URL(request.url).searchParams;
    const filter: Record<string, unknown> = {};
    if (params.get("year")) filter.year = params.get("year");
    if (params.get("team")) filter.departments = params.get("team");

    const q = params.get("q");
    if (q) {
      // Escaped: an unescaped user string here is a ReDoS vector.
      const pattern = new RegExp(escapeRegex(q), "i");
      filter.$or = [{ name: pattern }, { email: pattern }];
    }

    return NextResponse.json(await User.find(filter).sort({ year: 1, name: 1 }).lean());
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

    await connectDB();
    const email = payload.data.email.toLowerCase();
    const passwordHash = await bcrypt.hash(payload.data.password, 12);

    try {
      const member = await User.create({
        name: payload.data.name,
        email,
        year: payload.data.year,
        departments: payload.data.departments,
        passwordHash,
        role: "member",
        teamHeadRole: payload.data.teamHeadRole,
        canManageTeam: payload.data.canManageTeam
      });
      // Explicit projection. The document from create() carries passwordHash in memory even
      // though the schema marks it select:false, and this route used to serialize it whole.
      return NextResponse.json(
        {
          id: member._id,
          name: member.name,
          email: member.email,
          year: member.year,
          role: member.role,
          departments: member.departments,
          teamHeadRole: member.teamHeadRole,
          canManageTeam: member.canManageTeam
        },
        { status: 201 }
      );
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      throw error;
    }
  });
}
