/**
 * End-to-end API tests. Runs against a live server -- it signs in through the real
 * NextAuth credentials flow, so it exercises middleware, JWT callbacks and RBAC exactly
 * as a browser would.
 *
 *   1. pnpm dev            (leave running)
 *   2. pnpm seed           (resets to a known fixture set)
 *   3. pnpm test:e2e       (BASE_URL=http://localhost:3002 pnpm test:e2e to change port)
 *
 * These tests WRITE to the database at DATABASE_URL. Point them at a local SQLite file.
 */
import fs from "fs";
import path from "path";
import { createClient, type Client } from "@libsql/client";

/**
 * The database assertions below were written against MongoDB. Rather than reword 40 checks
 * -- and risk quietly weakening one while porting -- this shim speaks the small subset of
 * the Mongo API the suite actually uses, backed by SQL. The tests themselves are unchanged,
 * so a pass here means the SAME behaviour is still true after the move to SQLite.
 */
const TABLES: Record<string, string> = {
  users: "users",
  tasks: "tasks",
  epentries: "ep_entries",
  sponsorshipentries: "sponsorship_entries",
  designrequests: "design_requests"
};

const toSnake = (field: string) =>
  field === "_id" ? "id" : field.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

const toCamel = (column: string) => column.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());

// SQLite has no boolean type -- these come back as 0/1 and must be converted, or a check
// like `canManageTeam === false` fails against a perfectly correct 0.
const BOOLEAN_COLUMNS = new Set(["active", "can_manage_team", "read"]);

function toDoc(row: Record<string, unknown> | undefined) {
  if (!row) return null;
  const doc: Record<string, unknown> = {};
  for (const [column, value] of Object.entries(row)) {
    doc[toCamel(column)] = BOOLEAN_COLUMNS.has(column) ? Boolean(value) : value;
  }
  doc._id = row.id;
  return doc;
}

/** Builds a WHERE clause from the Mongo-style filters this suite uses. */
function buildWhere(filter: Record<string, any> = {}) {
  const clauses: string[] = [];
  const args: any[] = [];

  for (const [field, condition] of Object.entries(filter)) {
    const column = toSnake(field);
    if (condition && typeof condition === "object" && "$regex" in condition) {
      // The suite only ever uses a literal substring pattern (e.g. "\\.1738…").
      clauses.push(`${column} LIKE ?`);
      args.push(`%${String(condition.$regex).replace(/\\/g, "")}%`);
    } else if (condition && typeof condition === "object" && "$in" in condition) {
      const list = condition.$in as unknown[];
      clauses.push(`${column} IN (${list.map(() => "?").join(", ")})`);
      args.push(...list);
    } else {
      clauses.push(`${column} = ?`);
      args.push(typeof condition === "boolean" ? Number(condition) : condition);
    }
  }

  return { sql: clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "", args };
}

