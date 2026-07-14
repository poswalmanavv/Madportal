import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import Notification from "@backend/models/Notification";

const PAGE_SIZE = 20;

// Notifications have been written to the database from four different routes since day
// one, but nothing ever read them back -- there was no endpoint and no UI, so the
// collection was write-only. This is the read side.
export async function GET() {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    await connectDB();
    // Always scoped to the caller: a notification belongs to exactly one user.
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user: current.id }).sort({ createdAt: -1 }).limit(PAGE_SIZE).lean(),
      Notification.countDocuments({ user: current.id, read: false })
    ]);

    return NextResponse.json({ notifications, unreadCount });
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

    // A non-ObjectId string would throw a CastError inside updateMany and surface as a 500.
    if (id !== undefined && (typeof id !== "string" || !isValidObjectId(id))) {
      return NextResponse.json({ error: "Invalid notification id" }, { status: 400 });
    }

    // `user: current.id` is part of the filter, not just the lookup -- without it a caller
    // could mark someone else's notification as read by guessing an id.
    const filter: Record<string, unknown> = { user: current.id, read: false };
    if (typeof id === "string") filter._id = id;

    await connectDB();
    const result = await Notification.updateMany(filter, { $set: { read: true } });
    return NextResponse.json({ ok: true, updated: result.modifiedCount });
  });
}
