"use client";

import { useState } from "react";
import { raiseClinicalEscalation } from "@/lib/api/mock";
import { useCurrentUser } from "@/lib/context";
import { addCoachingLogAction } from "@/lib/actions/coachingActions";
import { NOW } from "@/lib/api/constants";
import { can } from "@/lib/permissions";
import type { ClinicId, CoachingLog, ClinicalEscalationFlag } from "@/types";

interface Props {
  clinicId: ClinicId;
  patientId: string;
  onSuccess: (log: CoachingLog) => void;
  onCancel: () => void;
}

const ENTRY_TYPES = [
  { value: "initial_call", label: "Initial call" },
  { value: "check_in",     label: "Check-in" },
  { value: "escalation",   label: "Escalation" },
  { value: "note",         label: "Note (ad-hoc)" },
] as const;

const MODALITIES = [
  { value: "",      label: "— Not applicable —" },
  { value: "phone", label: "Phone" },
  { value: "video", label: "Video" },
  { value: "chat",  label: "Chat" },
] as const;

const STATUSES = [
  { value: "completed", label: "Completed" },
  { value: "no_show",   label: "No show" },
  { value: "cancelled", label: "Cancelled" },
] as const;

const SEVERITIES: { value: ClinicalEscalationFlag["severity"]; label: string }[] = [
  { value: "high",   label: "High — immediate prescriber review required" },
  { value: "medium", label: "Medium — review within SLA" },
  { value: "low",    label: "Low — for prescriber awareness" },
];

