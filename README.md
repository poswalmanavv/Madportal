# MAD Club Management Portal

Full-stack operations portal for the Managing and Directing Club, NIT Kurukshetra —
tasks, event partnerships, sponsorships, hospitality, content, design requests, team
performance and reports.

Live: **https://maddashboard.netlify.app**

## ✨ Features

- **Registration** with `@nitkkr.ac.in` email validation (2nd–4th year)
- **Role-based access** — Member, Team Head, Secretary
- **Task management** — create, assign (searchable picker), track progress, with a full
  detail page (comments, `@mentions`, file attachments, activity timeline)
- **Event Partnership (EP), Sponsorship, Hospitality and Content pipelines** — each with a
  status trail and its own detail page (history timeline, "Created By", quick status update).
  Any member (2nd year and up) can log a new entry in these four; only a team lead can move
  one that isn't theirs
- **Design request workflow** with designer/head separation of duties
- **Team performance** dashboards and charts, scoped by team
- **Notifications** — in-app bell for assignments, mentions and status changes
- **CSV / Excel export** for secretaries
- **Responsive**, with a persisted light / dark / system theme

## 📁 Project Structure

```
src/
  backend/    Server only: db, schema, auth, rbac, validators, queries, http helpers
  frontend/   Client only: components and providers
  shared/     Enums used by both (years, departments, statuses)
  app/        Routing only — Next.js resolves pages and API routes from here
drizzle/      Generated SQL migrations (committed; do not hand-edit)
docs/         BACKEND.md and FRONTEND.md
```

Route files (`src/app/**/page.tsx`, `route.ts`) cannot move — Next.js maps URLs to
filesystem paths. They stay thin and delegate into `src/backend`.

Import via the aliases — `@backend/*`, `@frontend/*`, `@shared/*` — not relative paths.

- **[docs/BACKEND.md](docs/BACKEND.md)** — API reference, authorization model, sessions, database
- **[docs/FRONTEND.md](docs/FRONTEND.md)** — pages, components, data flow, styling

## 🧱 Tech Stack

- **Framework**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: Tailwind CSS
- **Database**: SQLite via **libSQL** — a local file in development, **Turso** in production
- **ORM**: Drizzle
- **Auth**: NextAuth (Auth.js) v5, JWT sessions
- **Validation**: Zod
- **Passwords**: bcryptjs (cost 12)
- **Hosting**: Netlify (`@netlify/plugin-nextjs`)

> **Why SQLite on serverless?** A plain `.db` file cannot persist on Netlify (read-only
> filesystem, throwaway containers). Turso serves the same SQLite over HTTP, so it
> persists. Local dev uses a real file; the schema and queries are identical either way.

## 🚀 Quick Start (local)

Prerequisites: Node.js 20+, pnpm.

```bash
pnpm install
cp .env.example .env.local     # then fill in the values (see below)
pnpm db:migrate                # create the SQLite tables in data/mad-club.db
pnpm dev                       # http://localhost:3000
```

Optional — load throwaway fixtures for development:

```bash
pnpm seed
```

## 📝 Environment Variables

Set in `.env.local` (see `.env.example`). Save the file as **UTF-8 without a BOM**.

```
# Local: a real SQLite file.  Production: a Turso libsql:// URL.
DATABASE_URL=file:./data/mad-club.db
DATABASE_AUTH_TOKEN=            # required only for a Turso libsql:// URL

# Same value for both. Generate: openssl rand -base64 32
AUTH_SECRET=...
NEXTAUTH_SECRET=...

# The real origin in production, no trailing slash.
NEXTAUTH_URL=http://localhost:3000

# Comma-separated. These emails, and only these, are granted the secretary role.
AUTHORIZED_SECRETARIES=123105128@nitkkr.ac.in,...
```

The production Turso credentials live in `.env.turso` (gitignored), read only by
`pnpm db:migrate:turso`. Keep them out of `.env.local` — the seed, purge and test scripts
all refuse to run against a non-local database, but `.env.local` is the safe default.

## 🚀 First run on a clean database

There are **no default accounts and no default passwords.** Nobody is pre-created.

1. Put the secretaries' emails in `AUTHORIZED_SECRETARIES`.
2. Each secretary registers at `/register` with that email and a password they choose —
   the secretary role is granted automatically from the allowlist.
3. Everyone else registers normally as a member.

`pnpm purge:demo` strips any leftover seeded profile (and any account still using the seed
default password) from a database. Run it dry first (no flag) to preview; add `--confirm`
to apply.

## 🔑 How privileges are granted

