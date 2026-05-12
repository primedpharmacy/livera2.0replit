"use client";

/**
 * ClinicalNoteEditor — BLD-4.2, BLD-4.4, BLD-4.5 (Wave 3).
 *
 * Used in OrderDetailClient "Notes" tab and patient profile "Notes" tab.
 * Layer 1 of the 3-layer safety chain:
 *   - Role gate: only Prescriber or Admin can submit
 *   - Min-chars gate: body.length >= minChars (from clinic.config)
 *   - approval_gate_for_order_id set when orderId + isApprovalNote are provided
 *
 * Props:
 *   clinicId, patientId, orderId (optional)
 *   minChars            — clinic.config.clinical_note_min_chars
 *   canWrite            — pre-computed via can(CURRENT_USER, 'write', 'clinical_notes')
 *   isApprovalNote      — when true, sets approval_gate_for_order_id = orderId
 *   onNoteCreated       — callback to update parent state
 */

import { useState } from "react";
import { PenLine, CheckCircle, AlertTriangle } from "lucide-react";
import { createClinicalNote } from "@/lib/api/mock";
import type { ClinicId, ClinicalNote } from "@/types";

interface ClinicalNoteEditorProps {
  clinicId: ClinicId;
  patientId: string;
  orderId?: string | null;
  minChars: number;
  canWrite: boolean;
  isApprovalNote?: boolean;
  onNoteCreated?: (note: ClinicalNote) => void;
}

export function ClinicalNoteEditor({
  clinicId,
  patientId,
  orderId,
  minChars,
  canWrite,
  isApprovalNote = false,
  onNoteCreated,
}: ClinicalNoteEditorProps) {
  const [body, setBody]           = useState("");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const charCount  = body.length;
  const meetsMin   = charCount >= minChars;
  const charLabel  = `${charCount} / ${minChars} min`;

  async function handleSave() {
    if (!meetsMin || saving) return;
    setSaving(true);
    setError(null);
    try {
      const note = await createClinicalNote(clinicId, {
        patient_id:               patientId,
        order_id:                 orderId ?? null,
        body,
        approval_gate_for_order_id: isApprovalNote && orderId ? orderId : null,
        tags: isApprovalNote ? ["clinical_check"] : [],
      });
      setBody("");
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      onNoteCreated?.(note);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed — please retry");
    } finally {
      setSaving(false);
    }
  }

  if (!canWrite) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 bg-warn-bg border border-warn-bdr rounded-lg text-[12px] text-warn">
        <AlertTriangle className="w-4 h-4 shrink-0" />
        Your role does not have permission to write clinical notes.
      </div>
    );
  }

  return (
    <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
        <PenLine className="w-3.5 h-3.5 text-brand" />
        <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
          {isApprovalNote ? "Clinical note (required to approve)" : "Add clinical note"}
        </h3>
        {isApprovalNote && (
          <span className="ml-auto text-[9px] font-bold bg-err-bg text-err border border-err-bdr px-2 py-px rounded">
            Required
          </span>
        )}
      </div>

      <div className="p-4 space-y-3">
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          disabled={saving}
          rows={5}
          placeholder={`Document your clinical reasoning here (min ${minChars} characters)…`}
          className="w-full resize-none rounded-md border border-bdr bg-page-bg px-3 py-2.5 text-[13px] text-t1 placeholder:text-t3 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand disabled:opacity-50 transition-colors"
        />

        <div className="flex items-center justify-between gap-3">
          <span className={`text-[11px] tabular-nums font-medium ${meetsMin ? "text-ok" : "text-t3"}`}>
            {charLabel}
          </span>

          <div className="flex items-center gap-2">
            {saved && (
              <span className="flex items-center gap-1 text-[12px] text-ok font-semibold">
                <CheckCircle className="w-4 h-4" /> Saved
              </span>
            )}
            {error && (
              <span className="flex items-center gap-1 text-[12px] text-err">
                <AlertTriangle className="w-3.5 h-3.5" /> {error}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={!meetsMin || saving}
              className="flex items-center gap-1.5 px-4 py-2 text-[12px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? "Saving…" : "Save note"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
