import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { TEAM_HEAD_YEAR } from "@shared/constants";
import { db, newId } from "@backend/db";
import { badJson, handleRoute, parseJson, tooManyRequests } from "@backend/http";
import { setUserDepartments } from "@backend/queries";
import { clientKey, rateLimit, sweepExpired } from "@backend/rate-limit";
import { isSecretaryEmail } from "@backend/rbac";
import { users } from "@backend/schema";
import { registerSchema } from "@backend/validators";

// Per IP, per hour. Kept low enough to throttle spam signups, but not so low that a group
// of members registering from the same campus network locks each other out -- five was.
const REGISTER_MAX = 10;
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

    const email = payload.data.email.toLowerCase();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (existing.length) return NextResponse.json({ error: "Email already registered" }, { status: 409 });

    const passwordHash = await bcrypt.hash(payload.data.password, 12);
    // Secretary is granted only from the server-side allowlist -- it can never be
    // self-assigned, whatever the request body says.
    const role = isSecretaryEmail(email) ? "secretary" : "member";

    // A 4th year's chosen team head role takes effect immediately, which makes them a team
    // lead (see isLeader() in src/backend/rbac.ts). The schema guarantees only a 4th year
    // can reach this branch. See the SECURITY NOTE on registerSchema.
    const isFinalYear = payload.data.year === TEAM_HEAD_YEAR;
    const teamHeadRole = isFinalYear ? payload.data.teamHeadRole ?? "None" : "None";

    const id = newId();

    try {
      await db.insert(users).values({
        id,
        name: payload.data.name,
        email,
        passwordHash,
        year: payload.data.year,
        role,
        teamHeadRole,
        // Still not self-assignable: a secretary grants this to 3rd-year deputies.
        canManageTeam: false
      });
    } catch (error) {
      // The select above is a TOCTOU race; the UNIQUE index on email is the real guard.
      if (String((error as Error).message).includes("UNIQUE")) {
        return NextResponse.json({ error: "Email already registered" }, { status: 409 });
      }
      throw error;
    }

    await setUserDepartments(id, payload.data.departments);

    return NextResponse.json({ id, role, teamHeadRole }, { status: 201 });
  });
}
