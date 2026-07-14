import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { TEAM_HEAD_YEAR } from "@shared/constants";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson, tooManyRequests } from "@backend/http";
import { clientKey, rateLimit, sweepExpired } from "@backend/rate-limit";
import { isSecretaryEmail } from "@backend/rbac";
import { registerSchema } from "@backend/validators";
import User from "@backend/models/User";

const REGISTER_MAX = 5;
const REGISTER_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  return handleRoute(async () => {
    sweepExpired();
    const limit = rateLimit(clientKey(request, "register"), REGISTER_MAX, REGISTER_WINDOW_MS);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = registerSchema.safeParse(body.data);
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
    }

    await connectDB();
    const email = payload.data.email.toLowerCase();
    const existing = await User.findOne({ email });
    if (existing) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const passwordHash = await bcrypt.hash(payload.data.password, 12);
    // Secretary is granted only from the server-side allowlist -- it can never be
    // self-assigned, whatever the request body says.
    const role = isSecretaryEmail(email) ? "secretary" : "member";

    // A 4th year's chosen team head role takes effect immediately, which makes them a team
    // lead (see isLeader() in src/backend/rbac.ts). The schema guarantees only a 4th year can
    // reach this branch. See the SECURITY NOTE on registerSchema: without email
    // verification this is self-service team-lead access for anyone.
    const isFinalYear = payload.data.year === TEAM_HEAD_YEAR;
    const teamHeadRole = isFinalYear ? payload.data.teamHeadRole ?? "None" : "None";

    try {
      const user = await User.create({
        name: payload.data.name,
        email,
        year: payload.data.year,
        departments: payload.data.departments,
        passwordHash,
        role,
        teamHeadRole,
        // Still not self-assignable: a secretary grants this to 3rd-year deputies.
        canManageTeam: false
      });
      return NextResponse.json({ id: user._id, role: user.role, teamHeadRole: user.teamHeadRole }, { status: 201 });
    } catch (error) {
      // The findOne check above is a TOCTOU race; the unique index is the real guard.
      if ((error as { code?: number }).code === 11000) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      throw error;
    }
  });
}
