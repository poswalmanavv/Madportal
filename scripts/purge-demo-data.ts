/**
 * Removes every seeded/demo profile and the content it owns, leaving a clean database for
 * real use.
 *
 *   pnpm purge:demo            show what would be removed, change nothing
 *   pnpm purge:demo --confirm  actually remove it
 *
 * What it removes:
 *   1. The five fixture members (diya, kabir, meera, rohan, isha) and everything they
 *      created -- tasks, EP entries, sponsorships, design requests, notifications, logs.
 *   2. Any remaining account whose password is STILL the seed default. Those are seeder
 *      artifacts, and an account with a publicly documented password is a live way in.
 *      Real secretaries simply re-register at /register and are granted the secretary role
 *      automatically by the AUTHORIZED_SECRETARIES allowlist -- with a password they choose.
 *
 * The Department documents are kept: they are real structure, not demo data.
 */
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { MongoClient, ObjectId } from "mongodb";

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
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error("MONGODB_URI is not set. Add it to .env.local.");

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db("mad-club");
  const users = db.collection("users");

  // 1. The known fixture accounts.
  const demoUsers = await users.find({ email: { $in: DEMO_EMAILS } }).toArray();

  // 2. Anything still using the seed default password. passwordHash is select:false in
  //    Mongoose but this is the raw driver, so it comes back.
  const survivors = await users.find({ email: { $nin: DEMO_EMAILS } }).toArray();
  const defaultPasswordUsers = [];
  for (const user of survivors) {
    if (!user.passwordHash) continue;
    if (await bcrypt.compare(SEED_PASSWORD, user.passwordHash)) defaultPasswordUsers.push(user);
  }

  const doomed = [...demoUsers, ...defaultPasswordUsers];
  const doomedIds: ObjectId[] = doomed.map((user) => user._id);

  console.log("Demo/fixture accounts to remove:");
  demoUsers.forEach((user) => console.log(`  - ${user.email} (${user.name})`));
  if (!demoUsers.length) console.log("  (none)");

  console.log("\nAccounts still using the seeded default password:");
  defaultPasswordUsers.forEach((user) => console.log(`  - ${user.email} (${user.name}, role=${user.role})`));
  if (!defaultPasswordUsers.length) console.log("  (none)");

  if (!doomedIds.length) {
    console.log("\nNothing to remove. The database is already clean.");
    await client.close();
    return;
  }

  // Content owned by, assigned to, or notifying any doomed account.
  const counts = {
    tasks: await db.collection("tasks").countDocuments({
      $or: [{ createdBy: { $in: doomedIds } }, { assignedTo: { $in: doomedIds } }]
    }),
    epentries: await db.collection("epentries").countDocuments({ createdBy: { $in: doomedIds } }),
    sponsorshipentries: await db.collection("sponsorshipentries").countDocuments({ createdBy: { $in: doomedIds } }),
    designrequests: await db.collection("designrequests").countDocuments({
      $or: [{ requestedBy: { $in: doomedIds } }, { assignedDesigner: { $in: doomedIds } }]
    }),
    notifications: await db.collection("notifications").countDocuments({ user: { $in: doomedIds } }),
    performancelogs: await db.collection("performancelogs").countDocuments({ user: { $in: doomedIds } })
  };

  console.log("\nContent that will be removed with them:");
  Object.entries(counts).forEach(([name, count]) => console.log(`  ${name}: ${count}`));

  if (!confirmed) {
    console.log("\nDRY RUN -- nothing was changed. Re-run with --confirm to apply.");
    await client.close();
    return;
  }

  await db.collection("tasks").deleteMany({
    $or: [{ createdBy: { $in: doomedIds } }, { assignedTo: { $in: doomedIds } }]
  });
  await db.collection("epentries").deleteMany({ createdBy: { $in: doomedIds } });
  await db.collection("sponsorshipentries").deleteMany({ createdBy: { $in: doomedIds } });
  await db.collection("designrequests").deleteMany({
    $or: [{ requestedBy: { $in: doomedIds } }, { assignedDesigner: { $in: doomedIds } }]
  });
  await db.collection("notifications").deleteMany({ user: { $in: doomedIds } });
  await db.collection("performancelogs").deleteMany({ user: { $in: doomedIds } });
  await users.deleteMany({ _id: { $in: doomedIds } });

  // Departments keep a members[] array of user ids; drop the dangling references.
  await db.collection("departments").updateMany({}, { $pull: { members: { $in: doomedIds } } } as never);

  const remaining = await users.find({}, { projection: { email: 1, role: 1 } }).toArray();
  console.log(`\nRemoved ${doomedIds.length} account(s) and their content.`);
  console.log(`Accounts remaining: ${remaining.length}`);
  remaining.forEach((user) => console.log(`  - ${user.email} (${user.role})`));

  if (!remaining.length) {
    console.log("\nThe database has no accounts. Secretaries on the AUTHORIZED_SECRETARIES");
    console.log("allowlist should now register at /register and choose their own password;");
    console.log("the secretary role is granted automatically.");
  }

  await client.close();
}

main().catch((error) => {
  console.error("Purge failed:", error);
  process.exit(1);
});
