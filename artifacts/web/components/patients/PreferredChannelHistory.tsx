/**
 * PreferredChannelHistory — Task-149.
 *
 * Compact in-profile timeline that surfaces the same audit stream already
 * emitted by updatePatientPreferredChannel (event_type
 * 'patient_preferred_channel_updated', outcome: 'success').
 *
 * Visible to anyone with read:patients (the patient profile is already gated
 * on that permission, so we rely on the route's gate rather than re-checking
 * here).
 *
 * Renders under the PreferredChannelEditor in the left-column Contact section
 * so operators can answer "who switched this patient to SMS, and when?"
 * without digging into the Notification log tab.
 */

import { ArrowRight } from "lucide-react";
import { formatDateTime } from "@/lib/format";
import type { PatientPreferredChannelChange } from "@/lib/api/mock";

const CHANNEL_LABEL: Record<'email' | 'sms' | 'phone', string> = {
  email: "Email",
  sms:   "SMS",
  phone: "Phone",
};

const MAX_VISIBLE = 3;

export function PreferredChannelHistory({
  changes,
}: {
  changes: PatientPreferredChannelChange[];
}) {
  if (changes.length === 0) return null;

  const sorted = [...changes].sort((a, b) =>
    b.changed_at.localeCompare(a.changed_at),
  );
  const visible = sorted.slice(0, MAX_VISIBLE);
  const hiddenCount = sorted.length - visible.length;

  return (
    <div className="mt-2 pt-2 border-t border-bdr/60">
      <p className="text-[10px] font-semibold text-t3 uppercase tracking-wider mb-1.5">
        Channel history
      </p>
      <ul className="flex flex-col gap-1.5">
        {visible.map((c) => (
          <li key={c.id} className="text-[11px] leading-snug">
            <div className="flex items-center gap-1 text-t1">
              <span className="font-medium">{CHANNEL_LABEL[c.previous_channel]}</span>
              <ArrowRight className="w-3 h-3 text-t3 shrink-0" />
              <span className="font-medium">{CHANNEL_LABEL[c.new_channel]}</span>
            </div>
            <div className="text-t3">
              {c.actor_name} · {formatDateTime(c.changed_at)}
            </div>
          </li>
        ))}
      </ul>
      {hiddenCount > 0 && (
        <p className="text-[10px] text-t3 mt-1.5">
          +{hiddenCount} earlier change{hiddenCount === 1 ? "" : "s"} in Notification log
        </p>
      )}
    </div>
  );
}
