"use client";

/**
 * ClinicalNoteEditor — BLD-4.2, BLD-4.4, BLD-4.5 (Wave 3).
 *
 * Create mode (default): creates a new clinical note.
 * Edit mode (existingNote provided): pre-populates body, calls updateClinicalNote on save,
 *   and shows a collapsible edit history accordion when prior edits exist.
 *
 * Layer 1 of the 3-layer safety chain:
 *   - Role gate: only Prescriber or Admin can submit (canWrite prop)
 *   - Min-chars gate: body.length >= minChars (from clinic.config)
 *   - approval_gate_for_order_id set when orderId + isApprovalNote are provided
 */

import { useState } from "react";
import { PenLine, CheckCircle, AlertTriangle, ChevronDown, ChevronUp, History } from "lucide-react";
import { createClinicalNote, updateClinicalNote } from "@/lib/api/mock";
import { formatDateTime } from "@/lib/format";
import type { ClinicId, ClinicalNote } from "@/types";

interface ClinicalNoteEditorProps {
  clinicId:       ClinicId;
  patientId:      string;
  orderId?:       string | null;
  minChars:       number;
  canWrite:       boolean;
  isApprovalNote?: boolean;
  existingNote?:  ClinicalNote;
  onNoteCreated?: (note: ClinicalNote) => void;
  onNoteUpdated?: (note: ClinicalNote) => void;
}

export function ClinicalNoteEditor({
  clinicId,
  patientId,
  orderId,
  minChars,
  canWrite,
  isApprovalNote = false,
  existingNote,
  onNoteCreated,
  onNoteUpdated,
}: ClinicalNoteEditorProps) {
  const isEditMode = Boolean(existingNote);

  const [body, setBody]           = useState(existingNote?.body ?? "");
  const [saving, setSaving]       = useState(false);
  const [saved, setSaved]         = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);

  const charCount = body.length;
  const meetsMin  = charCount >= minChars;
  const charLabel = `${charCount} / ${minChars} min`;

  async function handleSave() {
    if (!meetsMin || saving) return;
    setSaving(true);
    setError(null);
    try {
      if (isEditMode && existingNote) {
        const updated = await updateClinicalNote(clinicId, existingNote.id, { body });
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        onNoteUpdated?.(updated);
      } else {
        const note = await createClinicalNote(clinicId, {
          patient_id:                 patientId,
          order_id:                   orderId ?? null,
          body,
          approval_gate_for_order_id: isApprovalNote && orderId ? orderId : null,
          tags: isApprovalNote ? ["clinical_check"] : [],
        });
        setBody("");
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
        onNoteCreated?.(note);
      }
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

  const editHistory = existingNote?.edit_history ?? [];

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <PenLine className="w-3.5 h-3.5 text-brand" />
          <h3 className="text-[11px] font-bold text-t2 uppercase tracking-wider">
            {isEditMode
              ? "Edit clinical note"
              : isApprovalNote
              ? "Clinical note (required to approve)"
              : "Add clinical note"}
          </h3>
          {isApprovalNote && !isEditMode && (
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
                {saving ? "Saving…" : isEditMode ? "Save edit" : "Save note"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Edit history accordion — only in edit mode when history exists */}
      {isEditMode && editHistory.length > 0 && (
        <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
          <button
            onClick={() => setHistoryOpen((o) => !o)}
            className="flex items-center gap-2 w-full px-4 py-2.5 border-b border-bdr bg-page-bg text-left hover:bg-bdr/30 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-t3" />
            <span className="text-[11px] font-bold text-t2 uppercase tracking-wider">
              Edit history ({editHistory.length})
            </span>
            {historyOpen
              ? <ChevronUp className="w-3.5 h-3.5 text-t3 ml-auto" />
              : <ChevronDown className="w-3.5 h-3.5 text-t3 ml-auto" />
            }
          </button>

          {historyOpen && (
            <div className="divide-y divide-bdr">
              {[...editHistory].reverse().map((entry, i) => (
                <div key={i} className="px-4 py-3 space-y-1">
                  <div className="flex items-center gap-2 text-[11px] text-t3">
                    <span className="font-mono">{entry.edited_by}</span>
                    <span>·</span>
                    <span>{formatDateTime(entry.edited_at)}</span>
                  </div>
                  <p className="text-[12px] text-t2 leading-relaxed whitespace-pre-wrap bg-page-bg rounded px-2 py-1.5 border border-bdr">
                    {entry.previous_body}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
