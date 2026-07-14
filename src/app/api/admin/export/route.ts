import { NextResponse } from "next/server";
import { unparse } from "papaparse";
import { auth } from "@backend/auth";
import { connectDB } from "@backend/db";
import { handleRoute } from "@backend/http";
import { sessionUser } from "@backend/rbac";
import Task from "@backend/models/Task";
import User from "@backend/models/User";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// A spreadsheet treats a leading =, +, - or @ as a formula, so a member who names
// themselves `=HYPERLINK(...)` gets code executed in whoever opens the export. Prefixing
// with an apostrophe forces the cell to be read as text.
function neutralizeFormula(value: unknown) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

export async function GET(request: Request) {
  return handleRoute(async () => {
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
    const header = Object.keys(rows[0] ?? {}).map((cell) => `<th>${escapeHtml(cell)}</th>`).join("");
    const body = rows
      .map((row) => `<tr>${Object.values(row).map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`)
      .join("");
    return new NextResponse(`<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`, {
      headers: {
        "Content-Type": "application/vnd.ms-excel",
        "Content-Disposition": 'attachment; filename="mad-club-performance.xls"'
      }
    });
  }

  const safeRows = rows.map((row) =>
    Object.fromEntries(Object.entries(row).map(([key, value]) => [key, neutralizeFormula(value)]))
  );

  return new NextResponse(unparse(safeRows), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="mad-club-performance.csv"'
    }
  });
  });
}
