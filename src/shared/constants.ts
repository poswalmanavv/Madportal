export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"] as const;
export const DEPARTMENTS = [
  "EP Team",
  "Sponsorship Team",
  "Hospitality Team",
  "Media Team",
  "Design Team",
  "Content Team"
] as const;
export const TEAM_HEAD_ROLES = [
  "Secretary",
  "EP Head",
  "Sponsorship Head",
  "Hospitality Head",
  "Media Team Head",
  "Design Team Head",
  "Content Head",
  "None"
] as const;

// "Secretary" is a restricted label. It is shown in the registration dropdown, but the
// server only accepts it from an email on the AUTHORIZED_SECRETARIES allowlist -- otherwise
// any 4th year could label themselves Secretary to the rest of the club. (It grants no
// admin powers on its own either way; role=secretary comes from the allowlist alone.)
export const RESTRICTED_TEAM_HEAD_ROLE = "Secretary";

// The real roles, without the "None" sentinel. A 4th year must choose one of these at
// registration; every other year is never shown the field.
export const SELECTABLE_TEAM_HEAD_ROLES = TEAM_HEAD_ROLES.filter((role) => role !== "None");

// Only 4th years hold team head roles.
export const TEAM_HEAD_YEAR = "4th Year";
export const TASK_STATUSES = ["Pending", "In Progress", "Review", "Completed"] as const;
export const PRIORITIES = ["Low", "Medium", "High", "Critical"] as const;
export const EP_STATUSES = ["Interested", "Follow-up Required", "Confirmed", "Rejected"] as const;
export const SPONSORSHIP_STATUSES = ["Proposal Sent", "Negotiation", "Interested", "Confirmed", "Rejected"] as const;
export const DESIGN_STATUSES = ["Pending", "In Progress", "Submitted", "Approved", "Rejected"] as const;
// Only the design head or a secretary may sign off on a request; a designer can move their
// own work up to "Submitted" but cannot approve it.
export const DESIGN_APPROVAL_STATUSES = ["Approved", "Rejected"] as const;

export type MemberYear = (typeof YEARS)[number];
export type DepartmentName = (typeof DEPARTMENTS)[number];
export type TeamHeadRole = (typeof TEAM_HEAD_ROLES)[number];
export type TaskStatus = (typeof TASK_STATUSES)[number];
export type Priority = (typeof PRIORITIES)[number];
export type EPStatus = (typeof EP_STATUSES)[number];
export type SponsorshipStatus = (typeof SPONSORSHIP_STATUSES)[number];
export type DesignStatus = (typeof DESIGN_STATUSES)[number];
export type Portal = "member" | "admin";
