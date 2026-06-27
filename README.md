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

## 🧪 Test Accounts

All passwords: **`Password@123`**

| Email | Role | Department |
|-------|------|-----------|
| Any email listed in `AUTHORIZED_SECRETARIES` | Secretary | All |
| diya@nitkkr.ac.in | EP Head | EP Team |
| kabir@nitkkr.ac.in | Design Head | Design Team |
| meera@nitkkr.ac.in | Member | Sponsorship |
| rohan@nitkkr.ac.in | Member | Media |
| isha@nitkkr.ac.in | Member | Logistics |

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

Required in `.env.local`:
```
MONGODB_URI=mongodb+srv://...
NEXTAUTH_SECRET=...
NEXTAUTH_URL=http://localhost:3000
AUTHORIZED_SECRETARIES=your-secretary-email-1@nitkkr.ac.in,your-secretary-email-2@nitkkr.ac.in
```

Make sure the MongoDB URI points to the Atlas cluster that hosts this app and that the database name stays `mad-club`, because both the app and the seed script connect to that same database.

## 📄 License

This project is for the Managing and Directing Club, NIT Kurukshetra.

---

**Status**: ✅ Production Ready  
**Last Updated**: June 25, 2026  
**Version**: 1.0.0

