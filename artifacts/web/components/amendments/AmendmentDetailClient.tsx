"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import {
  RefreshCw, Package, User, ArrowLeft, ChevronRight,
  CheckCircle, XCircle, AlertTriangle, Clock,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime, formatRelativeTime, formatAge } from "@/lib/format";
import { decideAmendment } from "@/lib/api/mock";
import type { Amendment, Order, Patient } from "@/types";

const TYPE_LABELS: Record<Amendment["type"], string> = {
  dose_change:     "Dose Change",
  cancellation:    "Cancellation",
  refund:          "Refund",
  reschedule:      "Reschedule",
  address_change:  "Address Change",
  dose_escalation: "Dose Escalation",
};

const ACTOR_LABELS: Record<string, string> = {
  patient:   "Patient",
  admin:     "Admin",
  clinician: "Clinician",
  system:    "System",
};

interface Toast {
  message: string;
  type: "ok" | "err";
}

interface AmendmentDetailClientProps {
  initialAmendment: Amendment;
  order: Order;
  patient: Patient;
  clinicId: string;
}

type Modal = "approve" | "reject" | null;

export function AmendmentDetailClient({
  initialAmendment,
  order,
  patient,
  clinicId,
}: AmendmentDetailClientProps) {
  const [amendment, setAmendment] = useState<Amendment>(initialAmendment);
  const [modal, setModal]         = useState<Modal>(null);
  const [rationale, setRationale] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toast, setToast]         = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  async function handleDecide(decision: "approved" | "rejected", r: string) {
    setIsSubmitting(true);
    try {
      const updated = await decideAmendment(clinicId as any, amendment.id, decision, r);
      setAmendment(updated);
      setModal(null);
      setRationale("");
      setToast({
        message: decision === "approved"
          ? "Amendment approved successfully."
          : "Amendment rejected.",
        type: decision === "approved" ? "ok" : "err",
      });
    } catch (err) {
      setToast({
        message: err instanceof Error ? err.message : "Action failed. Please retry.",
        type: "err",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  const canDecide  = amendment.status === "requested" || amendment.status === "reviewing";
  const isDecided  = amendment.status === "approved" || amendment.status === "rejected" || amendment.status === "applied";
  const d          = patient.demographic;
  const age        = formatAge(d.dob);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-4 border-b border-bdr bg-surface shrink-0">
        <nav className="flex items-center gap-1.5 text-[12px] text-t3 mb-3">
          <Link href={`/${clinicId}/amendments`} className="flex items-center gap-1 hover:text-brand transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Amendments
          </Link>
          <ChevronRight className="w-3 h-3" />
          <span className="font-mono text-t1 font-medium">{amendment.id}</span>
        </nav>

        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-light flex items-center justify-center shrink-0">
              <RefreshCw className="w-5 h-5 text-brand" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-base font-bold text-t1 font-mono">{amendment.id}</h1>
                <StatusBadge value={amendment.status} kind="amendment" />
                <span className="text-[11px] font-semibold px-2 py-px rounded border bg-page-bg text-t2 border-bdr">
                  {TYPE_LABELS[amendment.type]}
                </span>
              </div>
              <p className="text-[12px] text-t2 mt-0.5">
                Order <span className="font-mono font-semibold">{amendment.order_id}</span> ·
                Requested by {ACTOR_LABELS[amendment.requested_by.actor_type]} ·{" "}
                {formatRelativeTime(amendment.requested_at)}
              </p>
            </div>
          </div>

          {canDecide && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setModal("reject")}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-err border border-err-bdr bg-err-bg hover:bg-err hover:text-white rounded-md transition-colors"
              >
                <XCircle className="w-4 h-4" />
                Reject
              </button>
              <button
                onClick={() => setModal("approve")}
                className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-ok hover:bg-ok/90 rounded-md transition-colors shadow-sm"
              >
                <CheckCircle className="w-4 h-4" />
                Approve
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-5 grid grid-cols-5 gap-4 items-start">

          {/* Left — 2/5: order + patient summary */}
          <div className="col-span-2 space-y-4 sticky top-5">
            {/* Order summary */}
            <DCard icon={Package} title="Order">
              <Row label="Order ID"   value={order.id} mono />
              <Row label="Medication" value={`${order.product.medication} ${order.product.dose}`} />
              <Row label="Plan"       value={order.product.plan} />
              <Row label="Status"     value={order.status.replace(/_/g, " ")} />
              <Link
                href={`/${clinicId}/orders/${order.id}`}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 text-[12px] font-semibold text-brand bg-brand-light hover:bg-brand hover:text-white rounded-md transition-colors"
              >
                View order detail
              </Link>
            </DCard>

            {/* Patient summary */}
            <DCard icon={User} title="Patient">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-mid to-brand flex items-center justify-center text-white text-sm font-bold shrink-0">
                  {d.full_name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="text-[13px] font-semibold text-t1">{d.full_name}</div>
                  <div className="text-[11px] text-t3 font-mono">{patient.id}</div>
                </div>
              </div>
              <Row label="Age / sex" value={`${age} yrs · ${d.sex_at_birth}`} />
              <Link
                href={`/${clinicId}/patients/${patient.id}`}
                className="mt-3 flex items-center justify-center gap-1.5 w-full py-1.5 text-[12px] font-semibold text-brand bg-brand-light hover:bg-brand hover:text-white rounded-md transition-colors"
              >
                View full profile
              </Link>
            </DCard>
          </div>

          {/* Right — 3/5: amendment detail + decision + actions */}
          <div className="col-span-3 space-y-4">
            {/* Amendment details */}
            <DCard icon={RefreshCw} title="Amendment Details">
              <Row label="Amendment ID" value={amendment.id} mono />
              <Row label="Type"         value={TYPE_LABELS[amendment.type]} />
              <Row label="Requested by" value={`${ACTOR_LABELS[amendment.requested_by.actor_type]} (${amendment.requested_by.actor_id})`} />
              <Row label="Requested at" value={formatDateTime(amendment.requested_at)} />

              {/* details Q&A pairs */}
              {Object.keys(amendment.details).length > 0 && (
                <div className="mt-3 pt-3 border-t border-bdr space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Request details</p>
                  {Object.entries(amendment.details).map(([key, val]) => (
                    <div key={key} className="flex items-start justify-between gap-4 py-1">
                      <span className="text-[12px] text-t3 shrink-0 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                      <span className="text-[12px] text-t1 font-medium text-right">
                        {typeof val === "number" && key.includes("gbp")
                          ? `£${val.toFixed(2)}`
                          : String(val)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </DCard>

            {/* Decision card — shown when decided */}
            {isDecided && (
              <DCard icon={CheckCircle} title="Decision">
                <Row label="Decision"    value={amendment.status.charAt(0).toUpperCase() + amendment.status.slice(1)} />
                <Row label="Decided by"  value={amendment.decided_by ?? "—"} />
                <Row label="Decided at"  value={amendment.decided_at ? formatDateTime(amendment.decided_at) : "—"} />
                {amendment.decision_rationale && (
                  <div className="mt-3 pt-3 border-t border-bdr">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-t3 mb-2">Rationale</p>
                    <p className="text-[12px] text-t1 bg-page-bg border border-bdr rounded px-3 py-2 leading-relaxed">
                      {amendment.decision_rationale}
                    </p>
                  </div>
                )}
              </DCard>
            )}

            {/* Pending state info */}
            {!isDecided && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-info-bg border border-info-bdr">
                <Clock className="w-4 h-4 text-info shrink-0 mt-0.5" />
                <div>
                  <p className="text-[13px] font-semibold text-info">Awaiting decision</p>
                  <p className="text-[11px] text-t2 mt-0.5">
                    Use the Approve or Reject buttons above to record a clinical decision on this amendment.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve dialog */}
      <Dialog open={modal === "approve"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">Approve Amendment</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-t2">
            You are approving <strong className="font-mono">{amendment.id}</strong> ({TYPE_LABELS[amendment.type]}) for order{" "}
            <strong className="font-mono">{amendment.order_id}</strong>.
          </p>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleDecide("approved", "Amendment reviewed and approved.")}
              disabled={isSubmitting}
              className="bg-ok hover:bg-ok/90 text-white"
            >
              {isSubmitting ? "Approving…" : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject dialog */}
      <Dialog open={modal === "reject"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Reject Amendment</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Provide a rationale for rejecting <strong className="font-mono">{amendment.id}</strong>.
            </p>
            <Textarea
              placeholder="Enter rejection rationale…"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              className="text-[13px]"
            />
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={() => setModal(null)} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleDecide("rejected", rationale)}
              disabled={isSubmitting || !rationale.trim()}
              variant="destructive"
            >
              {isSubmitting ? "Rejecting…" : "Confirm Reject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 px-4 py-3 rounded-lg shadow-lg border text-[13px] font-medium transition-all ${
          toast.type === "ok"
            ? "bg-ok-bg border-ok-bdr text-ok"
            : "bg-err-bg border-err-bdr text-err"
        }`}>
          {toast.type === "ok"
            ? <CheckCircle className="w-4 h-4 shrink-0" />
            : <AlertTriangle className="w-4 h-4 shrink-0" />}
          {toast.message}
        </div>
      )}
    </div>
  );
}

function DCard({ icon: Icon, title, children }: { icon: typeof Package; title: string; children: React.ReactNode }) {
  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <Icon className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="px-4 py-3 space-y-2">{children}</div>
    </div>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-0.5">
      <span className="text-[12px] text-t3 shrink-0">{label}</span>
      <span className={`text-[12px] text-t1 text-right ${mono ? "font-mono" : "font-medium"}`}>
        {value || "—"}
      </span>
    </div>
  );
}
