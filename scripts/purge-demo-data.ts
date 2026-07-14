/**
 * Removes every seeded/demo profile and the content it owns, leaving a clean database.
 *
 *   pnpm purge:demo            dry run -- shows what would go, changes nothing
 *   pnpm purge:demo --confirm  actually remove it
 *
 * Removes:
 *   1. The five fixture members (diya, kabir, meera, rohan, isha).
 *   2. Any remaining account still using the seed default password. Those are seeder
 *      artifacts, and an account with a publicly documented password is a live way in.
 *      Real secretaries re-register at /register and are granted the secretary role
 *      automatically by the allowlist -- with a password they choose.
 *
 * Their content goes with them: foreign keys are ON DELETE CASCADE, so deleting a user
 * removes their tasks, entries, notifications and logs in one step.
 */
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { inArray } from "drizzle-orm";
import { users } from "../src/backend/schema";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8").replace(/^﻿/, "");
  for (const rawLine of contents.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equalsIndex = line.indexOf("=");
    if (equalsIndex === -1) continue;
    const key = line.slice(0, equalsIndex).trim();
    const value = line.slice(equalsIndex + 1).trim().replace(/^['"]|['"]$/g, "");
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(process.cwd(), ".env.local"));

const DEMO_EMAILS = [
  "diya@nitkkr.ac.in",
  "kabir@nitkkr.ac.in",
  "meera@nitkkr.ac.in",
  "rohan@nitkkr.ac.in",
  "isha@nitkkr.ac.in"
];

const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Password@123";
const confirmed = process.argv.includes("--confirm");

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

  const client = createClient(
    url.startsWith("file:") ? { url } : { url, authToken: process.env.DATABASE_AUTH_TOKEN }
  );
  // Cascades only fire when foreign keys are enforced, and SQLite leaves them off by default.
  await client.execute("PRAGMA foreign_keys = ON");
  const db = drizzle(client);

  const all = await db.select().from(users);

  const demoUsers = all.filter((user) => DEMO_EMAILS.includes(user.email));

  const defaultPasswordUsers = [];
  for (const user of all) {
    if (DEMO_EMAILS.includes(user.email)) continue;
    if (await bcrypt.compare(SEED_PASSWORD, user.passwordHash)) defaultPasswordUsers.push(user);
  }

  const doomed = [...demoUsers, ...defaultPasswordUsers];

  console.log("Demo/fixture accounts to remove:");
  demoUsers.forEach((user) => console.log(`  - ${user.email} (${user.name})`));
  if (!demoUsers.length) console.log("  (none)");

  console.log("\nAccounts still using the seeded default password:");
  defaultPasswordUsers.forEach((user) => console.log(`  - ${user.email} (${user.name}, role=${user.role})`));
  if (!defaultPasswordUsers.length) console.log("  (none)");

  if (!doomed.length) {
    console.log("\nNothing to remove. The database is already clean.");
    client.close();
    return;
  }

  if (!confirmed) {
    console.log("\nDRY RUN -- nothing was changed. Re-run with --confirm to apply.");
    client.close();
    return;
  }

  await db.delete(users).where(inArray(users.id, doomed.map((user) => user.id)));

  const remaining = await db.select().from(users);
  console.log(`\nRemoved ${doomed.length} account(s) and their content (cascaded).`);
  console.log(`Accounts remaining: ${remaining.length}`);
  remaining.forEach((user) => console.log(`  - ${user.email} (${user.role})`));

  if (!remaining.length) {
    console.log("\nThe database has no accounts. Secretaries on the AUTHORIZED_SECRETARIES");
    console.log("allowlist should now register at /register and choose their own password;");
    console.log("the secretary role is granted automatically.");
  }

  client.close();
}

main().catch((error) => {
  console.error("Purge failed:", error);
  process.exit(1);
});
