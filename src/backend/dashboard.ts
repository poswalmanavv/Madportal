import { asc, desc, eq } from "drizzle-orm";
import { db } from "./db";
import { canViewMember, isLeader, type AppUser } from "./rbac";
import { contentEntries, designRequests, epEntries, hospitalityEntries, sponsorshipEntries, users } from "./schema";
import { listAllTasks, listTasksForAssignee } from "./task-queries";
import { listUsers } from "./queries";
import { unreadMentionCount } from "./comment-queries";

/**
 * Builds the single aggregate the dashboard reads.
 *
 * Both the server component (src/app/dashboard/page.tsx) and GET /api/dashboard call this,
 * so the first paint and every later refresh are guaranteed to produce the same shape.
 * Under Mongo those were two separate hand-written queries that had already drifted apart.
 */
export async function buildDashboard(current: AppUser) {
  const leader = isLeader(current);

  // PERFORMANCE: these are independent, so they go over the wire as ONE batch -- a single
  // round trip to Turso instead of five sequential ones. Promise.all would still have sent
  // five separate HTTP requests; batch() sends one. When the database is far from the
  // function, this is the difference between a snappy dashboard and a multi-second one.
  const epQuery = leader
    ? db.select().from(epEntries).orderBy(desc(epEntries.date))
    : db.select().from(epEntries).where(eq(epEntries.createdBy, current.id)).orderBy(desc(epEntries.date));

  const sponsorQuery = leader
    ? db.select().from(sponsorshipEntries).orderBy(desc(sponsorshipEntries.dateContacted))
    : db
        .select()
        .from(sponsorshipEntries)
        .where(eq(sponsorshipEntries.createdBy, current.id))
        .orderBy(desc(sponsorshipEntries.dateContacted));

  const hospitalityQuery = leader
    ? db.select().from(hospitalityEntries).orderBy(desc(hospitalityEntries.arrivalDate))
    : db
        .select()
        .from(hospitalityEntries)
        .where(eq(hospitalityEntries.createdBy, current.id))
        .orderBy(desc(hospitalityEntries.arrivalDate));

  const contentQuery = leader
    ? db.select().from(contentEntries).orderBy(desc(contentEntries.deadline))
    : db
        .select()
        .from(contentEntries)
        .where(eq(contentEntries.createdBy, current.id))
        .orderBy(desc(contentEntries.deadline));

  const designSelection = {
    request: designRequests,
    name: users.name,
    email: users.email,
    id: users.id
  };
  const designQuery = leader
    ? db
        .select(designSelection)
        .from(designRequests)
        .innerJoin(users, eq(users.id, designRequests.assignedDesigner))
        .orderBy(asc(designRequests.deadline))
    : db
        .select(designSelection)
        .from(designRequests)
        .innerJoin(users, eq(users.id, designRequests.assignedDesigner))
        .where(eq(designRequests.assignedDesigner, current.id))
        .orderBy(asc(designRequests.deadline));

  const [epRows, sponsorRows, designRows, hospitalityRows, contentRows] = await db.batch([
    epQuery,
    sponsorQuery,
    designQuery,
    hospitalityQuery,
    contentQuery
  ]);

  // These each need their joined rows regrouped in JS, so they stay separate calls -- but
  // each is itself a single round trip.
  const [allUsers, tasks, mentionCount] = await Promise.all([
    listUsers({ activeOnly: true }),
    leader ? listAllTasks() : listTasksForAssignee(current.id),
    unreadMentionCount(current.id)
  ]);

  // Performance visibility: a secretary sees the whole club, a leader sees only members who
  // share a team with them, everyone else sees only themselves.
  const visibleUsers = allUsers.filter((user) => canViewMember(current, user as never));

  const epList = epRows.map((row) => ({ ...row, _id: row.id }));
  const sponsorshipList = sponsorRows.map((row) => ({ ...row, _id: row.id }));
  const designList = designRows.map((row) => ({
    ...row.request,
    _id: row.request.id,
    assignedDesigner: { _id: row.id, id: row.id, name: row.name, email: row.email }
  }));
  const hospitalityList = hospitalityRows.map((row) => ({ ...row, _id: row.id }));
  const contentList = contentRows.map((row) => ({ ...row, _id: row.id }));

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
    mentionCount,
    stats: {
      members: visibleUsers.length,
      activeMembers: visibleUsers.length,
      tasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === "Completed").length,
      epEntries: epList.length,
      sponsorships: sponsorshipList.length,
      hospitalityEntries: hospitalityList.length,
      contentEntries: contentList.length
    },
    memberStats,
    tasks,
    epEntries: epList,
    sponsorships: sponsorshipList,
    designRequests: designList,
    hospitalityEntries: hospitalityList,
    contentEntries: contentList,
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
