import { NextResponse } from "next/server";
import { unparse } from "papaparse";
import { auth } from "@/lib/auth";
import { connectDB } from "@/lib/db";
import { sessionUser } from "@/lib/rbac";
import Task from "@/models/Task";
import User from "@/models/User";

export async function GET(request: Request) {
  const current = sessionUser(await auth());
  if (!current || current.role !== "secretary") return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  await connectDB();

  const users = await User.find({ active: true }).lean();
  const tasks = await Task.find({}).lean();
  const rows = users.map((member) => {
    const assigned = tasks.filter((task) => task.assignedTo.some((id: unknown) => String(id) === String(member._id)));
    const completed = assigned.filter((task) => task.status === "Completed");
    return {
      name: member.name,
      email: member.email,
      year: member.year,
      departments: member.departments?.join("; "),
      teamHeadRole: member.teamHeadRole,
      totalTasksAssigned: assigned.length,
      totalTasksCompleted: completed.length,
      pendingWork: assigned.length - completed.length,
      completionPercentage: assigned.length ? Math.round((completed.length / assigned.length) * 100) : 0
    };
  });

  const format = new URL(request.url).searchParams.get("format");
  if (format === "excel") {
    const header = Object.keys(rows[0] ?? {}).map((cell) => `<th>${cell}</th>`).join("");
    const body = rows.map((row) => `<tr>${Object.values(row).map((cell) => `<td>${cell}</td>`).join("")}</tr>`).join("");
    return new NextResponse(`<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`, {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": 'attachment; filename="mad-club-performance.xls"'
      }
    });
  }

  return new NextResponse(unparse(rows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="mad-club-performance.csv"'
    }
  });
}
