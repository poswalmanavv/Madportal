import type { DefaultSession } from "next-auth";
import type { DepartmentName, MemberYear, TeamHeadRole } from "@/lib/constants";

declare module "next-auth" {
  interface Session {
    user: DefaultSession["user"] & {
      id: string;
      year: MemberYear;
      role: "member" | "secretary";
      teamHeadRole: TeamHeadRole;
      departments: DepartmentName[];
      canManageTeam: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    year: MemberYear;
    role: "member" | "secretary";
    teamHeadRole: TeamHeadRole;
    departments: DepartmentName[];
    canManageTeam: boolean;
  }
}
