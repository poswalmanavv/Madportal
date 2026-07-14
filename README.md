# MAD Club Management Portal

Production-ready full-stack portal for the Managing and Directing Club, NIT Kurukshetra.

## ✨ Features

- **User Registration** with @nitkkr.ac.in email validation
- **Save Login Info** - Remember Me functionality with 30-day session timeout
- **Role-Based Access Control** - Member, Team Head, Secretary roles
- **Task Management** - Create, assign, and track task progress
- **Event Partnership (EP) Tracking** - Manage external partnerships
- **Sponsorship Pipeline** - Track sponsor outreach and status
- **Design Request Workflow** - Manage design team deliverables
- **Analytics & Dashboards** - View performance metrics and reports
- **CSV Export** - Download data for analysis
- **Responsive Design** - Works on desktop, tablet, and mobile
- **Dark Mode** - Built-in theme toggle

## 📁 Project Structure

```
src/
  backend/    Server only: models, db, auth, rbac, validators, http helpers
  frontend/   Client only: components and providers
  shared/     Enums used by both (years, departments, statuses)
  app/        Routing only -- Next.js resolves pages and API routes from here
```

Route files (`src/app/**/page.tsx`, `route.ts`) cannot move: Next.js maps URLs to
filesystem paths. They are kept thin and delegate into `src/backend`.

Import via the aliases — `@backend/*`, `@frontend/*`, `@shared/*` — not relative paths.

- **[docs/BACKEND.md](docs/BACKEND.md)** — API reference, authorization model, sessions, database
- **[docs/FRONTEND.md](docs/FRONTEND.md)** — pages, components, data flow, styling

## Tech Stack

- **Frontend**: React 19, Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **Database**: MongoDB Atlas with Mongoose
- **Authentication**: NextAuth.js 5 with JWT
- **Validation**: Zod schema validation
- **Security**: bcryptjs for password hashing

## Quick Start

### Prerequisites
- Node.js 18+
- npm or pnpm
- MongoDB URI (.env.local configured)

### Setup

1. **Install dependencies:**
```bash
pnpm install
# OR
npm install
```

2. **Start development server:**
```bash
pnpm dev
# OR
npm run dev
```

The application runs on: **http://localhost:3000**

### First Time Setup

1. **Seed test data (optional):**
```bash
pnpm seed
# OR
npm run seed
```

2. **Register a new account:**
   - Go to http://localhost:3000/register
   - Use your @nitkkr.ac.in email
   - Select your department and year
   - Create account

3. **Login:**
   - Member Portal: http://localhost:3000/login/member
   - Admin Portal: http://localhost:3000/login/admin (secretaries only)

## 🎯 New: Save Login Info Feature

The portal now includes a **"Save login info"** checkbox that:
- ✓ Auto-fills your email and year on next login
- ✓ Keeps you signed in for 30 days
- ✓ Never stores passwords (only email & year)
- ✓ Device-specific storage (secure)
- ✓ Easy to clear when unchecked

**How to use:**
1. On login page, check **"Save login info"**
2. Next time, your email and year will be pre-filled
3. Just enter your password for quick re-login

## 📝 User Workflows

### Creating an Account
1. Click **"Register"** from homepage
2. Fill form with @nitkkr.ac.in email
3. Select department and year
4. Create account and login

### Managing Tasks (Secretaries/Team Heads)
1. Go to Dashboard → Tasks
2. Click **"Create Task"**
3. Assign to team members
4. Set priority and deadline
5. Track progress with status updates

### Admin Features (Secretaries Only)
- View all members and their stats
- Create and manage tasks
- Track sponsorships and EP entries
- View team analytics
- Export data to CSV

## 🔐 Security

- ✅ Email validation for @nitkkr.ac.in domain only
- ✅ Passwords hashed with bcryptjs (cost: 12)
- ✅ JWT tokens with 30-day expiration
- ✅ Role-based access control
- ✅ Secretary authorization via AUTHORIZED_SECRETARIES env var
- ✅ Session protection with middleware

## 🚀 First run on a clean database

There are **no default accounts and no default passwords.** Nobody is pre-created.

1. Put the secretaries' emails in `AUTHORIZED_SECRETARIES`.
2. Each secretary registers at `/register` with that email and a password they choose.
   The secretary role is granted automatically from the allowlist.
3. Everyone else registers normally as a member.

`pnpm purge:demo` strips any leftover seeded profile, and any account still using the seed
default password, from an existing database. Run it dry first (no flag) to see what it
would remove; add `--confirm` to apply.

## 🧪 Test fixtures (LOCAL DEVELOPMENT ONLY)

`pnpm seed` creates throwaway fixture accounts (diya, kabir, meera, rohan, isha) with the
password `Password@123`, for local development and the end-to-end suite. It **deletes every
document** first, and refuses a non-local `MONGODB_URI` unless you pass `SEED_CONFIRM=yes`.

