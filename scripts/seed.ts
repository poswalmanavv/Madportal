/**
 * Seeds throwaway fixtures for local development and the end-to-end suite.
 *
 * DELETES every row first. Never run against production -- it refuses a remote (Turso)
 * database unless SEED_CONFIRM=yes.
 */
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { DEPARTMENTS } from "../src/shared/constants";
import { authorizedSecretaries } from "../src/backend/rbac";
import {
  departments,
  designRequests,
  epEntries,
  epHistory,
  notifications,
  performanceLogs,
  sponsorshipEntries,
  sponsorshipHistory,
  taskAssignees,
  tasks,
  taskTimeline,
  userDepartments,
  users
} from "../src/backend/schema";

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

const rawUrl = process.env.DATABASE_URL;
if (!rawUrl) throw new Error("DATABASE_URL is not set. Add it to .env.local before seeding.");
const url: string = rawUrl;

// A file: URL is a local SQLite file. Anything else is a remote database, and wiping one of
// those is unrecoverable.
const isLocal = url.startsWith("file:");
if (!isLocal && process.env.SEED_CONFIRM !== "yes") {
  throw new Error(
    "Refusing to wipe a remote database. DATABASE_URL is not a local file.\n" +
      "If you really mean to erase it, re-run with SEED_CONFIRM=yes."
  );
}

const seedPassword = process.env.SEED_PASSWORD ?? "Password@123";
const id = () => crypto.randomUUID();
const daysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

async function main() {
  const client = createClient(
    isLocal ? { url } : { url, authToken: process.env.DATABASE_AUTH_TOKEN }
  );
  const db = drizzle(client);

  // Child tables first -- foreign keys cascade, but being explicit keeps this readable.
  await db.delete(taskTimeline);
  await db.delete(taskAssignees);
  await db.delete(epHistory);
  await db.delete(sponsorshipHistory);
  await db.delete(notifications);
  await db.delete(performanceLogs);
  await db.delete(designRequests);
  await db.delete(tasks);
  await db.delete(epEntries);
  await db.delete(sponsorshipEntries);
  await db.delete(userDepartments);
  await db.delete(departments);
  await db.delete(users);

  const passwordHash = await bcrypt.hash(seedPassword, 12);
  const secretaryEmails = authorizedSecretaries();
  const seededSecretaries = secretaryEmails.length ? secretaryEmails : ["123105128@nitkkr.ac.in"];

  const fixtures = [
    ...seededSecretaries.map((email, index) => ({
      id: id(),
      name: index === 0 ? "Manav Secretary" : `Secretary ${index + 1}`,
      email,
      passwordHash,
      year: "4th Year",
      role: "secretary",
      teamHeadRole: "None",
      canManageTeam: false,
      departments: [...DEPARTMENTS]
    })),
    { id: id(), name: "Diya EP Head", email: "diya@nitkkr.ac.in", passwordHash, year: "4th Year", role: "member", teamHeadRole: "EP Head", canManageTeam: false, departments: ["EP Team"] },
    { id: id(), name: "Kabir Design Head", email: "kabir@nitkkr.ac.in", passwordHash, year: "4th Year", role: "member", teamHeadRole: "Design Team Head", canManageTeam: false, departments: ["Design Team"] },
    { id: id(), name: "Meera Sponsorship", email: "meera@nitkkr.ac.in", passwordHash, year: "3rd Year", role: "member", teamHeadRole: "None", canManageTeam: true, departments: ["Sponsorship Team"] },
    { id: id(), name: "Rohan Media", email: "rohan@nitkkr.ac.in", passwordHash, year: "2nd Year", role: "member", teamHeadRole: "None", canManageTeam: false, departments: ["Media Team"] },
    { id: id(), name: "Isha Content", email: "isha@nitkkr.ac.in", passwordHash, year: "1st Year", role: "member", teamHeadRole: "None", canManageTeam: false, departments: ["Content Team"] }
  ];

  await db.insert(users).values(
    fixtures.map(({ departments: _departments, ...user }) => user)
  );
  await db.insert(userDepartments).values(
    fixtures.flatMap((user) => user.departments.map((department) => ({ userId: user.id, department })))
  );
  await db.insert(departments).values(DEPARTMENTS.map((name) => ({ id: id(), name })));

  const byEmail = (email: string) => fixtures.find((user) => user.email === email)!;
  const secretary = byEmail(seededSecretaries[0]);
  const kabir = byEmail("kabir@nitkkr.ac.in");
  const meera = byEmail("meera@nitkkr.ac.in");
  const rohan = byEmail("rohan@nitkkr.ac.in");
  const diya = byEmail("diya@nitkkr.ac.in");

  const taskA = id();
  const taskB = id();

  await db.insert(tasks).values([
    {
      id: taskA,
      title: "Prepare sponsor prospect list",
      description: "Create a verified list of 30 sponsor leads with contact owners.",
      createdBy: secretary.id,
      priority: "High",
      deadline: daysFromNow(5),
      status: "In Progress",
      progress: 45,
      attachments: []
    },
    {
      id: taskB,
      title: "Design orientation poster",
      description: "Create poster and reel cover for the club orientation.",
      createdBy: kabir.id,
      priority: "Medium",
      deadline: daysFromNow(3),
      status: "Review",
      progress: 80,
      attachments: []
    }
  ]);

  await db.insert(taskAssignees).values([
    { taskId: taskA, userId: meera.id },
    { taskId: taskB, userId: rohan.id }
  ]);

  await db.insert(taskTimeline).values([
    { id: id(), taskId: taskA, actor: secretary.id, status: "Pending", progress: 0, comment: "Task created" },
    { id: id(), taskId: taskB, actor: kabir.id, status: "Pending", progress: 0, comment: "Creative brief shared" }
  ]);

  await db.insert(epEntries).values({
    id: id(),
    epName: "Technova Cultural Exchange",
    organization: "NIT Delhi",
    contactNumber: "9876543210",
    email: "events@nitdelhi.ac.in",
    personContacted: "Event Coordinator",
    date: new Date().toISOString(),
    discussionSummary: "Discussed cross-campus event participation.",
    currentStatus: "Follow-up Required",
    detailedUpdate: "Send formal event partnership deck.",
    createdBy: diya.id
  });

  const sponsorshipId = id();
  await db.insert(sponsorshipEntries).values({
    id: sponsorshipId,
    companyName: "North Tech Labs",
    industry: "SaaS",
    companyWebsite: "https://example.com",
    contactPersonName: "Ankit Sharma",
    designation: "Marketing Manager",
    contactNumber: "9876501234",
    email: "marketing@example.com",
    dateContacted: new Date().toISOString(),
    sponsorshipRequirement: "Title sponsorship for annual MAD showcase.",
    currentStatus: "Proposal Sent",
    followUpDate: daysFromNow(7),
    detailedUpdate: "Proposal deck shared over email.",
    createdBy: meera.id
  });

  await db.insert(sponsorshipHistory).values({
    id: id(),
    entryId: sponsorshipId,
    actor: meera.id,
    update: "Proposal deck shared over email.",
    status: "Proposal Sent"
  });

  console.log(`Seeded ${fixtures.length} users, 2 tasks, 1 EP entry, 1 sponsorship.`);
  client.close();
}

main().catch((error) => {
  console.error("Seed failed:", error);
  process.exit(1);
});
