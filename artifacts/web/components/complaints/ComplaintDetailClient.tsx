"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, RefreshCw, ExternalLink, CheckCircle2, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  syncComplaintFromMonday,
  updateComplaintStatus,
  NOW,
} from "@/lib/api/mock";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import { useQueueNavigation } from "@/lib/queueNavigation";
import type { Complaint, ComplaintStatus, Clinic, ClinicId } from "@/types";

const CLOSED_STATUSES: ComplaintStatus[] = ["resolved", "closed"];
const isClosed = (s: ComplaintStatus) => CLOSED_STATUSES.includes(s);

// DEC-37: Monday remains the source of truth for complaints. The detail page
// is still a read-only mirror for investigation, lesson learned and resolution
// content (those continue to be edited in Monday).
// V1.2 addition: a minimal in-app Resolve / Reopen control wraps the existing
// Monday-first updateComplaintStatus helper (which writes to Monday before
// touching local state) so the sidebar Complaints badge can update live
// without a full reload. No Acknowledge button, no investigation textarea.

interface Props {
  initialComplaint: Complaint;
  clinic: Clinic;
  clinicId: ClinicId;
}

interface Toast { message: string; type: "ok" | "err" }

// BLD-9.1: severity vocab migrated from low/medium/high → informal/formal/serious
const SEV_COLORS: Record<string, string> = {
  informal: "bg-ok-bg text-ok border border-ok-bdr",
  formal:   "bg-warn-bg text-warn border border-warn-bdr",
  serious:  "bg-err-bg text-err border border-err-bdr",
};

const MONDAY_BASE = "https://primedpharmacy-company.monday.com/boards";

