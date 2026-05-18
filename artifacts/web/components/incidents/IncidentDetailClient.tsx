"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft, AlertTriangle, RefreshCw, AlertCircle,
  FileWarning, Building2, ExternalLink, CheckCircle2,
  MessageCircle, Send, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { KeyboardShortcutLegend } from "@/components/shared/KeyboardShortcutLegend";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { CURRENT_USER } from "@/lib/api/mock";
import {
  updateIncidentStatusAction, notifyCQCAction,
  syncIncidentFromMondayAction, recordYellowCardDecisionAction,
  addIncidentCommentAction,
} from "@/lib/actions/incidentActions";
import { USERS_REGISTRY } from "@/lib/api/constants";
import { can } from "@/lib/permissions";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import { useQueueNavigation } from "@/lib/queueNavigation";
import { QueuePositionIndicator } from "@/components/shared/QueuePositionIndicator";
import type { Incident, IncidentComment, Clinic, ClinicId } from "@/types";

interface Props {
  initialIncident: Incident;
  clinic: Clinic;
  clinicId: ClinicId;
  initialComments: IncidentComment[];
}

interface Toast { message: string; type: "ok" | "err" }

const SEV_STYLES: Record<string, { banner: string; text: string }> = {
  mild:     { banner: "bg-ok-bg border-ok-bdr",   text: "text-ok"   },
  moderate: { banner: "bg-warn-bg border-warn-bdr", text: "text-warn" },
  severe:   { banner: "bg-err-bg border-err-bdr",  text: "text-err"  },
};

const TYPE_LABELS: Record<string, string> = {
  medication_error:   "Medication error",
  adverse_event:      "Adverse event",
  delayed_dispensing: "Delayed dispensing",
  wrong_dose:         "Wrong dose",
  allergic_reaction:  "Allergic reaction",
  near_miss:          "Near miss",
  other:              "Other",
};

const TRIGGER_LABELS: Record<string, string> = {
  system:         "System",
  clinician:      "Clinician",
  admin:          "Admin",
  patient_report: "Patient report",
};

const YELLOW_CARD_TRIGGER_TYPES = new Set(["adverse_event", "allergic_reaction"]);

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins < 2)   return "just now";
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "yesterday";
  if (days < 30)  return `${days} days ago`;
  return formatDate(iso);
}

function resolveCreatorName(userId: string | null): string {
  if (!userId) return "Unknown";
  const u = USERS_REGISTRY[userId];
  return u ? u.full_name : userId;
}

function resolveCreatorInitials(userId: string | null): string {
  if (!userId) return "?";
  const u = USERS_REGISTRY[userId];
  if (!u) return "?";
  return u.full_name.split(" ").filter(Boolean).slice(0, 2).map((w) => w[0].toUpperCase()).join("");
}

function avatarColor(name: string): string {
  const COLORS = ["#6366f1", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6"];
  return COLORS[(name.charCodeAt(0) || 0) % COLORS.length];
}

function UserAvatar({ name, initials, size = 28 }: { name: string; initials: string; size?: number }) {
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, backgroundColor: avatarColor(name), fontSize: size * 0.36 }}
    >
      {initials}
    </div>
  );
}

// ── Status control ─────────────────────────────────────────────────────────────

const STATUS_STEPS = [
  { value: "open"          as const, label: "Open",                activeClass: "bg-surface border-brand text-brand"    },
  { value: "investigating" as const, label: "Under investigation", activeClass: "bg-warn-bg border-warn text-warn"       },
  { value: "resolved"      as const, label: "Resolved",            activeClass: "bg-ok-bg border-ok text-ok"             },
];

