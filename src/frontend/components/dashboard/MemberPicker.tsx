"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Avatar, input } from "./ui";

// The dashboard passes loosely-typed member-stat objects; only id/name/year are read.
type Member = Record<string, any>;

/**
 * A searchable people picker that replaces the native `<select multiple>` (the "hold Ctrl"
 * list nobody can use). Click to open, type to filter by name, tick to select.
 *
 * It renders a hidden `<input name={name}>` per selected person, so the surrounding form's
 * FormData picks the selection up exactly as the old <select> did -- multiple inputs with
 * the same name for a multi-select, one for a single-select. No change to how the form
 * submits.
 *
 * `resetKey` clears the selection when the parent bumps it (after a successful create), so
 * the next task does not start pre-filled with the previous assignees.
 */
export function MemberPicker({
  name,
  members,
  multiple = false,
  resetKey = 0,
  placeholder = "Select..."
}: {
  name: string;
  members: Member[];
  multiple?: boolean;
  resetKey?: number;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSelected([]);
    setQuery("");
    setOpen(false);
  }, [resetKey]);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? members.filter((member) => member.name.toLowerCase().includes(q)) : members;
  }, [members, query]);

  const selectedMembers = members.filter((member) => selected.includes(member.id));

  function toggle(id: string) {
    if (multiple) {
      setSelected((current) => (current.includes(id) ? current.filter((x) => x !== id) : [...current, id]));
    } else {
      setSelected([id]);
      setOpen(false);
    }
  }

  return (
    <div ref={ref} className="relative mt-1">
      {/* Hidden inputs -> the parent <form>'s FormData still sees the selection. */}
      {selected.map((id) => (
        <input key={id} type="hidden" name={name} value={id} />
      ))}

      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={`${input} flex min-h-10 w-full items-center justify-between gap-2 text-left font-normal`}
      >
        <span className="flex flex-1 flex-wrap gap-1">
          {selectedMembers.length === 0 && <span className="text-neutral-400">{placeholder}</span>}
          {selectedMembers.map((member) => (
            <span
              key={member.id}
              className="inline-flex items-center gap-1 rounded-md bg-brand/10 px-2 py-0.5 text-xs font-medium text-brand"
            >
              {member.name}
              <span
                role="button"
                tabIndex={-1}
                aria-label={`Remove ${member.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setSelected((current) => current.filter((x) => x !== member.id));
                }}
                className="cursor-pointer hover:text-brand/70"
              >
                <X size={12} />
              </span>
            </span>
          ))}
        </span>
        <ChevronDown size={16} className="shrink-0 text-neutral-400" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-lg dark:border-neutral-800 dark:bg-neutral-900">
          <div className="border-b border-neutral-100 p-2 dark:border-neutral-800">
            <span className="relative block">
              <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
              <input
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                // Enter inside a form-embedded input would submit the form; keep it local.
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.preventDefault();
                }}
                placeholder="Search by name..."
                className={`${input} w-full pl-8 font-normal`}
              />
            </span>
          </div>

          <ul className="max-h-56 overflow-y-auto p-1" role="listbox">
            {filtered.map((member) => {
              const active = selected.includes(member.id);
              return (
                <li key={member.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => toggle(member.id)}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition hover:bg-neutral-100 dark:hover:bg-neutral-800"
                  >
                    <span
                      className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        active ? "border-brand bg-brand text-white" : "border-neutral-300 dark:border-neutral-600"
                      }`}
                    >
                      {active && <Check size={12} />}
                    </span>
                    <Avatar name={member.name} size={22} />
                    <span className="flex-1 truncate">{member.name}</span>
                    {member.year && <span className="shrink-0 text-xs text-neutral-400">{member.year}</span>}
                  </button>
                </li>
              );
            })}
            {!filtered.length && (
              <li className="px-2 py-4 text-center text-sm text-neutral-500">
                {members.length ? "No members match that search." : "No members are visible to you yet."}
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
