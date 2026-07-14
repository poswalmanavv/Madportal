import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "./schema";

/**
 * SQLite via libSQL.
 *
 * Local development:  DATABASE_URL=file:./data/mad-club.db   -- a real SQLite file on disk
 * Production (Turso): DATABASE_URL=libsql://<db>.turso.io    -- plus DATABASE_AUTH_TOKEN
 *
 * Why not a plain SQLite file in production: Netlify runs the API as serverless functions
 * with a read-only filesystem and throwaway containers, so a .db file there would either
 * fail to write or silently vanish between requests. Turso serves the same SQLite over
 * HTTP, so it persists -- the SQL and the schema are identical either way.
 */

const globalForDb = global as typeof globalThis & {
  libsqlClient?: Client;
  drizzleDb?: LibSQLDatabase<typeof schema>;
};

function createDbClient(): Client {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not configured. Use file:./data/mad-club.db locally, or a libsql:// URL for Turso."
    );
  }

  // Turso needs an auth token; a local file must not be given one.
  const authToken = process.env.DATABASE_AUTH_TOKEN;
  if (url.startsWith("libsql://") && !authToken) {
    throw new Error("DATABASE_AUTH_TOKEN is required for a libsql:// (Turso) database URL.");
  }

  return createClient(url.startsWith("file:") ? { url } : { url, authToken });
}

// Cached on `global` so hot reloads and warm lambdas reuse a single client instead of
// opening a new connection on every request.
const client = globalForDb.libsqlClient ?? createDbClient();
if (!globalForDb.libsqlClient) globalForDb.libsqlClient = client;

export const db: LibSQLDatabase<typeof schema> = globalForDb.drizzleDb ?? drizzle(client, { schema });
if (!globalForDb.drizzleDb) globalForDb.drizzleDb = db;

export { client, schema };

// libSQL connects lazily, so there is nothing to await. Kept as a named export so route
// handlers keep the same shape they had under Mongoose.
export async function connectDB() {
  return db;
}

// Used by /api/health to prove the database is actually reachable.
export async function pingDB() {
  await client.execute("SELECT 1");
}

export function newId() {
  return crypto.randomUUID();
}

export function nowIso() {
  return new Date().toISOString();
}
