import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { taskAssignees, taskTimeline, tasks, users } from "./schema";

/**
 * Tasks with their assignees.
 *
 * PERFORMANCE: these are single LEFT JOINs, not "fetch tasks, then fetch assignees". Each
 * extra query is a network round trip to Turso, and round trips dominate response time when
 * the database is not next to the function.
 */

export type TaskRow = typeof tasks.$inferSelect;
export type TaskAssignee = { _id: string; id: string; name: string; email: string; year: string };
export type TaskWithAssignees = TaskRow & { _id: string; assignedTo: TaskAssignee[] };

type JoinedRow = {
  task: TaskRow;
  assigneeId: string | null;
  assigneeName: string | null;
  assigneeEmail: string | null;
  assigneeYear: string | null;
};

const selection = {
  task: tasks,
  assigneeId: users.id,
  assigneeName: users.name,
  assigneeEmail: users.email,
  assigneeYear: users.year
};

/** Collapses joined rows (one per task x assignee) back into one object per task. */
function groupRows(rows: JoinedRow[]): TaskWithAssignees[] {
  const byId = new Map<string, TaskWithAssignees>();

  for (const row of rows) {
    let entry = byId.get(row.task.id);
    if (!entry) {
      // `_id` is mirrored alongside `id` because the dashboard and the tests key off it.
      entry = { ...row.task, _id: row.task.id, assignedTo: [] };
      byId.set(row.task.id, entry);
    }
    if (row.assigneeId) {
      entry.assignedTo.push({
        _id: row.assigneeId,
        id: row.assigneeId,
        name: row.assigneeName ?? "",
        email: row.assigneeEmail ?? "",
        year: row.assigneeYear ?? ""
      });
    }
  }

  return [...byId.values()];
}

/** Every task with its assignees. One round trip. */
export async function listAllTasks(): Promise<TaskWithAssignees[]> {
  const rows = await db
    .select(selection)
    .from(tasks)
    .leftJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .leftJoin(users, eq(users.id, taskAssignees.userId))
    .orderBy(asc(tasks.deadline));

  return groupRows(rows as JoinedRow[]);
}

/**
 * Tasks assigned to one member -- including ALL of each task's assignees, not just this one.
 * The subquery picks the task ids; the joins then pull every assignee for those tasks. Still
 * a single round trip.
 */
export async function listTasksForAssignee(userId: string): Promise<TaskWithAssignees[]> {
  const myTaskIds = db
    .select({ taskId: taskAssignees.taskId })
    .from(taskAssignees)
    .where(eq(taskAssignees.userId, userId));

  const rows = await db
    .select(selection)
    .from(tasks)
    .leftJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .leftJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(tasks.id, myTaskIds))
    .orderBy(asc(tasks.deadline));

  return groupRows(rows as JoinedRow[]);
}

export async function getTaskById(id: string): Promise<TaskWithAssignees | null> {
  const rows = await db
    .select(selection)
    .from(tasks)
    .leftJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .leftJoin(users, eq(users.id, taskAssignees.userId))
    .where(eq(tasks.id, id));

  return groupRows(rows as JoinedRow[])[0] ?? null;
}

/**
 * A task's activity trail, newest first, with the actor's name resolved.
 *
 * Deliberately not part of listAllTasks: the dashboard ships every task, and carrying every
 * task's full history with it would bloat the payload for data only ever read one task at a
 * time. The detail view fetches this.
 */
export async function listTaskTimeline(taskId: string) {
  const rows = await db
    .select({
      id: taskTimeline.id,
      status: taskTimeline.status,
      progress: taskTimeline.progress,
      comment: taskTimeline.comment,
      createdAt: taskTimeline.createdAt,
      actorId: users.id,
      actorName: users.name
    })
    .from(taskTimeline)
    .innerJoin(users, eq(users.id, taskTimeline.actor))
    .where(eq(taskTimeline.taskId, taskId))
    .orderBy(asc(taskTimeline.createdAt));

  return rows;
}

export async function assigneeIdsFor(taskId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  return rows.map((row) => row.userId);
}
