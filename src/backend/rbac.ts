import type { Session } from "next-auth";
import type { DepartmentName, MemberYear, TeamHeadRole } from "@shared/constants";

export type AppUser = {
  id: string;
  name: string;
  email: string;
  year: MemberYear;
  role: "member" | "secretary";
  teamHeadRole: TeamHeadRole;
  departments: DepartmentName[];
  canManageTeam: boolean;
};

export function isNitkkrEmail(email: string) {
  return email.toLowerCase().trim().endsWith("@nitkkr.ac.in");
}

export function authorizedSecretaries() {
  return (process.env.AUTHORIZED_SECRETARIES ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function isSecretaryEmail(email: string) {
  return authorizedSecretaries().includes(email.toLowerCase());
}

// Privileges must never be derived from `year` alone. `year` is self-declared at
// registration, so treating "4th Year" as a leader let anyone mint a privileged
// account by signing up. Leadership now comes only from fields a secretary controls:
// `role`, `teamHeadRole`, and `canManageTeam`.
export function isLeader(user?: AppUser | null) {
  return Boolean(
    user && (user.role === "secretary" || user.canManageTeam || (user.teamHeadRole && user.teamHeadRole !== "None"))
  );
}

export function canManageTasks(user?: AppUser | null) {
  return isLeader(user);
}

// Who a member's performance is visible to.
//
// Only a SECRETARY sees the whole club. A team head (or any leader) is scoped to their own
// team: they see the performance of members who share at least one department with them,
// and nobody else's. Previously any leader saw every non-4th-year in the club regardless
// of team, which leaked other teams' performance data.
export function canViewMember(
  user: AppUser,
  target: { _id?: unknown; id?: string; year: MemberYear; departments?: string[] }
) {
  const targetId = String(target._id ?? target.id ?? "");

  if (user.role === "secretary") return true; // secretaries see everyone
  if (targetId === user.id) return true; // everyone sees themselves

  if (!isLeader(user)) return false; // ordinary members see only themselves

  return sharesDepartment(user, target.departments);
}

// True when the leader and the target belong to at least one common team.
function sharesDepartment(user: AppUser, targetDepartments?: string[]) {
  if (!targetDepartments?.length) return false;
  const own = new Set(user.departments ?? []);
  return targetDepartments.some((department) => own.has(department as DepartmentName));
}

export function canManageDesign(user?: AppUser | null) {
  return Boolean(user && (user.role === "secretary" || user.teamHeadRole === "Design Team Head"));
}

export function sessionUser(session: Session | null): AppUser | null {
  return (session?.user as AppUser | undefined) ?? null;
}
