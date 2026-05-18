/**
 * Timeline adapter — PatientPreferredChannelChange → TimelineEntry (Task-223).
 *
 * Task-149 surfaced preferred-channel changes inline in the Contact section
 * (PreferredChannelHistory) and in the Notification log tab. Task-223 extends
 * the same audit projection into the Patient Notes timeline so operators can
 * piece together a single chronological story alongside notes / orders /
 * incidents.
 *
 * Visible to anyone with read:patients — the patient profile route is already
 * gated on that permission, matching PreferredChannelHistory's stance.
 *
 * badge_color: neutral — channel changes are admin breadcrumbs, not clinical
 * events, so they share the neutral palette with gp_letter rather than
 * competing visually with order_event (blue) or clinical_note (green).
 *
 * link_url: null — there is no dedicated detail route; the full history is
 * already reachable from the Contact section and Notification log tab.
 */

import type { ClinicId } from '@/lib/api/types';
import type { PatientPreferredChannelChange } from '@/lib/api/fixtures/patients';
import type { TimelineEntry } from '../types';

const CHANNEL_LABEL: Record<'email' | 'sms' | 'phone', string> = {
  email: 'Email',
  sms:   'SMS',
  phone: 'Phone',
};

export function adaptChannelChange(
  change: PatientPreferredChannelChange,
  _clinicId: ClinicId,
): TimelineEntry {
  return {
    id:           change.id,
    type:         'channel_change',
    patient_id:   change.patient_id,
    occurred_at:  change.changed_at,
    author_label: `${change.actor_name} (Admin)`,
    summary:      `Preferred channel changed from ${CHANNEL_LABEL[change.previous_channel]} to ${CHANNEL_LABEL[change.new_channel]}`,
    badge_color:  'neutral',
    link_url:     null,
  };
}
