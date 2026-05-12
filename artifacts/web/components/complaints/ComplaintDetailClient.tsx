"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, RefreshCw, CheckCircle, AlertCircle, UserCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  acknowledgeComplaint,
  updateComplaintStatus,
  syncComplaintFromMonday,
  reassignComplaint,
  CURRENT_USER,
  NOW,
} from "@/lib/api/mock";
import { can } from "@/lib/permissions";
import type { Complaint, Clinic, ClinicId } from "@/types";

interface Props {
  initialComplaint: Complaint;
  clinic: Clinic;
  clinicId: ClinicId;
}

interface Toast { message: string; type: "ok" | "err" }

const SEV_COLORS: Record<string, string> = {
  low: "bg-ok-bg text-ok border border-ok-bdr",
  medium: "bg-warn-bg text-warn border border-warn-bdr",
  high: "bg-err-bg text-err border border-err-bdr",
};

const CQC_COLORS: Record<string, string> = {
  Safe: "bg-ok-bg text-ok border border-ok-bdr",
  Effective: "bg-info-bg text-info border border-info-bdr",
  Caring: "bg-info-bg text-info border border-info-bdr",
  Responsive: "bg-warn-bg text-warn border border-warn-bdr",
  "Well-led": "bg-err-bg text-err border border-err-bdr",
};

const CLINIC_USERS = [
  { id: "user_qadir",   label: "Qadir Hussain (Owner)" },
  { id: "user_priya",   label: "Priya Sharma (RM)" },
  { id: "user_alex",    label: "Alex Chen (Prescriber)" },
  { id: "user_jessica", label: "Jessica Moore (Admin)" },
];

function SLACard({ label, dueAt, done }: { label: string; dueAt: string; done: boolean }) {
  const overdue = !done && new Date(NOW) > new Date(dueAt);
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
      <p className="text-[12px] text-t1 font-medium">Due: {formatDate(dueAt)}</p>
    </div>
  );
}