export function CoachingLogEntryForm({ clinicId, patientId, onSuccess, onCancel }: Props) {
  const CURRENT_USER = useCurrentUser();
  const today = NOW.slice(0, 16); // "YYYY-MM-DDTHH:MM"

  const [entryType, setEntryType]                 = useState<CoachingLog["entry_type"]>("check_in");
  const [entryDate, setEntryDate]                 = useState(today);
  const [scheduledDate, setScheduledDate]         = useState(today);
  const [useScheduledDate, setUseScheduledDate]   = useState(true);
  const [duration, setDuration]                   = useState("");
  const [modality, setModality]                   = useState<string>("phone");
  const [summary, setSummary]                     = useState("");
  const [nextAction, setNextAction]               = useState("");
  const [status, setStatus]                       = useState<CoachingLog["status"]>("completed");
  const [escalationSeverity, setEscalationSeverity] = useState<ClinicalEscalationFlag["severity"]>("medium");
  const [loading, setLoading]                     = useState(false);
  const [error, setError]                         = useState<string | null>(null);

  // ── 3-layer client-side safety check (server also validates) ──────────────
  function validatePermissions(): string | null {
    if (!can(CURRENT_USER, "write", "coaching_log")) {
      return "Only the Coach role may add coaching log entries.";
    }
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const permErr = validatePermissions();
    if (permErr) { setError(permErr); return; }

    if (summary.trim().length < 20) {
      setError("Summary must be at least 20 characters.");
      return;
    }

    setLoading(true);
    try {
      if (entryType === "escalation") {
        // 1. Raise the clinical escalation flag FIRST.
        //    If this fails, we surface the error and do NOT create the log.
        const flag = await raiseClinicalEscalation(clinicId, {
          patient_id:       patientId,
          coaching_log_id:  "", // placeholder — log id not yet known
          severity:         escalationSeverity,
          description:      summary.trim(),
        });

        // 2. Create the coaching log entry referencing the new flag.
        const log = await addCoachingLogAction(clinicId, {
          patient_id:                   patientId,
          coach_id:                     CURRENT_USER.id,
          entry_type:                   entryType,
          entry_date:                   new Date(entryDate).toISOString(),
          scheduled_date:               null,
          duration_minutes:             null,
          modality:                     null,
          summary:                      summary.trim(),
          next_action:                  nextAction.trim() || null,
          status,
          clinical_escalation_flag_id:  flag.id,
          consultation_id:              null,
        });

        onSuccess(log);
        return;
      }

      // ── Non-escalation entry ─────────────────────────────────────────────
      const log = await addCoachingLogAction(clinicId, {
        patient_id:                   patientId,
        coach_id:                     CURRENT_USER.id,
        entry_type:                   entryType,
        entry_date:                   new Date(entryDate).toISOString(),
        scheduled_date: useScheduledDate && entryType !== "note"
          ? new Date(scheduledDate).toISOString()
          : null,
        duration_minutes:             duration ? parseInt(duration, 10) : null,
        modality:                     modality as CoachingLog["modality"] || null,
        summary:                      summary.trim(),
        next_action:                  nextAction.trim() || null,
        status,
        clinical_escalation_flag_id:  null,
        consultation_id:              null,
      });
      onSuccess(log);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save log entry.");
    } finally {
      setLoading(false);
    }
  }

  const labelCls = "block text-[12px] font-semibold text-t2 mb-1";
  const inputCls =
    "w-full rounded-md border border-bdr bg-page-bg px-3 py-2 text-[13px] text-t1 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand transition-colors";

  const isNoteOrEscalation = entryType === "note" || entryType === "escalation";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      {error && (
        <div className="rounded-md bg-err-bg border border-err-bdr px-3 py-2 text-[12px] text-err">
          {error}
        </div>
      )}

      {/* Entry type + Status row */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Entry type *</label>
          <select
            className={inputCls}
            value={entryType}
            onChange={(e) => setEntryType(e.target.value as CoachingLog["entry_type"])}
            required
          >
            {ENTRY_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Outcome *</label>
          <select
            className={inputCls}
            value={status}
            onChange={(e) => setStatus(e.target.value as CoachingLog["status"])}
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Escalation severity — shown only for escalation type */}
      {entryType === "escalation" && (
        <div>
          <label className={labelCls}>Escalation severity *</label>
          <select
            className={inputCls}
            value={escalationSeverity}
            onChange={(e) => setEscalationSeverity(e.target.value as ClinicalEscalationFlag["severity"])}
            required
          >
            {SEVERITIES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      )}

      {/* Dates */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Entry date &amp; time *</label>
          <input
            type="datetime-local"
            className={inputCls}
            value={entryDate}
            onChange={(e) => setEntryDate(e.target.value)}
            required
          />
        </div>
        {!isNoteOrEscalation && (
          <div>
            <label className={labelCls}>
              <span className="flex items-center gap-2">
                Scheduled date
                <input
                  type="checkbox"
                  checked={useScheduledDate}
                  onChange={(e) => setUseScheduledDate(e.target.checked)}
                  className="w-3.5 h-3.5 accent-brand"
                />
                <span className="text-t3 font-normal">Include</span>
              </span>
            </label>
            {useScheduledDate && (
              <input
                type="datetime-local"
                className={inputCls}
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
              />
            )}
          </div>
        )}
      </div>

      {/* Modality + Duration */}
      {!isNoteOrEscalation && (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Modality</label>
            <select
              className={inputCls}
              value={modality}
              onChange={(e) => setModality(e.target.value)}
            >
              {MODALITIES.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Duration (minutes)</label>
            <input
              type="number"
              className={inputCls}
              placeholder="e.g. 30"
              min={1}
              max={180}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Summary */}
      <div>
        <label className={labelCls}>
          {entryType === "escalation" ? "Clinical concern description * (min 20 chars)" : "Summary * (min 20 chars)"}
        </label>
        <textarea
          className={`${inputCls} resize-y`}
          rows={4}
          placeholder={
            entryType === "escalation"
              ? "Describe the clinical concern in full…"
              : "Brief clinical narrative of the session…"
          }
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
          required
          minLength={20}
        />
        <p className="text-[11px] text-t3 mt-1">{summary.length} chars</p>
      </div>

      {/* Next action */}
      <div>
        <label className={labelCls}>Next action</label>
        <input
          type="text"
          className={inputCls}
          placeholder="e.g. Follow up in 2 weeks; re-check weight"
          value={nextAction}
          onChange={(e) => setNextAction(e.target.value)}
        />
      </div>

      {/* Escalation warning banner */}
      {entryType === "escalation" && (
        <div className="rounded-md bg-err-bg border border-err-bdr px-3 py-2.5 text-[12px] text-err">
          <strong>Escalation:</strong> this will create a coaching log entry AND raise a clinical
          escalation flag, notifying prescribers and admins.
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-1 border-t border-bdr">
        <button
          type="button"
          onClick={onCancel}
          disabled={loading}
          className="px-4 py-2 text-[13px] font-medium text-t2 hover:text-t1 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 text-[13px] font-semibold text-white bg-brand rounded-md hover:bg-brand-dark transition-colors disabled:opacity-50"
        >
          {loading ? "Saving…" : entryType === "escalation" ? "Raise escalation" : "Save entry"}
        </button>
      </div>
    </form>
  );
}
