import { and, desc, eq, like, or } from "drizzle-orm";
import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { db, newId } from "@backend/db";
import { badJson, escapeLike, handleRoute, parseJson } from "@backend/http";
import { logPerformance, notify } from "@backend/queries";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { contentEntries, contentHistory } from "@backend/schema";
import { contentEntrySchema } from "@backend/validators";

export async function GET(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const q = new URL(request.url).searchParams.get("q");
    const scope = canManageTasks(current) ? undefined : eq(contentEntries.createdBy, current.id);
    const search = q
      ? or(like(contentEntries.contentTitle, `%${escapeLike(q)}%`), like(contentEntries.platform, `%${escapeLike(q)}%`))
      : undefined;

    const rows = await db
      .select()
      .from(contentEntries)
      .where(and(scope, search))
      .orderBy(desc(contentEntries.deadline));

    return NextResponse.json(rows.map((row) => ({ ...row, _id: row.id })));
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await parseJson(request);
    if (!body.ok) return badJson();

    const payload = contentEntrySchema.safeParse(body.data);
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    const id = newId();
    await db.insert(contentEntries).values({
      id,
      contentTitle: payload.data.contentTitle,
      contentType: payload.data.contentType,
      platform: payload.data.platform,
      deadline: new Date(payload.data.deadline).toISOString(),
      description: payload.data.description,
      currentStatus: payload.data.currentStatus,
      detailedUpdate: payload.data.detailedUpdate,
      link: payload.data.link || null,
      createdBy: current.id
    });

    await db.insert(contentHistory).values({
      id: newId(),
      entryId: id,
      actor: current.id,
      update: payload.data.detailedUpdate,
      status: payload.data.currentStatus
    });

    await logPerformance(current.id, "content", "created content entry", id, 2);
    await notify(current.id, "Content updated", `${payload.data.contentTitle} was added`, "content");

    return NextResponse.json({ id, _id: id, ...payload.data }, { status: 201 });
  });
}
