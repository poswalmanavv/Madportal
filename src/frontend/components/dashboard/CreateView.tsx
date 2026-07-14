"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { EP_STATUSES, PRIORITIES, SPONSORSHIP_STATUSES } from "@shared/constants";
import { PageHeader, btnPrimary, card, input } from "./ui";

type Field = {
  name: string;
  label: string;
  type?: "text" | "date" | "email" | "url";
  optional?: boolean;
  textarea?: boolean;
};

type Panel = "task" | "ep" | "sponsor" | "design";

/**
 * The create forms. Same endpoints and same payloads as before -- only the layout changed.
 * The gates (canManage for tasks, canDesign for design requests) mirror the server, which
 * re-checks each request regardless.
 */
export function CreateView({
  members,
  canManage,
  canDesign,
  refresh
}: {
  members: Array<Record<string, any>>;
  canManage: boolean;
  canDesign: boolean;
  refresh: () => Promise<void>;
}) {
  const available: Panel[] = ["ep", "sponsor"];
  if (canManage) available.unshift("task");
  if (canDesign) available.push("design");

  const [panel, setPanel] = useState<Panel>(available[0]);

  const labels: Record<Panel, string> = {
    task: "Task",
    ep: "EP Entry",
    sponsor: "Sponsorship",
    design: "Design Request"
  };

  return (
    <>
      <PageHeader title="Create New" subtitle="Add a task, partnership, sponsor or design request" />

      <div className="mb-4 flex flex-wrap gap-2">
        {available.map((item) => (
          <button
            key={item}
            onClick={() => setPanel(item)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              panel === item
                ? "bg-brand text-white"
                : "border border-neutral-300 hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
            }`}
          >
            {labels[item]}
          </button>
        ))}
      </div>

      <div className={`${card} max-w-3xl p-6`}>
        {panel === "task" && (
          <Form
            key="task"
            title="Create Task"
            endpoint="/api/tasks"
            refresh={refresh}
            members={members}
            multiAssign
            fields={[
              { name: "title", label: "Title" },
              { name: "description", label: "Description", textarea: true },
              { name: "deadline", label: "Deadline", type: "date" },
              { name: "remarks", label: "Remarks", optional: true }
            ]}
            selects={{ priority: PRIORITIES }}
            assignField="assignedTo"
          />
        )}

        {panel === "ep" && (
          <Form
            key="ep"
            title="Add EP Entry"
            endpoint="/api/ep-entries"
            refresh={refresh}
            fields={[
              { name: "epName", label: "EP Name" },
              { name: "organization", label: "Organization / College" },
              { name: "personContacted", label: "Person Contacted" },
              { name: "contactNumber", label: "Contact Number" },
              { name: "email", label: "Email", type: "email" },
              { name: "date", label: "Date", type: "date" },
              { name: "discussionSummary", label: "Discussion Summary", textarea: true },
              { name: "detailedUpdate", label: "Detailed Update", textarea: true },
              { name: "attachNotes", label: "Notes", optional: true }
            ]}
            selects={{ currentStatus: EP_STATUSES }}
          />
        )}

        {panel === "sponsor" && (
          <Form
            key="sponsor"
            title="Add Sponsorship"
            endpoint="/api/sponsorships"
            refresh={refresh}
            fields={[
              { name: "companyName", label: "Company Name" },
              { name: "industry", label: "Industry" },
              { name: "companyWebsite", label: "Website", type: "url", optional: true },
              { name: "contactPersonName", label: "Contact Person" },
              { name: "designation", label: "Designation" },
              { name: "contactNumber", label: "Contact Number" },
              { name: "email", label: "Email", type: "email" },
              { name: "dateContacted", label: "Date Contacted", type: "date" },
              { name: "followUpDate", label: "Follow-up Date", type: "date", optional: true },
              { name: "sponsorshipRequirement", label: "Requirement", textarea: true },
              { name: "detailedUpdate", label: "Detailed Update", textarea: true }
            ]}
            selects={{ currentStatus: SPONSORSHIP_STATUSES }}
          />
        )}

        {panel === "design" && (
          <Form
            key="design"
            title="Create Design Request"
            endpoint="/api/design-requests"
            refresh={refresh}
            members={members}
            assignField="assignedDesigner"
            fields={[
              { name: "designTitle", label: "Design Title" },
              { name: "requirement", label: "Requirement" },
              { name: "description", label: "Description", textarea: true },
              { name: "deadline", label: "Deadline", type: "date" },
              { name: "finalSubmissionLink", label: "Submission Link", type: "url", optional: true }
            ]}
          />
        )}
      </div>
    </>
  );
}

function Form({
  title,
  endpoint,
  fields,
  selects = {},
  members = [],
  assignField,
  multiAssign = false,
  refresh
}: {
  title: string;
  endpoint: string;
  fields: Field[];
  selects?: Record<string, readonly string[]>;
  members?: Array<Record<string, any>>;
  assignField?: string;
  multiAssign?: boolean;
  refresh: () => Promise<void>;
}) {
  const [message, setMessage] = useState("");
  const [ok, setOk] = useState(false);
  const [saving, setSaving] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setMessage("");

    const payload: Record<string, any> = {};
    for (const field of fields) payload[field.name] = form.get(field.name);
    for (const name of Object.keys(selects)) payload[name] = form.get(name);

    if (assignField) {
      payload[assignField] = multiAssign ? form.getAll(assignField) : form.get(assignField);
    }
    // Tasks accept an attachments array; nothing in the UI sets one yet.
    if (endpoint === "/api/tasks") payload.attachments = [];
    if (endpoint === "/api/design-requests" && !payload.status) payload.status = "Pending";

    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    setSaving(false);

    if (response.ok) {
      setOk(true);
      setMessage("Saved.");
      (event.target as HTMLFormElement).reset();
      await refresh();
      return;
    }

    const body = await response.json().catch(() => null);
    setOk(false);
    setMessage(
      typeof body?.error === "string" ? body.error : "Could not save. Check the required fields and try again."
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="text-lg font-bold">{title}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {fields.map((field) => (
          <label
            key={field.name}
            className={`text-xs font-semibold text-neutral-500 ${field.textarea ? "sm:col-span-2" : ""}`}
          >
            {field.label}
            {!field.optional && <span className="text-rose-600"> *</span>}
            {field.textarea ? (
              <textarea
                name={field.name}
                required={!field.optional}
                rows={3}
                className={`${input} mt-1 block w-full resize-y`}
              />
            ) : (
              <input
                name={field.name}
                type={field.type ?? "text"}
                required={!field.optional}
                className={`${input} mt-1 block w-full`}
              />
            )}
          </label>
        ))}

        {Object.entries(selects).map(([name, values]) => (
          <label key={name} className="text-xs font-semibold text-neutral-500">
            {name === "currentStatus" ? "Status" : name === "priority" ? "Priority" : name}
            <select name={name} className={`${input} mt-1 block w-full`}>
              {values.map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
        ))}

        {assignField && (
          <label className="text-xs font-semibold text-neutral-500 sm:col-span-2">
            {multiAssign ? "Assign to (hold Ctrl to pick several)" : "Assigned designer"}
            <span className="text-rose-600"> *</span>
            <select
              name={assignField}
              multiple={multiAssign}
              required
              className={`${input} mt-1 block w-full ${multiAssign ? "min-h-28" : ""}`}
            >
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name} · {member.year}
                </option>
              ))}
            </select>
            {!members.length && (
              <span className="mt-1 block font-normal text-neutral-400">
                No members are visible to you yet.
              </span>
            )}
          </label>
        )}
      </div>

      {message && (
        <p className={`text-sm font-medium ${ok ? "text-emerald-600" : "text-rose-600"}`}>{message}</p>
      )}

      <button disabled={saving} className={btnPrimary}>
        <Send size={15} /> {saving ? "Saving..." : "Save"}
      </button>
    </form>
  );
}
