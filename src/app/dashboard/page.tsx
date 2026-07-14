import { redirect } from "next/navigation";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { canViewMember, isLeader, sessionUser } from "@backend/rbac";
import { DashboardClient } from "@frontend/components/DashboardClient";
import DesignRequest from "@backend/models/DesignRequest";
import EPEntry from "@backend/models/EPEntry";
import SponsorshipEntry from "@backend/models/SponsorshipEntry";
import Task from "@backend/models/Task";
import User from "@backend/models/User";

async function getDashboardData() {
  const session = await auth();
  if (!session?.user) redirect("/login/member");
  await connectDB();

  const current = sessionUser(session)!;
  // Leadership comes from secretary/teamHeadRole/canManageTeam, never from the
  // self-declared `year` -- see src/backend/rbac.ts.
  const leader = isLeader(current);
  const users = await User.find({ active: true }).lean();
  const tasks = await Task.find(leader ? {} : { assignedTo: current.id }).populate("assignedTo", "name email year departments").lean();
  const epEntries = await EPEntry.find(leader ? {} : { createdBy: current.id }).lean();
  const sponsorships = await SponsorshipEntry.find(leader ? {} : { createdBy: current.id }).lean();
  const designRequests = await DesignRequest.find(leader ? {} : { assignedDesigner: current.id })
    .populate("assignedDesigner", "name email")
    .lean();

  const memberStats = users
    .filter((member) => canViewMember(current, member as never))
    .map((member) => {
      const assigned = tasks.filter((task) => task.assignedTo?.some((assignee: any) => String(assignee._id ?? assignee) === String(member._id)));
      const completed = assigned.filter((task) => task.status === "Completed");
      return {
        id: String(member._id),
        name: member.name,
        email: member.email,
        year: member.year,
        departments: member.departments,
        teamHeadRole: member.teamHeadRole,
        totalTasksAssigned: assigned.length,
        totalTasksCompleted: completed.length,
        totalEPEntries: epEntries.filter((entry) => String(entry.createdBy) === String(member._id)).length,
        totalSponsorshipEntries: sponsorships.filter((entry) => String(entry.createdBy) === String(member._id)).length,
        pendingWork: assigned.length - completed.length,
        completionPercentage: assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0
      };
    });

  const monthly: Record<string, number> = {};
  [...tasks, ...epEntries, ...sponsorships].forEach((item: any) => {
    const month = new Date(item.createdAt).toLocaleString("en", { month: "short" });
    monthly[month] = (monthly[month] ?? 0) + 1;
  });

  return JSON.parse(JSON.stringify({
    current,
    stats: {
      activeMembers: memberStats.length,
      tasks: tasks.length,
      completedTasks: tasks.filter((task) => task.status === "Completed").length,
      epEntries: epEntries.length,
      sponsorships: sponsorships.length
    },
    memberStats,
    tasks,
    epEntries,
    sponsorships,
    designRequests,
    charts: {
      monthlyContributions: Object.entries(monthly).map(([month, count]) => ({ month, count })),
      yearPerformance: ["1st Year", "2nd Year", "3rd Year", "4th Year"].map((year) => ({
        year,
        members: memberStats.filter((member) => member.year === year).length,
        completion: Math.round(memberStats.filter((member) => member.year === year).reduce((sum, member) => sum + member.completionPercentage, 0) / Math.max(memberStats.filter((member) => member.year === year).length, 1))
      })),
      topContributors: [...memberStats].sort((a, b) => b.totalTasksCompleted - a.totalTasksCompleted).slice(0, 5)
    }
  }));
}

export default async function DashboardPage() {
  const data = await getDashboardData();
  return <DashboardClient initialData={data} />;
}
