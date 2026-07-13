import type { Session } from "next-auth";
import type { DepartmentName, MemberYear, TeamHeadRole } from "./constants";

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

export function canManageTasks(user?: AppUser | null) {
  return Boolean(user && (user.role === "secretary" || user.year === "4th Year"));
}

export function canViewMember(user: AppUser, target: { _id?: unknown; id?: string; year: MemberYear }) {
  const targetId = String(target._id ?? target.id ?? "");
  if (user.role === "secretary") return true;
  if (targetId === user.id) return true;
  if (user.year === "4th Year" && target.year !== "4th Year") return true;
  if (user.year === "3rd Year" && user.canManageTeam && target.year !== "4th Year") return true;
  return false;
}

export function canManageDesign(user?: AppUser | null) {
  return Boolean(user && (user.role === "secretary" || user.teamHeadRole === "Design Team Head"));
}

export function sessionUser(session: Session | null): AppUser | null {
  return (session?.user as AppUser | undefined) ?? null;
}
