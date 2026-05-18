"use client";

/**
 * WeightWarningThresholdsEditor — Task-100.
 *
 * Edits the clinic's weight-trend analyser thresholds with server-persist via
 * updateClinicWeightWarningThresholds. Admin/Owner only (gate enforced at page
 * level AND inside the action).
 *
 * 3-layer safety chain on save:
 *   Layer 1 (UI): disabled until dirty; optimistic rollback on error
 *   Layer 2 (server): updateClinicWeightWarningThresholds validates values
 *   Layer 3 (audit): [AUDIT] per changed field inside the action
 */

import { useState } from "react";
import { AlertTriangle, Save, RotateCcw } from "lucide-react";
import { updateClinicWeightWarningThresholds } from "@/lib/api/mock";
import type { ClinicConfig, ClinicId } from "@/types";

interface Props {
  config:   ClinicConfig;
  clinicId: ClinicId;
  actorId:  string;
}

type ThresholdKey = keyof ClinicConfig["weight_warning_thresholds"];

const DEFINITIONS: Array<{
  key: ThresholdKey;
  label: string;
  unit: string;
  description: string;
  step: number;
  min: number;
  integer?: boolean;
}> = [
  {
    key: "bmi_continuation_floor",
    label: "BMI continuation floor",
    unit: "BMI",
    description: "On a reorder, warn when the latest BMI is below this value.",
    step: 0.1,
    min: 10,
  },
  {
    key: "rapid_loss_kg_per_week",
    label: "Rapid loss threshold",
    unit: "kg / week",
    description: "Flag rapid weight loss when the last two readings exceed this rate.",
    step: 0.1,
    min: 0.1,
  },
  {
    key: "plateau_tolerance_kg",
    label: "Plateau tolerance",
    unit: "kg spread",
    description: "Flag a plateau when the spread across the recent readings stays within this.",
    step: 0.1,
    min: 0.1,
  },
  {
    key: "plateau_min_readings",
    label: "Plateau window",
    unit: "readings",
    description: "Number of consecutive readings used to detect a plateau (must be ≥ 2).",
    step: 1,
    min: 2,
    integer: true,
  },
];

export function WeightWarningThresholdsEditor({ config, clinicId, actorId }: Props) {
  const [draft, setDraft]   = useState<ClinicConfig["weight_warning_thresholds"]>({ ...config.weight_warning_thresholds });
  const [saved, setSaved]   = useState(false);
  const [dirty, setDirty]   = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState<string | null>(null);

  // Rollback target — tracks the last successfully persisted state so a failed
  // save reverts to what the server actually has, not the original page load.
  const [lastSaved, setLastSaved] = useState<ClinicConfig["weight_warning_thresholds"]>({
    ...config.weight_warning_thresholds,
  });

  function handleChange(key: ThresholdKey, value: string, integer?: boolean) {
    const num = integer ? parseInt(value, 10) : Number(value);
    if (isNaN(num) || num <= 0) return;
    if (key === "plateau_min_readings" && num < 2) return;
    setDraft((prev) => ({ ...prev, [key]: num }));
    setDirty(true);
    setSaved(false);
    setError(null);
  }

  async function handleSave() {
    if (!dirty || saving) return;
    setSaving(true);
    setError(null);
    try {
      await updateClinicWeightWarningThresholds(clinicId, { ...draft }, actorId);
      setLastSaved({ ...draft });
      setDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setDraft({ ...lastSaved });
      setDirty(false);
      setError(err instanceof Error ? err.message : "Save failed — please retry");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setDraft({ ...lastSaved });
    setDirty(false);
    setSaved(false);
    setError(null);
  }

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <AlertTriangle className="w-3.5 h-3.5 text-brand" />
          <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Weight-warning thresholds</h2>
        </div>
        <div className="px-4 py-3 border-b border-bdr">
          <p className="text-[11px] text-t3 leading-snug">
            Drives the chips shown on the weight-trajectory card and the clinical-check slide-over.
            Changes take effect immediately for new analyses.
          </p>
        </div>
        <div className="divide-y divide-bdr">
          {DEFINITIONS.map(({ key, label, unit, description, step, min, integer }) => (
            <div key={key} className="grid grid-cols-2 gap-4 px-4 py-3 items-center">
              <div>
                <p className="text-[13px] font-semibold text-t1">{label}</p>
                <p className="text-[11px] text-t3 mt-0.5 leading-snug">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  step={step}
                  min={min}
                  value={draft[key]}
                  onChange={(e) => handleChange(key, e.target.value, integer)}
                  disabled={saving}
                  className="w-24 text-[13px] text-t1 border border-bdr bg-page-bg rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-right tabular-nums disabled:opacity-50"
                />
                <span className="text-[11px] text-t3 whitespace-nowrap">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-[12px] text-err px-1">{error}</p>
      )}

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
