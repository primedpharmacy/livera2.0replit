"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, FileText, Send, Lock, AlertCircle, CheckCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/shared/StatusBadge";
import { formatDate, formatDateTime } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sendGPLetterAction } from "@/lib/actions/gpLetterActions";
import { useCurrentUser } from "@/lib/context";
import { can } from "@/lib/permissions";
import { dispatchQueueCountChange } from "@/lib/queue-counts";
import { SlaTimerWidget } from "@/components/sla/SlaTimerWidget";
import type { GPLetter, Patient, Clinic, ClinicId } from "@/types";

interface Props {
  initialLetter: GPLetter;
  patient: Patient;
  clinic: Clinic;
  clinicId: ClinicId;
}

interface Toast { message: string; type: "ok" | "err" }

export function GPLetterDetailClient({ initialLetter, patient, clinic, clinicId }: Props) {
  const CURRENT_USER = useCurrentUser();
  const [letter, setLetter] = useState<GPLetter>(initialLetter);
  const [isSending, setIsSending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const canSend = can(CURRENT_USER, "write", "gp_letters");
  const isDraft = letter.status === "draft";
  const gpEmail = patient.gp?.email ?? null;

  async function handleSend() {
    if (!canSend || !isDraft || !letter.patient_consent_verified) return;
    setIsSending(true);
    try {
      // BLD-7.3/7.4: server action orchestrates PDF generation (pdfkit) →
      // Postmark send → sendGPLetter fixture (audit payload + Layer 3 log).
      const wasOwed = letter.lifecycle_status === "owed";
      const updated = await sendGPLetterAction(clinicId, letter.id);
      setLetter(updated);
      if (wasOwed && updated.lifecycle_status !== "owed") {
        dispatchQueueCountChange({ queue: "gp_letters", delta: -1 });
      }
      setToast({ message: "Letter sent successfully", type: "ok" });
    } catch (err) {
      setToast({ message: err instanceof Error ? err.message : "Failed to send", type: "err" });
    } finally {
      setIsSending(false);
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
        <Link href={`/${clinicId}/gp-letters`} className="text-t3 hover:text-t1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <FileText className="w-4 h-4 text-brand shrink-0" />
          <span className="font-mono text-[13px] font-bold text-t1">{letter.id}</span>
          <StatusBadge value={letter.status} kind="gp_letter" />
        </div>
        {isDraft && canSend && (
          <Button
            size="sm"
            onClick={handleSend}
            disabled={isSending || !letter.patient_consent_verified || !gpEmail}
            className="h-7 text-[12px] gap-1.5"
          >
            <Send className="w-3.5 h-3.5" />
            {isSending ? "Sending…" : "Send letter"}
          </Button>
        )}
      </div>

      {/* BLD-4.6.2 — GP letter send SLA timer (owed lifecycle) */}
      {letter.lifecycle_status === "owed" && (
        <div className="mx-6 mt-4">
          <SlaTimerWidget
            sla_deadline={new Date(
              new Date(letter.created_at).getTime() +
                clinic.config.default_slas.gp_letter_send_hours * 3_600_000
            ).toISOString()}
            label={`GP Letter Send SLA (${clinic.config.default_slas.gp_letter_send_hours}h)`}
            total_hours={clinic.config.default_slas.gp_letter_send_hours}
            variant="full"
          />
        </div>
      )}

      {isDraft && !letter.patient_consent_verified && (
        <div className="mx-6 mt-4 flex items-start gap-3 bg-err-bg border border-err-bdr rounded-lg px-4 py-3">
          <Lock className="w-4 h-4 text-err shrink-0 mt-0.5" />
          <div>
            <p className="text-[13px] font-semibold text-err">GP communication consent not verified</p>
            <p className="text-[12px] text-t2 mt-0.5">
              This patient has not consented to GP communication. This letter cannot be sent until consent is given.
            </p>
          </div>
        </div>
      )}

      {isDraft && letter.patient_consent_verified && !gpEmail && (
        <div className="mx-6 mt-4 flex items-start gap-3 bg-warn-bg border border-warn-bdr rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <p className="text-[13px] text-warn">No GP email on record. Add a GP email address before sending.</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-2">Subject</h3>
            <p className="text-[14px] font-semibold text-t1">{letter.subject}</p>
          </div>
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Letter body</h3>
            <pre className="text-[13px] text-t1 whitespace-pre-wrap font-sans leading-relaxed">{letter.body}</pre>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Patient</h3>
            <div className="flex items-center gap-2 mb-2">
              <User className="w-4 h-4 text-t3 shrink-0" />
              <span className="text-[13px] font-semibold text-t1">{patient.demographic.full_name}</span>
            </div>
            <dl className="space-y-1.5">
              {([["ID", patient.id], ["DOB", patient.demographic.dob]] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[12px]">
                  <dt className="text-t3">{k}</dt>
                  <dd className="text-t1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">GP details</h3>
            {patient.gp ? (
              <dl className="space-y-1.5">
                {([["Name", patient.gp.name], ["Email", patient.gp.email], ["Address", patient.gp.address]] as const).map(([k, v]) => (
                  <div key={k} className="flex flex-col text-[12px] gap-0.5">
                    <dt className="text-t3">{k}</dt>
                    <dd className="text-t1 font-medium break-all">{v}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[12px] text-t3 italic">No GP on record</p>
            )}
          </div>

          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Metadata</h3>
            <dl className="space-y-1.5">
              {([
                ["Created", formatDate(letter.created_at)],
                ["Sent to", letter.sent_to_email ?? "—"],
                ["Sent at", letter.sent_at ? formatDateTime(letter.sent_at) : "—"],
              ] as const).map(([k, v]) => (
                <div key={k} className="flex justify-between text-[12px]">
                  <dt className="text-t3">{k}</dt>
                  <dd className="text-t1 font-medium">{v}</dd>
                </div>
              ))}
            </dl>
          </div>

          {letter.patient_consent_verified && (
            <div className="flex items-center gap-2 bg-ok-bg border border-ok-bdr rounded-lg px-3 py-2">
              <CheckCircle className="w-4 h-4 text-ok shrink-0" />
              <p className="text-[12px] text-ok font-medium">GP consent verified</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
