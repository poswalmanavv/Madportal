import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { canViewMember, isLeader, type AppUser } from "./rbac";
import { designRequests, epEntries, sponsorshipEntries, users } from "./schema";
import { listAllTasks, listTasksForAssignee } from "./task-queries";
import { listUsers } from "./queries";

/**
 * Builds the single aggregate the dashboard reads.
 *
 * Both the server component (src/app/dashboard/page.tsx) and GET /api/dashboard call this,
 * so the first paint and every later refresh are guaranteed to produce the same shape.
 * Under Mongo those were two separate hand-written queries that had already drifted apart.
 */
export async function buildDashboard(current: AppUser) {
  const leader = isLeader(current);

  const allUsers = await listUsers({ activeOnly: true });
  // Performance visibility: a secretary sees the whole club, a leader sees only members who
  // share a team with them, everyone else sees only themselves.
  const visibleUsers = allUsers.filter((user) => canViewMember(current, user as never));

  const [tasks, epRows, sponsorRows, designRows] = await Promise.all([
    leader ? listAllTasks() : listTasksForAssignee(current.id),
    leader
      ? db.select().from(epEntries).orderBy(desc(epEntries.date))
      : db.select().from(epEntries).where(eq(epEntries.createdBy, current.id)).orderBy(desc(epEntries.date)),
    leader
      ? db.select().from(sponsorshipEntries).orderBy(desc(sponsorshipEntries.dateContacted))
      : db
          .select()
          .from(sponsorshipEntries)
          .where(eq(sponsorshipEntries.createdBy, current.id))
          .orderBy(desc(sponsorshipEntries.dateContacted)),
    leader
      ? db
          .select({ request: designRequests, name: users.name, email: users.email, id: users.id })
          .from(designRequests)
          .innerJoin(users, eq(users.id, designRequests.assignedDesigner))
          .orderBy(asc(designRequests.deadline))
      : db
          .select({ request: designRequests, name: users.name, email: users.email, id: users.id })
          .from(designRequests)
          .innerJoin(users, eq(users.id, designRequests.assignedDesigner))
          .where(eq(designRequests.assignedDesigner, current.id))
          .orderBy(asc(designRequests.deadline))
  ]);

  const epList = epRows.map((row) => ({ ...row, _id: row.id }));
  const sponsorshipList = sponsorRows.map((row) => ({ ...row, _id: row.id }));
  const designList = designRows.map((row) => ({
    ...row.request,
    _id: row.request.id,
    assignedDesigner: { _id: row.id, id: row.id, name: row.name, email: row.email }
  }));

  const memberStats = visibleUsers.map((member) => {
    const assigned = tasks.filter((task) => task.assignedTo.some((a) => a.id === member.id));
    const completed = assigned.filter((task) => task.status === "Completed");
    const memberEp = epList.filter((entry) => entry.createdBy === member.id);
    const memberSponsorship = sponsorshipList.filter((entry) => entry.createdBy === member.id);

    const lastActivity = [...assigned, ...memberEp, ...memberSponsorship]
      .map((item) => new Date(item.updatedAt ?? item.createdAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id: member.id,
      _id: member.id,
      name: member.name,
      email: member.email,
      year: member.year,
      departments: member.departments,
      teamHeadRole: member.teamHeadRole,
      totalTasksAssigned: assigned.length,
      totalTasksCompleted: completed.length,
      totalEPEntries: memberEp.length,
      totalSponsorshipEntries: memberSponsorship.length,
      pendingWork: assigned.length - completed.length,
      completionPercentage: assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0,
      lastActivityDate: lastActivity?.toISOString() ?? null
    };
  });

  const monthly: Record<string, number> = {};
  for (const item of [...tasks, ...epList, ...sponsorshipList]) {
    const month = new Date(item.createdAt).toLocaleString("en", { month: "short" });
    monthly[month] = (monthly[month] ?? 0) + 1;
  }

  const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

  return {
    current,
    stats: {
      members: visibleUsers.length,
      activeMembers: visibleUsers.length,
      tasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === "Completed").length,
      epEntries: epList.length,
      sponsorships: sponsorshipList.length
    },
    memberStats,
    tasks,
    epEntries: epList,
    sponsorships: sponsorshipList,
    designRequests: designList,
    charts: {
      monthlyContributions: Object.entries(monthly).map(([month, count]) => ({ month, count })),
      teamPerformance: visibleUsers.flatMap((member) =>
        member.departments.map((team) => ({
          team,
          completion: memberStats.find((stat) => stat.id === member.id)?.completionPercentage ?? 0
        }))
      ),
      yearPerformance: YEARS.map((year) => {
        const inYear = memberStats.filter((stat) => stat.year === year);
        return {
          year,
          members: inYear.length,
          completion: Math.round(
            inYear.reduce((sum, stat) => sum + stat.completionPercentage, 0) / Math.max(inYear.length, 1)
          )
        };
      }),
      topContributors: [...memberStats]
        .sort(
          (a, b) =>
            b.totalTasksCompleted +
            b.totalEPEntries +
            b.totalSponsorshipEntries -
            (a.totalTasksCompleted + a.totalEPEntries + a.totalSponsorshipEntries)
        )
        .slice(0, 5)
    }
  };
}
