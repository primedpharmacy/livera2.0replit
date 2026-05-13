"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, RotateCcw, Check, Trash2, Package, UserRound, AlertTriangle, Megaphone, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority, TaskActivity, ClinicTeamMember } from "@/types";

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

const NOW_ISO = "2026-05-11T08:00:00Z";

function relativeTime(iso: string): string {
  const diff = new Date(NOW_ISO).getTime() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(diff / 3600000);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(diff / 86400000);
  return `${d}d ago`;
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
}

function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });
}

const STATUS_CONFIG: Record<TaskStatus, { label: string; dot: string; bg: string }> = {
  todo:     { label: "To do",       dot: "bg-slate-400",  bg: "bg-slate-100 text-slate-600 border border-slate-200" },
  progress: { label: "In progress", dot: "bg-info",       bg: "bg-info-bg text-info border border-info-bdr" },
  done:     { label: "Done",        dot: "bg-ok",         bg: "bg-ok-bg text-ok border border-ok-bdr" },
  blocked:  { label: "Blocked",     dot: "bg-err",        bg: "bg-err-bg text-err border border-err-bdr" },
};

const PRIO_CONFIG: Record<TaskPriority, { label: string; dot: string; text: string }> = {
  high: { label: "High",   dot: "bg-err",       text: "text-err" },
  med:  { label: "Medium", dot: "bg-warn",      text: "text-warn" },
  low:  { label: "Low",    dot: "bg-slate-400", text: "text-t3" },
};

const LINKED_ICON: Record<string, React.ElementType> = {
  Order:     Package,
  Patient:   UserRound,
  Incident:  AlertTriangle,
  Complaint: Megaphone,
};

const TODAY = NOW_ISO.slice(0, 10);
const TOMORROW = (() => {
  const d = new Date(NOW_ISO);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
})();

function dueBadge(dueDate: string) {
  if (dueDate < TODAY)      return <span className="text-[11px] font-bold text-err">Overdue</span>;
  if (dueDate === TODAY)    return <span className="text-[11px] font-bold text-warn">Today</span>;
  if (dueDate === TOMORROW) return <span className="text-[11px] font-bold text-t2">Tomorrow</span>;
  return null;
}

function activityText(act: TaskActivity, memberMap: Record<string, ClinicTeamMember>) {
  switch (act.kind) {
    case "created":      return <span className="text-t2">created this task.</span>;
    case "status_change":
      return (
        <span className="text-t2">
          changed status from{" "}
          <span className="font-semibold text-t1">{STATUS_CONFIG[act.from_status!]?.label}</span>{" "}
          to{" "}
          <span className="font-semibold text-t1">{STATUS_CONFIG[act.to_status!]?.label}</span>.
        </span>
      );
    case "assigned":
      return (
        <span className="text-t2">
          assigned task to{" "}
          <span className="font-semibold text-t1">{memberMap[act.assigned_to_user_id!]?.full_name ?? act.assigned_to_user_id}</span>.
        </span>
      );
    case "linked":
      return <span className="text-t2">linked task to order <span className="font-semibold text-t1">{act.linked_ref}</span>.</span>;
    case "subtask_done":
      return <span className="text-t2">completed subtask: <span className="font-semibold text-t1">{act.subtask_title}</span>.</span>;
    default:
      return null;
  }
}

interface Props {
  clinicId: string;
  task: Task;
  members: ClinicTeamMember[];
}

