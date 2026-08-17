import { sql } from "drizzle-orm";
import { index, integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/**
 * SQLite (libSQL/Turso) schema.
 *
 * Coming from MongoDB, the important change is that embedded arrays become real tables:
 *
 *   users.departments[]        -> user_departments
 *   tasks.assignedTo[]         -> task_assignees
 *   tasks.timeline[]           -> task_timeline
 *   epEntries.history[]        -> ep_history
 *   sponsorships.history[]     -> sponsorship_history
 *
 * That is what SQL is good at, and it means "every task assigned to me" is an indexed join
 * instead of loading every document and filtering in memory.
 *
 * IDs are UUID strings rather than integers, so they stay opaque in URLs and keep the same
 * shape the API already returns (Mongo used ObjectId strings).
 *
 * Timestamps are stored as ISO-8601 text. SQLite has no date type, and text sorts
 * chronologically in this format, so ORDER BY works without conversion.
 */

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    passwordHash: text("password_hash").notNull(),
    year: text("year").notNull(),
    role: text("role").notNull().default("member"),
    teamHeadRole: text("team_head_role").notNull().default("None"),
    canManageTeam: integer("can_manage_team", { mode: "boolean" }).notNull().default(false),
    active: integer("active", { mode: "boolean" }).notNull().default(true),
    // Set on password change; every session issued before this is treated as revoked.
    passwordChangedAt: text("password_changed_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("users_role_idx").on(table.role), index("users_active_idx").on(table.active)]
);

// A member belongs to one or more teams.
export const userDepartments = sqliteTable(
  "user_departments",
  {
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    department: text("department").notNull()
  },
  (table) => [
    primaryKey({ columns: [table.userId, table.department] }),
    index("user_departments_department_idx").on(table.department)
  ]
);

export const departments = sqliteTable("departments", {
  id: text("id").primaryKey(),
  name: text("name").notNull().unique()
});

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    priority: text("priority").notNull(),
    deadline: text("deadline").notNull(),
    status: text("status").notNull().default("Pending"),
    progress: integer("progress").notNull().default(0),
    // Small, never queried into -- a JSON array is the right call here, not a table.
    attachments: text("attachments", { mode: "json" }).$type<string[]>().notNull().default(sql`'[]'`),
    remarks: text("remarks"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("tasks_status_idx").on(table.status), index("tasks_created_by_idx").on(table.createdBy)]
);

export const taskAssignees = sqliteTable(
  "task_assignees",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" })
  },
  (table) => [
    primaryKey({ columns: [table.taskId, table.userId] }),
    index("task_assignees_user_idx").on(table.userId)
  ]
);

export const taskTimeline = sqliteTable(
  "task_timeline",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    actor: text("actor")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull(),
    progress: integer("progress").notNull(),
    comment: text("comment").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("task_timeline_task_idx").on(table.taskId)]
);

export const taskComments = sqliteTable(
  "task_comments",
  {
    id: text("id").primaryKey(),
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    body: text("body").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("task_comments_task_idx").on(table.taskId)]
);

// Who was @-mentioned in a comment. A table rather than parsing the body on read: it makes
// "my mentions" and the unread badge an indexed lookup instead of a scan over every comment.
export const commentMentions = sqliteTable(
  "comment_mentions",
  {
    commentId: text("comment_id")
      .notNull()
      .references(() => taskComments.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    read: integer("read", { mode: "boolean" }).notNull().default(false)
  },
  (table) => [
    primaryKey({ columns: [table.commentId, table.userId] }),
    index("comment_mentions_user_idx").on(table.userId)
  ]
);

// Attachments are stored as URLs, not bytes. Netlify's filesystem is read-only and Turso is
// not a blob store, so uploading real files needs a storage provider; a link works today and
// this table does not change when one is added.
export const commentAttachments = sqliteTable(
  "comment_attachments",
  {
    id: text("id").primaryKey(),
    commentId: text("comment_id")
      .notNull()
      .references(() => taskComments.id, { onDelete: "cascade" }),
    url: text("url").notNull(),
    label: text("label")
  },
  (table) => [index("comment_attachments_comment_idx").on(table.commentId)]
);

export const epEntries = sqliteTable(
  "ep_entries",
  {
    id: text("id").primaryKey(),
    epName: text("ep_name").notNull(),
    organization: text("organization").notNull(),
    contactNumber: text("contact_number"),
    email: text("email"),
    personContacted: text("person_contacted"),
    date: text("date"),
    discussionSummary: text("discussion_summary"),
    currentStatus: text("current_status").notNull(),
    detailedUpdate: text("detailed_update"),
    attachNotes: text("attach_notes"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("ep_entries_created_by_idx").on(table.createdBy)]
);

export const epHistory = sqliteTable(
  "ep_history",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => epEntries.id, { onDelete: "cascade" }),
    actor: text("actor")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    update: text("update").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("ep_history_entry_idx").on(table.entryId)]
);

