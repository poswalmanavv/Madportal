import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { badJson, handleRoute, parseJson } from "@backend/http";
import { canManageTasks, sessionUser } from "@backend/rbac";
import { sponsorshipSchema } from "@backend/validators";
import Notification from "@backend/models/Notification";
import PerformanceLog from "@backend/models/PerformanceLog";
import SponsorshipEntry from "@backend/models/SponsorshipEntry";

export async function GET(request: Request) {
  return handleRoute(async () => {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const q = new URL(request.url).searchParams.get("q");
  const filter: Record<string, unknown> = canManageTasks(current) ? {} : { createdBy: current.id };
  if (q) filter.$text = { $search: q };
  return NextResponse.json(await SponsorshipEntry.find(filter).sort({ dateContacted: -1 }).lean());
  });
}

export async function POST(request: Request) {
  return handleRoute(async () => {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await parseJson(request);
  if (!body.ok) return badJson();
  const payload = sponsorshipSchema.safeParse(body.data);
  if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });
  await connectDB();
  const entry = await SponsorshipEntry.create({
    ...payload.data,
    dateContacted: new Date(payload.data.dateContacted),
    followUpDate: payload.data.followUpDate ? new Date(payload.data.followUpDate) : undefined,
    createdBy: current.id,
    history: [{ actor: current.id, update: payload.data.detailedUpdate, status: payload.data.currentStatus }]
  });
  await PerformanceLog.create({ user: current.id, type: "sponsorship", action: "created sponsorship entry", referenceId: entry._id, points: 2 });
  await Notification.create({ user: current.id, title: "Sponsorship updated", message: `${payload.data.companyName} was added`, type: "sponsorship" });
  return NextResponse.json(entry, { status: 201 });
  });
}
