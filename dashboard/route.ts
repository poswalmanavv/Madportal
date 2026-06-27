import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { canViewMember, sessionUser } from "@/lib/rbac";
import EPEntry from "@/models/EPEntry";
import SponsorshipEntry from "@/models/SponsorshipEntry";
import Task from "@/models/Task";
import User from "@/models/User";

function monthName(date: Date) {
  return date.toLocaleString("en", { month: "short" });
}

export async function GET() {
  const current = sessionUser(await auth());
  if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await connectDB();
  const users = await User.find({ active: true }).lean();
  const visibleUsers = users.filter((user) => canViewMember(current, user as never));
  const visibleIds = visibleUsers.map((user) => String(user._id));

  const taskFilter =
    current.role === "secretary" || current.year === "4th Year"
      ? {}
      : { assignedTo: current.id };

  const [tasks, epEntries, sponsorships] = await Promise.all([
    Task.find(taskFilter).populate("assignedTo", "name email year departments").lean(),
    EPEntry.find(current.role === "secretary" || current.year === "4th Year" ? {} : { createdBy: current.id }).lean(),
    SponsorshipEntry.find(current.role === "secretary" || current.year === "4th Year" ? {} : { createdBy: current.id }).lean()
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
}
