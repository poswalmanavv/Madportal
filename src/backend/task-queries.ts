import { asc, eq, inArray } from "drizzle-orm";
import { db } from "./db";
import { taskAssignees, tasks, users } from "./schema";

/**
 * Tasks with their assignees stitched back on.
 *
 * assignedTo used to be an array embedded in the task document. It is now the
 * task_assignees join table, so "tasks assigned to me" is an indexed lookup rather than
 * loading every task and filtering in memory.
 */

export type TaskRow = typeof tasks.$inferSelect;
export type TaskAssignee = { _id: string; id: string; name: string; email: string; year: string };
export type TaskWithAssignees = TaskRow & { _id: string; assignedTo: TaskAssignee[] };

async function attachAssignees(rows: TaskRow[]): Promise<TaskWithAssignees[]> {
  if (!rows.length) return [];

  const links = await db
    .select({
      taskId: taskAssignees.taskId,
      id: users.id,
      name: users.name,
      email: users.email,
      year: users.year
    })
    .from(taskAssignees)
    .innerJoin(users, eq(users.id, taskAssignees.userId))
    .where(inArray(taskAssignees.taskId, rows.map((row) => row.id)));

  const byTask = new Map<string, TaskAssignee[]>();
  for (const link of links) {
    const list = byTask.get(link.taskId) ?? [];
    list.push({ _id: link.id, id: link.id, name: link.name, email: link.email, year: link.year });
    byTask.set(link.taskId, list);
  }

  // `_id` is mirrored alongside `id` because the dashboard and the tests still key off it.
  return rows.map((row) => ({ ...row, _id: row.id, assignedTo: byTask.get(row.id) ?? [] }));
}

/** Every task, newest deadline first. */
export async function listAllTasks(): Promise<TaskWithAssignees[]> {
  const rows = await db.select().from(tasks).orderBy(asc(tasks.deadline));
  return attachAssignees(rows);
}

/** Only the tasks assigned to one member. */
export async function listTasksForAssignee(userId: string): Promise<TaskWithAssignees[]> {
  const rows = await db
    .select({ task: tasks })
    .from(tasks)
    .innerJoin(taskAssignees, eq(taskAssignees.taskId, tasks.id))
    .where(eq(taskAssignees.userId, userId))
    .orderBy(asc(tasks.deadline));

  return attachAssignees(rows.map((row) => row.task));
}

export async function getTaskById(id: string): Promise<TaskWithAssignees | null> {
  const [row] = await db.select().from(tasks).where(eq(tasks.id, id)).limit(1);
  if (!row) return null;
  const [withAssignees] = await attachAssignees([row]);
  return withAssignees;
}

export async function assigneeIdsFor(taskId: string): Promise<string[]> {
  const rows = await db
    .select({ userId: taskAssignees.userId })
    .from(taskAssignees)
    .where(eq(taskAssignees.taskId, taskId));
  return rows.map((row) => row.userId);
}
