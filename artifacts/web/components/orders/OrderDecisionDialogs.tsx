"use client";

import { CheckCircle, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

export type Modal = "approve" | "decline" | "query" | null;

export interface ToastState {
  message: string;
  type: "ok" | "err";
}

interface Props {
  orderId: string;
  patientName: string;
  modal: Modal;
  setModal: (m: Modal) => void;
  rationale: string;
  setRationale: (r: string) => void;
  isSubmitting: boolean;
  handleDecide: (decision: "approved" | "declined" | "queried", r: string) => void;
  toast: ToastState | null;
}

export function OrderDecisionDialogs({
  orderId,
  patientName,
  modal,
  setModal,
  rationale,
  setRationale,
  isSubmitting,
  handleDecide,
  toast,
}: Props) {
  function closeAndReset() {
    setModal(null);
    setRationale("");
  }

  return (
    <>
      {/* ── Approve dialog ──────────────────────────────────────────────── */}
      <Dialog open={modal === "approve"} onOpenChange={(o) => { if (!o) closeAndReset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Confirm Approval</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              You are about to approve order <strong className="font-mono">{orderId}</strong> for{" "}
              <strong>{patientName}</strong>. This will trigger prescription generation.
            </p>
            <Textarea
              placeholder="Briefly note your clinical reasoning… (required)"
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={4}
              className="text-[13px]"
            />
            <p className="text-[11px] text-t3">
              Your rationale is recorded in the audit trail against your prescriber ID.
            </p>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" size="sm" onClick={closeAndReset} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={() => handleDecide("approved", rationale)}
              disabled={isSubmitting || rationale.trim().length < 10}
              className="bg-ok hover:bg-ok/90 text-white"
            >
              {isSubmitting ? "Approving…" : "Confirm Approve"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Decline dialog ──────────────────────────────────────────────── */}
      <Dialog open={modal === "decline"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Decline Order</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Provide a clinical rationale for declining{" "}
              <strong className="font-mono">{orderId}</strong>. This will be recorded in the patient record.
            </p>
            <Textarea
              placeholder="Enter decline rationale…"
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
              onClick={() => handleDecide("declined", rationale)}
              disabled={isSubmitting || !rationale.trim()}
              variant="destructive"
            >
              {isSubmitting ? "Declining…" : "Confirm Decline"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Query dialog ────────────────────────────────────────────────── */}
      <Dialog open={modal === "query"} onOpenChange={(o) => !o && setModal(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Raise Query</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-[13px] text-t2">
              Describe the query for{" "}
              <strong className="font-mono">{orderId}</strong>. The patient will be contacted to provide clarification.
            </p>
            <Textarea
              placeholder="Enter query details…"
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
              onClick={() => handleDecide("queried", rationale)}
              disabled={isSubmitting || !rationale.trim()}
              className="bg-info hover:bg-info/90 text-white"
            >
              {isSubmitting ? "Raising query…" : "Raise Query"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Toast ───────────────────────────────────────────────────────── */}
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
    </>
  );
}