function makeDb(client: Client) {
  return {
    collection(name: string) {
      const table = TABLES[name] ?? name;
      return {
        async countDocuments(filter: Record<string, any> = {}) {
          const { sql, args } = buildWhere(filter);
          const result = await client.execute({ sql: `SELECT COUNT(*) AS c FROM ${table}${sql}`, args });
          return Number(result.rows[0].c);
        },
        async findOne(filter: Record<string, any>) {
          const { sql, args } = buildWhere(filter);
          const result = await client.execute({ sql: `SELECT * FROM ${table}${sql} LIMIT 1`, args });
          return toDoc(result.rows[0] as Record<string, unknown> | undefined);
        },
        async insertOne(doc: Record<string, any>) {
          // departments live in their own table now.
          const { departments, ...rest } = doc;
          const columns = Object.keys(rest).map(toSnake);
          const values = Object.values(rest).map((v) =>
            typeof v === "boolean" ? Number(v) : v instanceof Date ? v.toISOString() : v
          );
          await client.execute({
            sql: `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
            args: values as never[]
          });
          if (Array.isArray(departments)) {
            for (const department of departments) {
              await client.execute({
                sql: "INSERT INTO user_departments (user_id, department) VALUES (?, ?)",
                args: [rest.id, department]
              });
            }
          }
        },
        async updateOne(filter: Record<string, any>, update: { $set: Record<string, any> }) {
          const sets = Object.keys(update.$set).map((field) => `${toSnake(field)} = ?`);
          const setArgs = Object.values(update.$set).map((v) => (typeof v === "boolean" ? Number(v) : v));
          const { sql, args } = buildWhere(filter);
          await client.execute({
            sql: `UPDATE ${table} SET ${sets.join(", ")}${sql}`,
            args: [...setArgs, ...args] as never[]
          });
        },
        async deleteOne(filter: Record<string, any>) {
          const { sql, args } = buildWhere(filter);
          await client.execute({ sql: `DELETE FROM ${table}${sql}`, args: args as never[] });
        },
        async deleteMany(filter: Record<string, any>) {
          const { sql, args } = buildWhere(filter);
          await client.execute({ sql: `DELETE FROM ${table}${sql}`, args: args as never[] });
        }
      };
    }
  };
}

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

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3002";
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? "Password@123";
const DATABASE_URL = process.env.DATABASE_URL!;

// This suite CREATES and DELETES accounts, tasks and entries. Pointed at the live Turso
// database it would corrupt real data. Only a local SQLite file is ever acceptable.
if (!DATABASE_URL?.startsWith("file:")) {
  console.error("\nRefusing to run the test suite against a non-local database.");
  console.error(`DATABASE_URL = ${String(DATABASE_URL).split("?")[0]}\n`);
  console.error("These tests create and delete rows. Point DATABASE_URL at a local SQLite file");
  console.error("(file:./data/mad-club.db) in .env.local and try again.\n");
  process.exit(1);
}

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed++;
    console.log(`  PASS  ${name}`);
  } else {
    failed++;
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` -- ${detail}` : ""}`);
  }
}

function section(title: string) {
  console.log(`\n${title}`);
}

/** Minimal cookie jar so we can hold a real session across requests. */
class Session {
  private cookies = new Map<string, string>();

  private header() {
    return [...this.cookies].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  private absorb(response: Response) {
    for (const raw of response.headers.getSetCookie?.() ?? []) {
      const [pair] = raw.split(";");
      const index = pair.indexOf("=");
      if (index === -1) continue;
      const name = pair.slice(0, index).trim();
      const value = pair.slice(index + 1).trim();
      if (value === "" ) this.cookies.delete(name);
      else this.cookies.set(name, value);
    }
  }

  async fetch(pathname: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    const cookieHeader = this.header();
    if (cookieHeader) headers.set("cookie", cookieHeader);
    const response = await fetch(`${BASE_URL}${pathname}`, { ...init, headers, redirect: "manual" });
    this.absorb(response);
    return response;
  }

  async json(pathname: string, init: RequestInit = {}) {
    const response = await this.fetch(pathname, init);
    let body: any = null;
    try {
      body = await response.json();
    } catch {
      /* non-JSON response */
    }
    return { status: response.status, body };
  }

  async post(pathname: string, payload: unknown) {
    return this.json(pathname, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  async patch(pathname: string, payload: unknown) {
    return this.json(pathname, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  }

  hasSession() {
    return [...this.cookies.keys()].some((name) => name.includes("session-token"));
  }

  /** Drives the real NextAuth credentials flow: CSRF token, then the callback POST. */
  async login(email: string, password: string, year: string, portal: "member" | "admin") {
    const csrfResponse = await this.fetch("/api/auth/csrf");
    const { csrfToken } = (await csrfResponse.json()) as { csrfToken: string };

    const form = new URLSearchParams({ csrfToken, email, password, year, portal, rememberMe: "false" });
    const response = await this.fetch("/api/auth/callback/credentials", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString()
    });

    // NextAuth redirects to /api/auth/error?error=CredentialsSignin on a bad login.
    const location = response.headers.get("location") ?? "";
    return this.hasSession() && !location.includes("error");
  }
}

async function main() {
  console.log(`Running end-to-end tests against ${BASE_URL}\n`);

  const client = createClient({ url: DATABASE_URL });
  const db = makeDb(client);

  const anon = new Session();
  const stamp = Date.now();

  // ---------------------------------------------------------------- health / anon access
  section("Health and unauthenticated access");

  const health = await anon.json("/api/health");
  check("GET /api/health returns 200 with a connected database", health.status === 200 && health.body?.database === "connected", `got ${health.status}`);

  const anonDashboard = await anon.json("/api/dashboard");
  check("GET /api/dashboard rejects an anonymous caller (401)", anonDashboard.status === 401, `got ${anonDashboard.status}`);

  const anonTasks = await anon.json("/api/tasks");
  check("GET /api/tasks rejects an anonymous caller (401)", anonTasks.status === 401, `got ${anonTasks.status}`);

  // /api/admin/seed used to be an unauthenticated DELETE-everything endpoint that also
  // injected the demo profiles. The route has been deleted outright: nothing in the app
  // should be able to wipe the database or create test accounts over HTTP.
  const usersBefore = await db.collection("users").countDocuments();
  const anonSeed = await anon.json("/api/admin/seed", { method: "POST" });
  const usersAfterSeedAttempt = await db.collection("users").countDocuments();
  check("POST /api/admin/seed no longer exists (404)", anonSeed.status === 404, `got ${anonSeed.status}`);
  check("...and the database was NOT wiped by that call", usersAfterSeedAttempt === usersBefore && usersBefore > 0, `${usersBefore} -> ${usersAfterSeedAttempt}`);

  const protectedPage = await anon.fetch("/dashboard");
  check("GET /dashboard redirects an anonymous visitor to login", protectedPage.status === 307 || protectedPage.status === 302, `got ${protectedPage.status}`);

  // ------------------------------------------------------ team head role at registration
  section("Team head role rules at registration");

  // A 4th year MUST choose a team head role -- the form requires it, and the server
  // enforces it independently.
  const missingRole = await anon.post("/api/auth/register", {
    name: "No Role",
    email: `norole.${stamp}@nitkkr.ac.in`,
    password: "NoRolePass@123",
    year: "4th Year",
    departments: ["Media Team"]
  });
  // The registration limiter lives in the server's memory, so a second run against the same
  // process starts with the budget already spent and every setup registration 429s. That
  // cascades into a wall of confusing failures, so name the real cause up front.
  if (missingRole.status === 429) {
    console.error(
      "\nThe registration rate limit is already exhausted on this server.\n" +
        "The limiter is in-memory, so re-running the suite against the same process fails.\n" +
        "Restart the dev server and re-run.\n"
    );
    process.exit(1);
  }

  check("A 4th year CANNOT register without a team head role (400)", missingRole.status === 400, `got ${missingRole.status}`);

  // Non-final years are never shown the field; sending one anyway is a hand-crafted
  // escalation attempt and is rejected outright.
  const juniorClaimingRole = await anon.post("/api/auth/register", {
    name: "Junior Climber",
    email: `junior.${stamp}@nitkkr.ac.in`,
    password: "JuniorPass@123",
    year: "2nd Year",
    departments: ["Media Team"],
    teamHeadRole: "Design Team Head"
  });
  check("A 2nd year CANNOT claim a team head role (400)", juniorClaimingRole.status === 400, `got ${juniorClaimingRole.status}`);

  const juniorDoc = await db.collection("users").findOne({ email: `junior.${stamp}@nitkkr.ac.in` });
  check("...and no account was created for them", !juniorDoc);

  // 1st years are not registering for now. The form hides the option; the server rejects it
  // if sent directly.
  const firstYearEmail = `firstyear.${stamp}@nitkkr.ac.in`;
  const firstYearReg = await anon.post("/api/auth/register", {
    name: "First Year",
    email: firstYearEmail,
    password: "FirstYear@123",
    year: "1st Year",
    departments: ["Media Team"]
  });
  check("A 1st year CANNOT register (400)", firstYearReg.status === 400, `got ${firstYearReg.status}`);
  const firstYearDoc = await db.collection("users").findOne({ email: firstYearEmail });
  check("...and no account was created for them", !firstYearDoc);

  // "Secretary" is offered in the dropdown but is a restricted label: only an email on the
  // AUTHORIZED_SECRETARIES allowlist may claim it. Otherwise any 4th year could present
  // themselves to the club as a Secretary.
  const fakeSecretaryEmail = `fakesec.${stamp}@nitkkr.ac.in`;
  const fakeSecretary = await anon.post("/api/auth/register", {
    name: "Fake Secretary",
    email: fakeSecretaryEmail,
    password: "FakeSecPass@123",
    year: "4th Year",
    departments: ["Media Team"],
    teamHeadRole: "Secretary"
  });
  check(
    "A non-allowlisted 4th year CANNOT claim the Secretary role (400)",
    fakeSecretary.status === 400,
    `got ${fakeSecretary.status}`
  );

  const fakeSecretaryDoc = await db.collection("users").findOne({ email: fakeSecretaryEmail });
  check("...and no account was created for them", !fakeSecretaryDoc);

  // The positive case: an allowlisted secretary CAN pick it. This is the real signup flow --
  // the seed already created this account, so drop it first and register it the way a human
  // would on the live site.
  const realSecretaryEmail = (process.env.AUTHORIZED_SECRETARIES ?? "").split(",").map((e) => e.trim())[3];
  await db.collection("users").deleteOne({ email: realSecretaryEmail });

  const realSecretaryRegister = await anon.post("/api/auth/register", {
    name: "Real Secretary",
    email: realSecretaryEmail,
    password: "RealSecPass@123",
    year: "4th Year",
    departments: ["EP Team"],
    teamHeadRole: "Secretary"
  });
  check(
    `An allowlisted secretary (${realSecretaryEmail}) CAN pick the Secretary role (201)`,
    realSecretaryRegister.status === 201,
    `got ${realSecretaryRegister.status}`
  );

  const realSecretaryDoc = await db.collection("users").findOne({ email: realSecretaryEmail });
  check("...the Secretary label is stored", realSecretaryDoc?.teamHeadRole === "Secretary", `stored ${realSecretaryDoc?.teamHeadRole}`);
  check("...and they are granted role=secretary from the allowlist", realSecretaryDoc?.role === "secretary", `stored ${realSecretaryDoc?.role}`);

  const realSecretarySession = new Session();
  const realSecretaryLoggedIn = await realSecretarySession.login(
    realSecretaryEmail,
    "RealSecPass@123",
    "4th Year",
    "admin"
  );
  check("...and can sign in through the ADMIN portal with their chosen password", realSecretaryLoggedIn);

  // ACCEPTED RISK, by product decision: a 4th year's self-declared role takes effect on
  // signup, so registering makes you a team lead. There is no email verification, so this
  // is reachable by anyone who types an @nitkkr.ac.in address. These checks pin that
  // behaviour so it stays deliberate and visible rather than becoming an accident.
  const leadEmail = `lead.${stamp}@nitkkr.ac.in`;
  const leadPassword = "LeadPass@123";
  const selfLead = await anon.post("/api/auth/register", {
    name: "Final Year Lead",
    email: leadEmail,
    password: leadPassword,
    year: "4th Year",
    departments: ["Media Team"],
    teamHeadRole: "Media Team Head",
    canManageTeam: true,
    role: "secretary"
  });
  check("A 4th year CAN register with a team head role (201)", selfLead.status === 201, `got ${selfLead.status}`);

  const leadDoc = await db.collection("users").findOne({ email: leadEmail });
  check("...the chosen role is granted immediately", leadDoc?.teamHeadRole === "Media Team Head", `stored ${leadDoc?.teamHeadRole}`);
  check("...but role: 'secretary' in the body is STILL ignored (allowlist only)", leadDoc?.role === "member", `stored ${leadDoc?.role}`);
  check("...and canManageTeam is STILL not self-assignable", leadDoc?.canManageTeam === false, `stored ${leadDoc?.canManageTeam}`);

  const lead = new Session();
  const leadLoggedIn = await lead.login(leadEmail, leadPassword, "4th Year", "member");
  check("The self-declared team head can sign in", leadLoggedIn);

  const leadCreateTask = await lead.post("/api/tasks", {
    title: `Lead task ${stamp}`,
    description: "Created by a self-declared team head",
    assignedTo: [String(leadDoc?._id)],
    priority: "Low",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    attachments: []
  });
  check("ACCEPTED RISK: a self-declared team head CAN create tasks (201)", leadCreateTask.status === 201, `got ${leadCreateTask.status}`);

  // Secretary-only surfaces stay closed even to a team lead.
  const leadAdmin = await lead.json("/api/admin/members");
  check("...but a team head still CANNOT list all members (403, secretary only)", leadAdmin.status === 403, `got ${leadAdmin.status}`);

  const leadExport = await lead.fetch("/api/admin/export");
  check("...and still CANNOT export the member CSV (403, secretary only)", leadExport.status === 403, `got ${leadExport.status}`);

  // ------------------------------------------------------------- ordinary member scoping
  section("Ordinary member has no elevated access");

  const attackerEmail = `outsider.${stamp}@nitkkr.ac.in`;
  const attackerPassword = "OutsiderPass@123";

  const plainRegister = await anon.post("/api/auth/register", {
    name: "Plain Member",
    email: attackerEmail,
    password: attackerPassword,
    year: "2nd Year",
    departments: ["Design Team"],
    canManageTeam: true,
    role: "secretary"
  });
  check("An ordinary member can register (201)", plainRegister.status === 201, `got ${plainRegister.status}`);

  const attackerDoc = await db.collection("users").findOne({ email: attackerEmail });
  check("...with no team head role", attackerDoc?.teamHeadRole === "None", `stored ${attackerDoc?.teamHeadRole}`);
  check("...canManageTeam ignored (stored as false)", attackerDoc?.canManageTeam === false, `stored ${attackerDoc?.canManageTeam}`);
  check("...role ignored (stored as 'member')", attackerDoc?.role === "member", `stored ${attackerDoc?.role}`);

  const attacker = new Session();
  const attackerLoggedIn = await attacker.login(attackerEmail, attackerPassword, "2nd Year", "member");
  check("The ordinary member can sign in", attackerLoggedIn);

  const attackerCreateTask = await attacker.post("/api/tasks", {
    title: "Malicious task",
    description: "Should never be created",
    assignedTo: [String(attackerDoc?._id)],
    priority: "High",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    attachments: []
  });
  check("Ordinary member CANNOT create tasks (403)", attackerCreateTask.status === 403, `got ${attackerCreateTask.status}`);

  const attackerAdmin = await attacker.json("/api/admin/members");
  check("Ordinary member CANNOT list all members (403)", attackerAdmin.status === 403, `got ${attackerAdmin.status}`);

  const attackerExport = await attacker.fetch("/api/admin/export");
  check("Ordinary member CANNOT export the member CSV (403)", attackerExport.status === 403, `got ${attackerExport.status}`);

  const attackerDashboard = await attacker.json("/api/dashboard");
  const totalSponsorships = await db.collection("sponsorshipentries").countDocuments();
  check(
    "Ordinary member's dashboard is scoped to their own records, not the whole club",
    attackerDashboard.status === 200 && attackerDashboard.body.sponsorships.length === 0 && totalSponsorships > 0,
    `saw ${attackerDashboard.body?.sponsorships?.length} of ${totalSponsorships} sponsorships`
  );

  // ------------------------------------------------------------------------ secretary flow
  section("Secretary privileges");

  const secretaryEmail = (process.env.AUTHORIZED_SECRETARIES ?? "").split(",")[0]?.trim().toLowerCase();
  const secretary = new Session();
  const secretaryLoggedIn = await secretary.login(secretaryEmail, SEED_PASSWORD, "4th Year", "admin");
  check(`Secretary (${secretaryEmail}) can sign in through the admin portal`, secretaryLoggedIn);

  const rohan = await db.collection("users").findOne({ email: "rohan@nitkkr.ac.in" });
  const createTask = await secretary.post("/api/tasks", {
    title: `E2E task ${stamp}`,
    description: "Created by the end-to-end suite",
    assignedTo: [String(rohan?._id)],
    priority: "High",
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    attachments: []
  });
  check("Secretary CAN create a task (201)", createTask.status === 201, `got ${createTask.status}`);
  const taskId = String(createTask.body?._id ?? "");

  // Malformed body used to throw inside request.json() and surface as a 500.
  const malformed = await secretary.fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "this is not json"
  });
  check("Malformed JSON returns 400, not 500", malformed.status === 400, `got ${malformed.status}`);

  const newMemberEmail = `member.${stamp}@nitkkr.ac.in`;
  const createMember = await secretary.post("/api/admin/members", {
    name: "=HACK() Injected",
    email: newMemberEmail,
    password: "MemberPass@123",
    year: "2nd Year",
    departments: ["Media Team"],
    teamHeadRole: "None",
    canManageTeam: false
  });
  check("Secretary CAN create a member (201)", createMember.status === 201, `got ${createMember.status}`);
  check(
    "...and the response does NOT leak the bcrypt password hash",
    createMember.body && !("passwordHash" in createMember.body) && !JSON.stringify(createMember.body).includes("$2"),
    JSON.stringify(createMember.body ?? {}).slice(0, 120)
  );

  const exportResponse = await secretary.fetch("/api/admin/export");
  const csv = await exportResponse.text();
  check("Secretary CAN download the CSV export (200)", exportResponse.status === 200, `got ${exportResponse.status}`);
  check(
    "CSV neutralizes spreadsheet formula injection (=HACK becomes '=HACK)",
    csv.includes("'=HACK"),
    csv.split("\n").find((line) => line.includes("HACK")) ?? "row not found"
  );

  // ------------------------------------------------------------ team-scoped performance
  section("Performance visibility is scoped to the viewer's own team");

  // Seed fixtures: diya = EP Head (EP Team), kabir = Design Head (Design Team),
  // rohan = Media Team, isha = Content Team, meera = Sponsorship Team.
  const epHead = new Session();
  const epHeadLoggedIn = await epHead.login("diya@nitkkr.ac.in", SEED_PASSWORD, "4th Year", "member");
  check("Team head (EP) can sign in", epHeadLoggedIn);

  const epHeadDashboard = await epHead.json("/api/dashboard");
  const epHeadVisible: string[] = (epHeadDashboard.body?.memberStats ?? []).map((m: any) => m.email);

  check("Team head sees their OWN performance", epHeadVisible.includes("diya@nitkkr.ac.in"), epHeadVisible.join(", "));
  check(
    "Team head CANNOT see another team's members (Media, Design, Content, Sponsorship)",
    !epHeadVisible.includes("rohan@nitkkr.ac.in") &&
      !epHeadVisible.includes("kabir@nitkkr.ac.in") &&
      !epHeadVisible.includes("isha@nitkkr.ac.in") &&
      !epHeadVisible.includes("meera@nitkkr.ac.in"),
    `saw: ${epHeadVisible.join(", ")}`
  );

  // A member sharing the team IS visible to that team's head.
  const epTeammateEmail = `epmate.${stamp}@nitkkr.ac.in`;
  await db.collection("users").insertOne({
    // SQLite will not invent a primary key the way Mongo invented an _id.
    id: crypto.randomUUID(),
    name: "EP Teammate",
    email: epTeammateEmail,
    passwordHash: "x",
    year: "2nd Year",
    role: "member",
    departments: ["EP Team"],
    teamHeadRole: "None",
    canManageTeam: false,
    active: true,
    createdAt: new Date(),
    updatedAt: new Date()
  });

  const epHeadDashboard2 = await epHead.json("/api/dashboard");
  const epHeadVisible2: string[] = (epHeadDashboard2.body?.memberStats ?? []).map((m: any) => m.email);
  check("Team head CAN see a member of their OWN team", epHeadVisible2.includes(epTeammateEmail), epHeadVisible2.join(", "));

  // Secretary is the only role that sees the whole club.
  const secretaryDashboard = await secretary.json("/api/dashboard");
  const secretaryVisible: string[] = (secretaryDashboard.body?.memberStats ?? []).map((m: any) => m.email);
  check(
    "Secretary sees EVERY team's performance",
    ["diya@nitkkr.ac.in", "kabir@nitkkr.ac.in", "meera@nitkkr.ac.in", "rohan@nitkkr.ac.in", "isha@nitkkr.ac.in"].every(
      (email) => secretaryVisible.includes(email)
    ),
    `saw: ${secretaryVisible.join(", ")}`
  );
  check(
    "...and the secretary's view is strictly broader than the team head's",
    secretaryVisible.length > epHeadVisible2.length,
    `secretary ${secretaryVisible.length} vs team head ${epHeadVisible2.length}`
  );

  await db.collection("users").deleteOne({ email: epTeammateEmail });

  // -------------------------------------------------------------------- member task update
  section("Task progress updates (previously unreachable from the UI)");

  const member = new Session();
  const memberLoggedIn = await member.login("rohan@nitkkr.ac.in", SEED_PASSWORD, "2nd Year", "member");
  check("Assigned member can sign in", memberLoggedIn);

  const update = await member.post(`/api/tasks/${taskId}/updates`, {
    status: "Completed",
    progress: 100,
    comment: "Finished by the e2e suite"
  });
  check("Assignee CAN update their task status (200)", update.status === 200, `got ${update.status}`);

  const updatedTask = await db.collection("tasks").findOne({ title: `E2E task ${stamp}` });
  check("...and the task really is Completed at 100% in the database", updatedTask?.status === "Completed" && updatedTask?.progress === 100, `${updatedTask?.status} / ${updatedTask?.progress}%`);

  const foreignTask = await db.collection("tasks").findOne({ title: "Prepare sponsor prospect list" });
  const idorAttempt = await member.post(`/api/tasks/${String(foreignTask?._id)}/updates`, {
    status: "Completed",
    progress: 100,
    comment: "Not my task"
  });
  check("Member CANNOT update a task assigned to someone else (403)", idorAttempt.status === 403, `got ${idorAttempt.status}`);

  // ------------------------------------------------------------- comments and mentions
  section("Comments, @mentions and the activity trail");

  // The task detail endpoint returns the task, its activity trail and its thread together.
  const detail = await member.json(`/api/tasks/${taskId}`);
  check("Assignee CAN open the task detail (200)", detail.status === 200, `got ${detail.status}`);
  check("...it includes the activity trail", Array.isArray(detail.body?.timeline) && detail.body.timeline.length > 0, `${detail.body?.timeline?.length} events`);
  check("...with the actor's name resolved", Boolean(detail.body?.timeline?.[0]?.actorName), "actorName missing");
  check("...and an (empty) comment thread", Array.isArray(detail.body?.comments), "comments missing");

  // An unrelated member must not read another task's thread.
  const outsiderDetail = await attacker.json(`/api/tasks/${taskId}`);
  check("A non-assignee CANNOT open someone else's task (403)", outsiderDetail.status === 403, `got ${outsiderDetail.status}`);

  const outsiderComments = await attacker.json(`/api/tasks/${taskId}/comments`);
  check("...nor read its comments (403)", outsiderComments.status === 403, `got ${outsiderComments.status}`);

  const outsiderPost = await attacker.post(`/api/tasks/${taskId}/comments`, { body: "let me in" });
  check("...nor comment on it (403)", outsiderPost.status === 403, `got ${outsiderPost.status}`);

  // Post a comment mentioning the secretary.
  const secretaryDoc = await db.collection("users").findOne({ email: secretaryEmail });
  const posted = await member.post(`/api/tasks/${taskId}/comments`, {
    body: `Blocked on the venue, @${secretaryDoc?.name} can you confirm?`,
    mentions: [String(secretaryDoc?._id)],
    attachments: [{ url: "https://example.com/brief.pdf", label: "Brief" }]
  });
  check("Assignee CAN post a comment (201)", posted.status === 201, `got ${posted.status}`);

  const withComment = await member.json(`/api/tasks/${taskId}`);
  const firstComment = withComment.body?.comments?.[0];
  check("...the comment appears in the thread", withComment.body?.comments?.length === 1, `${withComment.body?.comments?.length} comments`);
  check("...with its author resolved", firstComment?.author?.email === "rohan@nitkkr.ac.in", `got ${firstComment?.author?.email}`);
  check("...its mention recorded", firstComment?.mentions?.length === 1, `${firstComment?.mentions?.length} mentions`);
  check("...and its attachment recorded", firstComment?.attachments?.[0]?.url === "https://example.com/brief.pdf", "attachment missing");

  const emptyComment = await member.post(`/api/tasks/${taskId}/comments`, { body: "   " });
  check("An empty comment is rejected (400)", emptyComment.status === 400, `got ${emptyComment.status}`);

  const badAttachment = await member.post(`/api/tasks/${taskId}/comments`, {
    body: "see this",
    attachments: [{ url: "not-a-url" }]
  });
  check("An attachment that is not a URL is rejected (400)", badAttachment.status === 400, `got ${badAttachment.status}`);

  // A crafted request must not be able to mention a user who does not exist.
  const bogusMention = await member.post(`/api/tasks/${taskId}/comments`, {
    body: "hello",
    mentions: ["00000000-0000-0000-0000-000000000000"]
  });
  check("A mention of a non-existent user is ignored, not fatal (201)", bogusMention.status === 201, `got ${bogusMention.status}`);

  // The mentioned secretary should now see it.
  const secretaryMentions = await secretary.json("/api/mentions");
  check("The mentioned user sees the mention (200)", secretaryMentions.status === 200, `got ${secretaryMentions.status}`);
  check("...exactly one of them", secretaryMentions.body?.mentions?.length === 1, `${secretaryMentions.body?.mentions?.length} mentions`);
  check("...unread", secretaryMentions.body?.unreadCount === 1, `unreadCount ${secretaryMentions.body?.unreadCount}`);
  check("...carrying the task title", secretaryMentions.body?.mentions?.[0]?.taskTitle === `E2E task ${stamp}`, `got ${secretaryMentions.body?.mentions?.[0]?.taskTitle}`);

  // The badge count is served with the dashboard.
  const secretaryDash = await secretary.json("/api/dashboard");
  check("The dashboard reports the unread mention count for the badge", secretaryDash.body?.mentionCount === 1, `got ${secretaryDash.body?.mentionCount}`);

  // Someone who was not mentioned must not see it.
  const attackerMentions = await attacker.json("/api/mentions");
  check("A user who was NOT mentioned sees nothing", attackerMentions.body?.mentions?.length === 0, `${attackerMentions.body?.mentions?.length} mentions`);

  const anonMentions = await anon.json("/api/mentions");
  check("GET /api/mentions rejects an anonymous caller (401)", anonMentions.status === 401, `got ${anonMentions.status}`);

  // Marking read clears the badge -- and only for the caller.
  const markMentionsRead = await secretary.post("/api/mentions", {});
  check("Marking mentions read succeeds (200)", markMentionsRead.status === 200, `got ${markMentionsRead.status}`);

  const afterMentionsRead = await secretary.json("/api/mentions");
  check("...the unread count drops to zero", afterMentionsRead.body?.unreadCount === 0, `unreadCount ${afterMentionsRead.body?.unreadCount}`);
  check("...but the mention is still listed", afterMentionsRead.body?.mentions?.length === 1, `${afterMentionsRead.body?.mentions?.length} mentions`);

  const dashAfterRead = await secretary.json("/api/dashboard");
  check("...and the dashboard badge clears", dashAfterRead.body?.mentionCount === 0, `got ${dashAfterRead.body?.mentionCount}`);

  // ----------------------------------------------------------------------- task deletion
  section("Task deletion (secretaries only)");

  // Deletion is narrower than every other task permission: a team head can create and update
  // tasks but may NOT destroy one, because deleting it takes the timeline with it.
  const memberDelete = await member.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  check("An ordinary member CANNOT delete a task (403)", memberDelete.status === 403, `got ${memberDelete.status}`);

  const leadDelete = await lead.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  check("A TEAM HEAD CANNOT delete a task (403)", leadDelete.status === 403, `got ${leadDelete.status}`);

  const stillThere = await db.collection("tasks").findOne({ _id: taskId });
  check("...and the task is still in the database after those attempts", Boolean(stillThere));

  const anonDelete = await anon.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  check("An anonymous caller CANNOT delete a task (401)", anonDelete.status === 401, `got ${anonDelete.status}`);

  const secretaryDelete = await secretary.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  check("A SECRETARY CAN delete a task (200)", secretaryDelete.status === 200, `got ${secretaryDelete.status}`);

  const gone = await db.collection("tasks").findOne({ _id: taskId });
  check("...and the task is really gone from the database", !gone);

  // The child rows must go too, or the database fills with orphans. SQLite does not cascade
  // unless PRAGMA foreign_keys is on, which it is not -- so the route deletes them by hand.
  const orphanAssignees = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM task_assignees WHERE task_id = ?",
    args: [taskId]
  });
  const orphanTimeline = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM task_timeline WHERE task_id = ?",
    args: [taskId]
  });
  check("...its assignee rows are gone (no orphans)", Number(orphanAssignees.rows[0].c) === 0, `${orphanAssignees.rows[0].c} left`);
  check("...its timeline rows are gone (no orphans)", Number(orphanTimeline.rows[0].c) === 0, `${orphanTimeline.rows[0].c} left`);

  // Comments carry their own children (mentions, attachments) keyed by comment id, not task
  // id. If they were not cleared, a stale mention would keep counting toward someone's badge
  // forever, pointing at a task that no longer exists.
  const orphanComments = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM task_comments WHERE task_id = ?",
    args: [taskId]
  });
  check("...its comments are gone (no orphans)", Number(orphanComments.rows[0].c) === 0, `${orphanComments.rows[0].c} left`);

  const orphanMentions = await client.execute("SELECT COUNT(*) AS c FROM comment_mentions WHERE comment_id NOT IN (SELECT id FROM task_comments)");
  check("...no mention rows are left pointing at deleted comments", Number(orphanMentions.rows[0].c) === 0, `${orphanMentions.rows[0].c} left`);

  const orphanAttachments = await client.execute("SELECT COUNT(*) AS c FROM comment_attachments WHERE comment_id NOT IN (SELECT id FROM task_comments)");
  check("...no attachment rows are left pointing at deleted comments", Number(orphanAttachments.rows[0].c) === 0, `${orphanAttachments.rows[0].c} left`);

  const secretaryDashAfterDelete = await secretary.json("/api/dashboard");
  check("...and the deleted task's mention no longer counts", secretaryDashAfterDelete.body?.mentionCount === 0, `got ${secretaryDashAfterDelete.body?.mentionCount}`);

  const deleteMissing = await secretary.fetch(`/api/tasks/${taskId}`, { method: "DELETE" });
  check("Deleting an already-deleted task returns 404", deleteMissing.status === 404, `got ${deleteMissing.status}`);

  // ------------------------------------------------------------------------- EP entry route
  section("EP entries (the route that did not exist)");

  const epCreate = await member.post("/api/ep-entries", {
    epName: `E2E Partnership ${stamp}`,
    organization: "NIT Delhi",
    contactNumber: "9876543210",
    email: "partner@example.com",
    personContacted: "Coordinator",
    date: new Date().toISOString(),
    discussionSummary: "Initial discussion held.",
    currentStatus: "Interested",
    detailedUpdate: "Follow up next week."
  });
  check("POST /api/ep-entries creates an EP entry (201, was 404)", epCreate.status === 201, `got ${epCreate.status}`);

  const epDoc = await db.collection("epentries").findOne({ epName: `E2E Partnership ${stamp}` });
  check("...and the EP entry is persisted to the database", Boolean(epDoc));

  // -------------------------------------------------------------------- pipeline movement
  section("Pipeline status transitions (previously create-only)");

  const epId = String(epDoc?._id);
  const epMove = await member.patch(`/api/ep-entries/${epId}`, {
    currentStatus: "Confirmed",
    detailedUpdate: "Partnership agreed."
  });
  check("Owner CAN move their EP entry to a new status (200)", epMove.status === 200, `got ${epMove.status}`);

  const epAfter = await db.collection("epentries").findOne({ _id: epDoc?._id });
  check("...the EP status really changed in the database", epAfter?.currentStatus === "Confirmed", `status ${epAfter?.currentStatus}`);

  // The history trail used to be an array embedded in the document; it is now its own table.
  const epHistoryRows = await client.execute({
    sql: "SELECT COUNT(*) AS c FROM ep_history WHERE entry_id = ?",
    args: [epId]
  });
  const epHistoryCount = Number(epHistoryRows.rows[0].c);
  check("...and the change is recorded in the history trail", epHistoryCount > 0, `${epHistoryCount} history entries`);

  const epForeign = await attacker.patch(`/api/ep-entries/${epId}`, {
    currentStatus: "Rejected",
    detailedUpdate: "Not mine to touch."
  });
  check("A non-owner, non-lead CANNOT move someone else's EP entry (403)", epForeign.status === 403, `got ${epForeign.status}`);

  // Sponsorships: seeded entry belongs to meera, a team lead (canManageTeam).
  const sponsorDoc = await db.collection("sponsorshipentries").findOne({ companyName: "North Tech Labs" });
  const sponsorId = String(sponsorDoc?._id);

  const sponsorMove = await secretary.patch(`/api/sponsorships/${sponsorId}`, {
    currentStatus: "Confirmed",
    detailedUpdate: "Sponsor signed the contract."
  });
  check("Secretary CAN move a sponsorship along the pipeline (200)", sponsorMove.status === 200, `got ${sponsorMove.status}`);

  const sponsorAfter = await db.collection("sponsorshipentries").findOne({ _id: sponsorDoc?._id });
  check("...the sponsorship status really changed", sponsorAfter?.currentStatus === "Confirmed", `status ${sponsorAfter?.currentStatus}`);

  const sponsorForeign = await attacker.patch(`/api/sponsorships/${sponsorId}`, {
    currentStatus: "Rejected",
    detailedUpdate: "Not mine."
  });
  check("Ordinary member CANNOT move someone else's sponsorship (403)", sponsorForeign.status === 403, `got ${sponsorForeign.status}`);

  // --------------------------------------------------------------------- design workflow
  section("Design request workflow and separation of duties");

  const kabir = await db.collection("users").findOne({ email: "kabir@nitkkr.ac.in" });
  const isha = await db.collection("users").findOne({ email: "isha@nitkkr.ac.in" });

  // Kabir is the Design Team Head: he can create requests and approve them.
  const designHead = new Session();
  const designHeadLoggedIn = await designHead.login("kabir@nitkkr.ac.in", SEED_PASSWORD, "4th Year", "member");
  check("Design head can sign in", designHeadLoggedIn);

  const designCreate = await designHead.post("/api/design-requests", {
    designTitle: `E2E Poster ${stamp}`,
    requirement: "Event poster",
    description: "A1 poster for the fest",
    assignedDesigner: String(isha?._id),
    deadline: new Date(Date.now() + 86_400_000).toISOString(),
    status: "Pending",
    finalSubmissionLink: ""
  });
  check("Design head CAN create a design request (201)", designCreate.status === 201, `got ${designCreate.status}`);
  const designId = String(designCreate.body?._id ?? "");

  // Isha is the assigned designer -- an ordinary 1st-year member.
  const designer = new Session();
  const designerLoggedIn = await designer.login("isha@nitkkr.ac.in", SEED_PASSWORD, "1st Year", "member");
  check("Assigned designer can sign in", designerLoggedIn);

  const designerDashboard = await designer.json("/api/dashboard");
  check(
    "Assigned designer CAN SEE the request on their dashboard (was invisible before)",
    designerDashboard.status === 200 &&
      (designerDashboard.body.designRequests ?? []).some((d: any) => String(d._id) === designId),
    `saw ${(designerDashboard.body?.designRequests ?? []).length} design requests`
  );

  const designerProgress = await designer.patch(`/api/design-requests/${designId}`, {
    status: "Submitted",
    finalSubmissionLink: "https://example.com/poster.png"
  });
  check("Assigned designer CAN submit their work (200)", designerProgress.status === 200, `got ${designerProgress.status}`);

  // Separation of duties: the designer must not be able to sign off on their own work.
  const selfApprove = await designer.patch(`/api/design-requests/${designId}`, { status: "Approved" });
  check("Designer CANNOT approve their own work (403)", selfApprove.status === 403, `got ${selfApprove.status}`);

  const headApprove = await designHead.patch(`/api/design-requests/${designId}`, { status: "Approved" });
  check("Design head CAN approve the request (200)", headApprove.status === 200, `got ${headApprove.status}`);

  const designAfter = await db.collection("designrequests").findOne({ designTitle: `E2E Poster ${stamp}` });
  check(
    "...and the approved status plus submission link are persisted",
    designAfter?.status === "Approved" && designAfter?.finalSubmissionLink === "https://example.com/poster.png",
    `${designAfter?.status} / ${designAfter?.finalSubmissionLink}`
  );

  const outsiderDesign = await attacker.patch(`/api/design-requests/${designId}`, { status: "Rejected" });
  check("Unrelated member CANNOT touch a design request (403)", outsiderDesign.status === 403, `got ${outsiderDesign.status}`);

  // ------------------------------------------------------------------------ notifications
  section("Notifications (write-only until now)");

  const anonNotifications = await anon.json("/api/notifications");
  check("GET /api/notifications rejects an anonymous caller (401)", anonNotifications.status === 401, `got ${anonNotifications.status}`);

  // Isha was notified when the design head created and then approved her request.
  const designerNotifications = await designer.json("/api/notifications");
  check("Designer can read their notifications (200)", designerNotifications.status === 200, `got ${designerNotifications.status}`);
  check(
    "...and has unread notifications from the design workflow",
    (designerNotifications.body?.unreadCount ?? 0) > 0,
    `unreadCount ${designerNotifications.body?.unreadCount}`
  );
  check(
    "...notifications are scoped to the caller only",
    (designerNotifications.body?.notifications ?? []).every((n: any) => String(n.user) === String(isha?._id)),
    "found a notification belonging to another user"
  );

  const markRead = await designer.post("/api/notifications", {});
  check("Marking all notifications read succeeds (200)", markRead.status === 200, `got ${markRead.status}`);

  const afterRead = await designer.json("/api/notifications");
  check("...and the unread count drops to zero", afterRead.body?.unreadCount === 0, `unreadCount ${afterRead.body?.unreadCount}`);

  const badId = await designer.post("/api/notifications", { id: "not-an-object-id" });
  check("A malformed notification id returns 400, not 500", badId.status === 400, `got ${badId.status}`);

  // -------------------------------------------------------------------------- deactivation
  section("Deactivation and session revocation");

  const deactivate = await secretary.fetch(`/api/admin/members/${String(rohan?._id)}`, { method: "DELETE" });
  check("Secretary can deactivate a member (200)", deactivate.status === 200, `got ${deactivate.status}`);

  // The live session held by the deactivated member must stop working immediately -- this
  // is the stale-JWT fix. Before it, the token stayed valid for its full 30 days.
  const deactivatedSessionCall = await member.json("/api/dashboard");
  check("Deactivated member's EXISTING session is revoked (401)", deactivatedSessionCall.status === 401, `got ${deactivatedSessionCall.status}`);

  const reloginSession = new Session();
  const reloginOk = await reloginSession.login("rohan@nitkkr.ac.in", SEED_PASSWORD, "2nd Year", "member");
  check("Deactivated member CANNOT sign in again", !reloginOk);

  // Restore so re-runs start clean.
  await db.collection("users").updateOne({ email: "rohan@nitkkr.ac.in" }, { $set: { active: true } });

  // -------------------------------------------------------------- password change revokes
  section("Password change revokes existing sessions");

  const rotator = new Session();
  await rotator.login(attackerEmail, attackerPassword, "2nd Year", "member");
  const beforeChange = await rotator.json("/api/dashboard");
  check("Session works before the password change", beforeChange.status === 200, `got ${beforeChange.status}`);

  const changed = await rotator.post("/api/auth/change-password", {
    currentPassword: attackerPassword,
    newPassword: "RotatedPass@456"
  });
  check("Password change succeeds (200)", changed.status === 200, `got ${changed.status}`);

  const afterChange = await rotator.json("/api/dashboard");
  check("The SAME session is rejected after the password change (401)", afterChange.status === 401, `got ${afterChange.status}`);

  // ------------------------------------------------------------------------- rate limiting
  // Last, because it deliberately exhausts the per-IP registration budget.
  section("Rate limiting");

  let sawTooManyRequests = false;
  let attempts = 0;
  for (let i = 0; i < 10; i++) {
    attempts++;
    const response = await anon.post("/api/auth/register", {
      name: `Flood ${i}`,
      email: `flood.${stamp}.${i}@nitkkr.ac.in`,
      password: "FloodPass@123",
      year: "1st Year",
      departments: ["Media Team"]
    });
    if (response.status === 429) {
      sawTooManyRequests = true;
      break;
    }
  }
  check("Registration spam is rate limited (429)", sawTooManyRequests, `no 429 after ${attempts} attempts`);

  // ------------------------------------------------------------------------------- cleanup
  await db.collection("users").deleteMany({ email: { $regex: `\\.${stamp}` } });
  await db.collection("users").deleteMany({ email: newMemberEmail });
  // Registered during the Secretary-role test with a chosen password, so `purge:demo` (which
  // only catches seed-default passwords) would not clean it up. Remove it here.
  await db.collection("users").deleteMany({ email: realSecretaryEmail });
  await db.collection("epentries").deleteMany({ epName: `E2E Partnership ${stamp}` });
  await db.collection("tasks").deleteMany({ title: { $in: [`E2E task ${stamp}`, `Lead task ${stamp}`] } });
  await db.collection("designrequests").deleteMany({ designTitle: `E2E Poster ${stamp}` });
  client.close();

  console.log(`\n${"=".repeat(58)}`);
  console.log(`  ${passed} passed, ${failed} failed`);
  if (failures.length) {
    console.log("\n  Failing checks:");
    failures.forEach((name) => console.log(`   - ${name}`));
  }
  console.log("=".repeat(58));
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((error) => {
  console.error("\nTest run crashed:", error);
  process.exit(1);
});
