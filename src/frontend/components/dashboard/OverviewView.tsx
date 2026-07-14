"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { CheckCircle2, ClipboardList, Handshake, Users } from "lucide-react";
import { Avatar, EmptyState, PageHeader, card } from "./ui";

export function OverviewView({ data }: { data: Record<string, any> }) {
  const stats = data.stats ?? {};

  const metrics = [
    { label: "Active Members", value: stats.activeMembers ?? 0, icon: Users, tone: "text-sky-600" },
    { label: "Tasks", value: stats.tasks ?? 0, icon: ClipboardList, tone: "text-indigo-600" },
    { label: "Completed", value: stats.completedTasks ?? 0, icon: CheckCircle2, tone: "text-emerald-600" },
    { label: "EP Entries", value: stats.epEntries ?? 0, icon: Handshake, tone: "text-amber-600" },
    { label: "Sponsorships", value: stats.sponsorships ?? 0, icon: Handshake, tone: "text-rose-600" }
  ];

  const contributors: any[] = data.charts?.topContributors ?? [];

  return (
    <>
      <PageHeader title="Overview" subtitle="Club activity at a glance" />

      <section className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div key={metric.label} className={`${card} p-4`}>
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">{metric.label}</p>
                <Icon size={16} className={metric.tone} />
              </div>
              <p className="mt-3 text-3xl font-bold tabular-nums">{metric.value}</p>
            </div>
          );
        })}
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.3fr_0.7fr]">
        <div className={`${card} p-5`}>
          <h2 className="mb-4 font-bold">Monthly Contributions</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data.charts?.monthlyContributions ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis allowDecimals={false} tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Area type="monotone" dataKey="count" stroke="#0f766e" strokeWidth={2} fill="#99f6e4" fillOpacity={0.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={`${card} p-5`}>
          <h2 className="mb-4 font-bold">Year-wise Completion</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.charts?.yearPerformance ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="year" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickLine={false} axisLine={false} fontSize={12} />
                <Tooltip />
                <Bar dataKey="completion" fill="#f9735b" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className={`${card} mt-5 p-5`}>
        <h2 className="mb-4 font-bold">Top Contributors</h2>
        {contributors.length ? (
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {contributors.map((member) => (
              <li
                key={member.id}
                className="flex items-center gap-3 rounded-lg border border-neutral-200 p-3 dark:border-neutral-800"
              >
                <Avatar name={member.name} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{member.name}</p>
                  <p className="text-xs text-neutral-500">
                    {member.totalTasksCompleted} completed · {member.totalEPEntries + member.totalSponsorshipEntries} entries
                  </p>
                </div>
                <span className="text-sm font-bold tabular-nums text-brand">{member.completionPercentage}%</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState message="No activity yet." />
        )}
      </section>
    </>
  );
}
