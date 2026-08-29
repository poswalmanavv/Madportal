"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Bell, Menu, X } from "lucide-react";
import { CONTENT_STATUSES, DESIGN_STATUSES, EP_STATUSES, HOSPITALITY_STATUSES, SPONSORSHIP_STATUSES } from "@shared/constants";
import { CreateView } from "./dashboard/CreateView";
import { MembersView } from "./dashboard/MembersView";
import { NotificationsView } from "./dashboard/NotificationsView";
import { OverviewView } from "./dashboard/OverviewView";
import { PipelineDetail } from "./dashboard/PipelineDetail";
import { PipelineView, cell } from "./dashboard/PipelineView";
import { Sidebar, type ViewKey } from "./dashboard/Sidebar";
import { MentionsView } from "./dashboard/MentionsView";
import { TaskDetail } from "./dashboard/TaskDetail";
import { TasksView } from "./dashboard/TasksView";
import { UserMenu } from "./dashboard/UserMenu";
import { formatDate } from "./dashboard/ui";

// The four pipelines that share Sponsorship's shape: a single creator, a status, and their
// own history trail. Design Requests is deliberately excluded -- it has no creator field, no
// history table, and an assignee + approval flow instead, so it keeps its own inline editor.
type PipelineKind = "ep" | "sponsorships" | "hospitality" | "content";

function pipelineDetailProps(kind: PipelineKind, id: string) {
  switch (kind) {
    case "ep":
      return {
        endpoint: `/api/ep-entries/${id}`,
        statuses: EP_STATUSES,
        buildBody: (status: string, comment: string) => ({ currentStatus: status, detailedUpdate: comment }),
        titleOf: (row: any) => row.epName,
        statusOf: (row: any) => row.currentStatus,
        descriptionOf: (row: any) => row.discussionSummary,
        latestUpdateOf: (row: any) => row.detailedUpdate,
        detailFields: (row: any) => [
          { label: "Organization", value: row.organization || "—" },
          { label: "Contact Person", value: row.personContacted || "—" },
          { label: "Contact Number", value: row.contactNumber || "—" },
          { label: "Email", value: row.email || "—" },
          { label: "Date", value: formatDate(row.date) },
          ...(row.attachNotes ? [{ label: "Notes", value: row.attachNotes }] : [])
        ]
      };
    case "sponsorships":
      return {
        endpoint: `/api/sponsorships/${id}`,
        statuses: SPONSORSHIP_STATUSES,
        buildBody: (status: string, comment: string) => ({ currentStatus: status, detailedUpdate: comment }),
        titleOf: (row: any) => row.companyName,
        statusOf: (row: any) => row.currentStatus,
        descriptionOf: (row: any) => row.sponsorshipRequirement,
        latestUpdateOf: (row: any) => row.detailedUpdate,
        detailFields: (row: any) => [
          { label: "Industry", value: row.industry || "—" },
          { label: "Website", value: row.companyWebsite || "—" },
          { label: "Contact Person", value: row.contactPersonName || "—" },
          { label: "Designation", value: row.designation || "—" },
          { label: "Contact Number", value: row.contactNumber || "—" },
          { label: "Email", value: row.email || "—" },
          { label: "Contacted", value: formatDate(row.dateContacted) },
          { label: "Follow-up", value: formatDate(row.followUpDate) }
        ]
      };
    case "hospitality":
      return {
        endpoint: `/api/hospitality/${id}`,
        statuses: HOSPITALITY_STATUSES,
        buildBody: (status: string, comment: string) => ({ currentStatus: status, detailedUpdate: comment }),
        titleOf: (row: any) => row.guestName,
        statusOf: (row: any) => row.currentStatus,
        descriptionOf: (row: any) => row.requirement,
        latestUpdateOf: (row: any) => row.detailedUpdate,
        detailFields: (row: any) => [
          { label: "Organization", value: row.organization || "—" },
          { label: "Contact Number", value: row.contactNumber || "—" },
          { label: "Email", value: row.email || "—" },
          { label: "Arrival", value: formatDate(row.arrivalDate) },
          { label: "Departure", value: formatDate(row.departureDate) }
        ]
      };
    case "content":
      return {
        endpoint: `/api/content/${id}`,
        statuses: CONTENT_STATUSES,
        buildBody: (status: string, comment: string) => ({ currentStatus: status, detailedUpdate: comment }),
        titleOf: (row: any) => row.contentTitle,
        statusOf: (row: any) => row.currentStatus,
        descriptionOf: (row: any) => row.description,
        latestUpdateOf: (row: any) => row.detailedUpdate,
        detailFields: (row: any) => [
          { label: "Type", value: row.contentType || "—" },
          { label: "Platform", value: row.platform || "—" },
          { label: "Deadline", value: formatDate(row.deadline) },
          ...(row.link ? [{ label: "Link", value: row.link }] : [])
        ]
      };
  }
}

