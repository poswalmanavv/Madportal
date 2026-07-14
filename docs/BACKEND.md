# Backend

Everything the server does: data models, the database connection, authentication,
authorization, validation, and the HTTP API.

## Where the code lives

```
src/backend/
  auth.ts          NextAuth config: credentials provider, JWT callbacks, session shape
  db.ts            MongoDB connection (cached), DB_NAME
  rbac.ts          Authorization rules: isLeader, canManageTasks, canViewMember, canManageDesign
  validators.ts    Zod schemas -- every request body is parsed through one of these
  http.ts          Route helpers: handleRoute, parseJson, badJson, escapeRegex, tooManyRequests
  rate-limit.ts    In-memory fixed-window limiter
  models/          Mongoose schemas (User, Task, EPEntry, SponsorshipEntry, DesignRequest,
                   Notification, PerformanceLog, Department)

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

MongoDB via Mongoose. `MONGODB_URI` supplies the host; the database name is **always**
`mad-club`, set by `DB_NAME` in `db.ts`, which overrides any path in the URI. The seed
script hardcodes the same name — keep them in sync.

The connection is cached on `global` so it survives hot reloads and lambda reuse. A failed
connect clears the cached promise so the process can recover once Mongo is healthy.

## Known limitations

- **Rate limiting is in-memory**, so it is per-instance. On multi-instance serverless it
  only throttles bursts landing on the same instance. Move to Redis before relying on it.
- **No email verification** — see the security note above.
- **No error monitoring.** Unhandled errors are `console.error`'d and nothing is notified.
- `/api/dashboard` loads all users and tasks then filters in memory. Fine at club scale;
  it will not hold up at thousands of documents.

## Commands

```bash
pnpm dev              # dev server
pnpm build            # production build (a real typecheck -- nothing is suppressed)
pnpm seed             # reset the local DB to fixtures. Refuses a non-local URI without SEED_CONFIRM=yes
pnpm migrate:content  # one-off: rename "Logistics Team" -> "Content Team" in existing data
pnpm test:e2e         # 75 API checks against a running server
```
