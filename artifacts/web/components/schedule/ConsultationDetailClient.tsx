"use client";

import { useState, useEffect } from "react";
import { format, parseISO, differenceInMinutes } from "date-fns";
import { Video, ExternalLink, Play, PhoneOff, UserX, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Consultation, Patient, Order, ClinicId } from "@/types";
import { TYPE_CONFIG, STATUS_CONFIG, CLINICIAN_INFO, getPhaseIndex } from "./consultationConfig";
import { ConsultationPhaseTracker } from "./ConsultationPhaseTracker";
import { ConsultationIdentityChecklist, type IdCheckKey } from "./ConsultationIdentityChecklist";
import { ConsultationMeetCard } from "./ConsultationMeetCard";
import { ConsultationPatientContext } from "./ConsultationPatientContext";
import { ConsultationClinicianRail } from "./ConsultationClinicianRail";
import { ConsultationPostCallActions } from "./ConsultationPostCallActions";
import { updateConsultationStatus } from "@/lib/api/mock";

interface Props {
  consultation: Consultation;
  patient: Patient;
  order: Order | null;
  history: Consultation[];
  clinicId: ClinicId;
}

interface Toast { message: string; type: "ok" | "err" | "warn" }

export function ConsultationDetailClient({
  consultation: initialConsultation,
  patient,
  order,
  history,
  clinicId,
}: Props) {
  const [consultation, setConsultation] = useState(initialConsultation);
  const [isSaving,    setIsSaving]    = useState(false);
  const [toast,       setToast]       = useState<Toast | null>(null);
  const [showConfirm, setShowConfirm] = useState<"no_show" | "cancel" | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const isVideo      = consultation.modality === "video";
  const isScheduled  = consultation.status === "scheduled" || consultation.status === "rescheduled";
  const isInProgress = consultation.status === "in_progress";
  const isCompleted  = consultation.status === "completed";
  const isTerminal   = isCompleted || consultation.status === "no_show" || consultation.status === "cancelled";

  const [idChecks, setIdChecks] = useState<Record<IdCheckKey, boolean>>({
    name: false, dob: false, visual: false, location: false,
  });
  const requiredChecks: IdCheckKey[] = isVideo
    ? ["name", "dob", "visual", "location"]
    : ["name", "dob", "location"];
  const allChecked = requiredChecks.every((k) => idChecks[k]);

  function toggle(key: IdCheckKey) {
    setIdChecks((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  async function advanceStatus(status: Consultation["status"]) {
    setIsSaving(true);
    setShowConfirm(null);
    try {
      const updated = await updateConsultationStatus(clinicId, consultation.id, status);
      setConsultation(updated);
      const labels: Record<string, string> = {
        in_progress: "Call started — identity verification complete",
        completed:   "Call ended — post-call actions now available",
        no_show:     "Marked as no-show",
        cancelled:   "Consultation cancelled",
      };
      setToast({ message: labels[status] ?? `Status: ${status}`, type: status === "completed" ? "ok" : status === "in_progress" ? "ok" : "warn" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Update failed", type: "err" });
    } finally {
      setIsSaving(false);
    }
  }

  const typeCfg   = TYPE_CONFIG[consultation.consultation_type];
  const statusCfg = STATUS_CONFIG[consultation.status];
  const clinician = CLINICIAN_INFO[consultation.clinician_id] ?? { name: consultation.clinician_id, role: "Unknown" };
  const duration  = differenceInMinutes(parseISO(consultation.scheduled_end), parseISO(consultation.scheduled_start));
  const startDt   = parseISO(consultation.scheduled_start);
  const dateLabel = format(startDt, "EEEE d MMMM yyyy");
  const timeLabel = `${format(startDt, "HH:mm")} – ${format(parseISO(consultation.scheduled_end), "HH:mm")} BST`;
  const qr        = order?.questionnaire_responses as Record<string, unknown> | undefined;

  return (
    <div className="relative">
      {/* ── Toast ───────────────────────────────────────────────────────────── */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg text-sm font-medium shadow-lg text-white",
          toast.type === "ok"   ? "bg-ok"   :
          toast.type === "warn" ? "bg-warn" : "bg-err"
        )}>
          {toast.message}
        </div>
      )}

      {/* ── Confirm modal (no-show / cancel) ────────────────────────────────── */}
      {showConfirm && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowConfirm(null)} />
          <div className="relative z-10 w-full max-w-sm bg-surface border border-bdr rounded-xl shadow-2xl p-6 mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 rounded-full bg-warn-bg flex items-center justify-center shrink-0">
                <AlertTriangle className="w-4 h-4 text-warn" />
              </div>
              <h2 className="text-[15px] font-bold text-t1">
                {showConfirm === "no_show" ? "Mark as no-show?" : "Cancel consultation?"}
              </h2>
            </div>
            <p className="text-sm text-t2 mb-5">
              {showConfirm === "no_show"
                ? "This records that the patient did not attend. The outcome will be logged to the audit trail."
                : "This cancels the consultation. The patient will need to rebook. This is logged to the audit trail."}
            </p>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setShowConfirm(null)}
                className="px-4 py-1.5 text-sm border border-bdr rounded-lg text-t2 hover:text-t1 transition-colors"
              >
                Keep
              </button>
              <button
                onClick={() => advanceStatus(showConfirm === "no_show" ? "no_show" : "cancelled")}
                disabled={isSaving}
                className="px-4 py-1.5 text-sm bg-warn text-white rounded-lg font-semibold hover:bg-warn/90 disabled:opacity-50 transition-colors"
              >
                {isSaving ? "Saving…" : showConfirm === "no_show" ? "Mark no-show" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header strip ──────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 px-6 py-4 bg-surface border-b border-bdr">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-xs font-bold px-2 py-px rounded-full border ${typeCfg.bg} ${typeCfg.border} ${typeCfg.text}`}>
              {typeCfg.label}
            </span>
            <span className={`text-xs font-bold px-2 py-px rounded-full border ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}`}>
              {statusCfg.label}
            </span>
            <span className="text-xs text-t3 font-mono">{consultation.id}</span>
          </div>
          <h1 className="text-xl font-semibold text-t1">{patient.demographic.full_name}</h1>
          <p className="text-sm text-t2">{dateLabel} · {timeLabel} · {duration} min</p>
        </div>

        {/* Status action CTAs */}
        <div className="ml-auto flex items-center gap-2">
          {isScheduled && (
            <>
              <button
                onClick={() => setShowConfirm("no_show")}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-bdr text-t2 rounded-lg hover:border-warn hover:text-warn transition-colors disabled:opacity-40"
              >
                <UserX className="w-3.5 h-3.5" />
                No-show
              </button>
              <button
                onClick={() => setShowConfirm("cancel")}
                disabled={isSaving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-bdr text-t2 rounded-lg hover:border-err hover:text-err transition-colors disabled:opacity-40"
              >
                <XCircle className="w-3.5 h-3.5" />
                Cancel
              </button>
              <button
                onClick={() => advanceStatus("in_progress")}
                disabled={isSaving || !allChecked}
                title={!allChecked ? "Complete identity verification first" : ""}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors",
                  allChecked && !isSaving
                    ? "bg-brand text-white hover:bg-brand/90"
                    : "bg-bdr text-t3 cursor-not-allowed"
                )}
              >
                <Play className="w-3.5 h-3.5" />
                {isSaving ? "Starting…" : "Start call"}
              </button>
            </>
          )}

          {isInProgress && (
            <>
              {isVideo && consultation.join_url_clinician && (
                <a
                  href={consultation.join_url_clinician}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-ok text-white text-sm font-semibold hover:bg-ok/90 transition-colors"
                >
                  <Video className="w-4 h-4" />
                  Join Meet
                  <ExternalLink className="w-3 h-3 opacity-70" />
                </a>
              )}
              <button
                onClick={() => advanceStatus("completed")}
                disabled={isSaving}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-warn text-white text-sm font-semibold hover:bg-warn/90 disabled:opacity-50 transition-colors"
              >
                <PhoneOff className="w-4 h-4" />
                {isSaving ? "Ending…" : "End call"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Phase tracker ─────────────────────────────────────────────────── */}
      <ConsultationPhaseTracker status={consultation.status} />

      {/* ── Main content ──────────────────────────────────────────────────── */}
      <div className="flex gap-6 px-6 py-6 items-start">
        {/* Left column */}
        <div className="flex-1 min-w-0 flex flex-col gap-4">
          <ConsultationPatientContext
            patient={patient}
            clinicId={clinicId}
            order={order}
            qr={qr}
          />

          {!isTerminal && (
            <ConsultationIdentityChecklist
              isVideo={isVideo}
              idChecks={idChecks}
              allChecked={allChecked}
              toggle={toggle}
            />
          )}

          {isInProgress && isVideo && consultation.join_url_clinician && (
            <ConsultationMeetCard
              joinUrl={consultation.join_url_clinician}
              allChecked={allChecked}
            />
          )}

          <ConsultationPostCallActions
            isCompleted={isCompleted}
            clinicId={clinicId}
            patientId={patient.id}
            linkedOrderId={consultation.linked_order_id}
          />
        </div>

        {/* Right rail */}
        <ConsultationClinicianRail
          consultation={consultation}
          clinician={clinician}
          startDt={startDt}
          duration={duration}
          history={history}
          clinicId={clinicId}
        />
      </div>
    </div>
  );
}
