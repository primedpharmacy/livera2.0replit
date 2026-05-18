"use client";

/**
 * PatientFlagsEditor — Task-225.
 *
 * Inline editors for the three patient-level flags admins manage from the
 * LeftColumn: VIP toggle, status dropdown, and coach picker. Each editor
 * mirrors PreferredChannelEditor (task-72) so the LeftColumn keeps a single
 * visual language for "click pencil → edit → save/cancel" rows.
 *
 * Layer 1 (UI gate): caller passes `canEdit` derived from
 *   can(CURRENT_USER, 'write', 'patients'); when false rows render static.
 * Layer 2 (server gate): enforced in updatePatientVip/Status/Coach fixtures.
 * Layer 3 (audit log): [AUDIT] entry + PATIENT_FLAG_CHANGES projection so
 *   each save shows up in the per-patient Notification log immediately.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Check, Pencil, X } from "lucide-react";
import {
  updatePatientVip,
  updatePatientStatus,
  updatePatientCoach,
} from "@/lib/api/mock";
import type { ClinicId, Patient } from "@/lib/api/types";

type PatientStatus = Patient["status"];

const STATUS_OPTIONS: readonly PatientStatus[] = [
  "new",
  "active",
  "monitoring",
  "suspended",
] as const;

export interface CoachOption {
  id: string;
  full_name: string;
}

interface CommonProps {
  clinicId: ClinicId;
  patientId: string;
  canEdit: boolean;
}

// ── VIP toggle ──────────────────────────────────────────────────────────────
export function VipFlagEditor({
  clinicId,
  patientId,
  current,
  canEdit,
}: CommonProps & { current: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<boolean>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <Row label="VIP">
        <span className="text-[12px] text-t1 font-medium">{current ? "Yes" : "No"}</span>
      </Row>
    );
  }

  async function save() {
    if (draft === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePatientVip(clinicId, patientId, draft);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update VIP flag");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Row label="VIP">
        <span className="text-[12px] text-t1 font-medium">{current ? "Yes" : "No"}</span>
        <EditButton onClick={() => { setDraft(current); setError(null); setEditing(true); }} ariaLabel="Change VIP flag" />
      </Row>
    );
  }

  return (
    <div className="py-[3px]">
      <Row label="VIP">
        <label className="flex items-center gap-1 text-[12px] text-t1">
          <input
            type="checkbox"
            checked={draft}
            onChange={(e) => setDraft(e.target.checked)}
            disabled={saving}
            className="accent-brand"
            aria-label="VIP"
          />
          <span>{draft ? "Yes" : "No"}</span>
        </label>
        <SaveCancel saving={saving} onSave={save} onCancel={() => { setDraft(current); setError(null); setEditing(false); }} />
      </Row>
      {error && <div className="mt-1.5 text-[11px] text-err">{error}</div>}
    </div>
  );
}

// ── Status dropdown ─────────────────────────────────────────────────────────
export function StatusFlagEditor({
  clinicId,
  patientId,
  current,
  canEdit,
}: CommonProps & { current: PatientStatus }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<PatientStatus>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  if (!canEdit) {
    return (
      <Row label="Status">
        <span className="text-[12px] text-t1 font-medium capitalize">{current}</span>
      </Row>
    );
  }

  async function save() {
    if (draft === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePatientStatus(clinicId, patientId, draft);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update status");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Row label="Status">
        <span className="text-[12px] text-t1 font-medium capitalize">{current}</span>
        <EditButton onClick={() => { setDraft(current); setError(null); setEditing(true); }} ariaLabel="Change status" />
      </Row>
    );
  }

  return (
    <div className="py-[3px]">
      <Row label="Status">
        <select
          value={draft}
          onChange={(e) => setDraft(e.target.value as PatientStatus)}
          disabled={saving}
          className="text-[12px] px-1.5 py-0.5 border border-bdr rounded bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand capitalize"
          aria-label="Patient status"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <SaveCancel saving={saving} onSave={save} onCancel={() => { setDraft(current); setError(null); setEditing(false); }} />
      </Row>
      {error && <div className="mt-1.5 text-[11px] text-err">{error}</div>}
    </div>
  );
}

// ── Coach picker ────────────────────────────────────────────────────────────
export function CoachFlagEditor({
  clinicId,
  patientId,
  current,
  coaches,
  canEdit,
}: CommonProps & { current: string | null; coaches: CoachOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<string | null>(current);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const displayName = (id: string | null) => {
    if (!id) return "Unassigned";
    return coaches.find((c) => c.id === id)?.full_name ?? id;
  };

  if (!canEdit) {
    return (
      <Row label="Coach">
        <span className="text-[12px] text-t1 font-medium">{displayName(current)}</span>
      </Row>
    );
  }

  async function save() {
    if (draft === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePatientCoach(clinicId, patientId, draft);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update coach");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <Row label="Coach">
        <span className="text-[12px] text-t1 font-medium">{displayName(current)}</span>
        <EditButton onClick={() => { setDraft(current); setError(null); setEditing(true); }} ariaLabel="Change coach" />
      </Row>
    );
  }

  return (
    <div className="py-[3px]">
      <Row label="Coach">
        <select
          value={draft ?? ""}
          onChange={(e) => setDraft(e.target.value === "" ? null : e.target.value)}
          disabled={saving}
          className="text-[12px] px-1.5 py-0.5 border border-bdr rounded bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          aria-label="Patient coach"
        >
          <option value="">Unassigned</option>
          {coaches.map((c) => (
            <option key={c.id} value={c.id}>{c.full_name}</option>
          ))}
        </select>
        <SaveCancel saving={saving} onSave={save} onCancel={() => { setDraft(current); setError(null); setEditing(false); }} />
      </Row>
      {error && <div className="mt-1.5 text-[11px] text-err">{error}</div>}
    </div>
  );
}

// ── Shared row chrome ───────────────────────────────────────────────────────
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-center gap-2 py-[3px]">
      <span className="text-[12px] text-t2 shrink-0">{label}</span>
      <div className="flex items-center gap-1.5">{children}</div>
    </div>
  );
}

function EditButton({ onClick, ariaLabel }: { onClick: () => void; ariaLabel: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-t3 hover:text-brand transition-colors p-0.5 rounded"
      aria-label={ariaLabel}
      title={ariaLabel}
    >
      <Pencil className="w-3 h-3" />
    </button>
  );
}

function SaveCancel({
  saving,
  onSave,
  onCancel,
}: {
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <>
      <button
        type="button"
        onClick={onSave}
        disabled={saving}
        className="text-ok hover:text-ok p-0.5 rounded disabled:opacity-40"
        aria-label="Save"
        title="Save"
      >
        <Check className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="text-t3 hover:text-t1 p-0.5 rounded disabled:opacity-40"
        aria-label="Cancel"
        title="Cancel"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </>
  );
}