const PIPELINE_BACK_VIEW: Record<PipelineKind, ViewKey> = {
  ep: "ep",
  sponsorships: "sponsorships",
  hospitality: "hospitality",
  content: "content"
};

type DashboardData = {
  current: {
    id: string;
    name: string;
    email: string;
    year: string;
    role: "member" | "secretary";
    teamHeadRole: string;
    canManageTeam?: boolean;
  };
  stats: Record<string, number>;
  memberStats: Array<Record<string, any>>;
  tasks: Array<Record<string, any>>;
  epEntries: Array<Record<string, any>>;
  sponsorships: Array<Record<string, any>>;
  designRequests: Array<Record<string, any>>;
  hospitalityEntries: Array<Record<string, any>>;
  contentEntries: Array<Record<string, any>>;
  mentionCount?: number;
  charts: Record<string, any>;
};

export function DashboardClient({ initialData }: { initialData: DashboardData }) {
  const [data, setData] = useState(initialData);
  const [view, setView] = useState<ViewKey>("overview");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedPipeline, setSelectedPipeline] = useState<{ kind: PipelineKind; id: string } | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const [notifications, setNotifications] = useState<Array<Record<string, any>>>([]);
  const [unread, setUnread] = useState(0);

  // These MIRROR isLeader() / canManageDesign() in src/backend/rbac.ts. They decide which
  // controls are rendered -- nothing more. The server re-checks the role on every request,
  // so a mistake here can only show a button that 403s; it cannot grant access.
  const isSecretary = data.current.role === "secretary";
  const canManage =
    isSecretary ||
    Boolean(data.current.canManageTeam) ||
    (Boolean(data.current.teamHeadRole) && data.current.teamHeadRole !== "None");
  const canDesign = isSecretary || data.current.teamHeadRole === "Design Team Head";

  const refresh = useCallback(async () => {
    const response = await fetch("/api/dashboard");
    if (response.ok) setData(await response.json());
  }, []);

  const loadNotifications = useCallback(async () => {
    const response = await fetch("/api/notifications");
    if (!response.ok) return;
    const body = await response.json();
    setNotifications(body.notifications ?? []);
    setUnread(body.unreadCount ?? 0);
  }, []);

  useEffect(() => {
    loadNotifications();
    const timer = setInterval(loadNotifications, 60_000);
    return () => clearInterval(timer);
  }, [loadNotifications]);

  async function markAllRead() {
    await fetch("/api/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({})
    });
    await loadNotifications();
  }

  const allTasks = data.tasks;
  const currentUserId = data.current.id;

  const myTasks = useMemo(
    () =>
      allTasks.filter((task) =>
        (task.assignedTo ?? []).some((a: any) => String(a?._id ?? a?.id ?? a) === currentUserId)
      ),
    [allTasks, currentUserId]
  );

  const counts = {
    tasks: data.tasks.length,
    mine: myTasks.length,
    ep: data.epEntries.length,
    sponsorships: data.sponsorships.length,
    design: (data.designRequests ?? []).length,
    hospitality: (data.hospitalityEntries ?? []).length,
    content: (data.contentEntries ?? []).length,
    members: data.memberStats.length,
    // Unread @-mentions, counted server-side in buildDashboard().
    mentions: data.mentionCount ?? 0
  };

  // Opening a task from anywhere (a task row, a mention) shows the detail view.
  function openTask(taskId: string) {
    setSelectedTaskId(taskId);
    setView("task");
  }

  // Opening an EP/Sponsorship/Hospitality/Content entry from its table row.
  function openPipelineEntry(kind: PipelineKind, id: string) {
    setSelectedPipeline({ kind, id });
    setView("pipeline-entry");
  }

  const selectedTask = selectedTaskId
    ? allTasks.find((task) => String(task._id ?? task.id) === selectedTaskId)
    : undefined;

  return (
    <div className="min-h-screen bg-[#f6f7f9] dark:bg-neutral-950">
      <Sidebar
        view={view}
        setView={setView}
        unread={unread}
        counts={counts}
        open={sidebarOpen}
        onNavigate={() => setSidebarOpen(false)}
      />

      {/* Dim the page behind the drawer on small screens. */}
      {sidebarOpen && (
        <button
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
        />
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-neutral-200 bg-white/85 px-4 py-3 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/85 lg:px-8">
          <button
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
            className="rounded-lg border border-neutral-300 p-2 dark:border-neutral-700 lg:hidden"
          >
            {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
          </button>

          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{data.current.name}</p>
            <p className="truncate text-xs text-neutral-500">
              {data.current.year}
              {data.current.teamHeadRole && data.current.teamHeadRole !== "None"
                ? ` · ${data.current.teamHeadRole}`
                : ""}
              {isSecretary ? " · Secretary" : ""}
            </p>
          </div>

          <button
            onClick={() => setView("notifications")}
            aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
            className="relative rounded-lg border border-neutral-300 p-2 transition hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
          >
            <Bell size={16} />
            {unread > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand px-1 text-[10px] font-bold text-white">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </button>

          <UserMenu
            name={data.current.name}
            email={data.current.email}
            subtitle={`${data.current.year}${
              data.current.teamHeadRole && data.current.teamHeadRole !== "None"
                ? ` · ${data.current.teamHeadRole}`
                : ""
            }${isSecretary ? " · Secretary" : ""}`}
          />
        </header>

        <main className="px-4 py-6 lg:px-8">
          {view === "overview" && <OverviewView data={data} />}

          {view === "task" &&
            (selectedTask ? (
              <TaskDetail
                task={selectedTask}
                members={data.memberStats}
                currentUserId={data.current.id}
                canManage={canManage}
                canDelete={isSecretary}
                onBack={() => setView("tasks")}
                refresh={refresh}
              />
            ) : (
              // The task was deleted, or is no longer visible to this member.
              <p className="text-sm text-neutral-500">
                That task is no longer available.{" "}
                <button onClick={() => setView("tasks")} className="font-semibold text-brand">
                  Back to tasks
                </button>
              </p>
            ))}

          {view === "pipeline-entry" && selectedPipeline && (
            <PipelineDetail
              id={selectedPipeline.id}
              currentUserId={data.current.id}
              canManage={canManage}
              onBack={() => setView(PIPELINE_BACK_VIEW[selectedPipeline.kind])}
              refresh={refresh}
              {...pipelineDetailProps(selectedPipeline.kind, selectedPipeline.id)}
            />
          )}

          {view === "mentions" && <MentionsView onOpenTask={openTask} refresh={refresh} />}

          {view === "tasks" && (
            <TasksView
              title="All Tasks"
              subtitle="Every task you can see"
              tasks={data.tasks}
              currentUserId={data.current.id}
              canManage={canManage}
              canDelete={isSecretary}
              onOpen={openTask}
              refresh={refresh}
            />
          )}

          {view === "mine" && (
            <TasksView
              title="Assigned to Me"
              subtitle="Tasks where you are an assignee"
              tasks={myTasks}
              currentUserId={data.current.id}
              canManage={canManage}
              canDelete={isSecretary}
              onOpen={openTask}
              refresh={refresh}
            />
          )}

          {view === "ep" && (
            <PipelineView
              title="EP Pipeline"
              subtitle="Event partnerships and outreach"
              rows={data.epEntries}
              statuses={EP_STATUSES}
              searchOf={(row) => `${row.epName} ${row.organization ?? ""}`}
              titleOf={(row) => row.epName}
              statusOf={(row) => row.currentStatus}
              endpoint={(id) => `/api/ep-entries/${id}`}
              buildBody={(status, comment) => ({ currentStatus: status, detailedUpdate: comment })}
              refresh={refresh}
              columns={[
                {
                  header: "Partnership",
                  render: (row) =>
                    cell.ref(String(row._id ?? row.id), row.epName, row.organization, () =>
                      openPipelineEntry("ep", String(row._id ?? row.id))
                    )
                },
                { header: "Contact", render: (row) => cell.person(row.personContacted) },
                { header: "Status", render: (row) => cell.status(row.currentStatus) },
                { header: "Date", render: (row) => cell.date(row.date) }
              ]}
            />
          )}

          {view === "sponsorships" && (
            <PipelineView
              title="Sponsorships"
              subtitle="Sponsor outreach and negotiation"
              rows={data.sponsorships}
              statuses={SPONSORSHIP_STATUSES}
              searchOf={(row) => `${row.companyName} ${row.industry ?? ""}`}
              titleOf={(row) => row.companyName}
              statusOf={(row) => row.currentStatus}
              endpoint={(id) => `/api/sponsorships/${id}`}
              buildBody={(status, comment) => ({ currentStatus: status, detailedUpdate: comment })}
              refresh={refresh}
              columns={[
                {
                  header: "Company",
                  render: (row) =>
                    cell.ref(String(row._id ?? row.id), row.companyName, row.sponsorshipRequirement, () =>
                      openPipelineEntry("sponsorships", String(row._id ?? row.id))
                    )
                },
                { header: "Industry", render: (row) => (row.industry ? cell.tag(row.industry) : "—") },
                { header: "Contact", render: (row) => cell.person(row.contactPersonName) },
                { header: "Status", render: (row) => cell.status(row.currentStatus) },
                { header: "Contacted", render: (row) => cell.date(row.dateContacted) }
              ]}
            />
          )}

          {view === "design" && (
            <PipelineView
              title="Design Requests"
              subtitle="Creative work and approvals"
              rows={data.designRequests ?? []}
              statuses={DESIGN_STATUSES}
              searchOf={(row) => `${row.designTitle} ${row.requirement ?? ""}`}
              titleOf={(row) => row.designTitle}
              statusOf={(row) => row.status}
              endpoint={(id) => `/api/design-requests/${id}`}
              // The comment box doubles as the submission link for design work.
              buildBody={(status, comment) => ({
                status,
                finalSubmissionLink: /^https?:\/\//.test(comment) ? comment : undefined
              })}
              commentLabel="Submission link (optional)"
              commentRequired={false}
              refresh={refresh}
              columns={[
                {
                  header: "Design",
                  render: (row) => cell.ref(String(row._id ?? row.id), row.designTitle, row.requirement)
                },
                { header: "Designer", render: (row) => cell.person(row.assignedDesigner?.name) },
                { header: "Status", render: (row) => cell.status(row.status) },
                { header: "Deadline", render: (row) => cell.date(row.deadline) }
              ]}
            />
          )}

          {view === "hospitality" && (
            <PipelineView
              title="Hospitality"
              subtitle="Guest hosting and logistics"
              rows={data.hospitalityEntries ?? []}
              statuses={HOSPITALITY_STATUSES}
              searchOf={(row) => `${row.guestName} ${row.organization ?? ""}`}
              titleOf={(row) => row.guestName}
              statusOf={(row) => row.currentStatus}
              endpoint={(id) => `/api/hospitality/${id}`}
              buildBody={(status, comment) => ({ currentStatus: status, detailedUpdate: comment })}
              refresh={refresh}
              columns={[
                {
                  header: "Guest",
                  render: (row) =>
                    cell.ref(String(row._id ?? row.id), row.guestName, row.requirement, () =>
                      openPipelineEntry("hospitality", String(row._id ?? row.id))
                    )
                },
                { header: "Organization", render: (row) => (row.organization ? cell.tag(row.organization) : "—") },
                { header: "Status", render: (row) => cell.status(row.currentStatus) },
                { header: "Arrival", render: (row) => cell.date(row.arrivalDate) }
              ]}
            />
          )}

          {view === "content" && (
            <PipelineView
              title="Content Pipeline"
              subtitle="Posts, articles and other content in production"
              rows={data.contentEntries ?? []}
              statuses={CONTENT_STATUSES}
              searchOf={(row) => `${row.contentTitle} ${row.platform ?? ""}`}
              titleOf={(row) => row.contentTitle}
              statusOf={(row) => row.currentStatus}
              endpoint={(id) => `/api/content/${id}`}
              buildBody={(status, comment) => ({ currentStatus: status, detailedUpdate: comment })}
              refresh={refresh}
              columns={[
                {
                  header: "Content",
                  render: (row) =>
                    cell.ref(String(row._id ?? row.id), row.contentTitle, row.description, () =>
                      openPipelineEntry("content", String(row._id ?? row.id))
                    )
                },
                { header: "Platform", render: (row) => (row.platform ? cell.tag(row.platform) : "—") },
                { header: "Status", render: (row) => cell.status(row.currentStatus) },
                { header: "Deadline", render: (row) => cell.date(row.deadline) }
              ]}
            />
          )}

          {view === "members" && (
            <MembersView members={data.memberStats} isSecretary={isSecretary} exportHref="/api/admin/export" />
          )}

          {view === "notifications" && (
            <NotificationsView notifications={notifications} unread={unread} markAllRead={markAllRead} />
          )}

          {view === "create" && (
            <CreateView
              members={data.memberStats}
              canManage={canManage}
              canDesign={canDesign}
              refresh={refresh}
            />
          )}
        </main>
      </div>
    </div>
  );
}
