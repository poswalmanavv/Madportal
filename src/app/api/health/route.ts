import { NextResponse } from "next/server";
import { pingDB } from "@backend/db";

// Uptime probe. Reports database reachability, so a monitor (or a human debugging a deploy)
// can tell "app is up" apart from "app is up but cannot reach the database".
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await pingDB();
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch (error) {
    console.error("[health] database unreachable:", error);
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