export function TaskDetailClient({ clinicId, task, members }: Props) {
  const router = useRouter();
  const memberMap = Object.fromEntries(members.map((m) => [m.user_id, m]));

  const [status, setStatus]     = useState(task.status);
  const [subtasks, setSubtasks] = useState(task.subtasks);
  const [comment, setComment]   = useState("");
  const [commentTab, setCommentTab] = useState<"comment" | "note">("comment");
  const [toast, setToast]       = useState<string | null>(null);

  const owner    = memberMap[task.owner_user_id];
  const reporter = memberMap[task.reporter_user_id];
  const sc       = STATUS_CONFIG[status];
  const pc       = PRIO_CONFIG[task.priority];

  const doneSubs  = subtasks.filter((s) => s.done).length;

  function showToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  }

  function toggleSubtask(id: string) {
    setSubtasks((prev) => prev.map((s) => s.id === id ? { ...s, done: !s.done } : s));
  }

  function markDone() {
    setStatus("done");
    showToast("Task marked as Done");
  }

  const LinkedIcon = task.linked ? LINKED_ICON[task.linked.type] ?? Package : Package;

  return (
    <div className="flex flex-col h-full">
      {/* Topbar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border bg-surface shrink-0">
        <button
          onClick={() => router.push(`/${clinicId}/tasks`)}
          className="flex items-center gap-1.5 text-[12px] font-medium text-t2 hover:text-t1 transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Tasks
        </button>
        <span className="text-t3 text-[12px]">/</span>
        <span className="text-[12px] font-medium text-t1 truncate max-w-sm">{task.id} — {task.title}</span>
        <div className="ml-auto flex items-center gap-2">
          <button className="text-[12px] font-medium text-t2 border border-border rounded-md px-3 py-1.5 hover:bg-surface-2 flex items-center gap-1.5 transition-colors">
            <RotateCcw className="w-3 h-3" />
            Reassign
          </button>
          <button className="text-[12px] font-medium text-err border border-err-bdr rounded-md px-3 py-1.5 hover:bg-err-bg flex items-center gap-1.5 transition-colors">
            <Trash2 className="w-3 h-3" />
            Delete
          </button>
          {status !== "done" && (
            <button
              onClick={markDone}
              className="text-[12px] font-semibold text-white bg-brand rounded-md px-3 py-1.5 hover:bg-brand/90 flex items-center gap-1.5 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
              Mark done
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Detail pane */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 border-r border-border">
          {/* Title block */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="font-mono text-[11px] text-t3 bg-surface-2 px-2 py-0.5 rounded">{task.id}</span>
              <span className={cn("inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full", sc.bg)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", sc.dot)} />
                {sc.label}
              </span>
              <span className={cn("inline-flex items-center gap-1 text-[11px] font-semibold", pc.text)}>
                <span className={cn("w-1.5 h-1.5 rounded-full", pc.dot)} />
                {pc.label} priority
              </span>
            </div>
            <h1 className="text-[20px] font-bold text-t1 leading-snug tracking-tight">{task.title}</h1>
          </div>

          {/* Description */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-t1">Description</p>
              <span className="text-[11px] text-t3">Click to edit</span>
            </div>
            <p className="text-[13px] text-t2 leading-relaxed">{task.description}</p>
          </div>

          {/* Properties */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <p className="text-[12px] font-semibold text-t1 mb-3">Properties</p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[
                {
                  label: "Owner",
                  value: owner ? (
                    <div className="flex items-center gap-2">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", avatarColor(owner.role))}>
                        {initials(owner.full_name)}
                      </span>
                      <span className="text-[12.5px] font-medium text-t1">{owner.full_name}</span>
                    </div>
                  ) : <span className="text-t3 text-[12px]">—</span>,
                },
                {
                  label: "Reporter",
                  value: reporter ? (
                    <div className="flex items-center gap-2">
                      <span className={cn("w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0", avatarColor(reporter.role))}>
                        {initials(reporter.full_name)}
                      </span>
                      <span className="text-[12.5px] font-medium text-t1">{reporter.full_name}</span>
                    </div>
                  ) : <span className="text-t3 text-[12px]">—</span>,
                },
                {
                  label: "Due date",
                  value: (
                    <div>
                      <p className="text-[12.5px] font-medium text-t1">{fmtDate(task.due_date)}</p>
                      {dueBadge(task.due_date)}
                    </div>
                  ),
                },
                {
                  label: "Priority",
                  value: (
                    <span className={cn("inline-flex items-center gap-1 text-[12px] font-semibold", pc.text)}>
                      <span className={cn("w-1.5 h-1.5 rounded-full shrink-0", pc.dot)} />
                      {pc.label}
                    </span>
                  ),
                },
                {
                  label: "Created",
                  value: <span className="text-[12px] text-t2">{fmtDateTime(task.created_at)}</span>,
                },
                {
                  label: "Last updated",
                  value: <span className="text-[12px] text-t2">{fmtDateTime(task.updated_at)}</span>,
                },
              ].map((prop) => (
                <div key={prop.label} className="flex flex-col gap-1">
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-t3">{prop.label}</span>
                  {prop.value}
                </div>
              ))}
            </div>
          </div>

          {/* Linked record */}
          {task.linked && (
            <div className="bg-surface border border-border rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[12px] font-semibold text-t1">Linked record</p>
                <span className="text-[11px] text-t3">Click to open</span>
              </div>
              <div className="flex items-center gap-3 p-3 bg-surface-2 border border-border rounded-lg hover:bg-surface-2/80 cursor-pointer transition-colors">
                <div className="w-9 h-9 rounded-lg bg-brand-light flex items-center justify-center shrink-0">
                  <LinkedIcon className="w-4 h-4 text-brand" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10.5px] font-bold text-t3 uppercase tracking-wide">{task.linked.type}</p>
                  <p className="text-[12.5px] font-medium text-t1 mt-0.5">{task.linked.label}</p>
                  {task.linked.meta && <p className="text-[11px] text-t3 mt-0.5">{task.linked.meta}</p>}
                </div>
                <ChevronRight className="w-4 h-4 text-t3 shrink-0" />
              </div>
            </div>
          )}

          {/* Subtasks */}
          <div className="bg-surface border border-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[12px] font-semibold text-t1">Subtasks</p>
              {subtasks.length > 0 && (
                <span className="text-[11px] text-t3">{doneSubs} of {subtasks.length} done</span>
              )}
            </div>
            <div className="space-y-2">
              {subtasks.map((sub) => (
                <div
                  key={sub.id}
                  className={cn(
                    "flex items-center gap-3 py-2 px-3 rounded-lg border transition-colors",
                    sub.done ? "bg-ok-bg border-ok-bdr" : "bg-surface-2 border-border"
                  )}
                >
                  <input
                    type="checkbox"
                    checked={sub.done}
                    onChange={() => toggleSubtask(sub.id)}
                    className="w-3.5 h-3.5 rounded accent-brand cursor-pointer shrink-0"
                  />
                  <span className={cn("flex-1 text-[12.5px]", sub.done ? "line-through text-t3" : "text-t1")}>
                    {sub.title}
                  </span>
                  {sub.due_label && (
                    <span className="text-[10.5px] text-t3 shrink-0">{sub.due_label}</span>
                  )}
                </div>
              ))}
              <button className="text-[12px] text-brand font-medium hover:underline mt-1 block">
                + Add subtask
              </button>
            </div>
          </div>
        </div>

        {/* RIGHT: Activity pane */}
        <div className="w-80 xl:w-96 shrink-0 flex flex-col overflow-hidden">
          <div className="flex items-baseline justify-between px-5 py-3 border-b border-border">
            <p className="text-[13px] font-semibold text-t1">Activity</p>
            <p className="text-[11px] text-t3">{task.activity.length} events · newest first</p>
          </div>

          {/* Composer */}
          <div className="px-5 py-3 border-b border-border bg-surface-2">
            <div className="flex gap-3 mb-2">
              {(["comment", "note"] as const).map((ct) => (
                <button
                  key={ct}
                  onClick={() => setCommentTab(ct)}
                  className={cn(
                    "text-[12px] font-medium pb-1 border-b-2 transition-colors",
                    commentTab === ct ? "border-brand text-brand" : "border-transparent text-t3 hover:text-t2"
                  )}
                >
                  {ct === "comment" ? "Comment" : "Internal note"}
                </button>
              ))}
            </div>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder={commentTab === "comment" ? "Add a comment… use @ to mention." : "Internal note — not visible to patients."}
              className="w-full text-[12px] bg-surface border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-1 focus:ring-brand/40 placeholder:text-t3"
            />
            <div className="flex items-center justify-between mt-2">
              <span className="text-[10.5px] text-t3">
                {commentTab === "comment" ? "Visible to all task watchers" : "Only visible to clinic team"}
              </span>
              <button
                onClick={() => { setComment(""); showToast(commentTab === "comment" ? "Comment posted" : "Internal note saved"); }}
                className="text-[12px] font-semibold text-white bg-brand rounded-md px-3 py-1.5 hover:bg-brand/90 transition-colors"
              >
                Post
              </button>
            </div>
          </div>

          {/* Activity log */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            {task.activity.map((act) => {
              const actor = memberMap[act.actor_user_id];
              const isComment = act.kind === "comment" || act.kind === "note";
              return (
                <div key={act.id} className="flex gap-3">
                  <span className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5",
                    actor ? avatarColor(actor.role) : "bg-slate-200 text-slate-600"
                  )}>
                    {actor ? initials(actor.full_name) : "?"}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-[11.5px]">
                      <span className="font-semibold text-t1">{actor?.full_name ?? act.actor_user_id}</span>
                      <span className="text-t3 ml-1">· {relativeTime(act.timestamp)}</span>
                    </p>
                    {isComment ? (
                      <>
                        <p className="text-[11.5px] text-t2 mt-0.5">
                          {act.kind === "note" ? "left an internal note:" : "commented:"}
                        </p>
                        <div className="mt-1.5 bg-surface-2 border border-border rounded-lg px-3 py-2 text-[12px] text-t1 leading-relaxed">
                          {act.content}
                        </div>
                      </>
                    ) : (
                      <p className="text-[11.5px] mt-0.5">{activityText(act, memberMap)}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-t1 text-white text-[12.5px] font-medium px-5 py-2.5 rounded-full shadow-lg z-50 animate-in fade-in slide-in-from-bottom-2">
          {toast}
        </div>
      )}
    </div>
  );
}