// Derive SLA due dates at render from clinic config — never hardcoded (BLD-9.2/9.3).
// SLAs: clinic_config.default_slas.complaint_ack_wd / complaint_response_wd per PV §8.
function addWorkingDays(startIso: string, wdCount: number): Date {
  const d = new Date(startIso);
  let added = 0;
  while (added < wdCount) {
    d.setDate(d.getDate() + 1);
    const dow = d.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return d;
}

function SLACard({ label, dueAt, done }: { label: string; dueAt: Date; done: boolean }) {
  const now = new Date(NOW);
  const overdue = !done && now > dueAt;
  return (
    <div className={cn(
      "border rounded-lg px-4 py-3",
      done ? "bg-ok-bg border-ok-bdr" : overdue ? "bg-err-bg border-err-bdr" : "bg-surface border-bdr"
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-bold text-t3">{label}</span>
        {done ? (
          <span className="text-[11px] text-ok font-semibold">Done</span>
        ) : overdue ? (
          <span className="text-[11px] text-err font-semibold">Overdue</span>
        ) : (
          <span className="text-[11px] text-warn font-semibold">Pending</span>
        )}
      </div>
      <p className="text-[12px] text-t1 font-medium">Due: {formatDate(dueAt.toISOString())}</p>
    </div>
  );
}

export function ComplaintDetailClient({ initialComplaint, clinic, clinicId }: Props) {
  useQueueNavigation({ kind: "complaints", currentId: initialComplaint.id, clinicId });
  const [complaint, setComplaint] = useState<Complaint>(initialComplaint);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  // BLD-9.3: SLA values from clinic config — never hardcoded
  const ackWd  = clinic.config.default_slas.complaint_ack_wd;
  const resWd  = clinic.config.default_slas.complaint_response_wd;
  const ackDueAt = addWorkingDays(complaint.received_at, ackWd);
  const resDueAt = addWorkingDays(complaint.received_at, resWd);

  const mondayUrl = complaint.monday_item_id
    ? `${MONDAY_BASE}/${complaint.monday_board_id}/pulses/${complaint.monday_item_id}`
    : null;

  async function handleSync() {
    setIsSyncing(true);
    try {
      const updated = await syncComplaintFromMonday(clinicId, complaint.id);
      setComplaint(updated);
      setToast({ message: "Synced from Monday.com", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Sync failed", type: "err" });
    } finally {
      setIsSyncing(false);
    }
  }

  // V1.2 in-app status mutation (Monday-first via updateComplaintStatus).
  // Keeps the sidebar Complaints badge in sync without a full reload.
  async function handleStatusChange(next: ComplaintStatus) {
    if (isUpdating || next === complaint.status) return;
    setIsUpdating(true);
    try {
      const wasOpen = !isClosed(complaint.status);
      const updated = await updateComplaintStatus(clinicId, complaint.id, next);
      setComplaint(updated);
      const nowOpen = !isClosed(updated.status);
      if (wasOpen !== nowOpen) {
        dispatchQueueCountChange({ queue: "complaints", delta: nowOpen ? 1 : -1 });
      }
      setToast({
        message: nowOpen ? "Complaint reopened" : `Marked as ${updated.status}`,
        type: "ok",
      });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Update failed", type: "err" });
    } finally {
      setIsUpdating(false);
    }
  }

  const complaintClosed = isClosed(complaint.status);

  return (
    <div className="relative">
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg text-white",
          toast.type === "ok" ? "bg-ok" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="border-b border-bdr px-6 py-3 flex items-center gap-3 bg-surface">
        <Link href={`/${clinicId}/complaints`} className="text-t3 hover:text-t1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <Megaphone className="w-4 h-4 text-brand shrink-0" />
          <span className="font-mono text-[13px] font-bold text-t1">{complaint.id}</span>
          <StatusBadge value={complaint.status} kind="complaint" />
          <span className={cn(
            "inline-flex items-center gap-1 text-[11px] font-bold px-2 py-px rounded-full whitespace-nowrap ml-1",
            SEV_COLORS[complaint.severity]
          )}>
            <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70 shrink-0" />
            {complaint.severity.charAt(0).toUpperCase() + complaint.severity.slice(1)}
          </span>
        </div>
        {/* Resync pulls latest data FROM Monday — acceptable read op per Decision E.1 */}
        {complaint.monday_item_id && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing} className="h-7 text-[12px] gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
            Resync
          </Button>
        )}
        {/* V1.2 in-app status mutation — Monday-first write, sidebar badge stays live */}
        {complaintClosed ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange("investigating")}
            disabled={isUpdating}
            className="h-7 text-[12px] gap-1.5"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Reopen
          </Button>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleStatusChange("resolved")}
            disabled={isUpdating}
            className="h-7 text-[12px] gap-1.5"
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            Resolve
          </Button>
        )}
        {/* Primary action — Open in Monday (BLD-9.3) */}
        {mondayUrl ? (
          <a
            href={mondayUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 h-7 px-3 text-[12px] font-medium rounded-md bg-brand text-white hover:bg-brand-dark transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Monday
          </a>
        ) : (
          <Button size="sm" disabled className="h-7 text-[12px] gap-1.5 opacity-50" title="Pending Monday sync">
            <ExternalLink className="w-3.5 h-3.5" />
            Open in Monday
          </Button>
        )}
      </div>

      {/* DEC-37 source-of-truth note (BLD-9.3) */}
      <div className="mx-6 mt-4 flex items-start gap-3 bg-info-bg border border-info-bdr rounded-lg px-4 py-3">
        <Megaphone className="w-4 h-4 text-info shrink-0 mt-0.5" />
        <p className="text-[12px] text-t2 leading-relaxed">
          <span className="font-semibold text-t1">Monday.com is the source of truth for complaints (DEC-37).</span>{" "}
          Investigation, lesson learned, and resolution tracking happen in Monday. This is a read-only summary.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-1">Category</h3>
            <p className="text-[15px] font-semibold text-t1 capitalize">{complaint.category}</p>
          </div>
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Complaint</h3>
            <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{complaint.body}</p>
          </div>
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">
              SLA tracking (ack {ackWd}wd · response {resWd}wd)
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <SLACard
                label={`Acknowledgement (${ackWd} working days)`}
                dueAt={ackDueAt}
                done={Boolean(complaint.acknowledged_at)}
              />
              <SLACard
                label={`Resolution (${resWd} working days)`}
                dueAt={resDueAt}
                done={Boolean(complaint.resolved_at)}
              />
            </div>
          </div>
          {complaint.resolution && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Resolution / Lesson Learned</h3>
              <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{complaint.resolution}</p>
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Complainant</h3>
            <dl className="space-y-2">
              {([
                ["Name", complaint.complainant_name],
                ["Email", complaint.complainant_email ?? "—"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col text-[12px] gap-0.5">
                  <dt className="text-t3 capitalize">{k}</dt>
                  <dd className="text-t1 font-medium break-all">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Details</h3>
            <dl className="space-y-2">
              {([
                ["Received", formatDate(complaint.received_at)],
                ["Acknowledged", complaint.acknowledged_at ? formatDate(complaint.acknowledged_at) : "Pending"],
                ["Resolved", complaint.resolved_at ? formatDate(complaint.resolved_at) : "Pending"],
                ["Monday board", complaint.monday_board_id],
                ["Monday item", complaint.monday_item_id ?? "Not synced"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col text-[12px] gap-0.5">
                  <dt className="text-t3 capitalize">{k}</dt>
                  <dd className="text-t1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {complaint.regulator_escalation && (
            <div className="bg-err-bg border border-err-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-1">Regulator escalation</h3>
              <p className="text-[13px] font-bold text-err uppercase">{complaint.regulator_escalation}</p>
              {complaint.policy_register_link && (
                <a
                  href={complaint.policy_register_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-brand underline mt-1 inline-block"
                >
                  Policy register
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