function StatusStepControl({
  current,
  isActing,
  onUpdate,
  legendShortcuts,
}: {
  current: Incident["status"];
  isActing: boolean;
  onUpdate: (s: Incident["status"]) => void;
  legendShortcuts: { keys: string[]; label: string }[];
}) {
  const activeStep = STATUS_STEPS.find((s) => s.value === current);
  return (
    <div className="bg-surface border border-bdr rounded-lg p-4">
      <div className="flex items-center justify-between mb-3 gap-3">
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">Incident status</h3>
        {legendShortcuts.length > 0 && (
          <KeyboardShortcutLegend shortcuts={legendShortcuts} />
        )}
      </div>
      <div className="flex gap-2">
        {STATUS_STEPS.map((step, i) => {
          const isActive = step.value === current || (!activeStep && i === 0);
          return (
            <button
              key={step.value}
              disabled={isActing || isActive}
              onClick={() => onUpdate(step.value)}
              className={cn(
                "flex-1 py-2 px-3 text-[12px] font-semibold rounded-lg border transition-all",
                isActive
                  ? step.activeClass
                  : "border-bdr text-t3 bg-page-bg hover:border-brand hover:text-brand disabled:cursor-default"
              )}
            >
              {step.label}
            </button>
          );
        })}
      </div>
      {current === "on_hold" && (
        <p className="text-[11px] text-warn mt-2">Currently on hold — select a status above to progress.</p>
      )}
      {current === "closed" && (
        <p className="text-[11px] text-t3 mt-2">This incident is closed.</p>
      )}
    </div>
  );
}

// ── Comments panel ─────────────────────────────────────────────────────────────

