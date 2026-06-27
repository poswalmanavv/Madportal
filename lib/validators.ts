import { z } from "zod";
import { DEPARTMENTS, PRIORITIES, TASK_STATUSES, TEAM_HEAD_ROLES, YEARS } from "./constants";
import { isNitkkrEmail } from "./rbac";

export const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().refine(isNitkkrEmail, "Use a @nitkkr.ac.in email"),
  password: z.string().min(8),
  year: z.enum(YEARS),
  departments: z.array(z.enum(DEPARTMENTS)).min(1),
  teamHeadRole: z.enum(TEAM_HEAD_ROLES).default("None")
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters")
  })
  .refine((data) => data.currentPassword !== data.newPassword, {
    message: "New password must be different from the current password",
    path: ["newPassword"]
  });

export const taskSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(3),
  assignedTo: z.array(z.string()).min(1),
  priority: z.enum(PRIORITIES),
  deadline: z.string(),
  attachments: z.array(z.string().url()).default([]),
  remarks: z.string().optional()
});

export const taskUpdateSchema = z.object({
  status: z.enum(TASK_STATUSES),
  progress: z.number().min(0).max(100),
  comment: z.string().min(2)
});

export const epEntrySchema = z.object({
  epName: z.string().min(2),
  organization: z.string().min(2),
  contactNumber: z.string().min(5),
  email: z.string().email(),
  personContacted: z.string().min(2),
  date: z.string(),
  discussionSummary: z.string().min(2),
  currentStatus: z.enum(["Interested", "Follow-up Required", "Confirmed", "Rejected"]),
  detailedUpdate: z.string().min(2),
  attachNotes: z.string().optional()
});

export const sponsorshipSchema = z.object({
  companyName: z.string().min(2),
  industry: z.string().min(2),
  companyWebsite: z.string().url().optional().or(z.literal("")),
  contactPersonName: z.string().min(2),
  designation: z.string().min(2),
  contactNumber: z.string().min(5),
  email: z.string().email(),
  dateContacted: z.string(),
  sponsorshipRequirement: z.string().min(2),
  currentStatus: z.enum(["Proposal Sent", "Negotiation", "Interested", "Confirmed", "Rejected"]),
  followUpDate: z.string().optional(),
  detailedUpdate: z.string().min(2)
});

export const designRequestSchema = z.object({
  designTitle: z.string().min(2),
  requirement: z.string().min(2),
  description: z.string().min(2),
  assignedDesigner: z.string(),
  deadline: z.string(),
  status: z.enum(["Pending", "In Progress", "Submitted", "Approved", "Rejected"]).default("Pending"),
  finalSubmissionLink: z.string().url().optional().or(z.literal(""))
});
