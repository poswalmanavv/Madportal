"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { DEPARTMENTS } from "@shared/constants";
import { Avatar, EmptyState, PageHeader, ProgressBar, Tag, btnGhost, card, input } from "./ui";

export function MembersView({
  members,
  isSecretary,
  exportHref
}: {
  members: Array<Record<string, any>>;
  isSecretary: boolean;
  exportHref: string;
}) {
  const [query, setQuery] = useState("");
  const [team, setTeam] = useState("");
  const [year, setYear] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return members.filter((member) => {
      const text = `${member.name} ${member.email}`.toLowerCase();
      const matchesQuery = !q || text.includes(q);
      const matchesTeam = !team || (member.departments ?? []).includes(team);
      const matchesYear = !year || member.year === year;
      return matchesQuery && matchesTeam && matchesYear;
    });
  }, [members, query, team, year]);

  return (
    <>
      <PageHeader
        title="Team Performance"
        // Scoping is enforced server-side by canViewMember: a secretary sees the whole club,
        // a team head only their own team. This line just tells the viewer which they are.
        subtitle={isSecretary ? "Every member across all teams" : "Members of your team"}
        count={filtered.length}
      >
        {isSecretary && (
          <a href={exportHref} className={btnGhost}>
            Export CSV
          </a>
        )}
      </PageHeader>

      <div className={card}>
        <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-4 dark:border-neutral-800">
          <label className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search members..."
              className={`${input} w-full pl-9`}
            />
          </label>

          <select value={team} onChange={(event) => setTeam(event.target.value)} className={input}>
            <option value="">All Teams</option>
            {DEPARTMENTS.map((department) => (
              <option key={department}>{department}</option>
            ))}
          </select>

          <select value={year} onChange={(event) => setYear(event.target.value)} className={input}>
            <option value="">All Years</option>
            {["1st Year", "2nd Year", "3rd Year", "4th Year"].map((y) => (
              <option key={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left">
            <thead>
              <tr className="border-b border-neutral-200 text-[11px] uppercase tracking-wide text-neutral-500 dark:border-neutral-800">
                <th className="px-4 py-3 font-semibold">Member</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Teams</th>
                <th className="px-4 py-3 font-semibold">Completed</th>
                <th className="px-4 py-3 font-semibold">Pending</th>
                <th className="px-4 py-3 font-semibold">Entries</th>
                <th className="px-4 py-3 font-semibold">Completion</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((member) => (
                <tr
                  key={member.id}
                  className="border-b border-neutral-100 transition hover:bg-neutral-50/70 dark:border-neutral-800 dark:hover:bg-neutral-800/40"
                >
                  <td className="px-4 py-4">
                    <span className="flex items-center gap-3">
                      <Avatar name={member.name} size={34} />
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{member.name}</span>
                        <span className="block truncate text-xs text-neutral-500">{member.email}</span>
                        {member.teamHeadRole && member.teamHeadRole !== "None" && (
                          <span className="mt-0.5 inline-block text-[10px] font-bold uppercase tracking-wide text-brand">
                            {member.teamHeadRole}
                          </span>
                        )}
                      </span>
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm text-neutral-600 dark:text-neutral-400">{member.year}</td>
                  <td className="px-4 py-4">
                    <span className="flex flex-wrap gap-1">
                      {(member.departments ?? []).map((department: string) => (
                        <Tag key={department} value={department} />
                      ))}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-sm font-semibold tabular-nums">{member.totalTasksCompleted}</td>
                  <td className="px-4 py-4 text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                    {member.pendingWork}
                  </td>
                  <td className="px-4 py-4 text-sm tabular-nums text-neutral-600 dark:text-neutral-400">
                    {member.totalEPEntries + member.totalSponsorshipEntries}
                  </td>
                  <td className="px-4 py-4">
                    <ProgressBar value={member.completionPercentage ?? 0} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!filtered.length && (
          <EmptyState message={members.length ? "No members match these filters." : "No members visible to you."} />
        )}
      </div>
    </>
  );
}
