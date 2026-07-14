/**
 * Creates the tables. Applies the SQL migrations in ./drizzle to whatever DATABASE_URL
 * points at.
 *
 *   pnpm db:migrate          -- your local SQLite file, reading .env.local
 *   pnpm db:migrate:turso    -- the live Turso database, reading .env.turso
 *
 * Idempotent: Drizzle records which migrations have already run, so re-running is safe and
 * does nothing the second time. Run it once against Turso before the first deploy, and
 * again after any schema change.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return false;
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
  return true;
}

// `--env <file>` targets a different database than local dev. .env.turso holds the live
// Turso credentials and is gitignored; .env.local stays pointed at the local SQLite file so
// the two can never be confused.
const envFlagIndex = process.argv.indexOf("--env");
const envFile = envFlagIndex !== -1 ? process.argv[envFlagIndex + 1] : ".env.local";

if (!loadEnvFile(path.resolve(process.cwd(), envFile))) {
  console.error(`\nCannot find ${envFile}.`);
  if (envFile === ".env.turso") {
    console.error("\nCreate it in the project root with these two lines:\n");
    console.error("  DATABASE_URL=libsql://<your-database>.turso.io");
    console.error("  DATABASE_AUTH_TOKEN=<the token from Turso's Create Token button>\n");
  }
  process.exit(1);
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Add it to .env.local.");

  // A local file:./data/... target needs its directory to exist first.
  if (url.startsWith("file:")) {
    const filePath = url.slice("file:".length);
    fs.mkdirSync(path.dirname(path.resolve(process.cwd(), filePath)), { recursive: true });
  }

  const authToken = process.env.DATABASE_AUTH_TOKEN;
  const client = createClient(url.startsWith("file:") ? { url } : { url, authToken });
  const db = drizzle(client);

  console.log(`Migrating ${url.startsWith("file:") ? url : url.split("?")[0]} ...`);
  await migrate(db, { migrationsFolder: "./drizzle" });
  console.log("Migrations applied.");

  client.close();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
