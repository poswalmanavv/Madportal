import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, nowIso } from "@backend/db";
import { badJson, handleRoute, parseJson, tooManyRequests } from "@backend/http";
import { getUserRowById } from "@backend/queries";
import { rateLimit, sweepExpired } from "@backend/rate-limit";
import { sessionUser } from "@backend/rbac";
import { users } from "@backend/schema";
import { changePasswordSchema } from "@backend/validators";

const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Throttled because this endpoint verifies the current password: unlimited attempts
    // would let a stolen session brute-force the password it does not know.
    sweepExpired();
    const limit = rateLimit(`change-password:${current.id}`, MAX_ATTEMPTS, WINDOW_MS);
    if (!limit.ok) return tooManyRequests(limit.retryAfterSeconds);

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = changePasswordSchema.safeParse(body.data);
    if (!payload.success) {
      return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
    }

    const user = await getUserRowById(current.id);
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const valid = await bcrypt.compare(payload.data.currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
    }

    await db
      .update(users)
      .set({
        passwordHash: await bcrypt.hash(payload.data.newPassword, 12),
        // Stamped so the jwt callback can revoke every session issued before this moment.
        // Without it a stolen token stayed valid for its full 30-day life after a change.
        passwordChangedAt: nowIso(),
        updatedAt: nowIso()
      })
      .where(eq(users.id, current.id));

    return NextResponse.json({ ok: true });
  });
}
