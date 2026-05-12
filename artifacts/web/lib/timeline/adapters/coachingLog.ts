/**
 * Timeline adapter — CoachingLog → TimelineEntry (BLD-4.3, Wave 3).
 *
 * badge_color: purple
 * Coach role: only sees coaching_log entries in timeline (DEC-05).
 * link_url: /<clinicId>/patients/<patientId>?tab=coaching
 */

import type { CoachingLog, ClinicId } from '@/lib/api/types';
import type { TimelineEntry } from '../types';

const ENTRY_TYPE_LABEL: Record<CoachingLog['entry_type'], string> = {
  initial_call: 'Initial call',
  check_in:     'Check-in',
  escalation:   'Escalation',
  note:         'Note',
};

export function adaptCoachingLog(
  log: CoachingLog,
  clinicId: ClinicId,
  coachName?: string,
): TimelineEntry {
  const label = coachName ? `${coachName} (Coach)` : `${log.coach_id} (Coach)`;
  const typeLabel = ENTRY_TYPE_LABEL[log.entry_type] ?? log.entry_type;
  const summary = `${typeLabel}: ${log.summary.length > 80 ? `${log.summary.slice(0, 77)}…` : log.summary}`;

  return {
    id:           log.id,
    type:         'coaching_log',
    patient_id:   log.patient_id,
    occurred_at:  log.entry_date,
    author_label: label,
    summary,
    badge_color:  'purple',
    link_url:     `/${clinicId}/patients/${log.patient_id}?tab=coaching`,
  };
}