Never run it against production. If you seed a database you intend to use for real, run
`pnpm purge:demo --confirm` afterwards to remove the fixtures again.

## 🔑 How privileges are granted

| Level | Granted by |
|---|---|
| **Secretary** — full access, all teams, member management, CSV export | The `AUTHORIZED_SECRETARIES` allowlist. Never self-assignable. |
| **Team head** — create/assign tasks, move pipelines, see **their own team's** performance | A 4th year chooses their `teamHeadRole` at registration, and it takes effect immediately. A secretary can also grant `canManageTeam`. |
| **Member** — own tasks and own records | Default. |

Privileges are never derived from `year` on its own — `isLeader()` in
[src/backend/rbac.ts](src/backend/rbac.ts) keys off `role`, `teamHeadRole` and
`canManageTeam`.

> **Security note.** Because a 4th year's self-declared `teamHeadRole` takes effect on
> signup, and the `@nitkkr.ac.in` check is only a string-suffix test (nobody proves they own
> the address), **anyone who registers with such an address can obtain team-lead access.**
> Email verification is the control that closes this and is not yet implemented.

## ✅ Tests

```bash
pnpm dev        # terminal 1
pnpm seed       # reset to known fixtures
pnpm test:e2e   # terminal 2 -- 35 end-to-end API checks
```

`scripts/e2e-test.ts` signs in through the real NextAuth flow and asserts access control,
rate limiting, session revocation, and the task/EP write paths. It writes to the database
in `MONGODB_URI`, so point it at a local Mongo.

## 📱 Browser Support

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🚀 Production Deployment

### Build
```bash
pnpm build
# OR
npm run build
```

### Start Production Server
```bash
pnpm start
# OR
npm start
```

## 📖 Documentation

- **User Guide**: `COMPLETE_USER_GUIDE.md`
- **Implementation Summary**: `IMPLEMENTATION_SUMMARY.md`
- **Project Verification**: `PROJECT_VERIFICATION_REPORT.md`
- **Startup Guide**: `STARTUP_GUIDE.md`

(Documentation files are in the session folder: `C:/Users/mindp/.copilot/session-state/...`)

## 🛠️ Scripts

```bash
# Development
pnpm dev              # Start dev server
pnpm build            # Build for production
pnpm start            # Start production server
pnpm seed             # Seed database with test data
pnpm lint             # Run ESLint

# Windows Startup Scripts
.\start-dev.bat       # Windows batch script
.\start-dev.ps1       # PowerShell script
```

## 📊 Database Models

- **User**: Member profiles, roles, departments
- **Task**: Task assignments with timeline tracking
- **EPEntry**: Event partnership records
- **SponsorshipEntry**: Sponsor management
- **DesignRequest**: Design workflow management
- **Department**: Team organization
- **Notification**: User notifications
- **PerformanceLog**: Activity tracking

## 🐛 Troubleshooting

**"Invalid credentials or unauthorized portal access"**
- Verify email is exactly correct (case-insensitive)
- Check @nitkkr.ac.in domain
- For admin portal: ensure email is in AUTHORIZED_SECRETARIES

**"Email already registered"**
- Account exists with this email
- Try logging in instead

**"Use a @nitkkr.ac.in email"**
- Only NIT Kurukshetra emails allowed
- Contact secretary if you need help

**Save login info not working**
- Check browser allows local storage
- Some private/incognito modes don't support local storage
- Try a different browser if needed

## 📞 Support

For issues or questions, contact:
- **Primary**: secretary@nitkkr.ac.in
- **Backup**: gsec@nitkkr.ac.in

## 📝 Environment Variables

Copy `.env.example` to `.env.local` and fill it in:
```
MONGODB_URI=mongodb+srv://...
AUTH_SECRET=...          # NextAuth v5 name
NEXTAUTH_SECRET=...      # same value as AUTH_SECRET
NEXTAUTH_URL=http://localhost:3000   # must be the real origin in production
AUTHORIZED_SECRETARIES=your-secretary-email-1@nitkkr.ac.in,your-secretary-email-2@nitkkr.ac.in
```

Save `.env.local` as UTF-8 **without a BOM** — `node --env-file` misparses a leading BOM
and silently drops the first variable.

Make sure the MongoDB URI points to the Atlas cluster that hosts this app and that the database name stays `mad-club`, because both the app and the seed script connect to that same database.

## 📄 License

This project is for the Managing and Directing Club, NIT Kurukshetra.

---

**Status**: 🟡 Pre-launch — security hardening done and covered by end-to-end tests.
Before going live you still need: email verification for @nitkkr.ac.in signups, a shared
(Redis) rate-limit store, and error monitoring. See the launch checklist.  
**Version**: 1.0.0

