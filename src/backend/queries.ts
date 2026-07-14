import { eq, inArray } from "drizzle-orm";
import { db, newId } from "./db";
import { notifications, performanceLogs, userDepartments, users } from "./schema";

/**
 * Shared user reads.
 *
 * PERFORMANCE: every query here is a network round trip to Turso, and the database may be a
 * long way from the function running this code. Round trips dominate the response time, so
 * these helpers fetch a user AND their departments in ONE query (a LEFT JOIN) rather than
 * two. It used to be two, which doubled the cost of every authenticated request -- the JWT
 * callback re-reads the current user on every single request.
 *
 * Rule of thumb when adding code here: count the awaits. Each one is ~a round trip.
 */

export type UserRow = typeof users.$inferSelect;
export type UserWithDepartments = Omit<UserRow, "passwordHash"> & { departments: string[] };

/** Collapses joined rows (one per user x department) back into one object per user. */
function groupRows(rows: { user: UserRow; department: string | null }[]): UserWithDepartments[] {
  const byId = new Map<string, UserWithDepartments>();

  for (const row of rows) {
    let entry = byId.get(row.user.id);
    if (!entry) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { passwordHash, ...safe } = row.user;
      entry = { ...safe, departments: [] };
      byId.set(row.user.id, entry);
    }
    if (row.department) entry.departments.push(row.department);
  }

  return [...byId.values()];
}

export async function departmentsFor(userIds: string[]): Promise<Map<string, string[]>> {
  const byUser = new Map<string, string[]>();
  if (!userIds.length) return byUser;

  const rows = await db.select().from(userDepartments).where(inArray(userDepartments.userId, userIds));
  for (const row of rows) {
    const list = byUser.get(row.userId) ?? [];
    list.push(row.department);
    byUser.set(row.userId, list);
  }
  return byUser;
}

/** One round trip: the user and their departments together. */
export async function getUserById(id: string): Promise<UserWithDepartments | null> {
  const rows = await db
    .select({ user: users, department: userDepartments.department })
    .from(users)
    .leftJoin(userDepartments, eq(userDepartments.userId, users.id))
    .where(eq(users.id, id));

  return groupRows(rows)[0] ?? null;
}

/**
 * One round trip. Returns the raw row (password hash included) AND the departments, which is
 * exactly what the JWT callback needs on every authenticated request.
 */
export async function getUserRowWithDepartments(
  id: string
): Promise<{ user: UserRow; departments: string[] } | null> {
  const rows = await db
    .select({ user: users, department: userDepartments.department })
    .from(users)
    .leftJoin(userDepartments, eq(userDepartments.userId, users.id))
    .where(eq(users.id, id));

  if (!rows.length) return null;
  const departments = rows.map((row) => row.department).filter((d): d is string => Boolean(d));
  return { user: rows[0].user, departments };
}

export async function getUserRowWithDepartmentsByEmail(
  email: string
): Promise<{ user: UserRow; departments: string[] } | null> {
  const rows = await db
    .select({ user: users, department: userDepartments.department })
    .from(users)
    .leftJoin(userDepartments, eq(userDepartments.userId, users.id))
    .where(eq(users.email, email.toLowerCase()));

  if (!rows.length) return null;
  const departments = rows.map((row) => row.department).filter((d): d is string => Boolean(d));
  return { user: rows[0].user, departments };
}

/** Includes the password hash. Only for change-password. */
export async function getUserRowById(id: string): Promise<UserRow | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

/** One round trip for every user plus their departments. */
export async function listUsers(options: { activeOnly?: boolean } = {}): Promise<UserWithDepartments[]> {
  const base = db
    .select({ user: users, department: userDepartments.department })
    .from(users)
    .leftJoin(userDepartments, eq(userDepartments.userId, users.id));

  const rows = options.activeOnly ? await base.where(eq(users.active, true)) : await base;
  return groupRows(rows);
}

export async function setUserDepartments(userId: string, departments: string[]) {
  // Two statements, one round trip.
  const statements = [
    db.delete(userDepartments).where(eq(userDepartments.userId, userId)),
    ...(departments.length
      ? [db.insert(userDepartments).values(departments.map((department) => ({ userId, department })))]
      : [])
  ] as const;

  await db.batch(statements as never);
}

export async function notify(userId: string, title: string, message: string, type: string) {
  await db.insert(notifications).values({ id: newId(), userId, title, message, type });
}

/** One round trip for many recipients, instead of one per recipient. */
export async function notifyMany(
  userIds: string[],
  title: string,
  message: string,
  type: string
) {
  if (!userIds.length) return;
  await db
    .insert(notifications)
    .values(userIds.map((userId) => ({ id: newId(), userId, title, message, type })));
}

export async function logPerformance(
  userId: string,
  type: string,
  action: string,
  referenceId: string,
  points = 0
) {
  await db.insert(performanceLogs).values({ id: newId(), userId, type, action, referenceId, points });
}