function CommentsPanel({
  incidentId,
  clinicId,
  initialComments,
}: {
  incidentId: string;
  clinicId: ClinicId;
  initialComments: IncidentComment[];
}) {
  const [comments, setComments] = useState<IncidentComment[]>(initialComments);
  const [body,     setBody]     = useState("");
  const [posting,  setPosting]  = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (comments.length > initialComments.length) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comments.length]);

  async function handlePost() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setPosting(true);
    try {
      const newComment = await addIncidentCommentAction(clinicId, incidentId, trimmed);
      setComments((prev) => [...prev, newComment]);
      setBody("");
    } finally {
      setPosting(false);
    }
  }

  const myInitials = resolveCreatorInitials(CURRENT_USER.id);
  const myName     = resolveCreatorName(CURRENT_USER.id);

  return (
    <div className="bg-surface border border-bdr rounded-lg p-4">
      <div className="flex items-center gap-2 mb-4">
        <MessageCircle className="w-4 h-4 text-t3" />
        <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">
          Comments & updates{comments.length > 0 && <span className="ml-1.5 font-mono normal-case">({comments.length})</span>}
        </h3>
      </div>

      {/* Thread */}
      {comments.length === 0 ? (
        <p className="text-[12px] text-t3 italic mb-4">
          No comments yet — be the first to update this incident.
        </p>
      ) : (
        <div className="space-y-4 mb-4 max-h-80 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-3">
              <UserAvatar name={c.user_name} initials={c.user_initials} size={28} />
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className="text-[12px] font-semibold text-t1">{c.user_name}</span>
                  <span className="text-[11px] text-t3">{relativeTime(c.created_at)}</span>
                </div>
                <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{c.body}</p>
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Compose */}
      <div className="flex gap-2.5 items-start pt-3 border-t border-bdr">
        <UserAvatar name={myName} initials={myInitials} size={28} />
        <div className="flex-1 min-w-0">
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handlePost();
            }}
            rows={2}
            placeholder="Add an update or comment..."
            className="w-full text-[13px] border border-bdr rounded-lg px-3 py-2 bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none leading-relaxed"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-[10px] text-t3">Cmd+Enter to post</span>
            <button
              onClick={handlePost}
              disabled={posting || !body.trim()}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold rounded-md bg-brand text-white hover:bg-brand/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <Send className="w-3 h-3" />
              {posting ? "Posting..." : "Post update"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function IncidentDetailClient({ initialIncident, clinic, clinicId, initialComments }: Props) {
  useQueueNavigation({ kind: "incidents", currentId: initialIncident.id, clinicId });
  const [incident, setIncident] = useState<Incident>(initialIncident);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActing,  setIsActing]  = useState(false);
  const [toast,     setToast]     = useState<Toast | null>(null);

  const [ycLocalDecision, setYcLocalDecision] = useState<"filed" | "not_applicable" | null>(null);
  const [ycRef,    setYcRef]    = useState("");
  const [ycSaving, setYcSaving] = useState(false);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const ycRefInputRef = useRef<HTMLInputElement>(null);

  const canManage = can(CURRENT_USER, "write", "incidents");
  const sevStyle  = SEV_STYLES[incident.severity] ?? SEV_STYLES.moderate;
  const triageText = clinic.config.incident_triage_text[incident.severity];
  const isSharedBoard = incident.monday_board_id === "18402056019";

  const showYellowCardPanel =
    incident.yellow_card_required ||
    incident.severity === "severe" ||
    YELLOW_CARD_TRIGGER_TYPES.has(incident.incident_type);

  const ycPrescriberNmc = CURRENT_USER.professional_registrations?.find(
    (r) => r.body === "NMC" || r.body === "GPhC"
  )?.reg_number ?? null;

  const creatorName     = resolveCreatorName(incident.created_by_user_id);
  const creatorInitials = resolveCreatorInitials(incident.created_by_user_id);

  const ycPanelAwaiting =
    showYellowCardPanel && incident.yellow_card_decision === null && canManage;
  const cqcAwaiting =
    incident.cqc_notification_required && !incident.cqc_notified_at && canManage;
  const canChangeStatus = canManage && incident.status !== "closed";

  const legendShortcuts: { keys: string[]; label: string }[] = [];
  if (canChangeStatus && incident.status !== "investigating") {
    legendShortcuts.push({ keys: ["I"], label: "investigating" });
  }
  if (canChangeStatus && incident.status !== "resolved") {
    legendShortcuts.push({ keys: ["R"], label: "resolved" });
  }
  if (ycPanelAwaiting) legendShortcuts.push({ keys: ["Y"], label: "yellow card" });
  if (cqcAwaiting)     legendShortcuts.push({ keys: ["C"], label: "notify CQC" });

  // Keyboard shortcuts: I=investigating, R=resolved, Y=yellow-card, C=notify CQC.
  // Mirrors the Clinical Check slide-over: ignore typing in inputs/textareas
  // and skip when any modifier key or an open dialog is present.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      // Ignore when any modal/dialog is open elsewhere on the page.
      if (typeof document !== "undefined" && document.querySelector('[role="dialog"], [aria-modal="true"]')) return;

      const k = e.key.toLowerCase();
      if (k === "i" && canChangeStatus && incident.status !== "investigating" && !isActing) {
        e.preventDefault();
        handleStatusUpdate("investigating");
      } else if (k === "r" && canChangeStatus && incident.status !== "resolved" && !isActing) {
        e.preventDefault();
        handleStatusUpdate("resolved");
      } else if (k === "y" && ycPanelAwaiting) {
        e.preventDefault();
        setYcLocalDecision("filed");
        // Defer focus so the conditional input has mounted.
        setTimeout(() => ycRefInputRef.current?.focus(), 0);
      } else if (k === "c" && cqcAwaiting && !isActing) {
        e.preventDefault();
        handleNotifyCQC();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canChangeStatus, incident.status, isActing, ycPanelAwaiting, cqcAwaiting]);

  async function handleStatusUpdate(status: Incident["status"]) {
    setIsActing(true);
    try {
      const wasOpen = !["resolved", "closed"].includes(incident.status);
      const updated = await updateIncidentStatusAction(clinicId, incident.id, status);
      setIncident(updated);
      const nowOpen = !["resolved", "closed"].includes(updated.status);
      if (wasOpen !== nowOpen) {
        dispatchQueueCountChange({ queue: "incidents", delta: nowOpen ? 1 : -1 });
      }
      setToast({ message: `Status updated to ${status.replace(/_/g, " ")}`, type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsActing(false);
    }
  }

  async function handleYcSave() {
    if (!ycLocalDecision) return;
    if (ycLocalDecision === "filed" && !ycRef.trim()) return;
    setYcSaving(true);
    try {
      const updated = await recordYellowCardDecisionAction(
        clinicId, incident.id, ycLocalDecision,
        ycLocalDecision === "filed" ? ycRef.trim() : undefined
      );
      setIncident(updated);
      setToast({
        message: ycLocalDecision === "filed"
          ? `Yellow Card filed — ref ${updated.yellow_card_reference}`
          : "Recorded: Yellow Card not applicable for this incident",
        type: "ok",
      });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to save decision", type: "err" });
    } finally {
      setYcSaving(false);
    }
  }

  async function handleNotifyCQC() {
    setIsActing(true);
    try {
      const updated = await notifyCQCAction(clinicId, incident.id);
      setIncident(updated);
      setToast({ message: "CQC notified", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsActing(false);
    }
  }

  async function handleSync() {
    setIsSyncing(true);
    try {
      const updated = await syncIncidentFromMondayAction(clinicId, incident.id);
      setIncident(updated);
      setToast({ message: "Synced from Monday.com", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Sync failed", type: "err" });
    } finally {
      setIsSyncing(false);
    }
  }

  return (
    <div className="relative">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg text-white",
          toast.type === "ok" ? "bg-ok" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* Top bar */}
      <div className="border-b border-bdr px-6 py-3 flex items-center gap-3 bg-surface">
        <Link href={`/${clinicId}/incidents`} className="text-t3 hover:text-t1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <QueuePositionIndicator
          kind="incidents"
          currentId={incident.id}
          clinicId={clinicId}
        />
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <AlertTriangle className="w-4 h-4 text-brand shrink-0" />
          <span className="font-mono text-[13px] font-bold text-t1">{incident.id}</span>
          <StatusBadge value={incident.status} kind="incident" />
        </div>
        {incident.sync_status !== "in_sync" && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing} className="h-7 text-[12px] gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
            Resync
          </Button>
        )}
      </div>

      {/* Creator chip */}
      <div className="px-6 py-2.5 border-b border-bdr bg-page-bg flex items-center gap-2.5">
        <UserAvatar name={creatorName} initials={creatorInitials} size={22} />
        <span className="text-[12px] text-t2">
          Logged by <span className="font-semibold text-t1">{creatorName}</span>
        </span>
        <span className="text-t3">·</span>
        <span className="flex items-center gap-1 text-[12px] text-t3">
          <Clock className="w-3 h-3" />
          {relativeTime(incident.created_at)}
        </span>
      </div>

      {/* Severity banner */}
      <div className={cn("mx-6 mt-4 border rounded-lg px-4 py-3", sevStyle.banner)}>
        <div className="flex items-start gap-3">
          <AlertTriangle className={cn("w-4 h-4 shrink-0 mt-0.5", sevStyle.text)} />
          <div>
            <p className={cn("text-[13px] font-semibold", sevStyle.text)}>
              {incident.severity.charAt(0).toUpperCase() + incident.severity.slice(1)} severity
              {" — "}{TYPE_LABELS[incident.incident_type] ?? incident.incident_type}
            </p>
            <p className="text-[12px] text-t2 mt-0.5">{triageText}</p>
          </div>
        </div>
      </div>

      {incident.sync_status !== "in_sync" && (
        <div className="mx-6 mt-3 flex items-start gap-3 bg-warn-bg border border-warn-bdr rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <p className="text-[13px] text-warn">
            Monday.com record is out of sync. Click Resync to pull the latest data.
          </p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div className="col-span-2 space-y-4">

          {/* Description */}
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Description</h3>
            <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{incident.description}</p>
          </div>

          {/* MHRA Yellow Card panel */}
          {showYellowCardPanel && (
            <div className={cn(
              "border rounded-lg p-4",
              incident.yellow_card_decision === "filed"
                ? "bg-ok-bg border-ok-bdr"
                : incident.yellow_card_decision === "not_applicable"
                ? "bg-surface border-bdr"
                : "bg-warn-bg border-warn-bdr"
            )}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <FileWarning className={cn(
                    "w-4 h-4",
                    incident.yellow_card_decision === "filed" ? "text-ok"
                    : incident.yellow_card_decision === "not_applicable" ? "text-t3"
                    : "text-warn"
                  )} />
                  <h3 className="text-[12px] font-bold text-t1">MHRA Yellow Card</h3>
                </div>
                <span className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded-full",
                  incident.yellow_card_decision === "filed"
                    ? "bg-ok/10 text-ok"
                    : incident.yellow_card_decision === "not_applicable"
                    ? "bg-t3/10 text-t2"
                    : "bg-warn/10 text-warn"
                )}>
                  {incident.yellow_card_decision === "filed"
                    ? "Filed"
                    : incident.yellow_card_decision === "not_applicable"
                    ? "Not applicable"
                    : "Decision required"}
                </span>
              </div>
              <p className="text-[12px] text-t2 mb-4">
                This incident is flagged for MHRA Yellow Card assessment due to its severity or type.
                The responsible prescriber must record a decision below.
              </p>
              {incident.yellow_card_decision === "filed" && (
                <div className="space-y-2.5">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-ok shrink-0" />
                    <span className="text-[12px] text-t2">Reference:</span>
                    <span className="font-mono text-[12px] text-t1 font-semibold">
                      {incident.yellow_card_reference ?? "—"}
                    </span>
                    <a
                      href="https://yellowcard.mhra.gov.uk/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto inline-flex items-center gap-1 text-[11px] text-brand hover:underline"
                    >
                      MHRA portal <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                  <p className="text-[11px] text-t3">
                    Filed by {CURRENT_USER.full_name}
                    {ycPrescriberNmc ? ` · ${ycPrescriberNmc}` : ""}
                  </p>
                </div>
              )}
              {incident.yellow_card_decision === "not_applicable" && (
                <p className="text-[12px] text-t2">
                  Confirmed not applicable. Clinical judgement: Yellow Card not required for this incident.
                </p>
              )}
              {incident.yellow_card_decision === null && (
                canManage ? (
                  <div className="space-y-3">
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name={`yc_decision_${incident.id}`}
                        value="filed"
                        checked={ycLocalDecision === "filed"}
                        onChange={() => setYcLocalDecision("filed")}
                        className="mt-0.5 accent-warn"
                      />
                      <div>
                        <p className="text-[12px] font-medium text-t1 group-hover:text-brand transition-colors">
                          Filed with MHRA
                        </p>
                        <p className="text-[11px] text-t2">A Yellow Card report has been submitted via the MHRA portal</p>
                      </div>
                    </label>
                    {ycLocalDecision === "filed" && (
                      <div className="ml-6 space-y-2">
                        <div>
                          <label className="block text-[11px] text-t3 mb-1">Yellow Card reference number</label>
                          <input
                            ref={ycRefInputRef}
                            type="text"
                            placeholder="e.g. MHRA-2026-012345"
                            value={ycRef}
                            onChange={(e) => setYcRef(e.target.value)}
                            className="w-full text-[12px] border border-bdr rounded-md px-2.5 py-1.5 bg-surface font-mono focus:outline-none focus:ring-1 focus:ring-brand"
                            autoFocus
                          />
                        </div>
                        <a
                          href="https://yellowcard.mhra.gov.uk/"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[12px] text-brand hover:underline"
                        >
                          Open MHRA Yellow Card portal <ExternalLink className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="radio"
                        name={`yc_decision_${incident.id}`}
                        value="not_applicable"
                        checked={ycLocalDecision === "not_applicable"}
                        onChange={() => setYcLocalDecision("not_applicable")}
                        className="mt-0.5 accent-warn"
                      />
                      <div>
                        <p className="text-[12px] font-medium text-t1 group-hover:text-brand transition-colors">
                          Not applicable
                        </p>
                        <p className="text-[11px] text-t2">
                          Clinical judgement: Yellow Card not required for this incident
                        </p>
                      </div>
                    </label>
                    <div className="flex items-center justify-between pt-2 border-t border-bdr/60 mt-1">
                      <p className="text-[11px] text-t3">
                        Recording as: {CURRENT_USER.full_name}
                        {ycPrescriberNmc ? ` · ${ycPrescriberNmc}` : ""}
                      </p>
                      <Button
                        size="sm"
                        onClick={handleYcSave}
                        disabled={ycSaving || !ycLocalDecision || (ycLocalDecision === "filed" && !ycRef.trim())}
                        className="h-7 text-[12px]"
                      >
                        {ycSaving ? "Saving..." : "Confirm decision"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-t2">Awaiting prescriber decision.</p>
                )
              )}
            </div>
          )}

          {/* CQC notification */}
          {incident.cqc_notification_required && (
            <div className={cn(
              "border rounded-lg p-4",
              incident.cqc_notified_at ? "bg-ok-bg border-ok-bdr" : "bg-err-bg border-err-bdr"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Building2 className={cn("w-4 h-4", incident.cqc_notified_at ? "text-ok" : "text-err")} />
                  <h3 className="text-[12px] font-bold text-t1">CQC Notification (Regulation 18)</h3>
                </div>
                <span className={cn("text-[11px] font-semibold", incident.cqc_notified_at ? "text-ok" : "text-err")}>
                  {incident.cqc_notified_at ? "Notified" : "Required"}
                </span>
              </div>
              {incident.cqc_notified_at ? (
                <p className="text-[12px] text-t2">CQC notified: {formatDateTime(incident.cqc_notified_at)}</p>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-[12px] text-t2">CQC must be notified under Regulation 18.</p>
                  {canManage && (
                    <Button size="sm" variant="outline" onClick={handleNotifyCQC} disabled={isActing} className="h-7 text-[12px]">
                      Notify CQC
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Resolution notes */}
          {incident.resolution_notes && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-2">Resolution notes</h3>
              <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{incident.resolution_notes}</p>
            </div>
          )}

          {/* Comments panel — all users */}
          <CommentsPanel
            incidentId={incident.id}
            clinicId={clinicId}
            initialComments={initialComments}
          />

          {/* Status control */}
          <StatusStepControl
            current={incident.status}
            isActing={isActing}
            onUpdate={handleStatusUpdate}
            legendShortcuts={legendShortcuts}
          />
        </div>

        {/* Right column */}
        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Incident details</h3>
            <dl className="space-y-2.5">
              {([
                ["Type",           TYPE_LABELS[incident.incident_type] ?? incident.incident_type],
                ["Triggered by",   TRIGGER_LABELS[incident.triggered_by] ?? incident.triggered_by],
                ["Reported",       formatDateTime(incident.reported_at)],
                ["Patient ID",     incident.patient_id ?? "—"],
                ["Order",          incident.order_id ?? "—"],
                ["Consultation",   incident.consultation_id ?? "—"],
                ["Escalated to",   incident.escalated_to_user_id
                  ? (USERS_REGISTRY[incident.escalated_to_user_id]?.full_name ?? incident.escalated_to_user_id)
                  : "—"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col text-[12px] gap-0.5">
                  <dt className="text-t3">{k}</dt>
                  <dd className="text-t1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className={cn(
            "border rounded-lg p-4",
            incident.sync_status === "in_sync" ? "bg-ok-bg border-ok-bdr" : "bg-warn-bg border-warn-bdr"
          )}>
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-1">Monday.com</h3>
            <p className={cn(
              "text-[12px] font-semibold mb-1",
              incident.sync_status === "in_sync" ? "text-ok" : "text-warn"
            )}>
              {incident.sync_status === "in_sync" ? "In sync" : "Out of sync"}
            </p>
            <p className="text-[11px] text-t3">Board: {incident.monday_board_id}</p>
            {incident.monday_item_id && (
              <p className="text-[11px] text-t3">Item: {incident.monday_item_id}</p>
            )}
            {isSharedBoard && (
              <p className="text-[10px] text-warn mt-1.5 font-medium">DEC-29: VSC and FeelTru share this board</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
