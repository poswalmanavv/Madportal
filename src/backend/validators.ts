import { z } from "zod";
import {
  DEPARTMENTS,
  DESIGN_STATUSES,
  EP_STATUSES,
  PRIORITIES,
  REGISTRABLE_YEARS,
  RESTRICTED_TEAM_HEAD_ROLE,
  SPONSORSHIP_STATUSES,
  TASK_STATUSES,
  TEAM_HEAD_ROLES,
  TEAM_HEAD_YEAR,
  YEARS
} from "@shared/constants";
import { isNitkkrEmail, isSecretaryEmail } from "./rbac";

// Public self-registration.
//
// SECURITY NOTE -- read before changing. A 4th year picks their own team head role here
// and it takes effect immediately (product decision), which means registration itself
// grants team-lead powers: reading and modifying the whole club's tasks, sponsor contacts
// and EP records. Combined with the fact that the @nitkkr.ac.in check is only a string
// suffix test -- nobody proves they own the address -- ANY stranger can obtain those
// powers by signing up. Email verification is the control that makes this safe; until it
// exists, this endpoint is the club's weakest point.
//
// `role` and `canManageTeam` are still NOT accepted here: secretary remains gated behind
// the AUTHORIZED_SECRETARIES server-side allowlist.
const baseAccountSchema = z.object({
  name: z.string().min(2),
  email: z.string().email().refine(isNitkkrEmail, "Use a @nitkkr.ac.in email"),
  password: z.string().min(8),
  year: z.enum(YEARS),
  departments: z.array(z.enum(DEPARTMENTS)).min(1),
  teamHeadRole: z.enum(TEAM_HEAD_ROLES).optional()
});

export const registerSchema = baseAccountSchema
  .superRefine((data, ctx) => {
    // 1st years are not registering for now. The form hides the option, and this rejects it
    // if sent directly -- hiding a dropdown value is presentation, not a control. Secretaries
    // creating members are not bound by this (adminCreateMemberSchema has no such check).
    if (!(REGISTRABLE_YEARS as readonly string[]).includes(data.year)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["year"],
        message: "Registration is not open for this year right now"
      });
    }

    const isFinalYear = data.year === TEAM_HEAD_YEAR;
    const claimsRole = Boolean(data.teamHeadRole && data.teamHeadRole !== "None");

    // 4th years MUST choose a role -- the form shows it as a required field.
    if (isFinalYear && !claimsRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamHeadRole"],
        message: "Select your team head role"
      });
    }

    // Everyone else must not send one. The form never shows them the field, so a role
    // arriving on a 1st/2nd/3rd year request is a hand-crafted escalation attempt --
    // reject it outright rather than silently dropping it.
    if (!isFinalYear && claimsRole) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamHeadRole"],
        message: "Only 4th years can hold a team head role"
      });
    }

    // "Secretary" is a restricted label: it is offered in the dropdown, but only an email on
    // the AUTHORIZED_SECRETARIES allowlist may actually claim it. Without this check any 4th
    // year could present themselves to the club as a Secretary on the dashboard.
    if (data.teamHeadRole === RESTRICTED_TEAM_HEAD_ROLE && !isSecretaryEmail(data.email)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["teamHeadRole"],
        message: "Only an authorized secretary can select the Secretary role"
      });
    }
  });

// Secretary-only member creation. Not bound by the "4th years only" rule -- a secretary is
// trusted to assign any role to anyone, including canManageTeam for a 3rd-year deputy.
export const adminCreateMemberSchema = baseAccountSchema.extend({
  teamHeadRole: z.enum(TEAM_HEAD_ROLES).default("None"),
  canManageTeam: z.boolean().default(false)
});

// Secretary-only member update.
export const updateMemberSchema = z.object({
  name: z.string().min(2),
  year: z.enum(YEARS),
  departments: z.array(z.enum(DEPARTMENTS)).min(1),
  teamHeadRole: z.enum(TEAM_HEAD_ROLES).default("None"),
  canManageTeam: z.boolean().default(false),
  active: z.boolean().default(true)
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

// A comment on a task. `mentions` carries user ids chosen in the composer rather than the
// server parsing "@Name" out of the body -- names contain spaces, so parsing is ambiguous
// and would silently mis-target. The server still checks each id is a real, visible member.
export const commentSchema = z.object({
  body: z.string().trim().min(1, "Write something first").max(5000),
  mentions: z.array(z.string()).default([]),
  attachments: z
    .array(
      z.object({
        url: z.string().url("Attachment must be a valid URL"),
        label: z.string().max(200).optional()
      })
    )
    .max(10)
    .default([])
});

export const epEntrySchema = z.object({
  epName: z.string().min(2),
  organization: z.string().min(2),
  contactNumber: z.string().min(5),
  email: z.string().email(),
  personContacted: z.string().min(2),
  date: z.string(),
  discussionSummary: z.string().min(2),
  currentStatus: z.enum(EP_STATUSES),
  detailedUpdate: z.string().min(2),
  attachNotes: z.string().optional()
});

// Moves an existing EP entry along the pipeline. The comment is required so the history
// trail explains every status change.
export const epStatusUpdateSchema = z.object({
  currentStatus: z.enum(EP_STATUSES),
  detailedUpdate: z.string().min(2)
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
  currentStatus: z.enum(SPONSORSHIP_STATUSES),
  followUpDate: z.string().optional(),
  detailedUpdate: z.string().min(2)
});

// Moves an existing sponsorship along the pipeline.
export const sponsorshipStatusUpdateSchema = z.object({
  currentStatus: z.enum(SPONSORSHIP_STATUSES),
  detailedUpdate: z.string().min(2),
  followUpDate: z.string().optional().or(z.literal(""))
});

export const designRequestSchema = z.object({
  designTitle: z.string().min(2),
  requirement: z.string().min(2),
  description: z.string().min(2),
  assignedDesigner: z.string(),
  deadline: z.string(),
  status: z.enum(DESIGN_STATUSES).default("Pending"),
  finalSubmissionLink: z.string().url().optional().or(z.literal(""))
});

// Lets the assigned designer action their own request (and the design head approve it).
export const designStatusUpdateSchema = z.object({
  status: z.enum(DESIGN_STATUSES),
  finalSubmissionLink: z.string().url().optional().or(z.literal(""))
});