| Level | Granted by |
|---|---|
| **Secretary** — full access, all teams, member management, CSV export | The `AUTHORIZED_SECRETARIES` allowlist. Never self-assignable. |
| **Team head** — create/assign tasks, move pipelines, see **their own team's** performance | A 4th year chooses their `teamHeadRole` at registration, and it takes effect immediately. A secretary can also grant `canManageTeam`. |
| **Member** — own tasks and own records | Default. |

Privileges are never derived from `year` on its own — `isLeader()` in
[src/backend/rbac.ts](src/backend/rbac.ts) keys off `role`, `teamHeadRole` and
`canManageTeam`.

> **Security note.** A 4th year's self-declared `teamHeadRole` takes effect on signup, and
> the `@nitkkr.ac.in` check is only a string-suffix test — nobody proves they own the
> address. So **anyone who registers with such an address can obtain team-lead access.**
> Email verification is the control that closes this and is not yet implemented.

## ✅ Tests

```bash
pnpm dev          # terminal 1 (leave running)
pnpm seed         # reset the local DB to known fixtures
pnpm test:e2e     # terminal 2 — 90+ end-to-end API checks
```

`scripts/e2e-test.ts` signs in through the real NextAuth flow and asserts access control,
role rules, session revocation, rate limiting and every write path. It refuses to run
against a non-local `DATABASE_URL`, since it creates and deletes rows.

## 🛠️ Scripts

```bash
pnpm dev               # dev server
pnpm build             # production build (a real typecheck — nothing suppressed)
pnpm start             # start the production build
pnpm lint              # ESLint

pnpm db:generate       # regenerate SQL migrations after editing src/backend/schema.ts
pnpm db:migrate        # apply migrations to DATABASE_URL (local)
pnpm db:migrate:turso  # apply migrations to the live Turso DB (reads .env.turso)

pnpm seed              # reset local DB to fixtures (refuses a non-local DB)
pnpm purge:demo        # remove seeded fixtures + seed-default-password accounts
pnpm test:e2e          # end-to-end API suite
pnpm logo:build        # regenerate logo/icon assets from assets/
```

## 🗄️ Database

SQLite via libSQL/Drizzle. Schema is `src/backend/schema.ts`; migrations live in `drizzle/`
and are committed. Tables:

`users`, `user_departments`, `departments`, `tasks`, `task_assignees`, `task_timeline`,
`task_comments`, `comment_mentions`, `comment_attachments`,
`ep_entries`, `ep_history`, `sponsorship_entries`, `sponsorship_history`,
`hospitality_entries`, `hospitality_history`, `content_entries`, `content_history`,
`design_requests`, `notifications`, `performance_logs`.

Changing the schema is `pnpm db:generate` then `pnpm db:migrate` (and
`pnpm db:migrate:turso` before deploying). **Netlify does not run migrations** — a new
table will not exist in production until you run it.

## 🚢 Deployment (Netlify + Turso)

1. Create a Turso database (ideally in a region near your users) and a token.
2. `pnpm db:migrate:turso` once, to create the tables in it.
3. In Netlify, set `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `AUTH_SECRET`,
   `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (your live origin, no trailing slash), and
   `AUTHORIZED_SECRETARIES`.
4. Trigger a deploy with **Clear cache and deploy site** — env changes don't apply
   without a rebuild.
5. Check `/api/health` → `{"status":"ok","database":"connected"}`, then register your
   secretary account at `/register`.

Every push to `main` auto-deploys. `/api/health` also reports `dbLatencyMs` and
`functionRegion` — if latency is high, the database is in a different region from the
functions.

## 🐛 Troubleshooting

- **`/api/health` says `degraded`** — the app can't reach the database. Check
  `DATABASE_URL` / `DATABASE_AUTH_TOKEN` in Netlify and that you redeployed.
- **Login loops back to the sign-in page in production** — `NEXTAUTH_URL` must be the real
  HTTPS origin with no trailing slash.
- **"Invalid credentials or unauthorized portal access"** — check the exact `@nitkkr.ac.in`
  email; for the admin portal the email must be in `AUTHORIZED_SECRETARIES`.
- **The site feels slow** — `/api/health` reports the DB round-trip latency and region.

## 📞 Support

- **Primary**: 123105128@nitkkr.ac.in

## 📄 License

For the Managing and Directing Club, NIT Kurukshetra.

---

**Status**: 🟢 Deployed. Known pre-launch gaps: email verification for `@nitkkr.ac.in`
signups, a shared (Redis) rate-limit store, error monitoring, and moving the Turso database
to a region near the functions.
**Version**: 1.0.0
