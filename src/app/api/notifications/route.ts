import { and, count, desc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import { notifications } from "@backend/schema";

const PAGE_SIZE = 20;

export async function GET() {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Always scoped to the caller: a notification belongs to exactly one user.
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, current.id))
      .orderBy(desc(notifications.createdAt))
      .limit(PAGE_SIZE);

    const [unread] = await db
      .select({ value: count() })
      .from(notifications)
      .where(and(eq(notifications.userId, current.id), eq(notifications.read, false)));

    return NextResponse.json({
      // `user` and `_id` are mirrored for the existing client and tests.
      notifications: rows.map((row) => ({ ...row, _id: row.id, user: row.userId })),
      unreadCount: unread?.value ?? 0
    });
  });
}

// Marks one notification read, or all of them when no id is supplied.
export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const id = (body.data as { id?: unknown })?.id;
    if (id !== undefined && typeof id !== "string") {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
    }
    // IDs are UUIDs now, not ObjectIds. Reject anything that is not one rather than letting
    // a junk value silently match nothing.
    if (typeof id === "string" && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
    }

    // `userId: current.id` is part of the filter, not just the lookup -- without it a caller
    // could mark someone else's notification read by guessing an id.
    const where = and(
      eq(notifications.userId, current.id),
      eq(notifications.read, false),
      typeof id === "string" ? eq(notifications.id, id) : undefined
    );

    await db.update(notifications).set({ read: true }).where(where);
    return NextResponse.json({ ok: true });
  });
}
