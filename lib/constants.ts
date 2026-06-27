export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const DEPARTMENTS = [
  "EP Team",
  "Sponsorship Team",
  "Hospitality Team",
  "Media Team",
  "Design Team",
  "Logistics Team"
] as const;
export const TEAM_HEAD_ROLES = [
  "EP Head",
  "Sponsorship Head",
  "Hospitality Head",
  "Media Team Head",
  "Design Team Head",
  "Logistics Head",
  "None"
] as const;
export const TASK_STATUSES = ["Pending", "In Progress", "Review", "Completed"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;

export type MemberYear = (typeof YEARS)[number];
export type DepartmentName = (typeof DEPARTMENTS)[number];
export type TeamHeadRole = (typeof TEAM_HEAD_ROLES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type Portal = "member" | "admin";
