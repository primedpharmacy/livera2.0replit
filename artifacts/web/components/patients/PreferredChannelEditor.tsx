"use client";

/**
 * PreferredChannelEditor — Task-72.
 *
 * Inline editor in the patient profile Contact section that lets an authorised
 * admin/owner change patient.contact.preferred_channel. The change drives the
 * Task-65 notification dispatcher (refund + cancellation routing).
 *
 * Layer 1 (UI gate): caller passes `canEdit` derived from
 *   can(CURRENT_USER, 'write', 'patients'); when false we render the current
 *   channel as a static label (matches existing DR styling).
 * Layer 2 (server gate): enforced in updatePatientPreferredChannel fixture.
 * Layer 3 (audit log): [AUDIT] entry written by the fixture.
 *
 * UX details:
 *   - Switching to 'sms' with no phone on file surfaces an inline warning and
 *     blocks the save (the dispatcher would silently fall back to email).
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { AlertTriangle, Check, Pencil, X } from "lucide-react";
import { updatePatientPreferredChannel } from "@/lib/api/mock";
import type { ClinicId } from "@/lib/api/types";

type Channel = "email" | "sms" | "phone";

const CHANNEL_LABEL: Record<Channel, string> = {
  email: "Email",
  sms:   "SMS",
  phone: "Phone",
};

interface Props {
  clinicId:  ClinicId;
  patientId: string;
  current:   Channel;
  hasPhone:  boolean;
  canEdit:   boolean;
}

export function PreferredChannelEditor({
  clinicId,
  patientId,
  current,
  hasPhone,
  canEdit,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft]     = useState<Channel>(current);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState<string | null>(null);
  const [, startTransition]   = useTransition();

  const smsWarning = draft === "sms" && !hasPhone;

  // Read-only fallback — matches the surrounding DR row styling so the
  // Contact section keeps a consistent look for non-privileged users.
  if (!canEdit) {
    return (
      <div className="flex justify-between items-baseline gap-2 py-[3px]">
        <span className="text-[12px] text-t2 shrink-0">Channel</span>
        <span className="text-[12px] text-t1 text-right font-medium">
          {CHANNEL_LABEL[current]}
        </span>
      </div>
    );
  }

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
    if (smsWarning) {
      setError("Add a phone number before switching to SMS.");
      return;
    }
    if (draft === current) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await updatePatientPreferredChannel(clinicId, patientId, draft);
      setEditing(false);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update channel");
    } finally {
      setSaving(false);
    }
  }

  if (!editing) {
    return (
      <div className="flex justify-between items-center gap-2 py-[3px]">
        <span className="text-[12px] text-t2 shrink-0">Channel</span>
        <div className="flex items-center gap-1.5">
          <span className="text-[12px] text-t1 font-medium">
            {CHANNEL_LABEL[current]}
          </span>
          <button
            type="button"
            onClick={startEdit}
            className="text-t3 hover:text-brand transition-colors p-0.5 rounded"
            aria-label="Change preferred channel"
            title="Change preferred channel"
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
        <span className="text-[12px] text-t2 shrink-0">Channel</span>
        <div className="flex items-center gap-1.5">
          <select
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value as Channel);
              setError(null);
            }}
            disabled={saving}
            className="text-[12px] px-1.5 py-0.5 border border-bdr rounded bg-page-bg text-t1 focus:outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            aria-label="Preferred channel"
          >
            <option value="email">Email</option>
            <option value="sms">SMS</option>
            <option value="phone">Phone</option>
          </select>
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="text-ok hover:text-ok p-0.5 rounded disabled:opacity-40"
            aria-label="Save channel"
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

      {smsWarning && (
        <div className="flex items-start gap-1.5 mt-1.5 px-2 py-1.5 bg-warn-bg border border-warn-bdr rounded text-[11px] text-warn">
          <AlertTriangle className="w-3 h-3 shrink-0 mt-px" />
          <span>No phone number on file — SMS notifications will silently fall back to email.</span>
        </div>
      )}

      {error && !smsWarning && (
        <div className="mt-1.5 text-[11px] text-err">{error}</div>
      )}
    </div>
  );
}
