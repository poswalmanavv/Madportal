import { redirect } from "next/navigation";
import { auth } from "@backend/auth";
import { buildDashboard } from "@backend/dashboard";
import { sessionUser } from "@backend/rbac";
import { DashboardClient } from "@frontend/components/DashboardClient";

async function getDashboardData() {
  const session = await auth();
  if (!session?.user) redirect("/login/member");

  const current = sessionUser(session)!;
  // The same builder GET /api/dashboard uses, so the first paint and every later refresh
  // cannot drift apart -- under Mongo these were two hand-written queries that already had.
  // Serialized because values must cross the server/client boundary as plain JSON.
  return JSON.parse(JSON.stringify(await buildDashboard(current)));
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardClient initialData={data} />;
}
