import { eq, inArray } from "drizzle-orm";
import { db, newId } from "./db";
import { notifications, performanceLogs, userDepartments, users } from "./schema";

/**
 * Shared read helpers.
 *
 * A user's departments live in their own table (user_departments), so almost every read of
 * a user needs them stitched back on to produce the `departments: string[]` shape the rest
 * of the app already expects. These helpers keep that join in one place instead of spread
 * across sixteen routes.
 */

export type UserRow = typeof users.$inferSelect;
export type UserWithDepartments = Omit<UserRow, "passwordHash"> & { departments: string[] };

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

function withoutPasswordHash(user: UserRow, departments: string[]): UserWithDepartments {
  // Never let the bcrypt hash escape into a response. Callers that genuinely need it (login,
  // change-password) read the raw row themselves.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { passwordHash, ...safe } = user;
  return { ...safe, departments };
}

export async function getUserById(id: string): Promise<UserWithDepartments | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!user) return null;
  const departments = (await departmentsFor([user.id])).get(user.id) ?? [];
  return withoutPasswordHash(user, departments);
}

/** Includes the password hash. Only for the credentials provider and change-password. */
export async function getUserRowByEmail(email: string): Promise<UserRow | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
  return user ?? null;
}

export async function getUserRowById(id: string): Promise<UserRow | null> {
  const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return user ?? null;
}

export async function listUsers(options: { activeOnly?: boolean } = {}): Promise<UserWithDepartments[]> {
  const rows = options.activeOnly
    ? await db.select().from(users).where(eq(users.active, true))
    : await db.select().from(users);

  const byUser = await departmentsFor(rows.map((row) => row.id));
  return rows.map((row) => withoutPasswordHash(row, byUser.get(row.id) ?? []));
}

export async function setUserDepartments(userId: string, departments: string[]) {
  await db.delete(userDepartments).where(eq(userDepartments.userId, userId));
  if (departments.length) {
    await db.insert(userDepartments).values(departments.map((department) => ({ userId, department })));
  }
}

export async function notify(userId: string, title: string, message: string, type: string) {
  await db.insert(notifications).values({ id: newId(), userId, title, message, type });
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
