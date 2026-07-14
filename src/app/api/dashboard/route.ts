import { NextResponse } from "next/server";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { handleRoute } from "@backend/http";
import { canViewMember, isLeader, sessionUser } from "@backend/rbac";
import DesignRequest from "@backend/models/DesignRequest";
import EPEntry from "@backend/models/EPEntry";
import SponsorshipEntry from "@backend/models/SponsorshipEntry";
import Task from "@backend/models/Task";
import User from "@backend/models/User";

function monthName(date: Date) {
  return date.toLocaleString("en", { month: "short" });
}

export async function GET() {
  return handleRoute(async () => {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const users = await User.find({ active: true }).lean();
  const visibleUsers = users.filter((user) => canViewMember(current, user as never));
  const visibleIds = visibleUsers.map((user) => String(user._id));

  // Was `role === "secretary" || year === "4th Year"`, repeated inline three times. Since
  // `year` is self-declared at signup, that handed the whole org's data to anyone who
  // registered as a 4th year. isLeader() keys off secretary/teamHeadRole/canManageTeam.
  const leader = isLeader(current);
  const scope = leader ? {} : { createdBy: current.id };

  const [tasks, epEntries, sponsorships, designRequests] = await Promise.all([
    Task.find(leader ? {} : { assignedTo: current.id })
      .populate("assignedTo", "name email year departments")
      .lean(),
    EPEntry.find(scope).lean(),
    SponsorshipEntry.find(scope).lean(),
    DesignRequest.find(leader ? {} : { assignedDesigner: current.id })
      .populate("assignedDesigner", "name email")
      .lean()
  ]);

  const memberStats = visibleUsers.map((member) => {
    const id = String(member._id);
    const assigned = tasks.filter((task) => task.assignedTo?.some((assignee: any) => String(assignee._id ?? assignee) === id));
    const completed = assigned.filter((task) => task.status === "Completed");
    const memberEp = epEntries.filter((entry) => String(entry.createdBy) === id);
    const memberSponsorship = sponsorships.filter((entry) => String(entry.createdBy) === id);
    const lastActivity = [...assigned, ...memberEp, ...memberSponsorship]
      .map((item: any) => new Date(item.updatedAt ?? item.createdAt))
      .sort((a, b) => b.getTime() - a.getTime())[0];

    return {
      id,
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
  [...tasks, ...epEntries, ...sponsorships].forEach((item: any) => {
    const month = monthName(new Date(item.createdAt));
    monthly[month] = (monthly[month] ?? 0) + 1;
  });

  const teamPerformance = visibleUsers.flatMap((member) =>
    (member.departments ?? []).map((team: string) => ({
      team,
      completion: memberStats.find((stat) => stat.id === String(member._id))?.completionPercentage ?? 0
    }))
  );

  return NextResponse.json({
    current,
    stats: {
      members: visibleUsers.length,
      tasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === "Completed").length,
      epEntries: epEntries.length,
      sponsorships: sponsorships.length,
      activeMembers: visibleIds.length
    },
    memberStats,
    tasks,
    epEntries,
    sponsorships,
    designRequests,
    charts: {
      monthlyContributions: Object.entries(monthly).map(([month, count]) => ({ month, count })),
      teamPerformance,
      yearPerformance: ["1st Year", "2nd Year", "3rd Year", "4th Year"].map((year) => ({
        year,
        members: visibleUsers.filter((member) => member.year === year).length,
        completion: Math.round(
          memberStats.filter((stat) => stat.year === year).reduce((sum, stat) => sum + stat.completionPercentage, 0) /
            Math.max(memberStats.filter((stat) => stat.year === year).length, 1)
        )
      })),
      topContributors: [...memberStats]
        .sort((a, b) => b.totalTasksCompleted + b.totalEPEntries + b.totalSponsorshipEntries - (a.totalTasksCompleted + a.totalEPEntries + a.totalSponsorshipEntries))
        .slice(0, 5)
    }
  });
  });
}
