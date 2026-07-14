import { NextResponse } from "next/server";
import { pingDB } from "@backend/db";

// Uptime probe, and the first thing to check when the site feels slow: it reports how long a
// single trivial query takes and which region the function is running in. If dbLatencyMs is
// high, the database is far from the function -- see docs/BACKEND.md.
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  try {
    await pingDB();
    const dbLatencyMs = Date.now() - startedAt;

    return NextResponse.json({
      status: "ok",
      database: "connected",
      dbLatencyMs,
      // Netlify sets AWS_REGION on the function container.
      functionRegion: process.env.AWS_REGION ?? "unknown"
    });
  } catch (error) {
    console.error("[health] database unreachable:", error);
    return NextResponse.json({ status: "degraded", database: "unreachable" }, { status: 503 });
  }
}
