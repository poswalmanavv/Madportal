# Backend

Everything the server does: data models, the database connection, authentication,
authorization, validation, and the HTTP API.

## Where the code lives

```
src/backend/
  auth.ts          NextAuth config: credentials provider, JWT callbacks, session shape
  db.ts            libSQL client + Drizzle instance, newId(), pingDB()
  schema.ts        Drizzle SQL schema (the single source of truth for the tables)
  queries.ts       Shared user reads (stitches user_departments back into departments[])
  task-queries.ts  Task reads (stitches task_assignees back into assignedTo[])
  dashboard.ts     Builds the dashboard aggregate -- used by BOTH the page and the API
  rbac.ts          Authorization rules: isLeader, canManageTasks, canViewMember, canManageDesign
  validators.ts    Zod schemas -- every request body is parsed through one of these
  http.ts          Route helpers: handleRoute, parseJson, badJson, escapeLike, tooManyRequests
  rate-limit.ts    In-memory fixed-window limiter

drizzle/                  Generated SQL migrations (committed -- do not hand-edit)
src/app/api/**/route.ts   HTTP entry points ONLY (see below)
src/middleware.ts         Edge middleware: redirects anonymous users off /dashboard, /account
src/shared/constants.ts   Enums shared with the frontend (years, departments, statuses)
```

**Why route handlers are not in `src/backend/`.** Next.js resolves routes from the
filesystem: a request to `/api/tasks` is served by `src/app/api/tasks/route.ts` and nowhere
else. Those files cannot move. They are kept deliberately thin -- auth check, validate,
call into `src/backend`, return -- so the actual logic still lives in the backend tree.

Import with the `@backend/*` and `@shared/*` aliases, never with relative `../../` paths.

## Request lifecycle

Every route follows the same shape:

```ts
export async function POST(request: Request) {
  return handleRoute(async () => {                    // 1. catch-all -> logged 500, generic body
    const current = sessionUser(await auth());        // 2. who is calling?
    if (!current) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!canManageTasks(current)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const body = await parseJson(request);            // 3. malformed JSON -> 400, not 500
    if (!body.ok) return badJson();

    const payload = taskSchema.safeParse(body.data);  // 4. validate
    if (!payload.success) return NextResponse.json({ error: payload.error.flatten() }, { status: 400 });

    await connectDB();                                // 5. do the work
    ...
  });
}
```

Skipping any step is a bug. `parseJson` in particular exists because a bare
`await request.json()` throws on a malformed body and surfaces as a 500.

## Authorization model

Three levels, and they are **not** derived from the member's year except where noted.

| Level | Who | Granted by |
|---|---|---|
| Secretary | Full access to every team, member management, CSV export | `AUTHORIZED_SECRETARIES` env allowlist -- never self-assignable |
| Leader (team head) | Create/assign tasks, move any pipeline entry, see **their own team's** performance | `teamHeadRole` (chosen by a 4th year at registration) or `canManageTeam` (granted by a secretary) |
| Member | Own tasks and own records only | default |

`isLeader()` is the single source of truth. It keys off `role`, `teamHeadRole` and
`canManageTeam` — never off `year` alone.

**Performance visibility** (`canViewMember`): a secretary sees every member; a leader sees
only members who share at least one department with them; everyone else sees only
themselves.

### SECURITY: registration grants team-lead access

A 4th year picks their own `teamHeadRole` at registration and it takes effect immediately,
which makes them a leader. The `@nitkkr.ac.in` check is only a string-suffix test — nobody
proves they own the address — so **anyone who types such an address can obtain team-lead
access by signing up.** This is a deliberate product decision, pinned by a test named
"ACCEPTED RISK". Email verification is the control that closes it and is not yet built.

`role: "secretary"` and `canManageTeam` are still **not** self-assignable, whatever the
request body says.

## API reference

All routes require a session unless stated. `403` = authenticated but not permitted.

