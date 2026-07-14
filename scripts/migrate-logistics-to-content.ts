/**
 * Renames the "Logistics Team" department to "Content Team" (and "Logistics Head" to
 * "Content Head") in existing data.
 *
 * The names are Mongoose enums, so once the code changed, any document still holding the
 * old value fails validation the next time it is saved. Renaming the constant is not
 * enough on its own -- data written before the rename has to be migrated.
 *
 *   pnpm migrate:content
 *
 * Safe to run more than once: documents already using the new names simply do not match.
 */
import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";

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

const OLD_DEPARTMENT = "Logistics Team";
const NEW_DEPARTMENT = "Content Team";
const OLD_ROLE = "Logistics Head";
const NEW_ROLE = "Content Head";

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local before migrating.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("mad-club");

  // departments is an array of strings; the positional operator rewrites the matched entry.
  const departmentResult = await db
    .collection("users")
    .updateMany({ departments: OLD_DEPARTMENT }, { $set: { "departments.$[element]": NEW_DEPARTMENT } }, {
      arrayFilters: [{ element: OLD_DEPARTMENT }]
    });

  const roleResult = await db
    .collection("users")
    .updateMany({ teamHeadRole: OLD_ROLE }, { $set: { teamHeadRole: NEW_ROLE } });

  // The Department collection stores one document per team.
  const departmentDocResult = await db
    .collection("departments")
    .updateMany({ name: OLD_DEPARTMENT }, { $set: { name: NEW_DEPARTMENT } });

  console.log(`users: ${departmentResult.modifiedCount} department reference(s) renamed`);
  console.log(`users: ${roleResult.modifiedCount} team head role(s) renamed`);
  console.log(`departments: ${departmentDocResult.modifiedCount} document(s) renamed`);

  const leftover = await db.collection("users").countDocuments({
    $or: [{ departments: OLD_DEPARTMENT }, { teamHeadRole: OLD_ROLE }]
  });
  if (leftover > 0) {
    console.error(`WARNING: ${leftover} user(s) still reference "${OLD_DEPARTMENT}"/"${OLD_ROLE}".`);
    process.exitCode = 1;
  } else {
    console.log(`No references to "${OLD_DEPARTMENT}" remain.`);
  }

  await client.close();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
