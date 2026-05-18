"use client";

/**
 * PatientContactFieldEditor — Task-250.
 *
 * Inline editors for patient phone and postcode on the patient profile.
 * Mirrors the PreferredChannelEditor / PatientFlagsEditor 3-layer safety
 * chain (UI gate → server gate → audit log) and routes through the
 * canonical mutations updatePatientPhone / updatePatientPostcode, which
 * re-use the intake validators so admins can no longer save malformed
 * values (`m12ab`, `07700`) into a record.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import { updatePatientPhone, updatePatientPostcode } from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/types";

interface BaseProps {
  clinicId:  ClinicId;
  patientId: string;
  current:   string;
  canEdit:   boolean;
}

function ReadOnlyRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2 py-[3px]">
      <span className="text-[12px] text-t2 shrink-0">{label}</span>
      <span className="text-[12px] text-t1 text-right font-mono">{value || "—"}</span>
    </div>
  );
}

function FieldEditor({
  label,
  current,
  canEdit,
  placeholder,
  save: doSave,
  ariaLabel,
}: {
  label: string;
  current: string;
  canEdit: boolean;
  placeholder: string;
  save: (raw: string) => Promise<unknown>;
  ariaLabel: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState(current);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [, startTransition]   = useTransition();

  if (!canEdit) return <ReadOnlyRow label={label} value={current} />;

  function startEdit() {
    setDraft(current);
    setError(null);
    setEditing(true);
  }

  function cancel() {
    setDraft(current);
    setError(null);
    setEditing(false);
  }

  async function save() {
    if (draft.trim() === current.trim()) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await doSave(draft.trim());
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to update ${label.toLowerCase()}`);
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex justify-between items-center gap-2 py-[3px]">
        <span className="text-[12px] text-t2 shrink-0">{label}</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-t1 font-mono">{current || "—"}</span>
          <button
            type="button"
            onClick={startEdit}
            className="text-t3 hover:text-brand transition-colors p-0.5 rounded"
            aria-label={`Edit ${label.toLowerCase()}`}
            title={`Edit ${label.toLowerCase()}`}
          >
            <Pencil className="w-3 h-3" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="py-[3px]">
      <div className="flex justify-between items-center gap-2">
        <span className="text-[12px] text-t2 shrink-0">{label}</span>
        <div className="flex items-center gap-1.5">
          <input
            type="text"
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              setError(null);
            }}
            placeholder={placeholder}
            disabled={saving}
            aria-label={ariaLabel}
            className="text-[12px] px-1.5 py-0.5 border border-bdr rounded bg-page-bg text-t1 font-mono w-[160px] text-right focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            onKeyDown={(e) => {
              if (e.key === "Enter") void save();
              if (e.key === "Escape") cancel();
            }}
          />
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-ok hover:text-ok p-0.5 rounded disabled:opacity-40"
            aria-label={`Save ${label.toLowerCase()}`}
            title="Save"
          >
            <Check className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={saving}
            className="text-t3 hover:text-t1 p-0.5 rounded disabled:opacity-40"
            aria-label="Cancel"
            title="Cancel"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {error && (
        <div className="mt-1.5 text-[11px] text-err text-right" role="alert">{error}</div>
      )}
    </div>
  );
}

export function PatientPhoneEditor({ clinicId, patientId, current, canEdit }: BaseProps) {
  return (
    <FieldEditor
      label="Phone"
      current={current}
      canEdit={canEdit}
      placeholder="07700 900123"
      ariaLabel="Patient phone number"
      save={(raw) => updatePatientPhone(clinicId, patientId, raw)}
    />
  );
}

export function PatientPostcodeEditor({ clinicId, patientId, current, canEdit }: BaseProps) {
  return (
    <FieldEditor
      label="Postcode"
      current={current}
      canEdit={canEdit}
      placeholder="M1 2AB"
      ariaLabel="Patient postcode"
      save={(raw) => updatePatientPostcode(clinicId, patientId, raw)}
    />
  );
}
