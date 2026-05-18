"use client";

/**
 * ReorderRulesEditor — BLD-14.6
 *
 * Settings surface for configuring treatment-gap rules per clinic.
 * Rules fire when a patient's reorder gap exceeds configurable thresholds.
 * Actions: warn (yellow banner in order review), block_reorder, require_consult.
 */

import { useState } from "react";
import {
  AlertTriangle,
  AlertOctagon,
  Calendar,
  Clock,
  Edit2,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  Info,
  Plus,
} from "lucide-react";
import type { TreatmentGapRule, TreatmentGapAction, ClinicConfig, ClinicId } from "@/types";

const ACTION_CONFIG: Record<TreatmentGapAction, { label: string; desc: string; bg: string; text: string; border: string; icon: typeof AlertTriangle }> = {
  warn:            { label: "Warn prescriber",      desc: "Yellow banner in order review. Prescriber can proceed.",                  bg: "bg-warn-bg",  text: "text-warn",  border: "border-warn-bdr",  icon: AlertTriangle },
  block_reorder:   { label: "Block reorder",        desc: "Order is blocked until a prescriber manually overrides.",                 bg: "bg-err-bg",   text: "text-err",   border: "border-err-bdr",   icon: AlertOctagon },
  require_consult: { label: "Require consultation", desc: "Consultation must be completed and marked before order can be approved.", bg: "bg-info-bg",  text: "text-info",  border: "border-info-bdr",  icon: Calendar },
};

interface Props {
  config: ClinicConfig;
  clinicId: ClinicId;
}

interface EditState {
  id: string;
  label: string;
  gap_days_min: number;
  gap_days_max: string; // string so empty = null
  action: TreatmentGapAction;
  action_copy: string;
}