export const sponsorshipEntries = sqliteTable(
  "sponsorship_entries",
  {
    id: text("id").primaryKey(),
    companyName: text("company_name").notNull(),
    industry: text("industry"),
    companyWebsite: text("company_website"),
    contactPersonName: text("contact_person_name"),
    designation: text("designation"),
    contactNumber: text("contact_number"),
    email: text("email"),
    dateContacted: text("date_contacted"),
    sponsorshipRequirement: text("sponsorship_requirement"),
    currentStatus: text("current_status").notNull(),
    followUpDate: text("follow_up_date"),
    detailedUpdate: text("detailed_update"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("sponsorship_entries_created_by_idx").on(table.createdBy)]
);

export const sponsorshipHistory = sqliteTable(
  "sponsorship_history",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => sponsorshipEntries.id, { onDelete: "cascade" }),
    actor: text("actor")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    update: text("update").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("sponsorship_history_entry_idx").on(table.entryId)]
);

export const hospitalityEntries = sqliteTable(
  "hospitality_entries",
  {
    id: text("id").primaryKey(),
    guestName: text("guest_name").notNull(),
    organization: text("organization"),
    contactNumber: text("contact_number"),
    email: text("email"),
    arrivalDate: text("arrival_date"),
    departureDate: text("departure_date"),
    requirement: text("requirement"),
    currentStatus: text("current_status").notNull(),
    detailedUpdate: text("detailed_update"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("hospitality_entries_created_by_idx").on(table.createdBy)]
);

export const hospitalityHistory = sqliteTable(
  "hospitality_history",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => hospitalityEntries.id, { onDelete: "cascade" }),
    actor: text("actor")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    update: text("update").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("hospitality_history_entry_idx").on(table.entryId)]
);

export const contentEntries = sqliteTable(
  "content_entries",
  {
    id: text("id").primaryKey(),
    contentTitle: text("content_title").notNull(),
    contentType: text("content_type"),
    platform: text("platform"),
    deadline: text("deadline"),
    description: text("description"),
    currentStatus: text("current_status").notNull(),
    detailedUpdate: text("detailed_update"),
    link: text("link"),
    createdBy: text("created_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("content_entries_created_by_idx").on(table.createdBy)]
);

export const contentHistory = sqliteTable(
  "content_history",
  {
    id: text("id").primaryKey(),
    entryId: text("entry_id")
      .notNull()
      .references(() => contentEntries.id, { onDelete: "cascade" }),
    actor: text("actor")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    update: text("update").notNull(),
    status: text("status").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("content_history_entry_idx").on(table.entryId)]
);

export const designRequests = sqliteTable(
  "design_requests",
  {
    id: text("id").primaryKey(),
    designTitle: text("design_title").notNull(),
    requirement: text("requirement"),
    description: text("description"),
    assignedDesigner: text("assigned_designer")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    requestedBy: text("requested_by")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    deadline: text("deadline"),
    status: text("status").notNull().default("Pending"),
    finalSubmissionLink: text("final_submission_link"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("design_requests_designer_idx").on(table.assignedDesigner)]
);

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    message: text("message").notNull(),
    type: text("type").notNull().default("info"),
    read: integer("read", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("notifications_user_idx").on(table.userId)]
);

export const performanceLogs = sqliteTable(
  "performance_logs",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    action: text("action").notNull(),
    referenceId: text("reference_id"),
    points: integer("points").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`)
  },
  (table) => [index("performance_logs_user_idx").on(table.userId)]
);
