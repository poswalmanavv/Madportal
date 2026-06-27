import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { DashboardClient } from "@/components/DashboardClient";
import EPEntry from "@/models/EPEntry";
import SponsorshipEntry from "@/models/SponsorshipEntry";
import Task from "@/models/Task";
import User from "@/models/User";

async function getDashboardData() {
  const session = await auth();
  if (!session?.user) redirect("/login/member");
  await connectDB();

  const current = session.user;
  const isLeader = current.role === "secretary" || current.year === "4th Year";
  const users = await User.find({ active: true }).lean();
  const tasks = await Task.find(isLeader ? {} : { assignedTo: current.id }).populate("assignedTo", "name email year departments").lean();
  const epEntries = await EPEntry.find(isLeader ? {} : { createdBy: current.id }).lean();
  const sponsorships = await SponsorshipEntry.find(isLeader ? {} : { createdBy: current.id }).lean();

  const memberStats = users
    .filter((member) => current.role === "secretary" || String(member._id) === current.id || (current.year === "4th Year" && member.year !== "4th Year"))
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
