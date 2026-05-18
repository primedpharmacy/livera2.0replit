"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createGPLetterAction } from "@/lib/actions/gpLetterActions";
import type { Patient, Clinic, ClinicId, GPLetterTemplate } from "@/types";

interface Props {
  patients: Patient[];
  templates: GPLetterTemplate[];
  clinic: Clinic;
  clinicId: ClinicId;
}

function fillTemplate(template: string, patient: Patient, clinic: Clinic): string {
  const addr = patient.demographic.address;
  const addrLine = [addr.line1, addr.line2, addr.city, addr.postcode].filter(Boolean).join(", ");
  return template
    .replace(/\{\{patient_name\}\}/g,    patient.demographic.full_name)
    .replace(/\{\{patient_dob\}\}/g,     patient.demographic.dob)
    .replace(/\{\{patient_address\}\}/g, addrLine)
    .replace(/\{\{gp_name\}\}/g,         patient.gp?.name ?? "Dear GP")
    .replace(/\{\{gp_surgery\}\}/g,      patient.gp?.address ?? "")
    .replace(/\{\{medication\}\}/g,      "GLP-1 medication")
    .replace(/\{\{dose\}\}/g,            "current prescribed dose")
    .replace(/\{\{order_summary\}\}/g,   "")
    .replace(/\{\{prescriber_name\}\}/g, "")
    .replace(/\{\{clinic_name\}\}/g,     clinic.config.clinic_name)
    .replace(/\{\{clinic_email\}\}/g,    clinic.config.reply_email)
    .replace(/\{\{clinic_phone\}\}/g,    "")
    .replace(/\{\{today_date\}\}/g,      new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "long", year: "numeric" }));
}

