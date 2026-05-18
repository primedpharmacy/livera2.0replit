"use client";

/**
 * MinimumPatientAgeEditor — Task-246.
 *
 * Edits the clinic's minimum patient age used by the intake DOB validator
 * (`validateDob({ minimumAgeYears })`). Default is 18; some GLP-1 protocols
 * require 21, and rare paediatric flows may want lower.
 *
 * Admin/Owner only — permission gate is enforced both at the page level and
 * inside updateClinicMinimumPatientAge.
 *
 * 3-layer safety chain on save:
 *   Layer 1 (UI): disabled until dirty; optimistic rollback on error
 *   Layer 2 (server): updateClinicMinimumPatientAge validates value is an
 *                     integer between MIN_ALLOWED_PATIENT_AGE and
 *                     MAX_ALLOWED_PATIENT_AGE
 *   Layer 3 (audit): [AUDIT] minimum_patient_age_updated inside the action
 */

import { useState } from "react";
import { CalendarDays, Save, RotateCcw } from "lucide-react";
import {
  updateClinicMinimumPatientAge,
  MIN_ALLOWED_PATIENT_AGE,
  MAX_ALLOWED_PATIENT_AGE,
} from "@/lib/api/mock";
import type { ClinicConfig, ClinicId } from "@/types";

interface Props {
  config:   ClinicConfig;
  clinicId: ClinicId;
  actorId:  string;
}

export function MinimumPatientAgeEditor({ config, clinicId, actorId }: Props) {
  const [draft, setDraft]     = useState<number>(config.minimum_patient_age_years);
  const [lastSaved, setLast]  = useState<number>(config.minimum_patient_age_years);
  const [dirty, setDirty]     = useState(false);
  const [saved, setSaved]     = useState(false);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);

  function handleChange(value: string) {
    const num = parseInt(value, 10);
    if (Number.isNaN(num)) return;
    setDraft(num);
    setDirty(num !== lastSaved);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateClinicMinimumPatientAge(clinicId, draft, actorId);
      setLast(draft);
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setDraft(lastSaved);
      setDirty(false);
      setError(err instanceof Error ? err.message : "Save failed — please retry");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft(lastSaved);
    setDirty(false);
    setSaved(false);
    setError(null);
  }

  return (
    <div className="space-y-3">
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <CalendarDays className="w-3.5 h-3.5 text-brand" />
          <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Patient eligibility</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 px-4 py-3 items-center">
          <div>
            <p className="text-[13px] font-semibold text-t1">Minimum patient age</p>
            <p className="text-[11px] text-t3 mt-0.5 leading-snug">
              Lowest age (in whole years) accepted by the intake form. Patients younger
              than this are blocked at submission. Default is 18; raise to 21 for
              certain GLP-1 protocols.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={MIN_ALLOWED_PATIENT_AGE}
              max={MAX_ALLOWED_PATIENT_AGE}
              step={1}
              value={draft}
              onChange={(e) => handleChange(e.target.value)}
              disabled={saving}
              className="w-24 text-[13px] text-t1 border border-bdr bg-page-bg rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-right tabular-nums disabled:opacity-50"
            />
            <span className="text-[11px] text-t3 whitespace-nowrap">years</span>
          </div>
        </div>
      </div>

      {error && <p className="text-[12px] text-err px-1">{error}</p>}

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <button
            onClick={handleReset}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-t2 border border-bdr rounded-md hover:bg-page-bg transition-colors disabled:opacity-40"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" /> {saving ? "Saving…" : saved ? "Saved!" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
