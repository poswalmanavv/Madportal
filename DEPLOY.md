# Deploy Guide — MAD Club Management Portal

Deploy target: **Netlify** (config already in `netlify.toml`). Database: **Turso**
(SQLite over HTTP) via Drizzle — see `docs/BACKEND.md` for why a plain SQLite file cannot
be used on Netlify (read-only filesystem, throwaway containers per request).

## Step 1 — Create a Turso database

1. Install the Turso CLI and sign in: https://docs.turso.tech/quickstart
2. Create a database, ideally in a region close to where Netlify will run your functions:
   ```bash
   turso db create mad-club
   ```
3. Get the connection URL and a token:
   ```bash
   turso db show mad-club --url
   turso db tokens create mad-club
   ```
4. Put both in a local `.env.turso` file (gitignored, never commit it):
   ```
   DATABASE_URL=libsql://mad-club-<your-org>.turso.io
   DATABASE_AUTH_TOKEN=<the token>
   ```
5. Create the tables in it:
   ```bash
   pnpm db:migrate:turso
   ```
   This is idempotent — safe to re-run after every schema change, before every deploy.

## Step 2 — Put the code on GitHub

1. Go to https://github.com/new and create an EMPTY repo (no README).
2. In a terminal **inside this project folder**, run (replace the URL):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/your-repo.git
   git push -u origin main
   ```

## Step 3 — Connect Netlify

1. Go to https://app.netlify.com → **Add new site** → **Import an existing project**.
2. Pick **GitHub** and select the repo you just pushed.
3. Build settings are auto-detected from `netlify.toml`. Leave them as-is.
4. Before the first deploy, open **Environment variables** and add:

   | Key | Value |
   |-----|-------|
   | `DATABASE_URL` | the `libsql://...` URL from Step 1 |
   | `DATABASE_AUTH_TOKEN` | the token from Step 1 |
   | `AUTH_SECRET` | a random string — `openssl rand -base64 32` |
   | `NEXTAUTH_SECRET` | the **same** value as `AUTH_SECRET` |
   | `AUTHORIZED_SECRETARIES` | comma-separated secretary emails, e.g. `123105128@nitkkr.ac.in,...` |

5. Click **Deploy**.

## Step 4 — After the first deploy

1. Netlify gives you a URL like `https://your-site-name.netlify.app`.
2. Add one more environment variable: `NEXTAUTH_URL` = that full URL, **no trailing
   slash**, then redeploy (Deploys → **Trigger deploy** → **Clear cache and deploy site**).
   Env var changes never take effect without a rebuild.
3. Check `https://your-site-name.netlify.app/api/health` → it should report
   `{"status":"ok","database":"connected", ...}`. If it says `"degraded"`, re-check
   `DATABASE_URL` / `DATABASE_AUTH_TOKEN` in Netlify and that you redeployed after setting them.

## Step 5 — Log in

There are **no default accounts.** Register your secretary account at `/register` using an
email from `AUTHORIZED_SECRETARIES` — the secretary role is granted automatically from the
allowlist, not chosen in the form. Everyone else registers normally as a member.

## After every deploy that changes `src/backend/schema.ts`

Netlify does **not** run migrations for you. A new or changed table will not exist in
production until you run, from your machine:

```bash
pnpm db:generate       # writes the migration from the schema diff (commit this)
pnpm db:migrate:turso  # applies it to the live database
```

Run this **before** merging/deploying code that depends on the new schema, or the live app
will 500 on the first request that touches the missing table.

---

### Notes

- Do NOT commit `.env.local` or `.env.turso` — both are git-ignored.
- The seed endpoint/script refuses to run against a non-local database unless
  `SEED_CONFIRM=yes` — don't pass that flag against Turso unless you mean to wipe it.
- Every push to `main` auto-deploys once Netlify is connected.
- `/api/health` also reports `dbLatencyMs` and `functionRegion` — if latency is high, the
  Turso database is in a different region from the Netlify functions; recreate it closer.
- If login fails only in production, it is almost always `NEXTAUTH_URL` being wrong (must be
  the exact live HTTPS origin, no trailing slash) or the two auth secrets not matching.