export function ReorderRulesEditor({ config }: Props) {
  const [rules, setRules] = useState<TreatmentGapRule[]>(config.treatment_gap_rules);
  const [editing, setEditing] = useState<EditState | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  function startEdit(r: TreatmentGapRule) {
    setEditing({
      id: r.id,
      label: r.label,
      gap_days_min: r.gap_days_min,
      gap_days_max: r.gap_days_max === null ? "" : String(r.gap_days_max),
      action: r.action,
      action_copy: r.action_copy,
    });
  }

  function commitEdit() {
    if (!editing) return;
    setRules((prev) =>
      prev.map((r) =>
        r.id === editing.id
          ? {
              ...r,
              label: editing.label,
              gap_days_min: editing.gap_days_min,
              gap_days_max: editing.gap_days_max === "" ? null : Number(editing.gap_days_max),
              action: editing.action,
              action_copy: editing.action_copy,
            }
          : r
      )
    );
    setSaved(editing.id);
    setEditing(null);
    setTimeout(() => setSaved(null), 2000);
  }

  function toggleEnabled(id: string) {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, enabled: !r.enabled } : r));
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-[14px] font-bold text-t1">Reorder rules — treatment gap</h2>
          <p className="text-[12px] text-t2 mt-1 max-w-xl">
            Rules fire automatically when a patient reorders after a gap that exceeds the
            configured threshold. Disabled rules are inactive but retained for reference.
          </p>
        </div>
        <button
          onClick={() => {}}
          className="flex items-center gap-1.5 px-3 py-2 text-[12px] font-semibold text-brand border border-brand-bdr bg-brand-light rounded-md hover:bg-brand hover:text-white transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add rule
        </button>
      </div>

      {rules.length === 0 && (
        <div className="bg-page-bg border border-bdr rounded-xl px-6 py-10 flex flex-col items-center gap-3 text-center">
          <Clock className="w-8 h-8 text-t3" />
          <p className="text-[13px] font-semibold text-t2">No reorder rules configured</p>
          <p className="text-[12px] text-t3 max-w-sm">
            Add a treatment-gap rule to automatically warn prescribers, block reorders, or require
            a consultation when patients reorder after a gap.
          </p>
        </div>
      )}

      {/* Rule cards */}
      <div className="space-y-3">
        {rules.map((r) => {
          const cfg = ACTION_CONFIG[r.action];
          const Icon = cfg.icon;
          const isEditingThis = editing?.id === r.id;
          const wasSaved = saved === r.id;

          return (
            <div
              key={r.id}
              className={`bg-surface border rounded-xl overflow-hidden transition-opacity ${r.enabled ? "border-bdr" : "border-bdr opacity-60"}`}
            >
              {/* Header */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-bdr">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${cfg.bg} border ${cfg.border}`}>
                  <Icon className={`w-4 h-4 ${cfg.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-t1">{r.label}</p>
                  <p className="text-[11px] text-t3">
                    Gap: {r.gap_days_min}d{r.gap_days_max !== null ? `–${r.gap_days_max}d` : "+"} ·{" "}
                    <span className={`font-semibold ${cfg.text}`}>{cfg.label}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {wasSaved && (
                    <span className="flex items-center gap-1 text-[11px] font-semibold text-ok">
                      <Check className="w-3.5 h-3.5" /> Saved
                    </span>
                  )}
                  <button
                    onClick={() => toggleEnabled(r.id)}
                    className="flex items-center gap-1.5 text-[11px] font-semibold text-t2 hover:text-t1 transition-colors"
                    title={r.enabled ? "Disable rule" : "Enable rule"}
                  >
                    {r.enabled ? (
                      <ToggleRight className="w-5 h-5 text-ok" />
                    ) : (
                      <ToggleLeft className="w-5 h-5 text-t3" />
                    )}
                    {r.enabled ? "Enabled" : "Disabled"}
                  </button>
                  {!isEditingThis ? (
                    <button
                      onClick={() => startEdit(r)}
                      className="flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-semibold text-t2 border border-bdr rounded-md hover:border-brand hover:text-brand transition-colors"
                    >
                      <Edit2 className="w-3 h-3" /> Edit
                    </button>
                  ) : (
                    <div className="flex gap-1.5">
                      <button
                        onClick={commitEdit}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-white bg-ok rounded-md"
                      >
                        <Check className="w-3 h-3" /> Save
                      </button>
                      <button
                        onClick={() => setEditing(null)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-t2 border border-bdr rounded-md"
                      >
                        <X className="w-3 h-3" /> Cancel
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Body */}
              <div className="px-4 py-3 grid grid-cols-2 gap-4">
                {/* Gap range */}
                <div>
                  <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1.5">Gap threshold</p>
                  {isEditingThis ? (
                    <div className="flex items-center gap-2 flex-wrap">
                      <input
                        type="number" min={1} value={editing.gap_days_min}
                        onChange={(e) => setEditing((prev) => prev && { ...prev, gap_days_min: Number(e.target.value) })}
                        className="w-20 text-[12px] border border-bdr rounded-md px-2 py-1.5 bg-surface focus:outline-none focus:border-brand"
                      />
                      <span className="text-[12px] text-t2">to</span>
                      <input
                        type="number" min={1} placeholder="∞"
                        value={editing.gap_days_max}
                        onChange={(e) => setEditing((prev) => prev && { ...prev, gap_days_max: e.target.value })}
                        className="w-20 text-[12px] border border-bdr rounded-md px-2 py-1.5 bg-surface focus:outline-none focus:border-brand"
                      />
                      <span className="text-[12px] text-t2">days</span>
                    </div>
                  ) : (
                    <span className="text-[13px] font-semibold text-t1">
                      {r.gap_days_min}–{r.gap_days_max ?? "∞"} days
                    </span>
                  )}
                </div>

                {/* Action */}
                <div>
                  <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1.5">Action</p>
                  {isEditingThis ? (
                    <select
                      value={editing.action}
                      onChange={(e) => setEditing((prev) => prev && { ...prev, action: e.target.value as TreatmentGapAction })}
                      className="w-full text-[12px] border border-bdr rounded-md px-2 py-1.5 bg-surface focus:outline-none focus:border-brand"
                    >
                      <option value="warn">Warn prescriber</option>
                      <option value="block_reorder">Block reorder</option>
                      <option value="require_consult">Require consultation</option>
                    </select>
                  ) : (
                    <span className={`inline-flex items-center gap-1.5 text-[12px] font-semibold px-2 py-0.5 rounded-md border ${cfg.bg} ${cfg.text} ${cfg.border}`}>
                      <Icon className="w-3 h-3" /> {cfg.label}
                    </span>
                  )}
                </div>

                {/* Action copy */}
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-t3 uppercase tracking-wider mb-1.5">Message shown to prescriber</p>
                  {isEditingThis ? (
                    <textarea
                      value={editing.action_copy}
                      onChange={(e) => setEditing((prev) => prev && { ...prev, action_copy: e.target.value })}
                      rows={2}
                      className="w-full text-[12px] border border-bdr rounded-md px-3 py-2 bg-surface text-t1 focus:outline-none focus:border-brand resize-none"
                    />
                  ) : (
                    <p className="text-[12px] text-t2 italic leading-relaxed">&ldquo;{r.action_copy}&rdquo;</p>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Clinical note */}
      <div className="flex items-start gap-2 text-[11px] text-t3 bg-page-bg border border-bdr rounded-lg px-4 py-3 leading-relaxed">
        <Info className="w-3.5 h-3.5 text-t3 mt-px shrink-0" />
        <span>
          Rules are evaluated in order from most restrictive action to least. If multiple rules
          match a gap, the most restrictive (block &gt; consult &gt; warn) takes precedence.
          Changes are applied to future reorder assessments only.
        </span>
      </div>
    </div>
  );
}
