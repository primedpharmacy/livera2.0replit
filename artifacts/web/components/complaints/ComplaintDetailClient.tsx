"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, Megaphone, RefreshCw, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  acknowledgeComplaint,
  updateComplaintStatus,
  syncComplaintFromMonday,
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

// BLD-9.1: severity vocab migrated from low/medium/high → informal/formal/serious
const SEV_COLORS: Record<string, string> = {
  informal: "bg-ok-bg text-ok border border-ok-bdr",
  formal:   "bg-warn-bg text-warn border border-warn-bdr",
  serious:  "bg-err-bg text-err border border-err-bdr",
};

// Derive SLA due dates at render time from received_at.
// SLAs: 3 working days (ack) / 20 working days (resolution) per PV §8 + clinic_config.default_slas.
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
  const [complaint, setComplaint] = useState<Complaint>(initialComplaint);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isActing, setIsActing] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const canManage = can(CURRENT_USER, "write", "complaints");
  const isTerminal = complaint.status === "resolved" || complaint.status === "closed";

  // SLA due dates derived at render from received_at (not stored on record — BLD-9.1)
  const ackDueAt = addWorkingDays(complaint.received_at, 3);
  const resDueAt = addWorkingDays(complaint.received_at, 20);

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
        {complaint.monday_item_id && (
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
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">SLA tracking</h3>
            <div className="grid grid-cols-2 gap-3">
              <SLACard
                label="Acknowledgement (3 working days)"
                dueAt={ackDueAt}
                done={Boolean(complaint.acknowledged_at)}
              />
              <SLACard
                label="Resolution (20 working days)"
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
