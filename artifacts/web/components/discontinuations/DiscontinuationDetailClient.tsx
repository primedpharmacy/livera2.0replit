"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowLeft, XCircle, CheckCircle2, Phone, Mail, AlertTriangle,
  User, Package, FileText, Clock, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  markGpNotified,
  logFollowUpCall,
  closeDiscontinuation,
  updateDiscontinuationNotes,
  NOW,
} from "@/lib/api/mock";
import type { DiscontinuationProtocol, DiscontinuationReason, DiscontinuationStatus, Clinic, ClinicId, Patient } from "@/types";

// ---------------------------------------------------------------------------
// Vocab
// ---------------------------------------------------------------------------
const REASON_LABELS: Record<DiscontinuationReason, { label: string; icon: React.ElementType; colour: string }> = {
  patient_request:    { label: "Patient request",    icon: User,          colour: "text-info border-info-bdr bg-info-bg" },
  clinical_decision:  { label: "Clinical decision",  icon: FileText,      colour: "text-warn border-warn-bdr bg-warn-bg" },
  non_compliance:     { label: "Non-compliance",      icon: AlertTriangle, colour: "text-warn border-warn-bdr bg-warn-bg" },
  adverse_event:      { label: "Adverse event",       icon: AlertTriangle, colour: "text-err border-err-bdr bg-err-bg" },
  lost_to_follow_up:  { label: "Lost to follow-up",  icon: Clock,         colour: "text-slate-600 border-slate-200 bg-slate-50" },
};

const STATUS_CONFIG: Record<DiscontinuationStatus, { label: string; bg: string; text: string; border: string }> = {
  initiated:         { label: "Initiated",          bg: "bg-info-bg",  text: "text-info",       border: "border-info-bdr" },
  gp_notified:       { label: "GP notified",        bg: "bg-warn-bg",  text: "text-warn",       border: "border-warn-bdr" },
  follow_up_pending: { label: "Follow-up pending",  bg: "bg-err-bg",   text: "text-err",        border: "border-err-bdr" },
  closed:            { label: "Closed",             bg: "bg-slate-50", text: "text-slate-500",  border: "border-slate-200" },
};

// ---------------------------------------------------------------------------
// SLA helper
// ---------------------------------------------------------------------------
function addDays(iso: string, days: number): Date {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return d;
}