| Method | Path | Who | Notes |
|---|---|---|---|
| POST | `/api/auth/register` | anonymous | Rate limited: 5/hour/IP. 4th years must send `teamHeadRole`; others must not. |
| POST | `/api/auth/change-password` | any member | Rate limited 5/15min. Sets `passwordChangedAt`, revoking all older sessions. |
| GET/POST | `/api/auth/[...nextauth]` | anonymous | NextAuth handler (sign in / out / session / CSRF). |
| GET | `/api/health` | anonymous | Uptime probe. `503` when Mongo is unreachable. |
| GET | `/api/dashboard` | any member | The one aggregate the UI reads. Scoped by `canViewMember`. |
| GET/POST | `/api/tasks` | member / **leader** | POST requires `canManageTasks`. |
| POST | `/api/tasks/[id]/updates` | assignee or leader | Status + progress + timeline comment. |
| GET/POST | `/api/ep-entries` | any member | |
| PATCH | `/api/ep-entries/[id]` | owner or leader | Moves status, appends history. |
| GET/POST | `/api/sponsorships` | any member | |
| PATCH | `/api/sponsorships/[id]` | owner or leader | Moves status, appends history. |
| GET/POST | `/api/design-requests` | POST: `canManageDesign` | |
| PATCH | `/api/design-requests/[id]` | assigned designer or design head | **Separation of duties:** only the design head/secretary may set `Approved`/`Rejected`. |
| GET/POST | `/api/notifications` | any member | GET lists own + unread count. POST marks one (`{id}`) or all read. |
| GET/POST | `/api/admin/members` | secretary | |
| PUT/DELETE | `/api/admin/members/[id]` | secretary | DELETE is a soft delete (`active: false`), which also revokes live sessions. |
| GET | `/api/admin/export` | secretary | CSV, `?format=excel` for HTML. Formula injection neutralized. |
| POST | `/api/admin/seed` | secretary, non-production | **Wipes the database.** Blocked when `NODE_ENV=production`. |

## Sessions

JWT strategy, 30-day lifetime. The `jwt` callback **re-reads the user from the database on
every request**, so:

- deactivating a member (`active: false`) kills their live session immediately;
- a role change takes effect immediately;
- changing a password revokes every session issued before the change (via `passwordChangedAt`).

Without that re-read, claims would be frozen at sign-in for the full 30 days.

## Database

**SQLite via libSQL**, with Drizzle as the query builder.

| | `DATABASE_URL` | Notes |
|---|---|---|
| Local | `file:./data/mad-club.db` | A real SQLite file. Delete it to start over. |
| Production | `libsql://<db>.turso.io` | Turso. Also needs `DATABASE_AUTH_TOKEN`. |

**A `file:` URL cannot be used in production on Netlify.** Serverless functions get a
read-only filesystem and a throwaway container per request, so a `.db` file would fail to
write or silently vanish. Turso serves the same SQLite over HTTP, so it persists. The SQL,
the schema and the migrations are identical either way — only the URL changes.

### Schema, and what changed coming from MongoDB

Embedded arrays became real tables. That is the whole point of the move:

| MongoDB | SQLite |
|---|---|
| `users.departments[]` | `user_departments` |
| `tasks.assignedTo[]` | `task_assignees` |
| `tasks.timeline[]` | `task_timeline` |
| `epEntries.history[]` | `ep_history` |
| `sponsorships.history[]` | `sponsorship_history` |

So "every task assigned to me" is now an indexed join rather than loading every document and
filtering in memory. `queries.ts` and `task-queries.ts` stitch these back into the
`departments: string[]` / `assignedTo: [...]` shapes the API already returned, so the JSON
contract did not change.

IDs are **UUID strings** (`crypto.randomUUID()`), not integers — they stay opaque in URLs and
keep the same shape Mongo's ObjectIds had. Timestamps are ISO-8601 **text**; SQLite has no
date type, and that format sorts chronologically, so `ORDER BY` works without conversion.
Booleans are **0/1** — remember this when asserting `=== false` in a test.

### Migrations

`drizzle/` holds generated SQL migrations and is committed. Change `schema.ts`, then:

```bash
pnpm db:generate   # writes a new migration file from the schema diff
pnpm db:migrate    # applies pending migrations to DATABASE_URL
```

`db:migrate` is idempotent (Drizzle records what has run). Run it once against Turso before
the first deploy, and again after any schema change. **Netlify does not run migrations for
you** — a new table will not exist in production until you do.

## Known limitations

- **Rate limiting is in-memory**, so it is per-instance. On multi-instance serverless it
  only throttles bursts landing on the same instance. Move to Redis before relying on it.
- **No email verification** — see the security note above.
- **No error monitoring.** Unhandled errors are `console.error`'d and nothing is notified.
- `/api/dashboard` loads all users and tasks then filters in memory. Fine at club scale;
  it will not hold up at thousands of documents.

## Commands

```bash
pnpm dev            # dev server
pnpm build          # production build (a real typecheck -- nothing is suppressed)
pnpm db:generate    # regenerate migrations after editing schema.ts
pnpm db:migrate     # apply migrations to DATABASE_URL (run against Turso before deploying)
pnpm seed           # reset the local DB to fixtures. Refuses a remote DB without SEED_CONFIRM=yes
pnpm purge:demo     # strip seeded fixtures + any account still using the seed password
pnpm test:e2e       # 75 API checks against a running server
```
