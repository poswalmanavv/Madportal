# Deploy Guide — MAD Club Management Portal

Deploy target: **Netlify** (config already in `netlify.toml`).

## Step 1 — Open MongoDB to the internet (MOST IMPORTANT)
Your database currently only allows your home computer. Netlify's servers have
changing IPs, so you must allow access from anywhere.

1. Go to https://cloud.mongodb.com → your project → **Network Access**.
2. Click **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`) → Confirm.

> Without this, the live site cannot reach the database and login will fail.

## Step 2 — Put the code on GitHub
1. Go to https://github.com/new and create an EMPTY repo (no README), e.g.
   `mad-club-portal`. Copy its URL.
2. In a terminal **inside this project folder**, run (replace the URL):

   ```bash
   git remote add origin https://github.com/YOUR_USERNAME/mad-club-portal.git
   git push -u origin main
   ```

## Step 3 — Connect Netlify
1. Go to https://app.netlify.com → **Add new site** → **Import an existing project**.
2. Pick **GitHub** and select the repo you just pushed.
3. Build settings are auto-detected from `netlify.toml`. Leave them as-is.
4. Before the first deploy, open **Environment variables** and add these 3
   (copy the values from your local `.env.local`):

   | Key | Value |
   |-----|-------|
   | `MONGODB_URI` | your full mongodb+srv connection string |
   | `NEXTAUTH_SECRET` | the long random string from `.env.local` |
   | `AUTHORIZED_SECRETARIES` | the comma-separated secretary emails |

5. Click **Deploy**.

## Step 4 — After the first deploy
1. Netlify gives you a URL like `https://your-site-name.netlify.app`.
2. (Optional but recommended) Add one more environment variable:
   `NEXTAUTH_URL` = that full URL, then **redeploy** (Deploys → Trigger deploy).

## Step 5 — Log in
Use a secretary email from `AUTHORIZED_SECRETARIES` with password `Password@123`
(seed default), then immediately use **Change Password** in the dashboard.

---

### Notes
- Do NOT commit `.env.local` — it is already git-ignored.
- The seed endpoint is disabled in production by design; your existing data in the
  Atlas cluster is already there.
- If login fails on the live site, it is almost always Step 1 (MongoDB Network Access).