"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { Search, Plus, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { NOW } from "@/lib/api/constants";
import type { Task, TaskStatus, TaskPriority, ClinicTeamMember } from "@/types";

// ── Helpers ──────────────────────────────────────────────────────────────────

function initials(name: string) {
  return name.split(" ").map((p) => p[0]).join("").toUpperCase().slice(0, 2);
}

function avatarColor(role: ClinicTeamMember["role"]) {
  if (role === "Owner") return "bg-brand text-white";
  if (role === "Prescriber") return "bg-emerald-600 text-white";
  if (role === "Coach") return "bg-amber-500 text-white";
  return "bg-violet-500 text-white";
}

const TODAY = NOW.slice(0, 10); // '2026-05-11'
const TOMORROW = (() => {
  const d = new Date(NOW);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

function dueLabel(dueDate: string): { label: string; cls: string } {
  if (dueDate < TODAY)  return { label: `Overdue · ${Math.round((new Date(TODAY).getTime() - new Date(dueDate).getTime()) / 86400000)}d`, cls: "text-err font-semibold" };
  if (dueDate === TODAY) return { label: "Today",    cls: "text-warn font-semibold" };
  if (dueDate === TOMORROW) return { label: "Tomorrow", cls: "text-t2" };
  const days = Math.round((new Date(dueDate).getTime() - new Date(TODAY).getTime()) / 86400000);
  return { label: `In ${days} days`, cls: "text-t3" };
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; bg: string }> = {
  todo:     { label: "To do",       dot: "bg-slate-400",  bg: "bg-slate-100 text-slate-600 border border-slate-200" },
  progress: { label: "In progress", dot: "bg-info",       bg: "bg-info-bg text-info border border-info-bdr" },
  done:     { label: "Done",        dot: "bg-ok",         bg: "bg-ok-bg text-ok border border-ok-bdr" },
  blocked:  { label: "Blocked",     dot: "bg-err",        bg: "bg-err-bg text-err border border-err-bdr" },
};

const PRIO_CONFIG: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  high: { label: "High",   dot: "bg-err",  text: "text-err" },
  med:  { label: "Medium", dot: "bg-warn", text: "text-warn" },
  low:  { label: "Low",    dot: "bg-slate-400", text: "text-t3" },
};

const LINKED_COLORS: Record<string, string> = {
  Patient:   "bg-violet-50 text-violet-700 border-violet-200",
  Order:     "bg-info-bg text-info border-info-bdr",
  Incident:  "bg-err-bg text-err border-err-bdr",
  Complaint: "bg-warn-bg text-warn border-warn-bdr",
};

type TabKey = "all" | "mine" | "overdue" | "today" | "active" | "done";

interface Props {
  clinicId: string;
  tasks: Task[];
  members: ClinicTeamMember[];
}

export function TasksView({ clinicId, tasks, members }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<TabKey>("all");
  const [search, setSearch] = useState("");
  const [showNewTask, setShowNewTask] = useState(false);

  const memberMap = useMemo(
    () => Object.fromEntries(members.map((m) => [m.user_id, m])),
    [members]
  );

  // KPI counts (against all tasks — not filtered by search)
  const open      = tasks.filter((t) => t.status !== "done");
  const overdueCt = tasks.filter((t) => t.status !== "done" && t.due_date < TODAY).length;
  const todayCt   = tasks.filter((t) => t.status !== "done" && t.due_date === TODAY).length;
  const mineCt    = tasks.filter((t) => t.owner_user_id === "user_qadir").length;
  const linkedCt  = tasks.filter((t) => t.linked).length;

  const filtered = useMemo(() => {
    let list = tasks;
    if (tab === "mine")    list = list.filter((t) => t.owner_user_id === "user_qadir");
    else if (tab === "overdue") list = list.filter((t) => t.status !== "done" && t.due_date < TODAY);
    else if (tab === "today")   list = list.filter((t) => t.status !== "done" && t.due_date === TODAY);
    else if (tab === "active")  list = list.filter((t) => t.status !== "done");
    else if (tab === "done")    list = list.filter((t) => t.status === "done");
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.id.toLowerCase().includes(q) ||
          t.title.toLowerCase().includes(q) ||
          (memberMap[t.owner_user_id]?.full_name ?? "").toLowerCase().includes(q) ||
          t.linked?.ref.toLowerCase().includes(q)
      );
    }
    return list;
  }, [tasks, tab, search, memberMap]);

  const tabCounts: Record<TabKey, number> = {
    all:     tasks.length,
    mine:    mineCt,
    overdue: overdueCt,
    today:   todayCt,
    active:  open.length,
    done:    tasks.filter((t) => t.status === "done").length,
  };

  const TABS: { key: TabKey; label: string; errDot?: boolean }[] = [
    { key: "all",     label: "All" },
    { key: "mine",    label: "My tasks" },
    { key: "overdue", label: "Overdue", errDot: true },
    { key: "today",   label: "Due today" },
    { key: "active",  label: "Active" },
    { key: "done",    label: "Done" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-surface shrink-0">
        <div>
          <span className="text-[13px] font-semibold text-t1">Tasks</span>
          <span className="ml-2 text-[12px] text-t3">
            {open.length} open · {overdueCt > 0 && <span className="text-err font-semibold">{overdueCt} overdue</span>}
            {overdueCt > 0 && todayCt > 0 && " · "}
            {todayCt > 0 && <span className="text-warn font-semibold">{todayCt} due today</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <button className="text-[12px] font-medium text-t2 border border-border rounded-md px-3 py-1.5 hover:bg-surface-2 transition-colors">
            Export
          </button>
          <button
            onClick={() => setShowNewTask(true)}
            className="flex items-center gap-1.5 text-[12px] font-semibold text-white bg-brand rounded-md px-3 py-1.5 hover:bg-brand/90 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New task
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="flex border-b border-border bg-surface-2 shrink-0">
        {[
          { label: "Total open",       value: open.length,  sub: `Across ${new Set(open.map(t=>t.owner_user_id)).size} owners`, err: false, warn: false },
          { label: "Overdue",          value: overdueCt,    sub: "Action today",                                                  err: overdueCt > 0, warn: false },
          { label: "Due today",        value: todayCt,      sub: "By 17:00",                                                      err: false, warn: todayCt > 0 },
          { label: "Assigned to me",   value: mineCt,       sub: "Qadir Hussain",                                                 err: false, warn: false },
          { label: "Linked to records", value: linkedCt,    sub: "Patient · Order · Inc.",                                        err: false, warn: false },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className={cn(
              "flex-1 px-4 py-3 border-r border-border last:border-r-0",
              kpi.err && "bg-err-bg",
              kpi.warn && "bg-warn-bg"
            )}
          >
            <p className={cn("text-[10px] font-semibold uppercase tracking-wide", kpi.err ? "text-err" : kpi.warn ? "text-warn" : "text-t3")}>
              {kpi.label}
            </p>
            <p className={cn("text-[22px] font-bold leading-tight mt-0.5", kpi.err ? "text-err" : kpi.warn ? "text-warn" : "text-t1")}>
              {kpi.value}
            </p>
            <p className="text-[10.5px] text-t3 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border bg-surface shrink-0 px-6">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2.5 text-[12px] font-medium border-b-2 -mb-px transition-colors",
              tab === t.key
                ? "border-brand text-brand"
                : "border-transparent text-t2 hover:text-t1"
            )}
          >
            {t.label}
            <span
              className={cn(
                "text-[10px] font-bold px-1.5 py-px rounded-full min-w-[18px] text-center",
                t.errDot && tabCounts[t.key] > 0
                  ? "bg-err-bg text-err"
                  : "bg-surface-2 text-t3"
              )}
            >
              {tabCounts[t.key]}
            </span>
          </button>
        ))}
      </div>

      {/* Filter row */}
      <div className="flex items-center gap-2 px-6 py-2 border-b border-border bg-surface shrink-0">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title, owner, linked record…"
            className="pl-8 pr-3 py-1.5 text-[12px] bg-surface-2 border border-border rounded-md w-64 placeholder:text-t3 focus:outline-none focus:ring-1 focus:ring-brand/40"
          />
        </div>
        {(["Status: All", "Owner: Anyone", "Priority: Any", "Linked to: Any", "Due: Any time"] as const).map((chip) => (
          <button
            key={chip}
            className="flex items-center gap-1 text-[11px] font-medium text-t2 border border-border rounded-md px-2.5 py-1 hover:bg-surface-2 transition-colors"
          >
            {chip}
            <ChevronDown className="w-3 h-3 text-t3" />
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <div className="min-w-[820px]">
          <table className="w-full border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-surface-2 border-b border-border">
                {[
                  { label: "Task",      w: "38%" },
                  { label: "Owner",     w: "14%" },
                  { label: "Priority",  w: "10%" },
                  { label: "Status",    w: "12%" },
                  { label: "Due",       w: "12%" },
                  { label: "Linked to", w: "14%" },
                ].map((col) => (
                  <th
                    key={col.label}
                    style={{ width: col.w }}
                    className="text-left text-[10px] font-bold text-t3 uppercase tracking-wide px-4 py-2.5"
                  >
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[13px] text-t3">
                    No tasks match this filter.
                  </td>
                </tr>
              ) : (
                filtered.map((task) => {
                  const owner = memberMap[task.owner_user_id];
                  const { label: dl, cls: dc } = dueLabel(task.due_date);
                  const sc = STATUS_CONFIG[task.status];
                  const pc = PRIO_CONFIG[task.priority];
                  const lc = task.linked ? LINKED_COLORS[task.linked.type] ?? "bg-surface-2 text-t2 border-border" : null;
                  return (
                    <tr
                      key={task.id}
                      onClick={() => router.push(`/${clinicId}/tasks/${task.id}`)}
                      className="border-b border-border hover:bg-surface-2 cursor-pointer transition-colors"
                    >
                      <td className="px-4 py-3 align-top">
                        <p className="text-[10.5px] font-mono text-t3">{task.id}</p>
                        <p className="text-[13px] font-medium text-t1 mt-0.5 leading-snug">{task.title}</p>
                        <p className="text-[11px] text-t3 mt-1 leading-relaxed line-clamp-2">{task.description}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {owner ? (
                          <div className="flex items-center gap-2">
                            <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", avatarColor(owner.role))}>
                              {initials(owner.full_name)}
                            </span>
                            <span className="text-[12px] text-t1 leading-tight">{owner.full_name.split(" ")[0]}</span>
                          </div>
                        ) : (
                          <span className="text-[12px] text-t3">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", pc.text)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pc.dot)} />
                          {pc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full", sc.bg)}>
                          <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", sc.dot)} />
                          {sc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <p className="text-[12px] text-t1">{fmtDate(task.due_date)}</p>
                        <p className={cn("text-[11px] mt-0.5", dc)}>{dl}</p>
                      </td>
                      <td className="px-4 py-3 align-top">
                        {task.linked ? (
                          <span className={cn("inline-flex items-center text-[10.5px] font-semibold px-2 py-0.5 rounded-full border", lc)}>
                            {task.linked.type} · {task.linked.ref}
                          </span>
                        ) : (
                          <span className="text-[12px] text-t3">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* New task modal (stub) */}
      {showNewTask && (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center"
          onClick={() => setShowNewTask(false)}
        >
          <div
            className="bg-surface rounded-xl shadow-xl w-full max-w-md p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-[15px] font-semibold text-t1 mb-4">New task</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] font-semibold text-t2 uppercase tracking-wide block mb-1">Title</label>
                <input className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-brand/40" placeholder="e.g. Chase pharmacist on dose change" />
              </div>
              <div>
                <label className="text-[11px] font-semibold text-t2 uppercase tracking-wide block mb-1">Description</label>
                <textarea className="w-full border border-border rounded-md px-3 py-2 text-[13px] focus:outline-none focus:ring-1 focus:ring-brand/40 resize-none" rows={3} placeholder="Optional. Context, links, what 'done' looks like." />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setShowNewTask(false)}
                className="text-[12px] font-medium text-t2 border border-border rounded-md px-4 py-2 hover:bg-surface-2"
              >
                Cancel
              </button>
              <button
                onClick={() => setShowNewTask(false)}
                className="text-[12px] font-semibold text-white bg-brand rounded-md px-4 py-2 hover:bg-brand/90"
              >
                Create task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
