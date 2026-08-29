# Frontend

Everything the user sees: pages, components, styling, and the client-side data flow.

## Where the code lives

```
src/frontend/
  components/
    DashboardClient.tsx           Owns dashboard state/nav; renders one view at a time
    AuthForm.tsx                  Shared login form (member + admin portals)
    Logo.tsx / PasswordInput.tsx / SiteFooter.tsx
    providers/AppProviders.tsx    Dark-mode toggle
    dashboard/
      ui.tsx                      Shared primitives: card, StatusPill, Avatar, PageHeader, formatDate...
      Sidebar.tsx                 Nav + ViewKey union (the dashboard's routing, client-side only)
      OverviewView.tsx            Metrics row + charts (recharts)
      TasksView.tsx                Task table with an inline quick-update row editor
      TaskDetail.tsx               Full task page: comments, @mentions, file attachments, activity timeline
      PipelineView.tsx             Generic table (search/filter/inline status editor) shared by
                                    EP, Sponsorship, Design, Hospitality, Content
      PipelineDetail.tsx           Full detail page for EP/Sponsorship/Hospitality/Content
                                    (NOT Design -- see "Pipelines" below)
      CreateView.tsx               Generic <Form>; one panel per creatable thing
      MembersView.tsx              Team performance table, scoped by canViewMember
      MentionsView.tsx / NotificationsView.tsx / UserMenu.tsx
      MemberPicker.tsx             Searchable multi/single-select used by task assign + design

src/app/                         Routing only -- Next.js resolves pages from the filesystem
  page.tsx                       Landing page
  register/page.tsx              Registration (incl. the 4th-year team head card)
  login/member/page.tsx          Member portal
  login/admin/page.tsx           Admin portal (secretaries)
  dashboard/page.tsx             Server component: loads data, renders <DashboardClient>
  account/password/page.tsx      Change password
  layout.tsx                     Root layout + metadata
  error.tsx / global-error.tsx / not-found.tsx / loading.tsx
  globals.css                    Tailwind entry
  icon.svg                       Favicon

src/shared/constants.ts          Enums shared with the backend
```

**Why pages are not in `src/frontend/`.** Next.js maps URLs to files: `/register` is served
by `src/app/register/page.tsx` and nowhere else. Those files cannot move. Anything that is
not a route — components, providers, shared logic — lives in `src/frontend/`.

Import with the `@frontend/*` and `@shared/*` aliases.

## Data flow

There is no client-side data library. The pattern is:

1. **`dashboard/page.tsx` is a server component.** It calls `auth()`, then `buildDashboard()`
   (`src/backend/dashboard.ts`) -- the same builder `GET /api/dashboard` calls -- and passes
   the result to the client component as `initialData`. The first paint needs no client
   fetch. `buildDashboard` is what applies `canViewMember` scoping.
2. **`DashboardClient` holds that in `useState`.** After any mutation it calls `refresh()`,
   which re-fetches `GET /api/dashboard` and replaces the whole object.
3. **Mutations are plain `fetch` calls** to the API, then `refresh()`.

So `/api/dashboard` returns exactly the same shape the server component builds. If you add a
field to one, add it to the other — they are two paths to the same payload.

**Detail pages are the one exception.** `TaskDetail` and `PipelineDetail` are handed a row
from the dashboard list to render immediately, but also do their own `GET` (task/entry +
comments or history) on mount, since that detail is not part of the dashboard aggregate.
After a mutation they refetch that `GET` *and* call the dashboard's `refresh()`, so the list
view behind them stays in sync too.

## Styling

Tailwind, with a small theme in `tailwind.config.ts` (`brand` teal, `ink`, `coral`, `gold`,
a `shadow-soft`). Two conventions repeated throughout `DashboardClient`:

```ts
const inputClass = "rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm dark:...";
const cardClass  = "rounded-lg border border-neutral-200 bg-white p-4 shadow-soft dark:...";
```

Dark mode is class-based (`darkMode: "class"`). `AppProviders` toggles `.dark` on
`<html>` via a floating button. It does **not** persist the choice or honour
`prefers-color-scheme` — it resets to light on reload. Worth fixing.

Layouts are responsive via Tailwind breakpoints; wide tables are wrapped in
`overflow-x-auto`.

## The dashboard

| Section | Notes |
|---|---|
| Metrics row | Active members, tasks, completed, EP entries, sponsorships |
| Charts (recharts) | Monthly contributions (area), year-wise performance (bar) |
| Performance table | Per-member stats. **Scoped:** a team head sees only their own team; only a secretary sees the whole club. |
| Task workflow | Every task the viewer can see, with an inline **Update** control (status, progress, comment) in the table for assignees and leaders, or click the title to open `TaskDetail` — the full page, with a comment thread (`@mentions`, file attachments) and the activity timeline |
| Pipelines | EP, Sponsorship, Design Requests, Hospitality, Content — a shared `PipelineView` table, each row expandable into an inline status editor. For EP/Sponsorship/Hospitality/Content, the row's title is also clickable and opens `PipelineDetail` — a full page mirroring `TaskDetail`'s layout (header card, Activity timeline from that entry's own history, Update panel, and a **Created By** card instead of Assignees, since each entry has one creator). Design Requests does **not** get a detail page — no `createdBy`, no history table, an assignee + approval flow instead — so it stays on the inline editor only. |
| Create panel | Tabs: task / EP / sponsor / hospitality / content / design — a generic `<Form>` posting to the matching endpoint. Visible to every member; the Task tab only renders for a leader and the Design tab only for the design head/secretary, since only those two require it server-side. EP/Sponsorship/Hospitality/Content creation has never been leader-gated — any member (2nd year and up) can log one. |
| Notification bell | Unread badge, dropdown, "mark all read". Polls every 60s. |

## Registration: the 4th-year team head card

`register/page.tsx` tracks the selected `year` in state. When it is `4th Year` a highlighted,
**required** Team Head Role card appears; for every other year the card is not rendered and
the field is not sent at all.

This is presentation, not a security control — the server enforces the same rule
independently (a 4th year without a role is rejected; a junior year *with* one is rejected).
Never rely on a hidden field to protect anything.

Note that a 4th year's selection grants real team-lead access the moment the account is
created. See the security note in [BACKEND.md](./BACKEND.md).

## Permission checks in the UI

`DashboardClient` computes `canManage` and `canDesign` to decide which controls to render.
These **mirror** `isLeader()` / `canManageDesign()` on the server and exist only to avoid
showing a button that would 403. They are not security. If you change a rule in
`src/backend/rbac.ts`, change the mirror too, or the UI will offer actions the API refuses.

## Error and loading states

`error.tsx` (page-level), `global-error.tsx` (catches failures in the root layout itself),
`not-found.tsx`, and `loading.tsx` are all present at the `src/app` root and apply to every
route beneath them.

## Conventions

- Client components need `"use client"` — anything with `useState`/`useEffect` or a handler.
- Never import from `@backend/*` in a client component. Models and the DB connection are
  server-only; pulling them into the browser bundle will fail the build.
- Take enums (`DEPARTMENTS`, `TASK_STATUSES`, …) from `@shared/constants` rather than
  retyping the strings, so the dropdowns and the Zod schemas cannot drift apart.
