"use client";

/**
 * SwitchToEmailButton — Task-200.
 *
 * Renders next to a Bounced/Failed SMS row in the per-patient Notification
 * log tab. Now that Task-137 surfaces WHY an SMS failed, the natural recovery
 * is one click: flip the patient's preferred channel to email so the
 * notification dispatcher (Task-65) stops attempting SMS for subsequent
 * messages.
 *
 * Reuses the existing updatePatientPreferredChannel flow so that:
 *   - the same Owner/Admin permission gate is enforced server-side (Layer 2),
 *   - the change is appended to listPatientPreferredChannelChanges (the
 *     "channel change row in the existing change log" required by the task),
 *   - the [AUDIT] / event-log entries are written exactly as if staff had
 *     used the Contact-section editor.
 *
 * The button is only mounted by the caller when `canEdit` is true AND the
 * patient is not already on email — see NotificationRow in
 * `patients/[patient_id]/page.tsx` for the gating.
 */

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Mail } from "lucide-react";
import { updatePreferredChannelAction } from "@/app/actions/preferredChannel";
import type { ClinicId } from "@/lib/api/types";

interface Props {
  clinicId: ClinicId;
  patientId: string;
}

export function SwitchToEmailButton({ clinicId, patientId }: Props) {
  const router = useRouter();
  // Explicit `saving` flag tracks the mutation itself; useTransition is used
  // only to wrap router.refresh() so React can schedule the resulting
  // re-render. This avoids the known footgun of awaiting inside
  // startTransition (which doesn't reliably keep `isPending` true for async
  // work and would let users double-click the button mid-save).
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleClick = async () => {
    if (saving) return;
    setError(null);
    setSaving(true);
    try {
      await updatePreferredChannelAction(clinicId, patientId, "email");
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not switch channel.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mt-2 flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={saving}
        className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-md border border-bdr bg-surface text-t1 hover:bg-page-bg hover:border-brand disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        title="Set preferred channel to Email"
      >
        <Mail className="w-3 h-3" />
        {saving ? "Switching…" : "Switch to email"}
      </button>
      {error && <span className="text-[11px] text-err">{error}</span>}
    </div>
  );
}
