"use client";

/**
 * GPLetterComposeModal — BLD-7.5 (Wave 5).
 *
 * Modal compose form for GP letters. Opened from GPLettersView via the
 * "New letter" button — keeps the user on the list page rather than
 * navigating away. On success, navigates to the new letter detail page.
 *
 * Template filling uses email_body_template (BLD-7.1 cascade — split template).
 * Consent status is shown as a read-only badge (DEC-22).
 *
 * Permissions: gate at call site (GPLettersView checks can(CURRENT_USER, 'write', 'gp_letters')).
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import { X, FileText, AlertCircle, CheckCircle, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CURRENT_USER } from "@/lib/api/mock";
import { createGPLetterAction } from "@/lib/actions/gpLetterActions";
import { NOW } from "@/lib/api/constants";
import { can } from "@/lib/permissions";
import { cn } from "@/lib/utils";
import type { ClinicId, Patient, Clinic, GPLetterTemplate } from "@/types";

interface Props {
  clinicId:   ClinicId;
  patients:   Patient[];
  templates:  GPLetterTemplate[];
  clinic:     Clinic;
  onClose:    () => void;
}

function fillEmailTemplate(template: string, patient: Patient, clinic: Clinic): string {
  return template
    .replace(/\{\{patient_name\}\}/g, patient.demographic.full_name)
    .replace(/\{\{gp_name\}\}/g,      patient.gp?.name ?? "Dear GP")
    .replace(/\{\{medication\}\}/g,   "GLP-1 medication")
    .replace(/\{\{dose\}\}/g,         "current prescribed dose")
    .replace(/\{\{clinic_name\}\}/g,  clinic.config.clinic_name)
    .replace(/\{\{clinic_email\}\}/g, clinic.config.reply_email)
    .replace(/\{\{today_date\}\}/g,   new Date(NOW).toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }));
}

export function GPLetterComposeModal({ clinicId, patients, templates, clinic, onClose }: Props) {
  const router = useRouter();

  const canCompose = can(CURRENT_USER, "write", "gp_letters");

  const [selectedPatientId, setSelectedPatientId] = useState("");
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody]       = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const selectedPatient  = patients.find((p) => p.id === selectedPatientId);
  const hasGPConsent     = selectedPatient?.consents_given.some((c) => c.consent_id === "consent_gp") ?? false;
  const hasGPEmail       = !!selectedPatient?.gp?.email;

  function handlePatientChange(pid: string) {
    setSelectedPatientId(pid);
    setSelectedTemplateId("");
    setSubject("");
    setBody("");
  }

  function handleTemplateChange(tid: string) {
    setSelectedTemplateId(tid);
    const tpl = templates.find((t) => t.id === tid);
    if (tpl && selectedPatient) {
      setBody(fillEmailTemplate(tpl.email_body_template, selectedPatient, clinic));
      setSubject(`${tpl.name} — ${selectedPatient.demographic.full_name}`);
    }
  }

  async function handleSubmit() {
    if (!canCompose) return;
    if (!selectedPatientId || !subject.trim() || !body.trim()) {
      setError("Please select a patient and fill in the subject and body.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const letter = await createGPLetterAction(clinicId, {
        patient_id:  selectedPatientId,
        template_id: selectedTemplateId || "custom",
        subject:     subject.trim(),
        body:        body.trim(),
      });
      router.push(`/${clinicId}/gp-letters/${letter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create letter");
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4 py-6">
      <div className="bg-surface border border-bdr rounded-xl shadow-xl w-full max-w-2xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-bdr shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-brand" />
            <span className="text-[14px] font-bold text-t1">Compose GP letter</span>
          </div>
          <button onClick={onClose} className="text-t3 hover:text-t1 transition-colors" aria-label="Close">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <div className="flex items-center gap-2 bg-err-bg border border-err-bdr rounded-lg px-3 py-2.5 text-[12px] text-err">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Patient */}
          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Patient</label>
            <div className="relative">
              <select
                value={selectedPatientId}
                onChange={(e) => handlePatientChange(e.target.value)}
                className="w-full appearance-none pl-3 pr-8 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              >
                <option value="">Select patient…</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.demographic.full_name} ({p.id})
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
            </div>
          </div>

          {/* Consent + GP email status (DEC-22) */}
          {selectedPatient && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border",
                hasGPConsent
                  ? "bg-ok-bg border-ok-bdr text-ok"
                  : "bg-err-bg border-err-bdr text-err"
              )}>
                {hasGPConsent ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                GP consent {hasGPConsent ? "verified" : "missing"}
              </span>
              <span className={cn(
                "flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full border",
                hasGPEmail
                  ? "bg-ok-bg border-ok-bdr text-ok"
                  : "bg-warn-bg border-warn-bdr text-warn"
              )}>
                {hasGPEmail ? <CheckCircle className="w-3 h-3" /> : <AlertCircle className="w-3 h-3" />}
                GP email {hasGPEmail ? "on record" : "missing"}
              </span>
            </div>
          )}

          {/* Template */}
          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Template (optional)</label>
            <div className="relative">
              <select
                value={selectedTemplateId}
                onChange={(e) => handleTemplateChange(e.target.value)}
                disabled={!selectedPatientId}
                className="w-full appearance-none pl-3 pr-8 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="">Select template or write manually…</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-t3 pointer-events-none" />
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Subject</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
              placeholder="e.g. Treatment commencement notification — Patient Name"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-[11px] font-bold text-t3 uppercase tracking-wider mb-1.5">Email body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={10}
              className="w-full px-3 py-2 text-[13px] border border-bdr rounded-lg bg-page-bg text-t1 placeholder:text-t3 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand resize-none leading-relaxed font-sans"
              placeholder="Dear Dr. …"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-bdr bg-page-bg rounded-b-xl shrink-0">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting} className="h-8 text-[12px]">
            Cancel
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting || !canCompose || !selectedPatientId || !subject.trim() || !body.trim()}
            className="h-8 text-[12px]"
          >
            {submitting ? "Saving…" : "Create letter"}
          </Button>
        </div>
      </div>
    </div>
  );
}
