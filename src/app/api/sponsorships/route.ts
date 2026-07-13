import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { canManageTasks, sessionUser } from "@/lib/rbac";
import { sponsorshipSchema } from "@/lib/validators";
import Notification from "@/models/Notification";
import PerformanceLog from "@/models/PerformanceLog";
import SponsorshipEntry from "@/models/SponsorshipEntry";

export async function GET(request: Request) {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await connectDB();
  const q = new URL(request.url).searchParams.get("q");
  const filter: Record<string, unknown> = canManageTasks(current) ? {} : { createdBy: current.id };
  if (q) filter.$text = { $search: q };
  return NextResponse.json(await SponsorshipEntry.find(filter).sort({ dateContacted: -1 }).lean());
}

export async function POST(request: Request) {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const payload = sponsorshipSchema.safeParse(await request.json());
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
}
