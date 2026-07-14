import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { buildDashboard } from "@backend/dashboard";
import { handleRoute } from "@backend/http";
import { sessionUser } from "@backend/rbac";

export async function GET() {
  return handleRoute(async () => {
    const current = sessionUser(await auth());
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    return NextResponse.json(await buildDashboard(current));
  });
}
