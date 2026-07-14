import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@backend/db";

// Uptime probe. Reports database reachability, so a monitor can distinguish "app is up"
// from "app is up but cannot reach Mongo".
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await connectDB();
    await mongoose.connection.db?.admin().ping();
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("[health] database unreachable:", error);
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
