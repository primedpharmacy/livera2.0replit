"use client";

/**
 * SlaThresholdEditor — BLD-3.4 (Wave 3).
 *
 * Read-only display of clinic SLA thresholds (mocked).
 * All 10 SLA values from clinic.config.default_slas + clinical_note_min_chars.
 * Edit controls are UI-only (no persist in Wave 3 — backend wired in future wave).
 *
 * Shown under Settings → SLAs (Admin / Owner only).
 */

import { useState } from "react";
import { Clock, Save, RotateCcw, AlertTriangle } from "lucide-react";
import type { ClinicConfig } from "@/types";

interface SlaThresholdEditorProps {
  config: ClinicConfig;
}

type SlaKey = keyof ClinicConfig["default_slas"];

const SLA_DEFINITIONS: Array<{
  key: SlaKey;
  label: string;
  unit: string;
  description: string;
}> = [
  { key: "approval_warn_hours",          label: "Approval warning",          unit: "hours",        description: "Time after order receipt before warning tint appears in queue" },
  { key: "approval_breach_hours",        label: "Approval breach",            unit: "hours",        description: "Time after order receipt before SLA is considered breached" },
  { key: "intervention_resolution_wd",   label: "Intervention resolution",   unit: "working days", description: "Time to resolve a clinical intervention" },
  { key: "gp_letter_send_hours",         label: "GP letter send",            unit: "hours",        description: "Time from prescription approval to GP letter dispatch" },
  { key: "order_expiry_days",            label: "Order expiry",              unit: "days",         description: "Calendar days before an order expires" },
  { key: "complaint_ack_wd",             label: "Complaint acknowledgement", unit: "working days", description: "Working days to acknowledge a complaint (NHS standard)" },
  { key: "complaint_response_wd",        label: "Complaint response",        unit: "working days", description: "Working days for substantive complaint response" },
  { key: "coach_escalation_response_wh", label: "Escalation response",      unit: "working hours", description: "Working hours for prescriber to respond to a coaching escalation" },
  { key: "welcome_call_wd",              label: "Welcome call",              unit: "working days", description: "Working days from registration to welcome call" },
  { key: "initial_coaching_call_days",   label: "Initial coaching call",    unit: "days",         description: "Calendar days from first dispatch to initial coaching call" },
];

export function SlaThresholdEditor({ config }: SlaThresholdEditorProps) {
  const [draft, setDraft]       = useState<ClinicConfig["default_slas"]>({ ...config.default_slas });
  const [minChars, setMinChars] = useState(config.clinical_note_min_chars);
  const [saved, setSaved]       = useState(false);
  const [dirty, setDirty]       = useState(false);

  function handleChange(key: SlaKey, value: string) {
    const num = Number(value);
    if (isNaN(num) || num < 1) return;
    setDraft((prev) => ({ ...prev, [key]: num }));
    setDirty(true);
    setSaved(false);
  }

  function handleSave() {
    // UI-only in Wave 3 — persist wired in future wave
    setDirty(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    console.log('[AUDIT]', { event_type: 'sla_thresholds_ui_save', outcome: 'mock_only', draft, minChars });
  }

  function handleReset() {
    setDraft({ ...config.default_slas });
    setMinChars(config.clinical_note_min_chars);
    setDirty(false);
    setSaved(false);
  }

  return (
    <div className="space-y-6">
      {/* Warning banner — Wave 3 UI-only */}
      <div className="flex items-start gap-2 px-4 py-3 bg-warn-bg border border-warn-bdr rounded-lg text-[12px] text-warn">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <span>Changes are UI-only in this release. Persistence will be wired in a future wave.</span>
      </div>

      {/* SLA thresholds table */}
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <Clock className="w-3.5 h-3.5 text-brand" />
          <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">SLA thresholds</h2>
        </div>
        <div className="divide-y divide-bdr">
          {SLA_DEFINITIONS.map(({ key, label, unit, description }) => (
            <div key={key} className="grid grid-cols-2 gap-4 px-4 py-3 items-center">
              <div>
                <p className="text-[13px] font-semibold text-t1">{label}</p>
                <p className="text-[11px] text-t3 mt-0.5 leading-snug">{description}</p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  value={draft[key]}
                  onChange={(e) => handleChange(key, e.target.value)}
                  className="w-24 text-[13px] text-t1 border border-bdr bg-page-bg rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-right tabular-nums"
                />
                <span className="text-[11px] text-t3 whitespace-nowrap">{unit}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Clinical note min chars */}
      <div className="bg-surface border border-bdr rounded-lg overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-bdr bg-page-bg">
          <h2 className="text-[11px] font-bold text-t2 uppercase tracking-wider">Clinical note quality gate</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 px-4 py-3 items-center">
          <div>
            <p className="text-[13px] font-semibold text-t1">Minimum note length</p>
            <p className="text-[11px] text-t3 mt-0.5">Minimum characters required before a clinical note can be saved or used as an approval gate.</p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="number"
              min={10}
              value={minChars}
              onChange={(e) => { setMinChars(Number(e.target.value)); setDirty(true); setSaved(false); }}
              className="w-24 text-[13px] text-t1 border border-bdr bg-page-bg rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-brand/30 focus:border-brand text-right tabular-nums"
            />
            <span className="text-[11px] text-t3">chars</span>
          </div>
        </div>
      </div>

      {/* Action row */}
      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-t2 border border-bdr rounded-md hover:bg-page-bg transition-colors"
          >
            <RotateCcw className="w-4 h-4" /> Reset
          </button>
        )}
        <button
          onClick={handleSave}
          disabled={!dirty}
          className="flex items-center gap-1.5 px-4 py-2 text-[13px] font-semibold text-white bg-brand hover:bg-brand/90 rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Save className="w-4 h-4" /> {saved ? "Saved!" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