export function ComplaintDetailClient({ initialComplaint, clinic, clinicId }: Props) {
  const [complaint, setComplaint] = useState<Complaint>(initialComplaint);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [reassignUserId, setReassignUserId] = useState(complaint.assigned_to_user_id ?? "");
  const [isReassigning, setIsReassigning] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const canManage = can(CURRENT_USER, "write", "complaints");
  const isTerminal = complaint.status === "resolved" || complaint.status === "closed";

  async function handleAcknowledge() {
    setIsActing(true);
    try {
      const updated = await acknowledgeComplaint(clinicId, complaint.id);
      setComplaint(updated);
      setToast({ message: "Complaint acknowledged", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsActing(false);
    }
  }

  async function handleStatusUpdate(status: Complaint["status"]) {
    setIsActing(true);
    try {
      const updated = await updateComplaintStatus(clinicId, complaint.id, status);
      setComplaint(updated);
      setToast({ message: `Status updated to ${status}`, type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsActing(false);
    }
  }

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

  async function handleReassign() {
    if (!reassignUserId || reassignUserId === complaint.assigned_to_user_id) return;
    setIsReassigning(true);
    try {
      const updated = await reassignComplaint(clinicId, complaint.id, reassignUserId);
      setComplaint(updated);
      setToast({ message: "Complaint reassigned", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed", type: "err" });
    } finally {
      setIsReassigning(false);
    }
  }

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
        {complaint.sync_status !== "in_sync" && (
          <Button size="sm" variant="outline" onClick={handleSync} disabled={isSyncing} className="h-7 text-[12px] gap-1.5">
            <RefreshCw className={cn("w-3.5 h-3.5", isSyncing && "animate-spin")} />
            Resync
          </Button>
        )}
        {canManage && complaint.status === "received" && (
          <Button size="sm" onClick={handleAcknowledge} disabled={isActing} className="h-7 text-[12px] gap-1.5">
            <CheckCircle className="w-3.5 h-3.5" />
            {isActing ? "Saving…" : "Acknowledge"}
          </Button>
        )}
      </div>

      {complaint.sync_status !== "in_sync" && (
        <div className="mx-6 mt-4 flex items-start gap-3 bg-warn-bg border border-warn-bdr rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-warn">Monday.com out of sync</p>
            <p className="text-[12px] text-t2 mt-0.5">
              This record may have been updated in Monday.com. Click Resync to pull the latest data.
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-1">Subject</h3>
            <p className="text-[15px] font-semibold text-t1">{complaint.subject}</p>
          </div>
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Description</h3>
            <p className="text-[13px] text-t1 leading-relaxed whitespace-pre-wrap">{complaint.description}</p>
          </div>
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">SLA tracking</h3>
            <div className="grid grid-cols-2 gap-3">
              <SLACard
                label="Acknowledgement (3 working days)"
                dueAt={complaint.acknowledgement_due_at}
                done={Boolean(complaint.acknowledgement_sent_at)}
              />
              <SLACard
                label="Resolution (20 working days)"
                dueAt={complaint.resolution_due_at}
                done={complaint.status === "resolved" || complaint.status === "closed"}
              />
            </div>
          </div>
          {canManage && !isTerminal && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Update status</h3>
              <div className="flex gap-2 flex-wrap">
                {(["investigating", "resolved", "closed"] as const).map((s) => (
                  <Button
                    key={s}
                    size="sm"
                    variant="outline"
                    onClick={() => handleStatusUpdate(s)}
                    disabled={isActing || complaint.status === s}
                    className="h-7 text-[12px] capitalize"
                  >
                    Mark {s}
                  </Button>
                ))}
              </div>
            </div>
          )}
          {canManage && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Reassign</h3>
              <div className="flex items-center gap-2">
                <select
                  value={reassignUserId}
                  onChange={(e) => setReassignUserId(e.target.value)}
                  className="flex-1 text-[13px] bg-page-bg border border-bdr rounded-md px-3 py-1.5 text-t1 focus:outline-none focus:ring-1 focus:ring-brand"
                >
                  <option value="">— Select assignee —</option>
                  {CLINIC_USERS.map((u) => (
                    <option key={u.id} value={u.id}>{u.label}</option>
                  ))}
                </select>
                <Button
                  size="sm"
                  onClick={handleReassign}
                  disabled={isReassigning || !reassignUserId || reassignUserId === complaint.assigned_to_user_id}
                  className="h-8 text-[12px] gap-1.5 shrink-0"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  {isReassigning ? "Saving…" : "Reassign"}
                </Button>
              </div>
              {complaint.assigned_to_user_id && (
                <p className="text-[11px] text-t3 mt-1.5">
                  Currently: <span className="text-t2 font-medium">{
                    CLINIC_USERS.find((u) => u.id === complaint.assigned_to_user_id)?.label
                    ?? complaint.assigned_to_user_id
                  }</span>
                </p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Details</h3>
            <dl className="space-y-2">
              {([
                ["Source", complaint.source.replace("_", " ")],
                ["Received", formatDate(complaint.received_at)],
                ["Monday board", complaint.monday_board_id],
                ["Assigned to", complaint.assigned_to_user_id ?? "Unassigned"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex flex-col text-[12px] gap-0.5">
                  <dt className="text-t3 capitalize">{k}</dt>
                  <dd className="text-t1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {complaint.cqc_quality_statements.length > 0 && (
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">CQC quality statements</h3>
              <div className="flex flex-wrap gap-1.5">
                {complaint.cqc_quality_statements.map((qs) => (
                  <span key={qs} className={cn(
                    "text-[11px] font-bold px-2 py-px rounded-full border",
                    CQC_COLORS[qs] ?? "bg-slate-100 text-slate-500 border-slate-200"
                  )}>
                    {qs}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className={cn(
            "border rounded-lg p-4",
            complaint.sync_status === "in_sync" ? "bg-ok-bg border-ok-bdr" : "bg-warn-bg border-warn-bdr"
          )}>
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-1">Monday sync</h3>
            <p className={cn(
              "text-[12px] font-semibold",
              complaint.sync_status === "in_sync" ? "text-ok" : "text-warn"
            )}>
              {complaint.sync_status === "in_sync" ? "In sync" : complaint.sync_status === "out_of_sync" ? "Out of sync" : "Sync error"}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