export function GPLetterNewClient({ patients, templates, clinic, clinicId }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialPatientId = (() => {
    const q = searchParams?.get("patient_id");
    return q && patients.some((p) => p.id === q) ? q : "";
  })();
  const [selectedPatientId, setSelectedPatientId] = useState(initialPatientId);

  // If the URL param arrives or changes after mount (e.g. client-side
  // navigation from the welcome-call detail page), preselect the patient
  // — but never clobber a value the user has already chosen manually.
  useEffect(() => {
    const q = searchParams?.get("patient_id");
    if (q && q !== selectedPatientId && patients.some((p) => p.id === q) && selectedPatientId === "") {
      setSelectedPatientId(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  // BLD-7.1 — Right-hand PDF letter preview (read-only). Rendered as the
  // Postmark attachment by sendGPLetterAction.
  const [pdfPreview, setPdfPreview] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPatient = patients.find((p) => p.id === selectedPatientId);
  const hasGPConsent = selectedPatient?.consents_given.some((c) => c.consent_id === "consent_gp") ?? false;

  function handlePatientChange(patientId: string) {
    setSelectedPatientId(patientId);
    setSelectedTemplateId("");
    setSubject("");
    setBody("");
    setPdfPreview("");
  }

  function handleTemplateChange(templateId: string) {
    setSelectedTemplateId(templateId);
    const tpl = templates.find((t) => t.id === templateId);
    const patient = patients.find((p) => p.id === selectedPatientId);
    if (tpl && patient) {
      setBody(fillTemplate(tpl.email_body_template, patient, clinic));
      setPdfPreview(fillTemplate(tpl.pdf_letter_template, patient, clinic));
      setSubject(`${tpl.name} — ${patient.demographic.full_name}`);
    } else {
      setPdfPreview("");
    }
  }

  async function handleSave() {
    if (!selectedPatientId || !subject.trim() || !body.trim()) {
      setError("Please select a patient and fill in the subject and body.");
      return;
    }
    setError(null);
    setIsSubmitting(true);
    try {
      const letter = await createGPLetterAction(clinicId, {
        patient_id: selectedPatientId,
        template_id: selectedTemplateId || "custom",
        subject,
        body,
      });
      router.push(`/${clinicId}/gp-letters/${letter.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create letter");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div>
      <div className="border-b border-bdr px-6 py-3 flex items-center gap-3 bg-surface">
        <Link href={`/${clinicId}/gp-letters`} className="text-t3 hover:text-t1 transition-colors">
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <FileText className="w-4 h-4 text-brand" />
        <span className="text-[13px] font-semibold text-t1">New GP letter</span>
      </div>

      {error && (
        <div className="mx-6 mt-4 flex items-start gap-2 bg-err-bg border border-err-bdr rounded-lg px-4 py-3">
          <AlertCircle className="w-4 h-4 text-err shrink-0 mt-0.5" />
          <p className="text-[13px] text-err">{error}</p>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4 px-6 py-4">
        <div className="col-span-2 space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-2">Email subject</h3>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Letter subject…"
              className="w-full text-[13px] bg-page-bg border border-bdr rounded-md px-3 py-2 text-t1 placeholder:text-t3 focus:outline-none focus:ring-1 focus:ring-brand"
            />
          </div>
          {/* BLD-7.1 — two-template layout: Email Body (left, editable) + PDF Letter (right, preview) */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">Email body</h3>
                <span className="text-[10px] text-t3">Postmark message body</span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Dear Dr. …"
                rows={20}
                className="w-full text-[13px] font-sans bg-page-bg border border-bdr rounded-md px-3 py-2 text-t1 placeholder:text-t3 focus:outline-none focus:ring-1 focus:ring-brand resize-y"
              />
            </div>
            <div className="bg-surface border border-bdr rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3">PDF letter preview</h3>
                <span className="text-[10px] text-t3">Attached as gp_letter_…pdf</span>
              </div>
              <div
                className="border border-bdr rounded-md bg-page-bg px-3 py-2 overflow-auto text-[12px] text-t1 font-sans whitespace-pre-wrap leading-relaxed"
                style={{ minHeight: "26rem", maxHeight: "32rem" }}
                aria-label="PDF letter preview"
                data-testid="gp-letter-pdf-preview"
              >
                {pdfPreview
                  ? pdfPreview
                  : <span className="text-t3 italic">Select a template to preview the PDF that will be attached.</span>}
              </div>
            </div>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <Button size="sm" onClick={handleSave} disabled={isSubmitting || !selectedPatientId}>
              {isSubmitting ? "Saving…" : "Save draft"}
            </Button>
            {selectedPatient && !hasGPConsent && (
              <p className="text-[12px] text-err">Patient has not given GP consent — letter can be saved but not sent.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Patient</h3>
            <select
              value={selectedPatientId}
              onChange={(e) => handlePatientChange(e.target.value)}
              className="w-full text-[13px] bg-page-bg border border-bdr rounded-md px-3 py-2 text-t1 focus:outline-none focus:ring-1 focus:ring-brand"
            >
              <option value="">— Select patient —</option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.demographic.full_name} ({p.id})
                </option>
              ))}
            </select>
            {selectedPatient && (
              <div className="mt-2 text-[11px] text-t2 space-y-1">
                <p>GP: {selectedPatient.gp?.name ?? <span className="text-t3 italic">None on record</span>}</p>
                <p>GP email: {selectedPatient.gp?.email ?? <span className="text-t3 italic">None</span>}</p>
                {hasGPConsent ? (
                  <p className="text-ok font-medium">GP consent: given</p>
                ) : (
                  <p className="text-err font-medium">GP consent: not given</p>
                )}
              </div>
            )}
          </div>

          <div className="bg-surface border border-bdr rounded-lg p-4">
            <h3 className="text-[11px] uppercase tracking-wider font-bold text-t3 mb-3">Template</h3>
            <select
              value={selectedTemplateId}
              onChange={(e) => handleTemplateChange(e.target.value)}
              className="w-full text-[13px] bg-page-bg border border-bdr rounded-md px-3 py-2 text-t1 focus:outline-none focus:ring-1 focus:ring-brand"
              disabled={!selectedPatientId}
            >
              <option value="">— Select template —</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
            <p className="text-[11px] text-t3 mt-1.5">Selecting a template auto-fills the subject and body.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