interface SLACardProps {
  label: string;
  dueAt: Date;
  doneAt: string | null;
  doneLabel?: string;
}
function SLACard({ label, dueAt, doneAt, doneLabel }: SLACardProps) {
  const now = new Date(NOW);
  const overdue = !doneAt && now > dueAt;
  return (
    <div className={cn(
      "border rounded-xl px-4 py-3",
      doneAt ? "bg-ok-bg border-ok-bdr" : overdue ? "bg-err-bg border-err-bdr" : "bg-surface border-bdr",
    )}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] uppercase tracking-wider font-bold text-t3">{label}</span>
        {doneAt ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-ok" />
        ) : overdue ? (
          <AlertTriangle className="w-3.5 h-3.5 text-err" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-warn" />
        )}
      </div>
      {doneAt ? (
        <p className="text-[12px] text-ok font-semibold">{doneLabel ?? "Completed"} {formatDate(doneAt)}</p>
      ) : (
        <>
          <p className="text-[12px] font-semibold text-t1">Due {formatDate(dueAt.toISOString())}</p>
          {overdue && <p className="text-[11px] text-err font-semibold mt-0.5">Overdue</p>}
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Timeline event
// ---------------------------------------------------------------------------
interface TimelineEvent {
  at: string;
  label: string;
  icon: React.ElementType;
  colour: string;
}
function buildTimeline(d: DiscontinuationProtocol): TimelineEvent[] {
  const events: TimelineEvent[] = [
    { at: d.created_at, label: "Protocol initiated", icon: XCircle, colour: "text-info" },
  ];
  if (d.gp_notified_at)    events.push({ at: d.gp_notified_at,    label: "GP notified — letter dispatched", icon: Mail,          colour: "text-warn" });
  if (d.follow_up_call_at) events.push({ at: d.follow_up_call_at, label: "Follow-up call completed",        icon: Phone,         colour: "text-ok" });
  if (d.closed_at)         events.push({ at: d.closed_at,         label: "Protocol closed",                icon: CheckCircle2,  colour: "text-slate-500" });
  return events.sort((a, b) => b.at.localeCompare(a.at));
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
interface Toast { message: string; type: "ok" | "err" }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
interface Props {
  initialDisc: DiscontinuationProtocol;
  patient: Patient | null;
  clinic: Clinic;
  clinicId: ClinicId;
}

export function DiscontinuationDetailClient({ initialDisc, patient, clinic, clinicId }: Props) {
  const [disc, setDisc]     = useState<DiscontinuationProtocol>(initialDisc);
  const [notes, setNotes]   = useState(initialDisc.notes);
  const [saving, setSaving] = useState(false);
  const [busy, setBusy]     = useState<string | null>(null);
  const [toast, setToast]   = useState<Toast | null>(null);

  const reason  = REASON_LABELS[disc.reason];
  const status  = STATUS_CONFIG[disc.status];
  const ReasonIcon = reason.icon;

  const gpSlaDue      = addDays(disc.created_at, 2);          // 48-hour GP notification SLA
  const followUpSlaDue = addDays(disc.created_at, disc.sla_follow_up_days);

  const patientName = patient?.demographic.full_name ?? disc.patient_id;

  function flash(message: string, type: "ok" | "err") {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  }

  async function handleMarkGpNotified() {
    setBusy("gp");
    try {
      const updated = await markGpNotified(clinicId, disc.id);
      setDisc(updated);
      flash("GP marked as notified", "ok");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Error", "err");
    } finally { setBusy(null); }
  }

  async function handleLogFollowUp() {
    setBusy("followup");
    try {
      const updated = await logFollowUpCall(clinicId, disc.id);
      setDisc(updated);
      flash("Follow-up call logged — protocol closed", "ok");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Error", "err");
    } finally { setBusy(null); }
  }

  async function handleClose() {
    if (!confirm("Close this protocol? This cannot be undone.")) return;
    setBusy("close");
    try {
      const updated = await closeDiscontinuation(clinicId, disc.id);
      setDisc(updated);
      flash("Protocol closed", "ok");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Error", "err");
    } finally { setBusy(null); }
  }

  async function handleSaveNotes() {
    setSaving(true);
    try {
      const updated = await updateDiscontinuationNotes(clinicId, disc.id, notes);
      setDisc(updated);
      flash("Notes saved", "ok");
    } catch (e) {
      flash(e instanceof Error ? e.message : "Error", "err");
    } finally { setSaving(false); }
  }

  const timeline = buildTimeline(disc);
  const isClosed = disc.status === "closed";

  return (
    <div className="px-6 py-6 max-w-5xl space-y-6">

      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-2.5 rounded-lg shadow-lg border text-[13px] font-semibold",
          toast.type === "ok" ? "bg-ok-bg border-ok-bdr text-ok" : "bg-err-bg border-err-bdr text-err",
        )}>
          {toast.type === "ok" ? <CheckCircle2 className="w-4 h-4" /> : <AlertTriangle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Back + header */}
      <div>
        <Link href={`/${clinicId}/discontinuations`} className="inline-flex items-center gap-1.5 text-[12px] text-t3 hover:text-t1 mb-4 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to discontinuations
        </Link>
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <XCircle className="w-5 h-5 text-t3 shrink-0" />
            <h1 className="text-[18px] font-bold text-t1 font-mono">{disc.id}</h1>
          </div>
          <span className={cn("text-[11px] font-bold px-2.5 py-1 rounded-md border", status.bg, status.text, status.border)}>
            {status.label}
          </span>
          {isClosed && (
            <span className="text-[11px] text-t3">Closed {disc.closed_at ? formatDate(disc.closed_at) : ""}</span>
          )}
        </div>

        {/* Patient + clinic breadcrumb */}
        <div className="flex items-center gap-2 mt-2 text-[12px] text-t2">
          <Link href={`/${clinicId}/patients/${disc.patient_id}`} className="font-semibold text-brand hover:underline flex items-center gap-1">
            <User className="w-3.5 h-3.5" /> {patientName}
          </Link>
          <ChevronRight className="w-3 h-3 text-t3" />
          <span>{clinic.config.clinic_name}</span>
          {disc.order_id && (
            <>
              <ChevronRight className="w-3 h-3 text-t3" />
              <Link href={`/${clinicId}/orders/${disc.order_id}`} className="text-brand hover:underline flex items-center gap-1">
                <Package className="w-3.5 h-3.5" /> {disc.order_id}
              </Link>
            </>
          )}
        </div>
      </div>

      {/* SLA strip */}
      <div className="grid grid-cols-2 gap-4">
        <SLACard
          label="GP notification SLA (48 h)"
          dueAt={gpSlaDue}
          doneAt={disc.gp_notified_at}
          doneLabel="Notified"
        />
        <SLACard
          label={`Follow-up call SLA (${disc.sla_follow_up_days} days)`}
          dueAt={followUpSlaDue}
          doneAt={disc.follow_up_call_at}
          doneLabel="Completed"
        />
      </div>

      {/* Body: left col (protocol info + notes) + right col (actions + timeline) */}
      <div className="grid grid-cols-[1fr_320px] gap-6">

        {/* LEFT */}
        <div className="space-y-5">

          {/* Protocol info card */}
          <div className="bg-surface border border-bdr rounded-xl p-5 space-y-4">
            <h2 className="text-[11px] font-bold text-t3 uppercase tracking-wider">Protocol details</h2>

            {/* Reason */}
            <div>
              <p className="text-[11px] text-t3 font-medium mb-1">Reason</p>
              <span className={cn("inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-md border", reason.colour)}>
                <ReasonIcon className="w-3.5 h-3.5" />
                {reason.label}
              </span>
            </div>

            {/* Reason detail */}
            <div>
              <p className="text-[11px] text-t3 font-medium mb-1">Clinical detail</p>
              <p className="text-[13px] text-t1 leading-relaxed">{disc.reason_detail}</p>
            </div>

            {/* Meta row */}
            <div className="grid grid-cols-2 gap-4 pt-2 border-t border-bdr">
              <div>
                <p className="text-[11px] text-t3 font-medium mb-0.5">Initiated by</p>
                <p className="text-[12px] text-t1 font-semibold">{disc.created_by}</p>
              </div>
              <div>
                <p className="text-[11px] text-t3 font-medium mb-0.5">Initiated at</p>
                <p className="text-[12px] text-t1 font-semibold">{formatDateTime(disc.created_at)}</p>
              </div>
              <div>
                <p className="text-[11px] text-t3 font-medium mb-0.5">Patient</p>
                <Link href={`/${clinicId}/patients/${disc.patient_id}`} className="text-[12px] text-brand hover:underline font-semibold">
                  {patientName}
                </Link>
              </div>
              <div>
                <p className="text-[11px] text-t3 font-medium mb-0.5">Linked order</p>
                {disc.order_id ? (
                  <Link href={`/${clinicId}/orders/${disc.order_id}`} className="text-[12px] text-brand hover:underline font-semibold">
                    {disc.order_id}
                  </Link>
                ) : (
                  <p className="text-[12px] text-t3">None</p>
                )}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-surface border border-bdr rounded-xl p-5 space-y-3">
            <h2 className="text-[11px] font-bold text-t3 uppercase tracking-wider">Clinical notes</h2>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={5}
              disabled={isClosed}
              className="w-full text-[13px] text-t1 bg-page-bg border border-bdr rounded-lg px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-50 disabled:cursor-not-allowed"
              placeholder="Add clinical notes, follow-up plans, referral details…"
            />
            {!isClosed && (
              <div className="flex justify-end">
                <Button
                  size="sm"
                  disabled={saving || notes === disc.notes}
                  onClick={handleSaveNotes}
                  className="text-[12px]"
                >
                  {saving ? "Saving…" : "Save notes"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT */}
        <div className="space-y-5">

          {/* Action panel */}
          {!isClosed && (
            <div className="bg-surface border border-bdr rounded-xl p-4 space-y-3">
              <h2 className="text-[11px] font-bold text-t3 uppercase tracking-wider">Actions</h2>

              {!disc.gp_notified_at && (
                <button
                  onClick={handleMarkGpNotified}
                  disabled={busy === "gp"}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-bdr bg-page-bg hover:bg-surface text-[13px] font-semibold text-t1 transition-colors disabled:opacity-50"
                >
                  <Mail className="w-4 h-4 text-warn shrink-0" />
                  <span className="text-left flex-1">{busy === "gp" ? "Marking…" : "Mark GP notified"}</span>
                </button>
              )}

              {disc.gp_notified_at && !disc.follow_up_call_at && (
                <button
                  onClick={handleLogFollowUp}
                  disabled={busy === "followup"}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-bdr bg-page-bg hover:bg-surface text-[13px] font-semibold text-t1 transition-colors disabled:opacity-50"
                >
                  <Phone className="w-4 h-4 text-ok shrink-0" />
                  <span className="text-left flex-1">{busy === "followup" ? "Logging…" : "Log follow-up call"}</span>
                </button>
              )}

              <button
                onClick={handleClose}
                disabled={busy === "close"}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-bdr bg-page-bg hover:bg-surface text-[13px] font-semibold text-slate-500 transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span className="text-left flex-1">{busy === "close" ? "Closing…" : "Close protocol"}</span>
              </button>

              {!disc.gp_notified_at && disc.status === "initiated" && (
                <p className="text-[11px] text-t3 leading-snug">
                  GP notification is overdue. Mark as notified once the GP letter has been sent.
                </p>
              )}
            </div>
          )}

          {isClosed && (
            <div className="bg-ok-bg border border-ok-bdr rounded-xl p-4 flex items-center gap-3">
              <CheckCircle2 className="w-5 h-5 text-ok shrink-0" />
              <div>
                <p className="text-[13px] font-semibold text-ok">Protocol closed</p>
                <p className="text-[11px] text-t3">{disc.closed_at ? formatDate(disc.closed_at) : ""}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-surface border border-bdr rounded-xl p-4 space-y-1">
            <h2 className="text-[11px] font-bold text-t3 uppercase tracking-wider mb-3">Timeline</h2>
            <ol className="space-y-0">
              {timeline.map((ev, i) => {
                const Icon = ev.icon;
                return (
                  <li key={i} className="flex gap-3 pb-4 relative">
                    {i < timeline.length - 1 && (
                      <div className="absolute left-[11px] top-5 bottom-0 w-px bg-bdr" />
                    )}
                    <div className={cn("mt-0.5 w-5 h-5 rounded-full bg-surface border border-bdr flex items-center justify-center shrink-0 z-10", ev.colour)}>
                      <Icon className="w-3 h-3" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[12px] font-semibold text-t1">{ev.label}</p>
                      <p className="text-[11px] text-t3">{formatDateTime(ev.at)}</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </div>
    </div>
  );
}
